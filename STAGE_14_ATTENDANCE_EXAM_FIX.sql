-- VFA Stage 14: Staff/Teacher Attendance + editable Examination Timetable
-- Run after the working Stage 13 SQL.
-- This migration is limited to Stage 14 tables/policies and the assignment
-- student-read policy. It does not modify students, grades, or financial data.

create table if not exists public.exam_timetable (
  id uuid primary key default gen_random_uuid(),
  exam_date date,
  start_time text,
  end_time text,
  room text,
  subject_id uuid references public.subjects(id) on delete set null,
  class_id uuid not null references public.classes(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.exam_timetable enable row level security;
drop policy if exists "VFA admins manage exam timetable" on public.exam_timetable;
create policy "VFA admins manage exam timetable"
on public.exam_timetable for all to authenticated
using (public.vfa_is_current_admin())
with check (public.vfa_is_current_admin());

drop policy if exists "VFA students read own class exam timetable" on public.exam_timetable;
create policy "VFA students read own class exam timetable"
on public.exam_timetable for select to authenticated
using (
  exists (
    select 1
    from public.students s
    where s.class_id = exam_timetable.class_id
      and s.auth_user_id = auth.uid()
      and s.is_active = true
  )
);

grant select, insert, update, delete on public.exam_timetable to authenticated;

-- Subjects are needed by both the Admin timetable editor and the student view.
drop policy if exists "VFA authenticated users read subjects" on public.subjects;
create policy "VFA authenticated users read subjects"
on public.subjects for select to authenticated using (true);
grant select on public.subjects to authenticated;

-- Staff register permissions.
alter table public.staff enable row level security;
drop policy if exists "VFA admins manage staff register" on public.staff;
create policy "VFA admins manage staff register"
on public.staff for all to authenticated
using (public.vfa_is_current_admin())
with check (public.vfa_is_current_admin());

drop policy if exists "VFA students read sponsor staff" on public.staff;
create policy "VFA students read sponsor staff"
on public.staff for select to authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.students s
    where s.sponsor_id = staff.id
      and s.auth_user_id = auth.uid()
      and s.is_active = true
  )
);
grant select, insert, update, delete on public.staff to authenticated;

-- Staff attendance: one record per staff member per date.
create table if not exists public.staff_attendance (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff(id) on delete cascade,
  attendance_date date not null,
  status text not null default 'present',
  check_in_time timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_attendance_staff_date_unique unique (staff_id, attendance_date)
);

-- Normalize the status constraint for both fresh and existing Stage 14 databases.
-- The Admin panel stores the canonical lowercase values: present, late, absent.
alter table public.staff_attendance
  drop constraint if exists staff_attendance_status_check;
alter table public.staff_attendance
  add constraint staff_attendance_status_check
  check (lower(status) in ('present', 'late', 'absent'));

-- Normalize any legacy mixed-case values before the constraint is enforced.
update public.staff_attendance
set status = lower(status)
where status is not null and status <> lower(status);

alter table public.staff_attendance enable row level security;
drop policy if exists "VFA admins manage staff attendance" on public.staff_attendance;
create policy "VFA admins manage staff attendance"
on public.staff_attendance for all to authenticated
using (public.vfa_is_current_admin())
with check (public.vfa_is_current_admin());
grant select, insert, update, delete on public.staff_attendance to authenticated;

-- Students can read only assignments targeted to their own class or All Students.
alter table public.assignments enable row level security;
drop policy if exists "VFA students read assignments" on public.assignments;
create policy "VFA students read assignments"
on public.assignments for select to authenticated
using (
  assignments.class_id is null
  or exists (
    select 1
    from public.students s
    where s.class_id = assignments.class_id
      and s.auth_user_id = auth.uid()
      and s.is_active = true
  )
);
grant select on public.assignments to authenticated;

-- Keep updated_at current when the helper exists in the working VFA schema.
do $$
begin
  if to_regprocedure('public.vfa_set_updated_at()') is not null then
    drop trigger if exists exam_timetable_updated_at on public.exam_timetable;
    create trigger exam_timetable_updated_at
    before update on public.exam_timetable
    for each row execute function public.vfa_set_updated_at();

    drop trigger if exists staff_attendance_updated_at on public.staff_attendance;
    create trigger staff_attendance_updated_at
    before update on public.staff_attendance
    for each row execute function public.vfa_set_updated_at();
  end if;
end $$;
