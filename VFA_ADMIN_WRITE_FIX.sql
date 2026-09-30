-- VFA ADMIN WRITE FIX
-- Run once in Supabase SQL Editor.
-- Does not delete school data. Admin writes use SECURITY DEFINER functions
-- so table RLS cannot block legitimate VFA administrators.

CREATE OR REPLACE FUNCTION public.vfa_is_current_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_profiles ap
    WHERE ap.auth_user_id=auth.uid()
       OR ap.auth_user_id::text=current_setting('request.jwt.claim.sub',true));
$$;

CREATE OR REPLACE FUNCTION public.vfa_admin_save_fee_structure(p_class_id uuid,p_school_year text,p_first numeric,p_second numeric,p_third numeric)
RETURNS public.fee_structures LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.fee_structures;
BEGIN
 IF NOT public.vfa_is_current_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 INSERT INTO public.fee_structures(class_id,school_year,first_payment,second_payment,third_payment,updated_at)
 VALUES(p_class_id,p_school_year,coalesce(p_first,0),coalesce(p_second,0),coalesce(p_third,0),now())
 ON CONFLICT(class_id,school_year) DO UPDATE SET first_payment=excluded.first_payment,second_payment=excluded.second_payment,third_payment=excluded.third_payment,updated_at=now()
 RETURNING * INTO r; RETURN r;
END; $$;

-- financial_records.balance must be a normal numeric column, not a generated column,
-- because the portal stores the running balance after each payment.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname='public' AND c.relname='financial_records'
      AND a.attname='balance' AND a.attgenerated <> ''
  ) THEN
    ALTER TABLE public.financial_records ALTER COLUMN balance DROP EXPRESSION;
  END IF;
END $$;

ALTER TABLE public.financial_records
  ALTER COLUMN balance SET DEFAULT 0;

-- Rebuild existing running balances in case records were created before this fix.
WITH ordered AS (
  SELECT id,
    greatest(0, coalesce(amount_due,0) -
      sum(coalesce(amount_paid,0)) OVER (
        PARTITION BY student_id, payment_period
        ORDER BY payment_date NULLS FIRST, created_at, id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      )
    ) AS new_balance
  FROM public.financial_records
)
UPDATE public.financial_records fr
SET balance = ordered.new_balance
FROM ordered
WHERE fr.id = ordered.id;

CREATE OR REPLACE FUNCTION public.vfa_admin_save_financial_record(p_student_id uuid,p_payment_date date,p_payment_period text,p_amount_paid numeric,p_amount_due numeric)
RETURNS public.financial_records LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.financial_records; remaining numeric;
BEGIN
 IF NOT public.vfa_is_current_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 SELECT greatest(0,coalesce(p_amount_due,0)-coalesce(sum(fr.amount_paid),0)-coalesce(p_amount_paid,0)) INTO remaining
 FROM public.financial_records fr WHERE fr.student_id=p_student_id AND fr.payment_period=p_payment_period;
 INSERT INTO public.financial_records(student_id,payment_date,payment_period,amount_due,amount_paid,balance)
 VALUES(p_student_id,p_payment_date,p_payment_period,coalesce(p_amount_due,0),coalesce(p_amount_paid,0),coalesce(remaining,0)) RETURNING * INTO r;
 RETURN r;
END; $$;

CREATE OR REPLACE FUNCTION public.vfa_admin_delete_financial_record(p_record_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.vfa_is_current_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 DELETE FROM public.financial_records WHERE id=p_record_id;
END; $$;

CREATE OR REPLACE FUNCTION public.vfa_admin_save_grades(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 IF NOT public.vfa_is_current_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 INSERT INTO public.grades(student_id,subject_id,period_id,score)
 SELECT x.student_id,x.subject_id,x.period_id,x.score FROM jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) x(student_id uuid,subject_id uuid,period_id uuid,score numeric)
 ON CONFLICT(student_id,subject_id,period_id) DO UPDATE SET score=excluded.score;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END; $$;

CREATE OR REPLACE FUNCTION public.vfa_admin_save_period_results(p_rows jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n integer;
BEGIN
 IF NOT public.vfa_is_current_admin() THEN RAISE EXCEPTION 'Not authorized'; END IF;
 INSERT INTO public.student_period_results(student_id,period_id,average,rank,conduct)
 SELECT x.student_id,x.period_id,x.average,x.rank,x.conduct FROM jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) x(student_id uuid,period_id uuid,average numeric,rank integer,conduct text)
 ON CONFLICT(student_id,period_id) DO UPDATE SET average=excluded.average,rank=excluded.rank,conduct=excluded.conduct;
 GET DIAGNOSTICS n=ROW_COUNT; RETURN n;
END; $$;

REVOKE ALL ON FUNCTION public.vfa_admin_save_fee_structure(uuid,text,numeric,numeric,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vfa_admin_save_financial_record(uuid,date,text,numeric,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vfa_admin_delete_financial_record(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vfa_admin_save_grades(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.vfa_admin_save_period_results(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vfa_admin_save_fee_structure(uuid,text,numeric,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vfa_admin_save_financial_record(uuid,date,text,numeric,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vfa_admin_delete_financial_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vfa_admin_save_grades(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vfa_admin_save_period_results(jsonb) TO authenticated;
