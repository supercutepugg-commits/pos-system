-- 계정 권한과 소속 팀을 분리하고 개발팀을 추가합니다.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS team TEXT;

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_team_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_team_check
  CHECK (team IN ('sales', 'cs', 'tech', 'dev'));

UPDATE profiles
SET team = CASE
  WHEN role = 'sales' THEN 'sales'
  WHEN role = 'cs' THEN 'cs'
  WHEN role = 'tech' THEN 'tech'
  ELSE 'dev'
END
WHERE team IS NULL;

ALTER TABLE profiles
  ALTER COLUMN team SET NOT NULL;

COMMENT ON COLUMN profiles.team IS
  '소속 팀: sales(영업팀), cs(CS팀), tech(기술지원팀), dev(개발팀)';
