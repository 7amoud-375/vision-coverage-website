-- ===========================================================================
--  Migration: social links become editable from the dashboard.
--
--  They lived in environment variables, which meant changing one needed a
--  redeploy - and an unset variable silently hid the icon. They move into the
--  database so the owner can manage them himself.
--
--  A single row holding a jsonb array rather than one row per link, for the
--  same reason as about_content: supabase-js has no transaction, so saving a
--  list as separate rows would mean delete-all-then-insert-all, and a failure
--  halfway would lose every link. One atomic update cannot half-succeed.
--
--  Run this once in the Supabase SQL Editor. Safe to re-run.
-- ===========================================================================

create table if not exists public.site_contact (
  id         smallint primary key default 1 check (id = 1),
  -- [{ "platform": "instagram", "url": "https://instagram.com/..." }, ...]
  socials    jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_contact drop constraint if exists site_contact_socials_shape;

alter table public.site_contact
  add constraint site_contact_socials_shape check (
    jsonb_typeof(socials) = 'array'
    and char_length(socials::text) <= 3000
  );

insert into public.site_contact (id, socials)
values (1, '[]'::jsonb)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
--  Row Level Security: public page content, so anyone reads, only an owner
--  writes - the same rule as every other table.
-- ---------------------------------------------------------------------------
alter table public.site_contact enable row level security;

drop policy if exists "anyone reads contact"  on public.site_contact;
drop policy if exists "owner writes contact"  on public.site_contact;
drop policy if exists "owner updates contact" on public.site_contact;

create policy "anyone reads contact"
  on public.site_contact for select to anon, authenticated using (true);

create policy "owner writes contact"
  on public.site_contact for insert to authenticated with check (public.is_owner());

create policy "owner updates contact"
  on public.site_contact for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
--  Realtime, so an edit reaches an open page without a refresh.
-- ---------------------------------------------------------------------------
do $realtime$
begin
  begin
    alter publication supabase_realtime add table public.site_contact;
  exception when duplicate_object then null;
  end;
end
$realtime$;

-- ---------------------------------------------------------------------------
--  Confirm
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.site_contact)                              as rows_should_be_1,
  (select jsonb_array_length(socials) from public.site_contact)           as links_now,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'site_contact')          as policies,
  (select count(*) from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'site_contact')  as realtime;
