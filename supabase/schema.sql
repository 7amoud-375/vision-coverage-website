-- ===========================================================================
--  Media Coverage - Supabase schema
--  Paste this whole file into the Supabase SQL Editor and run it once.
--  Safe to re-run, and safe to run over the first version of this schema.
--
--  SHAPE OF THE DESIGN
--  Two private tables hold the real data:
--      bookings       - client requests, with names and phone numbers
--      blocked_dates  - days the owner took off by hand, with private notes
--  Both mirror into one public table by trigger:
--      unavailable_dates - bare dates, nothing else
--
--  The anon key ships inside the JavaScript bundle, so anything a visitor's
--  key can read is effectively public. The calendar needs to know which days
--  are gone; it must never learn who booked them or why. That is the whole
--  reason for the split.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  0. Who is allowed to run the dashboard
--
--  Supabase lets anybody sign up with the anon key by default, so a policy
--  written as "to authenticated" means "to anyone who registers". Every owner
--  policy below therefore checks membership of this table instead.
--
--  It carries NO policies of its own, so with RLS on it is unreachable from
--  the browser entirely - rows can only be added from the SQL editor or with
--  the service role key. See the README for the one INSERT you need to run.
-- ---------------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  added_at   timestamptz not null default now()
);

alter table public.admins enable row level security;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (select 1 from public.admins a where a.user_id = auth.uid());
$function$;

-- The dashboard calls this over RPC to tell "signed in" apart from "allowed
-- in", so it can explain itself instead of rendering empty tabs.
grant execute on function public.is_owner() to anon, authenticated;

-- ---------------------------------------------------------------------------
--  1. bookings  (PRIVATE - contains client contact details)
--     Visitors may INSERT a pending request but may NEVER read this table.
-- ---------------------------------------------------------------------------
create table if not exists public.bookings (
  id          uuid primary key default gen_random_uuid(),
  date        date not null,
  client_name text not null,
  phone       text not null,
  event_type  text not null,
  location    text not null,
  notes       text,
  status      text not null default 'pending'
              check (status in ('pending', 'confirmed', 'rejected')),
  created_at  timestamptz not null default now()
);

-- Length caps. Without these an anonymous visitor can post megabytes per row
-- and fill the free tier; `text` on its own is unbounded.
do $migrate$
begin
  alter table public.bookings
    add constraint bookings_client_name_len check (char_length(client_name) between 2 and 120),
    add constraint bookings_phone_len       check (char_length(phone) between 6 and 32),
    add constraint bookings_event_type_ok   check (event_type in ('Wedding', 'Corporate', 'Other')),
    add constraint bookings_location_len    check (char_length(location) between 2 and 200),
    add constraint bookings_notes_len       check (notes is null or char_length(notes) <= 2000);
exception when duplicate_object then null;
end
$migrate$;

create index if not exists bookings_date_idx   on public.bookings (date);
create index if not exists bookings_status_idx on public.bookings (status);

-- The real defence against double booking. Two visitors can open the same free
-- day at the same moment; this makes it physically impossible for both inserts
-- to survive, regardless of what any trigger or application code does.
create unique index if not exists bookings_one_active_per_date
  on public.bookings (date)
  where status in ('pending', 'confirmed');

-- ---------------------------------------------------------------------------
--  2. blocked_dates  (PRIVATE - the owner's own days off)
--     The note is genuinely private: "hospital appointment", "shooting for a
--     competitor". In the first version of this schema the note lived on the
--     public table, so anyone could read it straight off the REST endpoint
--     while the dashboard promised "only you can see this".
-- ---------------------------------------------------------------------------
create table if not exists public.blocked_dates (
  date       date primary key,
  note       text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
--  3. unavailable_dates  (PUBLIC - the only calendar data visitors can read)
--     Entirely derived: no client, not even the signed-in owner, writes to it.
--     The triggers below are the sole authors.
-- ---------------------------------------------------------------------------
create table if not exists public.unavailable_dates (
  date   date primary key,
  source text not null check (source in ('booking', 'manual'))
);

-- Migration from the first version of this file, which kept private columns
-- on the public table.
alter table public.unavailable_dates drop column if exists note;
alter table public.unavailable_dates drop column if exists booking_id;
alter table public.unavailable_dates drop column if exists created_at;

-- ---------------------------------------------------------------------------
--  4. portfolio_items  (PUBLIC read, owner-only write)
-- ---------------------------------------------------------------------------
create table if not exists public.portfolio_items (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  category      text not null default 'Event'
                check (category in ('Wedding', 'Corporate', 'Event')),
  description   text,
  instagram_url text not null,
  created_at    timestamptz not null default now()
);

do $migrate$
begin
  alter table public.portfolio_items
    add constraint portfolio_title_len check (char_length(title) between 1 and 140),
    add constraint portfolio_desc_len  check (description is null or char_length(description) <= 1000),
    add constraint portfolio_url_len   check (char_length(instagram_url) <= 300),
    add constraint portfolio_url_shape  check (instagram_url ~ '^https://www\.instagram\.com/(p|reel|tv)/[A-Za-z0-9_-]+/$');
exception when duplicate_object then null;
end
$migrate$;

create index if not exists portfolio_items_created_idx
  on public.portfolio_items (created_at desc);

-- ===========================================================================
--  Deriving unavailable_dates
--
--  One function decides, from scratch, whether a given day belongs in the
--  public table. Every trigger just calls it for the dates it touched.
--
--  The first version of this schema instead inserted "on conflict do nothing"
--  and deleted by booking id, which had a reachable data-integrity bug: reject
--  booking A, let booking B take the day, then restore A. A's insert silently
--  lost the conflict, so rejecting B later freed a day that A still held as
--  confirmed - two clients, one wedding. Recomputing from current state cannot
--  drift like that, whatever order things happen in.
-- ===========================================================================
create or replace function public.refresh_unavailable_date(target date)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if exists (select 1 from public.blocked_dates b where b.date = target) then
    insert into public.unavailable_dates (date, source)
    values (target, 'manual')
    on conflict (date) do update set source = 'manual';

  elsif exists (
    select 1 from public.bookings bk
    where bk.date = target and bk.status in ('pending', 'confirmed')
  ) then
    insert into public.unavailable_dates (date, source)
    values (target, 'booking')
    on conflict (date) do update set source = 'booking';

  else
    delete from public.unavailable_dates u where u.date = target;
  end if;
end;
$function$;

create or replace function public.sync_unavailable_dates()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Recompute both sides, so an UPDATE that moves a booking to another day
  -- releases the day it left.
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.refresh_unavailable_date(old.date);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform public.refresh_unavailable_date(new.date);
  end if;

  return null; -- after trigger
end;
$function$;

drop trigger if exists bookings_sync_availability_trg on public.bookings;
create trigger bookings_sync_availability_trg
  after insert or update or delete on public.bookings
  for each row execute function public.sync_unavailable_dates();

drop trigger if exists blocked_dates_sync_trg on public.blocked_dates;
create trigger blocked_dates_sync_trg
  after insert or update or delete on public.blocked_dates
  for each row execute function public.sync_unavailable_dates();

-- ===========================================================================
--  Guarding new requests
-- ===========================================================================
create or replace function public.bookings_guard_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  pending_for_phone int;
begin
  -- The visitor's "today" is computed in their own timezone; current_date here
  -- is the database's, which Supabase runs in UTC. A client in Los Angeles at
  -- 6pm is already on tomorrow's UTC date, and a strict comparison rejected
  -- their same-day booking outright. No real timezone is more than 14 hours
  -- from UTC, so one day of slack makes the server bound safe everywhere while
  -- the browser still enforces the exact local rule.
  if new.date < current_date - 1 then
    raise exception 'DATE_IN_PAST'
      using hint = 'Bookings cannot be made for past dates.';
  end if;

  -- Bound how far ahead anyone can reach. Without this a script can insert one
  -- row per day for the next century and brick the calendar permanently.
  if new.date > current_date + interval '18 months' then
    raise exception 'DATE_TOO_FAR'
      using hint = 'Please get in touch directly for dates more than 18 months away.';
  end if;

  if exists (select 1 from public.unavailable_dates u where u.date = new.date) then
    raise exception 'DATE_UNAVAILABLE'
      using hint = 'That date has already been reserved or blocked.';
  end if;

  -- Crude but effective flood brake: one caller cannot hold the whole diary
  -- open. Combined with the unique index above (one active booking per date)
  -- and the 18-month window, filling the calendar now needs a large pool of
  -- distinct phone numbers rather than a single loop.
  --
  -- This is a mitigation, not a solution. A public booking form really wants a
  -- CAPTCHA - see the README for wiring Cloudflare Turnstile through an Edge
  -- Function if this ever gets abused in earnest.
  select count(*) into pending_for_phone
  from public.bookings b
  where b.phone = new.phone and b.status = 'pending';

  if pending_for_phone >= 3 then
    raise exception 'TOO_MANY_PENDING'
      using hint = 'You already have several requests awaiting confirmation.';
  end if;

  return new;
end;
$function$;

drop trigger if exists bookings_guard_available_trg on public.bookings;
drop trigger if exists bookings_guard_request_trg on public.bookings;
-- Retire the first version's functions so they cannot be called by a stale
-- trigger left behind on a database that already ran it.
drop function if exists public.bookings_guard_available() cascade;
drop function if exists public.bookings_sync_availability() cascade;
create trigger bookings_guard_request_trg
  before insert on public.bookings
  for each row execute function public.bookings_guard_request();

-- ===========================================================================
--  Row Level Security
-- ===========================================================================
alter table public.bookings          enable row level security;
alter table public.blocked_dates     enable row level security;
alter table public.unavailable_dates enable row level security;
alter table public.portfolio_items   enable row level security;

-- Clean up the first version's policies, which granted every signed-in user
-- full access to client contact details.
drop policy if exists "owner reads bookings"        on public.bookings;
drop policy if exists "owner updates bookings"      on public.bookings;
drop policy if exists "owner deletes bookings"      on public.bookings;
drop policy if exists "owner blocks a date"         on public.unavailable_dates;
drop policy if exists "owner unblocks a date"       on public.unavailable_dates;
drop policy if exists "owner writes portfolio"      on public.portfolio_items;
drop policy if exists "owner edits portfolio"       on public.portfolio_items;
drop policy if exists "owner removes portfolio"     on public.portfolio_items;

-- --- bookings ---------------------------------------------------------------
-- Anyone may submit a request, but only as 'pending'.
drop policy if exists "anon can request a booking" on public.bookings;
create policy "anon can request a booking"
  on public.bookings for insert
  to anon, authenticated
  with check (status = 'pending');

-- No SELECT policy for anon exists, so client names and phone numbers are
-- unreachable from the browser even though the anon key is public.
drop policy if exists "owner reads bookings" on public.bookings;
create policy "owner reads bookings"
  on public.bookings for select to authenticated using (public.is_owner());

drop policy if exists "owner moderates bookings" on public.bookings;
create policy "owner moderates bookings"
  on public.bookings for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner deletes bookings" on public.bookings;
create policy "owner deletes bookings"
  on public.bookings for delete to authenticated using (public.is_owner());

-- --- blocked_dates ----------------------------------------------------------
-- Owner only, in every direction. The public calendar never touches this.
drop policy if exists "owner reads blocked dates" on public.blocked_dates;
create policy "owner reads blocked dates"
  on public.blocked_dates for select to authenticated using (public.is_owner());

drop policy if exists "owner adds blocked date" on public.blocked_dates;
create policy "owner adds blocked date"
  on public.blocked_dates for insert to authenticated with check (public.is_owner());

drop policy if exists "owner removes blocked date" on public.blocked_dates;
create policy "owner removes blocked date"
  on public.blocked_dates for delete to authenticated using (public.is_owner());

-- --- unavailable_dates ------------------------------------------------------
-- Readable by everyone, writable by nobody. The only writer is the
-- security-definer trigger, which bypasses RLS by design. That means a day
-- holding a real reservation cannot be freed by any request from a browser.
drop policy if exists "anyone reads availability" on public.unavailable_dates;
create policy "anyone reads availability"
  on public.unavailable_dates for select to anon, authenticated using (true);

-- --- portfolio_items --------------------------------------------------------
drop policy if exists "anyone reads portfolio" on public.portfolio_items;
create policy "anyone reads portfolio"
  on public.portfolio_items for select to anon, authenticated using (true);

drop policy if exists "owner writes portfolio" on public.portfolio_items;
create policy "owner writes portfolio"
  on public.portfolio_items for insert to authenticated with check (public.is_owner());

drop policy if exists "owner edits portfolio" on public.portfolio_items;
create policy "owner edits portfolio"
  on public.portfolio_items for update to authenticated
  using (public.is_owner()) with check (public.is_owner());

drop policy if exists "owner removes portfolio" on public.portfolio_items;
create policy "owner removes portfolio"
  on public.portfolio_items for delete to authenticated using (public.is_owner());

-- ===========================================================================
--  Realtime
--  Only the public tables are published. bookings and blocked_dates must never
--  be broadcast: Realtime payloads would carry phone numbers and private notes
--  to every listener, whatever the SELECT policies say.
-- ===========================================================================
do $realtime$
begin
  begin
    alter publication supabase_realtime add table public.unavailable_dates;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.portfolio_items;
  exception when duplicate_object then null;
  end;
  -- Undo the first version if it published anything sensitive. Dropping a
  -- table that was never published raises, so swallow whatever comes back.
  begin
    alter publication supabase_realtime drop table public.bookings;
  exception when others then null;
  end;
end
$realtime$;

-- Rebuild the derived table once, so an existing database lines up with the
-- rules above rather than with whatever the old triggers left behind.
do $rebuild$
declare
  d date;
begin
  delete from public.unavailable_dates;
  for d in
    select date from public.bookings where status in ('pending', 'confirmed')
    union
    select date from public.blocked_dates
  loop
    perform public.refresh_unavailable_date(d);
  end loop;
end
$rebuild$;

-- ===========================================================================
--  No seed data on purpose.
--
--  An earlier version inserted three sample rows with invented Instagram short
--  codes. Those codes do not resolve, so every fresh deploy opened with a
--  gallery of "Sorry, this page isn't available" tiles - worse than an empty
--  gallery, because it looks broken rather than new.
--
--  Add real work from the dashboard at /admin instead.
-- ===========================================================================

-- ===========================================================================
--  LAST STEP - do not skip.
--  Create your account under Authentication -> Users, then grant it ownership:
--
--      insert into public.admins (user_id)
--      select id from auth.users where email = 'you@example.com';
--
--  Until a row exists here, /admin will sign in but show no data - every owner
--  policy will correctly refuse. Verify with:
--
--      select email, a.user_id is not null as is_owner
--      from auth.users u left join public.admins a on a.user_id = u.id;
-- ===========================================================================
