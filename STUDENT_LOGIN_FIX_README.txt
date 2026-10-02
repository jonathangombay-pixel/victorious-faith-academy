VFA STUDENT LOGIN FIX

This build keeps student and admin authentication separate.

Student login flow:
1. Student enters their assigned Student ID and password.
2. The ID is converted to the same internal student Auth email used by bright-api.
3. Any previous Supabase session is cleared first.
4. Supabase Auth signs in the student account.
5. The authenticated user is matched to students.auth_user_id.
6. The student dashboard opens only after that match succeeds.

IMPORTANT TEST ORDER:
1. Deploy the current bright-api Edge Function in the fresh Supabase project.
2. Log in to the Admin Portal.
3. Open Students and click Save Students for the test student.
4. Confirm the save succeeds. This creates/links the student's Auth account.
5. Open the student login page in a fresh/private browser window and use the exact Student ID and password shown by the admin portal.

The service-worker cache was bumped to v3 and the login script has a cache-busting query so browsers do not keep the old student-login code.


IMPORTANT FIX (2026-10-01): Save Students now calls bright-api after the student row is inserted/updated. Previously the database row could be saved without creating the student Supabase Auth account, which caused "Incorrect Student ID or password." The login email normalization now exactly matches bright-api.
