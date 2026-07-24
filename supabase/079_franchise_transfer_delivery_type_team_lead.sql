-- 이관 구분 결정 시점을 CS 승인요청에서 팀장 최종 승인으로 이동합니다.
ALTER TABLE franchise_transfer_approvals
  ALTER COLUMN delivery_type DROP NOT NULL;

-- 아직 최종 승인되지 않은 요청은 팀장이 새로 구분을 선택하도록 초기화합니다.
UPDATE franchise_transfer_approvals
SET delivery_type = NULL
WHERE status IN ('requested', 'cs_responsible_approved');
