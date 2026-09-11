import { memo } from 'react'
import { Download, FilePlus2, FolderOpen, House, Redo2, Save, Shuffle, Sparkles, Undo2 } from 'lucide-react'
import { BrandMark } from './BrandMark'
import { TensionDial } from './TensionDial'

type TopBarProps = {
  projectName: string
  onProjectNameChange: (name: string) => void
  tension: number
  onTensionChange: (value: number) => void
  onTensionCommit: () => void
  onHome: () => void
  onNewPoster: () => void
  onOpenPoster: () => void
  onUndo: () => void
  onRedo: () => void
  onSave: () => void
  onOpenCommands: () => void
  onScramble: () => void
  scrambleDisabled?: boolean
  onExport: () => void
}

export const TopBar = memo(function TopBar({
  projectName,
  onProjectNameChange,
  tension,
  onTensionChange,
  onTensionCommit,
  onHome,
  onNewPoster,
  onOpenPoster,
  onUndo,
  onRedo,
  onSave,
  onOpenCommands,
  onScramble,
  scrambleDisabled,
  onExport,
}: TopBarProps) {
  return (
    <header className="topbar glass-bar">
      <div className="brand">
        <button type="button" className="brand-home" aria-label="Carson home" title="Home" onClick={onHome}>
          <BrandMark />
        </button>
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
        <button type="button" className="icon-button" aria-label="Home" title="Home" onClick={onHome}>
          <House size={15} />
        </button>
        <button type="button" className="icon-button" aria-label="New poster" title="New poster (Cmd+N)" onClick={onNewPoster}>
          <FilePlus2 size={15} />
        </button>
        <button type="button" className="icon-button" aria-label="Open poster" title="Open poster (Cmd+O)" onClick={onOpenPoster}>
          <FolderOpen size={15} />
        </button>
        <button type="button" className="icon-button" data-tour="undo" aria-label="Undo" title="Undo (Cmd+Z)" onClick={onUndo}>
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
        <button
          type="button"
          className="scramble-button"
          title="Rearrange every layer into a new structure (Shift+R). Press R to try another."
          aria-label="Scramble layout"
          disabled={scrambleDisabled}
          onClick={onScramble}
        >
          <Shuffle size={14} />
          Scramble
        </button>
        <button type="button" className="primary-button" title="Export the poster (Cmd+E)" onClick={onExport}>
          <Download size={14} />
          Export
        </button>
      </div>
    </header>
  )
})
