-- Supabase bootstrap schema for ID Verifier

create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null,
  name text not null,
  department text not null,
  expiry_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- Admin app policy set: only approved admins can manage employee records.
drop policy if exists "authenticated can read employees" on public.employees;
create policy "authenticated can read employees"
on public.employees for select
to authenticated
using (public.is_admin_user());

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
