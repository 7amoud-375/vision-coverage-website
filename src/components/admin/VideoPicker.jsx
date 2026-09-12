import { useRef, useState } from 'react'
import { uploadVideo, VIDEO_ACCEPT, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS } from '../../lib/storage'
import Button from '../ui/Button'
import Notice from '../ui/Notice'

/**
 * Pick a video from the phone's gallery or the laptop's files and upload it.
 *
 * A poster frame is captured from the video in the browser and uploaded
 * alongside it. That poster is what the public gallery shows - the video file
 * itself is only fetched when a visitor presses play, which is what keeps the
 * hosting bill (and the free tier's egress budget) survivable.
 */
export default function VideoPicker({ value, poster, onChange, error }) {
  const inputRef = useRef(null)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [stage, setStage] = useState('')
  const [localError, setLocalError] = useState(null)

  const maxMB = Math.round(MAX_VIDEO_BYTES / 1024 / 1024)

  const handlePick = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = '' // let the same file be picked again after removal
    if (!file) return

    setBusy(true)
    setLocalError(null)
    setProgress(0)
    setStage('Preparing')

    const { videoUrl, posterUrl, error: err } = await uploadVideo(file, {
      onProgress: setProgress,
      onStage: setStage,
    })

    setBusy(false)
    setStage('')
    setProgress(0)

    if (err) {
      setLocalError(err)
      return
    }

    // Deliberately does NOT delete the file being replaced. If it did, and the
    // owner then hit Cancel, the saved item would still point at a file that no
    // longer exists. Cleanup happens after a successful save instead - see
    // PortfolioTab. The cost is an orphaned upload when an edit is abandoned,
    // which is far cheaper than a broken gallery entry.
    onChange({ videoUrl, posterUrl })
  }

  const handleRemove = () => {
    setLocalError(null)
    onChange({ videoUrl: '', posterUrl: '' })
  }

  return (
    <div>
      <span className="field-label">
        Video
        <span className="ml-0.5 text-accent">*</span>
      </span>

      <div className="rounded-lg border border-line bg-surface-2 p-4">
        {value ? (
          <div className="flex items-start gap-4">
            <div className="h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-base">
              {poster ? (
                <img src={poster} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[0.6rem] uppercase tracking-wider text-faint">
                  No cover
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">Video uploaded</p>
              <p className="mt-0.5 text-xs leading-relaxed text-subtle">
                {poster
                  ? 'A cover frame was captured automatically and is what the gallery shows.'
                  : 'The cover frame could not be read from this file, so the card will show plain text.'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={busy}
                  onClick={() => inputRef.current?.click()}
                >
                  Replace
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={handleRemove} disabled={busy}>
                  Remove
                </Button>
                <a
                  href={value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="self-center text-xs text-muted transition-colors hover:text-accent"
                >
                  Preview
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <svg
              viewBox="0 0 24 24"
              className="mx-auto h-8 w-8 text-faint"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              aria-hidden="true"
            >
              <rect x="2.5" y="6" width="13" height="12" rx="2.5" />
              <path d="M15.5 11l6-3v8l-6-3z" />
            </svg>
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={busy}
                onClick={() => inputRef.current?.click()}
              >
                Choose a video
              </Button>
            </div>
            <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-subtle">
              MP4, MOV or WebM. Up to {maxMB} MB and {MAX_VIDEO_SECONDS} seconds. A cover frame is
              taken from it automatically.
            </p>
          </div>
        )}

        {busy && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-muted">
              <span>{stage}</span>
              {progress > 0 && <span>{progress}%</span>}
            </div>
            <div
              className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-200"
                style={{ width: `${progress || 4}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-subtle">
              Keep this page open until it finishes.
            </p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={VIDEO_ACCEPT}
          onChange={handlePick}
          className="hidden"
        />
      </div>

      {(localError || error) && (
        <Notice tone="error" className="mt-3">
          {localError || error}
        </Notice>
      )}
    </div>
  )
}
