import { useState } from 'react'
import { useSiteContact } from '../../hooks/useSiteContact'
import SocialIcon from '../brand/SocialIcon'
import { PLATFORMS } from '../../lib/socialPlatforms'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Notice from '../ui/Notice'
import Spinner from '../ui/Spinner'

const MAX_LINKS = 8

export default function ContactTab() {
  const { whatsapp, phone, email, socials, ready, error, save } = useSiteContact()

  if (!ready) return <Spinner label="Loading contact details" />

  return (
    <ContactForm
      initial={{ whatsapp: whatsapp ?? '', phone: phone ?? '', email: email ?? '', socials }}
      loadError={error}
      onSave={save}
    />
  )
}

/**
 * Split from the loader so the form takes its initial value as a prop and owns
 * its state from there - no effect copying props into state, and a Realtime
 * update arriving mid-edit cannot wipe what is being typed.
 */
function ContactForm({ initial, loadError, onSave }) {
  const [links, setLinks] = useState(initial.socials)
  const [details, setDetails] = useState({
    whatsapp: initial.whatsapp,
    phone: initial.phone,
    email: initial.email,
  })

  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const [done, setDone] = useState(null)

  const dirty = () => {
    setDone(null)
    setFormError(null)
  }

  const updateDetail = (field) => (e) => {
    setDetails((prev) => ({ ...prev, [field]: e.target.value }))
    dirty()
  }

  const updateLink = (index, key) => (e) => {
    const { value } = e.target
    setLinks((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
    dirty()
  }

  const addLink = () => {
    // Offer the first platform not already used, so adding three in a row does
    // not produce three Instagrams to fix by hand.
    const used = new Set(links.map((l) => l.platform))
    const next = PLATFORMS.find((p) => !used.has(p.id)) ?? PLATFORMS[0]
    setLinks((prev) => [...prev, { platform: next.id, url: '' }])
    dirty()
  }

  const removeLink = (index) => {
    setLinks((prev) => prev.filter((_, i) => i !== index))
    dirty()
  }

  const move = (index, by) => {
    const target = index + by
    if (target < 0 || target >= links.length) return
    setLinks((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    dirty()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const cleaned = links
      .map((l) => ({ platform: l.platform, url: l.url.trim() }))
      .filter((l) => l.url)

    const bad = cleaned.find((l) => !/^https?:\/\/.+\..+/.test(l.url))
    if (bad) {
      setFormError(
        `The ${bad.platform} link does not look like a full web address. It needs to start with https://`
      )
      return
    }

    // wa.me needs bare digits, so accept whatever punctuation was typed and
    // strip it rather than rejecting a perfectly good number.
    const whatsapp = details.whatsapp.replace(/D/g, '')
    if (details.whatsapp && (whatsapp.length < 6 || whatsapp.length > 20)) {
      setFormError('That WhatsApp number does not look right. Use the full international number.')
      return
    }

    const email = details.email.trim()
    if (email && !/^[^@s]+@[^@s]+.[^@s]+$/.test(email)) {
      setFormError('That email address does not look right.')
      return
    }

    setBusy(true)
    setFormError(null)
    setDone(null)

    const { error: err } = await onSave({
      whatsapp,
      phone: details.phone.trim(),
      email,
      socials: cleaned,
    })
    setBusy(false)

    if (err) {
      setFormError(
        err.includes('site_contact')
          ? 'The site_contact table is missing columns. Run supabase/migration-contact-details.sql first.'
          : err
      )
      return
    }

    setLinks(cleaned)
    setDetails({ whatsapp, phone: details.phone.trim(), email })
    setDone(
      cleaned.length
        ? `Saved. ${cleaned.length} link${cleaned.length === 1 ? '' : 's'} now show in the footer.`
        : 'Saved. With no links set, the Follow section is hidden entirely.'
    )
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl font-semibold text-ink">Contact</h2>
      <p className="mt-0.5 text-sm text-muted">
        Everything on the public site that tells a client how to reach you.
      </p>

      {loadError && (
        <Notice tone="error" className="mt-4">
          Could not load the current links: {loadError}
        </Notice>
      )}

      {done && (
        <div
          role="status"
          className="mt-5 animate-fade-up rounded-xl border border-success/40 bg-success/10 p-4"
        >
          <p className="text-sm text-success">{done}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="card p-5">
          <h3 className="font-display text-base font-semibold uppercase tracking-[0.12em] text-ink">
            How clients reach you
          </h3>

          <div className="mt-4 space-y-4">
            <Field
              label="WhatsApp number"
              type="tel"
              inputMode="tel"
              value={details.whatsapp}
              onChange={updateDetail('whatsapp')}
              placeholder="+20 100 200 3000"
              maxLength={32}
              hint="Full international number. This is what the floating WhatsApp button uses - leave it empty and the button does not appear at all."
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Phone"
                type="tel"
                inputMode="tel"
                value={details.phone}
                onChange={updateDetail('phone')}
                placeholder="+20 100 200 3000"
                maxLength={32}
              />
              <Field
                label="Email"
                type="email"
                inputMode="email"
                value={details.email}
                onChange={updateDetail('email')}
                placeholder="hello@visionzekra.com"
                maxLength={160}
              />
            </div>
          </div>
        </div>

        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-semibold uppercase tracking-[0.12em] text-ink">
              Social links
            </h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addLink}
              disabled={links.length >= MAX_LINKS}
            >
              Add link
            </Button>
          </div>

          {links.length === 0 ? (
            <Notice className="mt-4">
              No links yet. Add one, or leave this empty to hide the Follow section.
            </Notice>
          ) : (
            <ul className="mt-4 space-y-3">
              {links.map((link, index) => (
                <li key={index} className="rounded-lg border border-line bg-surface-2/60 p-3.5">
                  <div className="flex items-start gap-3">
                    <span className="mt-8 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-muted">
                      <SocialIcon platform={link.platform} />
                    </span>

                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                      <Field
                        as="select"
                        label="Platform"
                        value={link.platform}
                        onChange={updateLink(index, 'platform')}
                      >
                        {PLATFORMS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </Field>

                      <Field
                        label="Link"
                        type="url"
                        inputMode="url"
                        value={link.url}
                        onChange={updateLink(index, 'url')}
                        placeholder={
                          PLATFORMS.find((p) => p.id === link.platform)?.placeholder ??
                          'https://example.com'
                        }
                        maxLength={300}
                      />
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      aria-label="Move up"
                      className="rounded-lg px-2 py-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={index === links.length - 1}
                      aria-label="Move down"
                      className="rounded-lg px-2 py-1 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30"
                    >
                      ↓
                    </button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeLink(index)}>
                      Remove
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-4 text-xs leading-relaxed text-subtle">
            Paste the full address, including <code>https://</code>. The order here is the order
            the icons appear in the footer. Rows left blank are dropped when you save.
          </p>
        </div>

        <Notice tone="error">{formError}</Notice>

        <div className="flex justify-end">
          <Button type="submit" loading={busy}>
            {busy ? 'Saving' : 'Save contact details'}
          </Button>
        </div>
      </form>

    </div>
  )
}
