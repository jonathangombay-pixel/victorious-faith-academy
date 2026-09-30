-- VFA Student Registration / Student ID — GLOBAL permanent numbering
-- Run once in Supabase SQL Editor.
--
-- IMPORTANT:
-- Registration numbers are SCHOOL-WIDE, not per class.
-- Existing students are normalized by their original created_at order.
-- Auth user IDs are NOT changed. After running this SQL, sign in to the
-- Admin portal once so the portal can sync any changed Student IDs to Auth.
-- Deleted registration numbers are never recycled.

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS registration_number integer;

-- Remove the old per-class uniqueness rule/trigger so it cannot recreate duplicates.
DROP TRIGGER IF EXISTS trg_vfa_assign_student_registration ON public.students;
DROP INDEX IF EXISTS public.students_class_registration_number_unique;

-- Temporarily give every existing row a unique placeholder code so the final
-- global IDs can be assigned safely even if a unique constraint already exists.
UPDATE public.students
SET student_code = 'VFA-MIG-' || id::text,
    registration_number = NULL;

-- Assign permanent SCHOOL-WIDE registration numbers in original database
-- creation order. This repairs old per-class numbering and the malformed/duplicate IDs.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY created_at NULLS FIRST, id)::integer AS rn
  FROM public.students
)
UPDATE public.students s
SET registration_number = r.rn
FROM ranked r
WHERE s.id = r.id;

-- Student ID = fixed school prefix + permanent 3-digit registration number.
UPDATE public.students
SET student_code = '0020172' || LPAD(registration_number::text, 3, '0')
WHERE registration_number IS NOT NULL;

-- Enforce the rule at the database level.
CREATE UNIQUE INDEX IF NOT EXISTS students_registration_number_unique
ON public.students (registration_number)
WHERE registration_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS students_student_code_unique
ON public.students (student_code)
WHERE student_code IS NOT NULL;

-- New students always receive the next SCHOOL-WIDE number.
-- A single advisory lock prevents two admins saving at the same time from
-- receiving the same registration number.
CREATE OR REPLACE FUNCTION public.vfa_assign_student_registration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_number integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('vfa_student_registration_global', 0));

  IF TG_OP = 'INSERT' THEN
    SELECT COALESCE(MAX(registration_number), 0) + 1
      INTO next_number
    FROM public.students;

    NEW.registration_number := next_number;
    NEW.student_code := '0020172' || LPAD(next_number::text, 3, '0');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_vfa_assign_student_registration
BEFORE INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.vfa_assign_student_registration();

-- Official VFA classes and stable order.
DO $$
DECLARE
  class_name text;
  class_order integer;
BEGIN
  FOR class_name, class_order IN
    SELECT * FROM (VALUES
      ('Day Care', 1),
      ('Kindergarten 1', 2),
      ('Kindergarten 2', 3),
      ('Grade 1', 4),
      ('Grade 2', 5),
      ('Grade 3', 6),
      ('Grade 4', 7),
      ('Grade 5', 8),
      ('Grade 6', 9),
      ('Grade 7', 10),
      ('Grade 8', 11),
      ('Grade 9', 12)
    ) AS official(name, sort_order)
  LOOP
    IF EXISTS (SELECT 1 FROM public.classes WHERE name = class_name) THEN
      UPDATE public.classes SET sort_order = class_order WHERE name = class_name;
    ELSE
      INSERT INTO public.classes (name, sort_order) VALUES (class_name, class_order);
    END IF;
  END LOOP;
END $$;

-- Official VFA subjects.
DO $$
DECLARE
  subject_name text;
  subject_order integer;
BEGIN
  FOR subject_name, subject_order IN
    SELECT * FROM (VALUES
      ('Bible', 1), ('English', 2), ('Mathematics', 3),
      ('General Science', 4), ('Social Studies', 5), ('Writing', 6),
      ('Phonics', 7), ('Computer', 8), ('Physical Education', 9),
      ('Spelling', 10), ('Reading', 11), ('Drawing', 12), ('Arts/Craft', 13)
    ) AS official(name, sort_order)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='subjects' AND column_name='sort_order'
    ) THEN
      IF EXISTS (SELECT 1 FROM public.subjects WHERE name=subject_name) THEN
        EXECUTE 'UPDATE public.subjects SET sort_order=$1 WHERE name=$2'
          USING subject_order, subject_name;
      ELSE
        EXECUTE 'INSERT INTO public.subjects (name, sort_order) VALUES ($1, $2)'
          USING subject_name, subject_order;
      END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE name=subject_name) THEN
        INSERT INTO public.subjects (name) VALUES (subject_name);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Verification: this should show unique school-wide 001, 002, 003...
SELECT
  s.full_name,
  c.name AS class_name,
  s.registration_number,
  s.student_code,
  s.auth_user_id
FROM public.students s
LEFT JOIN public.classes c ON c.id=s.class_id
ORDER BY s.registration_number;
