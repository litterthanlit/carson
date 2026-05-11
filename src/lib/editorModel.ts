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

export function createCutFragments(
  source: SliceSource,
  options: {
    pieces: number
    gap: number
    direction: 'horizontal' | 'vertical'
  },
): CutFragment[] {
  const pieces = Math.min(12, Math.max(2, Math.round(options.pieces)))
  const totalGap = options.gap * (pieces - 1)
  const isHorizontal = options.direction === 'horizontal'
  const sourceSize = isHorizontal ? source.height : source.width
  const fragmentSize = (sourceSize - totalGap) / pieces

  return Array.from({ length: pieces }, (_, index) => {
    const offset = index * (fragmentSize + options.gap)
    const drift = index * options.gap

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

function round(value: number) {
  return Math.round(value * 1000) / 1000
}
