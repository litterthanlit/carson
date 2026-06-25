import type { TreatmentType } from './treatments'

export type FilterCategory = 'print' | 'decay' | 'distress' | 'transform' | 'wash'

export type FilterParamDef = {
  key: string
  label: string
  min: number
  max: number
}

export type FilterPreset = {
  id: string
  name: string
  category: FilterCategory
  treatmentType: TreatmentType
  defaultParams: Record<string, number>
  paramDefs: FilterParamDef[]
  scope: 'selection' | 'image'
}

export const FILTER_CATEGORIES: { id: FilterCategory; label: string }[] = [
  { id: 'print', label: 'Print' },
  { id: 'decay', label: 'Decay' },
  { id: 'distress', label: 'Distress' },
  { id: 'transform', label: 'Transform' },
  { id: 'wash', label: 'Wash' },
]

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'xerox-light',
    name: 'Light copy',
    category: 'print',
    treatmentType: 'xerox',
    defaultParams: { generation: 2 },
    paramDefs: [{ key: 'generation', label: 'Generation', min: 1, max: 10 }],
    scope: 'selection',
  },
  {
    id: 'xerox-office',
    name: 'Office copy',
    category: 'print',
    treatmentType: 'xerox',
    defaultParams: { generation: 5 },
    paramDefs: [{ key: 'generation', label: 'Generation', min: 1, max: 10 }],
    scope: 'selection',
  },
  {
    id: 'xerox-degraded',
    name: 'Degraded',
    category: 'print',
    treatmentType: 'xerox',
    defaultParams: { generation: 8 },
    paramDefs: [{ key: 'generation', label: 'Generation', min: 1, max: 10 }],
    scope: 'selection',
  },
  {
    id: 'xerox-ruined',
    name: 'Ruined',
    category: 'print',
    treatmentType: 'xerox',
    defaultParams: { generation: 10 },
    paramDefs: [{ key: 'generation', label: 'Generation', min: 1, max: 10 }],
    scope: 'selection',
  },
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
    scope: 'image',
  },
]

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
