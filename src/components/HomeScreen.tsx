import { useRef, useState, type DragEvent } from 'react'
import { FolderOpen, ImagePlus, Plus } from 'lucide-react'
import { BrandMark } from './BrandMark'
import { formatProjectTimestamp, posterAspectRatio } from '../lib/home'
import type { StoredProject } from '../lib/storage'
import { ThemeToggle } from './ThemeToggle'

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

/**
 * A vector echo of the seed poster (lib/swissPoster) at A3 millimetres: the
 * same 12-column grid, folio, RAY GUN masthead with its red full stop,
 * numerals band and transit line.
 */
function WreckArt() {
  const ink = '#0a0a0a'
  const soft = '#5b6066'
  const font = "Helvetica, 'Helvetica Neue', Arial, sans-serif"
  const stations: [number, string, string][] = [
    [20.8, 'Scatter', 'Throw it'],
    [86.2, 'Xerox', 'Copy it'],
    [151.6, 'Re-roll', 'Roll again'],
    [217, 'Undo', 'Walk it back'],
  ]
  const materials: [number, string, string][] = [
    [20.8, '01', 'Type'],
    [108, '02', 'Grid'],
    [195.2, '03', 'Accident'],
  ]
  return (
    <svg className="home-wreck-art" viewBox="0 0 297 420" aria-hidden="true" focusable="false">
      <rect width="297" height="420" fill="#ffffff" />
      <g fontFamily={font} fontSize="3.9">
        <text x="20.8" y="24.2" fill={ink}>Issue 01</text>
        <text x="108" y="24.2" fill={soft}>A poster made to be taken apart</text>
        <text x="276.2" y="24.2" fill={soft} textAnchor="end">Autumn 2026</text>
      </g>
      <rect x="20.8" y="28.8" width="255.4" height="0.7" fill={ink} />
      {/* textLength pins the masthead to its measured width so the red stop lands after the N in any fallback font. */}
      <text
        x="20.8"
        y="92"
        fill={ink}
        fontFamily={font}
        fontSize="55"
        fontWeight="700"
        textLength="210"
        lengthAdjust="spacingAndGlyphs"
      >
        RAY GUN
      </text>
      <rect x="236.5" y="83.7" width="8.3" height="8.3" fill="#e4002b" />
      <text fill={ink} fontFamily={font} fontSize="5.9">
        <tspan x="20.8" y="124">Legibility is not neutral. A clean Swiss layout on a</tspan>
        <tspan x="20.8" y="131.7">twelve-column grid, built to be taken apart one accident</tspan>
        <tspan x="20.8" y="139.4">at a time.</tspan>
      </text>
      <g fontFamily={font} fill={ink}>
        {materials.map(([x, numeral, title]) => (
          <g key={numeral}>
            <text x={x} y="290" fontSize="17.8" fontWeight="700">{numeral}</text>
            <text x={x} y="300.5" fontSize="5" fontWeight="700">{title}</text>
            <rect x={x} y="304" width="44" height="1.4" fill={soft} opacity="0.5" />
            <rect x={x} y="309" width="34" height="1.4" fill={soft} opacity="0.5" />
          </g>
        ))}
      </g>
      <rect x="20.8" y="344.4" width="255.4" height="0.8" fill={ink} />
      <g fontFamily={font} fontSize="5">
        {stations.map(([x, label, verb]) => (
          <g key={label}>
            <circle cx={x + 2.5} cy="344.8" r="2.5" fill={ink} />
            <text x={x} y="358.1" fill={ink} fontWeight="700">{label}</text>
            <text x={x} y="364.3" fill={soft}>{verb}</text>
          </g>
        ))}
      </g>
      <rect x="20.8" y="389.3" width="255.4" height="0.35" fill={ink} />
      <g fontFamily={font} fontSize="5" fill={soft}>
        <text x="20.8" y="397.9">Set in Helvetica on a twelve-column grid. One red full stop.</text>
        <text x="276.2" y="397.9" textAnchor="end">Made in Carson</text>
      </g>
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
          <ThemeToggle className="home-ghost-button theme-toggle" />
          {onOpenPoster ? (
            <button type="button" className="home-ghost-button" onClick={onOpenPoster} title="Open a saved poster (⌘O)">
              <FolderOpen size={14} aria-hidden />
              <span className="home-button-label">Open poster</span>
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
          <h2 className="home-display">Make a mess on&nbsp;purpose.</h2>
          <p className="home-lede">
            Type, image, and accident as materials. Every treatment stays editable, and everything prints.
          </p>
        </div>

        <div className="home-section">
          <div className="home-section-head">
            <h2>New poster</h2>
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
                  <span className="home-start-icon" aria-hidden>
                    <ImagePlus size={18} />
                  </span>
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

        <div className="home-section home-recents">
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
