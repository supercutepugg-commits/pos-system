-- 승인 직책 선택란에 개발자를 추가합니다.
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
