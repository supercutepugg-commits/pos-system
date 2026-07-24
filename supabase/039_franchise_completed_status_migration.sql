-- 가맹접수 상태에 "완료"(completed) 추가
-- (카드가맹완료 -> 완료, 전체 탭에서는 숨겨지고 완료 탭에서만 보임)

ALTER TABLE franchise_applications DROP CONSTRAINT IF EXISTS franchise_applications_status_check;
ALTER TABLE franchise_applications ADD CONSTRAINT franchise_applications_status_check CHECK (status IN (
  'doc_waiting',
  'doc_incomplete',
  'card_apply_done',
  'internet_apply_done',
  'card_internet_apply_done',
  'card_done',
  'internet_done',
  'toss_review_apply_done',
  'toss_review_done',
  'completed'
));
