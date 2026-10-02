-- VFA student fields migration
-- Adds only the student fields required by the Admin and Student portals.
-- Existing student rows are preserved; no student rows are deleted or updated.

alter table public.students
  add column if not exists registration_date date,
  add column if not exists sex text,
  add column if not exists enrollment_status text,
  add column if not exists scholarship boolean not null default false;
