export type PosterPresetId = 'a3' | 'a2' | 'instagram' | 'square' | 'custom'

export type PosterPreset = {
  id: PosterPresetId
  name: string
  width: number
  height: number
}

export type LayerTransform = {
  id: string
  left: number
  top: number
  angle: number
  scaleX: number
  scaleY: number
}

export type AccidentTransform = LayerTransform & {
  opacity: number
}

export type SliceSource = {
  id: string
  left: number
  top: number
  width: number
  height: number
}

export type CutFragment = {
  id: string
  left: number
  top: number
  width: number
  height: number
  clipTop: number
  clipLeft: number
}

export type TypeStrip = {
  id: string
  text: string
  left: number
  top: number
  width: number
  height: number
  angle: number
  inverted: boolean
}

export type TearFragment = CutFragment & {
  angle: number
  offsetX: number
  offsetY: number
}

export type NoiseMark =
  | {
      id: string
      kind: 'speck'
      left: number
      top: number
      size: number
      opacity: number
    }
  | {
      id: string
      kind: 'scratch' | 'scanline'
      left: number
      top: number
      width: number
      height: number
      angle: number
      opacity: number
    }

export type CropGuide =
  | {
      id: string
      kind: 'line'
      left: number
      top: number
      width: number
      height: number
    }
  | {
      id: string
      kind: 'cross'
      left: number
      top: number
      size: number
    }

export type ExpressiveLegibility = 'high' | 'medium' | 'low'

export type ExpressiveGlyph = {
  id: string
  text: string
  left: number
  top: number
  angle: number
  fontSize: number
  opacity: number
  scaleX: number
  scaleY: number
}

export type PrintScanProfile = {
  generation: number
  contrast: number
  noise: number
  blur: number
  opacity: number
  misregistration: number
}

export type PrintScanArtifact =
  | {
      id: string
      kind: 'band'
      left: number
      top: number
      width: number
      height: number
      opacity: number
    }
  | {
      id: string
      kind: 'drift'
      left: number
      top: number
      width: number
      height: number
      angle: number
      opacity: number
    }

const POSTER_PRESETS: Record<Exclude<PosterPresetId, 'custom'>, PosterPreset> = {
  a3: { id: 'a3', name: 'A3 portrait', width: 1240, height: 1754 },
  a2: { id: 'a2', name: 'A2 portrait', width: 1754, height: 2480 },
  instagram: { id: 'instagram', name: 'Instagram portrait', width: 1080, height: 1350 },
  square: { id: 'square', name: 'Square', width: 1600, height: 1600 },
}

const CUSTOM_PRESET: PosterPreset = {
  id: 'custom',
  name: 'Custom',
  width: 1200,
  height: 1600,
}

export function clampDimension(value: number) {
  if (!Number.isFinite(value)) return 1200
  return Math.min(3000, Math.max(320, Math.round(value)))
}

export function getPosterPreset(id: PosterPresetId) {
  return id === 'custom' ? CUSTOM_PRESET : POSTER_PRESETS[id]
}

export function applyPosterPreset(
  id: PosterPresetId,
  custom?: Partial<Pick<PosterPreset, 'width' | 'height'>>,
): PosterPreset {
  if (id !== 'custom') return getPosterPreset(id)

  return {
    ...CUSTOM_PRESET,
    width: clampDimension(custom?.width ?? CUSTOM_PRESET.width),
    height: clampDimension(custom?.height ?? CUSTOM_PRESET.height),
  }
}

export function scatterLayers(
  layers: LayerTransform[],
  options: {
    distance: number
    rotation: number
    scale: number
    random?: () => number
  },
): LayerTransform[] {
  const random = options.random ?? Math.random

  return layers.map((layer) => {
    const dx = (random() - 0.5) * options.distance * 2
    const dy = (random() - 0.5) * options.distance * 2
    const da = (random() - 0.5) * options.rotation * 2
    const ds = 1 + (random() - 0.5) * options.scale * 2

    return {
      ...layer,
      left: round(layer.left + dx),
      top: round(layer.top + dy),
      angle: round(layer.angle + da),
      scaleX: round(layer.scaleX * ds),
      scaleY: round(layer.scaleY * ds),
    }
  })
}

export function createAccidentTransforms(
  layers: LayerTransform[],
  options: {
    intensity: number
    random?: () => number
  },
): AccidentTransform[] {
  const random = options.random ?? Math.random
  const intensity = Math.max(0, Math.min(100, options.intensity)) / 100
  const distance = 50 * intensity
  const rotation = 25 * intensity
  const stretch = 0.3 * intensity

  return layers.map((layer) => {
    const dx = (random() - 0.5) * distance * 2
    const dy = (random() - 0.5) * distance * 2
    const da = (random() - 0.5) * rotation * 2
    const sx = 1 + (random() - 0.5) * stretch
    const sy = 1 - (random() - 0.5) * stretch

    return {
      id: layer.id,
      left: round(layer.left + dx),
      top: round(layer.top + dy),
      angle: round(layer.angle + da),
      scaleX: round(layer.scaleX * sx),
      scaleY: round(layer.scaleY * sy),
      opacity: round(Math.max(0.24, 1 - intensity * 0.3)),
    }
  })
}

export function createCutFragments(
  source: SliceSource,
  options: {
    pieces: number
    gap: number
    direction: 'horizontal' | 'vertical'
  },
): CutFragment[] {
  const pieces = Math.min(12, Math.max(2, Math.round(options.pieces)))
  const isHorizontal = options.direction === 'horizontal'
  const sourceSize = isHorizontal ? source.height : source.width
  const maxGap = sourceSize > pieces ? (sourceSize - pieces) / (pieces - 1) : 0
  const gap = Math.max(0, Math.min(options.gap, maxGap))
  const totalGap = gap * (pieces - 1)
  const fragmentSize = (sourceSize - totalGap) / pieces

  return Array.from({ length: pieces }, (_, index) => {
    const offset = index * (fragmentSize + gap)
    const drift = index * gap

    if (isHorizontal) {
      return {
        id: `${source.id}-cut-${index + 1}`,
        left: source.left + drift,
        top: source.top + offset,
        width: source.width,
        height: fragmentSize,
        clipTop: offset,
        clipLeft: 0,
      }
    }

    return {
      id: `${source.id}-cut-${index + 1}`,
      left: source.left + offset,
      top: source.top + drift,
      width: fragmentSize,
      height: source.height,
      clipTop: 0,
      clipLeft: offset,
    }
  })
}

export function createTypeStrips(
  source: Pick<SliceSource, 'id' | 'left' | 'top' | 'width'> & { text: string },
  options: {
    rows: number
    height: number
    gap: number
    jitter: number
    random?: () => number
  },
): TypeStrip[] {
  const random = options.random ?? Math.random
  const rows = Math.min(16, Math.max(2, Math.round(options.rows)))
  const height = Math.max(12, options.height)
  const gap = Math.max(0, options.gap)
  const cleanText = source.text.trim() || 'TYPE STRIP'

  return Array.from({ length: rows }, (_, index) => {
    const jitterX = (random() - 0.5) * options.jitter * 2
    const jitterY = (random() - 0.5) * options.jitter
    const angle = (random() - 0.5) * 3

    return {
      id: `${source.id}-strip-${index + 1}`,
      text: repeatText(cleanText, 8),
      left: round(source.left + jitterX),
      top: round(source.top + index * (height + gap) + jitterY),
      width: source.width,
      height,
      angle: round(angle),
      inverted: index % 2 === 1,
    }
  })
}

export function createExpressiveGlyphs(
  source: Pick<SliceSource, 'id' | 'left' | 'top'> & {
    text: string
    fontSize: number
    charSpacing: number
  },
  options: {
    intensity: number
    legibility: ExpressiveLegibility
    random?: () => number
  },
): ExpressiveGlyph[] {
  const random = options.random ?? Math.random
  const intensity = Math.max(0, Math.min(100, options.intensity)) / 100
  const legibilityFactor = options.legibility === 'high' ? 0.45 : options.legibility === 'medium' ? 1 : 1.65
  const characters = Array.from(source.text.replace(/\s+/g, ' ').trim() || 'TYPE')
  const advance = Math.max(8, source.fontSize * (0.46 - intensity * legibilityFactor * 0.08) + source.charSpacing * 0.1)
  const jitterX = source.fontSize * 0.3 * intensity * legibilityFactor
  const jitterY = source.fontSize * 0.15 * intensity * legibilityFactor
  const maxAngle = 24 * intensity * legibilityFactor
  const sizeSwing = 0.3 * intensity * legibilityFactor
  const opacityLoss = 0.1 * intensity * legibilityFactor

  return characters.map((character, index) => {
    const scale = 1 + (random() - 0.5) * sizeSwing

    return {
      id: `${source.id}-glyph-${index + 1}`,
      text: character,
      left: round(source.left + index * advance + (random() - 0.5) * jitterX),
      top: round(source.top + (random() - 0.5) * jitterY),
      angle: round((random() - 0.5) * maxAngle),
      fontSize: round(Math.max(8, source.fontSize * scale)),
      opacity: round(Math.max(0.18, 1 - random() * opacityLoss)),
      scaleX: round(1 + (random() - 0.5) * sizeSwing * 0.5),
      scaleY: round(1 + (random() - 0.5) * sizeSwing * 0.5),
    }
  })
}

export function createTearFragments(
  source: SliceSource,
  options: {
    pieces: number
    gap: number
    random?: () => number
  },
): TearFragment[] {
  const random = options.random ?? Math.random
  const pieces = Math.min(10, Math.max(3, Math.round(options.pieces)))
  const gap = Math.max(0, options.gap)
  const baseWidth = Math.max(1, source.width / pieces)

  return Array.from({ length: pieces }, (_, index) => {
    const widthJitter = 0.72 + random() * 0.44
    const width = index === pieces - 1 ? source.width - baseWidth * index : Math.min(source.width - baseWidth * index, baseWidth * widthJitter)
    const clipLeft = Math.min(source.width - 1, baseWidth * index)
    const offsetX = (random() - 0.5) * gap * 2
    const offsetY = (random() - 0.5) * gap * 2

    return {
      id: `${source.id}-tear-${index + 1}`,
      left: round(source.left + clipLeft + offsetX),
      top: round(source.top + offsetY),
      width: round(Math.max(1, width)),
      height: source.height,
      clipTop: 0,
      clipLeft: round(clipLeft),
      angle: round((random() - 0.5) * 14),
      offsetX: round(offsetX),
      offsetY: round(offsetY),
    }
  })
}

export function createPhotocopyNoise(
  area: Pick<PosterPreset, 'width' | 'height'>,
  options: {
    specks: number
    scratches: number
    scanlines: number
    random?: () => number
  },
): NoiseMark[] {
  const random = options.random ?? Math.random
  const speckCount = Math.max(0, Math.round(options.specks))
  const scratchCount = Math.max(0, Math.round(options.scratches))
  const scanlineCount = Math.max(0, Math.round(options.scanlines))
  const marks: NoiseMark[] = []

  for (let index = 0; index < speckCount; index += 1) {
    marks.push({
      id: `speck-${index + 1}`,
      kind: 'speck',
      left: round(random() * area.width),
      top: round(random() * area.height),
      size: round(1 + random() * 6),
      opacity: round(0.18 + random() * 0.34),
    })
  }

  for (let index = 0; index < scratchCount; index += 1) {
    marks.push({
      id: `scratch-${index + 1}`,
      kind: 'scratch',
      left: round(random() * area.width),
      top: round(random() * area.height),
      width: round(area.width * (0.04 + random() * 0.18)),
      height: round(1 + random() * 2),
      angle: round((random() - 0.5) * 26),
      opacity: round(0.16 + random() * 0.24),
    })
  }

  for (let index = 0; index < scanlineCount; index += 1) {
    marks.push({
      id: `scanline-${index + 1}`,
      kind: 'scanline',
      left: 0,
      top: round((index + 1) * (area.height / (scanlineCount + 1))),
      width: area.width,
      height: 1,
      angle: 0,
      opacity: round(0.08 + random() * 0.12),
    })
  }

  return marks
}

export function getPrintScanProfile(generation: number): PrintScanProfile {
  const safeGeneration = Math.max(1, Math.min(10, Math.round(generation)))
  const progress = (safeGeneration - 1) / 9

  return {
    generation: safeGeneration,
    contrast: round(0.28 + progress * 0.5),
    noise: Math.round(80 + progress * 180),
    blur: round(0.04 + progress * 0.12),
    opacity: round(0.96 - progress * 0.06),
    misregistration: round(3 + progress * 15),
  }
}

export function createPrintScanArtifacts(
  area: Pick<PosterPreset, 'width' | 'height'>,
  options: {
    generation: number
    random?: () => number
  },
): PrintScanArtifact[] {
  const random = options.random ?? Math.random
  const profile = getPrintScanProfile(options.generation)
  const bandCount = Math.max(3, Math.round(3 + profile.generation * 0.6))
  const driftCount = Math.max(2, Math.round(1 + profile.generation * 0.4))
  const artifacts: PrintScanArtifact[] = []

  for (let index = 0; index < bandCount; index += 1) {
    artifacts.push({
      id: `xerox-band-${index + 1}`,
      kind: 'band',
      left: 0,
      top: round(((index + 1) * area.height) / (bandCount + 1)),
      width: area.width,
      height: round(2 + random() * profile.generation * 1.2),
      opacity: round(0.045 + profile.generation * 0.01),
    })
  }

  for (let index = 0; index < driftCount; index += 1) {
    artifacts.push({
      id: `xerox-drift-${index + 1}`,
      kind: 'drift',
      left: round(random() * area.width),
      top: round(random() * area.height),
      width: round(area.width * (0.08 + random() * 0.16)),
      height: round(1 + random() * 2),
      angle: round((random() - 0.5) * 8),
      opacity: round(0.1 + profile.generation * 0.01),
    })
  }

  return artifacts
}

export function createCropGuides(area: Pick<PosterPreset, 'width' | 'height'>, margin: number): CropGuide[] {
  const safeMargin = Math.max(24, Math.min(margin, Math.min(area.width, area.height) / 3))
  const guideLength = Math.max(32, safeMargin * 0.72)
  const centerX = area.width / 2
  const centerY = area.height / 2

  const guides: CropGuide[] = [
    { id: 'crop-top-left-h', kind: 'line', left: safeMargin, top: safeMargin, width: guideLength, height: 1 },
    { id: 'crop-top-left-v', kind: 'line', left: safeMargin, top: safeMargin, width: 1, height: guideLength },
    { id: 'crop-top-right-h', kind: 'line', left: area.width - safeMargin - guideLength, top: safeMargin, width: guideLength, height: 1 },
    { id: 'crop-top-right-v', kind: 'line', left: area.width - safeMargin, top: safeMargin, width: 1, height: guideLength },
    { id: 'crop-bottom-left-h', kind: 'line', left: safeMargin, top: area.height - safeMargin, width: guideLength, height: 1 },
    { id: 'crop-bottom-left-v', kind: 'line', left: safeMargin, top: area.height - safeMargin - guideLength, width: 1, height: guideLength },
    {
      id: 'crop-bottom-right-h',
      kind: 'line',
      left: area.width - safeMargin - guideLength,
      top: area.height - safeMargin,
      width: guideLength,
      height: 1,
    },
    { id: 'crop-bottom-right-v', kind: 'line', left: area.width - safeMargin, top: area.height - safeMargin - guideLength, width: 1, height: guideLength },
    { id: 'grid-third-v-1', kind: 'line', left: area.width / 3, top: safeMargin, width: 1, height: area.height - safeMargin * 2 },
    { id: 'grid-third-v-2', kind: 'line', left: (area.width / 3) * 2, top: safeMargin, width: 1, height: area.height - safeMargin * 2 },
    { id: 'grid-third-h-1', kind: 'line', left: safeMargin, top: area.height / 3, width: area.width - safeMargin * 2, height: 1 },
    { id: 'grid-third-h-2', kind: 'line', left: safeMargin, top: (area.height / 3) * 2, width: area.width - safeMargin * 2, height: 1 },
    { id: 'registration-center', kind: 'cross', left: centerX, top: centerY, size: Math.max(18, safeMargin * 0.35) },
  ]

  return guides.map((guide) => {
    if (guide.kind === 'cross') {
      return { ...guide, left: round(guide.left), top: round(guide.top), size: round(guide.size) }
    }
    return {
      ...guide,
      left: round(guide.left),
      top: round(guide.top),
      width: round(guide.width),
      height: round(guide.height),
    }
  })
}

function repeatText(text: string, count: number) {
  return Array.from({ length: count }, () => text).join('  /  ')
}

function round(value: number) {
  return Math.round(value * 1000) / 1000
}
