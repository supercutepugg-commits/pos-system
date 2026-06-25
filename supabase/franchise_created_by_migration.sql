-- ============================================
-- 가맹 접수 등록자 기록 (담당영업/CS와는 별개로, 실제로 등록한 계정)
-- franchise_schema.sql 적용 이후에 실행
-- ============================================

ALTER TABLE franchise_applications
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);
