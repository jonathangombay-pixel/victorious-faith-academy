-- VFA Admin Profiles RLS Fix
-- Run this ONCE in the new Supabase project's SQL Editor.
-- Keep RLS enabled. This allows each signed-in admin to read their own profile.

alter table public.admin_profiles enable row level security;

drop policy if exists "VFA admins read own profile" on public.admin_profiles;
create policy "VFA admins read own profile"
on public.admin_profiles
for select
to authenticated
using (auth_user_id = auth.uid());
