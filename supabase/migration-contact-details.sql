-- ===========================================================================
--  Migration: phone, email and the WhatsApp number become editable too.
--
--  They were environment variables, which means changing one needs a redeploy -
--  something the owner cannot do himself. Since the WhatsApp button is the most
--  prominent call to action on the site, that is the wrong thing to lock behind
--  a developer.
--
--  Extends the site_contact row that already holds the social links, so the
--  whole Contact tab saves in a single atomic update.
--
--  Run this once in the Supabase SQL Editor. Safe to re-run.
--  Requires migration-social-links.sql to have been run first.
-- ===========================================================================

alter table public.site_contact add column if not exists whatsapp text;
alter table public.site_contact add column if not exists phone    text;
alter table public.site_contact add column if not exists email    text;

alter table public.site_contact drop constraint if exists site_contact_whatsapp_shape;
alter table public.site_contact drop constraint if exists site_contact_phone_len;
alter table public.site_contact drop constraint if exists site_contact_email_shape;

-- Digits only, stored without "+" or spaces, because that is the form wa.me
-- needs. The dashboard strips whatever punctuation was typed before saving.
alter table public.site_contact
  add constraint site_contact_whatsapp_shape check (
    whatsapp is null or whatsapp ~ '^[0-9]{6,20}$'
  );

-- Deliberately permissive: international formats vary wildly, and a rejected
-- number is worse than an oddly punctuated one that still dials.
alter table public.site_contact
  add constraint site_contact_phone_len check (
    phone is null or char_length(phone) between 5 and 32
  );

alter table public.site_contact
  add constraint site_contact_email_shape check (
    email is null or (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
                      and char_length(email) <= 160)
  );

-- ---------------------------------------------------------------------------
--  Confirm - the three columns should be listed, all nullable.
-- ---------------------------------------------------------------------------
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'site_contact'
  and column_name in ('whatsapp', 'phone', 'email')
order by column_name;
