import { GripVertical, Lock, LockOpen, Eye, EyeOff } from 'lucide-react'

export type LayerRow = {
  id: string
  name: string
  kind: string
  visible: boolean
  locked: boolean
  thumbnail?: string | null
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
}

export function LayersPanel({
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
}: LayersPanelProps) {
  if (layers.length === 0) {
    return <p className="empty">No layers yet.</p>
  }

  const selectedSet = new Set(selectedIds)

  return (
    <div className="layer-list" role="list" aria-label="Layers">
      {layers.map((layer) => (
        <div
          key={layer.id}
          role="listitem"
          className={[
            'layer-row',
            selectedSet.has(layer.id) ? 'active' : '',
            dragLayerId === layer.id ? 'dragging' : '',
          ]
            .filter(Boolean)
            .join(' ')}
          draggable
          onDragStart={() => onDragStart(layer.id)}
          onDragOver={(event) => {
            event.preventDefault()
            onDragOver(layer.id)
          }}
          onDragEnd={onDragEnd}
        >
          <button type="button" className="layer-grip" aria-label={`Reorder ${layer.name}`} tabIndex={-1}>
            <GripVertical size={13} />
          </button>
          {layer.thumbnail ? (
            <img className="layer-thumb" src={layer.thumbnail} alt="" aria-hidden="true" />
          ) : (
            <span className="layer-thumb layer-thumb-empty" aria-hidden="true" />
          )}
          <button
            type="button"
            className="layer-select"
            title="Select layer · double-click to zoom to layer"
            onClick={(event) => onSelect(layer.id, event.shiftKey || event.metaKey || event.ctrlKey)}
            onDoubleClick={() => onZoomToLayer(layer.id)}
          >
            {renamingLayerId === layer.id ? (
              <input
                autoFocus
                defaultValue={layer.name}
                onBlur={(event) => onRenameEnd(layer.id, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    onRenameEnd(layer.id, (event.target as HTMLInputElement).value)
                  }
                }}
              />
            ) : (
              <>
                <strong>{layer.name}</strong>
                <small>{layer.kind}</small>
              </>
            )}
          </button>
          <span className="layer-actions">
            <button
              type="button"
              className="icon-button layer-toggle"
              title={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
              aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
              onClick={() => onToggleVisibility(layer.id)}
            >
              {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button
              type="button"
              className="icon-button layer-toggle"
              title={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
              aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
              onClick={() => onToggleLock(layer.id)}
            >
              {layer.locked ? <Lock size={13} /> : <LockOpen size={13} />}
            </button>
            <button type="button" className="layer-rename" title={`Rename ${layer.name}`} onDoubleClick={() => onRenameStart(layer.id)}>
              Rename
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}
