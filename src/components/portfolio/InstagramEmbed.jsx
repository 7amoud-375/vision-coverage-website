import { useEffect, useRef, useState } from 'react'
import { ensureEmbedScript, processEmbeds, normalizeInstagramUrl } from '../../lib/instagram'

// How long to wait for Instagram's widget before assuming it is never coming.
const GIVE_UP_AFTER = 6000

/**
 * Renders one Instagram post/reel using Instagram's public embed widget.
 * Nothing is uploaded or re-hosted - the video streams straight from Instagram.
 *
 * The blockquote is written with innerHTML rather than JSX on purpose:
 * embed.js *replaces* the node with its own iframe, and letting React try to
 * reconcile a subtree that a third-party script has rewritten causes the embed
 * to blank out on re-render. Owning the node manually keeps the two apart.
 */
export default function InstagramEmbed({ url }) {
  const holder = useRef(null)
  const permalink = normalizeInstagramUrl(url)
  const [status, setStatus] = useState('loading') // loading | ready | blocked

  useEffect(() => {
    const node = holder.current
    if (!node || !permalink) return

    ensureEmbedScript()
    setStatus('loading')

    // No data-instgrm-captioned: captions vary from one line to twenty, and
    // that single attribute was what made every tile in the grid a different
    // height. Without it the embeds come back near-identical, so rows line up.
    node.innerHTML =
      `<blockquote class="instagram-media" ` +
      `data-instgrm-permalink="${permalink}" data-instgrm-version="14" ` +
      `style="background:#fff;border:0;border-radius:8px;margin:0;padding:0;width:100%"></blockquote>`

    const cancel = processEmbeds()

    const observer = new MutationObserver(() => {
      if (node.querySelector('iframe')) setStatus('ready')
    })
    observer.observe(node, { childList: true, subtree: true })

    // uBlock, Brave shields, DNS filtering and corporate proxies all block
    // instagram.com outright. Waiting forever would leave the gallery as grey
    // skeletons for those visitors - a portfolio site with no portfolio. After
    // a reasonable wait, show a real link instead so the work is still
    // reachable in one tap.
    const timer = setTimeout(() => {
      setStatus((current) => (current === 'ready' ? current : 'blocked'))
    }, GIVE_UP_AFTER)

    return () => {
      cancel()
      observer.disconnect()
      clearTimeout(timer)
      node.innerHTML = ''
    }
  }, [permalink])

  if (!permalink) {
    return (
      <div className="flex aspect-[4/5] items-center justify-center rounded-lg border border-dashed border-line px-4 text-center text-sm text-muted">
        This item does not have a valid Instagram link yet.
      </div>
    )
  }

  return (
    // Instagram's widget always renders on white and offers no dark variant, so
    // rather than letting a white rectangle collide with the near-black card,
    // it sits on a light mat - the tile reads as a framed print instead.
    <div className="relative min-h-[30rem] overflow-hidden rounded-lg bg-[#fafafa] p-1.5">
      {status === 'loading' && (
        <div className="absolute inset-1.5 animate-pulse rounded bg-[#e8e8ea]" aria-hidden="true" />
      )}

      {status === 'blocked' && (
        <div className="absolute inset-1.5 flex flex-col items-center justify-center gap-3 rounded bg-surface-2 px-6 text-center">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
          </svg>
          <p className="text-sm leading-relaxed text-muted">
            This clip lives on Instagram, and your browser is blocking their player.
          </p>
          <a
            href={permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-soft"
          >
            Watch it on Instagram
          </a>
        </div>
      )}

      <div ref={holder} className={status === 'blocked' ? 'invisible' : 'relative'} />
    </div>
  )
}
