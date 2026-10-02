-- VFA_ADMIN_SINGLE_SESSION_LOCK.sql
-- Run this ONCE in the Supabase SQL Editor.
-- It prevents one VFA administrator account from being active on two different browsers/devices.

create table if not exists public.vfa_admin_session_locks (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  session_key text not null,
  locked_at timestamptz not null default now()
);

revoke all on table public.vfa_admin_session_locks from anon, authenticated;
alter table public.vfa_admin_session_locks enable row level security;

create or replace function public.vfa_acquire_admin_session(p_session_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  existing_key text;
  admin_active boolean;
begin
  if uid is null then
    raise exception 'You must be signed in as a VFA administrator.' using errcode = '42501';
  end if;

  if p_session_key is null or length(trim(p_session_key)) < 16 then
    raise exception 'Invalid administrator session key.' using errcode = '22023';
  end if;

  select is_active into admin_active
  from public.admin_profiles
  where auth_user_id = uid
  limit 1;

  if coalesce(admin_active, false) = false then
    raise exception 'This account is not linked to an active VFA administrator.' using errcode = '42501';
  end if;

  select session_key into existing_key
  from public.vfa_admin_session_locks
  where auth_user_id = uid
  for update;

  if existing_key is not null and existing_key <> p_session_key then
    raise exception 'This VFA administrator account is already signed in on another device. Please log out there before signing in here.' using errcode = 'P0001';
  end if;

  insert into public.vfa_admin_session_locks(auth_user_id, session_key, locked_at)
  values(uid, p_session_key, now())
  on conflict (auth_user_id) do update
    set session_key = excluded.session_key, locked_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.vfa_release_admin_session(p_session_key text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    return jsonb_build_object('ok', false);
  end if;

  delete from public.vfa_admin_session_locks
  where auth_user_id = uid and session_key = p_session_key;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.vfa_acquire_admin_session(text) from public, anon;
grant execute on function public.vfa_acquire_admin_session(text) to authenticated;
revoke all on function public.vfa_release_admin_session(text) from public, anon;
grant execute on function public.vfa_release_admin_session(text) to authenticated;
