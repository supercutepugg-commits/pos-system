-- 가맹접수 상태에 "카드,인터넷접수완료"(card_internet_apply_done) 추가
-- 선택 시 카드가맹접수완료 + 인터넷접수완료 알림톡 템플릿을 함께 발송한다 (앱 코드에서 처리, 새 템플릿 불필요)

-- 혹시 이전 마이그레이션이 안 걸려 있어서 컬럼 기본값/기존 값이 새 제약과 안 맞는 행이 있다면 먼저 정리
UPDATE franchise_applications SET status = 'doc_waiting' WHERE status NOT IN (
  'doc_waiting', 'doc_incomplete', 'card_apply_done', 'internet_apply_done',
  'card_done', 'internet_done', 'toss_review_done'
);

ALTER TABLE franchise_applications DROP CONSTRAINT IF EXISTS franchise_applications_status_check;
ALTER TABLE franchise_applications ADD CONSTRAINT franchise_applications_status_check CHECK (status IN (
  'doc_waiting',
  'doc_incomplete',
  'card_apply_done',
  'internet_apply_done',
  'card_internet_apply_done',
  'card_done',
  'internet_done',
  'toss_review_done'
));

-- 신규 등록 시 기본 상태가 항상 제약을 만족하도록 재확인
ALTER TABLE franchise_applications ALTER COLUMN status SET DEFAULT 'doc_waiting';
