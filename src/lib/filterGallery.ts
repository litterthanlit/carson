import type { FxKind } from './pixelFilters'
import { isFxKind } from './pixelFilters'
import { DUOTONE_PALETTES, RISO_INKS } from './printFilters'
import type { TreatmentType } from './treatments'

export type FilterCategory =
  | 'blur'
  | 'sharpen'
  | 'stylize'
  | 'color'
  | 'film'
  | 'print'
  | 'decay'
  | 'distress'
  | 'transform'
  | 'wash'

export type FilterParamFormat = 'number' | 'degrees' | 'percent'

export type FilterParamDef = {
  key: string
  label: string
  min: number
  max: number
  format?: FilterParamFormat
  /** Names for a discrete param such as a palette index: value `i` reads as `labels[i]`. */
  labels?: readonly string[]
}

export type FilterPreset = {
  id: string
  name: string
  category: FilterCategory
  treatmentType: TreatmentType
  fxKind?: FxKind
  defaultParams: Record<string, number>
  paramDefs: FilterParamDef[]
  description?: string
  scope: 'selection' | 'image'
}

export const FILTER_CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: 'blur', label: 'Blur' },
  { id: 'sharpen', label: 'Sharpen' },
  { id: 'stylize', label: 'Stylize' },
  { id: 'color', label: 'Adjust' },
  { id: 'film', label: 'Look' },
  { id: 'print', label: 'Print' },
  { id: 'decay', label: 'Decay' },
  { id: 'distress', label: 'Distress' },
  { id: 'transform', label: 'Transform' },
  { id: 'wash', label: 'Wash' },
]

const RADIUS: FilterParamDef = { key: 'radius', label: 'Radius', min: 1, max: 100 }
const DISTANCE: FilterParamDef = { key: 'distance', label: 'Distance', min: 1, max: 200 }
const ANGLE: FilterParamDef = { key: 'angle', label: 'Angle', min: 0, max: 360, format: 'degrees' }
const AMOUNT: FilterParamDef = { key: 'amount', label: 'Amount', min: 0, max: 100, format: 'percent' }
const CENTER_X: FilterParamDef = { key: 'centerX', label: 'Center X', min: 0, max: 100, format: 'percent' }
const CENTER_Y: FilterParamDef = { key: 'centerY', label: 'Center Y', min: 0, max: 100, format: 'percent' }
const LEVELS: FilterParamDef = { key: 'levels', label: 'Levels', min: 2, max: 16 }
const BLOCK: FilterParamDef = { key: 'blocksize', label: 'Cell size', min: 2, max: 48 }
const SIGNED: FilterParamDef = { key: 'amount', label: 'Amount', min: -100, max: 100 }
const HUE: FilterParamDef = { key: 'angle', label: 'Hue', min: -180, max: 180, format: 'degrees' }
const THRESHOLD_LEVEL: FilterParamDef = { key: 'level', label: 'Level', min: 0, max: 100, format: 'percent' }
const DOT_CELL: FilterParamDef = { key: 'cell', label: 'Cell size', min: 4, max: 120 }
const SCREEN_ANGLE: FilterParamDef = { key: 'angle', label: 'Screen angle', min: 0, max: 90, format: 'degrees' }
const RISO_INK_PAIR: FilterParamDef = {
  key: 'inks',
  label: 'Inks',
  min: 0,
  max: RISO_INKS.length - 1,
  labels: RISO_INKS.map((pair) => pair.name),
}
const RISO_OFFSET: FilterParamDef = { key: 'offset', label: 'Misregister', min: 0, max: 120 }
const RISO_GRAIN: FilterParamDef = { key: 'grain', label: 'Grain', min: 0, max: 100, format: 'percent' }
const DUOTONE_PALETTE: FilterParamDef = {
  key: 'palette',
  label: 'Palette',
  min: 0,
  max: DUOTONE_PALETTES.length - 1,
  labels: DUOTONE_PALETTES.map((palette) => palette.name),
}
const TONE_CONTRAST: FilterParamDef = { key: 'contrast', label: 'Contrast', min: 0, max: 100, format: 'percent' }
const DITHER_SCALE: FilterParamDef = { key: 'scale', label: 'Scale', min: 1, max: 32 }
const DITHER_THRESHOLD: FilterParamDef = { key: 'threshold', label: 'Threshold', min: 0, max: 100, format: 'percent' }
const SPLIT_DISTANCE: FilterParamDef = { key: 'distance', label: 'Distance', min: 0, max: 120 }
const SCAN_SPACING: FilterParamDef = { key: 'spacing', label: 'Spacing', min: 4, max: 96 }
const SCAN_DARKNESS: FilterParamDef = { key: 'darkness', label: 'Darkness', min: 0, max: 100, format: 'percent' }
const SCAN_JITTER: FilterParamDef = { key: 'jitter', label: 'Jitter', min: 0, max: 100, format: 'percent' }

function fx(
  id: string,
  name: string,
  category: FilterCategory,
  fxKind: FxKind,
  defaultParams: Record<string, number>,
  paramDefs: FilterParamDef[],
  description: string,
): FilterPreset {
  return {
    id,
    name,
    category,
    treatmentType: 'fx',
    fxKind,
    defaultParams,
    paramDefs,
    description,
    scope: 'selection',
  }
}

const PIXEL_PRESETS: FilterPreset[] = [
  fx(
    'gaussian-soft',
    'Gaussian',
    'blur',
    'gaussian-blur',
    { radius: 18 },
    [RADIUS],
    'Isotropic blur. Radius is relative to the layer, like a live Gaussian Blur.',
  ),
  fx(
    'gaussian-heavy',
    'Heavy gaussian',
    'blur',
    'gaussian-blur',
    { radius: 48 },
    [RADIUS],
    'A stronger gaussian for atmosphere and defocus.',
  ),
  fx(
    'motion-blur',
    'Motion blur',
    'blur',
    'motion-blur',
    { distance: 36, angle: 0 },
    [DISTANCE, ANGLE],
    'Directional streak blur. Angle 0° is horizontal; 90° streaks downward.',
  ),
  fx(
    'motion-blur-diagonal',
    'Diagonal motion',
    'blur',
    'motion-blur',
    { distance: 48, angle: 35 },
    [DISTANCE, ANGLE],
    'Motion blur preset at 35°, useful for fast type and smear.',
  ),
  fx(
    'radial-blur',
    'Radial blur',
    'blur',
    'radial-blur',
    { amount: 42, centerX: 50, centerY: 50 },
    [AMOUNT, CENTER_X, CENTER_Y],
    'Spin blur around a center point, like Photoshop Radial Blur → Spin.',
  ),
  fx(
    'zoom-blur',
    'Zoom blur',
    'blur',
    'zoom-blur',
    { amount: 42, centerX: 50, centerY: 50 },
    [AMOUNT, CENTER_X, CENTER_Y],
    'Radial zoom from a center point, like Photoshop Radial Blur → Zoom.',
  ),
  fx('sharpen', 'Sharpen', 'sharpen', 'sharpen', { amount: 45 }, [AMOUNT], 'Unsharp-style convolution. Stackable.'),
  fx(
    'unsharp',
    'Unsharp mask',
    'sharpen',
    'unsharp',
    { amount: 70 },
    [AMOUNT],
    'Stronger sharpen plus a touch of contrast.',
  ),
  fx('emboss', 'Emboss', 'stylize', 'emboss', { amount: 60 }, [AMOUNT], 'Relief / stamp edge, like Filter → Stylize → Emboss.'),
  fx('find-edges', 'Find edges', 'stylize', 'find-edges', {}, [], 'Sobel-style edge detect.'),
  fx('glowing-edges', 'Glowing edges', 'stylize', 'glowing-edges', {}, [], 'Inverted edges with contrast — neon outline.'),
  fx('posterize', 'Posterize', 'stylize', 'posterize', { levels: 4 }, [LEVELS], 'Collapse tones into flat ink levels.'),
  fx('pixelate', 'Mosaic', 'stylize', 'pixelate', { blocksize: 10 }, [BLOCK], 'Block mosaic / pixelate.'),
  fx(
    'watercolor',
    'Wash paint',
    'stylize',
    'watercolor',
    { amount: 45 },
    [AMOUNT],
    'Soft blur, punchy color, posterized washes.',
  ),
  fx('brightness', 'Brightness', 'color', 'brightness', { amount: 12 }, [SIGNED], 'Lift or drop luminance.'),
  fx('contrast', 'Contrast', 'color', 'contrast', { amount: 18 }, [SIGNED], 'Expand or compress tonal range.'),
  fx('saturation', 'Saturation', 'color', 'saturation', { amount: 20 }, [SIGNED], 'Push or drain chroma.'),
  fx('vibrance', 'Vibrance', 'color', 'vibrance', { amount: 24 }, [SIGNED], 'Saturate muted colors first.'),
  fx('hue', 'Hue shift', 'color', 'hue', { angle: 30 }, [HUE], 'Rotate hue around the wheel.'),
  fx('invert', 'Invert', 'color', 'invert', {}, [], 'Negative / reverse film.'),
  fx(
    'threshold',
    'Threshold',
    'color',
    'threshold',
    { level: 50 },
    [THRESHOLD_LEVEL],
    'Hard black-and-white cut. Raise the level to drop more into black.',
  ),
  fx('grayscale', 'Grayscale', 'color', 'grayscale', {}, [], 'Strip color.'),
  fx('sepia', 'Sepia', 'film', 'sepia', {}, [], 'Classic warm print matrix.'),
  fx('vintage', 'Vintage', 'film', 'vintage', {}, [], 'Faded analog color matrix.'),
  fx('kodachrome', 'Kodachrome', 'film', 'kodachrome', {}, [], 'Saturated slide-film look.'),
  fx('polaroid', 'Polaroid', 'film', 'polaroid', {}, [], 'Instant-print color matrix.'),
  fx('technicolor', 'Technicolor', 'film', 'technicolor', {}, [], 'Three-strip process punch.'),
  fx('brownie', 'Brownie', 'film', 'brownie', {}, [], 'Warm box-camera cast.'),
  fx('grain', 'Grain', 'film', 'grain', { amount: 40 }, [AMOUNT], 'Photographic noise overlay.'),
  fx(
    'duotone-navy',
    'Navy duotone',
    'film',
    'duotone',
    { palette: 1, contrast: 30 },
    [DUOTONE_PALETTE, TONE_CONTRAST],
    'Two-ink print: shadows in one ink, highlights in another.',
  ),
  fx(
    'duotone-red',
    'Red duotone',
    'film',
    'duotone',
    { palette: 2, contrast: 45 },
    [DUOTONE_PALETTE, TONE_CONTRAST],
    'Protest-flyer red over paper, with the mids pushed apart.',
  ),
]

const CARSON_PRESETS: FilterPreset[] = [
  {
    id: 'xerox-light',
    name: 'Light copy',
    category: 'print',
    treatmentType: 'xerox',
    defaultParams: { generation: 2 },
    paramDefs: [{ key: 'generation', label: 'Generation', min: 1, max: 10 }],
    description: 'First-generation photocopy: mild grit and fade.',
    scope: 'selection',
  },
  {
    id: 'xerox-office',
    name: 'Office copy',
    category: 'print',
    treatmentType: 'xerox',
    defaultParams: { generation: 5 },
    paramDefs: [{ key: 'generation', label: 'Generation', min: 1, max: 10 }],
    description: 'Office copier generation — the default xerox look.',
    scope: 'selection',
  },
  {
    id: 'xerox-degraded',
    name: 'Degraded',
    category: 'print',
    treatmentType: 'xerox',
    defaultParams: { generation: 8 },
    paramDefs: [{ key: 'generation', label: 'Generation', min: 1, max: 10 }],
    description: 'Later-generation copy: crushed blacks and noise.',
    scope: 'selection',
  },
  {
    id: 'xerox-ruined',
    name: 'Ruined',
    category: 'print',
    treatmentType: 'xerox',
    defaultParams: { generation: 10 },
    paramDefs: [{ key: 'generation', label: 'Generation', min: 1, max: 10 }],
    description: 'Nth-generation ruin.',
    scope: 'selection',
  },
  // A pixel filter, listed after the photocopy generations so Print still opens on Light copy.
  fx(
    'halftone',
    'Newsprint',
    'print',
    'halftone',
    { blocksize: 6 },
    [BLOCK],
    'Harsh photocopy halftone: gray, mosaic, threshold.',
  ),
  fx(
    'halftone-dots',
    'Halftone dots',
    'print',
    'halftone-dots',
    { cell: 28, angle: 45, contrast: 25 },
    [DOT_CELL, SCREEN_ANGLE, TONE_CONTRAST],
    'Round AM dots on a rotated screen. Black ink on paper.',
  ),
  fx(
    'halftone-coarse',
    'Coarse screen',
    'print',
    'halftone-dots',
    { cell: 64, angle: 15, contrast: 45 },
    [DOT_CELL, SCREEN_ANGLE, TONE_CONTRAST],
    'A newspaper photo blown up past the point of sense.',
  ),
  fx(
    'risograph',
    'Riso',
    'print',
    'risograph',
    { inks: 0, offset: 20, grain: 35 },
    [RISO_INK_PAIR, RISO_OFFSET, RISO_GRAIN],
    'Two-drum riso: fluoro pink over blue, a little off register.',
  ),
  fx(
    'riso-black-red',
    'Riso black + red',
    'print',
    'risograph',
    { inks: 1, offset: 40, grain: 55 },
    [RISO_INK_PAIR, RISO_OFFSET, RISO_GRAIN],
    'Black and red drums, badly registered, ink running thin.',
  ),
  fx(
    'dither',
    'Bayer dither',
    'print',
    'dither',
    { scale: 8, threshold: 50 },
    [DITHER_SCALE, DITHER_THRESHOLD],
    '1-bit ordered dither, like an early desktop screen grab.',
  ),
  fx(
    'dither-chunky',
    'Chunky dither',
    'print',
    'dither',
    { scale: 18, threshold: 55 },
    [DITHER_SCALE, DITHER_THRESHOLD],
    'Big 1-bit cells: bitmap type off a fax.',
  ),
  {
    id: 'decay-fresh',
    name: 'Fresh wear',
    category: 'decay',
    treatmentType: 'decay',
    defaultParams: { amount: 25 },
    paramDefs: [{ key: 'amount', label: 'Amount', min: 0, max: 100 }],
    scope: 'selection',
  },
  {
    id: 'decay-aged',
    name: 'Aged',
    category: 'decay',
    treatmentType: 'decay',
    defaultParams: { amount: 55 },
    paramDefs: [{ key: 'amount', label: 'Amount', min: 0, max: 100 }],
    scope: 'selection',
  },
  {
    id: 'decay-crumbling',
    name: 'Crumbling',
    category: 'decay',
    treatmentType: 'decay',
    defaultParams: { amount: 85 },
    paramDefs: [{ key: 'amount', label: 'Amount', min: 0, max: 100 }],
    scope: 'selection',
  },
  {
    id: 'distress-light',
    name: 'Light grit',
    category: 'distress',
    treatmentType: 'distress',
    defaultParams: { intensity: 35 },
    paramDefs: [{ key: 'intensity', label: 'Intensity', min: 0, max: 100 }],
    scope: 'selection',
  },
  {
    id: 'distress-heavy',
    name: 'Heavy grit',
    category: 'distress',
    treatmentType: 'distress',
    defaultParams: { intensity: 80 },
    paramDefs: [{ key: 'intensity', label: 'Intensity', min: 0, max: 100 }],
    scope: 'selection',
  },
  fx(
    'rgb-split',
    'RGB split',
    'distress',
    'rgb-split',
    { distance: 16, angle: 0 },
    [SPLIT_DISTANCE, ANGLE],
    'Red and blue plates slip apart: chromatic aberration.',
  ),
  fx(
    'rgb-split-drift',
    'Channel drift',
    'distress',
    'rgb-split',
    { distance: 40, angle: 60 },
    [SPLIT_DISTANCE, ANGLE],
    'A wide, diagonal split, like a scan that moved mid-pass.',
  ),
  fx(
    'scan-lines',
    'Scan lines',
    'distress',
    'scan-lines',
    { spacing: 24, darkness: 55, jitter: 20 },
    [SCAN_SPACING, SCAN_DARKNESS, SCAN_JITTER],
    'Copier banding: dark lines over paper, gaps through ink.',
  ),
  fx(
    'scan-lines-torn',
    'Torn scan',
    'distress',
    'scan-lines',
    { spacing: 40, darkness: 70, jitter: 75 },
    [SCAN_SPACING, SCAN_DARKNESS, SCAN_JITTER],
    'Heavy bands and rows that slip sideways, like a misfed sheet.',
  ),
  {
    id: 'scatter-drift',
    name: 'Drift',
    category: 'transform',
    treatmentType: 'scatter',
    defaultParams: { distance: 20, rotation: 8, scale: 6 },
    paramDefs: [
      { key: 'distance', label: 'Distance', min: 0, max: 120 },
      { key: 'rotation', label: 'Rotation', min: 0, max: 60 },
      { key: 'scale', label: 'Scale drift', min: 1, max: 40 },
    ],
    scope: 'selection',
  },
  {
    id: 'scatter-medium',
    name: 'Scatter',
    category: 'transform',
    treatmentType: 'scatter',
    defaultParams: { distance: 46, rotation: 18, scale: 14 },
    paramDefs: [
      { key: 'distance', label: 'Distance', min: 0, max: 120 },
      { key: 'rotation', label: 'Rotation', min: 0, max: 60 },
      { key: 'scale', label: 'Scale drift', min: 1, max: 40 },
    ],
    scope: 'selection',
  },
  {
    id: 'scatter-explode',
    name: 'Explode',
    category: 'transform',
    treatmentType: 'scatter',
    defaultParams: { distance: 80, rotation: 35, scale: 28 },
    paramDefs: [
      { key: 'distance', label: 'Distance', min: 0, max: 120 },
      { key: 'rotation', label: 'Rotation', min: 0, max: 60 },
      { key: 'scale', label: 'Scale drift', min: 1, max: 40 },
    ],
    scope: 'selection',
  },
  {
    id: 'cold-wash',
    name: 'Cold wash',
    category: 'wash',
    treatmentType: 'cold-wash',
    defaultParams: {},
    paramDefs: [],
    description: 'Blue-gray tint and grit. Image layers only.',
    scope: 'image',
  },
]

export const FILTER_PRESETS: FilterPreset[] = [...PIXEL_PRESETS, ...CARSON_PRESETS]

export function presetsForCategory(category: FilterCategory): FilterPreset[] {
  return FILTER_PRESETS.filter((preset) => preset.category === category)
}

export function presetById(id: string): FilterPreset | undefined {
  return FILTER_PRESETS.find((preset) => preset.id === id)
}

export function isPresetApplicable(preset: FilterPreset, selectedIsImage: boolean): boolean {
  if (preset.scope === 'image') return selectedIsImage
  return true
}

export function mergePresetParams(preset: FilterPreset, overrides: Record<string, number>): Record<string, number> {
  return { ...preset.defaultParams, ...overrides }
}

export function paramsForTreatment(preset: FilterPreset, params: Record<string, number>): Record<string, number> {
  const merged = mergePresetParams(preset, params)
  if (preset.treatmentType !== 'scatter') return merged
  return {
    ...merged,
    scale: (merged.scale ?? 14) / 100,
  }
}

export function paramDefsForFx(fxKind: string | undefined): FilterParamDef[] {
  if (!isFxKind(fxKind)) return []
  const preset = FILTER_PRESETS.find((item) => item.fxKind === fxKind)
  return preset?.paramDefs ?? []
}

export function defaultsForFx(fxKind: string | undefined): Record<string, number> {
  if (!isFxKind(fxKind)) return {}
  const preset = FILTER_PRESETS.find((item) => item.fxKind === fxKind)
  return preset?.defaultParams ?? {}
}

export function formatFilterParam(param: FilterParamDef, value: number): string {
  const rounded = Math.round(value)
  if (param.labels) return param.labels[Math.min(param.labels.length - 1, Math.max(0, rounded))] ?? String(rounded)
  if (param.format === 'degrees') return `${rounded}°`
  if (param.format === 'percent') return `${rounded}%`
  return String(rounded)
}

export { fxChipLabel as fxTreatmentLabel } from './pixelFilters'
