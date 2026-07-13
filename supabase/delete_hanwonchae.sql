-- "한원채" 계정 하나만 안전하게 삭제
-- Supabase SQL Editor에서 그대로 실행하세요.
-- 실제 배포된 DB에 없는 컬럼/테이블은 자동으로 건너뜁니다.

DO $$
DECLARE
  target_id UUID;
  t TEXT;
  c TEXT;
  targets TEXT[][] := ARRAY[
    ARRAY['merchants', 'sales_id'],
    ARRAY['tickets', 'sales_id'],
    ARRAY['tickets', 'cs_id'],
    ARRAY['tickets', 'tech_id'],
    ARRAY['tickets', 'deleted_by'],
    ARRAY['ticket_logs', 'user_id'],
    ARRAY['contact_logs', 'user_id'],
    ARRAY['attachments', 'user_id'],
    ARRAY['franchise_applications', 'sales_id'],
    ARRAY['franchise_applications', 'cs_id'],
    ARRAY['franchise_applications', 'tech_id'],
    ARRAY['franchise_applications', 'created_by'],
    ARRAY['franchise_application_logs', 'user_id'],
    ARRAY['change_requests', 'sales_id'],
    ARRAY['change_requests', 'cs_id'],
    ARRAY['change_requests', 'created_by'],
    ARRAY['calendar_events', 'created_by'],
    ARRAY['install_blueprints', 'created_by'],
    ARRAY['install_blueprints', 'updated_by'],
    ARRAY['inventory_items', 'user_id'],
    ARRAY['inventory_logs', 'user_id'],
    ARRAY['notification_logs', 'user_id']
  ];
  pair TEXT[];
BEGIN
  SELECT id INTO target_id FROM profiles WHERE name = '한원채' LIMIT 1;

  IF target_id IS NULL THEN
    RAISE NOTICE '한원채 프로필을 찾을 수 없습니다.';
    RETURN;
  END IF;

  FOREACH pair SLICE 1 IN ARRAY targets LOOP
    t := pair[1];
    c := pair[2];
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = c
    ) THEN
      EXECUTE format('UPDATE %I SET %I = NULL WHERE %I = $1', t, c, c) USING target_id;
    END IF;
  END LOOP;

  -- profiles는 auth.users 삭제 시 ON DELETE CASCADE로 함께 삭제됨
  DELETE FROM auth.users WHERE id = target_id;

  RAISE NOTICE '한원채 계정(%) 삭제 완료', target_id;
END $$;
