VFA PORTAL — STAGE 13 FINANCIAL TEST BUILD
===========================================

This ZIP is the complete Stage 13 build based on the Stage 12 Report Card build.
Existing authentication, student creation/login, Students, and Report Card code are preserved.

STAGE 13 CHANGES
-----------------
1. Fee structures are stored permanently in Supabase by class + school year.
2. Fee structures can be updated with Save Fee Structure (upsert).
3. Daycare uses the exact class name “Daycare” in the Financial class filter.
4. Payments are stored permanently in public.financial_records.
5. Admin Financial Records calculate total fees, total paid, and balance from the saved class fee structure and that student's payments.
6. Student Financial Report reads only the authenticated student's financial_records and that student's class/year fee structure.

SUPABASE SETUP
--------------
Run financial_setup.sql in the SAME Supabase project used by this portal.
The script is a migration and preserves existing students/payment records.

IMPORTANT
---------
- Do not replace the Students, authentication, or Report Card files with an older build.
- The browser uses only the Supabase publishable key.
- Student Auth accounts are still created by the included bright-api Edge Function.
- Do not put a Supabase service-role key in any browser file.

FINANCIAL TEST
--------------
A. Run financial_setup.sql in Supabase.
B. Open admin.html and sign in with an existing VFA administrator account.
C. Open Financial Records.
D. Select Daycare and confirm Daycare students appear.
E. Enter the 1st, 2nd and 3rd payment amounts and click Save Fee Structure.
F. Change one installment amount and save again to verify the same class/year structure updates.
G. Open a student, record a payment, refresh the page, and confirm the payment remains.
H. Confirm Total Fees, Total Paid, and Balance update correctly.
I. Log in as a student and open Financial Report. Confirm only that student's saved payment records are displayed.
