import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Check, Crop, RotateCcw, X } from 'lucide-react'
import type { CropField } from '../lib/cropGeometry'
import type { CropSession } from '../lib/cropSession'

type CropBarProps = {
  session: CropSession
  onApply: () => void
  onCancel: () => void
  /** Move focus to the first field when the bar opens (crop entered from the keyboard). */
  autoFocus?: boolean
}

const FIELDS: { field: CropField; label: string; title: string }[] = [
  { field: 'x', label: 'X', title: 'Left edge of the crop, in image pixels' },
  { field: 'y', label: 'Y', title: 'Top edge of the crop, in image pixels' },
  { field: 'width', label: 'W', title: 'Crop width, in image pixels' },
  { field: 'height', label: 'H', title: 'Crop height, in image pixels' },
]

/** A crop edge as a number field: typed values land on Enter or blur, arrow keys step it. */
function CropNumber({ session, field, label, title }: { session: CropSession; field: CropField; label: string; title: string }) {
  const { rect } = useSyncExternalStore(session.subscribe, session.snapshot)
  const value = Math.round(rect[field])
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft === null) return
    const parsed = Number(draft)
    setDraft(null)
    if (draft.trim() !== '' && Number.isFinite(parsed)) session.setField(field, parsed)
  }
  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      // Enter in a field sets that number; it doesn't apply the crop.
      event.preventDefault()
      event.stopPropagation()
      commit()
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      const step = (event.shiftKey ? 10 : 1) * (event.key === 'ArrowUp' ? 1 : -1)
      setDraft(null)
      session.setField(field, value + step)
    }
  }
  return (
    <label className="crop-field" title={title}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        step={1}
        min={0}
        value={draft ?? String(value)}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
      />
    </label>
  )
}

/** Floating controls while cropping a photo: exact edges, proportions, Reset, Cancel, Apply. */
export function CropBar({ session, onApply, onCancel, autoFocus = false }: CropBarProps) {
  const { keepAspect } = useSyncExternalStore(session.subscribe, session.snapshot)
  const rootRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (autoFocus) rootRef.current?.querySelector('input')?.focus()
  }, [autoFocus, session])
  return (
    <div ref={rootRef} className="brush-bar crop-bar" role="toolbar" aria-label="Crop image">
      <span className="crop-bar-title">
        <Crop size={14} aria-hidden />
        Crop
      </span>
      <div className="crop-fields" role="group" aria-label={`Crop in image pixels, of ${session.source.width} × ${session.source.height}`}>
        {FIELDS.map((item) => (
          <CropNumber key={item.field} session={session} {...item} />
        ))}
      </div>
      <label className="crop-aspect" title="Keep the frame's proportions (or hold Shift while dragging)">
        <input type="checkbox" checked={keepAspect} onChange={(event) => session.setKeepAspect(event.target.checked)} />
        Keep proportions
      </label>
      <button type="button" onClick={() => session.reset()} title="Show the whole image in the frame again">
        <RotateCcw size={13} aria-hidden />
        Reset crop
      </button>
      <button type="button" onClick={onCancel} title="Discard this crop (Esc)">
        <X size={13} aria-hidden />
        Cancel
      </button>
      <button type="button" className="primary-button" onClick={onApply} title="Apply the crop (Enter)">
        <Check size={13} aria-hidden />
        Apply crop
      </button>
    </div>
  )
}
