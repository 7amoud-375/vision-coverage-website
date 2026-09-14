import { useCallback, useEffect, useState } from 'react'
import {
  deleteStoredPaths,
  findUnreferencedFiles,
  getStorageUsage,
  prettySize,
  STORAGE_BUDGET_BYTES,
  STORAGE_WARN_RATIO,
} from '../../lib/storage'
import Button from '../ui/Button'

/**
 * How much of the storage budget is used.
 *
 * Reads the bucket rather than trusting a running total: files are also removed
 * when work is deleted, and a counter kept in the app would drift. It refreshes
 * whenever `refreshKey` changes, which the Work tab bumps after any upload or
 * delete.
 */
export default function StorageMeter({ refreshKey = 0 }) {
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState(null)
  const [unused, setUnused] = useState(null)
  const [cleaning, setCleaning] = useState(false)
  const [cleanupNote, setCleanupNote] = useState(null)

  const load = useCallback(async () => {
    const result = await getStorageUsage()
    if (result.error) {
      setError(result.error)
      return
    }
    setError(null)
    setUsage(result)

    // Which of those bytes belong to nothing. Reported separately because a
    // meter that will not move after a delete is otherwise unexplainable: the
    // space is real, it just belongs to uploads no entry ever referenced.
    const orphans = await findUnreferencedFiles()
    setUnused(orphans.error ? null : orphans)
  }, [])

  const cleanUp = useCallback(async () => {
    if (!unused?.files.length) return
    setCleaning(true)
    setCleanupNote(null)

    const { removed, error: err } = await deleteStoredPaths(unused.files.map((f) => f.name))
    setCleaning(false)

    setCleanupNote(
      err
        ? `Removed ${removed} of ${unused.files.length}, then stopped: ${err}`
        : `Permanently deleted ${removed} unused ${removed === 1 ? 'file' : 'files'}.`,
    )
    await load()
  }, [unused, load])

  useEffect(() => {
    // Fetch on mount, and again whenever the Work tab reports that stored files
    // changed. The rule cannot see that every setState in load() happens after
    // an await, so it reads this as a synchronous state change in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load, refreshKey])

  if (error || !usage) return null

  const ratio = usage.bytes / STORAGE_BUDGET_BYTES
  const percent = Math.min(100, Math.round(ratio * 100))
  const full = ratio >= 1
  const warning = ratio >= STORAGE_WARN_RATIO
  const remaining = Math.max(0, STORAGE_BUDGET_BYTES - usage.bytes)

  const barColour = full ? 'bg-danger' : warning ? 'bg-warn' : 'bg-accent'
  const edge = full
    ? 'border-danger/40 bg-danger/5'
    : warning
      ? 'border-warn/40 bg-warn/5'
      : 'border-line'

  return (
    <section className={`card mb-5 border p-4 ${edge}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-[0.7rem] font-medium uppercase tracking-brand text-muted">
          Video storage
        </h3>
        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{prettySize(usage.bytes)}</span> of{' '}
          {prettySize(STORAGE_BUDGET_BYTES)}
          <span className="text-subtle"> · {usage.files} files</span>
        </p>
      </div>

      <div
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Video storage used"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${barColour}`}
          style={{ width: `${Math.max(percent, usage.bytes > 0 ? 2 : 0)}%` }}
        />
      </div>

      {/* Only say something when there is something to say. A meter sitting at
          12% does not need a sentence of advice under it. */}
      {full ? (
        <p className="mt-2.5 text-sm text-danger">
          Storage is full. Delete some older work before uploading anything new.
        </p>
      ) : warning ? (
        <p className="mt-2.5 text-sm text-warn">
          {percent}% used - about {prettySize(remaining)} left. Consider deleting older work, or
          exporting new videos at 720p.
        </p>
      ) : null}

      {/* Files belonging to no entry at all. Choosing a video uploads it
          immediately, so abandoning the form - or replacing a video - can strand
          one. They are invisible everywhere else in the dashboard. */}
      {unused?.files.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
          <p className="text-sm text-muted">
            <span className="font-medium text-ink">
              {unused.files.length} unused {unused.files.length === 1 ? 'file' : 'files'}
            </span>{' '}
            ({prettySize(unused.bytes)}) belong to no entry - left over from uploads that were
            never saved.
          </p>
          <Button size="sm" variant="danger" onClick={cleanUp} loading={cleaning}>
            Delete permanently
          </Button>
        </div>
      )}

      {cleanupNote && <p className="mt-2.5 text-sm text-muted">{cleanupNote}</p>}
    </section>
  )
}
