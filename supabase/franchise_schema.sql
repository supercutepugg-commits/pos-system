-- ============================================
-- 가맹 접수 프로세스 (CS_가맹_프로세스_간소화_개선본.pptx 기반)
-- 영업 정보입력 -> 서류대기(카톡발송) -> 서류미비/접수완료 -> 가맹완료(기술지원 이관)
-- 기존 crm_inbound(고객 문의)와는 별개의 신규 시트
-- ============================================

CREATE TABLE franchise_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,         -- 상호명
  owner_name TEXT NOT NULL,            -- 대표자명
  phone TEXT NOT NULL,                 -- 연락처
  sales_id UUID REFERENCES profiles(id), -- 담당 영업 (정보 전달자)
  cs_id UUID REFERENCES profiles(id),    -- 담당 CS (서류 검토자)
  status TEXT NOT NULL DEFAULT 'info_input' CHECK (status IN (
    'info_input',     -- 정보 입력
    'doc_waiting',     -- 서류 대기 (카카오톡 발송됨)
    'doc_incomplete',  -- 서류 미비
    'doc_complete',    -- 접수 완료
    'franchise_done'   -- 가맹 완료 (기술지원 이관)
  )),
  doc_template TEXT,   -- 발송한 가맹 서류 템플릿명
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER franchise_applications_updated_at BEFORE UPDATE ON franchise_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE franchise_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON franchise_applications FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "authenticated insert" ON franchise_applications FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "authenticated update" ON franchise_applications FOR UPDATE TO authenticated USING (TRUE);
CREATE POLICY "authenticated delete" ON franchise_applications FOR DELETE TO authenticated USING (TRUE);

ALTER PUBLICATION supabase_realtime ADD TABLE franchise_applications;
