-- 고객 관리 대장 테이블
-- Supabase SQL Editor에서 실행하세요.

create table if not exists customer_ledger (
  id uuid primary key default gen_random_uuid(),
  record_date date not null default current_date,
  manager_id uuid references profiles(id),
  manager_name text,
  business_name text not null,
  phone text,
  issue text,
  solution text,
  created_at timestamptz not null default now()
);

alter table customer_ledger enable row level security;

create policy "authenticated users can read customer_ledger"
  on customer_ledger for select
  to authenticated
  using (true);

create policy "authenticated users can insert customer_ledger"
  on customer_ledger for insert
  to authenticated
  with check (true);
