import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'
import { site } from '../../lib/config'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Notice from '../ui/Notice'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!isSupabaseConfigured) {
      setError('Supabase is not configured. Add your keys to .env and restart.')
      return
    }

    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)

    // Deliberately vague: never reveal whether the address exists.
    if (err) setError('Those details were not recognised.')
    // On success the auth listener in useAuth swaps this screen for the
    // dashboard, so there is nothing to do here.
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-3xl font-semibold text-ink">{site.name}</h1>
          <p className="mt-1.5 text-sm text-muted">Owner dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <Field
            label="Email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Field
            label="Password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <Notice tone="error">{error}</Notice>

          <Button type="submit" loading={busy} className="w-full">
            {busy ? 'Signing in' : 'Sign in'}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-subtle">
          Create this account under Authentication &rarr; Users in Supabase.
        </p>
      </div>
    </main>
  )
}
