-- VFA: fix admin write permissions for the shared Supabase school database.
-- Run this ONCE in Supabase SQL Editor, then test the portal.
-- No tables or student data are deleted.

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
  )
  OR lower(coalesce(auth.jwt() ->> 'email','')) IN (
    'bishop.andrew@your-school-domain.com',
    'jue.carmo@your-school-domain.com',
    'jonathangombay@gmail.com'
  );
$$;

-- These are admin-only tables. Existing student SELECT policies are left alone.
DROP POLICY IF EXISTS "Admins manage staff attendance" ON public.staff_attendance;
CREATE POLICY "Admins manage staff attendance"
ON public.staff_attendance FOR ALL TO authenticated
USING (public.is_vfa_admin())
WITH CHECK (public.is_vfa_admin());

DROP POLICY IF EXISTS "Admins manage suggestions" ON public.admin_suggestions;
CREATE POLICY "Admins manage suggestions"
ON public.admin_suggestions FOR ALL TO authenticated
USING (public.is_vfa_admin())
WITH CHECK (public.is_vfa_admin());

DROP POLICY IF EXISTS "Admins manage announcements" ON public.announcements;
CREATE POLICY "Admins manage announcements"
ON public.announcements FOR ALL TO authenticated
USING (public.is_vfa_admin())
WITH CHECK (public.is_vfa_admin());

DROP POLICY IF EXISTS "Admins manage assignments" ON public.assignments;
CREATE POLICY "Admins manage assignments"
ON public.assignments FOR ALL TO authenticated
USING (public.is_vfa_admin())
WITH CHECK (public.is_vfa_admin());

DROP POLICY IF EXISTS "Admins manage exam timetable" ON public.exam_timetable;
CREATE POLICY "Admins manage exam timetable"
ON public.exam_timetable FOR ALL TO authenticated
USING (public.is_vfa_admin())
WITH CHECK (public.is_vfa_admin());

DROP POLICY IF EXISTS "Admins manage financial records" ON public.financial_records;
CREATE POLICY "Admins manage financial records"
ON public.financial_records FOR ALL TO authenticated
USING (public.is_vfa_admin())
WITH CHECK (public.is_vfa_admin());

DROP POLICY IF EXISTS "Admins manage staff" ON public.staff;
CREATE POLICY "Admins manage staff"
ON public.staff FOR ALL TO authenticated
USING (public.is_vfa_admin())
WITH CHECK (public.is_vfa_admin());

-- These are also managed from the admin panel.
DROP POLICY IF EXISTS "Admins manage students" ON public.students;
CREATE POLICY "Admins manage students"
ON public.students FOR ALL TO authenticated
USING (public.is_vfa_admin())
WITH CHECK (public.is_vfa_admin());

DROP POLICY IF EXISTS "Admins manage grades" ON public.grades;
CREATE POLICY "Admins manage grades"
ON public.grades FOR ALL TO authenticated
USING (public.is_vfa_admin())
WITH CHECK (public.is_vfa_admin());

DROP POLICY IF EXISTS "Admins manage period results" ON public.student_period_results;
CREATE POLICY "Admins manage period results"
ON public.student_period_results FOR ALL TO authenticated
USING (public.is_vfa_admin())
WITH CHECK (public.is_vfa_admin());

DROP POLICY IF EXISTS "Admins manage admin profiles" ON public.admin_profiles;
CREATE POLICY "Admins manage admin profiles"
ON public.admin_profiles FOR ALL TO authenticated
USING (public.is_vfa_admin())
WITH CHECK (public.is_vfa_admin());
