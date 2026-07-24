-- ============================================
-- 캘린더 수동 일정 등록 기능
-- schema.sql 적용 이후에 실행
-- ============================================

CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  title TEXT NOT NULL,
  memo TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON calendar_events FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated insert" ON calendar_events FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "authenticated delete" ON calendar_events FOR DELETE TO authenticated USING (TRUE);
