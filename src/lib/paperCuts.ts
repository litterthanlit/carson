/**
 * Paper cuts — dividing a sheet by hand, with a scalpel or by tearing.
 *
 * Every cut is one line shared by the two pieces it separates, so nothing is
 * lost or invented: the pieces fit back together exactly. A scalpel line is
 * nearly straight — a degree or so off, a slight bow from the hand dragging
 * the blade. A tear wanders: a random walk a few millimetres deep, angled
 * however the hands pulled. Then the hand moves the pieces: each slides along
 * its cut, they separate a little, each turns a little.
 *
 * Pure geometry in the layer's own frame (top-left origin, poster px), with
 * physical sizes in millimetres via `pxPerMm`.
 */
import { handJitter } from './hand'

export type CutStyle = 'scalpel' | 'tear'
export type CutDirection = 'horizontal' | 'vertical'

export type Point = { x: number; y: number }

export type PaperPiece = {
  /** Outline in the layer frame. */
  polygon: Point[]
  /** Where the hand moved it, in the layer frame (px) and degrees. */
  dx: number
  dy: number
  angle: number
  /** Centre the piece turns about, in the layer frame. */
  pivot: Point
}

export type PaperCutOptions = {
  style: CutStyle
  direction: CutDirection
  pieces: number
  /** How far apart the hand pulled the pieces, mm. */
  separationMm: number
  /** How far each piece slid along its cut, mm (most move less). */
  slideMm: number
  /** How far each piece turned, degrees (most turn less). */
  turnDeg: number
  pxPerMm: number
}

/**
 * The cut lines across a layer of `length` (along the cuts) × `depth`
 * (across them), as offsets sampled at shared positions along the length.
 * Lines never cross: each keeps at least a millimetre below the last.
 */
export function cutLines(
  length: number,
  depth: number,
  count: number,
  style: CutStyle,
  pxPerMm: number,
  random: () => number,
): { samples: number[]; lines: number[][] } {
  const mm = Math.max(0.05, pxPerMm)
  const margin = 2 * mm
  const step = (style === 'tear' ? 0.6 : 2.5) * mm
  const sampleCount = Math.max(2, Math.ceil((length + margin * 2) / step) + 1)
  const samples = Array.from({ length: sampleCount }, (_, i) => -margin + ((length + margin * 2) * i) / (sampleCount - 1))
  const cuts = Math.max(0, count - 1)
  const lines: number[][] = []
  for (let c = 1; c <= cuts; c++) {
    const base = (depth * c) / count + handJitter(random) * 0.18 * (depth / count)
    const tilt = Math.tan(((style === 'tear' ? 12 : 1.2) * handJitter(random) * Math.PI) / 180)
    const bow = (style === 'tear' ? 0 : 0.3 * mm) * (random() < 0.5 ? -1 : 1) * random()
    const amplitude = (1.2 + random() * 1.6) * mm
    let drift = 0
    lines.push(
      samples.map((x, i) => {
        const t = i / (sampleCount - 1)
        let offset = base + tilt * (x - length / 2) + bow * Math.sin(Math.PI * t)
        if (style === 'tear') {
          drift = drift * 0.86 + (random() - 0.5) * amplitude * 0.55
          drift = Math.max(-amplitude * 2, Math.min(amplitude * 2, drift))
          // Now and then the tear jumps a fibre.
          offset += drift + (random() < 0.06 ? (random() - 0.5) * amplitude : 0)
        } else {
          offset += (random() - 0.5) * 0.06 * mm
        }
        return offset
      }),
    )
  }
  // Keep lines in order and on the sheet, each at least a millimetre past the last.
  const gap = Math.min(mm, depth / (count * 3))
  for (let i = 0; i < sampleCount; i++) {
    for (let c = 0; c < lines.length; c++) {
      const floor = c === 0 ? gap : lines[c - 1][i] + gap
      const ceiling = depth - gap * (lines.length - c)
      lines[c][i] = Math.max(floor, Math.min(ceiling, lines[c][i]))
    }
  }
  return { samples, lines }
}

/** Cut a layer of width × height into pieces and let the hand move them. */
export function cutPaper(width: number, height: number, options: PaperCutOptions, random: () => number): PaperPiece[] {
  const count = Math.max(2, Math.min(12, Math.round(options.pieces)))
  const across = options.direction === 'horizontal'
  // Horizontal strips: cuts run along x and stack down y. Columns: transposed.
  const length = across ? width : height
  const depth = across ? height : width
  const mm = Math.max(0.05, options.pxPerMm)
  const { samples, lines } = cutLines(length, depth, count, options.style, mm, random)
  const margin = 2 * mm
  const toFrame = (along: number, deep: number): Point => (across ? { x: along, y: deep } : { x: deep, y: along })

  const pieces: PaperPiece[] = []
  for (let k = 0; k < count; k++) {
    const top = k === 0 ? samples.map(() => -margin) : lines[k - 1]
    const bottom = k === count - 1 ? samples.map(() => depth + margin) : lines[k]
    const polygon = [
      ...samples.map((x, i) => toFrame(x, top[i])),
      ...samples.map((x, i) => toFrame(x, bottom[i])).reverse(),
    ]
    const middle = (top[Math.floor(samples.length / 2)] + bottom[Math.floor(samples.length / 2)]) / 2
    // Pieces part from the middle of the stack outward, a hand's worth each.
    const part = (k - (count - 1) / 2) * options.separationMm * mm * (0.6 + random() * 0.4)
    const slide = handJitter(random) * options.slideMm * mm
    const turn = handJitter(random) * options.turnDeg
    const shift = toFrame(slide, part)
    pieces.push({
      polygon,
      dx: shift.x,
      dy: shift.y,
      angle: turn,
      pivot: toFrame(length / 2, Math.max(0, Math.min(depth, middle))),
    })
  }
  return pieces
}
