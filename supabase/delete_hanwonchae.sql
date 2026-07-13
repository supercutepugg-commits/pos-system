-- "한원채" 계정 하나만 안전하게 삭제
-- Supabase SQL Editor에서 그대로 실행하세요.
-- profiles(id)를 참조하는 모든 FK를 자동으로 찾아서
-- NULL 허용 컬럼이면 NULL 처리, NOT NULL이면 해당 행을 삭제한 뒤
-- 계정을 삭제합니다. (dm_rooms 등 어떤 테이블이 참조하든 자동 대응)

DO $$
DECLARE
  target_id UUID;
  rec RECORD;
  is_nullable BOOLEAN;
BEGIN
  SELECT id INTO target_id FROM profiles WHERE name = '한원채' LIMIT 1;

  IF target_id IS NULL THEN
    RAISE NOTICE '한원채 프로필을 찾을 수 없습니다.';
    RETURN;
  END IF;

  FOR rec IN
    SELECT
      conrelid::regclass::text AS ref_table,
      a.attname AS ref_column
    FROM pg_constraint con
    JOIN unnest(con.conkey) WITH ORDINALITY AS ck(attnum, ord) ON TRUE
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ck.attnum
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.profiles'::regclass
  LOOP
    SELECT (is_nullable = 'YES') INTO is_nullable
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = rec.ref_table AND column_name = rec.ref_column;

    IF is_nullable THEN
      EXECUTE format('UPDATE %I SET %I = NULL WHERE %I = $1', rec.ref_table, rec.ref_column, rec.ref_column) USING target_id;
    ELSE
      EXECUTE format('DELETE FROM %I WHERE %I = $1', rec.ref_table, rec.ref_column) USING target_id;
    END IF;
  END LOOP;

  -- profiles는 auth.users 삭제 시 ON DELETE CASCADE로 함께 삭제됨
  DELETE FROM auth.users WHERE id = target_id;

  RAISE NOTICE '한원채 계정(%) 삭제 완료', target_id;
END $$;
