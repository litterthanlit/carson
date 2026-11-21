import { useEffect, useRef } from 'react'
import { ChevronDown, LayoutGrid } from 'lucide-react'
import type { TrailFrame } from '../lib/explorationTrail'
import { activeTrailFrame } from '../lib/explorationTrail'
import { formatModKey } from '../lib/commands'
import { VersionProofIcon } from './icons/StudioIcons'

type ExplorationTrailProps = {
  frames: TrailFrame[]
  opIds: string[]
  cursor: number
  collapsed: boolean
  variantCount: number
  status: string
  onToggleCollapsed: () => void
  onJump: (opId: string) => void
  onFork: () => void
  onOpenGallery: () => void
}

export function ExplorationTrail({
  frames,
  opIds,
  cursor,
  collapsed,
  variantCount,
  status,
  onToggleCollapsed,
  onJump,
  onFork,
  onOpenGallery,
}: ExplorationTrailProps) {
  const active = activeTrailFrame(frames, opIds, cursor)
  const activeRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [active?.id])

  const galleryLabel = variantCount > 0 ? `Versions (${variantCount})` : 'Versions'

  return (
    <div className={collapsed ? 'exploration-trail glass-bar collapsed' : 'exploration-trail glass-bar'} role="region" aria-label="History">
      <button
        type="button"
        className="trail-collapse"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand history' : 'Collapse history'}
        title={collapsed ? 'Show History (Trail) filmstrip' : 'Hide History (Trail) filmstrip'}
        onClick={onToggleCollapsed}
      >
        <ChevronDown size={14} aria-hidden />
        History
      </button>
      <span role="status" aria-live="polite" className="stage-status trail-status">
        {status}
      </span>
      {collapsed ? (
        <span className="trail-collapsed-meta">{frames.length} looks</span>
      ) : (
        <div className="trail-filmstrip" role="list" aria-label="History filmstrip">
          {frames.length === 0 ? (
            <span className="trail-empty">Make a new version to start comparing looks — edits land here as you go.</span>
          ) : (
            frames.map((frame) => {
              const isActive = frame.id === active?.id
              return (
                <div key={frame.id} role="listitem">
                  <button
                    type="button"
                    className={isActive ? 'trail-chip active' : 'trail-chip'}
                    ref={isActive ? activeRef : undefined}
                    aria-current={isActive ? 'step' : undefined}
                    aria-label={isActive ? `${frame.label} (current)` : `Jump to ${frame.label}`}
                    title={frame.label}
                    onClick={() => onJump(frame.opId)}
                  >
                    {frame.thumbnail ? <img src={frame.thumbnail} alt="" /> : <span className="trail-thumb-placeholder" />}
                    <span className="trail-chip-label">{frame.label}</span>
                  </button>
                </div>
              )
            })
          )}
        </div>
      )}
      <button type="button" className="trail-fork" onClick={onFork} title={`New version (Fork) — keep the current look (${formatModKey('b')})`}>
        <VersionProofIcon size={14} aria-hidden />
        New version
      </button>
      <button type="button" className="trail-gallery" onClick={onOpenGallery} title={`Versions (Comps) — compare and restore saved looks (${formatModKey('b', true)})`} aria-label={galleryLabel}>
        <LayoutGrid size={14} aria-hidden />
        Versions
      </button>
    </div>
  )
}
