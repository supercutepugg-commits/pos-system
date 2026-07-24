-- ============================================
-- 토스심사완료 알림톡의 "장비 선택" 버튼으로 연결되는 고객용 웹링크 폼.
-- status_token(installations) 패턴과 동일하게 토큰 자체가 보안 경계.
-- ============================================

ALTER TABLE franchise_applications
  ADD COLUMN IF NOT EXISTS equipment_select_token UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS selected_equipment TEXT[],
  ADD COLUMN IF NOT EXISTS equipment_selected_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_franchise_applications_equipment_select_token ON franchise_applications(equipment_select_token);
