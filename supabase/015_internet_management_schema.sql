-- ============================================
-- 인터넷 관리대장 (인터넷_개통리스트_지은_요금표.xlsx 의 인터넷관리대장 시트)
-- 형식이 일관되지 않은 텍스트 필드가 많아 대부분 TEXT로 저장
-- ============================================

CREATE TABLE IF NOT EXISTS internet_management (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT,      -- 상호명
  apply_date TEXT,         -- 접수신청일
  open_date TEXT,          -- 개통완료일
  status TEXT,             -- 상태 (인터넷개통 여부) - 개통완료/진행중/취소
  category TEXT,           -- 구분 (백메가/3S)
  carrier TEXT,            -- 통신사 (LG/SK/KT)
  speed TEXT,              -- 속도 (100M/500M)
  addon TEXT,              -- 추가 가입상품
  gift TEXT,               -- 사은품 (현금/포스기)
  owner_name TEXT,         -- 대표자
  phone TEXT,              -- 연락처
  region TEXT,             -- 지역
  monthly_fee TEXT,        -- 월요금
  install_fee TEXT,        -- 설치비
  memo TEXT,                -- 비고
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS internet_management_updated_at ON internet_management;
CREATE TRIGGER internet_management_updated_at BEFORE UPDATE ON internet_management
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE internet_management ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated read" ON internet_management;
CREATE POLICY "authenticated read" ON internet_management FOR SELECT TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "authenticated insert" ON internet_management;
CREATE POLICY "authenticated insert" ON internet_management FOR INSERT TO authenticated WITH CHECK (TRUE);
DROP POLICY IF EXISTS "authenticated update" ON internet_management;
CREATE POLICY "authenticated update" ON internet_management FOR UPDATE TO authenticated USING (TRUE);
DROP POLICY IF EXISTS "authenticated delete" ON internet_management;
CREATE POLICY "authenticated delete" ON internet_management FOR DELETE TO authenticated USING (TRUE);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE internet_management;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
