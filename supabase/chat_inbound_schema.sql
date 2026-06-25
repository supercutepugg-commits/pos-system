-- ============================================
-- 채팅 & 인입 관리 테이블
-- (schema.sql에 빠져 있던 테이블 보강 — src/app/(app)/chat, src/app/(app)/inbound 에서 참조됨)
-- ============================================

-- 전체 채팅방 메시지
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1:1 DM 방
CREATE TABLE IF NOT EXISTS dm_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user1_id, user2_id)
);

-- DM 메시지
CREATE TABLE IF NOT EXISTS dm_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES dm_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 고객 인입 문의 (CRM)
CREATE TABLE IF NOT EXISTS crm_inbound (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE,
  staff TEXT,
  channel TEXT,
  category TEXT,
  status TEXT,
  owner_name TEXT,
  business_name TEXT,
  phone TEXT,
  inquiry TEXT,
  answer TEXT,
  chat_log TEXT,
  ai_summary TEXT,
  tech_note TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_inbound ENABLE ROW LEVEL SECURITY;

-- 전체 채팅: 로그인 사용자 누구나 조회/작성 가능
DROP POLICY IF EXISTS "authenticated read" ON messages;
CREATE POLICY "authenticated read" ON messages FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "authenticated insert" ON messages;
CREATE POLICY "authenticated insert" ON messages FOR INSERT TO authenticated WITH CHECK (TRUE);

-- DM 방/메시지: 당사자만 조회 가능
DROP POLICY IF EXISTS "own dm rooms" ON dm_rooms;
CREATE POLICY "own dm rooms" ON dm_rooms FOR SELECT TO authenticated
  USING (user1_id = auth.uid() OR user2_id = auth.uid());
DROP POLICY IF EXISTS "create dm room" ON dm_rooms;
CREATE POLICY "create dm room" ON dm_rooms FOR INSERT TO authenticated
  WITH CHECK (user1_id = auth.uid() OR user2_id = auth.uid());

DROP POLICY IF EXISTS "own dm messages" ON dm_messages;
CREATE POLICY "own dm messages" ON dm_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM dm_rooms r WHERE r.id = room_id
      AND (r.user1_id = auth.uid() OR r.user2_id = auth.uid())
  ));
DROP POLICY IF EXISTS "send dm message" ON dm_messages;
CREATE POLICY "send dm message" ON dm_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM dm_rooms r WHERE r.id = room_id
        AND (r.user1_id = auth.uid() OR r.user2_id = auth.uid())
    )
  );

-- 인입 내역: 로그인 사용자는 조회/수정/삭제 가능 (역할별 제한은 앱에서)
DROP POLICY IF EXISTS "authenticated read" ON crm_inbound;
CREATE POLICY "authenticated read" ON crm_inbound FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "authenticated insert" ON crm_inbound;
CREATE POLICY "authenticated insert" ON crm_inbound FOR INSERT TO authenticated WITH CHECK (TRUE);
DROP POLICY IF EXISTS "authenticated update" ON crm_inbound;
CREATE POLICY "authenticated update" ON crm_inbound FOR UPDATE TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "authenticated delete" ON crm_inbound;
CREATE POLICY "authenticated delete" ON crm_inbound FOR DELETE TO authenticated USING (TRUE);

-- 실시간 구독 활성화 (이미 추가돼 있으면 조용히 건너뜀)
-- crm_inbound 실시간 구독은 enable_inbound_realtime.sql에서 별도 적용됨
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE dm_messages;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
