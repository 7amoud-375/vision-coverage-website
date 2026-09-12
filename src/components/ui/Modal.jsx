import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Accessible dialog: closes on Escape or backdrop click, locks background
 * scroll, moves focus in on open and returns it to the trigger on close.
 */
const SIZES = {
  md: 'max-w-lg',
  // Roughly Instagram's own maximum embed width, so the player fills the panel
  // instead of floating in it.
  lg: 'max-w-2xl',
}

export default function Modal({ open, onClose, title, size = 'md', children }) {
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)

  // Callers pass `onClose` as an inline arrow, so its identity changes on every
  // render of the parent. Keeping it in a ref lets the setup effect below depend
  // on `open` alone: if it depended on the callback, then every keystroke in a
  // field whose state lives in the parent would tear the effect down, re-run it,
  // and re-focus the panel - stealing focus after a single letter.
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return

    previouslyFocused.current = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    const FOCUSABLE =
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
      'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      // Focus trap. Without this, Tab walks straight out of the dialog and into
      // the page behind it - the form is still visually on top, so a keyboard
      // or screen-reader user ends up typing into controls they cannot see.
      const panel = panelRef.current
      if (!panel) return

      const items = [...panel.querySelectorAll(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )
      if (items.length === 0) {
        e.preventDefault()
        panel.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]

      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    // Land focus on the first field so the dialog is immediately typeable -
    // these are all short forms, and making people click into the first box is
    // needless friction. Falls back to the panel when there is nothing to fill
    // in (a confirmation dialog, say).
    //
    // preventScroll matters on short screens: focusing an element inside a panel
    // taller than the viewport would otherwise scroll its heading out of sight.
    const firstField = panelRef.current?.querySelector(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
    )
    ;(firstField ?? panelRef.current)?.focus({ preventScroll: true })

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = overflow
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      // No overflow-y-auto here on purpose. Scrolling the backdrop is what made
      // tall dialogs stretch to the full height of the screen and take the whole
      // page with them; the panel caps its own height and scrolls internally.
      className="fixed inset-0 z-50 flex items-end justify-center
                 bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        // dvh rather than vh: on mobile browsers vh includes the address bar,
        // so a 90vh panel still overflowed the visible area.
        className={`flex w-full ${SIZES[size]} max-h-[92dvh] flex-col animate-fade-up
                   rounded-t-2xl border border-line bg-surface shadow-2xl outline-none
                   sm:max-h-[86dvh] sm:rounded-2xl`}
      >
        <header
          className="flex shrink-0 items-center justify-between gap-4 border-b border-line
                     px-5 py-3.5 sm:px-6"
        >
          <h3 className="font-display text-base font-semibold uppercase tracking-[0.12em] text-ink">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>
        </header>

        {/* min-h-0 is what lets this shrink inside the flex column; without it
            the body refuses to scroll and pushes the panel open again.
            overscroll-contain stops the scroll chaining to the page behind. */}
        <div className="scrollbar-brand min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-5">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
