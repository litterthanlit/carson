import { formatCmyk, gamutReadout } from '../../lib/cmykPreview'

export function PrintGamutReadout({ hex }: { hex: string | undefined }) {
  const readout = hex ? gamutReadout(hex) : null
  if (!readout) return null
  return (
    <p className="hint gamut-readout">
      <span className="gamut-swatch" style={{ background: readout.proof }} aria-hidden />
      Print · {formatCmyk(readout.cmyk)}
      {readout.outOfGamut ? ' · shifts on press' : ' · holds on press'}
    </p>
  )
}
