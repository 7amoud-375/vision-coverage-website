import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Notice from '../ui/Notice'

// Supabase's own floor is 6 characters. Eight is a more honest minimum for the
// one credential standing between the internet and every client's phone number.
const MIN_LENGTH = 8

export default function AccountTab({ user }) {
  const [values, setValues] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field) => (e) => {
    const { value } = e.target
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
    setDone(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const found = {}
    if (!values.current) found.current = 'Enter your current password.'
    if (!values.next) found.next = 'Choose a new password.'
    else if (values.next.length < MIN_LENGTH)
      found.next = `Use at least ${MIN_LENGTH} characters.`
    else if (values.next === values.current)
      found.next = 'That is the same as your current password.'
    if (values.confirm !== values.next) found.confirm = 'The two passwords do not match.'

    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    setFormError(null)
    setDone(null)

    // Verify the current password first. Supabase does not require it to change
    // a password - the session alone is enough - which means anyone who got hold
    // of an unlocked browser could lock the real owner out. Re-authenticating
    // closes that, at the cost of one extra round trip.
    const { error: reauthError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: values.current,
    })

    if (reauthError) {
      setBusy(false)
      setErrors({ current: 'That is not your current password.' })
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: values.next,
    })

    if (updateError) {
      setBusy(false)
      // Supabase rejects passwords it considers weak or unchanged; its message
      // is clearer than anything generic we would write.
      setFormError(updateError.message)
      return
    }

    // Changing a password should end any other session that was already open,
    // otherwise it does not actually revoke access from whoever prompted it.
    // 'others' deliberately leaves this browser signed in.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' })

    setBusy(false)
    setValues({ current: '', next: '', confirm: '' })
    setDone(
      signOutError
        ? 'Other devices may still be signed in - sign out there manually.'
        : 'Any other device that was signed in has been signed out. This browser stays signed in.'
    )
  }

  return (
    <div className="max-w-lg">
      <h2 className="font-display text-2xl font-semibold text-ink">Account</h2>
      <p className="mt-0.5 text-sm text-muted">
        Signed in as <span className="text-ink">{user.email}</span>
      </p>

      {/* A distinct panel rather than a one-line notice. Changing the password
          that guards every client's contact details deserves an unmistakable
          confirmation - the same treatment the public booking form gets.
          role="status" so it is announced rather than only seen. */}
      {done && (
        <div
          role="status"
          className="mt-5 animate-fade-up rounded-xl border border-success/40 bg-success/10 p-5"
        >
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/20">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-success"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                aria-hidden="true"
              >
                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <h3 className="font-display text-lg font-semibold text-ink">
                Password changed successfully
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted">{done}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="card mt-5 space-y-4 p-5">
        <h3 className="font-display text-base font-semibold uppercase tracking-[0.12em] text-ink">
          Change password
        </h3>

        <Field
          label="Current password"
          type="password"
          required
          autoComplete="current-password"
          value={values.current}
          onChange={update('current')}
          error={errors.current}
        />

        <Field
          label="New password"
          type="password"
          required
          autoComplete="new-password"
          value={values.next}
          onChange={update('next')}
          error={errors.next}
          hint={`At least ${MIN_LENGTH} characters. Save it in a password manager - there is no recovery, only replacement.`}
        />

        <Field
          label="Confirm new password"
          type="password"
          required
          autoComplete="new-password"
          value={values.confirm}
          onChange={update('confirm')}
          error={errors.confirm}
        />

        <Notice tone="error">{formError}</Notice>

        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            {busy ? 'Saving' : 'Change password'}
          </Button>
        </div>
      </form>

      <p className="mt-4 text-xs leading-relaxed text-subtle">
        This changes the password for the account you are signed in as. To add another
        person, or to reset a password you have forgotten, use Authentication &rarr; Users in
        the Supabase dashboard - see <code>supabase/grant-owner.sql</code>.
      </p>
    </div>
  )
}
