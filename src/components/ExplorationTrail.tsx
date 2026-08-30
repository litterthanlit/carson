import { useEffect, useRef } from 'react'
import { ChevronDown, GitFork, LayoutGrid } from 'lucide-react'
import type { TrailFrame } from '../lib/explorationTrail'
import { activeTrailFrame } from '../lib/explorationTrail'

type ExplorationTrailProps = {
  frames: TrailFrame[]
  opIds: string[]
  cursor: number
  collapsed: boolean
  variantCount: number
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

  const galleryLabel = variantCount > 0 ? `Comps gallery (${variantCount})` : 'Comps gallery'

  return (
    <div className={collapsed ? 'exploration-trail glass-bar collapsed' : 'exploration-trail glass-bar'} role="region" aria-label="Exploration trail">
      <button
        type="button"
        className="trail-collapse"
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Expand trail' : 'Collapse trail'}
        title={collapsed ? 'Show history filmstrip' : 'Hide history filmstrip'}
        onClick={onToggleCollapsed}
      >
        <ChevronDown size={14} />
        Trail
      </button>
      {collapsed ? (
        <span className="trail-collapsed-meta">{frames.length} looks</span>
      ) : (
        <div className="trail-filmstrip" role="list" aria-label="History filmstrip">
          {frames.length === 0 ? (
            <span className="trail-empty">Fork a look to start a comps set — edits land here as you go.</span>
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
      <button type="button" className="trail-fork" onClick={onFork} title="Fork current state (Cmd+B)">
        <GitFork size={13} />
        Fork
      </button>
      <button type="button" className="trail-gallery" onClick={onOpenGallery} title="Open comps gallery (Cmd+Shift+B)" aria-label={galleryLabel}>
        <LayoutGrid size={13} />
        Comps
      </button>
    </div>
  )
}
