// ---------------------------------------------------------------------------
// Instagram embeds, without an API key, a developer account or a token.
//
// Instagram's public embed.js turns a <blockquote class="instagram-media"> into
// a real player. The script only scans the DOM automatically on initial page
// load, so anything React injects later has to be processed by hand via
// window.instgrm.Embeds.process(). That is what processEmbeds() is for.
// ---------------------------------------------------------------------------

const EMBED_SRC = 'https://www.instagram.com/embed.js'

/**
 * Ensure embed.js is present exactly once for the whole app. index.html already
 * includes it; this is the safety net for the case where the tag was removed or
 * the script failed to load on a slow connection.
 */
export function ensureEmbedScript() {
  if (typeof document === 'undefined') return
  if (window.instgrm) return
  if (document.querySelector(`script[src="${EMBED_SRC}"]`)) return

  const script = document.createElement('script')
  script.async = true
  script.src = EMBED_SRC
  document.body.appendChild(script)
}

/**
 * Ask Instagram to (re)render any unprocessed blockquotes on the page.
 *
 * The script can still be in flight when a component mounts, so we retry on a
 * short backoff instead of silently giving up. Returns a cleanup function that
 * cancels pending retries - call it from the effect's teardown.
 */
export function processEmbeds({ retries = 12, interval = 400 } = {}) {
  let attempts = 0
  let timer = null

  const attempt = () => {
    if (window.instgrm?.Embeds?.process) {
      window.instgrm.Embeds.process()
      return
    }
    if (attempts++ >= retries) return
    timer = setTimeout(attempt, interval)
  }

  attempt()

  return () => {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Accepts anything the owner is likely to paste - a share link, a URL with
 * ?igsh= tracking params, a mobile link - and returns the canonical permalink
 * Instagram's embed widget expects, or null when it is not a post/reel URL.
 *
 *   https://www.instagram.com/reel/ABC123/?igsh=xyz
 *     -> https://www.instagram.com/reel/ABC123/
 */
export function normalizeInstagramUrl(raw) {
  if (!raw) return null

  let value = String(raw).trim()
  if (!value) return null
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`

  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return null
  }

  if (!/(^|\.)instagram\.com$/i.test(parsed.hostname)) return null

  // Path is /p/<code>/, /reel/<code>/, /reels/<code>/ or /tv/<code>/ - possibly
  // prefixed with a username, e.g. /someuser/p/<code>/.
  const segments = parsed.pathname.split('/').filter(Boolean)
  const typeIndex = segments.findIndex((s) => ['p', 'reel', 'reels', 'tv'].includes(s))
  if (typeIndex === -1) return null

  const type = segments[typeIndex] === 'reels' ? 'reel' : segments[typeIndex]
  const code = segments[typeIndex + 1]
  if (!code || !/^[A-Za-z0-9_-]+$/.test(code)) return null

  return `https://www.instagram.com/${type}/${code}/`
}

/**
 * Whether a pasted string is a usable Instagram post/reel link.
 * `normalizeInstagramUrl` already returns null for anything else, so callers
 * that need the cleaned URL should use that directly rather than checking first.
 */
export const isValidInstagramUrl = (url) => normalizeInstagramUrl(url) !== null
