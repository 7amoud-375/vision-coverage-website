import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

/**
 * Current Supabase session for the owner's dashboard, plus whether that account
 * is actually the owner.
 *
 * Signing in is not the same as being allowed in: Supabase lets anyone register
 * with the public anon key, so every policy checks membership of the `admins`
 * table instead of merely being authenticated. Without asking, a stranger who
 * signed up would reach the dashboard and see empty lists with no explanation -
 * so the answer is fetched explicitly and surfaced.
 *
 * `loading` stays true until both the session and the ownership check resolve,
 * so the route never flashes the wrong screen.
 */
export function useAuth() {
  const [session, setSession] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  // Only "loading" when there is actually a session to look up; deciding that
  // here avoids a synchronous state change inside the effect on mount.
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    let active = true

    const resolve = async (nextSession) => {
      if (!active) return
      setSession(nextSession)

      if (!nextSession) {
        setIsOwner(false)
        setLoading(false)
        return
      }

      const { data, error } = await supabase.rpc('is_owner')
      if (!active) return

      if (error) {
        // Most likely the schema has not been applied yet. Treat it as "not an
        // owner" rather than letting the dashboard render against nothing.
        console.error('[auth] ownership check failed', error)
        setIsOwner(false)
      } else {
        setIsOwner(Boolean(data))
      }
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session))

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true)
      resolve(nextSession)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  return { session, user: session?.user ?? null, isOwner, loading }
}
