import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured, isMissingTable } from '../lib/supabaseClient'
import { contact as envContact } from '../lib/config'

const EMPTY = { whatsapp: null, phone: null, email: null, socials: [] }

const clean = (value) => {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

/**
 * Every contact detail on the public site: the WhatsApp number, phone, email
 * and the social links.
 *
 * The database is the source of truth. Anything it does not have falls back to
 * the matching environment variable, so the site keeps working before the
 * migration is run and during a handover - and a value the owner clears in the
 * dashboard genuinely disappears rather than reverting to an old env var,
 * because only null-ish values fall through.
 *
 * Subscribes to Realtime, so an edit reaches an open page without a refresh.
 */
export function useSiteContact() {
  const [row, setRow] = useState(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setReady(true)
      return
    }

    const { data, error: err } = await supabase
      .from('site_contact')
      .select('whatsapp, phone, email, socials')
      .eq('id', 1)
      .maybeSingle()

    if (err) {
      if (isMissingTable(err)) {
        console.warn('[contact] site_contact not created yet - using .env fallback')
        setError(null)
      } else {
        setError(err.message)
      }
    } else {
      setError(null)
      setRow(data ?? null)
    }
    setReady(true)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channel = supabase
      .channel('site-contact')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'site_contact' },
        (payload) => setRow(payload.new ?? null)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const value = useMemo(() => {
    if (!row) {
      // Before the table exists, mirror whatever .env provides.
      return {
        ...EMPTY,
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
    [value.whatsapp]
  )

  const save = useCallback(
    async (next) => {
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
    },
    [load]
  )

  return { ...value, ready, error, whatsappLink, save, refresh: load }
}
