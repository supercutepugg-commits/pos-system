-- 기술지원 단계 승인: 매니저 요청 -> 책임 1차 승인 -> 팀장 최종 승인
ALTER TABLE installation_completion_approvals
  DROP CONSTRAINT IF EXISTS installation_completion_approvals_installation_id_key;

ALTER TABLE installation_completion_approvals
  ADD COLUMN IF NOT EXISTS target_status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS responsible_approved_by UUID REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS responsible_approved_by_name TEXT,
  ADD COLUMN IF NOT EXISTS responsible_approved_at TIMESTAMPTZ;

ALTER TABLE installation_completion_approvals
  DROP CONSTRAINT IF EXISTS installation_completion_approvals_status_check;
ALTER TABLE installation_completion_approvals
  ADD CONSTRAINT installation_completion_approvals_status_check
  CHECK (status IN ('requested', 'responsible_approved', 'approved', 'rejected'));

ALTER TABLE installation_completion_approvals
  DROP CONSTRAINT IF EXISTS installation_completion_approvals_target_status_check;
ALTER TABLE installation_completion_approvals
  ADD CONSTRAINT installation_completion_approvals_target_status_check
  CHECK (target_status IN ('preparing', 'scheduled', 'in_transit', 'delivery_sent', 'completed'));

CREATE UNIQUE INDEX IF NOT EXISTS installation_step_approvals_one_pending_idx
  ON installation_completion_approvals (installation_id)
  WHERE status IN ('requested', 'responsible_approved');

ALTER TABLE installation_activity_logs DROP CONSTRAINT IF EXISTS installation_activity_logs_action_check;
ALTER TABLE installation_activity_logs ADD CONSTRAINT installation_activity_logs_action_check CHECK (action IN (
  'created', 'status_changed', 'assignment_changed',
  'completion_requested', 'completion_approved', 'completion_rejected',
  'step_approval_requested', 'step_responsible_approved', 'step_final_approved', 'step_approval_rejected'
));

DROP POLICY IF EXISTS "tech responsible approves completion" ON installation_completion_approvals;
DROP POLICY IF EXISTS "tech approval chain updates installation steps" ON installation_completion_approvals;
CREATE POLICY "tech approval chain updates installation steps"
  ON installation_completion_approvals FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND approval_role IN ('tech_responsible', 'team_lead')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND approval_role IN ('tech_responsible', 'team_lead')
  ));
