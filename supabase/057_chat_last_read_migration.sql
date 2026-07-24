-- ============================================
-- 채팅 읽음 상태 추적 (읽지 않은 메시지 표시용)
-- (chat_inbound_schema.sql 이후 추가 — src/app/(app)/chat 에서 참조됨)
-- ============================================

-- 사용자별 마지막으로 읽은 시각
-- room_type: 'global' (전체 채팅방, room_id는 고정 sentinel UUID 사용) | 'dm' (1:1 채팅, room_id = dm_rooms.id)
CREATE TABLE IF NOT EXISTS chat_room_reads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  room_type TEXT NOT NULL CHECK (room_type IN ('global', 'dm')),
  room_id UUID NOT NULL, -- 전체 채팅방은 '00000000-0000-0000-0000-000000000000' 고정값 사용
  last_read_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, room_type, room_id)
);

ALTER TABLE chat_room_reads ENABLE ROW LEVEL SECURITY;

-- 본인 읽음 상태만 조회/작성/수정 가능
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
