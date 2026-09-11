import { useState } from 'react'
import { useAvailability } from '../../hooks/useAvailability'
import { toDateKey, formatKeyLong } from '../../lib/dates'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { whatsappLink } from '../../lib/config'
import BookingCalendar from '../reservation/BookingCalendar'
import CalendarLegend from '../reservation/CalendarLegend'
import BookingForm from '../reservation/BookingForm'
import Modal from '../ui/Modal'
import Notice from '../ui/Notice'
import Spinner from '../ui/Spinner'
import Button from '../ui/Button'

export default function Reservation() {
  const { unavailable, loading, error } = useAvailability()
  const [pendingDate, setPendingDate] = useState(null) // 'YYYY-MM-DD' being requested
  const [confirmedDate, setConfirmedDate] = useState(null) // last successful request

  // Computed once: null when no number is configured, so every WhatsApp
  // affordance below disappears together rather than becoming a dead link.
  const whatsapp = whatsappLink()

  const handleSelect = (day) => {
    setConfirmedDate(null)
    setPendingDate(toDateKey(day))
  }

  const handleSuccess = () => {
    setConfirmedDate(pendingDate)
    setPendingDate(null)
  }

  return (
    <section id="reservation" className="border-t border-line bg-surface/30">
      <div className="section">
        <div className="mb-10 max-w-2xl">
          <p className="section-kicker">Reservations</p>
          <h2 className="section-title">Check a date</h2>
          <p className="mt-4 leading-relaxed text-muted">
            Pick any open day below and send a request. Days struck through in red are already
            taken, and past days are dimmed. The calendar updates live, so you always see what is
            genuinely free.
          </p>

          {/* The floating button steps aside on phones while the calendar is on
              screen, so WhatsApp needs a home inside this section too. */}
          {whatsapp && (
            <p className="mt-4 text-sm text-muted">
              Prefer to just ask?{' '}
              <a
                href={whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-accent underline underline-offset-2 hover:text-accent-soft"
              >
                Message on WhatsApp
              </a>
              .
            </p>
          )}
        </div>

        {!isSupabaseConfigured ? (
          <Notice>
            Online booking is not connected yet.
            {whatsapp && (
              <>
                {' '}
                In the meantime, please{' '}
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent underline underline-offset-2"
                >
                  send a message on WhatsApp
                </a>
                .
              </>
            )}
          </Notice>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-14">
            {/* id is the anchor the floating WhatsApp button watches so it can
                step out of the way of the day grid on phones. */}
            <div id="booking-calendar" className="card w-full p-4 sm:p-6 lg:w-auto">
              {loading ? (
                <div className="min-h-[22rem]">
                  <Spinner label="Loading availability" />
                </div>
              ) : (
                <>
                  <div className="relative flex justify-center">
                    <BookingCalendar unavailable={unavailable} onSelect={handleSelect} />
                  </div>
                  <div className="mt-5 border-t border-line pt-4">
                    <CalendarLegend />
                  </div>
                </>
              )}
            </div>

            <div className="flex flex-col justify-center gap-5">
              {error && <Notice tone="error">Could not load availability: {error}</Notice>}

              {confirmedDate ? (
                <div className="card animate-fade-up p-6">
                  <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-success/15">
                    <svg viewBox="0 0 24 24" className="h-6 w-6 text-success" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h3 className="font-display text-2xl font-semibold text-ink">
                    Your request has been sent
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted">
                    We have pencilled in <strong className="text-ink">{formatKeyLong(confirmedDate)}</strong>{' '}
                    and you will be contacted shortly to confirm the details.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    {whatsapp && (
                      <Button
                        as="a"
                        href={whatsappLink('Hi! I just sent a booking request.')}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="outline"
                      >
                        Message on WhatsApp
                      </Button>
                    )}
                    <Button type="button" variant="ghost" onClick={() => setConfirmedDate(null)}>
                      Book another date
                    </Button>
                  </div>
                </div>
              ) : (
                <ol className="space-y-6">
                  {[
                    ['Pick a date', 'Any day with a solid background is open.'],
                    ['Tell us about the event', 'Name, phone, type of event and location.'],
                    ['Get confirmation', 'The day is held while we call you back to confirm.'],
                  ].map(([title, body], index) => (
                    <li key={title} className="flex gap-4">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-accent/40 font-display text-sm font-semibold text-accent">
                        {index + 1}
                      </span>
                      <div>
                        <h3 className="font-medium text-ink">{title}</h3>
                        <p className="mt-0.5 text-sm leading-relaxed text-muted">{body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </div>

      <Modal
        open={Boolean(pendingDate)}
        onClose={() => setPendingDate(null)}
        title="Request this date"
      >
        {pendingDate && (
          <BookingForm
            dateKey={pendingDate}
            onSuccess={handleSuccess}
            onCancel={() => setPendingDate(null)}
          />
        )}
      </Modal>
    </section>
  )
}
