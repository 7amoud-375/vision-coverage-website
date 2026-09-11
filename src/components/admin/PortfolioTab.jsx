import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { usePortfolio } from '../../hooks/usePortfolio'
import { formatShort } from '../../lib/dates'
import InstagramEmbed from '../portfolio/InstagramEmbed'
import LazyMount from '../portfolio/LazyMount'
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
    const query =
      editing === 'new'
        ? supabase.from('portfolio_items').insert(payload)
        : supabase.from('portfolio_items').update(payload).eq('id', editing.id)

    const { error: err } = await query
    if (err) return { error: err.message }

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
        <Notice>Nothing published yet. Use &ldquo;Add work&rdquo; to paste your first reel.</Notice>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <li key={item.id} className="card flex flex-col overflow-hidden">
              <LazyMount className="border-b border-line p-3">
                <InstagramEmbed url={item.instagram_url} />
              </LazyMount>

              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-display text-lg font-semibold leading-snug text-ink">
                    {item.title}
                  </h3>
                  <span className="mt-0.5 shrink-0 rounded-full border border-line px-2 py-0.5 text-[0.7rem] uppercase tracking-wider text-muted">
                    {item.category}
                  </span>
                </div>

                {item.description && (
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.description}</p>
                )}

                <p className="mt-2 text-xs text-subtle">
                  Added {formatShort(new Date(item.created_at))}
                </p>

                <div className="mt-4 flex gap-2 border-t border-line pt-3">
                  <Button size="sm" variant="outline" onClick={() => setEditing(item)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(item)}>
                    Delete
                  </Button>
                  <a
                    href={item.instagram_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto self-center text-xs text-muted transition-colors hover:text-accent"
                  >
                    Open on Instagram
                  </a>
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
              public portfolio. The post itself stays on Instagram.
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
