import { useEffect, useMemo, useRef, useState } from 'react'
import type { CommandAction } from '../lib/commands'
import { filterCommands } from '../lib/commands'

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
    command.run()
    onClose()
  }

  return (
    <div className="command-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="command-palette glass-panel"
        role="dialog"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <input
          ref={inputRef}
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
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => run(command)}
                >
                  <span>{command.label}</span>
                  {command.scope ? <small>{command.scope}</small> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
