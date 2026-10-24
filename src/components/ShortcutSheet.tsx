import { X } from 'lucide-react'
import { shortcutSheet } from '../lib/shortcuts'
import { Dialog } from './Dialog'

/** Every shortcut, generated from the registry so the list always matches the keys that run. */
export function ShortcutSheet({ headingLevel = 3 }: { headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3'
  return (
    <div className="shortcut-sheet">
      {shortcutSheet().map((section) => (
        <section key={section.group} className="shortcut-group" aria-label={section.group}>
          <Heading>{section.group}</Heading>
          <ul className="shortcut-list">
            {section.rows.map((row) => (
              <li key={row.id}>
                <span className="shortcut-label">
                  {row.label}
                  {row.hint ? <small> · {row.hint}</small> : null}
                </span>
                <span className="shortcut-keys">
                  {[...new Set(row.keys)].map((keys) => (
                    <kbd key={keys}>{keys}</kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

/** The full shortcut reference, opened with ? or from Commands. */
export function ShortcutSheetDialog({ onClose }: { onClose: () => void }) {
  return (
    <Dialog labelledBy="shortcut-sheet-title" className="shortcut-dialog" onClose={onClose}>
      <header className="shortcut-dialog-header">
        <h2 id="shortcut-sheet-title">Keyboard shortcuts</h2>
        <button type="button" className="icon-button" aria-label="Close keyboard shortcuts" data-autofocus onClick={onClose}>
          <X size={16} />
        </button>
      </header>
      <ShortcutSheet />
    </Dialog>
  )
}
