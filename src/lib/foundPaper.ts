/**
 * Found paper — the raw material of a Carson collage.
 *
 * Carson builds collages from what he finds: torn bits of posters, receipts,
 * tickets, cardboard, envelopes, his own prints. This module paints those
 * papers procedurally (seeded, so a scrap can be re-rolled or rebuilt), already
 * torn: the outline is ripped and the tear shows the paper's lighter core, the
 * way coloured or printed stock does when it is pulled apart by hand.
 *
 * Painting needs a 2D canvas context; sizing and the catalogue are pure.
 */
import { tornScrap } from './carsonPoster'
import { createSeededRandom } from './random'

export type FoundPaperKind =
  | 'receipt'
  | 'envelope'
  | 'invoice'
  | 'kraft'
  | 'newsprint'
  | 'graph'
  | 'ticket'
  | 'tape'
  | 'black'
  | 'poster'
  | 'packing'
  | 'peel'

export type FoundPaperSpec = {
  kind: FoundPaperKind
  label: string
  /** Width and height range as fractions of the poster width. */
  width: [number, number]
  height: [number, number]
  /** Tear roughness relative to the shorter side. */
  roughness: number
  /** Blend the scrap is pasted with. */
  blend: 'source-over' | 'multiply'
  opacity: number
  /** Edge shape: torn all round (paper), straight with fibrous ends (masking tape), sawtooth ends (packing tape). */
  outline?: 'torn' | 'tape' | 'saw'
  /** Paint the pale fibrous core along the tear. Tapes don't have one. */
  rim?: boolean
  /** Fibre grain strength; 0 for clear film. */
  grain?: number
  /** Lies flat or sits below the surface (tape, a peeled scar): casts no shadow when photographed. */
  flat?: boolean
}

export const FOUND_PAPERS: FoundPaperSpec[] = [
  { kind: 'receipt', label: 'Receipt', width: [0.16, 0.22], height: [0.34, 0.5], roughness: 0.035, blend: 'source-over', opacity: 1 },
  { kind: 'envelope', label: 'Security envelope', width: [0.34, 0.46], height: [0.16, 0.24], roughness: 0.05, blend: 'source-over', opacity: 1 },
  { kind: 'invoice', label: 'Carbon invoice', width: [0.4, 0.56], height: [0.14, 0.22], roughness: 0.05, blend: 'source-over', opacity: 1 },
  { kind: 'kraft', label: 'Kraft card', width: [0.36, 0.6], height: [0.1, 0.18], roughness: 0.06, blend: 'source-over', opacity: 1 },
  { kind: 'newsprint', label: 'Newsprint', width: [0.3, 0.42], height: [0.3, 0.42], roughness: 0.05, blend: 'source-over', opacity: 1 },
  { kind: 'graph', label: 'Graph paper', width: [0.24, 0.34], height: [0.2, 0.3], roughness: 0.05, blend: 'source-over', opacity: 1 },
  { kind: 'ticket', label: 'Ticket stub', width: [0.2, 0.26], height: [0.08, 0.11], roughness: 0.04, blend: 'source-over', opacity: 1 },
  { kind: 'tape', label: 'Masking tape', width: [0.22, 0.4], height: [0.06, 0.085], roughness: 0.16, blend: 'source-over', opacity: 1, outline: 'tape', rim: false, grain: 0.02, flat: true },
  { kind: 'black', label: 'Black paper', width: [0.1, 0.2], height: [0.14, 0.3], roughness: 0.06, blend: 'source-over', opacity: 1 },
  { kind: 'poster', label: 'Poster fragment', width: [0.3, 0.44], height: [0.24, 0.36], roughness: 0.06, blend: 'source-over', opacity: 1 },
  { kind: 'packing', label: 'Packing tape', width: [0.32, 0.55], height: [0.13, 0.16], roughness: 0.04, blend: 'source-over', opacity: 1, outline: 'saw', rim: false, grain: 0, flat: true },
  { kind: 'peel', label: 'Peeled patch', width: [0.14, 0.28], height: [0.12, 0.24], roughness: 0.09, blend: 'source-over', opacity: 1, flat: true },
]

export function foundPaperSpec(kind: FoundPaperKind): FoundPaperSpec {
  return FOUND_PAPERS.find((spec) => spec.kind === kind) ?? FOUND_PAPERS[0]
}

/** Longest side of the painted raster. Enough for print, small enough for undo history. */
export const FOUND_PAPER_RASTER = 1400

/**
 * Seeded size: poster-space width/height plus the raster to paint at.
 * Always the same for the same seed and poster width.
 */
export function foundPaperSize(kind: FoundPaperKind, seed: number, posterWidth: number) {
  const spec = foundPaperSpec(kind)
  const random = createSeededRandom(seed)
  const width = posterWidth * (spec.width[0] + random() * (spec.width[1] - spec.width[0]))
  const height = posterWidth * (spec.height[0] + random() * (spec.height[1] - spec.height[0]))
  const scale = Math.min(1, FOUND_PAPER_RASTER / Math.max(width, height))
  return {
    width,
    height,
    rasterWidth: Math.max(8, Math.round(width * scale)),
    rasterHeight: Math.max(8, Math.round(height * scale)),
  }
}

/** Families the painters use; load them before painting. */
export const FOUND_PAPER_FONTS = ['IBM Plex Mono', 'Special Elite', 'Archivo Black', 'Archivo'] as const

const MONO = '"IBM Plex Mono", ui-monospace, monospace'
const TYPEWRITER = '"Special Elite", "IBM Plex Mono", monospace'
const HEAVY = '"Archivo Black", "Arial Black", sans-serif'
const GROTESK = 'Archivo, Arial, sans-serif'

type Ctx = CanvasRenderingContext2D
type Random = () => number

const pick = <T,>(random: Random, items: readonly T[]): T => items[Math.floor(random() * items.length) % items.length]
const between = (random: Random, low: number, high: number) => low + random() * (high - low)

/** Paint a torn scrap of `kind` into a transparent context of width × height. */
export function paintFoundPaper(ctx: Ctx, kind: FoundPaperKind, width: number, height: number, seed: number) {
  const spec = foundPaperSpec(kind)
  const random = createSeededRandom(seed ^ 0x5bd1e995)
  const outline =
    spec.outline === 'tape' || spec.outline === 'saw'
      ? tapeOutline(width, height, seed, spec.outline)
      : tornOutline(width, height, seed, spec.roughness)

  ctx.save()
  tracePath(ctx, outline)
  ctx.clip()
  PAINTERS[kind](ctx, width, height, random)
  if (kind === 'peel') {
    // The layer around the scar stands proud of it: a soft shadow just inside the tear.
    // Inner shadow: fill everything *outside* the scar (clipped away, so unseen)
    // and let only its shadow fall inside, offset away from the light.
    const short = Math.min(width, height)
    ctx.save()
    ctx.shadowColor = 'rgba(45,35,20,0.45)'
    ctx.shadowBlur = short * 0.05
    ctx.shadowOffsetX = short * 0.012
    ctx.shadowOffsetY = short * 0.018
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.rect(-width, -height, width * 3, height * 3)
    outline.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)))
    ctx.closePath()
    ctx.fill('evenodd')
    ctx.restore()
  }
  const grain = spec.grain ?? (kind === 'black' ? 0.05 : 0.035)
  if (grain > 0) paperGrain(ctx, width, height, random, grain)
  ctx.restore()

  if (spec.rim !== false) tornRim(ctx, outline, width, height, random, kind)
}

/**
 * Tape keeps its factory edges along its length; only the ends are torn —
 * fibrous for masking tape, the dispenser's sawtooth for packing tape.
 */
export function tapeOutline(width: number, height: number, seed: number, style: 'tape' | 'saw') {
  const random = createSeededRandom(seed ^ 0x2c1b3c6d)
  const edge = height * 0.04
  const reach = height * (style === 'saw' ? 0.09 : 0.14)
  const points: { x: number; y: number }[] = []
  const end = (x: number, fromY: number, toY: number, outward: number) => {
    const steps = style === 'saw' ? 14 + Math.floor(random() * 6) : 22
    let drift = 0
    for (let i = 0; i <= steps; i++) {
      const y = fromY + ((toY - fromY) * i) / steps
      if (style === 'saw') {
        // Dispenser teeth: alternate in and out, a little uneven.
        const tooth = i % 2 === 0 ? 0 : reach * (0.6 + random() * 0.5)
        points.push({ x: x - outward * tooth, y })
      } else {
        drift = drift * 0.55 + (random() - 0.5) * reach
        points.push({ x: x - outward * Math.abs(drift) - outward * random() * reach * 0.25, y })
      }
    }
  }
  const left = reach
  const right = width - reach
  // Long edges: straight, with the slightest wander of a hand-pulled strip.
  const wander = () => (random() - 0.5) * edge * 0.3
  points.push({ x: left, y: edge + wander() })
  points.push({ x: right, y: edge + wander() })
  end(right, edge, height - edge, -1)
  points.push({ x: left, y: height - edge + wander() })
  end(left, height - edge, edge, 1)
  return points
}

function tornOutline(width: number, height: number, seed: number, roughness: number) {
  const inset = Math.min(width, height) * roughness * 1.5
  return tornScrap(inset, inset, width - inset * 2, height - inset * 2, seed, roughness)
}

function tracePath(ctx: Ctx, points: { x: number; y: number }[]) {
  ctx.beginPath()
  points.forEach((point, index) => (index === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y)))
  ctx.closePath()
}

/**
 * The tear: printed and coloured paper splits to show its pale core, a
 * ragged rim a few fibres wide just inside the edge.
 */
function tornRim(ctx: Ctx, outline: { x: number; y: number }[], width: number, height: number, random: Random, kind: FoundPaperKind) {
  const short = Math.min(width, height)
  const core = kind === 'black' ? 'rgba(232,228,218,0.55)' : kind === 'kraft' ? 'rgba(214,190,152,0.9)' : 'rgba(255,253,247,0.85)'
  ctx.save()
  tracePath(ctx, outline)
  ctx.clip()
  ctx.strokeStyle = core
  ctx.lineJoin = 'round'
  for (let pass = 0; pass < 3; pass++) {
    ctx.lineWidth = short * between(random, 0.006, 0.016)
    ctx.globalAlpha = 0.35 + random() * 0.35
    ctx.beginPath()
    outline.forEach((point, index) => {
      const jitter = short * 0.004
      const x = point.x + (random() - 0.5) * jitter
      const y = point.y + (random() - 0.5) * jitter
      if (index === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.closePath()
    ctx.stroke()
  }
  ctx.restore()
}

/** Fibre noise and a slow tonal drift so no paper is a flat fill. */
function paperGrain(ctx: Ctx, width: number, height: number, random: Random, amount: number) {
  const image = ctx.getImageData(0, 0, width, height)
  const { data } = image
  const blotchX = between(random, 0, Math.PI * 2)
  const blotchY = between(random, 0, Math.PI * 2)
  for (let y = 0; y < height; y++) {
    const drift = Math.sin(y / height * 3.1 + blotchY) * amount * 0.6
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      if (data[i + 3] === 0) continue
      const tone = 1 + drift + Math.sin(x / width * 2.3 + blotchX) * amount * 0.5 + (random() - 0.5) * amount * 2
      data[i] = Math.max(0, Math.min(255, data[i] * tone))
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * tone))
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * tone))
    }
  }
  ctx.putImageData(image, 0, 0)
}

function fill(ctx: Ctx, color: string, width: number, height: number) {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, width, height)
}

function text(ctx: Ctx, value: string, x: number, y: number, size: number, family: string, color: string, align: CanvasTextAlign = 'left', weight = 400) {
  ctx.font = `${weight} ${Math.max(4, size)}px ${family}`
  ctx.fillStyle = color
  ctx.textAlign = align
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(value, x, y)
}

const SHOPS = ['KIOSK 24', 'MERCADO', 'ESSO', 'BÄCKEREI', 'LIQUOR', 'SURF SHOP', 'TABAC', 'NO. 7 DELI']
const ITEMS = ['COFFEE', 'WAX', 'TAPE', 'INK CART.', 'XEROX A3', 'POSTCARD', 'GLUE STICK', 'FILM 400', 'BATTERY', 'NEWSPAPER', 'STAMPS']

const PAINTERS: Record<FoundPaperKind, (ctx: Ctx, width: number, height: number, random: Random) => void> = {
  receipt(ctx, width, height, random) {
    fill(ctx, '#f3f2ec', width, height)
    // Thermal print fades unevenly down the strip.
    const ink = (alpha: number) => `rgba(38,38,40,${alpha})`
    const size = width * 0.062
    const pad = width * 0.12
    let y = height * 0.08 + size
    text(ctx, pick(random, SHOPS), width / 2, y, size * 1.4, MONO, ink(0.85), 'center', 700)
    y += size * 1.7
    text(ctx, `${10 + Math.floor(random() * 18)}.0${1 + Math.floor(random() * 9)}.9${Math.floor(random() * 10)}  ${10 + Math.floor(random() * 12)}:${10 + Math.floor(random() * 49)}`, width / 2, y, size, MONO, ink(0.7), 'center')
    y += size * 1.2
    text(ctx, '- - - - - - - - - - - - - - - -', width / 2, y, size, MONO, ink(0.5), 'center')
    const lines = 6 + Math.floor(random() * 8)
    let total = 0
    // Leave room under the items for the total and the barcode.
    for (let line = 0; line < lines && y < height * 0.66; line++) {
      y += size * 1.35
      const price = between(random, 0.5, 24)
      total += price
      const fade = 0.35 + random() * 0.5
      text(ctx, pick(random, ITEMS), pad, y, size, MONO, ink(fade))
      text(ctx, price.toFixed(2), width - pad, y, size, MONO, ink(fade), 'right')
    }
    y += size * 1.5
    text(ctx, '================================', width / 2, y, size, MONO, ink(0.55), 'center')
    y += size * 1.6
    text(ctx, 'TOTAL', pad, y, size * 1.25, MONO, ink(0.9), 'left', 700)
    text(ctx, total.toFixed(2), width - pad, y, size * 1.25, MONO, ink(0.9), 'right', 700)
    // Barcode, when the strip is long enough to carry one.
    let x = pad
    const barTop = y + size * 1.8
    while (barTop + size * 2.4 < height * 0.92 && x < width - pad) {
      const bar = width * between(random, 0.004, 0.018)
      ctx.fillStyle = ink(0.75)
      ctx.fillRect(x, barTop, bar, size * 2.4)
      x += bar + width * between(random, 0.004, 0.016)
    }
  },

  envelope(ctx, width, height, random) {
    const base = pick(random, ['#a9b5c3', '#b3bcc8', '#9eacbb'])
    fill(ctx, base, width, height)
    // Security tint: a dense field of tiny repeated marks hides the contents.
    ctx.fillStyle = 'rgba(42,58,82,0.28)'
    const step = Math.max(6, Math.min(width, height) * 0.03)
    for (let y = 0; y < height; y += step * 0.7) {
      for (let x = (y / step) % 2 === 0 ? 0 : step / 2; x < width; x += step) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(-0.6)
        ctx.fillRect(0, 0, step * 0.55, step * 0.14)
        ctx.restore()
      }
    }
    // A strip of printed type on the flap, set sideways like a franking line.
    const size = height * 0.075
    ctx.save()
    ctx.translate(width * 0.92, height * 0.12)
    ctx.rotate(Math.PI / 2)
    text(ctx, pick(random, ['Kassenserien', 'Filiale 0472', 'Rückschein', 'Correo urgente']), 0, 0, size, TYPEWRITER, 'rgba(25,30,40,0.8)')
    text(ctx, `Tel: ${Math.floor(between(random, 10, 99))} ${Math.floor(between(random, 100, 999))} ${Math.floor(between(random, 10, 99))}`, 0, size * 1.3, size * 0.8, TYPEWRITER, 'rgba(25,30,40,0.65)')
    ctx.restore()
  },

  invoice(ctx, width, height, random) {
    fill(ctx, pick(random, ['#f0bfa7', '#efc6b2', '#f4c9b4']), width, height)
    const rule = 'rgba(180,80,70,0.45)'
    ctx.strokeStyle = rule
    ctx.lineWidth = Math.max(1, height * 0.006)
    const rows = 4 + Math.floor(random() * 3)
    for (let row = 1; row < rows; row++) {
      const y = (height * row) / rows
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    const columns = [0.18, 0.62, 0.8]
    for (const column of columns) {
      ctx.beginPath()
      ctx.moveTo(width * column, 0)
      ctx.lineTo(width * column, height)
      ctx.stroke()
    }
    // Carbon copies get filed upside down as often as not.
    const flipped = random() < 0.5
    if (flipped) {
      ctx.save()
      ctx.translate(width, height)
      ctx.rotate(Math.PI)
    }
    const size = height / rows * 0.42
    for (let row = 0; row < rows; row++) {
      const y = (height * (row + 0.68)) / rows
      text(ctx, pick(random, ['Escher & Co', 'Werkstätten', 'Filialbank', 'Konto', 'Bestell-Nr.', 'Lieferung']), width * 0.2, y, size, MONO, 'rgba(40,30,30,0.75)')
      text(ctx, `${Math.floor(between(random, 10, 99))} ${Math.floor(between(random, 10, 99))} ${Math.floor(between(random, 10, 99))}`, width * 0.64, y, size, MONO, 'rgba(40,30,30,0.7)')
      text(ctx, `${Math.floor(between(random, 1, 9))} ${Math.floor(between(random, 100, 999))}|${Math.floor(between(random, 10, 99))}`, width * 0.82, y, size, MONO, 'rgba(40,30,30,0.7)')
    }
    if (flipped) ctx.restore()
  },

  kraft(ctx, width, height, random) {
    fill(ctx, pick(random, ['#a8845a', '#b08c62', '#9c7a52']), width, height)
    const short = Math.min(width, height)
    // Fibres.
    for (let fibre = 0; fibre < (width * height) / 900; fibre++) {
      const x = random() * width
      const y = random() * height
      const length = short * between(random, 0.01, 0.05)
      const angle = random() * Math.PI
      ctx.strokeStyle = random() < 0.5 ? 'rgba(70,48,25,0.18)' : 'rgba(225,200,160,0.18)'
      ctx.lineWidth = Math.max(0.6, short * 0.0025)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
      ctx.stroke()
    }
    // Corrugation shows through as faint ribs.
    const rib = short * 0.06
    for (let x = 0; x < width; x += rib) {
      ctx.fillStyle = 'rgba(60,40,20,0.07)'
      ctx.fillRect(x, 0, rib * 0.45, height)
    }
  },

  newsprint(ctx, width, height, random) {
    fill(ctx, '#e7e2d3', width, height)
    const gutter = width * 0.04
    const columns = 3
    const columnWidth = (width - gutter * (columns + 1)) / columns
    const size = width * 0.022
    const top = height * 0.08
    text(ctx, pick(random, ['LOCAL SURF', 'THE END OF', 'RAY OF', 'NIGHT EDITION']), gutter * 1.5, top + size * 3, size * 3, HEAVY, 'rgba(25,25,25,0.9)')
    // Halftone photo block on one column.
    const photoColumn = Math.floor(random() * columns)
    const photoX = gutter + photoColumn * (columnWidth + gutter)
    const photoY = top + size * 5
    const photoH = height * 0.42
    const cell = Math.max(3, width * 0.008)
    const phase = random() * 10
    for (let y = 0; y < photoH; y += cell) {
      for (let x = 0; x < columnWidth; x += cell) {
        const tone = 0.5 + 0.5 * Math.sin(x / columnWidth * 3 + phase) * Math.cos(y / photoH * 4 + phase * 0.7)
        const radius = (cell / 2) * Math.sqrt(Math.max(0, tone))
        ctx.fillStyle = 'rgba(30,30,30,0.85)'
        ctx.beginPath()
        ctx.arc(photoX + x + cell / 2, photoY + y + cell / 2, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    // Body copy as lines of greyed type.
    for (let column = 0; column < columns; column++) {
      const x = gutter + column * (columnWidth + gutter)
      let y = column === photoColumn ? photoY + photoH + size * 2 : photoY + size
      while (y < height - size) {
        const words = []
        for (let w = 0; w < 6; w++) words.push(pick(random, ['the', 'print', 'surf', 'end', 'type', 'of', 'and', 'paper', 'noise', 'grid', 'copy', 'was']))
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y - size * 1.2, columnWidth, size * 1.6)
        ctx.clip()
        text(ctx, words.join(' '), x, y, size, GROTESK, 'rgba(40,40,40,0.72)')
        ctx.restore()
        y += size * 1.3
      }
    }
  },

  graph(ctx, width, height, random) {
    fill(ctx, '#f3f1e8', width, height)
    const cell = Math.min(width, height) * between(random, 0.035, 0.06)
    for (let x = 0, i = 0; x < width; x += cell, i++) {
      ctx.fillStyle = i % 5 === 0 ? 'rgba(70,120,190,0.45)' : 'rgba(70,120,190,0.22)'
      ctx.fillRect(x, 0, Math.max(1, cell * (i % 5 === 0 ? 0.06 : 0.03)), height)
    }
    for (let y = 0, i = 0; y < height; y += cell, i++) {
      ctx.fillStyle = i % 5 === 0 ? 'rgba(70,120,190,0.45)' : 'rgba(70,120,190,0.22)'
      ctx.fillRect(0, y, width, Math.max(1, cell * (i % 5 === 0 ? 0.06 : 0.03)))
    }
    text(ctx, pick(random, ['fig. 3', 'x = 14', 'layout v2', 'no grid']), width * 0.12, height * 0.22, cell * 1.2, TYPEWRITER, 'rgba(30,30,60,0.7)')
  },

  ticket(ctx, width, height, random) {
    const color = pick(random, ['#e1251b', '#f2c300', '#2f6fd6', '#e8431a'])
    fill(ctx, color, width, height)
    const ink = color === '#f2c300' ? 'rgba(20,20,20,0.9)' : 'rgba(250,248,240,0.92)'
    text(ctx, 'ADMIT ONE', width * 0.08, height * 0.36, height * 0.2, HEAVY, ink)
    text(ctx, `No. ${String(Math.floor(between(random, 10000, 99999)))}`, width * 0.08, height * 0.72, height * 0.2, MONO, ink)
    // Perforation down the stub.
    const stub = width * 0.78
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    for (let y = height * 0.05; y < height; y += height * 0.09) {
      ctx.beginPath()
      ctx.arc(stub, y, height * 0.018, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    text(ctx, `${Math.floor(between(random, 1, 40))}`, stub + width * 0.04, height * 0.62, height * 0.36, HEAVY, ink)
  },

  tape(ctx, width, height, random) {
    // Masking tape is a creped, half-translucent paper: print shows through it,
    // greyed and softened, and two strips laid over each other read denser.
    fill(ctx, 'rgba(218,200,150,0.58)', width, height)
    // Crepe: fine irregular ridges across the strip.
    let x = 0
    while (x < width) {
      const ridge = Math.max(1, height * between(random, 0.004, 0.012))
      ctx.fillStyle = random() < 0.5 ? `rgba(150,125,70,${between(random, 0.02, 0.06)})` : `rgba(255,248,226,${between(random, 0.04, 0.1)})`
      ctx.fillRect(x, 0, ridge, height)
      x += ridge + height * between(random, 0.006, 0.03)
    }
    // Lengthwise mottle where the adhesive is thicker.
    for (let blot = 0; blot < 6; blot++) {
      const gradient = ctx.createRadialGradient(random() * width, height / 2, 0, random() * width, height / 2, height * between(random, 0.8, 2))
      gradient.addColorStop(0, 'rgba(180,150,90,0.12)')
      gradient.addColorStop(1, 'rgba(180,150,90,0)')
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
    }
    // Factory edges catch a little more adhesive and dirt.
    ctx.fillStyle = 'rgba(140,115,65,0.14)'
    ctx.fillRect(0, height * 0.04, width, Math.max(1, height * 0.025))
    ctx.fillRect(0, height * 0.935, width, Math.max(1, height * 0.025))
  },

  packing(ctx, width, height, random) {
    // Clear film: almost nothing but a faint amber cast…
    fill(ctx, 'rgba(236,224,188,0.14)', width, height)
    // …and light. Gloss bands run the length of the tape, soft-edged: paint
    // them small and let the upscale blur them.
    const small = document.createElement('canvas')
    small.width = Math.max(8, Math.round(width / 10))
    small.height = Math.max(4, Math.round(height / 10))
    const glossCtx = small.getContext('2d')
    if (glossCtx) {
      const bands = 2 + Math.floor(random() * 3)
      for (let band = 0; band < bands; band++) {
        const centre = between(random, 0.15, 0.85) * small.height
        const thickness = between(random, 0.04, 0.16) * small.height
        const phase = random() * Math.PI * 2
        const waves = between(random, 0.5, 1.5)
        const swell = between(random, 0.5, 1.2)
        // A smooth ribbon: the film's gloss follows the gentle wave of the tape.
        const ribbon = (i: number) => centre + Math.sin((i / 24) * Math.PI * 2 * waves + phase) * small.height * 0.08
        const half = (i: number) => (thickness / 2) * (1 + (swell - 1) * Math.sin((i / 24) * Math.PI))
        glossCtx.fillStyle = `rgba(255,255,255,${between(random, 0.35, 0.8)})`
        glossCtx.beginPath()
        for (let i = 0; i <= 24; i++) {
          const gx = (i / 24) * small.width
          if (i === 0) glossCtx.moveTo(gx, ribbon(i) - half(i))
          else glossCtx.lineTo(gx, ribbon(i) - half(i))
        }
        for (let i = 24; i >= 0; i--) glossCtx.lineTo((i / 24) * small.width, ribbon(i) + half(i))
        glossCtx.closePath()
        glossCtx.fill()
      }
      ctx.save()
      ctx.globalAlpha = 0.55
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(small, 0, 0, width, height)
      ctx.restore()
    }
    // Wrinkles where the tape went down crooked: a lit side and a shaded side.
    const wrinkles = 3 + Math.floor(random() * 5)
    for (let wrinkle = 0; wrinkle < wrinkles; wrinkle++) {
      const x = random() * width
      const y = random() * height
      const angle = (random() < 0.7 ? Math.PI / 2 : 0) + (random() - 0.5) * 1.1
      const length = height * between(random, 0.25, 1.1)
      const dx = Math.cos(angle) * length / 2
      const dy = Math.sin(angle) * length / 2
      const offset = Math.max(1, height * 0.012)
      ctx.lineCap = 'round'
      ctx.strokeStyle = `rgba(255,255,255,${between(random, 0.18, 0.4)})`
      ctx.lineWidth = Math.max(1, height * 0.008)
      ctx.beginPath()
      ctx.moveTo(x - dx, y - dy)
      ctx.quadraticCurveTo(x + (random() - 0.5) * length * 0.3, y + (random() - 0.5) * length * 0.3, x + dx, y + dy)
      ctx.stroke()
      ctx.strokeStyle = `rgba(40,30,15,${between(random, 0.06, 0.14)})`
      ctx.beginPath()
      ctx.moveTo(x - dx + offset, y - dy + offset)
      ctx.lineTo(x + dx + offset, y + dy + offset)
      ctx.stroke()
    }
    // Trapped air: a soft lifted spot of film, lit on one side only.
    const bubbles = Math.floor(random() * 4)
    for (let bubble = 0; bubble < bubbles; bubble++) {
      const bx = random() * width
      const by = between(random, 0.2, 0.8) * height
      const r = height * between(random, 0.02, 0.06)
      const glow = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, 0, bx, by, r * 1.3)
      glow.addColorStop(0, 'rgba(255,255,255,0.22)')
      glow.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.ellipse(bx, by, r * 1.4, r, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'
      ctx.lineWidth = Math.max(1, r * 0.1)
      ctx.beginPath()
      ctx.ellipse(bx, by, r * 1.4, r, 0, Math.PI * 1.05, Math.PI * 1.55)
      ctx.stroke()
    }
    // The film's factory edges: a bright line with a hairline shadow.
    for (const y of [height * 0.04, height * 0.96]) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)'
      ctx.fillRect(0, y - height * 0.006, width, Math.max(1, height * 0.012))
      ctx.fillStyle = 'rgba(30,20,10,0.12)'
      ctx.fillRect(0, y + height * 0.008, width, Math.max(1, height * 0.008))
    }
  },

  peel(ctx, width, height, random) {
    // Where a printed top layer was ripped away: the white fibrous body of the sheet.
    fill(ctx, '#f3f2ec', width, height)
    const short = Math.min(width, height)
    for (let fibre = 0; fibre < (width * height) / 350; fibre++) {
      const x = random() * width
      const y = random() * height
      const length = short * between(random, 0.005, 0.03)
      const angle = random() * Math.PI
      ctx.strokeStyle = random() < 0.5 ? 'rgba(120,115,100,0.1)' : 'rgba(255,255,255,0.6)'
      ctx.lineWidth = Math.max(0.6, short * 0.002)
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + (random() - 0.5) * length, y + (random() - 0.5) * length, x + Math.cos(angle) * length, y + Math.sin(angle) * length)
      ctx.stroke()
    }
    // Flecks of the lost print still clinging on.
    const ink = pick(random, ['rgba(20,20,20,0.8)', 'rgba(205,35,30,0.8)', 'rgba(40,70,150,0.75)'])
    for (let fleck = 0; fleck < 40; fleck++) {
      const along = random()
      const side = Math.floor(random() * 4)
      const x = side === 0 ? along * width : side === 1 ? width * between(random, 0.85, 1) : side === 2 ? along * width : width * between(random, 0, 0.15)
      const y = side === 1 || side === 3 ? along * height : side === 0 ? height * between(random, 0, 0.15) : height * between(random, 0.85, 1)
      const size = short * between(random, 0.004, 0.02)
      ctx.fillStyle = ink
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + size, y + size * (random() - 0.2))
      ctx.lineTo(x + size * random(), y + size)
      ctx.closePath()
      ctx.fill()
    }
  },

  black(ctx, width, height, random) {
    fill(ctx, '#1b1b1a', width, height)
    // Crumple: creases as faint light and dark facets.
    const short = Math.min(width, height)
    // A fold is a soft ridge: a broad lit side, a broad shaded side, a fine crest.
    for (let crease = 0; crease < 14; crease++) {
      const x = random() * width
      const y = random() * height
      const angle = random() * Math.PI
      const length = short * between(random, 0.3, 1)
      const dx = Math.cos(angle) * length
      const dy = Math.sin(angle) * length
      const nx = -Math.sin(angle)
      const ny = Math.cos(angle)
      const spread = short * between(random, 0.02, 0.06)
      const ridge = (offset: number, color: string, lineWidth: number) => {
        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth
        ctx.beginPath()
        ctx.moveTo(x - dx + nx * offset, y - dy + ny * offset)
        ctx.lineTo(x + dx + nx * offset, y + dy + ny * offset)
        ctx.stroke()
      }
      ridge(-spread / 2, 'rgba(255,255,255,0.035)', spread)
      ridge(spread / 2, 'rgba(0,0,0,0.25)', spread)
      ridge(0, 'rgba(255,255,255,0.08)', Math.max(1, short * 0.003))
    }
  },

  poster(ctx, width, height, random) {
    const paper = pick(random, ['#f1efe9', '#f2c300', '#e9e4da', '#e1251b'])
    fill(ctx, paper, width, height)
    const ink = paper === '#e1251b' ? '#111111' : pick(random, ['#111111', '#111111', '#e1251b'])
    // A giant letter, cropped by the tear: only part of it survives.
    const letter = pick(random, ['a', 'R', 'g', 'S', 'e', 'K', 'y', '7'])
    const size = height * between(random, 1.1, 1.6)
    text(ctx, letter, width * between(random, -0.15, 0.25), height * between(random, 0.8, 1.15), size, HEAVY, ink)
    text(ctx, pick(random, ['live / 9pm', 'tour 1996', 'no. 04', 'free entry']), width * 0.6, height * 0.2, height * 0.07, MONO, ink, 'left', 700)
  },
}
