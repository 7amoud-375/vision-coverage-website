import { useEffect, useMemo, useRef, useState } from 'react'
import { useBookings } from '../../hooks/useBookings'
import { useAvailability } from '../../hooks/useAvailability'
import { formatKeyShort, formatKeyLong, toDateKey, startOfToday } from '../../lib/dates'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Notice from '../ui/Notice'
import Spinner from '../ui/Spinner'
import BlockDatesPanel from './BlockDatesPanel'

const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'rejected']

function BookingRow({ booking, onStatus, busyId }) {
  const busy = busyId === booking.id
  const isPast = booking.date < toDateKey(startOfToday())

  return (
    <li className={`card p-4 sm:p-5 ${isPast ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-display text-lg font-semibold text-ink">
              {formatKeyShort(booking.date)}
            </span>
            <Badge tone={booking.status}>{booking.status}</Badge>
            {isPast && <Badge>past</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            {booking.event_type} &middot; {booking.location}
          </p>
        </div>

        {booking.status === 'pending' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="success"
              disabled={busy}
              onClick={() => onStatus(booking, 'confirmed')}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() => onStatus(booking, 'rejected')}
            >
              Reject
            </Button>
          </div>
        )}

        {booking.status === 'confirmed' && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => onStatus(booking, 'rejected')}
          >
            Cancel booking
          </Button>
        )}

        {booking.status === 'rejected' && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onStatus(booking, 'confirmed')}
          >
            Restore
          </Button>
        )}
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-line pt-4 text-sm sm:grid-cols-2">
        <div className="flex gap-2">
          <dt className="text-muted">Client</dt>
          <dd className="text-ink">{booking.client_name}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-muted">Phone</dt>
          <dd>
            <a href={`tel:${booking.phone.replace(/\s/g, '')}`} className="text-accent hover:underline">
              {booking.phone}
            </a>
          </dd>
        </div>
        {booking.notes && (
          <div className="flex gap-2 sm:col-span-2">
            <dt className="shrink-0 text-muted">Notes</dt>
            <dd className="leading-relaxed text-ink">{booking.notes}</dd>
          </div>
        )}
      </dl>
    </li>
  )
}

export default function ReservationsTab() {
  const { bookings, loading, error, refresh, setStatus } = useBookings()
  const availability = useAvailability()
  const [filter, setFilter] = useState('all')
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [confirming, setConfirming] = useState(null) // { booking, next }

  // `bookings` carries phone numbers, so it is deliberately NOT published over
  // Realtime - a subscription would broadcast client contact details to every
  // listener. The public availability table *is* published, and it changes on
  // exactly the same events, so it works as a privacy-safe "something moved"
  // ping: when a date appears or disappears, refetch the private list with the
  // owner's own credentials. Without this the dashboard sat stale forever.
  const availabilitySignature = availability.rows.map((r) => r.date).join(',')
  const firstSignature = useRef(availabilitySignature)

  // refresh(false) throughout: these fire on their own, and swapping the whole
  // list for a spinner every time a date changes or the tab regains focus would
  // be worse than the staleness it fixes. The manual button does show one.
  useEffect(() => {
    if (availabilitySignature === firstSignature.current) return
    firstSignature.current = availabilitySignature
    refresh(false)
  }, [availabilitySignature, refresh])

  // A phone left on the dashboard overnight should not show yesterday's diary.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  const counts = useMemo(() => {
    const result = { all: bookings.length, pending: 0, confirmed: 0, rejected: 0 }
    for (const b of bookings) result[b.status] += 1
    return result
  }, [bookings])

  const visible = useMemo(
    () => (filter === 'all' ? bookings : bookings.filter((b) => b.status === filter)),
    [bookings, filter]
  )

  const applyStatus = async (id, status) => {
    setBusyId(id)
    setActionError(null)
    const { error: err } = await setStatus(id, status)
    setBusyId(null)
    setConfirming(null)
    if (err) setActionError(err)
    // The database trigger recomputes unavailable_dates; Realtime pushes that
    // back into the shared availability hook, so the block panel stays in step.
  }

  /**
   * Rejecting a booking releases the date to whoever asks next, so cancelling a
   * confirmed one is effectively irreversible - a stray tap on a phone could
   * drop a wedding the owner had already promised. Approving is safe and stays
   * one tap; anything that takes a commitment away asks first.
   */
  const handleStatus = (booking, next) => {
    if (booking.status === 'confirmed' && next === 'rejected') {
      setConfirming({ booking, next })
      return
    }
    applyStatus(booking.id, next)
  }

  return (
    <div className="space-y-8">
      <BlockDatesPanel availability={availability} />

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl font-semibold text-ink">Reservations</h2>
            <button
              type="button"
              onClick={() => refresh()}
              disabled={loading}
              className="rounded-lg border border-line px-2.5 py-1 text-xs text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setFilter(name)}
                className={[
                  'rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-colors',
                  filter === name
                    ? 'border-accent bg-accent text-base'
                    : 'border-line text-muted hover:border-accent/60 hover:text-ink',
                ].join(' ')}
              >
                {name}
                <span className="ml-1.5 opacity-60">{counts[name]}</span>
              </button>
            ))}
          </div>
        </div>

        {actionError && <Notice tone="error" className="mb-4">{actionError}</Notice>}

        {error ? (
          <Notice tone="error">Could not load reservations: {error}</Notice>
        ) : loading ? (
          <Spinner label="Loading reservations" />
        ) : visible.length === 0 ? (
          <Notice>
            {bookings.length === 0
              ? 'No reservation requests yet.'
              : `No ${filter} reservations.`}
          </Notice>
        ) : (
          <ul className="space-y-3">
            {visible.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                onStatus={handleStatus}
                busyId={busyId}
              />
            ))}
          </ul>
        )}
      </section>

      <Modal
        open={Boolean(confirming)}
        onClose={() => setConfirming(null)}
        title="Cancel this booking?"
      >
        {confirming && (
          <div className="space-y-5">
            <p className="leading-relaxed text-muted">
              <strong className="text-ink">{confirming.booking.client_name}</strong> is confirmed
              for <strong className="text-ink">{formatKeyLong(confirming.booking.date)}</strong>.
              Cancelling releases that day back onto the public calendar, where someone else can
              book it straight away.
            </p>
            <Notice tone="error">{actionError}</Notice>
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button
                variant="ghost"
                onClick={() => setConfirming(null)}
                disabled={busyId === confirming.booking.id}
              >
                Keep it
              </Button>
              <Button
                variant="danger"
                loading={busyId === confirming.booking.id}
                onClick={() => applyStatus(confirming.booking.id, confirming.next)}
              >
                Cancel booking
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

