-- 가맹접수 탭에 "접수날짜"를 접수채널 왼쪽에 추가하기 위한 컬럼
alter table franchise_applications add column if not exists reception_date text;
