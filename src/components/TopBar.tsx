import { memo, useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  Command,
  Copy,
  Download,
  FilePlus2,
  Files,
  FolderOpen,
  House,
  Redo2,
  Save,
  Shuffle,
  Undo2,
} from 'lucide-react'
import type { AgentBridgeStatus } from '../lib/agentBridge'
import { BrandMark } from './BrandMark'
import { TensionDial } from './TensionDial'
import { ThemeToggle } from './ThemeToggle'

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
  isDirty?: boolean
  onDuplicatePoster: () => void
  onSaveAs: () => void
  onOpenCommands: () => void
  onScramble: () => void
  scrambleDisabled?: boolean
  onExport: () => void
  agentStatus?: AgentBridgeStatus
  onAgentConnect?: () => void
  onAgentDisconnect?: () => void
}

const AGENT_COPY: Record<Exclude<AgentBridgeStatus, 'off'>, { detail: string; title: string }> = {
  connecting: {
    detail: 'waiting',
    title: 'Waiting for the Carson MCP server. Start it from your agent. Click to stop waiting.',
  },
  connected: {
    detail: 'live',
    title: 'An agent is playing this poster. Every move lands on the trail and ⌘Z undoes it. Click to disconnect.',
  },
  replaced: {
    detail: 'in another window',
    title: 'Another Carson window has the agent. Click to bring it here.',
  },
  incompatible: {
    detail: 'needs update',
    title: 'The Carson MCP server speaks a different protocol version. Update Carson or the server. Click to dismiss.',
  },
}

function AgentChip({
  status,
  onConnect,
  onDisconnect,
}: {
  status: Exclude<AgentBridgeStatus, 'off'>
  onConnect?: () => void
  onDisconnect?: () => void
}) {
  const copy = AGENT_COPY[status]
  return (
    <button
      type="button"
      className={`agent-chip ${status}`}
      aria-label={`Agent ${copy.detail}`}
      title={copy.title}
      onClick={status === 'replaced' ? onConnect : onDisconnect}
    >
      <span className="agent-dot" aria-hidden />
      <span>Agent</span>
      <span className="agent-chip-detail" aria-live="polite">
        {copy.detail}
      </span>
    </button>
  )
}

type FileItem = {
  label: string
  shortcut?: string
  /** ARIA key-shortcut syntax, e.g. "Meta+N". */
  keys?: string
  icon: typeof Save
  run: () => void
}

function FileMenu({ items }: { items: FileItem[] }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    if (!open) return
    itemRefs.current[0]?.focus()
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [open])

  const onMenuKey = (event: React.KeyboardEvent) => {
    const index = itemRefs.current.findIndex((item) => item === document.activeElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      rootRef.current?.querySelector<HTMLButtonElement>('.file-menu-trigger')?.focus()
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      itemRefs.current[(index + 1) % items.length]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      itemRefs.current[(index - 1 + items.length) % items.length]?.focus()
    }
  }

  return (
    <div className="file-menu" ref={rootRef}>
      <button
        type="button"
        className="file-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        File
        <ChevronDown size={12} aria-hidden />
      </button>
      {open ? (
        <div className="file-menu-popover" role="menu" aria-label="File" onKeyDown={onMenuKey}>
          {items.map((item, index) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                ref={(node) => {
                  itemRefs.current[index] = node
                }}
                type="button"
                role="menuitem"
                aria-label={item.label}
                aria-keyshortcuts={item.keys}
                onClick={() => {
                  setOpen(false)
                  item.run()
                }}
              >
                <Icon size={14} aria-hidden />
                <span>{item.label}</span>
                {item.shortcut ? <kbd aria-hidden>{item.shortcut}</kbd> : null}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
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
  isDirty = false,
  onDuplicatePoster,
  onSaveAs,
  onOpenCommands,
  onScramble,
  scrambleDisabled,
  onExport,
  agentStatus = 'off',
  onAgentConnect,
  onAgentDisconnect,
}: TopBarProps) {
  const fileItems: FileItem[] = [
    { label: 'New poster', shortcut: '⌘N', keys: 'Meta+N', icon: FilePlus2, run: onNewPoster },
    { label: 'Open poster', shortcut: '⌘O', keys: 'Meta+O', icon: FolderOpen, run: onOpenPoster },
    { label: 'Save as', shortcut: '⇧⌘S', keys: 'Meta+Shift+S', icon: Files, run: onSaveAs },
    { label: 'Duplicate poster', icon: Copy, run: onDuplicatePoster },
    { label: 'Home', icon: House, run: onHome },
  ]

  return (
    <header className="topbar glass-bar" role="banner" aria-label="Editor">
      <div className="brand">
        <button type="button" className="brand-home" aria-label="Carson home" title="Home" onClick={onHome}>
          <BrandMark />
        </button>
        <FileMenu items={fileItems} />
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
          <button
            type="button"
            className={isDirty ? 'save-state dirty' : 'save-state'}
            aria-label="Save"
            title="Save to this browser (⌘S)"
            onClick={onSave}
          >
            {isDirty ? <Save size={12} aria-hidden /> : <span className="save-dot" aria-hidden />}
            <span aria-live="polite">{isDirty ? 'Save' : 'Saved'}</span>
          </button>
        </div>
      </div>
      <TensionDial value={tension} onChange={onTensionChange} onCommit={onTensionCommit} />
      <div className="top-actions" aria-label="Poster actions">
        <div className="top-cluster" role="group" aria-label="History">
          <button type="button" className="icon-button" data-tour="undo" aria-label="Undo" title="Undo (⌘Z)" onClick={onUndo}>
            <Undo2 size={15} />
          </button>
          <button type="button" className="icon-button" aria-label="Redo" title="Redo (⇧⌘Z)" onClick={onRedo}>
            <Redo2 size={15} />
          </button>
        </div>
        {agentStatus !== 'off' ? (
          <AgentChip status={agentStatus} onConnect={onAgentConnect} onDisconnect={onAgentDisconnect} />
        ) : null}
        <ThemeToggle />
        <button type="button" className="command-button" title="Search every action (⌘K)" aria-label="Commands" onClick={onOpenCommands}>
          <Command size={13} aria-hidden />
          <span>K</span>
        </button>
        <span className="top-divider" aria-hidden />
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
        <button type="button" className="primary-button" title="Export the poster (⌘E)" onClick={onExport}>
          <Download size={14} />
          Export
        </button>
      </div>
    </header>
  )
})
