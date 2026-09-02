/**
 * Scramble — rearrange the user's own layers into a new compositional structure.
 * Seeded, deterministic, never invents imagery. Treatments stay as modifiers on the new pose.
 */

export type ScramblePosture =
  | 'stack'
  | 'split'
  | 'diagonal'
  | 'cluster'
  | 'edges'
  | 'anchor'
  | 'asymmetric'
  | 'overlap-band'

export type ScrambleLayer = {
  id: string
  left: number
  top: number
  width: number
  height: number
  angle: number
}

export type ScrambleTransform = {
  id: string
  left: number
  top: number
  angle: number
  z: number
}

export type ScrambleResult = {
  posture: ScramblePosture
  label: string
  transforms: ScrambleTransform[]
}

export const SCRAMBLE_POSTURES: ScramblePosture[] = [
  'stack',
  'split',
  'diagonal',
  'cluster',
  'edges',
  'anchor',
  'asymmetric',
  'overlap-band',
]

export const SCRAMBLE_POSTURE_LABELS: Record<ScramblePosture, string> = {
  stack: 'stacked column',
  split: 'split columns',
  diagonal: 'diagonal cascade',
  cluster: 'collision cluster',
  edges: 'edge flush',
  anchor: 'anchored field',
  asymmetric: 'asymmetric hero',
  'overlap-band': 'overlap band',
}

const ARTIFACT_KEYS = [
  'scrapeFragment',
  'sliceSourceId',
  'cropSourceId',
  'tearSourceId',
  'badCropSourceId',
  'glyphSourceId',
  'copyMachineSourceId',
  'copyGhostSourceId',
  'decayMarkSourceId',
  'misprintSourceId',
  'typeStripSourceId',
] as const

/** Content layers only — skip locked, hidden, treatment artifacts, and copier ghosts. */
export function isScrambleSourceLayer(record: Record<string, unknown>): boolean {
  if (!record.id) return false
  if (record.visible === false) return false
  if (record.selectable === false) return false
  return ARTIFACT_KEYS.every((key) => !record[key])
}

export function scrambleLayout(
  layers: ScrambleLayer[],
  area: { width: number; height: number },
  options: {
    random?: () => number
    tension?: number
  } = {},
): ScrambleResult {
  const random = options.random ?? Math.random
  const tension = clamp01((options.tension ?? 0) / 100)
  if (layers.length === 0) {
    return { posture: 'stack', label: SCRAMBLE_POSTURE_LABELS.stack, transforms: [] }
  }

  const posture = SCRAMBLE_POSTURES[Math.floor(random() * SCRAMBLE_POSTURES.length)] ?? 'stack'
  const ordered = shuffle(layers, random)
  const raw = layoutPosture(posture, ordered, area, random, tension)
  const overflow = 0.1 + tension * 0.16

  return {
    posture,
    label: SCRAMBLE_POSTURE_LABELS[posture],
    transforms: raw.map((transform) => {
      const layer = layers.find((item) => item.id === transform.id)
      if (!layer) return transform
      const clamped = clampPlacement(transform.left, transform.top, layer.width, layer.height, area, overflow)
      return {
        ...transform,
        left: round(clamped.left),
        top: round(clamped.top),
        angle: round(transform.angle),
      }
    }),
  }
}

function layoutPosture(
  posture: ScramblePosture,
  layers: ScrambleLayer[],
  area: { width: number; height: number },
  random: () => number,
  tension: number,
): ScrambleTransform[] {
  switch (posture) {
    case 'stack':
      return layoutStack(layers, area, random, tension)
    case 'split':
      return layoutSplit(layers, area, random, tension)
    case 'diagonal':
      return layoutDiagonal(layers, area, random, tension)
    case 'cluster':
      return layoutCluster(layers, area, random, tension)
    case 'edges':
      return layoutEdges(layers, area, random, tension)
    case 'anchor':
      return layoutAnchor(layers, area, random, tension)
    case 'asymmetric':
      return layoutAsymmetric(layers, area, random, tension)
    case 'overlap-band':
      return layoutOverlapBand(layers, area, random, tension)
  }
}

function layoutStack(
  layers: ScrambleLayer[],
  area: { width: number; height: number },
  random: () => number,
  tension: number,
): ScrambleTransform[] {
  const marginX = area.width * 0.08
  const marginY = area.height * 0.07
  const usable = Math.max(1, area.height - marginY * 2)
  const totalHeight = layers.reduce((sum, layer) => sum + layer.height, 0)
  const gapCount = Math.max(1, layers.length - 1)
  const naturalGap = area.height * 0.028
  let gap = naturalGap
  if (totalHeight + gap * gapCount > usable) {
    gap = (usable - totalHeight) / gapCount
  }
  gap -= tension * area.height * 0.04

  let cursor = marginY
  return layers.map((layer, index) => {
    const rag = (random() - 0.5) * area.width * (0.1 + tension * 0.22)
    const transform = {
      id: layer.id,
      left: marginX + rag,
      top: cursor,
      angle: jitterAngle(random, 5 + tension * 12),
      z: index,
    }
    cursor += layer.height + gap
    return transform
  })
}

function layoutSplit(
  layers: ScrambleLayer[],
  area: { width: number; height: number },
  random: () => number,
  tension: number,
): ScrambleTransform[] {
  const mid = Math.ceil(layers.length / 2)
  const leftCol = layers.slice(0, mid)
  const rightCol = layers.slice(mid)
  const colWidth = area.width * 0.42
  const leftX = area.width * 0.06
  const rightX = area.width * 0.52
  return [
    ...stackInColumn(leftCol, leftX, colWidth, area, random, tension, 0),
    ...stackInColumn(rightCol, rightX, colWidth, area, random, tension, leftCol.length),
  ]
}

function stackInColumn(
  layers: ScrambleLayer[],
  columnLeft: number,
  columnWidth: number,
  area: { width: number; height: number },
  random: () => number,
  tension: number,
  zOffset: number,
): ScrambleTransform[] {
  const marginY = area.height * 0.08
  const usable = Math.max(1, area.height - marginY * 2)
  const totalHeight = layers.reduce((sum, layer) => sum + layer.height, 0)
  const gapCount = Math.max(1, layers.length - 1)
  let gap = area.height * 0.03
  if (totalHeight + gap * gapCount > usable) {
    gap = (usable - totalHeight) / gapCount
  }
  gap -= tension * area.height * 0.03
  let cursor = marginY
  return layers.map((layer, index) => {
    const rag = (random() - 0.5) * columnWidth * (0.12 + tension * 0.2)
    const transform = {
      id: layer.id,
      left: columnLeft + rag,
      top: cursor,
      angle: jitterAngle(random, 4 + tension * 10),
      z: zOffset + index,
    }
    cursor += layer.height + gap
    return transform
  })
}

function layoutDiagonal(
  layers: ScrambleLayer[],
  area: { width: number; height: number },
  random: () => number,
  tension: number,
): ScrambleTransform[] {
  const reverse = random() > 0.5
  const margin = Math.min(area.width, area.height) * 0.07
  return layers.map((layer, index) => {
    const t = layers.length === 1 ? 0.5 : index / (layers.length - 1)
    const along = reverse ? 1 - t : t
    return {
      id: layer.id,
      left: lerp(margin, area.width - layer.width - margin, along) + (random() - 0.5) * area.width * tension * 0.08,
      top: lerp(margin, area.height - layer.height - margin, t) + (random() - 0.5) * area.height * tension * 0.06,
      angle: lerp(reverse ? 16 : -16, reverse ? -10 : 14, t) + jitterAngle(random, 4 + tension * 8),
      z: index,
    }
  })
}

function layoutCluster(
  layers: ScrambleLayer[],
  area: { width: number; height: number },
  random: () => number,
  tension: number,
): ScrambleTransform[] {
  const cx = area.width * (0.28 + random() * 0.44)
  const cy = area.height * (0.28 + random() * 0.44)
  const spread = 0.08 + tension * 0.12
  return layers.map((layer, index) => ({
    id: layer.id,
    left: cx - layer.width / 2 + (random() - 0.5) * area.width * spread,
    top: cy - layer.height / 2 + (random() - 0.5) * area.height * spread,
    angle: jitterAngle(random, 10 + tension * 22),
    z: index,
  }))
}

function layoutEdges(
  layers: ScrambleLayer[],
  area: { width: number; height: number },
  random: () => number,
  tension: number,
): ScrambleTransform[] {
  const inset = Math.min(area.width, area.height) * (0.04 + tension * 0.02)
  const edges = ['top', 'right', 'bottom', 'left'] as const
  const start = Math.floor(random() * edges.length)
  return layers.map((layer, index) => {
    const edge = edges[(start + index) % edges.length] ?? 'top'
    const slide = random()
    if (edge === 'top') {
      return {
        id: layer.id,
        left: lerp(inset, area.width - layer.width - inset, slide),
        top: inset - layer.height * tension * 0.08,
        angle: jitterAngle(random, 6 + tension * 10),
        z: index,
      }
    }
    if (edge === 'bottom') {
      return {
        id: layer.id,
        left: lerp(inset, area.width - layer.width - inset, slide),
        top: area.height - layer.height - inset + layer.height * tension * 0.08,
        angle: jitterAngle(random, 6 + tension * 10),
        z: index,
      }
    }
    if (edge === 'right') {
      return {
        id: layer.id,
        left: area.width - layer.width - inset + layer.width * tension * 0.08,
        top: lerp(inset, area.height - layer.height - inset, slide),
        angle: jitterAngle(random, 8 + tension * 14),
        z: index,
      }
    }
    return {
      id: layer.id,
      left: inset - layer.width * tension * 0.08,
      top: lerp(inset, area.height - layer.height - inset, slide),
      angle: jitterAngle(random, 8 + tension * 14),
      z: index,
    }
  })
}

function layoutAnchor(
  layers: ScrambleLayer[],
  area: { width: number; height: number },
  random: () => number,
  tension: number,
): ScrambleTransform[] {
  const ranked = [...layers].sort((a, b) => b.width * b.height - a.width * a.height)
  const hero = ranked[0]
  if (!hero) return []
  const rest = ranked.slice(1)
  const heroLeft = area.width * (0.04 + random() * 0.12)
  const heroTop = area.height * (0.06 + random() * 0.16)
  const transforms: ScrambleTransform[] = [
    {
      id: hero.id,
      left: heroLeft,
      top: heroTop,
      angle: jitterAngle(random, 3 + tension * 8),
      z: 0,
    },
  ]
  const railLeft = random() > 0.5 ? area.width * 0.08 : area.width * 0.55
  transforms.push(...stackInColumn(rest, railLeft, area.width * 0.4, area, random, tension, 1))
  return transforms
}

function layoutAsymmetric(
  layers: ScrambleLayer[],
  area: { width: number; height: number },
  random: () => number,
  tension: number,
): ScrambleTransform[] {
  const ranked = [...layers].sort((a, b) => b.width * b.height - a.width * a.height)
  const hero = ranked[0]
  if (!hero) return []
  const rest = ranked.slice(1)
  const corner = Math.floor(random() * 4)
  const margin = Math.min(area.width, area.height) * 0.06
  const heroPose =
    corner === 0
      ? { left: margin, top: margin }
      : corner === 1
        ? { left: area.width - hero.width - margin, top: margin }
        : corner === 2
          ? { left: margin, top: area.height - hero.height - margin }
          : { left: area.width - hero.width - margin, top: area.height - hero.height - margin }

  const oppositeLeft = corner % 2 === 0 ? area.width * 0.52 : area.width * 0.08
  return [
    {
      id: hero.id,
      left: heroPose.left,
      top: heroPose.top,
      angle: jitterAngle(random, 4 + tension * 10),
      z: rest.length,
    },
    ...stackInColumn(rest, oppositeLeft, area.width * 0.4, area, random, tension, 0),
  ]
}

function layoutOverlapBand(
  layers: ScrambleLayer[],
  area: { width: number; height: number },
  random: () => number,
  tension: number,
): ScrambleTransform[] {
  const bandTop = area.height * (0.2 + random() * 0.42)
  const step = area.width / Math.max(2, layers.length + 0.5)
  return layers.map((layer, index) => ({
    id: layer.id,
    left: area.width * 0.05 + index * step * (0.72 - tension * 0.2) + (random() - 0.5) * step * 0.2,
    top: bandTop - layer.height * 0.25 + (random() - 0.5) * layer.height * (0.2 + tension * 0.4),
    angle: jitterAngle(random, 8 + tension * 16),
    z: index,
  }))
}

function clampPlacement(
  left: number,
  top: number,
  width: number,
  height: number,
  area: { width: number; height: number },
  overflow: number,
) {
  const minLeft = -width * overflow
  const minTop = -height * overflow
  const maxLeft = area.width - width * (1 - overflow)
  const maxTop = area.height - height * (1 - overflow)
  return {
    left: Math.min(maxLeft, Math.max(minLeft, left)),
    top: Math.min(maxTop, Math.max(minTop, top)),
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1))
    const current = next[index]
    const other = next[swap]
    if (current === undefined || other === undefined) continue
    next[index] = other
    next[swap] = current
  }
  return next
}

function jitterAngle(random: () => number, amount: number) {
  return (random() - 0.5) * amount * 2
}

function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}

function round(value: number) {
  return Math.round(value * 1000) / 1000
}
