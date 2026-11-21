import { useEffect, useRef } from 'react'
import { LayoutGrid } from 'lucide-react'
import { formatModKey } from '../../lib/commands'
import { activeTrailFrame } from '../../lib/explorationTrail'
import { VersionProofIcon } from '../icons/StudioIcons'
import type { InspectorPanelProps } from './types'

type HistoryTabProps = Pick<
  InspectorPanelProps,
  | 'trailFrames'
  | 'trailOpIds'
  | 'trailCursor'
  | 'documentMeta'
  | 'onJumpTrail'
  | 'onForkVariant'
  | 'onOpenCompsGallery'
>

export function HistoryTab({
  trailFrames,
  trailOpIds,
  trailCursor,
  documentMeta,
  onJumpTrail,
  onForkVariant,
  onOpenCompsGallery,
}: HistoryTabProps) {
  const active = activeTrailFrame(trailFrames, trailOpIds, trailCursor)
  const activeRef = useRef<HTMLButtonElement | null>(null)
  const variantCount = documentMeta?.variants.length ?? 0

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [active?.id])

  return (
    <div className="panel-section history-panel" role="region" aria-label="History">
      <div className="panel-title">
        <h2>States</h2>
        <span className="layers-count">{trailFrames.length}</span>
      </div>
      <div className="button-row history-actions">
        <button
          type="button"
          onClick={onForkVariant}
          title={`New version — save a snapshot to compare later (${formatModKey('b')})`}
        >
          <VersionProofIcon size={14} aria-hidden />
          New version
        </button>
        <button
          type="button"
          onClick={onOpenCompsGallery}
          title={`Versions — compare and restore saved looks (${formatModKey('b', true)})`}
          aria-label={variantCount > 0 ? `Versions (${variantCount})` : 'Versions'}
        >
          <LayoutGrid size={14} aria-hidden />
          Versions{variantCount > 0 ? ` (${variantCount})` : ''}
        </button>
      </div>
      {trailFrames.length === 0 ? (
        <p className="empty">Edits land here as you work. Click any step to jump back in time.</p>
      ) : (
        <ul className="history-list" aria-label="History states">
          {trailFrames.map((frame, index) => {
            const isActive = frame.id === active?.id
            return (
              <li key={frame.id}>
                <button
                  type="button"
                  ref={isActive ? activeRef : undefined}
                  className={isActive ? 'history-row active' : 'history-row'}
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => onJumpTrail(frame.opId)}
                >
                  {frame.thumbnail ? (
                    <img className="history-thumb" src={frame.thumbnail} alt="" />
                  ) : (
                    <span className="history-thumb history-thumb-placeholder" aria-hidden />
                  )}
                  <span className="history-row-copy">
                    <span className="history-row-label">{frame.label}</span>
                    <small>Step {index + 1}</small>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
