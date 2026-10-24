/**
 * The print-scan surface on a press: scan bands where the run's drum starved,
 * lying across the feed through the whole sheet, and scanner drift running
 * along it. Off the press, createPrintScanArtifacts keeps its evenly spaced bands.
 */
import { getPrintScanProfile } from './editorModel'
import { pressBands, sheetFeedCoords, type Press } from './press'

export type PressScanArtifact = {
  id: string
  kind: 'band' | 'drift'
  /** Centre of the mark on the poster. */
  centerX: number
  centerY: number
  /** Along the feed for a band (its thickness), along the mark for a drift. */
  width: number
  height: number
  /** Degrees. */
  angle: number
  opacity: number
}

export function createPressScanArtifacts(
  press: Press,
  options: { generation: number; random: () => number },
): PressScanArtifact[] {
  const { random } = options
  const profile = getPrintScanProfile(options.generation)
  const bandCount = Math.max(3, Math.round(3 + profile.generation * 0.6))
  const driftCount = Math.max(2, Math.round(1 + profile.generation * 0.4))
  const angle = (press.feedAngle * Math.PI) / 180
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  const cx = press.width / 2
  const cy = press.height / 2
  const centerU = sheetFeedCoords(press, cx, cy).u
  const diagonal = Math.hypot(press.width, press.height)
  const artifacts: PressScanArtifact[] = []

  pressBands(press, bandCount).forEach((band, index) => {
    const offset = band.center - centerU
    artifacts.push({
      id: `xerox-band-${index + 1}`,
      kind: 'band',
      centerX: cx + ux * offset,
      centerY: cy + uy * offset,
      width: Math.round((2 + random() * profile.generation * 1.2) * 100) / 100,
      height: diagonal,
      angle: press.feedAngle,
      opacity: Math.round((0.045 + profile.generation * 0.01) * 1000) / 1000,
    })
  })

  for (let index = 0; index < driftCount; index += 1) {
    artifacts.push({
      id: `xerox-drift-${index + 1}`,
      kind: 'drift',
      centerX: random() * press.width,
      centerY: random() * press.height,
      width: Math.round(press.width * (0.08 + random() * 0.16)),
      height: Math.round((1 + random() * 2) * 100) / 100,
      angle: Math.round((press.feedAngle + (random() - 0.5) * 8) * 100) / 100,
      opacity: Math.round((0.1 + profile.generation * 0.01) * 1000) / 1000,
    })
  }
  return artifacts
}
