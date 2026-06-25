-- 가맹 접수 상태값 재구성
-- 기존: info_input, doc_waiting, doc_incomplete, doc_complete, franchise_done
-- 신규: doc_waiting, doc_incomplete, card_apply_done, internet_apply_done, card_done, internet_done, toss_review_done

-- 1) 기존 데이터를 새 상태값으로 매핑
UPDATE franchise_applications SET status = 'doc_waiting' WHERE status = 'info_input';
UPDATE franchise_applications SET status = 'card_apply_done' WHERE status = 'doc_complete';
UPDATE franchise_applications SET status = 'toss_review_done' WHERE status = 'franchise_done';

-- 2) CHECK 제약 갱신
ALTER TABLE franchise_applications DROP CONSTRAINT IF EXISTS franchise_applications_status_check;
ALTER TABLE franchise_applications ADD CONSTRAINT franchise_applications_status_check CHECK (status IN (
  'doc_waiting',
  'doc_incomplete',
  'card_apply_done',
  'internet_apply_done',
  'card_done',
  'internet_done',
  'toss_review_done'
));

-- 3) 기본값 갱신 (신규 접수의 시작 상태)
ALTER TABLE franchise_applications ALTER COLUMN status SET DEFAULT 'doc_waiting';
