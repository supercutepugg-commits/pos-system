-- 재고 실사: inventory_items / inventory_logs 테이블 생성
-- (기존에 이 테이블들이 아예 없어서 "Could not find the table 'public.inventory_items'" 오류 발생)

CREATE TABLE IF NOT EXISTS inventory_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  major_category TEXT NOT NULL DEFAULT '기타',
  mid_category TEXT,
  category TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT '개',
  min_quantity INTEGER NOT NULL DEFAULT 0,
  location TEXT,
  notes TEXT,
  last_checked DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES inventory_items(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  change INTEGER NOT NULL,
  reason TEXT,
  user_id UUID REFERENCES profiles(id) DEFAULT auth.uid(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON inventory_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated insert" ON inventory_items FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "authenticated update" ON inventory_items FOR UPDATE TO authenticated USING (TRUE);
CREATE POLICY "authenticated delete" ON inventory_items FOR DELETE TO authenticated USING (TRUE);

CREATE POLICY "authenticated read" ON inventory_logs FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated insert" ON inventory_logs FOR INSERT TO authenticated WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS inventory_items_major_category_idx ON inventory_items(major_category);
CREATE INDEX IF NOT EXISTS inventory_logs_item_id_idx ON inventory_logs(item_id);

-- inventory_logs.user_id -> profiles(name) 조인에 필요한 FK 이름 (코드에서 참조)
ALTER TABLE inventory_logs
  DROP CONSTRAINT IF EXISTS inventory_logs_user_id_fkey,
  ADD CONSTRAINT inventory_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id);
