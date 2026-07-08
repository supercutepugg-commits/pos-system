-- 기술지원 > 설계도: 매장 설치 배선도(장비 박스/연결선/텍스트)를 그려서 저장하는 기능
-- 도형 데이터는 elements 컬럼에 JSON 배열로 저장 (rect/circle/text/line)

CREATE TABLE IF NOT EXISTS install_blueprints (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '제목 없는 설계도',
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  elements JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID REFERENCES profiles(id) DEFAULT auth.uid(),
  updated_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE install_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON install_blueprints FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated insert" ON install_blueprints FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "authenticated update" ON install_blueprints FOR UPDATE TO authenticated USING (TRUE);
CREATE POLICY "authenticated delete" ON install_blueprints FOR DELETE TO authenticated USING (TRUE);

CREATE INDEX IF NOT EXISTS install_blueprints_merchant_id_idx ON install_blueprints(merchant_id);
CREATE INDEX IF NOT EXISTS install_blueprints_updated_at_idx ON install_blueprints(updated_at DESC);
