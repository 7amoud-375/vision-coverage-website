import { useRef, useState } from 'react'
import { useAboutContent } from '../../hooks/useAboutContent'
import { about as aboutDefaults } from '../../lib/config'
import { uploadImage, deleteStoredFile, IMAGE_ACCEPT } from '../../lib/storage'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Notice from '../ui/Notice'
import Spinner from '../ui/Spinner'

const MAX_HIGHLIGHTS = 8

/**
 * Loads the current content, then mounts the form once with it.
 *
 * The split matters: the form takes its initial values as props and owns its
 * state from there, so there is no effect copying props into state - and a
 * Realtime update arriving mid-edit cannot wipe what is being typed.
 */
export default function AboutTab() {
  const { content, loading, error, save } = useAboutContent()

  if (loading) return <Spinner label="Loading About content" />

  return (
    <AboutForm
      loadError={error}
      onSave={save}
      initialPhoto={content?.photo_url ?? ''}
      initialHighlights={
        content?.highlights?.length ? content.highlights : aboutDefaults.highlights
      }
    />
  )
}

function AboutForm({ initialPhoto, initialHighlights, loadError, onSave }) {
  const fileRef = useRef(null)

  const [photoUrl, setPhotoUrl] = useState(initialPhoto)
  const [highlights, setHighlights] = useState(initialHighlights)
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState(null)
  const [done, setDone] = useState(null)
  // What the row held when this form opened, so a replaced image is binned only
  // once its replacement is actually saved.
  const savedPhoto = useRef(initialPhoto)

  const dirty = () => {
    setDone(null)
    setFormError(null)
  }

  const updateRow = (index, key) => (e) => {
    const { value } = e.target
    setHighlights((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)))
    dirty()
  }

  const addRow = () => {
    setHighlights((prev) => [...prev, { label: '', value: '' }])
    dirty()
  }

  const removeRow = (index) => {
    setHighlights((prev) => prev.filter((_, i) => i !== index))
    dirty()
  }

  const handlePickPhoto = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setUploading(true)
    dirty()
    const { url, error: err } = await uploadImage(file)
    setUploading(false)

    if (err) {
      setFormError(err)
      return
    }
    setPhotoUrl(url)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Drop rows the owner left completely empty rather than saving blanks, but
    // reject half-filled ones - a value with no label renders as a stray line.
    const cleaned = highlights
      .map((row) => ({ label: row.label.trim(), value: row.value.trim() }))
      .filter((row) => row.label || row.value)

    const halfFilled = cleaned.find((row) => !row.label || !row.value)
    if (halfFilled) {
      setFormError('Every highlight needs both a label and a value. Remove any you do not want.')
      return
    }

    setBusy(true)
    setFormError(null)
    setDone(null)

    const { error: err } = await onSave({ photoUrl, highlights: cleaned })
    setBusy(false)

    if (err) {
      setFormError(
        err.includes('about_content')
          ? 'The about_content table does not exist yet. Run supabase/migration-about-content.sql first.'
          : err
      )
      return
    }

    // Only now is the old image definitely unreferenced.
    if (savedPhoto.current && savedPhoto.current !== photoUrl) {
      deleteStoredFile(savedPhoto.current)
    }
    savedPhoto.current = photoUrl

    setHighlights(cleaned)
    setDone('The About section has been updated. The public page already shows it.')
  }

  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-2xl font-semibold text-ink">About</h2>
      <p className="mt-0.5 text-sm text-muted">
        The portrait and the equipment list on the public About section.
      </p>

      {loadError && (
        <Notice tone="error" className="mt-4">
          Could not load the current content: {loadError}
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
        {/* ---------------- portrait ---------------- */}
        <div className="card p-5">
          <h3 className="font-display text-base font-semibold uppercase tracking-[0.12em] text-ink">
            Portrait
          </h3>

          <div className="mt-4 flex flex-wrap items-start gap-4">
            <div className="h-32 w-26 shrink-0 overflow-hidden rounded-lg border border-line bg-surface-2">
              {photoUrl ? (
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-center text-[0.6rem] uppercase tracking-wider text-faint">
                  No photo
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {photoUrl ? 'Replace photo' : 'Choose photo'}
                </Button>
                {photoUrl && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={uploading}
                    onClick={() => {
                      setPhotoUrl('')
                      dirty()
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <p className="mt-2.5 text-xs leading-relaxed text-subtle">
                JPG, PNG or WebP. It is resized in your browser before uploading, so a photo
                straight off a phone is fine. Shown in a tall 4:5 frame, so a portrait
                orientation crops best.
              </p>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={IMAGE_ACCEPT}
            onChange={handlePickPhoto}
            className="hidden"
          />
        </div>

        {/* ---------------- highlights ---------------- */}
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-semibold uppercase tracking-[0.12em] text-ink">
              Equipment &amp; style
            </h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addRow}
              disabled={highlights.length >= MAX_HIGHLIGHTS}
            >
              Add row
            </Button>
          </div>

          {highlights.length === 0 ? (
            <Notice className="mt-4">
              No rows. Add one, or leave it empty to hide the list entirely.
            </Notice>
          ) : (
            <ul className="mt-4 space-y-4">
              {highlights.map((row, index) => (
                <li
                  key={index}
                  className="rounded-lg border border-line bg-surface-2/60 p-3.5"
                >
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <Field
                      label="Label"
                      value={row.label}
                      onChange={updateRow(index, 'label')}
                      placeholder="Cameras"
                      maxLength={40}
                    />
                    <Field
                      label="Detail"
                      value={row.value}
                      onChange={updateRow(index, 'value')}
                      placeholder="Sony FX3 + a7 IV, dual-body coverage"
                      maxLength={160}
                    />
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button type="button" size="sm" variant="ghost" onClick={() => removeRow(index)}>
                      Remove row
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {highlights.length >= MAX_HIGHLIGHTS && (
            <p className="mt-3 text-xs text-subtle">
              That is the maximum of {MAX_HIGHLIGHTS} rows - the grid stops reading well past
              that.
            </p>
          )}
        </div>

        <Notice tone="error">{formError}</Notice>

        <div className="flex justify-end">
          <Button type="submit" loading={busy} disabled={uploading}>
            {busy ? 'Saving' : 'Save changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
