-- VFA PORTAL: ONE-TIME CLEANUP OF OLD TEST/DEMO SCHOOL RECORDS
-- Run this ONLY if the Supabase project currently contains the old test/demo
-- records and you want a completely blank school database.
-- This keeps the structural tables (classes, subjects, academic periods)
-- and the three admin profiles.

TRUNCATE TABLE
  public.grades,
  public.student_period_results,
  public.financial_records,
  public.assignments,
  public.announcements,
  public.exam_timetable,
  public.scale_your_child,
  public.admin_suggestions,
  public.staff_attendance,
  public.students,
  public.staff
RESTART IDENTITY CASCADE;
