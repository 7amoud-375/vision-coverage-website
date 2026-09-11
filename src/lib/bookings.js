import { supabase, isSupabaseConfigured } from './supabaseClient'

/**
 * Submit a reservation request. Always lands as `status: 'pending'` - the RLS
 * policy on `bookings` rejects any other value from an anonymous visitor.
 *
 * Returns { error } with a human-readable message rather than throwing, so the
 * form can render it inline.
 */
export async function createBooking({ date, clientName, phone, eventType, location, notes }) {
  if (!isSupabaseConfigured) {
    return { error: 'Booking is not available yet - the site is not connected to its database.' }
  }

  const { error } = await supabase.from('bookings').insert({
    date,
    client_name: clientName.trim(),
    phone: phone.trim(),
    event_type: eventType,
    location: location.trim(),
    notes: notes?.trim() || null,
    status: 'pending',
  })

  if (!error) {
    notifyOwner(date)
    return { error: null }
  }

  // The database guards against races: two people can open the same free day
  // and only the first insert wins. A unique index backs this up, so the
  // 23505 path catches the case where two inserts land in the same instant.
  if (error.message?.includes('DATE_UNAVAILABLE') || error.code === '23505') {
    return { error: 'Sorry - that date was just taken. Please pick another day.' }
  }
  if (error.message?.includes('DATE_IN_PAST')) {
    return { error: 'That date has already passed. Please pick a future day.' }
  }
  if (error.message?.includes('DATE_TOO_FAR')) {
    return {
      error:
        'That date is more than 18 months away. Please get in touch directly so we can plan it.',
    }
  }
  if (error.message?.includes('TOO_MANY_PENDING')) {
    return {
      error:
        'You already have a few requests waiting to be confirmed. Please wait to hear back before sending another.',
    }
  }

  console.error('[bookings] insert failed', error)
  return { error: 'Something went wrong sending your request. Please try again.' }
}

/**
 * Fire-and-forget ping to the optional /api/notify serverless function.
 * Deliberately swallows every failure: the reservation is already saved, so a
 * missing or unconfigured endpoint must never show the visitor an error.
 */
function notifyOwner(date) {
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date }),
  }).catch(() => {})
}
