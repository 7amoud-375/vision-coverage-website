const VARIANTS = {
  primary:
    'bg-accent text-base hover:bg-accent-soft focus-visible:ring-accent disabled:hover:bg-accent',
  outline:
    'border border-line bg-transparent text-ink hover:border-accent hover:text-accent',
  ghost: 'bg-transparent text-muted hover:bg-surface-2 hover:text-ink',
  success: 'bg-success text-white hover:bg-success/85',
  danger: 'bg-danger text-white hover:bg-danger/85',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-7 py-3.5 text-base',
}

export default function Button({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled,
  children,
  ...props
}) {
  return (
    <Tag
      disabled={Tag === 'button' ? disabled || loading : undefined}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className,
      ].join(' ')}
      {...props}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </Tag>
  )
}
