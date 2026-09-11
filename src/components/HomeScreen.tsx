import { BrandMark } from './BrandMark'
import { formatProjectTimestamp, posterAspectRatio } from '../lib/home'
import type { StoredProject } from '../lib/storage'

type HomeScreenProps = {
  loading: boolean
  storageError: boolean
  projects: StoredProject[]
  recovered: StoredProject | undefined
  onOpenProject: (project: StoredProject) => void
  onRecoverSession: (project: StoredProject) => void
  onNewPoster: () => void
  onStartFromWreck: () => void
}

function PosterThumb({ project, recovered }: { project: StoredProject; recovered?: boolean }) {
  return (
    <span className="home-card-thumb" style={{ aspectRatio: posterAspectRatio(project) }}>
      {project.thumbnail ? (
        <img src={project.thumbnail} alt="" />
      ) : (
        <span className="home-card-placeholder">{recovered ? 'Recovered' : 'No preview'}</span>
      )}
    </span>
  )
}

export function HomeScreen({
  loading,
  storageError,
  projects,
  recovered,
  onOpenProject,
  onRecoverSession,
  onNewPoster,
  onStartFromWreck,
}: HomeScreenProps) {
  const empty = !loading && !recovered && projects.length === 0

  return (
    <div className="home-shell">
      <header className="home-topbar glass-bar">
        <div className="brand">
          <BrandMark />
          <div className="brand-copy">
            <h1>Carson</h1>
            <p>Your posters</p>
          </div>
        </div>
        <div className="home-top-actions">
          {!empty ? (
            <button type="button" className="primary-button" onClick={onNewPoster}>
              New poster
            </button>
          ) : null}
          <button type="button" onClick={onStartFromWreck}>
            Start from wreck
          </button>
        </div>
      </header>

      <section className="home-body" aria-label="Home">
        {loading ? <p className="home-status">Loading posters…</p> : null}

        {storageError ? (
          <p className="home-status" role="alert">
            Couldn&apos;t load saved posters. Saves may be unavailable in this browser.
          </p>
        ) : null}

        {empty ? (
          <div className="home-empty">
            <p className="empty">No saved posters yet.</p>
            <p className="hint">New poster picks a size and starts a blank file. Saves in this browser show up here as pictures.</p>
            <button type="button" className="primary-button" onClick={onNewPoster}>
              New poster
            </button>
          </div>
        ) : null}

        {!loading && (recovered || projects.length > 0) ? (
          <ul className="home-grid">
            {recovered ? (
              <li>
                <button
                  type="button"
                  className="home-card home-card-recovered"
                  aria-label={`Recover ${recovered.name}`}
                  onClick={() => onRecoverSession(recovered)}
                >
                  <PosterThumb project={recovered} recovered />
                  <strong>{recovered.name}</strong>
                  <small>Recovered session · {formatProjectTimestamp(recovered.savedAt)}</small>
                </button>
              </li>
            ) : null}
            {projects.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="home-card"
                  aria-label={`Open ${project.name}`}
                  onClick={() => onOpenProject(project)}
                >
                  <PosterThumb project={project} />
                  <strong>{project.name}</strong>
                  <small>{formatProjectTimestamp(project.lastUsedAt ?? project.savedAt)}</small>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  )
}
