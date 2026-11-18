/**
 * Effective resolution per image layer, kept outside React state so it can be
 * updated on every frame of a scale or crop drag without re-rendering the editor.
 *
 * Subscribers (the Layers panel, the Properties note) read it with
 * `useSyncExternalStore`. Snapshots only change when something they show
 * changes: `lowIds()` is a new set only when a layer crosses the threshold, and
 * `get(id)` is a new object only when that layer's rounded number changes.
 */
import type { EffectiveResolution } from './imageResolution'

export type ResolutionStore = ReturnType<typeof createResolutionStore>

const EMPTY: ReadonlySet<string> = new Set()

function same(a: EffectiveResolution | undefined, b: EffectiveResolution | undefined) {
  if (a === b) return true
  if (!a || !b || a.kind !== b.kind || a.low !== b.low) return false
  return a.kind === 'print' ? a.ppi === (b as typeof a).ppi : a.percent === (b as typeof a).percent
}

export function createResolutionStore() {
  const entries = new Map<string, EffectiveResolution>()
  const listeners = new Set<() => void>()
  let low: ReadonlySet<string> = EMPTY

  function recomputeLow(): boolean {
    const next = [...entries].filter(([, value]) => value.low).map(([id]) => id)
    if (next.length === low.size && next.every((id) => low.has(id))) return false
    low = next.length ? new Set(next) : EMPTY
    return true
  }

  function notify() {
    for (const listener of listeners) listener()
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get(id: string): EffectiveResolution | undefined {
      return entries.get(id)
    },
    lowIds(): ReadonlySet<string> {
      return low
    },
    /** Record one layer's resolution (null: not an image layer any more). */
    set(id: string, value: EffectiveResolution | null) {
      const current = entries.get(id)
      if (value ? same(current, value) : !current) return
      if (value) entries.set(id, value)
      else entries.delete(id)
      recomputeLow()
      notify()
    },
    /** Replace everything at once (after the layer list is rebuilt), dropping layers that are gone. */
    replaceAll(values: Iterable<[string, EffectiveResolution]>) {
      const next = new Map(values)
      let changed = next.size !== entries.size
      for (const [id, value] of next) {
        if (!same(entries.get(id), value)) {
          entries.set(id, value)
          changed = true
        }
      }
      for (const id of [...entries.keys()]) {
        if (!next.has(id)) {
          entries.delete(id)
          changed = true
        }
      }
      if (!changed) return
      recomputeLow()
      notify()
    },
  }
}
