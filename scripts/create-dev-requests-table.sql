-- 개발요청 게시판 테이블
-- Supabase SQL Editor에서 실행하세요.

create table if not exists dev_requests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text,
  requester_id uuid references profiles(id),
  requester_name text,
  status text not null default '확인중' check (status in ('확인중', '미승인', '승인')),
  approver_id uuid references profiles(id),
  approver_name text,
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table dev_requests enable row level security;

create policy "authenticated users can read dev_requests"
  on dev_requests for select
  to authenticated
  using (true);

create policy "authenticated users can insert dev_requests"
  on dev_requests for insert
  to authenticated
  with check (true);

create policy "authenticated users can update dev_requests"
  on dev_requests for update
  to authenticated
  using (true);

create policy "authenticated users can delete dev_requests"
  on dev_requests for delete
  to authenticated
  using (true);
