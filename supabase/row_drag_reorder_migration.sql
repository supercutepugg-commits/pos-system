-- 표 안에서 행을 드래그로 순서를 바꿀 수 있게 해주는 정렬용 컬럼 추가
-- 값이 없으면(null) 기존처럼 created_at 최신순으로 표시됩니다.
alter table franchise_applications add column if not exists sort_order bigint;
alter table woo_customers add column if not exists sort_order bigint;
alter table internet_management add column if not exists sort_order bigint;
alter table installations add column if not exists sort_order bigint;
