-- "한원채" 계정 하나만 안전하게 삭제
-- Supabase SQL Editor에서 그대로 실행하세요.

DO $$
DECLARE
  target_id UUID;
BEGIN
  SELECT id INTO target_id FROM profiles WHERE name = '한원채' LIMIT 1;

  IF target_id IS NULL THEN
    RAISE NOTICE '한원채 프로필을 찾을 수 없습니다.';
    RETURN;
  END IF;

  UPDATE merchants SET sales_id = NULL WHERE sales_id = target_id;
  UPDATE tickets SET sales_id = NULL WHERE sales_id = target_id;
  UPDATE tickets SET cs_id = NULL WHERE cs_id = target_id;
  UPDATE tickets SET tech_id = NULL WHERE tech_id = target_id;
  UPDATE tickets SET deleted_by = NULL WHERE deleted_by = target_id;
  UPDATE ticket_logs SET user_id = NULL WHERE user_id = target_id;
  UPDATE contact_logs SET user_id = NULL WHERE user_id = target_id;
  UPDATE attachments SET user_id = NULL WHERE user_id = target_id;
  UPDATE franchise_applications SET sales_id = NULL WHERE sales_id = target_id;
  UPDATE franchise_applications SET cs_id = NULL WHERE cs_id = target_id;
  UPDATE franchise_applications SET tech_id = NULL WHERE tech_id = target_id;
  UPDATE franchise_applications SET created_by = NULL WHERE created_by = target_id;
  UPDATE franchise_application_logs SET user_id = NULL WHERE user_id = target_id;
  UPDATE change_requests SET sales_id = NULL WHERE sales_id = target_id;
  UPDATE change_requests SET cs_id = NULL WHERE cs_id = target_id;
  UPDATE change_requests SET created_by = NULL WHERE created_by = target_id;
  UPDATE calendar_events SET created_by = NULL WHERE created_by = target_id;
  UPDATE install_blueprints SET created_by = NULL WHERE created_by = target_id;
  UPDATE install_blueprints SET updated_by = NULL WHERE updated_by = target_id;
  UPDATE inventory_items SET user_id = NULL WHERE user_id = target_id;
  UPDATE inventory_logs SET user_id = NULL WHERE user_id = target_id;
  UPDATE notification_logs SET user_id = NULL WHERE user_id = target_id;

  -- profiles는 auth.users 삭제 시 ON DELETE CASCADE로 함께 삭제됨
  DELETE FROM auth.users WHERE id = target_id;

  RAISE NOTICE '한원채 계정(%) 삭제 완료', target_id;
END $$;
