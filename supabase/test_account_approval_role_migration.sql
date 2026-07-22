-- 승인 직책 선택란에 테스트계정을 추가합니다. 테스트계정은 KPI 집계 대상이 아닙니다.
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_approval_role_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_approval_role_check
  CHECK (approval_role IN (
    'cs_manager',
    'cs_responsible',
    'tech_manager',
    'tech_responsible',
    'team_lead',
    'developer',
    'test_account'
  ));
