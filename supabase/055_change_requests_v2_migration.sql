-- ============================================
-- 변경관리 탭 리뉴얼: 상세정보 필드 추가 및 상태값 재정의
-- (서류대기 / 서류미비 / 접수완료)
-- ============================================

ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS owner_name TEXT;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS business_number TEXT;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS applicant_type TEXT NOT NULL DEFAULT 'individual'
  CHECK (applicant_type IN ('individual', 'corporate'));
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS reception_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE change_requests ADD COLUMN IF NOT EXISTS payment_received BOOLEAN NOT NULL DEFAULT FALSE;

-- 기존 상태값(pending/processing/done)을 서류대기/서류미비/접수완료로 재매핑
UPDATE change_requests SET status = 'waiting_docs' WHERE status = 'pending';
UPDATE change_requests SET status = 'docs_incomplete' WHERE status = 'processing';

ALTER TABLE change_requests DROP CONSTRAINT IF EXISTS change_requests_status_check;
ALTER TABLE change_requests ADD CONSTRAINT change_requests_status_check
  CHECK (status IN ('waiting_docs', 'docs_incomplete', 'done'));
ALTER TABLE change_requests ALTER COLUMN status SET DEFAULT 'waiting_docs';
