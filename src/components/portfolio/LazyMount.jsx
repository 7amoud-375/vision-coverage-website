import { useEffect, useRef, useState } from 'react'

/**
 * Defers rendering `children` until the placeholder scrolls near the viewport.
 * Instagram embeds are iframes and are expensive to create, so a gallery of
 * twenty would otherwise cost twenty network round-trips on first paint.
 * Once shown, it stays shown - unmounting would reload the iframe.
 *
 * The placeholder reserves roughly the height a real embed occupies, so the
 * page does not lurch when each one resolves.
 */
export default function LazyMount({ children, rootMargin = '400px', className = '' }) {
  const ref = useRef(null)
  // Browsers without IntersectionObserver render everything immediately. That
  // is decided in the initial state rather than in the effect, so there is no
  // extra render pass just to discover the API is missing.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    if (visible) return
    const node = ref.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin }
    )
    observer.observe(node)

    // Safety net: IntersectionObserver only reports while the page is actually
    // being laid out and painted. In a backgrounded or zero-size frame it can
    // stay silent indefinitely, which would leave the whole gallery as grey
    // skeletons forever. Failing open after a moment costs one wasted render
    // in the rare case and guarantees the work is never simply invisible.
    const fallback = setTimeout(() => setVisible(true), 2500)

    return () => {
      observer.disconnect()
      clearTimeout(fallback)
    }
  }, [visible, rootMargin])

  return (
    <div ref={ref} className={className}>
      {visible ? (
        children
      ) : (
        <div className="min-h-[30rem] animate-pulse rounded-lg bg-surface-2" aria-hidden="true" />
      )}
    </div>
  )
}
