import { useState } from 'react'
import { EVENT_TYPES } from '../../lib/config'
import { createBooking } from '../../lib/bookings'
import { formatKeyLong } from '../../lib/dates'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Notice from '../ui/Notice'

const EMPTY = { clientName: '', phone: '', eventType: EVENT_TYPES[0], location: '', notes: '' }

// Permissive on purpose: international formats vary wildly and a rejected
// number is worse than a slightly odd one the owner can still call.
const PHONE_PATTERN = /^[+()\d][\d\s()+-]{6,19}$/

function validate(values) {
  const errors = {}
  if (!values.clientName.trim()) errors.clientName = 'Please tell us your name.'
  if (!values.phone.trim()) errors.phone = 'A phone number is required so we can confirm.'
  else if (!PHONE_PATTERN.test(values.phone.trim()))
    errors.phone = 'That does not look like a phone number.'
  if (!values.location.trim()) errors.location = 'Where is the event taking place?'
  return errors
}

export default function BookingForm({ dateKey, onSuccess, onCancel }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const update = (field) => (e) => {
    const { value } = e.target
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const found = validate(values)
    setErrors(found)
    if (Object.keys(found).length > 0) return

    setSubmitting(true)
    setSubmitError(null)
    const { error } = await createBooking({ date: dateKey, ...values })
    setSubmitting(false)

    if (error) setSubmitError(error)
    else onSuccess()
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3">
        <p className="text-xs uppercase tracking-[0.18em] text-accent">Requested date</p>
        <p className="mt-0.5 font-display text-lg font-semibold text-ink">
          {formatKeyLong(dateKey)}
        </p>
      </div>

      <Field
        label="Full name"
        required
        autoComplete="name"
        value={values.clientName}
        onChange={update('clientName')}
        error={errors.clientName}
        placeholder="Jane Doe"
      />

      <Field
        label="Phone number"
        required
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={values.phone}
        onChange={update('phone')}
        error={errors.phone}
        placeholder="+20 123 456 7890"
      />

      <Field
        as="select"
        label="Event type"
        required
        value={values.eventType}
        onChange={update('eventType')}
      >
        {EVENT_TYPES.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </Field>

      <Field
        label="Location"
        required
        value={values.location}
        onChange={update('location')}
        error={errors.location}
        placeholder="Venue or city"
      />

      <Field
        as="textarea"
        label="Notes"
        rows={3}
        value={values.notes}
        onChange={update('notes')}
        placeholder="Timings, guest count, anything else worth knowing."
      />

      <Notice tone="error">{submitError}</Notice>

      <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" loading={submitting}>
          {submitting ? 'Sending' : 'Send request'}
        </Button>
      </div>

      <p className="text-xs leading-relaxed text-subtle">
        Sending a request does not charge you anything. The date is held while we confirm by phone.
      </p>
    </form>
  )
}
