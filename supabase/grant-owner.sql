-- ===========================================================================
--  Make one account the owner of the /admin dashboard.
--
--  Run this in the Supabase SQL Editor AFTER creating the login account under
--  Authentication -> Users. Signing in is not the same as being allowed in:
--  Supabase lets anyone register with the public anon key, so every owner
--  policy checks membership of public.admins instead of merely being
--  authenticated. Until a row exists here, /admin signs you in and then
--  correctly says the account has no owner access.
--
--  Safe to re-run. Change the email below if you use a different one.
-- ===========================================================================

-- 1. Grant ownership to the dashboard account.
insert into public.admins (user_id)
select id from auth.users
where email = 'admin@dashboard.com'
on conflict (user_id) do nothing;

-- 2. Revoke everyone else, so there is never a second owner lying around -
--    for example an invited account whose password was never set.
delete from public.admins
where user_id not in (
  select id from auth.users where email = 'admin@dashboard.com'
);

-- 3. Confirm. Exactly one row should read is_owner = true.
select
  u.email,
  (a.user_id is not null) as is_owner,
  (u.email_confirmed_at is not null) as confirmed,
  (u.encrypted_password is not null and u.encrypted_password <> '') as has_password
from auth.users u
left join public.admins a on a.user_id = u.id
order by u.email;
