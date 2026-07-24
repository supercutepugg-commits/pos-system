-- 재고실사: 대분류/중분류 컬럼 추가 (기존 category 컬럼은 소분류로 재사용)
alter table inventory_items
  add column if not exists major_category text,
  add column if not exists mid_category text;

-- 기존 데이터는 대분류를 '기타'로, 중분류는 기존 category 값을 그대로 채워 넣음
update inventory_items
set major_category = coalesce(major_category, '기타'),
    mid_category = coalesce(mid_category, category)
where major_category is null or mid_category is null;
