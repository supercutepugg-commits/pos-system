-- 사업자 유형을 개인/법인 2가지로 단순화 (기가맹 구분은 VAN사 다중선택으로 이동)
-- 기존 'existing'(기가맹) 행은 개인사업자로 우선 매핑 — 실제 법인 여부는 운영자가 데이터 확인 후 직접 수정 필요

UPDATE franchise_applications SET applicant_type = 'individual' WHERE applicant_type = 'existing';

ALTER TABLE franchise_applications DROP CONSTRAINT IF EXISTS franchise_applications_applicant_type_check;
ALTER TABLE franchise_applications ADD CONSTRAINT franchise_applications_applicant_type_check CHECK (applicant_type IN (
  'individual',
  'corporate'
));

ALTER TABLE franchise_applications ALTER COLUMN applicant_type SET DEFAULT 'individual';
