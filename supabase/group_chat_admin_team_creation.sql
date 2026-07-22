-- 마스터/관리자의 팀 채팅방 관리 권한과 기본 개발팀을 추가합니다.

ALTER TABLE group_chat_rooms
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

CREATE OR REPLACE FUNCTION is_group_chat_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid() AND role IN ('master', 'admin')
  );
$$;

REVOKE ALL ON FUNCTION is_group_chat_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_group_chat_admin() TO authenticated;

DROP POLICY IF EXISTS "members can view group rooms" ON group_chat_rooms;
CREATE POLICY "members can view group rooms" ON group_chat_rooms FOR SELECT TO authenticated
  USING (is_group_chat_member(id) OR is_group_chat_admin());

DROP POLICY IF EXISTS "members can view group members" ON group_chat_members;
CREATE POLICY "members can view group members" ON group_chat_members FOR SELECT TO authenticated
  USING (is_group_chat_member(room_id) OR is_group_chat_admin());

DROP POLICY IF EXISTS "members can view group messages" ON group_chat_messages;
CREATE POLICY "members can view group messages" ON group_chat_messages FOR SELECT TO authenticated
  USING (is_group_chat_member(room_id) OR is_group_chat_admin());

DROP POLICY IF EXISTS "members can send group messages" ON group_chat_messages;
CREATE POLICY "members can send group messages" ON group_chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (is_group_chat_member(room_id) OR is_group_chat_admin())
  );

INSERT INTO group_chat_rooms (id, name, description) VALUES
  ('10000000-0000-0000-0000-000000000004', '개발팀', '개발팀 단체 채팅방')
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO group_chat_members (room_id, user_id)
SELECT '10000000-0000-0000-0000-000000000004'::UUID, id
FROM profiles
WHERE role IN ('master', 'admin')
ON CONFLICT DO NOTHING;
