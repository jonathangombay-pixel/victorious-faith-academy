-- VFA Student Registration ID System - corrected migration
-- Run this once in Supabase SQL Editor.
-- Existing student_code values are preserved.
-- New students get a permanent registration_number within their class.

ALTER TABLE public.students
ADD COLUMN IF NOT EXISTS registration_number integer;

-- Backfill existing students by original registration/creation order within each class.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY class_id
      ORDER BY created_at NULLS FIRST, id
    )::integer AS rn
  FROM public.students
  WHERE registration_number IS NULL
    AND class_id IS NOT NULL
)
UPDATE public.students s
SET registration_number = r.rn
FROM ranked r
WHERE s.id = r.id;

CREATE UNIQUE INDEX IF NOT EXISTS students_class_registration_number_unique
ON public.students (class_id, registration_number)
WHERE class_id IS NOT NULL AND registration_number IS NOT NULL;

-- Automatically assign the next permanent number for new students in a class.
CREATE OR REPLACE FUNCTION public.vfa_assign_student_registration()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  next_number integer;
BEGIN
  IF NEW.class_id IS NOT NULL AND NEW.registration_number IS NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.class_id::text, 0));

    SELECT COALESCE(MAX(registration_number), 0) + 1
      INTO next_number
    FROM public.students
    WHERE class_id = NEW.class_id;

    NEW.registration_number := next_number;
  END IF;

  -- New IDs are 0020172 + three-digit permanent registration number.
  IF TG_OP = 'INSERT'
     AND NEW.class_id IS NOT NULL
     AND NEW.registration_number IS NOT NULL THEN
    NEW.student_code := '0020172' || LPAD(NEW.registration_number::text, 3, '0');
  ELSIF (NEW.student_code IS NULL OR NEW.student_code = '')
        AND NEW.class_id IS NOT NULL
        AND NEW.registration_number IS NOT NULL THEN
    NEW.student_code := '0020172' || LPAD(NEW.registration_number::text, 3, '0');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vfa_assign_student_registration ON public.students;
CREATE TRIGGER trg_vfa_assign_student_registration
BEFORE INSERT ON public.students
FOR EACH ROW
EXECUTE FUNCTION public.vfa_assign_student_registration();

-- Official VFA classes.
-- IMPORTANT: classes.sort_order is NOT NULL in this database, so every new
-- class must receive a value here.
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
      UPDATE public.classes
      SET sort_order = class_order
      WHERE name = class_name;
    ELSE
      INSERT INTO public.classes (name, sort_order)
      VALUES (class_name, class_order);
    END IF;
  END LOOP;
END $$;

-- Official VFA subjects.
-- Use the school's subject order from the supplied list.
DO $$
DECLARE
  subject_name text;
  subject_order integer;
BEGIN
  FOR subject_name, subject_order IN
    SELECT * FROM (VALUES
      ('Bible', 1),
      ('English', 2),
      ('Mathematics', 3),
      ('General Science', 4),
      ('Social Studies', 5),
      ('Writing', 6),
      ('Phonics', 7),
      ('Computer', 8),
      ('Physical Education', 9),
      ('Spelling', 10),
      ('Reading', 11),
      ('Drawing', 12),
      ('Arts/Craft', 13)
    ) AS official(name, sort_order)
  LOOP
    -- Some versions of the schema have subjects.sort_order; support both.
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'subjects'
        AND column_name = 'sort_order'
    ) THEN
      IF EXISTS (SELECT 1 FROM public.subjects WHERE name = subject_name) THEN
        EXECUTE 'UPDATE public.subjects SET sort_order = $1 WHERE name = $2'
          USING subject_order, subject_name;
      ELSE
        EXECUTE 'INSERT INTO public.subjects (name, sort_order) VALUES ($1, $2)'
          USING subject_name, subject_order;
      END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM public.subjects WHERE name = subject_name) THEN
        INSERT INTO public.subjects (name) VALUES (subject_name);
      END IF;
    END IF;
  END LOOP;
END $$;

-- Verify the new registration numbers and classes.
SELECT
  s.full_name,
  c.name AS class_name,
  s.registration_number,
  s.student_code
FROM public.students s
LEFT JOIN public.classes c ON c.id = s.class_id
ORDER BY c.sort_order, s.registration_number, s.full_name;
