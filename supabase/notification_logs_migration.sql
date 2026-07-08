-- ============================================
-- 알림톡 발송이력 (모든 탭 공용)
-- entity_type + entity_id 로 어느 화면(설치/가맹/계약/티켓 등)의
-- 어떤 건에 대한 발송인지 식별한다. schema.sql 적용 이후에 실행.
-- ============================================

CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  template_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  user_id UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notification_logs_entity_idx ON notification_logs (entity_type, entity_id, created_at DESC);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read" ON notification_logs;
CREATE POLICY "authenticated read" ON notification_logs FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "authenticated insert" ON notification_logs;
CREATE POLICY "authenticated insert" ON notification_logs FOR INSERT TO authenticated WITH CHECK (TRUE);
