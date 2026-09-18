VFA PERMANENT STUDENT REGISTRATION NUMBER UPDATE

Student numbers are now permanent within each class.

Example:
Daniel registered first -> 0020172001
Andrew registered second -> 0020172002
Aaron registered third -> 0020172003

Adding a student never renumbers existing students.
Deleting a student never renumbers or recycles an existing registration number.
The Students tab can sort the current class by:
1. Alphabetical (A-Z)
2. Registration Number (001-999)

The Supabase migration is in STUDENT_REGISTRATION_ID_MIGRATION.sql.
The classes table requires sort_order, so the migration supplies the required values.
