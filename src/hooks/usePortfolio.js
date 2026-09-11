import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

/**
 * Portfolio items, newest first. Subscribes to Realtime so edits made in the
 * dashboard show up on the public gallery immediately.
 */
export function usePortfolio() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState(null)

  const load = useCallback(async (showSpinner = true) => {
    if (!isSupabaseConfigured) return
    if (showSpinner) setLoading(true)
    const { data, error: err } = await supabase
      .from('portfolio_items')
      .select('*')
      .order('created_at', { ascending: false })

    if (err) setError(err.message)
    else {
      setError(null)
      setItems(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // `false`: loading already starts true, so re-setting it here would only
    // add a render pass before the request even leaves.
    //
    // The rule cannot see through that argument and assumes load() always sets
    // state synchronously. With showSpinner false it does not - every setState
    // in this path happens after an await - so the warning is a false positive
    // for fetch-on-mount, suppressed here rather than disabled project-wide.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(false)
  }, [load])

  useEffect(() => {
    if (!isSupabaseConfigured) return

    const channel = supabase
      .channel('portfolio')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'portfolio_items' },
        (payload) => {
          setItems((prev) => {
            if (payload.eventType === 'INSERT') {
              if (prev.some((i) => i.id === payload.new.id)) return prev
              return [payload.new, ...prev]
            }
            if (payload.eventType === 'UPDATE') {
              return prev.map((i) => (i.id === payload.new.id ? payload.new : i))
            }
            return prev.filter((i) => i.id !== payload.old.id)
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { items, loading, error, refresh: load }
}
