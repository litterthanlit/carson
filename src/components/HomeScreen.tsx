import { useRef, useState, type DragEvent } from 'react'
import { ArrowUpRight, FolderOpen, ImagePlus, Plus } from 'lucide-react'
import { BrandMark } from './BrandMark'
import { formatProjectTimestamp, posterAspectRatio } from '../lib/home'
import type { StoredProject } from '../lib/storage'

export type HomeStartPreset = 'a3' | 'instagram' | 'square'

type HomeScreenProps = {
  loading: boolean
  storageError: boolean
  projects: StoredProject[]
  recovered: StoredProject | undefined
  onOpenProject: (project: StoredProject) => void
  onRecoverSession: (project: StoredProject) => void
  onNewPoster: () => void
  onStartFromWreck: () => void
  /** Start a blank poster at a preset without the size dialog. */
  onStartPreset?: (preset: HomeStartPreset) => void
  /** Start a poster sized to an image, with the image placed full bleed. */
  onStartFromImage?: (file: File) => void
  onOpenPoster?: () => void
}

const START_PRESETS: { id: HomeStartPreset; title: string; meta: string; ratio: string }[] = [
  { id: 'a3', title: 'Blank A3', meta: '297 × 420 mm · 300 dpi', ratio: '297 / 420' },
  { id: 'instagram', title: 'Instagram', meta: '1080 × 1350 px', ratio: '4 / 5' },
  { id: 'square', title: 'Square', meta: '1600 × 1600 px', ratio: '1 / 1' },
]

function PosterThumb({ project, recovered }: { project: StoredProject; recovered?: boolean }) {
  return (
    <span className="home-card-thumb" style={{ aspectRatio: posterAspectRatio(project) }}>
      {project.thumbnail ? (
        <img src={project.thumbnail} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="home-card-placeholder">{recovered ? 'Recovered' : 'No preview'}</span>
      )}
    </span>
  )
}

/** A tiny vector echo of the wreck poster, so the card shows what it starts. */
function WreckArt() {
  return (
    <svg className="home-wreck-art" viewBox="0 0 297 420" aria-hidden="true" focusable="false">
      <rect width="297" height="420" fill="#f6f1e6" />
      <rect x="172" y="143" width="48" height="100" fill="#05b6d4" opacity="0.42" transform="rotate(4 196 193)" />
      <rect x="18" y="130" width="220" height="1.2" fill="#a3e635" transform="rotate(-11 128 130)" />
      <g transform="rotate(-6 140 80)" fill="#161616" fontFamily="'Archivo Black', Impact, sans-serif" fontSize="40" letterSpacing="-1.5">
        <text x="26" y="78">RAY GUN</text>
        <text x="30" y="112">CUT TYPE</text>
      </g>
      <rect x="38" y="200" width="214" height="19" fill="#e11d48" opacity="0.92" transform="rotate(3 145 210)" />
      <g transform="rotate(8 110 250)" fill="#27272a" fontFamily="'Courier New', monospace" fontSize="8.5" letterSpacing="1.8">
        <text x="50" y="246">manual fragments / image</text>
        <text x="50" y="258">noise / broken grids</text>
      </g>
      <g transform="rotate(90 250 190)" fill="#111" fontFamily="'Archivo Black', sans-serif" fontSize="11">
        <text x="232" y="190">legibility is not neutral</text>
      </g>
      <rect x="20" y="327" width="232" height="11" fill="#111" transform="rotate(-1 136 332)" />
    </svg>
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
  onStartPreset,
  onStartFromImage,
  onOpenPoster,
}: HomeScreenProps) {
  const empty = !loading && !recovered && projects.length === 0
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const dragDepth = useRef(0)
  const [dropActive, setDropActive] = useState(false)

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files')

  const handleDrop = (event: DragEvent) => {
    if (!hasFiles(event)) return
    event.preventDefault()
    dragDepth.current = 0
    setDropActive(false)
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith('image/'))
    if (file) onStartFromImage?.(file)
  }

  return (
    <div
      className="home-shell"
      onDragEnter={(event) => {
        if (!onStartFromImage || !hasFiles(event)) return
        dragDepth.current += 1
        setDropActive(true)
      }}
      onDragOver={(event) => {
        if (onStartFromImage && hasFiles(event)) event.preventDefault()
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDropActive(false)
      }}
      onDrop={handleDrop}
    >
      <header className="home-topbar glass-bar" role="banner" aria-label="Carson">
        <div className="brand">
          <BrandMark />
          <div className="brand-copy">
            <h1>Carson</h1>
            <p>Poster studio</p>
          </div>
        </div>
        <div className="home-top-actions">
          {onOpenPoster ? (
            <button type="button" className="home-ghost-button" onClick={onOpenPoster} title="Open a saved poster (⌘O)">
              <FolderOpen size={14} aria-hidden />
              Open poster
            </button>
          ) : null}
          <button type="button" className="primary-button" onClick={onNewPoster} title="Pick any size (⌘N)">
            <Plus size={14} aria-hidden />
            New poster
          </button>
        </div>
      </header>

      <section className="home-body" aria-label="Home">
        <div className="home-hero">
          <div className="home-hero-copy">
            <p className="home-kicker">Start something</p>
            <h2 className="home-display">
              Make a mess on&nbsp;purpose.
            </h2>
            <p className="home-lede">
              Type, image, and accident as materials. Every treatment stays editable, every roll of the dice has a seed, and
              everything prints.
            </p>
          </div>

          <div className="home-starts" role="list" aria-label="Start a poster">
            <div role="listitem" className="home-start-wreck-item">
              <button type="button" className="home-start home-start-wreck" aria-label="Start from wreck" onClick={onStartFromWreck}>
                <span className="home-start-art">
                  <WreckArt />
                </span>
                <span className="home-start-copy">
                  <strong>Wreck this poster</strong>
                  <small>A finished layout to take apart</small>
                </span>
                <ArrowUpRight className="home-start-arrow" size={16} aria-hidden />
              </button>
            </div>
            {onStartPreset
              ? START_PRESETS.map((preset) => (
                  <div role="listitem" key={preset.id}>
                    <button
                      type="button"
                      className="home-start home-start-preset"
                      aria-label={`${preset.title}, ${preset.meta}`}
                      onClick={() => onStartPreset(preset.id)}
                    >
                      <span className="home-start-frame" style={{ aspectRatio: preset.ratio }} aria-hidden />
                      <span className="home-start-copy">
                        <strong>{preset.title}</strong>
                        <small>{preset.meta}</small>
                      </span>
                    </button>
                  </div>
                ))
              : null}
            {onStartFromImage ? (
              <div role="listitem" className="home-start-image-item">
                <button
                  type="button"
                  className={dropActive ? 'home-start home-start-image is-drop' : 'home-start home-start-image'}
                  aria-label="Start from an image"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImagePlus size={18} aria-hidden />
                  <span className="home-start-copy">
                    <strong>Start from an image</strong>
                    <small>Drop a photo anywhere, or browse</small>
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  className="visually-hidden"
                  type="file"
                  accept="image/*"
                  tabIndex={-1}
                  aria-hidden="true"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) onStartFromImage(file)
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="home-recents">
          <div className="home-section-head">
            <h2>Recent</h2>
            {!loading && projects.length ? <span className="home-count">{projects.length}</span> : null}
          </div>

          {loading ? <p className="home-status">Loading posters…</p> : null}

          {storageError ? (
            <p className="home-status" role="alert">
              Couldn&apos;t load saved posters. Saves may be unavailable in this browser.
            </p>
          ) : null}

          {empty ? (
            <div className="home-empty">
              <p className="empty">No saved posters yet.</p>
              <p className="hint">Saves in this browser show up here as pictures.</p>
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
        </div>
      </section>

      {dropActive ? (
        <div className="home-drop-overlay" aria-hidden="true">
          <ImagePlus size={28} />
          <strong>Drop to start a poster from this image</strong>
        </div>
      ) : null}
    </div>
  )
}
