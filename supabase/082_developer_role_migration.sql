-- 개발팀 직원용 개발자 권한을 추가합니다. 개발자 권한은 KPI 집계 대상이 아닙니다.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('master', 'admin', 'sales', 'cs', 'tech', 'developer'));

COMMENT ON COLUMN profiles.role IS
  '계정 권한: master, admin, sales, cs, tech, developer';
