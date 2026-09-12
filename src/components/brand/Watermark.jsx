import Mark from './Mark'

// Literal class strings on purpose. Tailwind generates utilities by scanning
// source text, so a template like `rotate-[${n}deg]` would never be built -
// and rotation has to come from a Tailwind class rather than an inline style,
// or it would overwrite the translate used by the centred positions.
const POSITIONS = {
  'top-right': '-right-20 -top-24',
  'top-left': '-left-24 -top-28',
  'bottom-right': '-right-28 -bottom-32',
  'bottom-left': '-left-24 -bottom-28',
  'center-right': '-right-32 top-1/2 -translate-y-1/2',
  'center-left': '-left-32 top-1/2 -translate-y-1/2',
  center: 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
}

const SIZES = {
  sm: 'h-48 w-48',
  md: 'h-72 w-72',
  lg: 'h-[28rem] w-[28rem]',
  xl: 'h-[40rem] w-[40rem]',
}

const ROTATIONS = {
  0: '',
  6: 'rotate-6',
  12: 'rotate-12',
  '-6': '-rotate-6',
  '-12': '-rotate-12',
  180: 'rotate-180',
}

const BREAKPOINTS = {
  sm: 'hidden sm:block',
  md: 'hidden md:block',
  lg: 'hidden lg:block',
  always: 'block',
}

/**
 * The chevron as a background watermark.
 *
 * Placement is varied per section but never actually random: a random position
 * would re-roll on every render and read as accidental rather than designed.
 * Each instance gets its own corner, scale and slight rotation so the eye
 * travels, while the composition stays put.
 *
 * The rules that keep this decoration rather than noise:
 *   - very low opacity, so it never competes with content
 *   - large and bleeding off an edge, so it reads as a graphic device
 *   - pointer-events-none and aria-hidden, so it is invisible to taps and to
 *     screen readers
 *   - hidden on small screens, where there is no room to spare
 *
 * The parent section needs `relative overflow-hidden` for the bleed to clip.
 */
export default function Watermark({
  position = 'top-right',
  size = 'lg',
  rotate = 0,
  opacity = 'text-ink/[0.035]',
  from = 'md',
}) {
  return (
    <Mark
      strokeWidth={3}
      className={[
        'pointer-events-none absolute select-none',
        POSITIONS[position] ?? POSITIONS['top-right'],
        SIZES[size] ?? SIZES.lg,
        ROTATIONS[rotate] ?? '',
        BREAKPOINTS[from] ?? BREAKPOINTS.md,
        opacity,
      ]
        .filter(Boolean)
        .join(' ')}
    />
  )
}
