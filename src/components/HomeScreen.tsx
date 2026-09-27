import { useRef, useState, type DragEvent } from 'react'
import { FolderOpen, ImagePlus, Plus } from 'lucide-react'
import { BrandMark } from './BrandMark'
import { formatProjectTimestamp, posterAspectRatio } from '../lib/home'
import type { StoredProject } from '../lib/storage'
import { ThemeToggle } from './ThemeToggle'
import { buildCarsonPoster, CARSON_PAPER, type CarsonTextSpec } from '../lib/carsonPoster'

export type HomeStartPreset = 'vertical' | 'horizontal'

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
  { id: 'vertical', title: 'Vertical', meta: 'Blank · 297 × 420 mm', ratio: '297 / 420' },
  { id: 'horizontal', title: 'Horizontal', meta: 'Blank · 420 × 297 mm', ratio: '420 / 297' },
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

// Rough average glyph widths (em) per face, for wrapping text in the SVG preview.
const GLYPH_EM: Record<string, number> = {
  'IBM Plex Mono': 0.6,
  'Special Elite': 0.6,
  'Archivo Black': 0.78,
  Archivo: 0.56,
}

function wrapLines(spec: CarsonTextSpec): string[] {
  const perChar = spec.fontSize * (GLYPH_EM[spec.fontFamily] ?? 0.6) + (spec.charSpacing / 1000) * spec.fontSize
  const maxChars = Math.max(1, Math.floor(spec.width / Math.max(perChar, 0.01)))
  const lines: string[] = []
  for (const hard of spec.text.split('\n')) {
    let current = ''
    for (const word of hard.split(' ')) {
      const next = current ? `${current} ${word}` : word
      if (next.length > maxChars && current) {
        lines.push(current)
        current = word
      } else {
        current = next
      }
    }
    lines.push(current)
  }
  return lines
}

/**
 * The seed poster (lib/carsonPoster) drawn as SVG at A3 millimetres — built from
 * the same layer specs as the editor, so the card always shows what it opens.
 */
function WreckArt() {
  const W = 297
  const H = 420
  const specs = buildCarsonPoster(W, H)
  return (
    <svg className="home-wreck-art" viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
      <rect width={W} height={H} fill={CARSON_PAPER} />
      {specs.map((spec) => {
        const style = { mixBlendMode: spec.blend === 'multiply' ? 'multiply' : 'normal' } as const
        const opacity = spec.opacity ?? 1
        if (spec.type === 'line') {
          return (
            <line key={spec.name} x1={spec.x1} y1={spec.y1} x2={spec.x2} y2={spec.y2} stroke={spec.stroke} strokeWidth={spec.strokeWidth} opacity={opacity} />
          )
        }
        if (spec.type === 'rect') {
          return (
            <rect
              key={spec.name}
              x={spec.left}
              y={spec.top}
              width={spec.width}
              height={spec.height}
              fill={spec.fill}
              opacity={opacity}
              style={style}
              transform={spec.angle ? `rotate(${spec.angle} ${spec.left} ${spec.top})` : undefined}
            />
          )
        }
        if (spec.type === 'polygon') {
          const pivotX = Math.min(...spec.points.map((point) => point.x))
          const pivotY = Math.min(...spec.points.map((point) => point.y))
          return (
            <polygon
              key={spec.name}
              points={spec.points.map((point) => `${point.x},${point.y}`).join(' ')}
              fill={spec.fill}
              opacity={opacity}
              style={style}
              transform={spec.angle ? `rotate(${spec.angle} ${pivotX} ${pivotY})` : undefined}
            />
          )
        }
        // Fabric puts the first baseline ~0.88em below the box top and steps lines by 1.13 × lineHeight.
        const step = spec.fontSize * 1.13 * spec.lineHeight
        const first = spec.top + spec.fontSize * 0.88
        return (
          <text
            key={spec.name}
            fill={spec.fill}
            opacity={opacity}
            style={style}
            fontFamily={spec.fontFamily}
            fontSize={spec.fontSize}
            fontWeight={spec.fontWeight}
            letterSpacing={(spec.charSpacing / 1000) * spec.fontSize}
            transform={spec.angle ? `rotate(${spec.angle} ${spec.left} ${spec.top})` : undefined}
          >
            {wrapLines(spec).map((textLine, index) => (
              <tspan key={index} x={spec.left} y={first + index * step}>
                {textLine}
              </tspan>
            ))}
          </text>
        )
      })}
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
