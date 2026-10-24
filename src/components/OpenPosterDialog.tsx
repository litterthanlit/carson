import { formatProjectTimestamp, posterAspectRatio } from '../lib/home'
import type { StoredProject } from '../lib/storage'
import { Dialog } from './Dialog'

type OpenPosterDialogProps = {
  open: boolean
  loading?: boolean
  storageError?: boolean
  projects: StoredProject[]
  onOpen: (project: StoredProject) => void
  onClose: () => void
}

export function OpenPosterDialog({
  open,
  loading = false,
  storageError = false,
  projects,
  onOpen,
  onClose,
}: OpenPosterDialogProps) {
  if (!open) return null

  const empty = !loading && !storageError && projects.length === 0

  return (
    <Dialog labelledBy="open-poster-title" className="file-dialog" onClose={onClose}>
      <h2 id="open-poster-title">Open poster</h2>
      {loading ? <p className="hint">Loading posters…</p> : null}
      {storageError ? (
        <p className="hint" role="alert">
          Couldn&apos;t load saved posters. Saves may be unavailable in this browser.
        </p>
      ) : null}
      {empty ? (
        <p className="empty">No saved posters yet.</p>
      ) : (
        <ul className="open-poster-list">
          {projects.map((project, index) => (
            <li key={project.id}>
              <button
                type="button"
                data-autofocus={index === 0 ? true : undefined}
                className="home-card"
                aria-label={`Open ${project.name}`}
                onClick={() => onOpen(project)}
              >
                <span className="home-card-thumb" style={{ aspectRatio: posterAspectRatio(project) }}>
                  {project.thumbnail ? (
                    <img src={project.thumbnail} alt="" />
                  ) : (
                    <span className="home-card-placeholder">No preview</span>
                  )}
                </span>
                <strong>{project.name}</strong>
                <small>{formatProjectTimestamp(project.lastUsedAt ?? project.savedAt)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="button-row">
        <button type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Dialog>
  )
}
