-- ===========================================================================
--  Migration: the owner uploads video files directly, from his phone gallery
--  or his laptop. Instagram links become optional rather than the only way in.
--
--  READ THIS BEFORE GOING LIVE
--  Supabase's free tier is 1 GB of storage and 5 GB of egress per month.
--  Storage is not the constraint: at ~20 MB a clip that is roughly 50 videos.
--  EGRESS IS. 5 GB / 20 MB is about 250 video plays per month in total, across
--  every visitor. The app is built to protect that budget - the gallery shows
--  only poster images, and a video file is fetched solely when someone presses
--  play - but if this site gets busy, video needs to move to something built
--  for it (Cloudflare R2 or Stream, Bunny, or an unlisted YouTube/Vimeo embed).
--  Watch Reports -> Egress in the dashboard.
--
--  Run this once in the Supabase SQL Editor. Safe to re-run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  1. Columns
--     video_url     - the uploaded file (preferred)
--     thumbnail_url - poster frame, captured from the video in the browser
--     instagram_url - now optional, so existing rows keep working
-- ---------------------------------------------------------------------------
alter table public.portfolio_items add column if not exists video_url     text;
alter table public.portfolio_items add column if not exists thumbnail_url text;
alter table public.portfolio_items alter column instagram_url drop not null;

-- The old constraint required an Instagram URL shape on every row; it has to
-- tolerate null now that uploads are the main path.
alter table public.portfolio_items drop constraint if exists portfolio_url_shape;
alter table public.portfolio_items drop constraint if exists portfolio_media_present;

do $migrate$
begin
  alter table public.portfolio_items
    add constraint portfolio_url_shape check (
      instagram_url is null
      or instagram_url ~ '^https://www\.instagram\.com/(p|reel|tv)/[A-Za-z0-9_-]+/$'
    ),
    add constraint portfolio_video_len check (
      video_url is null or char_length(video_url) <= 500
    ),
    add constraint portfolio_thumb_len check (
      thumbnail_url is null or char_length(thumbnail_url) <= 500
    ),
    -- An item with neither a video nor an Instagram link has nothing to show.
    add constraint portfolio_media_present check (
      video_url is not null or instagram_url is not null
    );
exception when duplicate_object then null;
end
$migrate$;

-- ---------------------------------------------------------------------------
--  2. Bucket
--     Public read so the site can stream without signed URLs. 50 MB ceiling
--     (the free tier's own per-file maximum) and an explicit MIME allow-list,
--     so this cannot quietly become a dumping ground for arbitrary files.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portfolio',
  'portfolio',
  true,
  52428800,                                             -- 50 MB
  array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ]
)
on conflict (id) do update set
  public             = true,
  file_size_limit    = 52428800,
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp',
    'video/mp4', 'video/quicktime', 'video/webm'
  ];

-- ---------------------------------------------------------------------------
--  3. Who can write to it
--     Same ownership rule as every other table: membership of public.admins,
--     not merely being signed in. Visitors read; only the owner writes.
-- ---------------------------------------------------------------------------
drop policy if exists "anyone reads portfolio media" on storage.objects;
create policy "anyone reads portfolio media"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'portfolio');

drop policy if exists "owner uploads portfolio media" on storage.objects;
create policy "owner uploads portfolio media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'portfolio' and public.is_owner());

drop policy if exists "owner replaces portfolio media" on storage.objects;
create policy "owner replaces portfolio media"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'portfolio' and public.is_owner())
  with check (bucket_id = 'portfolio' and public.is_owner());

drop policy if exists "owner deletes portfolio media" on storage.objects;
create policy "owner deletes portfolio media"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'portfolio' and public.is_owner());

-- Retire the earlier image-only policy names, if that migration was run first.
drop policy if exists "anyone reads portfolio images"  on storage.objects;
drop policy if exists "owner uploads portfolio images" on storage.objects;
drop policy if exists "owner replaces portfolio images" on storage.objects;
drop policy if exists "owner deletes portfolio images" on storage.objects;

-- ---------------------------------------------------------------------------
--  4. Confirm
-- ---------------------------------------------------------------------------
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='portfolio_items'
      and column_name in ('video_url','thumbnail_url'))            as new_columns,
  (select is_nullable from information_schema.columns
    where table_schema='public' and table_name='portfolio_items'
      and column_name='instagram_url')                             as instagram_optional,
  (select file_size_limit from storage.buckets where id='portfolio') as max_bytes,
  (select count(*) from pg_policies
    where schemaname='storage' and tablename='objects'
      and policyname like '%portfolio media%')                     as storage_policies;
