-- 택배발송 시 안내할 송장번호 저장용 컬럼 추가
ALTER TABLE installations ADD COLUMN IF NOT EXISTS tracking_number TEXT;
