import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { usePortfolio } from '../../hooks/usePortfolio'
import { deleteStoredFile } from '../../lib/storage'
import { formatShort } from '../../lib/dates'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Notice from '../ui/Notice'
import Spinner from '../ui/Spinner'
import PortfolioForm from './PortfolioForm'
import StorageMeter from './StorageMeter'
import Mark from '../brand/Mark'

export default function PortfolioTab() {
  const { items, loading, error, refresh } = usePortfolio()
  const [editing, setEditing] = useState(null) // item object, or 'new'
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)
  // Bumped after anything that adds or removes stored files, so the meter
  // re-reads the bucket rather than showing a figure from before the change.
  const [storageKey, setStorageKey] = useState(0)

  const handleSubmit = async (payload) => {
    const isNew = editing === 'new'
    const previous = isNew
      ? null
      : { video: editing.video_url, poster: editing.thumbnail_url }

    const query = isNew
      ? supabase.from('portfolio_items').insert(payload)
      : supabase.from('portfolio_items').update(payload).eq('id', editing.id)

    const { error: err } = await query
    if (err) return { error: err.message }

    // Only now that the row definitely points at the new files is it safe to
    // bin the old ones. Doing this inside the picker would strand the item on a
    // deleted file if the owner replaced a video and then cancelled.
    if (previous) {
      if (previous.video && previous.video !== payload.video_url) {
        deleteStoredFile(previous.video)
      }
      if (previous.poster && previous.poster !== payload.thumbnail_url) {
        deleteStoredFile(previous.poster)
      }
    }

    // Realtime normally delivers the change, but refreshing keeps the dashboard
    // correct even if the socket dropped.
    await refresh()
    setStorageKey((n) => n + 1)
    setEditing(null)
    return { error: null }
  }

  const handleDelete = async () => {
    setBusy(true)
    setActionError(null)
    const { error: err } = await supabase
      .from('portfolio_items')
      .delete()
      .eq('id', confirmDelete.id)
    setBusy(false)

    if (err) {
      setActionError(err.message)
      return
    }

    // Bin the stored poster too, so the bucket does not fill with orphans.
    if (confirmDelete.thumbnail_url) deleteStoredFile(confirmDelete.thumbnail_url)
    if (confirmDelete.video_url) deleteStoredFile(confirmDelete.video_url)

    setConfirmDelete(null)
    setStorageKey((n) => n + 1)
    await refresh()
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Work</h2>
          <p className="mt-0.5 text-sm text-muted">
            Changes appear on the public portfolio straight away.
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>Add work</Button>
      </div>

      <StorageMeter refreshKey={storageKey} />

      {actionError && <Notice tone="error" className="mb-4">{actionError}</Notice>}

      {error ? (
        <Notice tone="error">Could not load the portfolio: {error}</Notice>
      ) : loading ? (
        <Spinner label="Loading work" />
      ) : items.length === 0 ? (
        <Notice>Nothing published yet. Use &ldquo;Add work&rdquo; to add your first reel.</Notice>
      ) : (
        // Cards rather than rows: each entry is mostly a picture, so showing the
        // poster properly makes the list scannable. Still no players mounted -
        // the dashboard is for managing entries, and an iframe or a <video> per
        // card would make it slow to load for no benefit.
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="card flex flex-col overflow-hidden">
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-surface-2">
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Mark className="h-14 w-14 text-ink/10" strokeWidth={5} />
                  </div>
                )}

                <span className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-ink backdrop-blur-sm">
                  {item.category}
                </span>

                {/* Which kind of media this entry actually holds - useful when a
                    gallery mixes uploads with older Instagram-only items. */}
                <span className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[0.6rem] uppercase tracking-wider text-muted backdrop-blur-sm">
                  {item.video_url ? 'Video' : 'Instagram'}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h3 className="font-display text-base font-semibold leading-snug text-ink">
                  {item.title}
                </h3>

                {item.description && (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
                    {item.description}
                  </p>
                )}

                <div className="mt-4 flex flex-1 items-end justify-between gap-3 border-t border-line pt-3">
                  <div className="min-w-0 text-xs text-subtle">
                    <p>Added {formatShort(new Date(item.created_at))}</p>
                    {/* Only rendered when there is something to link to -
                        instagram_url is optional now that videos are uploaded,
                        so this used to be a dead link on every upload. */}
                    {(item.video_url || item.instagram_url) && (
                      <a
                        href={item.video_url || item.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="transition-colors hover:text-accent"
                      >
                        {item.video_url ? 'Open video' : 'View on Instagram'}
                      </a>
                    )}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="outline" onClick={() => setEditing(item)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(item)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add work' : 'Edit work'}
      >
        {editing && (
          <PortfolioForm
            item={editing === 'new' ? null : editing}
            onSubmit={handleSubmit}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Delete this item?"
      >
        {confirmDelete && (
          <div className="space-y-5">
            <p className="leading-relaxed text-muted">
              <strong className="text-ink">{confirmDelete.title}</strong> will be removed from the
              public portfolio, along with its cover image. The post itself stays on Instagram.
            </p>
            <Notice tone="error">{actionError}</Notice>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={busy}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={busy}>
                Delete
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
