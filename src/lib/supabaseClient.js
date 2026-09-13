import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/**
 * True when both env vars are present. The public site still renders without
 * them (useful for design work and for a first deploy before Supabase is wired
 * up) - the calendar and gallery just show a friendly "not configured" notice
 * instead of throwing on every render.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured && import.meta.env.DEV) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing. ' +
      'Copy .env.example to .env and fill them in.'
  )
}

export const supabase = isSupabaseConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null

/**
 * True when an error means "that table does not exist yet".
 *
 * Two codes matter, and only checking one is why a missing table surfaced as a
 * red error on the page instead of quietly falling back:
 *   42P01    - Postgres' own undefined_table, raised by the database
 *   PGRST205 - PostgREST's "could not find the table in the schema cache",
 *              which is what actually comes back through the REST API
 *
 * The message is checked too, because PostgREST has used different codes for
 * this across versions.
 */
export function isMissingTable(error) {
  if (!error) return false
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  return /could not find the table|does not exist/i.test(error.message ?? '')
}
