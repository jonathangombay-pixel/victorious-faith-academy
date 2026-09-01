-- VFA Scale Your Child: exactly five editable checkbox statements
create table if not exists public.scale_settings (
  id integer primary key check (id = 1),
  statements jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.scale_settings (id, statements)
values (1, '["Shows good effort","Completes assignments","Participates in class","Works well with others","Needs additional academic support"]'::jsonb)
on conflict (id) do nothing;

alter table public.scale_settings enable row level security;

drop policy if exists "Authenticated users can read scale statements" on public.scale_settings;
create policy "Authenticated users can read scale statements"
on public.scale_settings for select to authenticated using (true);

drop policy if exists "Admins manage scale statements" on public.scale_settings;
create policy "Admins manage scale statements"
on public.scale_settings for all to authenticated
using (exists (select 1 from public.admin_profiles ap where ap.auth_user_id = auth.uid()))
with check (exists (select 1 from public.admin_profiles ap where ap.auth_user_id = auth.uid()));
