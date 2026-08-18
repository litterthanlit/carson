import { Download, Redo2, Save, Sparkles, Undo2 } from 'lucide-react'
import { TensionDial } from './TensionDial'

type TopBarProps = {
  projectName: string
  onProjectNameChange: (name: string) => void
  tension: number
  onTensionChange: (value: number) => void
  onTensionCommit: () => void
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onOpenCommands: () => void
  onExport: () => void
}

export function TopBar({
  projectName,
  onProjectNameChange,
  tension,
  onTensionChange,
  onTensionCommit,
  onUndo,
  onRedo,
  onSave,
  onOpenCommands,
  onExport,
}: TopBarProps) {
  return (
    <header className="topbar glass-bar">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 1452 1311" aria-hidden="true">
          <rect x="339" y="0" width="851" height="395" rx="20" />
          <rect x="0" y="460" width="395" height="851" rx="20" />
          <rect x="601" y="916" width="851" height="395" rx="20" />
        </svg>
        <div className="brand-copy">
          <h1 className="visually-hidden">Carson</h1>
          <label className="project-name-field">
            <span className="visually-hidden">Project name</span>
            <input
              className="project-name-input"
              value={projectName}
              onChange={(event) => onProjectNameChange(event.target.value)}
              aria-label="Project name"
            />
          </label>
        </div>
      </div>
      <TensionDial value={tension} onChange={onTensionChange} onCommit={onTensionCommit} />
      <div className="top-actions" aria-label="Poster actions">
        <button type="button" className="icon-button" aria-label="Undo" title="Undo (Cmd+Z)" onClick={onUndo}>
          <Undo2 size={15} />
        </button>
        <button type="button" className="icon-button" aria-label="Redo" title="Redo (Cmd+Shift+Z)" onClick={onRedo}>
          <Redo2 size={15} />
        </button>
        <button type="button" className="icon-button" title="Save to this browser (Cmd+S)" aria-label="Save" onClick={onSave}>
          <Save size={15} />
        </button>
        <button type="button" className="icon-button" title="Command palette (Cmd+K)" aria-label="Commands" onClick={onOpenCommands}>
          <Sparkles size={15} />
        </button>
        <button type="button" className="primary-button" title="Export the poster (Cmd+E)" onClick={onExport}>
          <Download size={14} />
          Export
        </button>
      </div>
    </header>
  )
}
