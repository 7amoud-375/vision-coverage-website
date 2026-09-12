import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Notice from '../ui/Notice'
import Wordmark from '../brand/Wordmark'
import Watermark from '../brand/Watermark'

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
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16">
      <Watermark position="center" size="xl" opacity="text-ink/[0.03]" from="sm" />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Wordmark />
          <p className="mt-4 text-xs uppercase tracking-brand text-muted">Owner dashboard</p>
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
