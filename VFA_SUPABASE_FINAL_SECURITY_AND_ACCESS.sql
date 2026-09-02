-- VFA Portal - final shared-data access/RLS setup
-- SAFE: no tables or records are deleted. Existing policies with these names are replaced.
-- Run once in Supabase SQL Editor after the existing VFA schema is installed.

CREATE OR REPLACE FUNCTION public.is_vfa_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_profiles ap
    WHERE ap.auth_user_id = auth.uid()
  );
$$;

-- Enable RLS on every shared/private table that the portal uses.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'admin_profiles','classes','students','staff','staff_attendance',
    'subjects','academic_periods','grades','student_period_results',
    'financial_records','exam_timetable','assignments','announcements',
    'admin_suggestions','scale_settings','scale_your_child'
  ] LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- =========================
-- ADMIN ACCESS
-- =========================
DO $$
BEGIN
  IF to_regclass('public.admin_profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins read own admin profile" ON public.admin_profiles;
    CREATE POLICY "VFA admins read own admin profile" ON public.admin_profiles
      FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
  END IF;

  IF to_regclass('public.classes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins read classes" ON public.classes;
    CREATE POLICY "VFA admins read classes" ON public.classes
      FOR SELECT TO authenticated USING (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.subjects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins read subjects" ON public.subjects;
    CREATE POLICY "VFA admins read subjects" ON public.subjects
      FOR SELECT TO authenticated USING (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.academic_periods') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins read academic periods" ON public.academic_periods;
    CREATE POLICY "VFA admins read academic periods" ON public.academic_periods
      FOR SELECT TO authenticated USING (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.staff') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage staff" ON public.staff;
    CREATE POLICY "VFA admins manage staff" ON public.staff
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.staff_attendance') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage staff attendance" ON public.staff_attendance;
    CREATE POLICY "VFA admins manage staff attendance" ON public.staff_attendance
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.students') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage students" ON public.students;
    CREATE POLICY "VFA admins manage students" ON public.students
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.grades') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage grades" ON public.grades;
    CREATE POLICY "VFA admins manage grades" ON public.grades
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.student_period_results') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage period results" ON public.student_period_results;
    CREATE POLICY "VFA admins manage period results" ON public.student_period_results
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.financial_records') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage financial records" ON public.financial_records;
    CREATE POLICY "VFA admins manage financial records" ON public.financial_records
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.exam_timetable') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage exam timetable" ON public.exam_timetable;
    CREATE POLICY "VFA admins manage exam timetable" ON public.exam_timetable
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.assignments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage assignments" ON public.assignments;
    CREATE POLICY "VFA admins manage assignments" ON public.assignments
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.announcements') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage announcements" ON public.announcements;
    CREATE POLICY "VFA admins manage announcements" ON public.announcements
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.admin_suggestions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage suggestions" ON public.admin_suggestions;
    CREATE POLICY "VFA admins manage suggestions" ON public.admin_suggestions
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.scale_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage scale settings" ON public.scale_settings;
    CREATE POLICY "VFA admins manage scale settings" ON public.scale_settings
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;

  IF to_regclass('public.scale_your_child') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA admins manage scale responses" ON public.scale_your_child;
    CREATE POLICY "VFA admins manage scale responses" ON public.scale_your_child
      FOR ALL TO authenticated USING (public.is_vfa_admin()) WITH CHECK (public.is_vfa_admin());
  END IF;
END $$;

-- =========================
-- STUDENT/PARENT ACCESS
-- Only the logged-in student's own record/content is readable.
-- =========================
DO $$
BEGIN
  IF to_regclass('public.students') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA students read own student record" ON public.students;
    CREATE POLICY "VFA students read own student record" ON public.students
      FOR SELECT TO authenticated USING (auth_user_id = auth.uid());
  END IF;

  IF to_regclass('public.classes') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA students read their class" ON public.classes;
    CREATE POLICY "VFA students read their class" ON public.classes
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.students s
          WHERE s.class_id = classes.id AND s.auth_user_id = auth.uid()
        )
      );
  END IF;

  IF to_regclass('public.subjects') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA authenticated read subjects" ON public.subjects;
    CREATE POLICY "VFA authenticated read subjects" ON public.subjects
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF to_regclass('public.academic_periods') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA authenticated read academic periods" ON public.academic_periods;
    CREATE POLICY "VFA authenticated read academic periods" ON public.academic_periods
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF to_regclass('public.grades') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA students read own grades" ON public.grades;
    CREATE POLICY "VFA students read own grades" ON public.grades
      FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.students s WHERE s.id = grades.student_id AND s.auth_user_id = auth.uid())
      );
  END IF;

  IF to_regclass('public.student_period_results') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA students read own period results" ON public.student_period_results;
    CREATE POLICY "VFA students read own period results" ON public.student_period_results
      FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.students s WHERE s.id = student_period_results.student_id AND s.auth_user_id = auth.uid())
      );
  END IF;

  IF to_regclass('public.financial_records') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA students read own financial records" ON public.financial_records;
    CREATE POLICY "VFA students read own financial records" ON public.financial_records
      FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.students s WHERE s.id = financial_records.student_id AND s.auth_user_id = auth.uid())
      );
  END IF;

  IF to_regclass('public.exam_timetable') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA students read class timetable" ON public.exam_timetable;
    CREATE POLICY "VFA students read class timetable" ON public.exam_timetable
      FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.students s WHERE s.class_id = exam_timetable.class_id AND s.auth_user_id = auth.uid())
      );
  END IF;

  IF to_regclass('public.assignments') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA students read assignments" ON public.assignments;
    CREATE POLICY "VFA students read assignments" ON public.assignments
      FOR SELECT TO authenticated USING (
        class_id IS NULL OR EXISTS (SELECT 1 FROM public.students s WHERE s.class_id = assignments.class_id AND s.auth_user_id = auth.uid())
      );
  END IF;

  IF to_regclass('public.announcements') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA students read announcements" ON public.announcements;
    CREATE POLICY "VFA students read announcements" ON public.announcements
      FOR SELECT TO authenticated USING (
        publish_to_all = true OR target_class_id IS NULL OR EXISTS (
          SELECT 1 FROM public.students s WHERE s.class_id = announcements.target_class_id AND s.auth_user_id = auth.uid()
        )
      );
  END IF;

  IF to_regclass('public.admin_suggestions') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA students read suggestions" ON public.admin_suggestions;
    CREATE POLICY "VFA students read suggestions" ON public.admin_suggestions
      FOR SELECT TO authenticated USING (
        target_class_id IS NULL OR EXISTS (
          SELECT 1 FROM public.students s WHERE s.class_id = admin_suggestions.target_class_id AND s.auth_user_id = auth.uid()
        )
      );
  END IF;

  IF to_regclass('public.scale_settings') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA authenticated read scale settings" ON public.scale_settings;
    CREATE POLICY "VFA authenticated read scale settings" ON public.scale_settings
      FOR SELECT TO authenticated USING (true);
  END IF;

  IF to_regclass('public.scale_your_child') IS NOT NULL THEN
    DROP POLICY IF EXISTS "VFA students submit scale response" ON public.scale_your_child;
    CREATE POLICY "VFA students submit scale response" ON public.scale_your_child
      FOR INSERT TO authenticated WITH CHECK (
        EXISTS (SELECT 1 FROM public.students s WHERE s.id = scale_your_child.student_id AND s.auth_user_id = auth.uid())
      );
  END IF;
END $$;

-- Helpful unique index for one attendance record per staff member per day.
-- It is created only if both columns exist. Existing duplicate rows are not removed.
DO $$
BEGIN
  IF to_regclass('public.staff_attendance') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_attendance' AND column_name='staff_id')
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='staff_attendance' AND column_name='date') THEN
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS staff_attendance_staff_date_uq ON public.staff_attendance(staff_id, date)';
  END IF;
END $$;
