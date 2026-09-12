-- ===========================================================================
--  Migration: make the About section editable from the dashboard.
--
--  The portrait and the equipment/style highlights lived in src/lib/config.js,
--  which meant changing them needed a code edit and a redeploy. They move into
--  the database so the owner can edit them himself.
--
--  Single row by design: `check (id = 1)` makes a second row impossible, so
--  there is never a question of which one the site should render. The dashboard
--  upserts onto id = 1.
--
--  The site still falls back to the values in config.js when this table is
--  empty, so nothing breaks before the first save.
--
--  Run this once in the Supabase SQL Editor. Safe to re-run.
-- ===========================================================================

create table if not exists public.about_content (
  id          smallint primary key default 1 check (id = 1),
  photo_url   text,
  -- [{ "label": "Cameras", "value": "Sony FX3 + a7 IV" }, ...]
  -- jsonb rather than columns so rows can be added and removed, not just
  -- retitled - four is today's number, not a rule.
  highlights  jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.about_content drop constraint if exists about_photo_len;
alter table public.about_content drop constraint if exists about_highlights_shape;

alter table public.about_content
  add constraint about_photo_len check (
    photo_url is null or char_length(photo_url) <= 500
  );

-- Must be a JSON array, and small enough that the public page cannot be made
-- to download something huge.
alter table public.about_content
  add constraint about_highlights_shape check (
    jsonb_typeof(highlights) = 'array'
    and char_length(highlights::text) <= 4000
  );

-- ---------------------------------------------------------------------------
--  Seed with what the site currently shows, so the dashboard opens populated
--  rather than blank.
-- ---------------------------------------------------------------------------
insert into public.about_content (id, photo_url, highlights)
values (
  1,
  null,
  '[
    {"label": "Cameras", "value": "Sony FX3 + a7 IV, dual-body coverage"},
    {"label": "Glass",   "value": "Fast primes - 24mm, 35mm, 50mm, 85mm"},
    {"label": "Audio",   "value": "Wireless lavs and a dedicated recorder"},
    {"label": "Style",   "value": "Documentary, warm grade, minimal direction"}
  ]'::jsonb
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
--  Row Level Security. Readable by everyone (it is public page content),
--  writable only by an owner - the same rule as every other table.
-- ---------------------------------------------------------------------------
alter table public.about_content enable row level security;

drop policy if exists "anyone reads about"   on public.about_content;
drop policy if exists "owner writes about"   on public.about_content;
drop policy if exists "owner updates about"  on public.about_content;

create policy "anyone reads about"
  on public.about_content for select to anon, authenticated using (true);

create policy "owner writes about"
  on public.about_content for insert to authenticated with check (public.is_owner());

create policy "owner updates about"
  on public.about_content for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

-- ---------------------------------------------------------------------------
--  Realtime, so an edit reaches an open public page without a refresh.
-- ---------------------------------------------------------------------------
do $realtime$
begin
  begin
    alter publication supabase_realtime add table public.about_content;
  exception when duplicate_object then null;
  end;
end
$realtime$;

-- ---------------------------------------------------------------------------
--  Confirm
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.about_content)                          as rows_should_be_1,
  (select jsonb_array_length(highlights) from public.about_content)    as highlight_count,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'about_content')      as policies,
  (select count(*) from pg_publication_tables
     where pubname = 'supabase_realtime' and tablename = 'about_content') as realtime;
