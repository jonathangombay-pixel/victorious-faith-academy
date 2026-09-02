-- Adds permanent check-in time to Staff / Teacher Attendance.
-- Safe: this only adds a nullable column if it does not already exist.
ALTER TABLE public.staff_attendance
ADD COLUMN IF NOT EXISTS check_in_time timestamptz;
