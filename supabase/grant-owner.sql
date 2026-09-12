-- ===========================================================================
--  Give an account access to the /admin dashboard.
--
--  Signing in is not the same as being allowed in. Supabase lets anyone
--  register with the public anon key - and that key ships inside the
--  JavaScript bundle - so every owner policy checks membership of
--  public.admins rather than merely being authenticated. Until a row exists
--  here, /admin signs the account in and then correctly says it has no owner
--  access.
--
--  public.admins has NO row level security policies on purpose, which makes it
--  unreachable from the browser entirely. That is why this has to be run here,
--  in the SQL editor, and cannot be done from the dashboard UI.
--
--  BEFORE RUNNING: create the login first, under
--  Authentication -> Users -> Add user -> Create new user.
--  Enter the email and password and tick "Auto Confirm User" - with that ticked
--  no email is sent, so the address does not need to be a real inbox.
--
--  Then set the email below and run ONE of the two sections.
-- ===========================================================================

-- ---------------------------------------------------------------------------
--  Set this to the account you just created.
-- ---------------------------------------------------------------------------
-- Used by both sections below. Change it in this one place.
create temp table _target as
select 'new-admin@example.com'::text as email;   -- <<< CHANGE THIS

-- ===========================================================================
--  SECTION A - Add this account as an owner, leaving existing owners alone.
--  Use this when more than one person should be able to open the dashboard.
-- ===========================================================================
insert into public.admins (user_id)
select u.id
from auth.users u, _target t
where u.email = t.email
on conflict (user_id) do nothing;

-- ===========================================================================
--  SECTION B - Make this account the ONLY owner, revoking everyone else.
--  Use this when replacing the admin rather than adding one.
--  Run section A first (it does the insert), then uncomment the delete below.
-- ===========================================================================
-- delete from public.admins
-- where user_id not in (select u.id from auth.users u, _target t where u.email = t.email);

-- ===========================================================================
--  Confirm. The account you named should read is_owner = true and
--  has_password = true. If has_password is false, the login was created by
--  invitation and never had a password set - fix that under
--  Authentication -> Users before trying to sign in.
-- ===========================================================================
select
  u.email,
  (a.user_id is not null)                                            as is_owner,
  (u.email_confirmed_at is not null)                                 as confirmed,
  (u.encrypted_password is not null and u.encrypted_password <> '')   as has_password
from auth.users u
left join public.admins a on a.user_id = u.id
order by is_owner desc, u.email;
