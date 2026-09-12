import { useMemo, useState } from 'react'
import { usePortfolio } from '../../hooks/usePortfolio'
import { FILTERS } from '../../lib/config'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import CategoryFilter from '../portfolio/CategoryFilter'
import PortfolioGrid from '../portfolio/PortfolioGrid'
import InstagramEmbed from '../portfolio/InstagramEmbed'
import VideoPlayer from '../portfolio/VideoPlayer'
import Modal from '../ui/Modal'
import Notice from '../ui/Notice'
import Spinner from '../ui/Spinner'

export default function Portfolio() {
  const { items, loading, error } = usePortfolio()
  const [filter, setFilter] = useState('All')
  const [playing, setPlaying] = useState(null)

  const counts = useMemo(() => {
    const result = { All: items.length }
    for (const name of FILTERS) {
      if (name !== 'All') result[name] = items.filter((i) => i.category === name).length
    }
    return result
  }, [items])

  const visible = useMemo(
    () => (filter === 'All' ? items : items.filter((i) => i.category === filter)),
    [items, filter]
  )

  return (
    <section id="portfolio" className="border-t border-line">
      <div className="section">
        <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="section-kicker">Selected work</p>
            <h2 className="section-title">Portfolio</h2>
          </div>
          <CategoryFilter active={filter} onChange={setFilter} counts={counts} />
        </div>

        {!isSupabaseConfigured ? (
          <Notice>
            The gallery is not connected yet. Add your Supabase keys to <code>.env</code> to load
            work from the dashboard.
          </Notice>
        ) : error ? (
          <Notice tone="error">Could not load the portfolio: {error}</Notice>
        ) : loading ? (
          <Spinner label="Loading work" />
        ) : visible.length === 0 ? (
          <Notice>
            {items.length === 0
              ? 'No work has been published yet - check back soon.'
              : `Nothing filed under ${filter} yet.`}
          </Notice>
        ) : (
          <PortfolioGrid items={visible} onOpen={setPlaying} />
        )}
      </div>

      {/*
        The player only ever exists here, mounted on demand. Nothing streams
        while someone is merely browsing the grid - which is what keeps the
        bandwidth budget intact. Uploaded video is preferred; the Instagram
        embed is the fallback for older items that only have a link.
      */}
      <Modal
        open={Boolean(playing)}
        onClose={() => setPlaying(null)}
        title={playing?.title ?? ''}
        size="lg"
      >
        {playing && (
          <div className="space-y-4">
            {playing.video_url ? (
              <VideoPlayer
                src={playing.video_url}
                poster={playing.thumbnail_url}
                title={playing.title}
              />
            ) : (
              <InstagramEmbed url={playing.instagram_url} />
            )}

            {playing.description && (
              <p className="text-sm leading-relaxed text-muted">{playing.description}</p>
            )}

            {playing.instagram_url && (
              <a
                href={playing.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-medium text-accent underline underline-offset-4 hover:text-accent-soft"
              >
                See the original post on Instagram
              </a>
            )}
          </div>
        )}
      </Modal>
    </section>
  )
}
