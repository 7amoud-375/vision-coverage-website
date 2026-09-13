import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured, isMissingTable } from '../lib/supabaseClient'

/**
 * The editable part of the About section: the portrait and the highlight rows.
 *
 * Returns null content until it loads, and null forever if the table does not
 * exist yet - callers fall back to the defaults in src/lib/config.js, so the
 * page renders correctly before the migration is run or the first save happens.
 *
 * Subscribes to Realtime so an edit in the dashboard reaches an open public
 * page without a refresh.
 */
export function useAboutContent() {
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState(null)

  const load = useCallback(async (showSpinner = true) => {
    if (!isSupabaseConfigured) return
    if (showSpinner) setLoading(true)

    const { data, error: err } = await supabase
      .from('about_content')
      .select('photo_url, highlights')
      .eq('id', 1)
      .maybeSingle()

    if (err) {
      // A missing table is an expected state before the migration runs, not
      // something to shout about on the public page.
      if (isMissingTable(err)) {
        console.warn('[about] about_content table not created yet - using config defaults')
        setError(null)
      } else {
        setError(err.message)
      }
    } else {
      setError(null)
      setContent(data ?? null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(false)
  }, [load])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channel = supabase
      .channel('about-content')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'about_content' },
        (payload) => {
          if (payload.eventType === 'DELETE') setContent(null)
          else setContent(payload.new)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  /**
   * Upsert onto the single row. The table's `check (id = 1)` means there can
   * only ever be one, so this is an update in practice and an insert the very
   * first time.
   */
  const save = useCallback(
    async ({ photoUrl, highlights }) => {
      const { error: err } = await supabase.from('about_content').upsert({
        id: 1,
        photo_url: photoUrl || null,
        highlights,
        updated_at: new Date().toISOString(),
      })

      if (err) return { error: err.message }
      await load(false)
      return { error: null }
    },
    [load]
  )

  return { content, loading, error, refresh: load, save }
}
