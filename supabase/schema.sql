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
  email text not null unique,
  display_name text not null default '',
  is_admin boolean not null default false,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users
  add column if not exists is_admin boolean not null default false;

alter table public.users
  add column if not exists is_super_admin boolean not null default false;

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
      and (is_admin = true or is_super_admin = true)
  );
$$;

create or replace function public.is_super_admin_user()
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
      and is_super_admin = true
  );
$$;

alter table public.employees enable row level security;
alter table public.users enable row level security;

-- Only authenticated admins can read and manage employees.
drop policy if exists "authenticated can read employees" on public.employees;
drop policy if exists "anyone can read employees" on public.employees;

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
drop policy if exists "users can select own profile" on public.users;
drop policy if exists "users can insert own profile" on public.users;
drop policy if exists "users can update own profile" on public.users;

create policy "users can select own profile"
on public.users for select
to authenticated
using (id = auth.uid());

create policy "users can insert own profile"
on public.users for insert
to authenticated
with check (id = auth.uid());

create policy "users can update own profile"
on public.users for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Super admins can manage all profiles.
drop policy if exists "super admins can manage profiles" on public.users;
create policy "super admins can manage profiles"
on public.users for all
to authenticated
using (public.is_super_admin_user())
with check (public.is_super_admin_user());

-- Trigger function to check user privileges and prevent self-privilege-escalation
create or replace function public.check_user_privileges()
returns trigger
language plpgsql
security definer
as $$
begin
  -- If executed by service role, postgres, or supabase_admin, allow anything
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  -- On insert, if they are not super admin, they cannot set admin flags to true
  if tg_op = 'INSERT' then
    if new.is_admin = true or new.is_super_admin = true then
      raise exception 'Cannot set administrative privileges on insert.';
    end if;
  -- On update, if they are not super admin, they cannot change these columns
  elsif tg_op = 'UPDATE' then
    if not public.is_super_admin_user() then
      if new.is_admin <> old.is_admin or new.is_super_admin <> old.is_super_admin then
        raise exception 'Only service role or super admins can modify administrative privileges.';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists check_user_privileges_trigger on public.users;
create trigger check_user_privileges_trigger
before insert or update on public.users
for each row
execute function public.check_user_privileges();

-- Create scan logs table
create table if not exists public.scan_logs (
  id uuid primary key default gen_random_uuid(),
  status text not null check (status in ('valid', 'expired', 'not_found', 'invalid_qr')),
  employee_id uuid references public.employees(id) on delete set null,
  scanned_token text check (char_length(scanned_token) <= 512),
  created_at timestamptz not null default now()
);

-- Ensure check constraints are applied to existing tables
alter table public.scan_logs
  drop constraint if exists scan_logs_status_check,
  add constraint scan_logs_status_check check (status in ('valid', 'expired', 'not_found', 'invalid_qr'));

alter table public.scan_logs
  drop constraint if exists scan_logs_scanned_token_check,
  add constraint scan_logs_scanned_token_check check (char_length(scanned_token) <= 512);

-- Enable Row-Level Security
alter table public.scan_logs enable row level security;

-- Define RLS Policies for scan_logs (restricted to authenticated admins)
drop policy if exists "anyone can read scan_logs" on public.scan_logs;
drop policy if exists "admins can read scan_logs" on public.scan_logs;
create policy "admins can read scan_logs" on public.scan_logs
  for select to authenticated using (public.is_admin_user());

drop policy if exists "anyone can insert scan_logs" on public.scan_logs;
drop policy if exists "admins can insert scan_logs" on public.scan_logs;
create policy "admins can insert scan_logs" on public.scan_logs
  for insert to authenticated with check (public.is_admin_user());

drop policy if exists "anyone can delete scan_logs" on public.scan_logs;
drop policy if exists "admins can delete scan_logs" on public.scan_logs;
create policy "admins can delete scan_logs" on public.scan_logs
  for delete to authenticated using (public.is_admin_user());

-- Create trigger function for automatic updated_at timestamps
create or replace function public.update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_employees_updated_at on public.employees;
create trigger set_employees_updated_at
before update on public.employees
for each row
execute function public.update_updated_at_column();

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
before update on public.users
for each row
execute function public.update_updated_at_column();

-- Enable pg_cron and schedule the 7-day retention policy
create extension if not exists pg_cron;

-- Schedule the log deletion job (runs every day at midnight UTC) safely
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('delete-old-scan-logs');
    perform cron.schedule(
      'delete-old-scan-logs',
      '0 0 * * *',
      $$delete from public.scan_logs where created_at < now() - interval '7 days'$$
    );
  else
    raise warning 'pg_cron extension is not enabled. Automated scan log purging will not be scheduled.';
  end if;
exception
  when others then
    raise warning 'Failed to schedule scan log purging job: %', sqlerrm;
end;
$$;

