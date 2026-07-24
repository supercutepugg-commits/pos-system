-- ============================================
-- 가맹 접수 출고 장비 — 자유 텍스트(equipment) 대신 품목+수량 리스트로 관리
-- franchise_schema.sql 적용 이후에 실행
-- ============================================

ALTER TABLE franchise_applications
  ADD COLUMN IF NOT EXISTS equipment_items JSONB DEFAULT '[]'::jsonb;
