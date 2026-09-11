import InstagramEmbed from './InstagramEmbed'
import LazyMount from './LazyMount'

/**
 * Responsive grid of embeds. Each tile is a flex column with the caption block
 * pinned to the bottom, so rows stay aligned even when Instagram returns
 * embeds a few pixels apart in height.
 *
 * Deliberately restrained - the visual treatment of the gallery is being
 * designed separately, so this stays easy to restyle.
 */
export default function PortfolioGrid({ items }) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.id} className="card flex flex-col overflow-hidden">
          <LazyMount className="p-3">
            <InstagramEmbed url={item.instagram_url} />
          </LazyMount>

          <div className="mt-auto border-t border-line px-4 py-3.5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-lg font-semibold leading-snug text-ink">
                {item.title}
              </h3>
              <span className="mt-0.5 shrink-0 rounded-full border border-line px-2 py-0.5 text-[0.7rem] uppercase tracking-wider text-muted">
                {item.category}
              </span>
            </div>
            {item.description && (
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.description}</p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
