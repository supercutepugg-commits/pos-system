-- ============================================
-- 우국상(우리동네국민상회) CRM 관리대장
-- 엑셀로 관리하던 고객관리대장CRM 데이터를 옮겨오는 별도 테이블
-- 형식이 일관되지 않은 텍스트 필드가 많아 대부분 TEXT로 저장
-- ============================================

CREATE TABLE IF NOT EXISTS woo_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  received_date TEXT,         -- 접수날짜
  manager TEXT,               -- 담당자
  category TEXT,              -- 분류 (설치완료/교체/가맹접수/가맹서류대기/접수완료/명의변경 등)
  business_name TEXT,         -- 상호명
  owner_name TEXT,            -- 대표자명
  business_number TEXT,       -- 사업자번호
  phone TEXT,                 -- 연락처
  internet_open_date TEXT,    -- 인터넷 개통일자
  card_apply_date TEXT,       -- 카드가맹 접수일자
  pos_install_date TEXT,      -- 포스설치일
  install_schedule_note TEXT, -- 설치일정추가함
  open_date TEXT,             -- 오픈일
  van_company TEXT,           -- VAN
  pos_program TEXT,           -- 포스프로그램
  product TEXT,               -- 상품
  address TEXT,               -- 주소
  memo TEXT,                  -- 비고
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS woo_customers_updated_at ON woo_customers;
CREATE TRIGGER woo_customers_updated_at BEFORE UPDATE ON woo_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE woo_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read" ON woo_customers;
CREATE POLICY "authenticated read" ON woo_customers FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "authenticated insert" ON woo_customers;
CREATE POLICY "authenticated insert" ON woo_customers FOR INSERT TO authenticated WITH CHECK (TRUE);
DROP POLICY IF EXISTS "authenticated update" ON woo_customers;
CREATE POLICY "authenticated update" ON woo_customers FOR UPDATE TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "authenticated delete" ON woo_customers;
CREATE POLICY "authenticated delete" ON woo_customers FOR DELETE TO authenticated USING (TRUE);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE woo_customers;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
