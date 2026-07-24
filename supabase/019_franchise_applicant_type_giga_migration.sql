-- 사업자 유형에 기가맹 개인/법인 추가 (개인/법인/기가맹개인/기가맹법인 4종)

ALTER TABLE franchise_applications DROP CONSTRAINT IF EXISTS franchise_applications_applicant_type_check;
ALTER TABLE franchise_applications ADD CONSTRAINT franchise_applications_applicant_type_check CHECK (applicant_type IN (
  'individual',
  'corporate',
  'giga_individual',
  'giga_corporate'
));
