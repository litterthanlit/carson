import { useEffect, useMemo, useRef, useState } from 'react'
import type { CommandAction } from '../lib/commands'
import { filterCommands } from '../lib/commands'
import { ariaKeyShortcuts, shortcutKeys } from '../lib/shortcuts'
import { Dialog } from './Dialog'

function commandTitle(command: CommandAction) {
  if (command.disabled) return 'Select a layer first'
  if (command.scope === 'selection') return 'Applies to the selected layer'
  if (command.scope === 'canvas') return 'Applies to the whole poster'
  return undefined
}

export function CommandPalette({
  open,
  commands,
  onClose,
}: {
  open: boolean
  commands: CommandAction[]
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => filterCommands(commands, query), [commands, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setIndex(0)
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    setIndex(0)
  }, [query])

  if (!open) return null

  const run = (command: CommandAction) => {
    if (command.disabled) return
    command.run()
    onClose()
  }

  return (
    <Dialog label="Command palette" className="command-palette" placement="top" onClose={onClose}>
      <input
        ref={inputRef}
        data-autofocus
        aria-label="Search actions"
        className="command-input"
        placeholder="Search actions — xerox, export, align…"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault()
            onClose()
          } else if (event.key === 'ArrowDown') {
            event.preventDefault()
            setIndex((current) => Math.min(current + 1, Math.max(0, results.length - 1)))
          } else if (event.key === 'ArrowUp') {
            event.preventDefault()
            setIndex((current) => Math.max(current - 1, 0))
          } else if (event.key === 'Enter' && results[index]) {
            event.preventDefault()
            run(results[index])
          }
        }}
      />
      <ul className="command-list">
        {results.length === 0 ? (
          <li className="command-empty">No matching actions</li>
        ) : (
          results.map((command, i) => (
            <li key={command.id}>
              <button
                type="button"
                className={i === index ? 'active' : undefined}
                disabled={command.disabled}
                title={commandTitle(command)}
                aria-keyshortcuts={command.shortcut ? ariaKeyShortcuts(command.shortcut) : undefined}
                onMouseEnter={() => setIndex(i)}
                onClick={() => run(command)}
              >
                <span>{command.label}</span>
                <span className="command-meta">
                  {command.shortcut ? <kbd aria-hidden="true">{shortcutKeys(command.shortcut)}</kbd> : null}
                  {command.scope ? <small aria-hidden="true">{command.scope}</small> : null}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </Dialog>
  )
}
