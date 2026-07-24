-- ============================================
-- 가맹 접수 정보입력 항목 확장 (사업자번호/출고장비/주소/작업제목/접수채널/오픈예정일/설치발송일)
-- 전부 선택 입력이므로 NOT NULL 제약은 제거하고 nullable 컬럼으로 추가
-- franchise_schema.sql, franchise_applicant_type_migration.sql 적용 이후에 실행
-- ============================================

ALTER TABLE franchise_applications
  ALTER COLUMN business_name DROP NOT NULL,
  ALTER COLUMN owner_name DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS business_number TEXT,      -- 사업자번호
  ADD COLUMN IF NOT EXISTS equipment TEXT,             -- 출고 장비
  ADD COLUMN IF NOT EXISTS address TEXT,               -- 주소
  ADD COLUMN IF NOT EXISTS address_detail TEXT,        -- 상세주소
  ADD COLUMN IF NOT EXISTS title TEXT,                 -- 작업제목
  ADD COLUMN IF NOT EXISTS reception_channel TEXT,     -- 접수채널
  ADD COLUMN IF NOT EXISTS open_date DATE,             -- 오픈예정일
  ADD COLUMN IF NOT EXISTS install_date DATE;          -- 설치 및 발송일
