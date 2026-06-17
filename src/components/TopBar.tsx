import { Download, Redo2, Save, Sparkles, Undo2 } from 'lucide-react'

type TopBarProps = {
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onOpenCommands: () => void
  onExport: () => void
}

export function TopBar({ onUndo, onRedo, onSave, onOpenCommands, onExport }: TopBarProps) {
  return (
    <header className="topbar glass-bar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          C
        </span>
        <div>
          <h1>Carson</h1>
          <p>Poster editor</p>
        </div>
      </div>
      <div className="top-actions" aria-label="Poster actions">
        <button type="button" className="icon-button" aria-label="Undo" title="Undo (Cmd+Z)" onClick={onUndo}>
          <Undo2 size={18} />
        </button>
        <button type="button" className="icon-button" aria-label="Redo" title="Redo (Cmd+Shift+Z)" onClick={onRedo}>
          <Redo2 size={18} />
        </button>
        <button type="button" className="toolbar-button" title="Save to this browser (Cmd+S)" onClick={onSave}>
          <Save size={17} />
          Save
        </button>
        <button type="button" className="toolbar-button" title="Command palette (Cmd+K)" onClick={onOpenCommands}>
          <Sparkles size={17} />
          Commands
        </button>
        <button type="button" className="primary-button" title="Export the poster (Cmd+E)" onClick={onExport}>
          <Download size={17} />
          Export
        </button>
      </div>
    </header>
  )
}
