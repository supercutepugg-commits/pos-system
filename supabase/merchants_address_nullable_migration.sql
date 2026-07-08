-- ============================================
-- 가맹점 주소 필수 해제
-- 카드가맹완료 자동 등록 시 주소가 없어도 가맹점 탭에 넘어가야 하므로
-- merchants.address의 NOT NULL 제약을 해제한다.
-- ============================================

ALTER TABLE merchants
  ALTER COLUMN address DROP NOT NULL;
