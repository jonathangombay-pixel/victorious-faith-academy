DO $$
DECLARE
  tbl text;
  tables_to_sync text[] := ARRAY[
    'students',
    'staff',
    'staff_attendance',
    'financial_records',
    'grades',
    'student_period_results',
    'exam_timetable',
    'assignments',
    'announcements',
    'admin_suggestions',
    'admin_profiles',
    'scale_settings',
    'classes'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables_to_sync
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = tbl
    ) THEN
      BEGIN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE public.%I',
          tbl
        );
      EXCEPTION
        WHEN duplicate_object THEN
          NULL;
      END;
    END IF;
  END LOOP;
END
$$;