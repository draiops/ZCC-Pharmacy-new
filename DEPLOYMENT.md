# Supabase + Vercel Setup

## 1. Create the database tables

Open your Supabase project, go to **SQL Editor**, and run `supabase-schema.sql`.

That creates:

- `patients`
- `inventory`
- `prescriptions`

It also enables RLS and adds prototype policies for the public anon key.

## 2. Add Vercel environment variables

In Vercel, open the project settings and add:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Use the values from Supabase project settings, then redeploy.

## 3. Deploy

Deploy this folder to Vercel. The app reads `/api/config` at startup and connects to Supabase automatically.

If the Supabase config is missing or unavailable, the app falls back to browser `localStorage` and shows that in the status badge.

## Security note

The current dashboard still uses demo frontend login. The included RLS policies allow the anon key to read and write dashboard data so the existing static app can work immediately. Before storing real patient data, replace the demo login with Supabase Auth and tighten the RLS policies to authenticated roles.
