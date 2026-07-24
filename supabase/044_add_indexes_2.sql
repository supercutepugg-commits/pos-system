-- 가맹접수/설치관리/인터넷관리/우체국관리/알림 조회 속도 개선용 인덱스
-- (add_indexes.sql은 tickets 계열만 다뤘고, 이후 추가된 주요 조회 테이블에는 인덱스가 없었음)

CREATE INDEX IF NOT EXISTS idx_franchise_applications_sales_id ON franchise_applications(sales_id);
CREATE INDEX IF NOT EXISTS idx_franchise_applications_cs_id ON franchise_applications(cs_id);
CREATE INDEX IF NOT EXISTS idx_franchise_applications_status ON franchise_applications(status);
CREATE INDEX IF NOT EXISTS idx_franchise_applications_updated_at ON franchise_applications(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_installations_franchise_application_id ON installations(franchise_application_id);
CREATE INDEX IF NOT EXISTS idx_installations_assigned_to ON installations(assigned_to);
CREATE INDEX IF NOT EXISTS idx_installations_status ON installations(status);
CREATE INDEX IF NOT EXISTS idx_installations_status_token ON installations(status_token);
CREATE INDEX IF NOT EXISTS idx_installations_created_at ON installations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_internet_management_franchise_application_id ON internet_management(franchise_application_id);
CREATE INDEX IF NOT EXISTS idx_internet_management_phone ON internet_management(phone);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_merchants_sales_id ON merchants(sales_id);
