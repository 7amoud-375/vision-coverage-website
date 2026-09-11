// ---------------------------------------------------------------------------
// The database stores plain `date` values with no timezone. Using toISOString()
// here would shift days for anyone west of UTC, so all conversion goes through
// these two helpers, which work purely in local time.
// ---------------------------------------------------------------------------

/** Date object -> 'YYYY-MM-DD' in the visitor's own timezone. */
export function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** 'YYYY-MM-DD' -> Date at local midnight. */
export function fromDateKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Local midnight today - the cutoff for "past" days. */
export function startOfToday() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

const LONG = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
const SHORT = { day: 'numeric', month: 'short', year: 'numeric' }

export const formatLong = (date) =>
  new Intl.DateTimeFormat(undefined, LONG).format(date)

export const formatShort = (date) =>
  new Intl.DateTimeFormat(undefined, SHORT).format(date)

export const formatKeyLong = (key) => formatLong(fromDateKey(key))
export const formatKeyShort = (key) => formatShort(fromDateKey(key))
