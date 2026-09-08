import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import type { StoredProject } from '../lib/storage'

function formatSavedAt(savedAt: string) {
  const date = new Date(savedAt)
  if (Number.isNaN(date.getTime())) return 'Unknown date'
  return date.toLocaleString()
}

function formatPresetSize(project: StoredProject) {
  const width = project.preset.width
  const height = project.preset.height
  if (!width || !height) return project.preset.name
  return `${project.preset.name} · ${width} × ${height}`
}

function PosterCard({
  project,
  highlighted,
  openLabel,
  onOpen,
  onRename,
  onDuplicate,
  onDelete,
}: {
  project: StoredProject
  highlighted?: boolean
  openLabel: string
  onOpen: () => void
  onRename?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
}) {
  return (
    <li className={highlighted ? 'poster-card is-highlighted' : 'poster-card'}>
      <button type="button" className="poster-card-open" onClick={onOpen} aria-label={openLabel} title={openLabel}>
        {project.thumbnail ? (
          <img src={project.thumbnail} alt="" />
        ) : (
          <div className="variant-thumb-placeholder" aria-hidden />
        )}
        <strong>{project.name}</strong>
        <small>{formatSavedAt(project.savedAt)}</small>
        <small>{formatPresetSize(project)}</small>
      </button>
      {onRename || onDuplicate || onDelete ? (
        <div className="variant-actions">
          {onRename ? (
            <button type="button" onClick={onRename} aria-label={`Rename ${project.name}`}>
              <Pencil size={12} />
              Rename
            </button>
          ) : null}
          {onDuplicate ? (
            <button type="button" onClick={onDuplicate} aria-label={`Duplicate ${project.name}`}>
              <Copy size={12} />
              Duplicate
            </button>
          ) : null}
          {onDelete ? (
            <button type="button" onClick={onDelete} aria-label={`Delete saved poster ${project.name}`}>
              <Trash2 size={12} />
              Delete
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

export function PosterDashboard({
  projects,
  autosave,
  highlightedId,
  onNewPoster,
  onOpenProject,
  onResumeAutosave,
  onRenameProject,
  onDuplicateProject,
  onDeleteProject,
}: {
  projects: StoredProject[]
  autosave?: StoredProject
  highlightedId?: string | null
  onNewPoster: () => void
  onOpenProject: (project: StoredProject) => void
  onResumeAutosave: (project: StoredProject) => void
  onRenameProject: (project: StoredProject) => void
  onDuplicateProject: (project: StoredProject) => void
  onDeleteProject: (project: StoredProject) => void
}) {
  return (
    <main className="poster-dashboard" aria-label="Posters">
      <header className="poster-dashboard-header">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 1452 1311" aria-hidden="true">
            <rect x="339" y="0" width="851" height="395" rx="20" />
            <rect x="0" y="460" width="395" height="851" rx="20" />
            <rect x="601" y="916" width="851" height="395" rx="20" />
          </svg>
          <div className="brand-copy">
            <p className="poster-dashboard-kicker">Carson</p>
            <h1>Posters</h1>
          </div>
        </div>
        <button type="button" className="primary-button" onClick={onNewPoster}>
          <Plus size={14} />
          New poster
        </button>
      </header>
      <p className="hint">Saved in this browser. Open a poster, or start a new one.</p>
      {autosave ? (
        <section className="poster-resume" aria-label="Resume session">
          <h2>Resume</h2>
          <ul className="poster-dashboard-grid">
            <PosterCard
              project={autosave}
              openLabel={`Resume “${autosave.name}”`}
              onOpen={() => onResumeAutosave(autosave)}
            />
          </ul>
        </section>
      ) : null}
      {projects.length === 0 ? (
        <p className="poster-dashboard-empty">No saved posters yet.</p>
      ) : (
        <ul className="poster-dashboard-grid">
          {projects.map((project) => (
            <PosterCard
              key={project.id}
              project={project}
              highlighted={project.id === highlightedId}
              openLabel={`Load “${project.name}”`}
              onOpen={() => onOpenProject(project)}
              onRename={() => onRenameProject(project)}
              onDuplicate={() => onDuplicateProject(project)}
              onDelete={() => onDeleteProject(project)}
            />
          ))}
        </ul>
      )}
    </main>
  )
}
