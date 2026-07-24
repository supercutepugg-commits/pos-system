-- ============================================
-- 캘린더 수동 일정에 구분(일정/설치/오픈/카드신청/택배발송/메모)과
-- 설치 담당자 배정(assigned_to) 추가
-- calendar_events_migration.sql 적용 이후에 실행
-- ============================================

ALTER TABLE calendar_events
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT '메모',
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES profiles(id);

ALTER TABLE calendar_events
  DROP CONSTRAINT IF EXISTS calendar_events_category_check;
ALTER TABLE calendar_events
  ADD CONSTRAINT calendar_events_category_check
  CHECK (category IN ('일정', '설치', '오픈', '카드신청', '택배발송', '메모'));
