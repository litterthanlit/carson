import { shortcutSheet } from '../lib/shortcuts'

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
