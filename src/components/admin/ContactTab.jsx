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
  const { socials, ready, error, save } = useSiteContact()

  if (!ready) return <Spinner label="Loading links" />

  return <ContactForm initial={socials} loadError={error} onSave={save} />
}

/**
 * Split from the loader so the form takes its initial value as a prop and owns
 * its state from there - no effect copying props into state, and a Realtime
 * update arriving mid-edit cannot wipe what is being typed.
 */
function ContactForm({ initial, loadError, onSave }) {
  const [links, setLinks] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const [done, setDone] = useState(null)

  const dirty = () => {
    setDone(null)
    setFormError(null)
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

    setBusy(true)
    setFormError(null)
    setDone(null)

    const { error: err } = await onSave(cleaned)
    setBusy(false)

    if (err) {
      setFormError(
        err.includes('site_contact')
          ? 'The site_contact table does not exist yet. Run supabase/migration-social-links.sql first.'
          : err
      )
      return
    }

    setLinks(cleaned)
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
        The social icons in the footer of the public site.
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
            {busy ? 'Saving' : 'Save links'}
          </Button>
        </div>
      </form>

    </div>
  )
}
