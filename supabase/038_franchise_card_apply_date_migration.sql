-- 가맹접수 상세정보에 카드가맹접수일 필드 추가
ALTER TABLE franchise_applications ADD COLUMN IF NOT EXISTS card_apply_date DATE;
