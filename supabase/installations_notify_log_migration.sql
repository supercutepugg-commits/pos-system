-- 설치건 알림톡 발송 여부를 화면에서 확인할 수 있도록 마지막 발송 상태/시각 기록
ALTER TABLE installations ADD COLUMN IF NOT EXISTS last_notify_status TEXT;
ALTER TABLE installations ADD COLUMN IF NOT EXISTS last_notify_at TIMESTAMPTZ;
