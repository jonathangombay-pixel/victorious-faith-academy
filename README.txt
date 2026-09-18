Victorious Faith Academy Portal - demo


This is the Victorious Faith Academy school portal. Authentication and school records are handled through Supabase.


PASSWORD FIX
Before testing new student accounts, run ADD_STUDENT_PASSWORD_COLUMN.sql in Supabase SQL Editor.
Student passwords are generated once for new students, saved with the student record, and loaded unchanged after logout/login.
