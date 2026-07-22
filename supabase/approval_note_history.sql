-- 승인 단계별 전달 비고 이력
-- CS매니저 → CS책임 → 팀장, 기술지원매니저 → 기술지원책임 → 팀장 공통 적용
ALTER TABLE franchise_transfer_approvals
  ADD COLUMN IF NOT EXISTS approval_notes JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE installation_completion_approvals
  ADD COLUMN IF NOT EXISTS approval_notes JSONB NOT NULL DEFAULT '[]'::JSONB;

ALTER TABLE franchise_transfer_approvals
  DROP CONSTRAINT IF EXISTS franchise_transfer_approvals_notes_array_check;
ALTER TABLE franchise_transfer_approvals
  ADD CONSTRAINT franchise_transfer_approvals_notes_array_check
  CHECK (jsonb_typeof(approval_notes) = 'array');

ALTER TABLE installation_completion_approvals
  DROP CONSTRAINT IF EXISTS installation_completion_approvals_notes_array_check;
ALTER TABLE installation_completion_approvals
  ADD CONSTRAINT installation_completion_approvals_notes_array_check
  CHECK (jsonb_typeof(approval_notes) = 'array');

COMMENT ON COLUMN franchise_transfer_approvals.approval_notes IS
  '이관 승인 단계별 작성자, 역할, 시각, 비고 누적 이력';
COMMENT ON COLUMN installation_completion_approvals.approval_notes IS
  '기술지원 승인 단계별 작성자, 역할, 시각, 비고 누적 이력';
