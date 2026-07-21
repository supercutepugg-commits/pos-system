-- 가맹접수 이관 승인 순서: CS매니저/CS책임 요청 → CS책임 승인 → 팀장 최종 승인 → 설치관리 이관
ALTER TABLE franchise_transfer_approvals
  DROP CONSTRAINT IF EXISTS franchise_transfer_approvals_status_check;
ALTER TABLE franchise_transfer_approvals
  ADD CONSTRAINT franchise_transfer_approvals_status_check
  CHECK (status IN ('requested', 'cs_responsible_approved', 'approved', 'rejected'));

ALTER TABLE franchise_transfer_approvals
  ADD COLUMN IF NOT EXISTS cs_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS cs_approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS cs_approved_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "authenticated insert transfer approvals" ON franchise_transfer_approvals;
DROP POLICY IF EXISTS "cs manager requests transfer approvals" ON franchise_transfer_approvals;
CREATE POLICY "cs manager or responsible requests transfer approvals"
  ON franchise_transfer_approvals FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND approval_role IN ('cs_manager', 'cs_responsible')
    )
  );

DROP POLICY IF EXISTS "cs responsible approves transfer approvals" ON franchise_transfer_approvals;
CREATE POLICY "cs responsible approves transfer approvals"
  ON franchise_transfer_approvals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approval_role = 'cs_responsible'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND approval_role = 'cs_responsible'));
