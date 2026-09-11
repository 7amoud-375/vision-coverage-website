import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

/**
 * Every date that cannot be booked, kept live via Supabase Realtime so a day
 * greys out the instant someone else reserves it - no page refresh needed.
 *
 * Reads `unavailable_dates`, which holds nothing but a date and whether it came
 * from a booking or from the owner blocking the day. Client names, phone
 * numbers and the owner's private notes live in separate tables that no
 * visitor can read (see supabase/schema.sql).
 *
 * Shared by the public calendar and the dashboard, so both always agree.
 */
export function useAvailability() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState(null)

  const load = useCallback(async (showSpinner = true) => {
    if (!isSupabaseConfigured) return
    if (showSpinner) setLoading(true)
    const { data, error: err } = await supabase
      .from('unavailable_dates')
      .select('date, source')
      .order('date', { ascending: true })

    if (err) setError(err.message)
    else {
      setError(null)
      setRows(data)
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
      .channel('availability')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'unavailable_dates' },
        (payload) => {
          setRows((prev) => {
            if (payload.eventType === 'DELETE') {
              return prev.filter((r) => r.date !== payload.old.date)
            }
            const row = payload.new
            const without = prev.filter((r) => r.date !== row.date)
            return [...without, row].sort((a, b) => a.date.localeCompare(b.date))
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const unavailable = useMemo(() => new Set(rows.map((r) => r.date)), [rows])

  return { rows, unavailable, loading, error, refresh: load }
}
