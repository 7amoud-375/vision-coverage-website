import { FILTERS } from '../../lib/config'

export default function CategoryFilter({ active, onChange, counts }) {
  return (
    <div role="tablist" aria-label="Filter work by category" className="flex flex-wrap gap-2">
      {FILTERS.map((filter) => {
        const selected = filter === active
        return (
          <button
            key={filter}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(filter)}
            className={[
              'rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              selected
                ? 'border-accent bg-accent text-base'
                : 'border-line bg-transparent text-muted hover:border-accent/60 hover:text-ink',
            ].join(' ')}
          >
            {filter}
            {counts?.[filter] != null && (
              <span className={selected ? 'ml-1.5 opacity-70' : 'ml-1.5 opacity-50'}>
                {counts[filter]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
