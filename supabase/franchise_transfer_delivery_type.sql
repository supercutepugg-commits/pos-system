-- CS팀이 이관 전에 구분을 확정하고, 승인 체인 전체에서 같은 값을 사용합니다.
ALTER TABLE franchise_transfer_approvals
  ADD COLUMN IF NOT EXISTS delivery_type TEXT;

-- 배포 전 생성된 승인 이력은 기존 동작과 동일하게 설치로 보정합니다.
UPDATE franchise_transfer_approvals
SET delivery_type = 'install'
WHERE delivery_type IS NULL;

ALTER TABLE franchise_transfer_approvals
  ALTER COLUMN delivery_type SET NOT NULL;

ALTER TABLE franchise_transfer_approvals
  DROP CONSTRAINT IF EXISTS franchise_transfer_approvals_delivery_type_check;
ALTER TABLE franchise_transfer_approvals
  ADD CONSTRAINT franchise_transfer_approvals_delivery_type_check
  CHECK (delivery_type IN ('install', 'delivery', 'as', 'name_change', 'transfer'));

ALTER TABLE franchise_application_logs
  ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;
