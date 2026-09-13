import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured, isMissingTable } from '../lib/supabaseClient'

/**
 * The social links shown in the footer, editable from the dashboard.
 *
 * Returns an empty list until loaded, and stays empty if the table does not
 * exist yet - the footer then falls back to whatever is set in .env, so the
 * page renders correctly before the migration runs.
 */
export function useSocialLinks() {
  const [socials, setSocials] = useState([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setReady(true)
      return
    }

    const { data, error: err } = await supabase
      .from('site_contact')
      .select('socials')
      .eq('id', 1)
      .maybeSingle()

    if (err) {
      // Expected before the migration is run; not worth an error on the page.
      if (isMissingTable(err)) {
        console.warn('[social] site_contact table not created yet - using .env fallback')
        setError(null)
      } else {
        setError(err.message)
      }
    } else {
      setError(null)
      setSocials(Array.isArray(data?.socials) ? data.socials : [])
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
        (payload) => {
          setSocials(Array.isArray(payload.new?.socials) ? payload.new.socials : [])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const save = useCallback(
    async (next) => {
      const { error: err } = await supabase.from('site_contact').upsert({
        id: 1,
        socials: next,
        updated_at: new Date().toISOString(),
      })
      if (err) return { error: err.message }
      await load()
      return { error: null }
    },
    [load]
  )

  return { socials, ready, error, save, refresh: load }
}
