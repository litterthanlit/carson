import { Check, Grid3x3, RotateCcw, Square, X } from 'lucide-react'
import type { Warp } from '../lib/warp'

type WarpBarProps = {
  warp: Warp
  onMode: (type: Warp['type']) => void
  onReset: () => void
  onDone: () => void
  onCancel: () => void
}

/** Floating controls while editing a Distort / Warp. */
export function WarpBar({ warp, onMode, onReset, onDone, onCancel }: WarpBarProps) {
  return (
    <div className="brush-bar warp-bar" role="toolbar" aria-label="Warp options">
      <div className="brush-mode" role="radiogroup" aria-label="Warp mode">
        <button type="button" role="radio" aria-checked={warp.type === 'distort'} title="Distort — drag the four corners for perspective" onClick={() => onMode('distort')}>
          <Square size={14} aria-hidden />
          Distort
        </button>
        <button type="button" role="radio" aria-checked={warp.type === 'mesh'} title="Warp — bend the layer with a 4×4 mesh" onClick={() => onMode('mesh')}>
          <Grid3x3 size={14} aria-hidden />
          Warp
        </button>
      </div>
      <span className="brush-target">Drag handles · arrow keys nudge a focused handle</span>
      <button type="button" onClick={onReset} title="Back to the unwarped shape">
        <RotateCcw size={13} aria-hidden />
        Reset
      </button>
      <button type="button" onClick={onCancel} title="Discard changes (Esc)">
        <X size={13} aria-hidden />
        Cancel
      </button>
      <button type="button" className="primary-button" onClick={onDone} title="Apply (Enter)">
        <Check size={13} aria-hidden />
        Done
      </button>
    </div>
  )
}
