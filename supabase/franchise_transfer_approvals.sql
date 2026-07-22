-- 가맹접수 → 기술지원 이관 승인 흐름
-- 승인요청 후 관리자 또는 마스터가 승인하면 설치건을 자동 생성합니다.
CREATE TABLE IF NOT EXISTS franchise_transfer_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  franchise_application_id UUID NOT NULL UNIQUE REFERENCES franchise_applications(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'cs_responsible_approved', 'approved', 'rejected')),
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('install', 'delivery', 'as', 'name_change', 'transfer')),
  requested_by UUID NOT NULL REFERENCES profiles(id),
  requested_by_name TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES profiles(id),
  approved_by_name TEXT,
  approved_at TIMESTAMPTZ,
  cs_approved_by UUID REFERENCES profiles(id),
  cs_approved_by_name TEXT,
  cs_approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS franchise_transfer_approvals_status_idx
  ON franchise_transfer_approvals (status, requested_at DESC);

ALTER TABLE franchise_transfer_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read transfer approvals"
  ON franchise_transfer_approvals FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated insert transfer approvals"
  ON franchise_transfer_approvals FOR INSERT TO authenticated WITH CHECK (requested_by = auth.uid());
CREATE POLICY "admin approves transfer approvals"
  ON franchise_transfer_approvals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'master')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'master')));

CREATE TRIGGER franchise_transfer_approvals_updated_at
  BEFORE UPDATE ON franchise_transfer_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
