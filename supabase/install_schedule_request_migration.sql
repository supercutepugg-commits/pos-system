-- ============================================
-- 설치 전 고객이 날짜 변경 요청 / 희망 시간대를 알림톡 버튼(공개 페이지)으로
-- 직접 남길 수 있도록 하는 컬럼 추가
-- schema.sql 적용 이후에 실행
-- ============================================

ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS requested_date DATE,
  ADD COLUMN IF NOT EXISTS requested_time_slot TEXT,
  ADD COLUMN IF NOT EXISTS schedule_request_note TEXT,
  ADD COLUMN IF NOT EXISTS schedule_request_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS schedule_request_seen BOOLEAN DEFAULT FALSE;

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS installation_id UUID REFERENCES installations(id) ON DELETE CASCADE;
