// ---------------------------------------------------------------------------
// Every piece of client-specific text/contact detail lives here so the site can
// be rebranded without touching component code. Values fall back to sensible
// placeholders when the matching env var is not set.
// ---------------------------------------------------------------------------
const env = import.meta.env

// ---------------------------------------------------------------------------
// Brand. The wordmark is split the way the logo stacks it - VISION over
// MEDIA COVER over ZEKRA - so the navbar and footer can render it with the same
// hierarchy rather than as one flat string.
// ---------------------------------------------------------------------------
export const site = {
  name: 'Vision Zekra',            // plain form, for titles and sentences
  wordmarkTop: 'VISION',
  wordmarkRule: 'MEDIA COVER',
  wordmarkBottom: 'ZEKRA',
  tagline: 'Media coverage for the moments that matter',
  intro:
    'Weddings, corporate productions and live events - captured with a cinematic eye and delivered fast. Based locally, available anywhere.',
  ownerName: 'Vision Zekra',
}

// The real logo file, if you drop one in /public. The site falls back to the
// built-in geometric mark (src/components/brand/Mark.jsx) when this is empty,
// so nothing renders broken either way. An SVG is worth exporting if you have
// one - it stays sharp at every size, where the square PNG will not.
export const brand = {
  logo: '',                        // e.g. '/logo.svg' or '/logo.png'
}

// ---------------------------------------------------------------------------
// Contact details. These deliberately fall back to NOTHING rather than to a
// plausible-looking placeholder: a default like "201234567890" is a real
// Egyptian number, so shipping it would send clients to a stranger. Anything
// unset simply does not render, and dev builds say so in the console.
// ---------------------------------------------------------------------------
const clean = (value) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export const contact = {
  // wa.me wants digits only, so strip whatever formatting was pasted in.
  whatsappNumber: clean(env.VITE_WHATSAPP_NUMBER)?.replace(/\D/g, '') || null,
  email: clean(env.VITE_CONTACT_EMAIL),
  phone: clean(env.VITE_CONTACT_PHONE),
  instagram: clean(env.VITE_INSTAGRAM_URL),
  facebook: clean(env.VITE_FACEBOOK_URL),
}

/** Returns null when no WhatsApp number is configured, so callers can hide the UI. */
export const whatsappLink = (message = "Hi! I'd like to ask about media coverage.") =>
  contact.whatsappNumber
    ? `https://wa.me/${contact.whatsappNumber}?text=${encodeURIComponent(message)}`
    : null

if (import.meta.env.DEV) {
  const missing = Object.entries(contact)
    .filter(([, value]) => !value)
    .map(([key]) => key)

  if (missing.length > 0) {
    console.warn(
      `[config] No contact details for: ${missing.join(', ')}. ` +
        'Those links are hidden until the matching VITE_ vars are set - see .env.example.'
    )
  }
}

// Portfolio categories. "All" is a UI-only filter and is not stored in the DB.
export const CATEGORIES = ['Wedding', 'Corporate', 'Event']
export const FILTERS = ['All', ...CATEGORIES]

// Matches the event_type dropdown in the booking form.
export const EVENT_TYPES = ['Wedding', 'Corporate', 'Other']

// ---------------------------------------------------------------------------
// Hero background. Drop a file in /public and point at it, e.g. '/hero.jpg' or
// '/showreel.mp4'. While both are empty the hero falls back to a gradient, so
// the site never ships a broken image.
// ---------------------------------------------------------------------------
export const heroMedia = {
  // Designed stand-in so the hero never looks unfinished. Replace with the
  // client's own still - or set `video` to a showreel - and delete the SVG.
  image: '/hero-placeholder.svg',
  video: '',
  poster: '',
}

// About section content - plain text so it can be swapped without touching JSX.
export const about = {
  photo: '', // e.g. '/portrait.jpg'
  bio: [
    'I have spent the last several years behind a camera at weddings, product launches and conferences, learning that the difference between footage and a film is knowing which moment to wait for.',
    'My approach is unobtrusive and documentary-led: I stay out of the way, shoot in available light wherever possible, and grade for a warm, filmic finish. You get a gallery within two weeks and a highlight film within four.',
  ],
  highlights: [
    { label: 'Cameras', value: 'Sony FX3 + a7 IV, dual-body coverage' },
    { label: 'Glass', value: 'Fast primes - 24mm, 35mm, 50mm, 85mm' },
    { label: 'Audio', value: 'Wireless lavs and a dedicated recorder' },
    { label: 'Style', value: 'Documentary, warm grade, minimal direction' },
  ],
  stats: [
    { value: '200+', label: 'Events covered' },
    { value: '6 yrs', label: 'Behind the lens' },
    { value: '48 hr', label: 'Preview turnaround' },
  ],
}
