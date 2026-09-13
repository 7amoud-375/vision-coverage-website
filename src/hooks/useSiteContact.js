import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { supabase, isSupabaseConfigured, isMissingTable } from '../lib/supabaseClient'
import { contact as envContact } from '../lib/config'

const clean = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

// ---------------------------------------------------------------------------
//  A single shared store, rather than per-component state.
//
//  This hook is used by the footer, the floating WhatsApp button and the
//  reservation section - three components on the same page. Giving each its own
//  effect meant three calls to supabase.channel('site-contact'), and Supabase
//  returns the *same* channel object for a repeated name: the second caller
//  then tried to .on() a channel that had already been subscribed, which throws
//  "cannot add postgres_changes callbacks after subscribe()" and took the page
//  down.
//
//  Renaming the channel per instance would have silenced it while opening three
//  websocket subscriptions for one row. One store, one fetch, one channel, and
//  every consumer reads the same snapshot.
// ---------------------------------------------------------------------------

let snapshot = { row: null, ready: !isSupabaseConfigured, error: null }
const listeners = new Set()
let started = false

function emit(next) {
  snapshot = next
  listeners.forEach((listener) => listener())
}

async function load() {
  if (!isSupabaseConfigured) return

  // `*` rather than naming the columns on purpose. The contact-details
  // migration adds whatsapp/phone/email after the social-links one creates the
  // table, so asking for them by name returns a 400 in between - and a missing
  // *column* is not caught by the missing-*table* check. Selecting everything
  // works whichever migrations have run; absent fields simply read as undefined
  // and fall through to the env values below.
  const { data, error } = await supabase
    .from('site_contact')
    .select('*')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    if (isMissingTable(error)) {
      console.warn('[contact] site_contact not created yet - using .env fallback')
      emit({ row: null, ready: true, error: null })
    } else {
      emit({ ...snapshot, ready: true, error: error.message })
    }
    return
  }

  emit({ row: data ?? null, ready: true, error: null })
}

function start() {
  if (started || !isSupabaseConfigured) return
  started = true

  load()

  supabase
    .channel('site-contact')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'site_contact' },
      (payload) => emit({ ...snapshot, row: payload.new ?? null }),
    )
    .subscribe()
}

function subscribe(listener) {
  listeners.add(listener)
  start()

  return () => {
    listeners.delete(listener)
    // Deliberately keeps the channel open when the last consumer unmounts.
    // These components mount and unmount together on navigation, and tearing
    // the subscription down only to rebuild it moments later costs more than
    // holding one idle channel for the life of the page.
  }
}

const getSnapshot = () => snapshot

/**
 * Every contact detail on the public site: the WhatsApp number, phone, email
 * and social links.
 *
 * The database is the source of truth; anything it does not have falls back to
 * the matching environment variable, so the site works before the migration is
 * run. Only null-ish values fall through, so a detail the owner clears in the
 * dashboard genuinely disappears rather than reverting to a stale env var.
 */
export function useSiteContact() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const { row, ready, error } = state

  const value = useMemo(() => {
    if (!row) {
      return {
        whatsapp: envContact.whatsappNumber,
        phone: envContact.phone,
        email: envContact.email,
        socials: [
          envContact.instagram && { platform: 'instagram', url: envContact.instagram },
          envContact.facebook && { platform: 'facebook', url: envContact.facebook },
        ].filter(Boolean),
      }
    }

    return {
      whatsapp: clean(row.whatsapp) ?? envContact.whatsappNumber,
      phone: clean(row.phone) ?? envContact.phone,
      email: clean(row.email) ?? envContact.email,
      socials: Array.isArray(row.socials) ? row.socials : [],
    }
  }, [row])

  /** Build a wa.me link, or null when no number is set anywhere. */
  const whatsappLink = useCallback(
    (message = "Hi! I'd like to ask about media coverage.") =>
      value.whatsapp
        ? `https://wa.me/${value.whatsapp}?text=${encodeURIComponent(message)}`
        : null,
    [value.whatsapp],
  )

  const save = useCallback(async (next) => {
    const { error: err } = await supabase.from('site_contact').upsert({
      id: 1,
      whatsapp: next.whatsapp || null,
      phone: next.phone || null,
      email: next.email || null,
      socials: next.socials,
      updated_at: new Date().toISOString(),
    })
    if (err) return { error: err.message }
    await load()
    return { error: null }
  }, [])

  return { ...value, ready, error, whatsappLink, save, refresh: load }
}
