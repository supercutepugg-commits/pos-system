-- 개발요청 상태에 '처리완료'를 추가합니다.
ALTER TABLE dev_requests DROP CONSTRAINT IF EXISTS dev_requests_status_check;
ALTER TABLE dev_requests
  ADD CONSTRAINT dev_requests_status_check
  CHECK (status IN ('확인중', '미승인', '승인', '처리완료'));
