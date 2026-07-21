-- 설치 상태·배정·승인 감사 이력
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS installation_id UUID REFERENCES installations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS franchise_application_id UUID REFERENCES franchise_applications(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notifications_installation_idx ON notifications (installation_id);
CREATE INDEX IF NOT EXISTS notifications_franchise_application_idx ON notifications (franchise_application_id);

CREATE TABLE IF NOT EXISTS installation_activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  installation_id UUID NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN (
    'created', 'status_changed', 'assignment_changed',
    'completion_requested', 'completion_approved', 'completion_rejected'
  )),
  from_status TEXT,
  to_status TEXT,
  from_assigned_to UUID REFERENCES profiles(id),
  to_assigned_to UUID REFERENCES profiles(id),
  approval_id UUID REFERENCES installation_completion_approvals(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS installation_activity_logs_installation_idx
  ON installation_activity_logs (installation_id, created_at DESC);

ALTER TABLE installation_activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated read installation activity logs" ON installation_activity_logs;
CREATE POLICY "authenticated read installation activity logs"
  ON installation_activity_logs FOR SELECT TO authenticated USING (TRUE);

-- 감사 로그에서 다른 사용자를 행위자로 위조하는 것을 차단합니다.
DROP POLICY IF EXISTS "authenticated insert" ON notification_logs;
DROP POLICY IF EXISTS "authenticated insert own notification logs" ON notification_logs;
CREATE POLICY "authenticated insert own notification logs"
  ON notification_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "authenticated insert" ON franchise_application_logs;
DROP POLICY IF EXISTS "authenticated insert own franchise logs" ON franchise_application_logs;
CREATE POLICY "authenticated insert own franchise logs"
  ON franchise_application_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

ALTER TABLE notification_logs
  ADD COLUMN IF NOT EXISTS recipient_masked TEXT,
  ADD COLUMN IF NOT EXISTS provider_message_id TEXT,
  ADD COLUMN IF NOT EXISTS user_name TEXT;

ALTER TABLE franchise_application_logs
  ADD COLUMN IF NOT EXISTS user_name TEXT;

CREATE OR REPLACE FUNCTION public.fill_audit_user_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_name IS NULL AND NEW.user_id IS NOT NULL THEN
    SELECT name INTO NEW.user_name FROM profiles WHERE id = NEW.user_id;
  END IF;
  IF NEW.user_name IS NULL THEN NEW.user_name := '알수없음'; END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS installation_activity_logs_fill_user_name ON installation_activity_logs;
CREATE TRIGGER installation_activity_logs_fill_user_name
  BEFORE INSERT ON installation_activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.fill_audit_user_name();

DROP TRIGGER IF EXISTS notification_logs_fill_user_name ON notification_logs;
CREATE TRIGGER notification_logs_fill_user_name
  BEFORE INSERT ON notification_logs
  FOR EACH ROW EXECUTE FUNCTION public.fill_audit_user_name();

DROP TRIGGER IF EXISTS franchise_application_logs_fill_user_name ON franchise_application_logs;
CREATE TRIGGER franchise_application_logs_fill_user_name
  BEFORE INSERT ON franchise_application_logs
  FOR EACH ROW EXECUTE FUNCTION public.fill_audit_user_name();

-- 기존 클라이언트 경로에서 직접 변경해도 상태·배정 이력을 누락하지 않습니다.
CREATE OR REPLACE FUNCTION public.log_authenticated_installation_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor UUID := auth.uid();
BEGIN
  -- 서버 액션(service role)은 행위자를 명시하여 직접 로그를 저장합니다.
  IF actor IS NULL THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO installation_activity_logs (
      installation_id, user_id, action, to_status, to_assigned_to, details
    ) VALUES (
      NEW.id, actor, 'created', NEW.status, NEW.assigned_to,
      jsonb_build_object('delivery_type', NEW.delivery_type)
    );
    RETURN NEW;
  END IF;

  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO installation_activity_logs (
      installation_id, user_id, action, from_status, to_status
    ) VALUES (NEW.id, actor, 'status_changed', OLD.status, NEW.status);
  END IF;

  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO installation_activity_logs (
      installation_id, user_id, action, from_assigned_to, to_assigned_to
    ) VALUES (NEW.id, actor, 'assignment_changed', OLD.assigned_to, NEW.assigned_to);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS installations_authenticated_audit ON installations;
CREATE TRIGGER installations_authenticated_audit
  AFTER INSERT OR UPDATE ON installations
  FOR EACH ROW EXECUTE FUNCTION public.log_authenticated_installation_change();

UPDATE notification_logs l SET user_name = p.name FROM profiles p WHERE l.user_id = p.id AND l.user_name IS NULL;
UPDATE franchise_application_logs l SET user_name = p.name FROM profiles p WHERE l.user_id = p.id AND l.user_name IS NULL;

ALTER TABLE notification_logs DROP CONSTRAINT IF EXISTS notification_logs_status_check;
ALTER TABLE notification_logs ADD CONSTRAINT notification_logs_status_check
  CHECK (status IN ('sent', 'failed'));
