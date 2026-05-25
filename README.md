<div align="center">
<img width="1200" height="475" alt="ID Verifier" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-ad2b-6e31a0763ed6" />
</div>

# ID Verifier

ID Verifier is a Vite + React app that uses Supabase for authentication and employee data storage. It includes a scanner view for QR verification and an admin panel for CRUD operations on employee records.

## Stack

- React 19 + Vite
- Supabase Auth + Postgres
- Tailwind CSS
- Capacitor for Android packaging

## Run Locally

**Prerequisite:** Node.js 20 or later

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create [.env.local](.env.local) from [.env.example](.env.example).
3. Fill in your Supabase values:

   ```env
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_publishable_or_anon_key
   ```

4. Start the app:

   ```bash
   npm run dev
   ```

## Supabase Setup

The schema and admin policy live in [supabase/schema.sql](supabase/schema.sql).

Apply the SQL in the Supabase SQL editor, or use the local migration script only if you still want to manage it from this repo.

The schema includes:

- `public.employees` for employee records
- `public.users` for app users and admin flags
- row-level security policies for admin-only CRUD access

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

## Security Notes

- Do not commit [.env.local](.env.local).
- Do not add a Supabase service-role key to the frontend.
- Keep admin access controlled through Supabase RLS and the `public.users.is_admin` flag.
- Avoid adding third-party front-end APIs unless they are required for deployment.

## Repository Notes

- Public deployment files are focused on the web app only.
- Android and local build artifacts are excluded from the public repo through [.gitignore](.gitignore).
- Operational notes are in [DEPLOYMENT_NOTES.md](DEPLOYMENT_NOTES.md).
