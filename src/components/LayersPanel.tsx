import { GripVertical, Lock, LockOpen, Eye, EyeOff } from 'lucide-react'

export type LayerRow = {
  id: string
  name: string
  kind: string
  visible: boolean
  locked: boolean
}

type LayersPanelProps = {
  layers: LayerRow[]
  selectedId: string | null
  renamingLayerId: string | null
  dragLayerId: string | null
  onSelect: (id: string) => void
  onToggleVisibility: (id: string) => void
  onToggleLock: (id: string) => void
  onRenameStart: (id: string) => void
  onRenameEnd: (id: string, name: string) => void
  onDragStart: (id: string) => void
  onDragOver: (id: string) => void
  onDragEnd: () => void
}

export function LayersPanel({
  layers,
  selectedId,
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
}: LayersPanelProps) {
  if (layers.length === 0) {
    return <p className="empty">No layers yet.</p>
  }

  return (
    <div className="layer-list" role="list" aria-label="Layers">
      {layers.map((layer) => (
        <div
          key={layer.id}
          role="listitem"
          className={[
            'layer-row',
            selectedId === layer.id ? 'active' : '',
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
          <button type="button" className="layer-select" onClick={() => onSelect(layer.id)}>
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
              aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
              onClick={() => onToggleVisibility(layer.id)}
            >
              {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button
              type="button"
              className="icon-button layer-toggle"
              aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
              onClick={() => onToggleLock(layer.id)}
            >
              {layer.locked ? <Lock size={13} /> : <LockOpen size={13} />}
            </button>
            <button type="button" className="layer-rename" onDoubleClick={() => onRenameStart(layer.id)}>
              Rename
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}
