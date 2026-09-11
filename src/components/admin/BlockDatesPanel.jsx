import { useState } from 'react'
import { useBlockedDates } from '../../hooks/useBlockedDates'
import { toDateKey, formatKeyLong } from '../../lib/dates'
import BookingCalendar from '../reservation/BookingCalendar'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import Notice from '../ui/Notice'
import Spinner from '../ui/Spinner'

/**
 * Lets the owner take days off the calendar by hand (holidays, personal time).
 *
 * The list and its notes come from `blocked_dates`, which only the owner can
 * read. The calendar beside it uses the shared public availability set, so days
 * held by real reservations show as taken here too - but they are not in this
 * list and cannot be released from here. Freeing one means rejecting that
 * booking, which keeps the two views honest.
 */
export default function BlockDatesPanel({ availability }) {
  const { unavailable } = availability
  const { blocks, loading, error: listError, block, unblock } = useBlockedDates()

  const [pendingDate, setPendingDate] = useState(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [open, setOpen] = useState(false)

  const closeModal = () => {
    setPendingDate(null)
    setNote('')
    setError(null)
  }

  const handleBlock = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await block(pendingDate, note)
    setBusy(false)
    if (err) {
      setError(err)
      return
    }
    closeModal()
  }

  const handleUnblock = async (dateKey) => {
    setError(null)
    const { error: err } = await unblock(dateKey)
    if (err) setError(err)
  }

  return (
    <section className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-surface-2"
      >
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Blocked days</h2>
          <p className="mt-0.5 text-sm text-muted">
            {loading
              ? 'Loading your days off...'
              : blocks.length === 0
                ? 'No days blocked by hand.'
                : `${blocks.length} day${blocks.length === 1 ? '' : 's'} blocked by hand.`}
          </p>
        </div>
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="grid gap-8 border-t border-line p-5 lg:grid-cols-[auto_minmax(0,1fr)]">
          <div>
            <p className="mb-3 text-sm text-muted">
              Tap any open day to take it off the public calendar.
            </p>
            <BookingCalendar
              unavailable={unavailable}
              onSelect={(day) => {
                setError(null)
                setPendingDate(toDateKey(day))
              }}
            />
          </div>

          <div>
            {(error || listError) && (
              <Notice tone="error" className="mb-4">
                {error || listError}
              </Notice>
            )}

            {loading ? (
              <Spinner label="Loading blocked days" />
            ) : blocks.length === 0 ? (
              <Notice>Nothing blocked yet. Booked days are managed from the list below.</Notice>
            ) : (
              <ul className="space-y-2">
                {blocks.map((row) => (
                  <li
                    key={row.date}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{formatKeyLong(row.date)}</p>
                      {row.note && <p className="mt-0.5 truncate text-xs text-muted">{row.note}</p>}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => handleUnblock(row.date)}>
                      Unblock
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Modal open={Boolean(pendingDate)} onClose={closeModal} title="Block this day">
        {pendingDate && (
          <form onSubmit={handleBlock} className="space-y-4">
            <p className="text-muted">
              <strong className="text-ink">{formatKeyLong(pendingDate)}</strong> will be marked
              unavailable on the public calendar and cannot be requested.
            </p>

            <Field
              label="Reason"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Holiday, travel, already committed..."
              maxLength={500}
              hint="Private to you - it is stored in an owner-only table and never sent to the public site."
            />

            <Notice tone="error">{error}</Notice>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={closeModal} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Block day
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </section>
  )
}
