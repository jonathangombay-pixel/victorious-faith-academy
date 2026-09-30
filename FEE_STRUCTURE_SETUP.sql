-- VFA fee structure for the 2026/2027 school year and future years.
CREATE TABLE IF NOT EXISTS public.fee_structures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  school_year text NOT NULL,
  first_payment numeric(12,2) NOT NULL DEFAULT 0,
  second_payment numeric(12,2) NOT NULL DEFAULT 0,
  third_payment numeric(12,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(class_id, school_year)
);

ALTER TABLE public.fee_structures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "VFA admins manage fee structures" ON public.fee_structures;
CREATE POLICY "VFA admins manage fee structures"
ON public.fee_structures FOR ALL TO authenticated
USING (is_vfa_admin())
WITH CHECK (is_vfa_admin());

DROP POLICY IF EXISTS "VFA students read class fee structures" ON public.fee_structures;
CREATE POLICY "VFA students read class fee structures"
ON public.fee_structures FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.class_id = fee_structures.class_id
      AND s.auth_user_id = auth.uid()
      AND s.is_active = true
  )
);

-- Optional: seed the official 2026/2027 fee amounts supplied for the portal.
INSERT INTO public.fee_structures (class_id, school_year, first_payment, second_payment, third_payment)
SELECT c.id, '2026/2027', v.first_payment, v.second_payment, v.third_payment
FROM public.classes c
JOIN (VALUES
  ('Day Care',10000,7000,2500),
  ('Kindergarten 1',10000,3000,2400),
  ('Kindergarten 2',10000,3000,2400),
  ('Grade 1',10500,6750,2250),
  ('Grade 2',10500,6750,2250),
  ('Grade 3',11500,8250,2250),
  ('Grade 4',11500,8250,2250),
  ('Grade 5',11500,8250,2250),
  ('Grade 6',14100,7250,2250),
  ('Grade 7',14100,8250,2000),
  ('Grade 8',15500,8000,2000),
  ('Grade 9',15500,8000,2000)
) AS v(class_name,first_payment,second_payment,third_payment)
ON v.class_name = c.name
ON CONFLICT (class_id, school_year) DO UPDATE SET
  first_payment = EXCLUDED.first_payment,
  second_payment = EXCLUDED.second_payment,
  third_payment = EXCLUDED.third_payment,
  updated_at = now();
