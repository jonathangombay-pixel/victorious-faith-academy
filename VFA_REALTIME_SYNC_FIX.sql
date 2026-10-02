-- VFA REALTIME SYNC FIX
-- Run once in Supabase SQL Editor as the project owner.
-- Safe: this only adds existing portal tables to Supabase Realtime.
-- It does not delete, update, migrate, or reset application data.

DO $$
DECLARE
  tbl text;
  tables_to_sync text[] := ARRAY[
    'students',
    'staff',
    'staff_attendance',
    'financial_records',
    'fee_structures',
    'grades',
    'student_period_results',
    'exam_timetable',
    'assignments',
    'announcements',
    'admin_suggestions',
    'admin_profiles',
    'scale_settings',
    'scale_your_child',
    'classes',
    'subjects'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_sync LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
    ) AND NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;

-- Verify the portal tables that actually exist and are now published.
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;
