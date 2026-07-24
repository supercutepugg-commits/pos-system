-- 반려된 이관 승인요청 중 요청자에게 반려 알림이 누락된 건을 진단/복구합니다.
-- 배경: rejectFranchiseTransfer()가 최근까지 요청자에게 notifications를 남기지 않아서,
--       실제로는 반려되었어도(franchise_transfer_approvals.status = 'rejected') 요청자 화면에는
--       아무 알림도 뜨지 않았습니다. franchise_transfer_approvals.franchise_application_id는
--       UNIQUE이므로 현재 status = 'rejected'인 행이 곧 그 가맹접수의 최신 상태입니다.

-- 1) 진단: 반려됐지만 반려 알림이 없는 건 목록
SELECT
  a.franchise_application_id,
  f.business_name,
  f.owner_name,
  a.requested_by,
  a.requested_by_name,
  a.rejection_reason,
  a.requested_at,
  a.updated_at AS rejected_at,
  rejecter.name AS rejected_by_name
FROM franchise_transfer_approvals a
JOIN franchise_applications f ON f.id = a.franchise_application_id
LEFT JOIN LATERAL (
  SELECT l.user_id, l.created_at
  FROM franchise_application_logs l
  WHERE l.franchise_application_id = a.franchise_application_id
    AND l.to_status IN ('transfer_cs_responsible_rejected', 'transfer_team_lead_rejected')
  ORDER BY l.created_at DESC
  LIMIT 1
) rejection_log ON TRUE
LEFT JOIN profiles rejecter ON rejecter.id = rejection_log.user_id
WHERE a.status = 'rejected'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.franchise_application_id = a.franchise_application_id
      AND n.user_id = a.requested_by
      AND n.type = 'approval_transfer_rejected'
  )
ORDER BY a.updated_at DESC;

-- 2) 복구: 위 목록에 대해 반려 알림을 소급 생성합니다.
--    실행 전 위 SELECT 결과를 먼저 확인하세요.
INSERT INTO notifications (user_id, franchise_application_id, type, title, body)
SELECT
  a.requested_by,
  a.franchise_application_id,
  'approval_transfer_rejected',
  '[반려] 기술지원 이관 승인요청',
  CASE
    WHEN a.rejection_reason IS NOT NULL AND a.rejection_reason <> ''
      THEN COALESCE(rejecter.name, '승인자') || '님이 이관 승인요청을 반려했습니다. 사유: ' || a.rejection_reason
    ELSE COALESCE(rejecter.name, '승인자') || '님이 이관 승인요청을 반려했습니다.'
  END
FROM franchise_transfer_approvals a
LEFT JOIN LATERAL (
  SELECT l.user_id, l.created_at
  FROM franchise_application_logs l
  WHERE l.franchise_application_id = a.franchise_application_id
    AND l.to_status IN ('transfer_cs_responsible_rejected', 'transfer_team_lead_rejected')
  ORDER BY l.created_at DESC
  LIMIT 1
) rejection_log ON TRUE
LEFT JOIN profiles rejecter ON rejecter.id = rejection_log.user_id
WHERE a.status = 'rejected'
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.franchise_application_id = a.franchise_application_id
      AND n.user_id = a.requested_by
      AND n.type = 'approval_transfer_rejected'
  );
