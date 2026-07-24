-- ============================================
-- 가맹점 ↔ 가맹접수 연결 컬럼 추가
-- 가맹접수 상태가 "카드가맹완료"로 변경되면 가맹점 탭에 자동 등록하기 위함.
-- 이미 등록된 건인지(중복 등록 방지) franchise_application_id로 조회한다.
-- ============================================

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS franchise_application_id UUID REFERENCES franchise_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS merchants_franchise_application_id_idx
  ON merchants(franchise_application_id);
