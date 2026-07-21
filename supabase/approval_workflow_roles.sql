-- 승인 직책: 기존 role(화면/업무 접근권한)은 유지하고 approval_role로 결재 권한을 분리합니다.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS approval_role TEXT;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_approval_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_approval_role_check CHECK (approval_role IN ('cs_manager', 'cs_responsible', 'tech_manager', 'tech_responsible', 'team_lead'));

UPDATE profiles SET approval_role = CASE
  WHEN role = 'cs' THEN 'cs_manager'
  WHEN role = 'tech' THEN 'tech_manager'
  WHEN role IN ('admin', 'master') THEN 'team_lead'
  ELSE NULL
END
WHERE approval_role IS NULL;

CREATE TABLE IF NOT EXISTS installation_completion_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_id UUID NOT NULL UNIQUE REFERENCES installations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'approved')),
  requested_by UUID NOT NULL REFERENCES profiles(id),
  requested_by_name TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES profiles(id),
  approved_by_name TEXT,
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS installation_completion_approvals_status_idx ON installation_completion_approvals (status, requested_at DESC);

ALTER TABLE installation_completion_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read installation approvals" ON installation_completion_approvals FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "tech manager requests completion approval" ON installation_completion_approvals FOR INSERT TO authenticated WITH CHECK (
  requested_by = auth.uid() AND status = 'requested' AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approval_role = 'tech_manager')
);
CREATE POLICY "tech responsible approves completion" ON installation_completion_approvals FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approval_role = 'tech_responsible')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approval_role = 'tech_responsible')
);
CREATE TRIGGER installation_completion_approvals_updated_at BEFORE UPDATE ON installation_completion_approvals FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 기존 가맹 이관 승인 정책은 팀장 승인으로 교체합니다.
DROP POLICY IF EXISTS "admin approves transfer approvals" ON franchise_transfer_approvals;
CREATE POLICY "team lead approves transfer approvals" ON franchise_transfer_approvals FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approval_role = 'team_lead')
) WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approval_role = 'team_lead')
);
