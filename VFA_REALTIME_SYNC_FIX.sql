-- VFA cross-device live sync.
-- Enables Supabase Realtime for existing school data tables.
-- This changes no rows and does not alter table schemas.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'students','staff','staff_attendance','financial_records','fee_structures',
    'grades','exam_timetable','assignments','announcements','admin_suggestions',
    'scale_your_child','scale_settings','classes','subjects'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename=t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
