import { useCallback, useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

/**
 * The owner's own days off, with their private notes.
 *
 * These live in `blocked_dates`, which is owner-only in every direction - the
 * note may say "hospital appointment" and must never reach a visitor. Writing
 * here fires a trigger that mirrors the bare date into the public
 * `unavailable_dates` table, which is what the calendar actually reads.
 *
 * A day held by a real reservation is not in this table at all: freeing one
 * means rejecting that booking, so the two views cannot drift apart.
 */
export function useBlockedDates() {
  const [blocks, setBlocks] = useState([])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [error, setError] = useState(null)

  const load = useCallback(async (showSpinner = true) => {
    if (!isSupabaseConfigured) return
    if (showSpinner) setLoading(true)
    const { data, error: err } = await supabase
      .from('blocked_dates')
      .select('date, note')
      .order('date', { ascending: true })

    if (err) setError(err.message)
    else {
      setError(null)
      setBlocks(data)
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

  const block = useCallback(
    async (dateKey, note) => {
      const { error: err } = await supabase
        .from('blocked_dates')
        .insert({ date: dateKey, note: note?.trim() || null })

      if (err) {
        if (err.code === '23505') return { error: 'That day is already blocked.' }
        return { error: err.message }
      }
      await load()
      return { error: null }
    },
    [load]
  )

  const unblock = useCallback(
    async (dateKey) => {
      const { error: err } = await supabase.from('blocked_dates').delete().eq('date', dateKey)
      if (err) return { error: err.message }
      await load()
      return { error: null }
    },
    [load]
  )

  return { blocks, loading, error, refresh: load, block, unblock }
}
