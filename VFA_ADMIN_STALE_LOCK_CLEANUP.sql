-- ONE-TIME CLEANUP ONLY if an administrator is currently locked out because
-- an older portal build left a stale vfa_admin_session_locks row behind.
-- This does NOT disable the one-device lock. It removes only the selected
-- administrator's current lock so that account can sign in again.
-- Replace the email below with the affected administrator's email.

delete from public.vfa_admin_session_locks
where auth_user_id = (
  select auth_user_id
  from public.admin_profiles
  where lower(email) = lower('REPLACE_WITH_AFFECTED_ADMIN_EMAIL')
  limit 1
);
