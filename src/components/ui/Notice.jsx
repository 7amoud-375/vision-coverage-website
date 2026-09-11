const TONES = {
  info: 'border-line bg-surface-2 text-muted',
  error: 'border-danger/40 bg-danger/10 text-danger',
  success: 'border-success/40 bg-success/10 text-success',
}

export default function Notice({ tone = 'info', children, className = '' }) {
  if (!children) return null
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-lg border px-4 py-3 text-sm ${TONES[tone]} ${className}`}
    >
      {children}
    </p>
  )
}
