-- VFA targeted RLS repair for the existing Stage 14 portal.
-- Does NOT delete, update, migrate, or reset student records.
-- Run once in Supabase SQL Editor while signed in as project owner/service role.

create or replace function public.vfa_is_current_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.auth_user_id = auth.uid()
      and ap.is_active = true
  );
$$;

grant execute on function public.vfa_is_current_admin() to authenticated;

alter table public.admin_profiles enable row level security;
drop policy if exists "VFA admins read own profile" on public.admin_profiles;
create policy "VFA admins read own profile"
on public.admin_profiles
for select to authenticated
using (auth_user_id = auth.uid());

-- Admin suggestions: admins manage them; students can read their own.
alter table public.admin_suggestions enable row level security;
drop policy if exists "VFA admins manage admin suggestions" on public.admin_suggestions;
create policy "VFA admins manage admin suggestions"
on public.admin_suggestions
for all to authenticated
using (public.vfa_is_current_admin())
with check (public.vfa_is_current_admin());

drop policy if exists "VFA students read own admin suggestions" on public.admin_suggestions;
create policy "VFA students read own admin suggestions"
on public.admin_suggestions
for select to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.id = admin_suggestions.student_id
      and s.auth_user_id = auth.uid()
      and s.is_active = true
  )
);
grant select, insert, update, delete on public.admin_suggestions to authenticated;

-- Staff attendance: admins manage records.
alter table public.staff_attendance enable row level security;
drop policy if exists "VFA admins manage staff attendance" on public.staff_attendance;
create policy "VFA admins manage staff attendance"
on public.staff_attendance
for all to authenticated
using (public.vfa_is_current_admin())
with check (public.vfa_is_current_admin());
grant select, insert, update, delete on public.staff_attendance to authenticated;

-- Staff register: admins manage records, including deletion.
alter table public.staff enable row level security;
drop policy if exists "VFA admins manage staff register" on public.staff;
create policy "VFA admins manage staff register"
on public.staff
for all to authenticated
using (public.vfa_is_current_admin())
with check (public.vfa_is_current_admin());
grant select, insert, update, delete on public.staff to authenticated;

-- Financial records: admins manage payment records.
alter table public.financial_records enable row level security;
drop policy if exists "VFA admins manage financial records" on public.financial_records;
create policy "VFA admins manage financial records"
on public.financial_records
for all to authenticated
using (public.vfa_is_current_admin())
with check (public.vfa_is_current_admin());
grant select, insert, update, delete on public.financial_records to authenticated;

-- Keep the existing student-read financial policy if present; do not alter student data.
