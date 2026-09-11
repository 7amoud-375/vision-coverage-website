import { useMemo } from 'react'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { toDateKey, startOfToday } from '../../lib/dates'

/**
 * Availability calendar. Past days and days present in `unavailable` are
 * disabled; everything else is clickable and reports back a 'YYYY-MM-DD' key.
 *
 * The `unavailable` set is fed by a Realtime subscription upstream, so a day
 * booked by someone else greys out while this calendar is open.
 */
export default function BookingCalendar({ unavailable, selected, onSelect, disabled = false }) {
  const today = useMemo(() => startOfToday(), [])

  const isTaken = (day) => unavailable.has(toDateKey(day))
  const isPast = (day) => day < today

  return (
    <DayPicker
      mode="single"
      selected={selected}
      onSelect={(day) => day && onSelect(day)}
      disabled={disabled ? () => true : [isPast, isTaken]}
      startMonth={today}
      // Outside days are deliberately off. They are real, bookable dates, so
      // dimming them would lie - but leaving them bright puts "1, 2, 3" from
      // next month at the bottom of this month's grid, looking exactly like
      // this month's availability. Showing one month at a time removes the
      // ambiguity entirely; visitors change month with the arrows.
      showOutsideDays={false}
      modifiers={{
        // Past wins over taken: a day that is both gone and booked should read
        // as "gone", not as a reservation the visitor might still chase.
        past: isPast,
        taken: (day) => !isPast(day) && isTaken(day),
        free: (day) => !isPast(day) && !isTaken(day),
      }}
      modifiersClassNames={{
        past: 'day-past',
        taken: 'day-taken',
        free: 'day-free',
      }}
      className="rdp-root"
    />
  )
}
