-- 1) 먼저 실행: 몇 건이 자동 복구되는지, 대상 상태값이 뭔지 미리 확인 (DB 변경 없음)
SELECT fa.id, fa.business_name, fa.owner_name, sub.to_status AS restore_to
FROM franchise_applications fa
JOIN (
  SELECT DISTINCT ON (franchise_application_id) franchise_application_id, to_status
  FROM franchise_application_logs
  WHERE to_status IS NOT NULL AND to_status NOT LIKE 'alimtalk:%'
  ORDER BY franchise_application_id, created_at DESC
) sub ON sub.franchise_application_id = fa.id
WHERE fa.status = 'completed';

-- 2) 위 결과가 맞으면 실제 복구 실행
UPDATE franchise_applications fa
SET status = sub.to_status, updated_at = now()
FROM (
  SELECT DISTINCT ON (franchise_application_id) franchise_application_id, to_status
  FROM franchise_application_logs
  WHERE to_status IS NOT NULL AND to_status NOT LIKE 'alimtalk:%'
  ORDER BY franchise_application_id, created_at DESC
) sub
WHERE fa.id = sub.franchise_application_id
  AND fa.status = 'completed';

-- 3) 로그 기록이 없어서 자동 복구가 안 된(그래서 여전히 completed로 남아있는) 건 확인
--    -> 이 목록은 수동으로 원래 상태를 기억해서 고쳐야 함
SELECT id, business_name, owner_name, status, created_at
FROM franchise_applications
WHERE status = 'completed';
