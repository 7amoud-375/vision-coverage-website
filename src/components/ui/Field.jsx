import { useId } from 'react'

/**
 * Label + control + error wrapper shared by the booking form and the dashboard.
 * Renders an <input>, <select> or <textarea> depending on `as`.
 */
export default function Field({
  as = 'input',
  label,
  error,
  hint,
  required,
  className = '',
  children,
  ...props
}) {
  const id = useId()
  const errorId = `${id}-error`
  const Tag = as

  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
        {required && <span className="ml-0.5 text-accent">*</span>}
        {!required && <span className="ml-1 text-xs text-subtle">(optional)</span>}
      </label>

      <Tag
        id={id}
        required={required}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        className={[
          'field-input',
          as === 'textarea' ? 'min-h-[6rem] resize-y' : '',
          error ? 'border-danger focus:border-danger focus:ring-danger' : '',
        ].join(' ')}
        {...props}
      >
        {children}
      </Tag>

      {error ? (
        <p id={errorId} className="mt-1.5 text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-subtle">{hint}</p>
      ) : null}
    </div>
  )
}
