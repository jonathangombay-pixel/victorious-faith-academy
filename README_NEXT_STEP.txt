VFA Portal - student authentication connection

This build connects Admin > Save Students to the deployed Supabase Edge Function named bright-api.

IMPORTANT: In Supabase Edge Functions, replace bright-api/index.ts with bright-api-index.ts from this package and deploy it.
The function securely creates and deletes student Supabase Auth accounts.

The website uses the existing VFA Student ID + assigned password login. Passwords are generated once for new students and are not regenerated on reload/login.

Do not put a Supabase secret/service key in the browser.

STUDENT REGISTRATION SCHOOL FIELDS UPDATE
The student registration form now supports the school's register fields:
- Registration Date
- Sex
- Enrollment Status (New / Old)
- School Year (defaults to 2026/2027 for new records)
The permanent portal registration number remains 001, 002, 003... within each class,
and the Student ID remains 0020172 + the three-digit registration number.
Run STUDENT_REGISTRATION_SCHOOL_FIELDS.sql once in Supabase before saving students
with these new fields.
