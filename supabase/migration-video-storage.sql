-- ===========================================================================
--  ONE migration to run. Supersedes migration-video-upload.sql and
--  migration-storage-budget.sql (both deleted).
--
--  Sets up direct video upload from the owner's own files:
--    * video_url / thumbnail_url columns, instagram_url becomes optional
--    * a 'portfolio' storage bucket with NO per-file limit of our own
--    * owner-only write policies, public read
--
--  PER-FILE SIZE
--  file_size_limit is left null, meaning "inherit the project limit". On the
--  free plan that is 50 MB per upload - a plan ceiling that cannot be raised
--  from here (the setting lives under Storage -> Settings, and the free plan
--  caps what can be entered). Upgrading to Pro raises it and this bucket
--  follows automatically, with no change here.
--
--  TOTAL SIZE
--  The 800 MB budget is enforced in the dashboard, not in SQL: Postgres has no
--  per-bucket quota, so the app adds up what is stored, warns from 80%, and
--  refuses an upload that would cross the line. The free plan allows 1 GB in
--  total, so 800 MB leaves deliberate headroom.
--
--  Safe to re-run. Each constraint is added on its own, so one that already
--  exists cannot cause the others to be skipped.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  1. Columns
-- ---------------------------------------------------------------------------
alter table public.portfolio_items add column if not exists video_url     text;
alter table public.portfolio_items add column if not exists thumbnail_url text;
alter table public.portfolio_items alter column instagram_url drop not null;

-- The original constraint demanded an Instagram URL on every row; it has to
-- tolerate null now that uploads are the main path.
alter table public.portfolio_items drop constraint if exists portfolio_url_shape;
alter table public.portfolio_items drop constraint if exists portfolio_media_present;
alter table public.portfolio_items drop constraint if exists portfolio_video_len;
alter table public.portfolio_items drop constraint if exists portfolio_thumb_len;
alter table public.portfolio_items drop constraint if exists portfolio_thumb_shape;

alter table public.portfolio_items
  add constraint portfolio_url_shape check (
    instagram_url is null
    or instagram_url ~ '^https://www\.instagram\.com/(p|reel|tv)/[A-Za-z0-9_-]+/$'
  );

alter table public.portfolio_items
  add constraint portfolio_video_len check (
    video_url is null or char_length(video_url) <= 500
  );

alter table public.portfolio_items
  add constraint portfolio_thumb_len check (
    thumbnail_url is null or char_length(thumbnail_url) <= 500
  );

-- An item with neither an uploaded video nor an Instagram link has nothing to
-- show on the site.
alter table public.portfolio_items
  add constraint portfolio_media_present check (
    video_url is not null or instagram_url is not null
  );

-- ---------------------------------------------------------------------------
--  2. Bucket
--     Public read so the site can stream without signed URLs. No size limit of
--     our own. The MIME allow-list stays: it is not about size, it stops the
--     bucket quietly becoming a home for arbitrary files.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio',
  'portfolio',
  true,
  null,
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = null,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ];

-- ---------------------------------------------------------------------------
--  3. Who can write to it
--     Same ownership rule as every table: membership of public.admins, not
--     merely being signed in. Visitors read; only the owner writes.
-- ---------------------------------------------------------------------------
drop policy if exists "anyone reads portfolio media"   on storage.objects;
drop policy if exists "owner uploads portfolio media"  on storage.objects;
drop policy if exists "owner replaces portfolio media" on storage.objects;
drop policy if exists "owner deletes portfolio media"  on storage.objects;
-- Retire the earlier image-only names, in case that version was ever applied.
drop policy if exists "anyone reads portfolio images"   on storage.objects;
drop policy if exists "owner uploads portfolio images"  on storage.objects;
drop policy if exists "owner replaces portfolio images" on storage.objects;
drop policy if exists "owner deletes portfolio images"  on storage.objects;

create policy "anyone reads portfolio media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'portfolio');

create policy "owner uploads portfolio media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portfolio' and public.is_owner());

create policy "owner replaces portfolio media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'portfolio' and public.is_owner())
  with check (bucket_id = 'portfolio' and public.is_owner());

create policy "owner deletes portfolio media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'portfolio' and public.is_owner());

-- ---------------------------------------------------------------------------
--  4. Confirm - every value here should be non-zero / as described
-- ---------------------------------------------------------------------------
select
  (select count(*) from storage.buckets where id = 'portfolio')        as bucket_exists,
  (select public from storage.buckets where id = 'portfolio')          as is_public,
  (select file_size_limit from storage.buckets where id = 'portfolio') as per_file_limit_null_means_plan,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like '%portfolio media%')                        as storage_policies,
  (select count(*) from information_schema.columns
     where table_schema = 'public' and table_name = 'portfolio_items'
       and column_name in ('video_url', 'thumbnail_url'))              as new_columns,
  (select is_nullable from information_schema.columns
     where table_schema = 'public' and table_name = 'portfolio_items'
       and column_name = 'instagram_url')                              as instagram_optional,
  (select count(*) from public.admins)                                 as owners;
