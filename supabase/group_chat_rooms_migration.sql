-- 기본 단체 채팅방: 영업팀, CS팀, 기술지원팀
-- 전체 채팅방은 기존 messages 테이블과 /chat/global 화면을 계속 사용합니다.

CREATE TABLE IF NOT EXISTS group_chat_rooms (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_chat_members (
  room_id UUID NOT NULL REFERENCES group_chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS group_chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES group_chat_rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(trim(content)) BETWEEN 1 AND 4000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS group_chat_messages_room_created_at_idx
  ON group_chat_messages (room_id, created_at DESC);

INSERT INTO group_chat_rooms (id, name, description) VALUES
  ('10000000-0000-0000-0000-000000000001', 'CS팀', 'CS팀 단체 채팅방'),
  ('10000000-0000-0000-0000-000000000002', '기술지원팀', '기술지원팀 단체 채팅방'),
  ('10000000-0000-0000-0000-000000000003', '영업팀', '영업팀 단체 채팅방')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 기존 직원에게 역할에 맞는 기본 팀방을 배정합니다.
INSERT INTO group_chat_members (room_id, user_id)
SELECT room.id, profile.id
FROM group_chat_rooms room
CROSS JOIN profiles profile
WHERE (room.id = '10000000-0000-0000-0000-000000000001' AND profile.role IN ('cs', 'admin', 'master'))
   OR (room.id = '10000000-0000-0000-0000-000000000002' AND profile.role IN ('tech', 'admin', 'master'))
   OR (room.id = '10000000-0000-0000-0000-000000000003' AND profile.role IN ('sales', 'admin', 'master'))
ON CONFLICT DO NOTHING;

-- 신규 직원 생성 및 역할 변경 시 기본 팀방 멤버십을 자동 동기화합니다.
CREATE OR REPLACE FUNCTION sync_default_group_chat_membership()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM group_chat_members
  WHERE user_id = NEW.id
    AND room_id IN (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000003'
    );

  INSERT INTO group_chat_members (room_id, user_id)
  SELECT room_id, NEW.id
  FROM (VALUES
    ('10000000-0000-0000-0000-000000000001'::UUID, ARRAY['cs', 'admin', 'master']::TEXT[]),
    ('10000000-0000-0000-0000-000000000002'::UUID, ARRAY['tech', 'admin', 'master']::TEXT[]),
    ('10000000-0000-0000-0000-000000000003'::UUID, ARRAY['sales', 'admin', 'master']::TEXT[])
  ) AS defaults(room_id, allowed_roles)
  WHERE NEW.role = ANY(defaults.allowed_roles)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_default_group_chat_membership_trigger ON profiles;
CREATE TRIGGER sync_default_group_chat_membership_trigger
AFTER INSERT OR UPDATE OF role ON profiles
FOR EACH ROW EXECUTE FUNCTION sync_default_group_chat_membership();

ALTER TABLE group_chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chat_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_chat_messages ENABLE ROW LEVEL SECURITY;

-- group_chat_members 정책 안에서 같은 테이블을 직접 조회하면 RLS 재귀가 발생하므로
-- SECURITY DEFINER 함수로 멤버 여부를 판정합니다.
CREATE OR REPLACE FUNCTION is_group_chat_member(target_room_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM group_chat_members
    WHERE room_id = target_room_id AND user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION is_group_chat_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_group_chat_member(UUID) TO authenticated;

DROP POLICY IF EXISTS "members can view group rooms" ON group_chat_rooms;
CREATE POLICY "members can view group rooms" ON group_chat_rooms FOR SELECT TO authenticated
  USING (is_group_chat_member(id));

DROP POLICY IF EXISTS "members can view group members" ON group_chat_members;
CREATE POLICY "members can view group members" ON group_chat_members FOR SELECT TO authenticated
  USING (is_group_chat_member(room_id));

DROP POLICY IF EXISTS "members can view group messages" ON group_chat_messages;
CREATE POLICY "members can view group messages" ON group_chat_messages FOR SELECT TO authenticated
  USING (is_group_chat_member(room_id));

DROP POLICY IF EXISTS "members can send group messages" ON group_chat_messages;
CREATE POLICY "members can send group messages" ON group_chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_group_chat_member(room_id));

-- 기존 읽음 상태 마이그레이션이 적용되지 않은 환경에서도 단독 실행되도록
-- 읽음 상태 테이블과 정책을 함께 보장합니다.
CREATE TABLE IF NOT EXISTS chat_room_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  room_type TEXT NOT NULL,
  room_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, room_type, room_id)
);

ALTER TABLE chat_room_reads
  DROP CONSTRAINT IF EXISTS chat_room_reads_room_type_check;
ALTER TABLE chat_room_reads
  ADD CONSTRAINT chat_room_reads_room_type_check
  CHECK (room_type IN ('global', 'dm', 'group'));

ALTER TABLE chat_room_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own chat reads select" ON chat_room_reads;
CREATE POLICY "own chat reads select" ON chat_room_reads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "own chat reads insert" ON chat_room_reads;
CREATE POLICY "own chat reads insert" ON chat_room_reads FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "own chat reads update" ON chat_room_reads;
CREATE POLICY "own chat reads update" ON chat_room_reads FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE group_chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
