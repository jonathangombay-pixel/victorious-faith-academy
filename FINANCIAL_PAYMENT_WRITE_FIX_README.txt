VFA FINANCIAL PAYMENT WRITE FIX

1. Replace your portal files with this ZIP.
2. In Supabase SQL Editor, run VFA_ADMIN_WRITE_FIX.sql from this ZIP.
3. The SQL converts financial_records.balance from a generated column to a normal numeric column when necessary, keeps a default of 0, rebuilds existing running balances, and installs the admin RPC used by Record Payment.
4. Do not delete financial_records. Do not change student login/auth.

After the SQL is run:
Admin -> Finance -> class -> student -> Open Sheet -> Record Payment -> Save Payment
will write payment_date, payment_period, amount_due, amount_paid, and the calculated running balance to Supabase.

Multiple payments for the same installment are supported. The student portal reads the saved financial_records rows and calculates the installment balance from real payments.
