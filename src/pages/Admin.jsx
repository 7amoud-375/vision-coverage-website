import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { site } from '../lib/config'
import AdminLogin from '../components/admin/AdminLogin'
import ReservationsTab from '../components/admin/ReservationsTab'
import PortfolioTab from '../components/admin/PortfolioTab'
import AccountTab from '../components/admin/AccountTab'
import Button from '../components/ui/Button'
import Notice from '../components/ui/Notice'
import Spinner from '../components/ui/Spinner'

const TABS = [
  { id: 'reservations', label: 'Reservations' },
  { id: 'portfolio', label: 'Work' },
  { id: 'account', label: 'Account' },
]

/**
 * Owner dashboard. Not linked from anywhere in the public site - reachable by
 * typing /admin. The gate below is a convenience: the real protection is row
 * level security in Postgres, which refuses to return booking rows to anyone
 * who is not signed in, whatever the browser asks for.
 */
export default function Admin() {
  const { user, isOwner, loading } = useAuth()
  const [tab, setTab] = useState('reservations')

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto max-w-md px-5 py-24">
        <Notice tone="error">
          Supabase is not configured. Copy <code>.env.example</code> to <code>.env</code>, fill in
          your project URL and anon key, then restart the dev server.
        </Notice>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Spinner label="Checking your session" />
      </main>
    )
  }

  if (!user) return <AdminLogin />

  // Signed in, but this account is not in the `admins` table. Every policy will
  // correctly return nothing, so say why instead of showing empty tabs.
  if (!isOwner) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-16">
        <h1 className="font-display text-3xl font-semibold text-ink">Not your dashboard</h1>
        <p className="mt-3 leading-relaxed text-muted">
          You are signed in as <span className="text-ink">{user.email}</span>, but this account has
          not been granted owner access, so there is nothing here for it.
        </p>
        <p className="mt-3 text-sm text-subtle">
          If this should be an owner account, run <code>supabase/grant-owner.sql</code> in the
          Supabase SQL editor with this address, then reload.
        </p>
        <div className="mt-6">
          <Button variant="outline" onClick={() => supabase.auth.signOut()}>
            Sign out
          </Button>
        </div>
      </main>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-base/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-semibold text-ink">{site.name}</h1>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              to="/"
              className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              View site
            </Link>
            <Button size="sm" variant="outline" onClick={() => supabase.auth.signOut()}>
              Sign out
            </Button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-content gap-1 px-5 sm:px-8">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? 'page' : undefined}
              className={[
                '-mb-px border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                tab === item.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-muted hover:text-ink',
              ].join(' ')}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-content px-5 py-8 sm:px-8">
        {tab === 'reservations' && <ReservationsTab />}
        {tab === 'portfolio' && <PortfolioTab />}
        {tab === 'account' && <AccountTab user={user} />}
      </main>
    </div>
  )
}
