import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

/**
 * Owner-side view of every reservation, sorted by event date.
 * Only readable while signed in - `bookings` has no public SELECT policy.
 */
export function useBookings() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState(null)

  const load = useCallback(async (showSpinner = true) => {
    if (!isSupabaseConfigured) return
    if (showSpinner) setLoading(true)
    const { data, error: err } = await supabase
      .from('bookings')
      .select('*')
      .order('date', { ascending: true })

    if (err) setError(err.message)
    else {
      setError(null)
      setBookings(data)
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

  /**
   * Move a request to confirmed or rejected. The database trigger takes care of
   * adding or removing the matching row in `unavailable_dates`, which in turn
   * pushes the change to every open calendar over Realtime.
   */
  const setStatus = useCallback(async (id, status) => {
    const { data, error: err } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id)
      .select()
      .single()

    if (err) {
      // Restoring a rejected booking whose date has since been taken hits the
      // "one active booking per date" unique index. That refusal is correct -
      // it is what stops two clients holding the same day - but the raw
      // Postgres text is no use to anyone reading the dashboard.
      if (err.code === '23505') {
        return {
          error:
            'That date has already been taken by another booking. Reject the other one first if you want this date back.',
        }
      }
      return { error: err.message }
    }
    setBookings((prev) => prev.map((b) => (b.id === id ? data : b)))
    return { error: null }
  }, [])

  const remove = useCallback(async (id) => {
    const { error: err } = await supabase.from('bookings').delete().eq('id', id)
    if (err) return { error: err.message }
    setBookings((prev) => prev.filter((b) => b.id !== id))
    return { error: null }
  }, [])

  return { bookings, loading, error, refresh: load, setStatus, remove }
}
