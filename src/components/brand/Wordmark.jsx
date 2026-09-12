import { site, brand } from '../../lib/config'
import Mark from './Mark'

/**
 * The lockup: chevron plus the stacked wordmark, matching how the logo reads -
 * VISION, a ruled MEDIA COVER, then ZEKRA.
 *
 * `compact` drops the ruled middle line, for the navbar where vertical space is
 * tight. When a real logo file is configured it is used in place of the built-in
 * mark, so swapping in the client's own artwork needs no code change.
 */
export default function Wordmark({ compact = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      {brand.logo ? (
        <img
          src={brand.logo}
          alt={site.name}
          className={compact ? 'h-9 w-9 object-contain' : 'h-14 w-14 object-contain'}
        />
      ) : (
        <Mark className={compact ? 'h-7 w-7 shrink-0' : 'h-11 w-11 shrink-0'} strokeWidth={7} />
      )}

      <span className="flex flex-col leading-none">
        <span
          className={`font-display font-semibold tracking-[0.2em] text-ink ${
            compact ? 'text-sm' : 'text-xl'
          }`}
        >
          {site.wordmarkTop}
        </span>

        {!compact && (
          <span className="mt-1.5 flex items-center gap-2">
            <span className="h-px w-3 bg-muted/60" aria-hidden="true" />
            <span className="font-display text-[0.6rem] tracking-[0.3em] text-muted">
              {site.wordmarkRule}
            </span>
            <span className="h-px w-3 bg-muted/60" aria-hidden="true" />
          </span>
        )}

        <span
          className={`font-display font-semibold tracking-[0.3em] text-ink ${
            compact ? 'text-[0.65rem] mt-0.5' : 'text-base mt-1.5'
          }`}
        >
          {site.wordmarkBottom}
        </span>
      </span>
    </span>
  )
}
