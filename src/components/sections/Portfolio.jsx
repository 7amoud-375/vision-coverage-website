import { useMemo, useState } from 'react'
import { usePortfolio } from '../../hooks/usePortfolio'
import { FILTERS } from '../../lib/config'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import CategoryFilter from '../portfolio/CategoryFilter'
import PortfolioGrid from '../portfolio/PortfolioGrid'
import Notice from '../ui/Notice'
import Spinner from '../ui/Spinner'

export default function Portfolio() {
  const { items, loading, error } = usePortfolio()
  const [filter, setFilter] = useState('All')

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
          <PortfolioGrid items={visible} />
        )}
      </div>
    </section>
  )
}
