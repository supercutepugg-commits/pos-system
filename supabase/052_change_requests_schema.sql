-- ============================================
-- 변경 관리 (CS 가맹접수 탭 아래): 통장변경 / 상호변경 / 대표자변경 / 주소변경 / 업종변경
-- ============================================

CREATE TABLE IF NOT EXISTS change_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID REFERENCES merchants(id),   -- 가맹점 연결 (선택)
  business_name TEXT NOT NULL,                 -- 상호명
  phone TEXT,                                  -- 연락처
  change_type TEXT NOT NULL CHECK (change_type IN (
    'bank',      -- 통장변경
    'name',      -- 상호변경
    'ceo',       -- 대표자변경
    'address',   -- 주소변경
    'category'   -- 업종변경
  )),
  before_value TEXT,   -- 변경 전
  after_value TEXT,    -- 변경 후
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',     -- 접수
    'processing',  -- 처리중
    'done'         -- 완료
  )),
  memo TEXT,
  sales_id UUID REFERENCES profiles(id),
  cs_id UUID REFERENCES profiles(id),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS change_requests_updated_at ON change_requests;
CREATE TRIGGER change_requests_updated_at BEFORE UPDATE ON change_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read" ON change_requests;
CREATE POLICY "authenticated read" ON change_requests FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "authenticated insert" ON change_requests;
CREATE POLICY "authenticated insert" ON change_requests FOR INSERT TO authenticated WITH CHECK (TRUE);
DROP POLICY IF EXISTS "authenticated update" ON change_requests;
CREATE POLICY "authenticated update" ON change_requests FOR UPDATE TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "authenticated delete" ON change_requests;
CREATE POLICY "authenticated delete" ON change_requests FOR DELETE TO authenticated USING (TRUE);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE change_requests;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
