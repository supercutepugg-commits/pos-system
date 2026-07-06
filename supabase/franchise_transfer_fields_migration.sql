-- ============================================
-- 전환건(기술지원) 탭을 위한 필드 추가
-- 프로그램(유니온/아임유/토스/플릭), 기술지원 담당자
-- franchise_schema.sql 적용 이후에 실행
-- ============================================

ALTER TABLE franchise_applications
  ADD COLUMN IF NOT EXISTS program TEXT,             -- 프로그램 (유니온/아임유/토스/플릭)
  ADD COLUMN IF NOT EXISTS tech_id UUID REFERENCES profiles(id); -- 담당자 (기술지원 인원)
