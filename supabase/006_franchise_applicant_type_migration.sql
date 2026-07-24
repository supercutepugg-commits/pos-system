-- ============================================
-- 가맹 신청 사업자 유형 추가 (법인/개인/기가맹) — 서류 안내 알림톡 템플릿 분기용
-- franchise_schema.sql 적용 이후에 실행
-- ============================================

ALTER TABLE franchise_applications
  ADD COLUMN IF NOT EXISTS applicant_type TEXT NOT NULL DEFAULT 'individual'
  CHECK (applicant_type IN ('corporate', 'individual', 'existing'));
