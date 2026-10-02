VFA STAGE 14 — FINAL CONTROLLED BUILD

Base:
This release is rebuilt from the confirmed-working Stage 13 Financial Report build.
Only Stage 14 staff attendance/examination synchronization and the assignment student-read policy are added.

SUPABASE:
1. Run STAGE_14_ATTENDANCE_EXAM_FIX.sql in Supabase SQL Editor.
2. The migration is safe to rerun: Stage 14 policies are dropped/recreated and Stage 14 tables use IF NOT EXISTS.

STAFF / TEACHER ATTENDANCE:
- Add staff from Admin.
- The new staff member is added to the visible register immediately after a successful database insert.
- Delete removes the staff member from the visible register immediately after a successful database delete.
- Attendance supports Present, Late, and Absent.
- Attendance is one record per staff member per date and is saved to staff_attendance.

EXAMINATION TIMETABLE:
- Admin selects a class and adds/edits timetable rows.
- Empty new rows are ignored when Save Changes is clicked.
- A row with any content must have both a date and subject.
- Existing rows are updated instead of duplicated.
- After a successful save, the selected class timetable is queried back directly from Supabase and rendered.
- The save path does NOT run the unrelated full Admin refresh, so an unrelated section cannot make a successfully saved timetable disappear from the screen.
- Student timetable is read directly from exam_timetable for the student's class.

ASSIGNMENTS:
- Existing working assignment behavior is preserved.
- SQL includes the student read policy for class-targeted and All Students assignments.

DO NOT replace or rerun Stage 13 financial logic unnecessarily. This Stage 14 SQL is the only additional SQL migration for this release.
