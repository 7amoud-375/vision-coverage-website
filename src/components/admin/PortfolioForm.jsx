import { useState } from 'react'
import { CATEGORIES } from '../../lib/config'
import { normalizeInstagramUrl } from '../../lib/instagram'
import Button from '../ui/Button'
import Field from '../ui/Field'
import Notice from '../ui/Notice'
import VideoPicker from './VideoPicker'

const blank = {
  title: '',
  category: CATEGORIES[0],
  description: '',
  video_url: '',
  thumbnail_url: '',
  instagram_url: '',
}

/**
 * Add / edit form for a portfolio item. Pass `item` to edit, omit it to create.
 *
 * The video is uploaded from the owner's own files, so there is no Instagram
 * link to paste. The Instagram field stays as an optional extra - useful for
 * sending viewers to the original post - and existing Instagram-only items
 * keep working.
 */
export default function PortfolioForm({ item, onSubmit, onCancel }) {
  const [values, setValues] = useState(() =>
    item
      ? {
          title: item.title,
          category: item.category,
          description: item.description ?? '',
          video_url: item.video_url ?? '',
          thumbnail_url: item.thumbnail_url ?? '',
          instagram_url: item.instagram_url ?? '',
        }
      : blank
  )
  const [errors, setErrors] = useState({})
  const [submitError, setSubmitError] = useState(null)
  const [busy, setBusy] = useState(false)

  const update = (field) => (e) => {
    const { value } = e.target
    setValues((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const found = {}
    if (!values.title.trim()) found.title = 'A title is required.'

    // An Instagram link is optional now, but if one is given it has to be real.
    const pastedInstagram = values.instagram_url.trim()
    const permalink = pastedInstagram ? normalizeInstagramUrl(pastedInstagram) : null
    if (pastedInstagram && !permalink) {
      found.instagram_url = 'That is not an Instagram post or reel link.'
    }

    // The database enforces the same rule; catching it here gives a readable
    // message rather than a constraint violation.
    if (!values.video_url && !permalink) {
      found.video_url = 'Upload a video, or paste an Instagram link below.'
    }

    setErrors(found)
    if (Object.keys(found).length > 0) return

    setBusy(true)
    setSubmitError(null)
    const { error } = await onSubmit({
      title: values.title.trim(),
      category: values.category,
      description: values.description.trim() || null,
      video_url: values.video_url || null,
      thumbnail_url: values.thumbnail_url || null,
      instagram_url: permalink,
    })
    setBusy(false)
    if (error) setSubmitError(error)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <VideoPicker
        value={values.video_url}
        poster={values.thumbnail_url}
        error={errors.video_url}
        onChange={({ videoUrl, posterUrl }) => {
          setValues((prev) => ({
            ...prev,
            video_url: videoUrl,
            thumbnail_url: posterUrl || '',
          }))
          setErrors((prev) => ({ ...prev, video_url: undefined }))
        }}
      />

      {/* Paired so the dialog does not become a full-height column, which is
          what made it fill the screen alongside the video picker. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Title"
          required
          value={values.title}
          onChange={update('title')}
          error={errors.title}
          placeholder="Golden Hour Vows"
        />

        <Field
          as="select"
          label="Category"
          required
          value={values.category}
          onChange={update('category')}
        >
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </Field>
      </div>

      <Field
        as="textarea"
        label="Description"
        rows={2}
        value={values.description}
        onChange={update('description')}
        placeholder="One or two lines about the shoot."
      />

      <Field
        label="Instagram link"
        value={values.instagram_url}
        onChange={update('instagram_url')}
        error={errors.instagram_url}
        placeholder="https://www.instagram.com/reel/ABC123/"
        hint="Only if you also want to point viewers at the original post."
      />

      <Notice tone="error">{submitError}</Notice>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {item ? 'Save changes' : 'Add work'}
        </Button>
      </div>
    </form>
  )
}
