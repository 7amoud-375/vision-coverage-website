import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { supabase, isSupabaseConfigured, isMissingTable } from '../lib/supabaseClient'
import { contact as envContact } from '../lib/config'

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

  // `*` rather than naming columns: the table has gained and lost columns
  // across migrations, and naming one that is not there yet returns a 400 that
  // the missing-table check does not catch. Selecting everything is immune to
  // that, and absent fields simply read as undefined.
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
 * The social links shown on the public site, editable from the dashboard.
 *
 * The database is the source of truth. Before the migration has been run it
 * falls back to whatever the Instagram and Facebook env vars hold, so the
 * footer keeps its links rather than going blank in between.
 */
export function useSiteContact() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const { row, ready, error } = state

  const value = useMemo(() => {
    if (!row) {
      return {
        socials: [
          envContact.instagram && { platform: 'instagram', url: envContact.instagram },
          envContact.facebook && { platform: 'facebook', url: envContact.facebook },
        ].filter(Boolean),
      }
    }

    return { socials: Array.isArray(row.socials) ? row.socials : [] }
  }, [row])

  /**
   * The WhatsApp link, taken from the social links like any other platform -
   * there is no separate number field. Returns null when none is set, so every
   * WhatsApp affordance on the site disappears together rather than becoming a
   * dead link.
   *
   * A wa.me address carrying no query string gets the message appended, which
   * is what pre-fills the chat. Anything else is left exactly as entered.
   */
  const whatsappLink = useCallback(
    (message = "Hi! I'd like to ask about media coverage.") => {
      const entry = value.socials.find((s) => s.platform === 'whatsapp')
      if (!entry?.url) return null
      if (entry.url.includes('wa.me/') && !entry.url.includes('?')) {
        return `${entry.url}?text=${encodeURIComponent(message)}`
      }
      return entry.url
    },
    [value.socials],
  )

  const save = useCallback(async (socials) => {
    const { error: err } = await supabase.from('site_contact').upsert({
      id: 1,
      socials,
      updated_at: new Date().toISOString(),
    })
    if (err) return { error: err.message }
    await load()
    return { error: null }
  }, [])

  return {
    ...value,
    // Still environment-configured; only the links are editable in the
    // dashboard.
    phone: envContact.phone,
    email: envContact.email,
    ready,
    error,
    whatsappLink,
    save,
    refresh: load,
  }
}
