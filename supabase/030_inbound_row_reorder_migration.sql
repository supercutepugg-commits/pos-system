-- 인입내역 탭에서 행을 드래그로 재정렬할 수 있게 해주는 컬럼
alter table crm_inbound add column if not exists sort_order bigint;
