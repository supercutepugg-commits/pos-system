-- 설치/택배발송 구분을 위한 컬럼 추가 (installs 등록 시 'Could not find the delivery_type column' 에러 수정)
ALTER TABLE installations ADD COLUMN IF NOT EXISTS delivery_type TEXT NOT NULL DEFAULT 'install';
