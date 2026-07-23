-- ============================================
-- 가맹 접수 상태변경 이력
-- franchise_schema.sql 적용 이후에 실행
-- ============================================

CREATE TABLE IF NOT EXISTS franchise_application_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  franchise_application_id UUID REFERENCES franchise_applications(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id),
  from_status TEXT,
  to_status TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE franchise_application_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read" ON franchise_application_logs;
CREATE POLICY "authenticated read" ON franchise_application_logs FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "authenticated insert" ON franchise_application_logs;
CREATE POLICY "authenticated insert" ON franchise_application_logs FOR INSERT TO authenticated WITH CHECK (TRUE);
