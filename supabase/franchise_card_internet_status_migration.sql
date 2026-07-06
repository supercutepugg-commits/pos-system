-- 가맹접수 상태에 "카드,인터넷접수완료"(card_internet_apply_done) 추가
-- 선택 시 카드가맹접수완료 + 인터넷접수완료 알림톡 템플릿을 함께 발송한다 (앱 코드에서 처리, 새 템플릿 불필요)
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
