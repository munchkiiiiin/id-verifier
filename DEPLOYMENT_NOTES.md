# Deployment Notes

## What I changed

- Removed Google/Firebase usage and switched the app to Supabase for auth and database access.
- Added admin-only Supabase policies so only approved users can manage employee records.
- Created a first admin account in Supabase:
  - `deveramarkron76@gmail.com`
- Removed the live Supabase values from `.env.example` and replaced them with placeholders.
- Removed the Google Fonts CDN import and switched the UI to local/system fonts.
- Tightened the employee screen so add, edit, and delete update the UI immediately.
- Removed unused backend packages that were not needed for a Vercel deploy.

## What is still needed to deploy on Vercel

1. Set the Vercel environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`
2. Confirm Supabase RLS is enabled for every table you expose.
3. Keep admin access limited to rows where `public.users.is_admin = true`.
4. Deploy using `npm run build` with `dist` as the output directory.

## What you should not publish

- `.env.local`
- any Supabase service-role or database password
- any Google/Firebase keys
- any local build artifacts such as `dist/`, `node_modules/`, or `android/`

## GitHub repository status

- I prepared the project to be repo-safe for a public Vercel deployment.
- GitHub CLI is not available in this environment, so I could not create and push the remote repository directly from here.
- The next step is to initialize a local git repo and push it to your GitHub account once you provide or configure GitHub authentication.
