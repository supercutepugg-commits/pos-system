-- ============================================
-- 인터넷관리 ↔ 가맹접수 연결 컬럼 추가
-- 가맹접수 페이지의 "인터넷" 탭에서 연결된 인터넷관리 건의 상태를 표시하기 위함
-- ============================================

ALTER TABLE internet_management
  ADD COLUMN IF NOT EXISTS franchise_application_id UUID REFERENCES franchise_applications(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS internet_management_franchise_application_id_idx
  ON internet_management(franchise_application_id);
