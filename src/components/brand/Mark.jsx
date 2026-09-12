/**
 * The Vision Zekra chevron: a downward triangle drawn as an open outline, with
 * a smaller inverted triangle nested inside it.
 *
 * This is a clean geometric interpretation of the logo, built for use as a
 * decorative motif - the navbar mark, the hero watermark, section ornaments,
 * the play badge. It is intentionally a *motif* rather than a reproduction:
 * for the real logo, drop the file in /public and point `brand.logo` at it in
 * src/lib/config.js, and the navbar and footer will use that instead.
 *
 * Everything is stroked in `currentColor`, so it takes the colour of whatever
 * it sits in and works at any size.
 */
export default function Mark({ className = '', strokeWidth = 6, title }) {
  return (
    <svg
      viewBox="0 0 120 108"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinejoin="miter"
      role={title ? 'img' : 'presentation'}
      aria-hidden={title ? undefined : 'true'}
      aria-label={title}
    >
      {/* Outer chevron - a large triangle pointing down, open across the top. */}
      <path d="M6 8 L60 100 L114 8" />

      {/* The top edge, broken either side of the inner form, the way the logo
          leaves a gap for the nested triangle to sit in. */}
      <path d="M6 8 L44 8" />
      <path d="M76 8 L114 8" />

      {/* Inner inverted triangle, offset right of centre. */}
      <path d="M48 14 L70 14 L59 52 Z" />
    </svg>
  )
}
