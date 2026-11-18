export function ScopeSel({ title }: { title?: string }) {
  return (
    <span className="scope-badge" aria-hidden="true" title={title}>
      SEL
    </span>
  )
}

export function ScopeAll({ title }: { title?: string }) {
  return (
    <span className="scope-badge scope-all" aria-hidden="true" title={title}>
      ALL
    </span>
  )
}
