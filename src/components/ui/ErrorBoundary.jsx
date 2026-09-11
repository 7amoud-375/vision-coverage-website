import { Component } from 'react'

/**
 * Catches render-time errors so one broken component cannot blank the whole
 * site. Without this, any throw anywhere in the tree leaves the visitor staring
 * at an empty page with no way forward - and on a site whose job is to take
 * bookings, that is a lost client rather than a bug report.
 *
 * Must be a class: there is still no hook equivalent of componentDidCatch.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Kept as console output on purpose - no third-party error reporter is
    // wired up, and adding one silently would be a privacy decision to make
    // deliberately rather than by accident.
    console.error('[ErrorBoundary]', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-3xl font-semibold text-ink">Something went wrong</h1>
        <p className="max-w-md leading-relaxed text-muted">
          Sorry - this page hit an unexpected error. Reloading usually clears it.
        </p>

        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-base transition-colors hover:bg-accent-soft"
          >
            Reload the page
          </button>
          <a
            href="/"
            className="rounded-lg border border-line px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
          >
            Back to the homepage
          </a>
        </div>

        {import.meta.env.DEV && (
          <pre className="mt-6 max-w-2xl overflow-x-auto rounded-lg border border-line bg-surface p-4 text-left text-xs text-danger-soft">
            {String(error?.stack || error)}
          </pre>
        )}
      </main>
    )
  }
}
