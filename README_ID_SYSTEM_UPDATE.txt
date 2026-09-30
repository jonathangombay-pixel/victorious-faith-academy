VFA PERMANENT SCHOOL-WIDE STUDENT ID FIX

This version fixes the old per-class registration system that could create duplicate Student IDs.

Rules now enforced by Supabase:
- Registration numbers are GLOBAL across the entire school.
- #1 = 0020172001, #2 = 0020172002, #3 = 0020172003, etc.
- Moving a student to another class does not change the ID.
- Deleted registration numbers are never recycled.
- Two students cannot have the same registration number or Student ID.
- New students receive the next school-wide number even when two admins save at the same time.
- Existing students are normalized by original created_at order when the migration is run.
- auth_user_id and passwords are not changed by the SQL migration.

IMPORTANT:
1. Run STUDENT_REGISTRATION_ID_MIGRATION.sql in Supabase SQL Editor once.
2. Then log into the Admin portal once. The updated admin.js automatically synchronizes each existing student's Auth email with their repaired permanent Student ID without changing passwords.
3. Check the SQL verification result: registration numbers should be unique and sequential.

The finance save fix remains in VFA_ADMIN_WRITE_FIX.sql.
Run both SQL files: the registration migration and the admin write fix.
