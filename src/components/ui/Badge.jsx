const TONES = {
  pending: 'bg-warn/15 text-warn border-warn/30',
  confirmed: 'bg-success/15 text-success border-success/30',
  rejected: 'bg-danger/15 text-danger border-danger/30',
  neutral: 'bg-surface-2 text-muted border-line',
}

export default function Badge({ tone = 'neutral', children, className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full border px-2.5 py-0.5',
        'text-xs font-medium capitalize',
        TONES[tone] ?? TONES.neutral,
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
