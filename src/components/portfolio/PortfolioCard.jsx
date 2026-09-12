import { useState } from 'react'
import Mark from '../brand/Mark'

/**
 * One piece of work as a dark, on-brand tile.
 *
 * Deliberately NOT an Instagram embed. Instagram's player is a cross-origin
 * iframe: its white background and "View more on Instagram" footer cannot be
 * restyled from outside, so a grid of them looks like holes punched in a dark
 * page. The card shows the owner's own poster image instead and defers the
 * player until someone actually asks for it, which also means the gallery
 * loads with zero third-party iframes.
 */
export default function PortfolioCard({ item, onOpen }) {
  const [imageFailed, setImageFailed] = useState(false)
  const hasPoster = Boolean(item.thumbnail_url) && !imageFailed

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      aria-label={`Play ${item.title}`}
      className="group relative block w-full overflow-hidden rounded-xl border border-line
                 bg-surface text-left transition-colors hover:border-accent/60
                 focus-visible:border-accent"
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface-2">
        {hasPoster ? (
          <img
            src={item.thumbnail_url}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500
                       group-hover:scale-[1.04]"
          />
        ) : (
          // No poster set: the brand chevron rather than a broken image or a
          // generic camera glyph, so an empty tile still looks like the brand.
          <div className="flex h-full w-full items-center justify-center">
            <Mark className="h-20 w-20 text-ink/10" strokeWidth={5} />
          </div>
        )}

        {/* Keeps the caption legible over any photograph. */}
        <div className="absolute inset-0 bg-gradient-to-t from-base/95 via-base/25 to-transparent" />

        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2
                     items-center justify-center rounded-full border border-white/30
                     bg-black/45 backdrop-blur-sm transition-all duration-300
                     group-hover:scale-110 group-hover:border-accent group-hover:bg-accent"
        >
          <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6 text-white transition-colors group-hover:text-base" fill="currentColor">
            <path d="M8 5.5v13l11-6.5z" />
          </svg>
        </span>

        <div className="absolute inset-x-0 bottom-0 p-4">
          <div className="flex items-end justify-between gap-3">
            <h3 className="font-display text-lg font-semibold leading-snug text-ink">
              {item.title}
            </h3>
            <span className="shrink-0 rounded-full border border-white/20 bg-black/35 px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-ink backdrop-blur-sm">
              {item.category}
            </span>
          </div>
          {item.description && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">
              {item.description}
            </p>
          )}
        </div>
      </div>
    </button>
  )
}
