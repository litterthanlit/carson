import { FULL_BLEND_MODES } from './color'

export const HISTORY_PROPS = [
  'id',
  'name',
  'kind',
  'selectable',
  'evented',
  'treatments',
  'transformBaseline',
  'stroke',
  'strokeWidth',
  'strokeDashArray',
  'clipPath',
  'sliceSourceId',
  'sliceTreatmentId',
  'cropSourceId',
  'cropTreatmentId',
  'tearSourceId',
  'tearTreatmentId',
  'badCropSourceId',
  'badCropTreatmentId',
  'glyphSourceId',
  'glyphTreatmentId',
  'scrapeTreatmentId',
  'scrapeFragment',
  'path',
  'originalFill',
] as const

export const FONT_STACKS = [
  'Arial Black',
  'Impact',
  'Helvetica',
  'Arial Narrow',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
]

export const BLEND_MODES = FULL_BLEND_MODES
export const ONBOARDING_KEY = 'carson.onboarding.v1'
export const ACCENTS = ['#05b6d4', '#e11d48', '#a3e635']
export const ZOOM_LEVELS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8]
export const SNAP_SCREEN_THRESHOLD = 6

export const POSTER_PRESET_OPTIONS = [
  { id: 'a3' as const, label: 'A3 portrait' },
  { id: 'a2' as const, label: 'A2 portrait' },
  { id: 'instagram' as const, label: 'Instagram portrait' },
  { id: 'square' as const, label: 'Square' },
  { id: 'custom' as const, label: 'Custom' },
]
