-- Supabase bootstrap schema for ID Verifier

create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null,
  name text not null,
  designation text not null,
  establishment text not null default 'Fashion Depot',
  expiry_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists employees_employee_code_key
  on public.employees (employee_code);

create table if not exists public.users (
  id uuid primary key,
  email text not null,
  display_name text not null default '',
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where id = auth.uid()
      and is_admin = true
  );
$$;

alter table public.employees enable row level security;
alter table public.users enable row level security;

-- Anyone can read employee records (needed for QR scanning without logging in).
drop policy if exists "authenticated can read employees" on public.employees;
drop policy if exists "anyone can read employees" on public.employees;
create policy "anyone can read employees"
on public.employees for select
to public
using (true);

drop policy if exists "authenticated can manage employees" on public.employees;
create policy "authenticated can manage employees"
on public.employees for all
to authenticated
using (public.is_admin_user())
with check (public.is_admin_user());

drop policy if exists "admins can read profiles" on public.users;
create policy "admins can read profiles"
on public.users for select
to authenticated
using (public.is_admin_user());

-- Profile rows are scoped to the signed-in user.
drop policy if exists "users can upsert own profile" on public.users;
create policy "users can upsert own profile"
on public.users for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Create scan logs table
create table if not exists public.scan_logs (
  id uuid primary key default gen_random_uuid(),
  status text not null, -- 'valid' | 'expired' | 'not_found' | 'invalid_qr'
  employee_id uuid references public.employees(id) on delete set null,
  scanned_token text,
  created_at timestamptz not null default now()
);

-- Enable Row-Level Security
alter table public.scan_logs enable row level security;

-- Define RLS Policies matching current public access layout
drop policy if exists "anyone can read scan_logs" on public.scan_logs;
create policy "anyone can read scan_logs" on public.scan_logs
  for select to public using (true);

drop policy if exists "anyone can insert scan_logs" on public.scan_logs;
create policy "anyone can insert scan_logs" on public.scan_logs
  for insert to public with check (true);

drop policy if exists "anyone can delete scan_logs" on public.scan_logs;
create policy "anyone can delete scan_logs" on public.scan_logs
  for delete to public using (true);

-- Enable pg_cron and schedule the 7-day retention policy
create extension if not exists pg_cron;

-- Schedule the log deletion job (runs every day at midnight UTC)
select cron.schedule(
  'delete-old-scan-logs',
  '0 0 * * *',
  $$delete from public.scan_logs where created_at < now() - interval '7 days'$$
);

