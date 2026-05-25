<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/0c685e9f-bef2-4f60-bdcf-e76d7b4ba25e

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create [.env.local](.env.local) from [.env.example](.env.example)
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Run the app:
   `npm run dev`

## Supabase Setup

This app now uses Supabase for authentication and employee records.

Create the schema from [supabase/schema.sql](supabase/schema.sql), or run the SQL below manually.

```sql
create extension if not exists pgcrypto;

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  employee_code text not null,
  name text not null,
  department text not null,
  expiry_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  ## Vercel Deploy

  Set these environment variables in Vercel:

  ```env
  VITE_SUPABASE_URL=https://your-project-ref.supabase.co
  VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
  ```

  Build command:

  ```bash
  npm run build
  ```

  Output directory:

  ```bash
  dist
  ```
using (true);
