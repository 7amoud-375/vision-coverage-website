// Every state the calendar can put a day in gets named here. Colour alone is
// never the signal - each swatch differs in fill and outline too, so the legend
// still works in greyscale and for colour-blind visitors.
const KEYS = [
  { swatch: 'bg-surface-2 border-line', label: 'Available' },
  { swatch: 'bg-danger/20 border-danger/40', label: 'Booked', strike: true },
  // Past days have no chip at all, so the swatch is an empty dashed outline -
  // a fully transparent one just left the word floating with a gap beside it.
  { swatch: 'bg-transparent border-dashed border-faint', label: 'Past' },
  { swatch: 'bg-accent border-accent', label: 'Selected' },
]

export default function CalendarLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
      {KEYS.map((key) => (
        <li key={key.label} className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`flex h-4 w-4 items-center justify-center rounded border text-[0.6rem] ${key.swatch}`}
          >
            {key.strike && <span className="block h-px w-2.5 bg-danger-soft" />}
          </span>
          {key.label}
        </li>
      ))}
    </ul>
  )
}
