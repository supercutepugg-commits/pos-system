-- ============================================
-- 설치관리 ↔ 우국상(Woo) 연결 컬럼 추가
-- 우국상 탭에서 "설치지원 이관"으로 넘어간 설치건을 추적하기 위함
-- ============================================

ALTER TABLE installations
  ADD COLUMN IF NOT EXISTS woo_customer_id UUID REFERENCES woo_customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS installations_woo_customer_id_idx
  ON installations(woo_customer_id);
