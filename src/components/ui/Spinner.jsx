export default function Spinner({ label = 'Loading', className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-10 text-muted ${className}`}>
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent"
      />
      <span className="text-sm">{label}...</span>
    </div>
  )
}
