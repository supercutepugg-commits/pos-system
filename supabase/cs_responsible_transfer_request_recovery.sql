-- CS책임이 직접 생성해 1차 승인 단계에 남은 이관 요청을 팀장 최종 승인 단계로 복구합니다.
WITH promoted AS (
  UPDATE franchise_transfer_approvals AS approval
  SET
    status = 'cs_responsible_approved',
    cs_approved_by = approval.requested_by,
    cs_approved_by_name = approval.requested_by_name,
    cs_approved_at = approval.requested_at
  FROM profiles AS requester
  WHERE approval.status = 'requested'
    AND requester.id = approval.requested_by
    AND requester.approval_role = 'cs_responsible'
  RETURNING approval.franchise_application_id, approval.requested_by
)
INSERT INTO franchise_application_logs (
  franchise_application_id,
  user_id,
  from_status,
  to_status
)
SELECT
  franchise_application_id,
  requested_by,
  'transfer_approval_requested',
  'transfer_cs_responsible_approved'
FROM promoted;
