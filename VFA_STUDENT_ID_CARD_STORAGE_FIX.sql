-- VFA Student ID Card Storage
-- ADDITIVE ONLY: no existing student data is deleted or changed.
alter table if exists public.students
  add column if not exists id_card_data text;
