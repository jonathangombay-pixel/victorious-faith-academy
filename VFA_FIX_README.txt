VFA DATABASE WRITE FIX

1. Run VFA_ADMIN_WRITE_FIX.sql once in the Supabase SQL Editor.
   This fixes Financial, Fee Structure and Report Card database writes.

2. Student records are now saved to the students table even if the student-account
   Edge Function fails. The included bright-api-index.ts is the correct function
   source for the existing bright-api function. Deploy it to the existing
   bright-api Edge Function so new student portal accounts are also created/synced.

3. Report-card layout was not changed.
4. No student records are deleted by this fix.
