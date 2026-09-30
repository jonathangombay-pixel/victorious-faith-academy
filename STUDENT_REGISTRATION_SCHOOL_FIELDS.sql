-- VFA Student Registration - school register fields
-- Run this once in the Supabase SQL Editor before saving students with the new fields.
-- This does not change existing Student IDs or registration numbers.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS registration_date date,
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS enrollment_status text;

-- Existing records are intentionally left blank where the school has not supplied
-- the historical registration date/sex/status. Fill those values from the school register.
