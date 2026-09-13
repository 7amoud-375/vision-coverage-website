-- ===========================================================================
--  Migration: stop anonymous visitors listing the contents of the bucket.
--
--  Supabase's own advisor flags this: "Clients can list all files in this
--  bucket. A broad SELECT policy on storage.objects allows clients to retrieve
--  a full list of files. Public buckets don't need this."
--
--  It is right. A public bucket serves files through
--  /storage/v1/object/public/... which does not consult RLS at all, so the
--  anonymous SELECT policy bought nothing - while letting anyone call the list
--  endpoint and enumerate every filename. The files are public by URL anyway,
--  so this is not a leak of private data, but it does turn "you need the exact
--  link" into "here is the complete inventory", including work uploaded but not
--  yet published, or a file left behind after its portfolio entry was deleted.
--
--  SELECT is kept for owners, because the dashboard's storage meter needs to
--  list the bucket to add up what is stored.
--
--  Nothing on the public site changes: videos and posters load through the
--  public-URL path exactly as before.
--
--  Run this once in the Supabase SQL Editor. Safe to re-run.
-- ===========================================================================

drop policy if exists "anyone reads portfolio media" on storage.objects;
drop policy if exists "owner lists portfolio media" on storage.objects;

create policy "owner lists portfolio media"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'portfolio' and public.is_owner());

-- ---------------------------------------------------------------------------
--  Confirm. Expect:
--    anon_can_list  = 0   (the warning banner should clear)
--    owner_policies = 4   (list, upload, replace, delete)
-- ---------------------------------------------------------------------------
select
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like '%portfolio media%'
       and 'anon' = any(roles))                                as anon_can_list,
  (select count(*) from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname like '%portfolio media%')                as owner_policies;
