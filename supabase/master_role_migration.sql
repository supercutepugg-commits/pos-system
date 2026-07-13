-- master 역할 추가: admin보다 상위 권한
ALTER TABLE profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('master', 'admin', 'sales', 'cs', 'tech'));

-- 한원채 계정을 master로 승격 (이메일 확인 후 실행)
-- UPDATE profiles SET role = 'master' WHERE id = (SELECT id FROM auth.users WHERE email = '여기에_이메일_입력');
