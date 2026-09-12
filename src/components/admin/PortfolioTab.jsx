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

export default function PortfolioTab() {
  const { items, loading, error, refresh } = usePortfolio()
  const [editing, setEditing] = useState(null) // item object, or 'new'
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [busy, setBusy] = useState(false)

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

      {actionError && <Notice tone="error" className="mb-4">{actionError}</Notice>}

      {error ? (
        <Notice tone="error">Could not load the portfolio: {error}</Notice>
      ) : loading ? (
        <Spinner label="Loading work" />
      ) : items.length === 0 ? (
        <Notice>Nothing published yet. Use &ldquo;Add work&rdquo; to add your first reel.</Notice>
      ) : (
        // A plain list rather than a grid of players: the dashboard is for
        // managing entries, and mounting an Instagram iframe per row made it
        // slow to load for no benefit.
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="card flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap">
              <div className="flex h-20 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-2">
                {item.thumbnail_url ? (
                  <img
                    src={item.thumbnail_url}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="px-1 text-center text-[0.6rem] uppercase tracking-wider text-faint">
                    No cover
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-semibold leading-snug text-ink">
                    {item.title}
                  </h3>
                  <span className="rounded-full border border-line px-2 py-0.5 text-[0.65rem] uppercase tracking-wider text-muted">
                    {item.category}
                  </span>
                </div>
                {item.description && (
                  <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">
                    {item.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-subtle">
                  Added {formatShort(new Date(item.created_at))}
                  {' · '}
                  <a
                    href={item.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-accent"
                  >
                    View on Instagram
                  </a>
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(item)}>
                  Edit
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(item)}>
                  Delete
                </Button>
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
