# Media Coverage — Portfolio & Reservations

A portfolio and live booking site for a photography/videography freelancer.
Visitors browse his work, check a live
availability calendar and request a date. The owner approves or rejects
requests, blocks days off and manages the gallery from a private dashboard.

**Stack:** React + Vite + Tailwind CSS · Supabase (Postgres, Auth, Realtime) ·
react-day-picker · deployed as static files + optional serverless functions on
Vercel. There is no backend server to run.

---

## Quick start

```bash
npm install
cp .env.example .env   # then fill in your Supabase URL and anon key
npm run dev
```

The site runs at http://localhost:5173. The dashboard is at
http://localhost:5173/admin — it is not linked from the public site.

Without Supabase keys the site still renders: the gallery and calendar show a
"not connected" notice instead of crashing, which is handy for design work.

---

## Supabase setup

### 1. Create the project

Create a free project at [supabase.com](https://supabase.com). From
**Settings → API** copy the **Project URL** and the **anon public** key into
your `.env`:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

Both are safe in the browser — row level security is what protects the data.

### 2. Create the tables

Open **SQL Editor**, paste the entire contents of
[`supabase/schema.sql`](supabase/schema.sql) and run it. That one script creates
the tables, triggers, security policies and the Realtime publication. It is safe
to re-run, and safe to run over the first version of the schema.

It deliberately inserts **no** sample portfolio rows — invented Instagram short
codes don't resolve, so seeding them made a fresh deploy open with a gallery of
"this page isn't available" tiles.

### 3. Create the owner account — and grant it ownership

**Authentication → Users → Add user**. Enter an email and password and tick
*Auto Confirm User*.

Then grant that account owner access, in the SQL Editor:

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'you@example.com';
```

**This step is not optional.** Supabase allows anyone to register with the anon
key — and that key ships inside the JavaScript bundle. If the dashboard trusted
"is signed in", a stranger could sign up and read every client's phone number.
Every owner policy therefore checks membership of `admins` instead. Until the
row above exists, `/admin` will sign you in and then tell you the account has no
owner access.

Check it worked:

```sql
select u.email, (a.user_id is not null) as is_owner
from auth.users u left join public.admins a on a.user_id = u.id;
```

It's still worth turning off public sign-ups under **Authentication → Providers
→ Email** — defence in depth, not the defence itself.

### 4. Realtime

The SQL script already publishes the two public tables, so nothing else is
needed. If you want to confirm, check **Database → Replication → supabase_realtime**
lists `unavailable_dates` and `portfolio_items`.

---

## How the data model works

The split between the tables is the important part:

| Table | Who can read it | What it holds |
| --- | --- | --- |
| `bookings` | **owner only** | client name, phone, event type, location, notes, status |
| `blocked_dates` | **owner only** | days off, with the owner's private note |
| `unavailable_dates` | anyone | a bare date and whether it came from a booking or a block |
| `portfolio_items` | anyone | title, category, description, Instagram URL |
| `admins` | **nobody** (service role / SQL editor only) | which auth user owns this site |

The anon key ships in the browser, so anything a visitor's key can read is
effectively public. Client phone numbers and the owner's private notes therefore
must not live in a table visitors can query — but the calendar still needs to
know which days are gone.

`unavailable_dates` resolves that. It is **entirely derived**: nobody writes to
it, not even the signed-in owner. Triggers on `bookings` and `blocked_dates`
recompute it, and it carries a date and nothing else. The public calendar
subscribes to *that* table over Realtime, so a day marks itself taken the moment
someone books it, while everything behind it stays unreadable.

The recompute is deliberate. An earlier version mirrored rows with
`on conflict do nothing` and deleted by booking id, which could silently free a
day that a confirmed booking still held. Recalculating a date's status from
current state can't drift like that, whatever order things happen in.

Other things the database handles rather than the UI:

- **A partial unique index** (`one active booking per date`) makes double
  booking physically impossible, whatever the application does.
- A `before insert` trigger rejects past dates, dates more than 18 months out,
  days already taken, and a fourth pending request from the same phone number.
- RLS lets visitors insert **only** `status = 'pending'` rows, so nobody can
  self-confirm a booking by crafting a request.
- Date comparison on the server allows one day of slack, because the database
  runs in UTC while the visitor's "today" is local. A strict comparison rejected
  same-day bookings for everyone west of UTC every evening.

### Spam

The insert guard bounds the damage — one active booking per date, an 18-month
window, three pending requests per phone number — but a determined script with
many phone numbers can still fill the diary. **If the form is ever abused in
earnest, put a CAPTCHA in front of it**: move the insert into a Supabase Edge
Function that verifies a Cloudflare Turnstile token before writing. The schema
is already shaped for it — only the `anon ... for insert` policy would change.

---

## Portfolio: how the videos work

The owner uploads video straight from his phone gallery or his laptop. There is
no Instagram link to paste, and no third-party player in the page.

**The gallery never streams video.** Cards show a poster image only; the video
file is fetched when someone presses play, in a lightbox. That distinction is
the whole design, because bandwidth is the binding constraint on a free tier —
it is the difference between ~250 *plays* a month and ~250 *visitors*.

- **Poster frames are automatic.** When a video is picked, the browser decodes a
  frame about a second in (frame zero is usually black while the camera settles),
  scales it down, and uploads it as a ~150 KB JPEG alongside the video. Nothing
  to fill in by hand. If the browser cannot decode the format, the upload still
  succeeds and the card falls back to the brand chevron.
- **Uploads show real progress**, via `XMLHttpRequest` rather than supabase-js —
  the JS client exposes no progress events, and a 40 MB upload over mobile data
  with no progress bar is indistinguishable from a hung app.
- **Per-file size is the plan's, not ours.** The bucket sets no limit of its own,
  so it inherits the project ceiling (50 MB on the free plan; raising the plan
  lifts it with no code change). Length is not limited at all — it was a bad
  proxy for size.
- **Total storage is capped at 800 MB** in the dashboard, with a warning from
  80%. Postgres has no per-bucket quota, so that check lives where the upload
  happens.
- **Storage is owner-only.** The bucket's write policies check membership of
  `public.admins`, exactly like every table. Visitors read; only the owner writes.
- **Replacing or deleting a piece cleans up its files**, so the bucket does not
  fill with orphans. The old files are removed only once the new ones are safely
  stored.

Instagram remains supported as an *optional* extra field, for pointing viewers at
an original post, and older Instagram-only items still render via the embed. If
Instagram is blocked (uBlock, Brave shields, corporate DNS), those fall back to a
plain link rather than sitting as a grey skeleton forever.

**If the site gets busy, video should move off Supabase Storage** — it is a file
bucket, not a video platform. Cloudflare Stream or R2, Bunny, or an unlisted
YouTube/Vimeo embed are all built for this. Watch **Reports → Egress**.

---

## The dashboard (`/admin`)

Not linked from the public navigation; reach it by typing the URL. Signing out
or visiting while signed out shows the login form.

**Reservations tab** — every request sorted by event date, filterable by status,
with the client's name and a tap-to-call phone link. Approve moves a request to
`confirmed`; reject moves it to `rejected` and frees the day back up.
**Cancelling an already-confirmed booking asks for confirmation first** — it
releases the date to whoever asks next, so a stray tap shouldn't be able to drop
a wedding the owner already promised.

The list keeps itself current without broadcasting anything private. `bookings`
is deliberately not published over Realtime — a subscription would push client
phone numbers to every listener — but the public availability table changes on
exactly the same events, so the dashboard uses that as a "something moved" ping
and refetches the private list with the owner's own credentials. It also
refreshes when the tab regains focus, and there's a manual Refresh button.

There is also a collapsible **Blocked days** panel: tap any open day on the
calendar to take it off the public site (holidays, travel), with a private note.
Those notes live in the owner-only `blocked_dates` table and never reach the
public site.

A day held by a real reservation cannot be "unblocked" from that panel — you
reject the booking instead. That is enforced by the security policy, not just
hidden in the UI, so the two views can never disagree.

**Work tab** — add a piece by pasting an Instagram URL plus title, category and
description; edit or delete existing ones. Changes reach the public gallery
immediately over Realtime.

---

## Before you launch

Everything below works out of the box except these, which need the client's own
content or a decision:

- [ ] **Grant owner access** — the `insert into public.admins` above. Without it
      the dashboard signs you in and then says you have no access.
- [ ] **Set `VITE_WHATSAPP_NUMBER`** and the other contact vars. They have no
      fallbacks on purpose: unset means the link is *hidden*, not broken. The
      floating WhatsApp button will not appear at all until this is set.
- [ ] **Add `/public/og-image.jpg`** (1200×630). This is the picture WhatsApp,
      Instagram DMs and Facebook show when someone shares the link — the way a
      photographer's site actually spreads. It must be a JPG or PNG; those
      platforms don't render SVG. The owner's single best photograph is the
      right choice here.
- [ ] **Replace the hero** — `/public/hero-placeholder.svg` is a designed
      stand-in, not a photograph. Point `heroMedia.image` (or `.video`, for a
      showreel) at the real file in `src/lib/config.js`.
- [ ] **Replace the About copy and portrait** in `src/lib/config.js` — the bio,
      equipment list and stats are all plausible-sounding placeholder text.
- [ ] **Add real work** at `/admin`. The gallery ships empty by design.
- [ ] Optionally swap `/public/favicon.svg` for the client's own mark.

## Deploying to Vercel

1. Push this repo to GitHub/GitLab.
2. In Vercel, **Add New → Project** and import it. Vercel detects Vite on its
   own — no build settings to change (`npm run build` → `dist`).
3. Under **Settings → Environment Variables**, add `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY` (plus any optional vars below) for Production,
   Preview and Development.
4. **Deploy.**

`vercel.json` does two things:

- Rewrites all non-`/api` paths to `index.html`, so visiting `/admin` directly
  works instead of 404-ing.
- Sets security headers. `frame-ancestors 'none'` and `X-Frame-Options: DENY`
  matter most — without them another site can put `/admin` in an invisible
  iframe and trick the owner into clicking through it. The Content-Security
  Policy allows exactly what the site loads: Instagram's embed widget, Google
  Fonts, and Supabase over HTTPS and websockets. **If you add a third-party
  script (analytics, a chat widget), it will be blocked until you add its origin
  to `script-src` and `connect-src`.**

Env vars are read at **build** time, so after changing one in the Vercel
dashboard you need to redeploy for it to take effect.

### Optional: booking notifications

[`api/notify.js`](api/notify.js) is a serverless function that pings a webhook
(Slack, Zapier, Make, a WhatsApp gateway…) when a request comes in. It is
entirely optional — with its env vars unset it quietly does nothing and the
booking flow is unaffected.

To enable it, add these in the Vercel dashboard **without** the `VITE_` prefix,
so they stay server-side and never reach the browser:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...      # Settings -> API -> service_role. Never expose this.
NOTIFY_WEBHOOK_URL=https://hooks.example.com/xxxx
```

The browser sends only a date; the function reads the reservation back from the
database itself, so a forged request cannot inject arbitrary content into your
notifications.

---

## Customising

Nearly everything client-specific is in two files:

- **`src/lib/config.js`** — business name, tagline, intro, WhatsApp number,
  contact details, social links, About text, equipment highlights, hero
  image/video, portfolio categories, event types.
- **`src/components/brand/`** — the chevron mark and the stacked wordmark. The
  mark is a geometric interpretation of the logo, used as the site's decorative
  motif: the navbar lockup, a large watermark bleeding off the hero, the rule
  that opens each section heading, and the fallback tile for work with no poster
  yet. To use the real artwork instead, drop the file in `/public` and point
  `brand.logo` at it in `src/lib/config.js` — the navbar and footer switch to it
  with no code change.
- **`tailwind.config.js`** — colours and fonts. Tuned to the identity: true
  black, pure white, Montserrat. The brand "accent" is simply white, so primary
  buttons are white on black rather than a colour laid over the brand. The only
  hues left are functional (booked days, status badges), where brightness alone
  would fail both contrast and colour-blind readers. Components use semantic names
  (`bg-surface`, `text-muted`, `bg-accent`) rather than raw Tailwind colours, so
  a rebrand is a one-file edit.

Contact details can also come from env vars (`VITE_WHATSAPP_NUMBER`,
`VITE_CONTACT_EMAIL`, `VITE_INSTAGRAM_URL`, …) — see `.env.example`.

For a hero background, drop a file in `public/` and point `heroMedia.image` or
`heroMedia.video` at it in `src/lib/config.js`. Until then a gradient stands in,
so nothing ever renders broken.

---

## Project layout

```
api/notify.js               optional serverless booking notification
supabase/schema.sql         tables, triggers, RLS policies, Realtime
vercel.json                 SPA rewrite + security headers
eslint.config.js            flat config: browser src/, node api/ and configs
public/
  hero-placeholder.svg      designed stand-in for the hero - replace
  favicon.svg               aperture mark - replace with the client's logo
  og-image.jpg              YOU MUST ADD THIS (1200x630) for link previews
src/
  lib/
    supabaseClient.js       client + "is it configured?" guard
    config.js               all client-specific content and contact details
    dates.js                timezone-safe YYYY-MM-DD helpers
    instagram.js            URL canonicalisation + embed script handling
    bookings.js             createBooking, with friendly error mapping
  hooks/
    useAvailability.js      public unavailable dates, live over Realtime
    usePortfolio.js         portfolio items, live over Realtime
    useBookings.js          owner-side reservation list + approve/reject
    useBlockedDates.js      owner-side days off, with private notes
    useAuth.js              Supabase session + "is this account the owner?"
  components/
    layout/                 Navbar, Footer, floating WhatsApp button
    sections/               Hero, Portfolio, About, Reservation
    portfolio/              InstagramEmbed, LazyMount, grid, filter
    reservation/            calendar, legend, booking form
    admin/                  login, reservations, blocked days, work manager
    ui/                     Button, Field, Modal, Badge, Notice, Spinner,
                            ErrorBoundary
  pages/                    Home, Admin
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | dev server at http://localhost:5173 |
| `npm run build` | production build into `dist/` |
| `npm run preview` | serve the production build locally |
| `npm run lint` | ESLint over `src/`, `api/` and the config files |

## Known trade-offs

- **Bundle size.** The main chunk is ~145 kB gzipped, most of it
  `@supabase/supabase-js`. The dashboard is already split into its own chunk so
  visitors never download it. Splitting further (the calendar, the booking form)
  would shave tens of kilobytes at the cost of layout shift on a page where
  everything sits on one scroll, which seemed the worse trade.
- **Instagram embeds are light-themed.** Instagram's widget has no dark variant
  and cannot be restyled from outside the iframe. Each one sits on a light mat
  so it reads as a framed print rather than a white rectangle on black. If the
  clash ever becomes unacceptable, the alternative is storing a poster image per
  item and linking out — which costs storage and the inline playback.
- **No automated tests.** The logic with real edge cases — Instagram URL
  normalisation, local-time date keys, the availability triggers — is where
  tests would pay off first.
