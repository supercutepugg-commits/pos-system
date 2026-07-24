-- 가맹접수 탭 상세보기에 "변경유형" 드롭다운을 추가하기 위한 컬럼
alter table franchise_applications add column if not exists change_type text;
