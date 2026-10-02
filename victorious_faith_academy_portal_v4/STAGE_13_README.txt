VFA — STAGE 13 COMPLETE BUILD
Financial Report / Tuition

BASE
----
Built from the Stage 12 Fixed Report Card project.

PRESERVED
---------
- Admin authentication
- Student creation and student portal authentication
- Students tab
- Report Card subject order and existing Report Card behavior
- Existing Supabase/Edge Function integration

STAGE 13 FINANCIAL WORK
-----------------------
- Fee structures persist in Supabase by class + school year.
- Fee structures can be updated with Save Fee Structure.
- Daycare appears under the exact class name used by the Students records.
- Payments persist in Supabase financial_records.
- Payments are tagged with school year.
- Admin totals calculate fees, paid amount, and balance from the selected class/year fee structure and the selected student's saved payments.
- Student Financial Report is restricted to the authenticated student's financial_records and that student's class/year fee structure.

SUPABASE
--------
Run financial_setup.sql once in the same Supabase project used by this portal.
The SQL is a migration and preserves existing student/payment rows.

TEST ORDER
----------
1. Run financial_setup.sql.
2. Open admin.html and log in.
3. Financial Records → select Daycare.
4. Confirm Daycare students appear.
5. Save a Daycare fee structure.
6. Change an installment and save again to verify update behavior.
7. Open a student and record a payment.
8. Refresh the admin page and verify the payment remains.
9. Verify Total Fees, Total Paid, and Balance.
10. Log in as that student and open Financial Report; only that student's records should appear.
