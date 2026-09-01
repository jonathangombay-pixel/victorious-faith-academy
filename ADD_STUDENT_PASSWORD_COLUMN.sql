-- VFA: persist the one-time student portal password
-- Run once in Supabase SQL Editor. This does not delete any records.
ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS portal_password text;
