-- 설치 예정일/희망 시간대를 실제로 저장하기 위한 컬럼 추가
-- (기존에는 일정확정 모달에 입력한 값이 알림톡 문구에만 쓰이고 DB에는 저장되지 않았음)
ALTER TABLE installations ADD COLUMN IF NOT EXISTS scheduled_date DATE;
ALTER TABLE installations ADD COLUMN IF NOT EXISTS scheduled_time TEXT;
