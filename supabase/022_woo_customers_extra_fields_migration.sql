-- ============================================
-- 우국상 관리대장 항목 확장
-- 인터넷(3S/백메가) + 인터넷 비고, 가맹여부, 간편결제, 세팅(PC세팅/포스세팅) 컬럼 추가
-- woo_customers_schema.sql 적용 이후에 실행
-- ============================================

ALTER TABLE woo_customers
  ADD COLUMN IF NOT EXISTS internet_type TEXT,        -- 인터넷 (3S/백메가)
  ADD COLUMN IF NOT EXISTS internet_note TEXT,         -- 인터넷 비고 (필수)
  ADD COLUMN IF NOT EXISTS card_apply_status TEXT,     -- 가맹여부 (가맹완료/가맹미확인)
  ADD COLUMN IF NOT EXISTS easy_payment TEXT,          -- 간편결제 (수기 입력)
  ADD COLUMN IF NOT EXISTS setting TEXT;               -- 세팅 (PC세팅/포스세팅)
