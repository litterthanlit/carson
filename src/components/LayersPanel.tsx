import { memo, useRef, useState, type ComponentType } from 'react'
import {
  Brush,
  ChevronRight,
  Eye,
  EyeOff,
  Folder,
  Image as ImageIcon,
  Lock,
  LockOpen,
  Puzzle,
  SlidersHorizontal,
  Square,
  Type,
  type LucideProps,
} from 'lucide-react'
import { effectiveCollapsedIds, groupIdsWithChildren, visibleLayerRows } from '../lib/layerTreeView'

export type LayerRow = {
  id: string
  name: string
  kind: string
  visible: boolean
  locked: boolean
  thumbnail?: string | null
  depth?: number
  parentId?: string | null
}

type LayersPanelProps = {
  layers: LayerRow[]
  selectedIds: string[]
  renamingLayerId: string | null
  dragLayerId: string | null
  onSelect: (id: string, additive: boolean) => void
  onToggleVisibility: (id: string) => void
  onToggleLock: (id: string) => void
  onRenameStart: (id: string) => void
  onRenameEnd: (id: string, name: string) => void
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDragEnd: () => void
  onZoomToLayer: (id: string) => void
  collapsedIds?: ReadonlySet<string>
  onToggleCollapsed?: (id: string) => void
}

const NO_COLLAPSED: ReadonlySet<string> = new Set()

const KIND_ICONS: Record<string, ComponentType<LucideProps>> = {
  text: Type,
  image: ImageIcon,
  shape: Square,
  fragment: Puzzle,
  group: Folder,
  adjustment: SlidersHorizontal,
  paint: Brush,
}

const INDENT_PX = 14

export const LayersPanel = memo(function LayersPanel({
  layers,
  selectedIds,
  renamingLayerId,
  dragLayerId,
  onSelect,
  onToggleVisibility,
  onToggleLock,
  onRenameStart,
  onRenameEnd,
  onDragStart,
  onDragOver,
  onDragEnd,
  onZoomToLayer,
  collapsedIds = NO_COLLAPSED,
  onToggleCollapsed,
}: LayersPanelProps) {
  // Paint-to-toggle visibility, like Photoshop: press an eye and drag down the column.
  const [paintVisibility, setPaintVisibilityState] = useState<boolean | null>(null)
  const paintingRef = useRef(false)
  // Layer rows re-sync on a debounce, so remember which rows this stroke already flipped.
  const paintedRef = useRef(new Set<string>())
  const setPaintVisibility = (next: boolean | null) => {
    paintingRef.current = next !== null
    paintedRef.current.clear()
    setPaintVisibilityState(next)
  }

  if (layers.length === 0) {
    return (
      <div className="layers-empty">
        <p>No layers yet</p>
        <span>Add text, a shape or an image from the tool rail.</span>
      </div>
    )
  }

  const selectedSet = new Set(selectedIds)
  const groupIds = groupIdsWithChildren(layers)
  const collapsed = effectiveCollapsedIds(layers, collapsedIds, selectedIds)
  const rows = visibleLayerRows(layers, collapsed)
  // Reserve a caret column only when the document has groups, so flat documents stay tight.
  const hasGroups = groupIds.size > 0 && Boolean(onToggleCollapsed)

  return (
    <div
      className="layer-list"
      role="list"
      aria-label="Layers"
      onPointerUp={() => setPaintVisibility(null)}
      onPointerLeave={() => setPaintVisibility(null)}
    >
      {rows.map((layer) => {
        const depth = layer.depth ?? 0
        const isGroup = groupIds.has(layer.id)
        const isCollapsed = isGroup && collapsed.has(layer.id)
        const KindIcon = KIND_ICONS[layer.kind] ?? Square
        const renaming = renamingLayerId === layer.id
        return (
          <div
            key={layer.id}
            role="listitem"
            className={[
              'layer-row',
              selectedSet.has(layer.id) ? 'active' : '',
              dragLayerId === layer.id ? 'dragging' : '',
              depth > 0 ? 'nested' : '',
              layer.visible ? '' : 'is-hidden',
              layer.locked ? 'is-locked' : '',
              isGroup ? 'is-group' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            draggable={depth === 0 && !renaming}
            onDragStart={(event) => {
              if (paintingRef.current) {
                event.preventDefault()
                return
              }
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', layer.id)
              onDragStart(layer.id)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              onDragOver(layer.id)
            }}
            onDrop={(event) => event.preventDefault()}
            onDragEnd={onDragEnd}
          >
            <button
              type="button"
              className="layer-vis"
              title={layer.visible ? 'Hide layer' : 'Show layer'}
              aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
              aria-pressed={layer.visible}
              onPointerDown={(event) => {
                if (event.button !== 0) return
                // Release the implicit capture so the drag can paint across rows.
                event.currentTarget.releasePointerCapture?.(event.pointerId)
                setPaintVisibility(!layer.visible)
                paintedRef.current.add(layer.id)
                onToggleVisibility(layer.id)
              }}
              onPointerEnter={() => {
                if (paintVisibility === null || paintedRef.current.has(layer.id)) return
                paintedRef.current.add(layer.id)
                if (layer.visible !== paintVisibility) onToggleVisibility(layer.id)
              }}
              onClick={(event) => {
                // Pointer presses toggle on pointerdown; keep keyboard activation working.
                if (event.detail === 0) onToggleVisibility(layer.id)
              }}
            >
              {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>

            <span className="layer-indent" style={{ width: depth * INDENT_PX }} aria-hidden="true" />

            {hasGroups ? (
              isGroup ? (
                <button
                  type="button"
                  className="layer-caret"
                  title={isCollapsed ? 'Expand group' : 'Collapse group'}
                  aria-label={isCollapsed ? `Expand ${layer.name}` : `Collapse ${layer.name}`}
                  aria-expanded={!isCollapsed}
                  onClick={() => onToggleCollapsed?.(layer.id)}
                >
                  <ChevronRight size={12} />
                </button>
              ) : (
                <span className="layer-caret-spacer" aria-hidden="true" />
              )
            ) : null}

            <span
              className="layer-thumb-wrap"
              title="Double-click to zoom to layer"
              onDoubleClick={() => onZoomToLayer(layer.id)}
              aria-hidden="true"
            >
              {layer.thumbnail ? (
                <img className="layer-thumb" src={layer.thumbnail} alt="" draggable={false} />
              ) : (
                <span className="layer-thumb layer-thumb-empty">
                  <KindIcon size={14} />
                </span>
              )}
              {layer.thumbnail ? (
                <span className="layer-kind">
                  <KindIcon size={9} strokeWidth={2.5} />
                </span>
              ) : null}
            </span>

            {renaming ? (
              <input
                className="layer-rename"
                autoFocus
                aria-label={`Rename ${layer.name}`}
                defaultValue={layer.name}
                onFocus={(event) => event.currentTarget.select()}
                onBlur={(event) => onRenameEnd(layer.id, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur()
                  } else if (event.key === 'Escape') {
                    event.currentTarget.value = layer.name
                    event.currentTarget.blur()
                  }
                }}
              />
            ) : (
              <button
                type="button"
                className="layer-select"
                title={`${layer.name} · ${layer.kind}\nDouble-click to rename · F2`}
                aria-current={selectedSet.has(layer.id) ? 'true' : undefined}
                onClick={(event) => onSelect(layer.id, event.shiftKey || event.metaKey || event.ctrlKey)}
                onDoubleClick={() => onRenameStart(layer.id)}
                onKeyDown={(event) => {
                  if (event.key === 'F2') {
                    event.preventDefault()
                    onRenameStart(layer.id)
                  } else if (isGroup && onToggleCollapsed && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
                    // Left collapses, right expands, as in a tree view.
                    if ((event.key === 'ArrowLeft') !== isCollapsed) {
                      event.preventDefault()
                      onToggleCollapsed(layer.id)
                    }
                  }
                }}
              >
                <span className="layer-name">{layer.name}</span>
                <span className="visually-hidden">, {layer.kind}{layer.visible ? '' : ', hidden'}{layer.locked ? ', locked' : ''}</span>
              </button>
            )}

            <button
              type="button"
              className="layer-lock"
              title={layer.locked ? 'Unlock layer' : 'Lock layer'}
              aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
              aria-pressed={layer.locked}
              onClick={() => onToggleLock(layer.id)}
            >
              {layer.locked ? <Lock size={12} /> : <LockOpen size={12} />}
            </button>
          </div>
        )
      })}
    </div>
  )
})
