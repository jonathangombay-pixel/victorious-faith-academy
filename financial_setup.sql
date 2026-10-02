-- =========================================================
-- VFA STAGE 13 — FINANCIAL REPORT / TUITION
-- Run this script in the SAME Supabase project used by the portal.
-- It is a migration: it preserves students and payment records.
-- =========================================================

-- ---------------------------------------------------------
-- 1. FEE STRUCTURES
-- One structure per class + school year.
-- Three installment amounts are stored permanently.
-- amount_due stores the total of the three installments.
-- ---------------------------------------------------------
create table if not exists public.fee_structures (
    id uuid primary key default gen_random_uuid(),
    class_id uuid not null references public.classes(id) on delete cascade,
    school_year text not null,
    first_payment numeric(12,2) not null default 0 check (first_payment >= 0),
    second_payment numeric(12,2) not null default 0 check (second_payment >= 0),
    third_payment numeric(12,2) not null default 0 check (third_payment >= 0),
    amount_due numeric(12,2) not null default 0 check (amount_due >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint fee_structures_class_year_unique unique (class_id, school_year)
);

alter table public.fee_structures add column if not exists first_payment numeric(12,2) not null default 0;
alter table public.fee_structures add column if not exists second_payment numeric(12,2) not null default 0;
alter table public.fee_structures add column if not exists third_payment numeric(12,2) not null default 0;
alter table public.fee_structures add column if not exists amount_due numeric(12,2) not null default 0;
alter table public.fee_structures add column if not exists created_at timestamptz not null default now();
alter table public.fee_structures add column if not exists updated_at timestamptz not null default now();

-- If an earlier Stage 13 attempt created only amount_due, keep that value
-- as the first saved installment instead of losing the configured amount.
update public.fee_structures
set first_payment = case
        when coalesce(first_payment,0)=0 and coalesce(amount_due,0)>0
        then amount_due else coalesce(first_payment,0) end,
    second_payment = coalesce(second_payment,0),
    third_payment = coalesce(third_payment,0)
where coalesce(first_payment,0)=0
  and coalesce(second_payment,0)=0
  and coalesce(third_payment,0)=0
  and coalesce(amount_due,0)>0;

update public.fee_structures
set amount_due = coalesce(first_payment,0)+coalesce(second_payment,0)+coalesce(third_payment,0);

alter table public.fee_structures enable row level security;

drop policy if exists "VFA admins manage fee structures" on public.fee_structures;
drop policy if exists "VFA students read own class fee structure" on public.fee_structures;

create policy "VFA admins manage fee structures"
on public.fee_structures
for all to authenticated
using (public.vfa_is_current_admin())
with check (public.vfa_is_current_admin());

create policy "VFA students read own class fee structure"
on public.fee_structures
for select to authenticated
using (
    exists (
        select 1
        from public.students s
        where s.class_id = fee_structures.class_id
          and s.school_year = fee_structures.school_year
          and s.auth_user_id = auth.uid()
          and s.is_active = true
    )
);

-- ---------------------------------------------------------
-- 2. FINANCIAL RECORDS
-- Payments remain individual permanent ledger records.
-- ---------------------------------------------------------
alter table public.financial_records add column if not exists school_year text;
alter table public.financial_records add column if not exists record_date date;
alter table public.financial_records add column if not exists description text;
alter table public.financial_records add column if not exists amount_due numeric(12,2) default 0;
alter table public.financial_records add column if not exists amount_paid numeric(12,2) default 0;

update public.financial_records fr
set school_year = s.school_year
from public.students s
where fr.student_id = s.id
  and fr.school_year is null;

update public.financial_records set amount_due=0 where amount_due is null;
update public.financial_records set amount_paid=0 where amount_paid is null;

-- The row balance is the balance associated with that ledger entry.
-- The portal calculates the student's overall balance from the saved
-- class fee structure minus all saved payments.
alter table public.financial_records drop column if exists balance;
alter table public.financial_records add column balance numeric(12,2)
generated always as (coalesce(amount_due,0)-coalesce(amount_paid,0)) stored;

alter table public.financial_records enable row level security;

drop policy if exists "VFA admins manage financial records" on public.financial_records;
drop policy if exists "VFA students read own financial records" on public.financial_records;

create policy "VFA admins manage financial records"
on public.financial_records
for all to authenticated
using (public.vfa_is_current_admin())
with check (public.vfa_is_current_admin());

create policy "VFA students read own financial records"
on public.financial_records
for select to authenticated
using (
    exists (
        select 1
        from public.students s
        where s.id = financial_records.student_id
          and s.auth_user_id = auth.uid()
          and s.is_active = true
    )
);

-- ---------------------------------------------------------
-- 3. TIMESTAMP TRIGGERS
-- ---------------------------------------------------------
drop trigger if exists fee_structures_updated_at on public.fee_structures;
create trigger fee_structures_updated_at
before update on public.fee_structures
for each row execute function public.vfa_set_updated_at();

drop trigger if exists financial_records_updated_at on public.financial_records;
create trigger financial_records_updated_at
before update on public.financial_records
for each row execute function public.vfa_set_updated_at();

-- ---------------------------------------------------------
-- 4. GRANTS
-- ---------------------------------------------------------
grant select, insert, update, delete on public.fee_structures to authenticated;
grant select, insert, update, delete on public.financial_records to authenticated;

-- =========================================================
-- END STAGE 13 FINANCIAL MIGRATION
-- =========================================================
