-- 직원 계정 삭제용 함수
-- profiles를 참조하는 모든 FK를 자동으로 정리한 뒤 auth.users를 삭제합니다.
-- Supabase SQL Editor에서 한 번 실행하세요.
CREATE OR REPLACE FUNCTION public.delete_user_account(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  ref RECORD;
  is_nullable BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION '삭제할 계정 ID가 필요합니다.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION '존재하지 않는 계정입니다.';
  END IF;

  -- profiles를 직접 참조하는 FK를 실제 DB 스키마에서 찾아 정리합니다.
  -- NULL 허용 컬럼은 담당자만 비우고, NOT NULL 컬럼은 관련 행을 삭제합니다.
  FOR ref IN
    SELECT
      namespace.nspname AS table_schema,
      relation.relname AS table_name,
      attr.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class relation ON relation.oid = con.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    JOIN LATERAL unnest(con.conkey) AS key(attnum) ON TRUE
    JOIN pg_attribute attr ON attr.attrelid = con.conrelid AND attr.attnum = key.attnum
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.profiles'::regclass
      AND cardinality(con.conkey) = 1
  LOOP
    SELECT columns.is_nullable = 'YES'
      INTO is_nullable
      FROM information_schema.columns
     WHERE columns.table_schema = ref.table_schema
       AND columns.table_name = ref.table_name
       AND columns.column_name = ref.column_name;

    IF is_nullable THEN
      EXECUTE format('UPDATE %I.%I SET %I = NULL WHERE %I = $1', ref.table_schema, ref.table_name, ref.column_name, ref.column_name) USING p_user_id;
    ELSE
      EXECUTE format('DELETE FROM %I.%I WHERE %I = $1', ref.table_schema, ref.table_name, ref.column_name) USING p_user_id;
    END IF;
  END LOOP;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_user_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_account(UUID) TO service_role;
