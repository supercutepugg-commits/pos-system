-- ============================================
-- 관리자가 특정 계정에 삭제 권한을 개별로 부여할 수 있도록 profiles에 컬럼 추가
-- (역할 전체를 admin으로 바꾸지 않고도 특정 계정에 삭제 권한만 줄 수 있음)
-- ============================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS can_delete BOOLEAN NOT NULL DEFAULT FALSE;
