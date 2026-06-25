-- ============================================
-- 캘린더 일정(오픈예정일/설치예정일 등)을 실제 알림으로 생성하기 위한 컬럼 추가
-- schema.sql, franchise_schema.sql 적용 이후에 실행
-- ============================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS franchise_application_id UUID REFERENCES franchise_applications(id) ON DELETE CASCADE;
