/**
 * Treatment catalog — every move the treatment browser offers, in one table.
 *
 * The browser draws its tiles from it, the command palette lists it, and the sample renderer
 * (scripts/render-treatment-samples.mjs) photographs each entry on the same poster so the tiles
 * show what a treatment does before anyone clicks it. App binds each id to the function that runs it.
 */

import type { ShortcutId } from './shortcuts'

export type CatalogCategory = 'layout' | 'energy' | 'type' | 'print' | 'decay' | 'accident' | 'press' | 'texture' | 'crop' | 'galleries'

/** A category's shared setting, shown under its header (Generation for Print, Amount for Decay…). */
export type CatalogSetting = 'typeLegibility' | 'typeIntensity' | 'xeroxGeneration' | 'decayAmount' | 'accidentIntensity'

export const CATALOG_CATEGORIES: readonly { id: CatalogCategory; label: string; settings?: readonly CatalogSetting[] }[] = [
  { id: 'layout', label: 'Layout' },
  { id: 'type', label: 'Type', settings: ['typeLegibility', 'typeIntensity'] },
  { id: 'print', label: 'Print', settings: ['xeroxGeneration'] },
  { id: 'decay', label: 'Decay', settings: ['decayAmount'] },
  { id: 'accident', label: 'Accident', settings: ['accidentIntensity'] },
  { id: 'crop', label: 'Crop' },
  { id: 'texture', label: 'Texture' },
  { id: 'press', label: 'Press' },
  { id: 'energy', label: 'Poster energy' },
  { id: 'galleries', label: 'Galleries' },
]

/** What has to be selected before a treatment can run. */
export type CatalogNeeds = 'selection' | 'text' | 'image' | 'layers' | 'nothing'

/** Which layer the sample renderer photographs: the headline, a placed photo, or the whole poster. 'none' shows an icon. */
export type SampleTarget = 'headline' | 'cluster' | 'image' | 'poster' | 'none'

export type CatalogEntry = {
  id: string
  name: string
  category: CatalogCategory
  /** 'selection' changes the selected layers; 'poster' changes the whole poster. */
  scope: 'selection' | 'poster'
  needs: CatalogNeeds
  description: string
  keywords: readonly string[]
  /** 'toggle' turns a poster-wide look on and off; 'gallery' opens a gallery with its own Apply. */
  kind?: 'apply' | 'toggle' | 'gallery'
  sample: SampleTarget
  /** 'detail' photographs a close-up of the layer, for treatments that change texture rather than layout. */
  sampleFrame?: 'detail'
  shortcut?: ShortcutId
  /** Onboarding tour anchor. */
  tour?: 'scatter' | 'xerox'
}

export const TREATMENT_CATALOG = [
  // Layout
  {
    id: 'scramble',
    name: 'Scramble',
    category: 'layout',
    scope: 'poster',
    needs: 'layers',
    description: 'Rearrange every layer into a new structure',
    keywords: ['shuffle', 'rearrange', 'structure', 'layout', 'riff'],
    sample: 'poster',
    shortcut: 'scramble',
  },
  {
    id: 'scatter',
    name: 'Scatter',
    category: 'layout',
    scope: 'selection',
    needs: 'selection',
    description: 'Throw the selected layers off their grid',
    keywords: ['chaos', 'drift', 'jitter'],
    sample: 'cluster',
    tour: 'scatter',
  },
  {
    id: 'strips',
    name: 'Strips',
    category: 'layout',
    scope: 'selection',
    needs: 'selection',
    description: 'Slice into horizontal strips',
    keywords: ['slice', 'horizontal', 'bands', 'cut'],
    sample: 'headline',
  },
  {
    id: 'columns',
    name: 'Columns',
    category: 'layout',
    scope: 'selection',
    needs: 'selection',
    description: 'Slice into vertical columns',
    keywords: ['slice', 'vertical', 'cut'],
    sample: 'headline',
  },

  // Type
  {
    id: 'type-strip',
    name: 'Type strip',
    category: 'type',
    scope: 'selection',
    needs: 'text',
    description: 'Repeat the selected text as printed strips',
    keywords: ['repeat', 'print', 'stripe'],
    sample: 'headline',
  },
  {
    id: 'break-letters',
    name: 'Break letters',
    category: 'type',
    scope: 'selection',
    needs: 'text',
    description: 'Break the selected text into loose letters',
    keywords: ['letters', 'loose', 'glyphs', 'split'],
    sample: 'headline',
  },
  {
    id: 'letter-break',
    name: 'Letter break',
    category: 'type',
    scope: 'selection',
    needs: 'text',
    description: 'Cut each letter into its strokes and pull them apart',
    keywords: ['strokes', 'glyph', 'cut', 'pull apart'],
    sample: 'headline',
  },
  {
    id: 'bury-type',
    name: 'Bury type',
    category: 'type',
    scope: 'selection',
    needs: 'text',
    description: 'Bury a ghost copy of the selected text',
    keywords: ['ghost', 'texture', 'clone', 'echo'],
    sample: 'headline',
  },
  {
    id: 'red-echo',
    name: 'Red echo type',
    category: 'type',
    scope: 'poster',
    needs: 'nothing',
    description: 'Stamp three large red echo words across the poster',
    keywords: ['red', 'stamp', 'echo', 'words'],
    sample: 'poster',
  },

  // Print
  {
    id: 'copy-machine',
    name: 'Copy machine',
    category: 'print',
    scope: 'selection',
    needs: 'selection',
    description: 'Photocopy warp; the source stays editable',
    keywords: ['photocopy', 'xerox warp', 'copier', 'toner'],
    sample: 'headline',
    sampleFrame: 'detail',
  },
  {
    id: 'ink-bleed',
    name: 'Ink bleed',
    category: 'print',
    scope: 'selection',
    needs: 'selection',
    description: 'Uneven ink: lines flood into blobs, starve to fragments, slur along the feed',
    keywords: ['ink spread', 'flood', 'starve', 'blot', 'slur', 'smear', 'over-inked', 'stamp', 'copier'],
    sample: 'headline',
    sampleFrame: 'detail',
  },
  {
    id: 'xerox',
    name: 'Copy selected',
    category: 'print',
    scope: 'selection',
    needs: 'selection',
    description: 'Re-photocopy the selected layer; text becomes an image',
    keywords: ['xerox', 'photocopy', 'print', 'copy'],
    sample: 'headline',
    sampleFrame: 'detail',
    tour: 'xerox',
  },
  {
    id: 'misprint',
    name: 'Misprint offset',
    category: 'print',
    scope: 'selection',
    needs: 'selection',
    description: 'Add a faint misregistered print echo',
    keywords: ['offset', 'ghost', 'print', 'echo', 'registration'],
    sample: 'headline',
    sampleFrame: 'detail',
  },
  {
    id: 'copy-scatter-copy',
    name: 'Copy → Scatter → Copy',
    category: 'print',
    scope: 'selection',
    needs: 'selection',
    description: 'Copy Machine, then Scatter, then Copy Machine',
    keywords: ['gesture', 'copy machine', 'scatter', 'macro', 'chain'],
    sample: 'headline',
  },
  {
    id: 'run-through-copier',
    name: 'Run through copier',
    category: 'print',
    scope: 'poster',
    needs: 'layers',
    description: 'Run every visible layer through the copier',
    keywords: ['copy machine', 'photocopy', 'xerox', 'copier', 'all layers'],
    sample: 'poster',
  },
  {
    id: 'surface-wear',
    name: 'Surface wear',
    category: 'print',
    scope: 'poster',
    needs: 'nothing',
    description: 'Add photocopier bands across the poster',
    keywords: ['bands', 'scan', 'copier', 'streaks'],
    sample: 'poster',
  },
  {
    id: 'photocopy-noise',
    name: 'Photocopy noise',
    category: 'print',
    scope: 'poster',
    needs: 'nothing',
    description: 'Sprinkle photocopier specks across the poster',
    keywords: ['specks', 'grain', 'dust', 'copier'],
    sample: 'poster',
  },
  {
    id: 'crop-marks',
    name: 'Crop marks',
    category: 'print',
    scope: 'poster',
    needs: 'nothing',
    description: 'Stamp decorative crop marks and a grid onto the artwork',
    keywords: ['registration', 'grid', 'trim', 'marks', 'printer'],
    sample: 'poster',
  },

  // Decay
  {
    id: 'age',
    name: 'Age',
    category: 'decay',
    scope: 'selection',
    needs: 'selection',
    description: 'Age the selected layer; text becomes an image',
    keywords: ['decay', 'old', 'wear', 'yellow'],
    sample: 'headline',
    sampleFrame: 'detail',
  },
  {
    id: 'distress',
    name: 'Distress',
    category: 'decay',
    scope: 'selection',
    needs: 'selection',
    description: 'Turn the selected layer into harsh grit; text becomes an image',
    keywords: ['grunge', 'grit', 'rough'],
    sample: 'headline',
    sampleFrame: 'detail',
  },
  {
    id: 'ink-loss',
    name: 'Ink loss',
    category: 'decay',
    scope: 'selection',
    needs: 'selection',
    description: 'Chip ink away from the selected layer',
    keywords: ['decay', 'ink', 'chip', 'wear'],
    sample: 'headline',
    sampleFrame: 'detail',
  },
  {
    id: 'fold-marks',
    name: 'Fold marks',
    category: 'decay',
    scope: 'selection',
    needs: 'selection',
    description: 'Add fold creases',
    keywords: ['decay', 'fold', 'crease', 'wear'],
    sample: 'headline',
    sampleFrame: 'detail',
  },
  {
    id: 'wear-overlay',
    name: 'Wear overlay',
    category: 'decay',
    scope: 'selection',
    needs: 'selection',
    description: 'Add the full wear treatment: ink loss and folds together',
    keywords: ['decay', 'wear', 'all'],
    sample: 'headline',
    sampleFrame: 'detail',
  },
  {
    id: 'decay-offset',
    name: 'Decay offset',
    category: 'decay',
    scope: 'selection',
    needs: 'selection',
    description: 'Add a faint decayed echo',
    keywords: ['echo', 'ghost', 'offset'],
    sample: 'headline',
    sampleFrame: 'detail',
  },

  // Accident
  {
    id: 'duplicate-drift',
    name: 'Duplicate drift',
    category: 'accident',
    scope: 'selection',
    needs: 'selection',
    description: 'Clone the selection with accidental drift',
    keywords: ['clone', 'copy', 'drift', 'double'],
    sample: 'headline',
  },
  {
    id: 'bad-crop',
    name: 'Bad crop',
    category: 'accident',
    scope: 'selection',
    needs: 'selection',
    description: 'Crop badly on purpose',
    keywords: ['crop', 'mistake', 'cut off'],
    sample: 'headline',
  },
  {
    id: 'flip-mistake',
    name: 'Flip mistake',
    category: 'accident',
    scope: 'selection',
    needs: 'selection',
    description: 'Add a flipped ghost',
    keywords: ['mirror', 'flip', 'ghost', 'reverse'],
    sample: 'headline',
  },
  {
    id: 'collide',
    name: 'Collide selection',
    category: 'accident',
    scope: 'selection',
    needs: 'selection',
    description: 'Pile the selected layers into a collision',
    keywords: ['pile', 'overlap', 'crash', 'stack'],
    sample: 'cluster',
  },
  {
    id: 'nudge-layout',
    name: 'Nudge layout',
    category: 'accident',
    scope: 'poster',
    needs: 'layers',
    description: 'Nudge every layer with accidental drift',
    keywords: ['drift', 'accident', 'shift'],
    sample: 'poster',
  },
  {
    id: 'tear-collage',
    name: 'Tear collage',
    category: 'accident',
    scope: 'selection',
    needs: 'selection',
    description: 'Tear into shifted scraps',
    keywords: ['tear', 'rip', 'scraps', 'paper'],
    sample: 'headline',
  },

  // Crop
  {
    id: 'close-crop',
    name: 'Close crop',
    category: 'crop',
    scope: 'selection',
    needs: 'selection',
    description: 'Crop tight into the center',
    keywords: ['tight', 'zoom', 'crop'],
    sample: 'headline',
  },
  {
    id: 'off-center-crop',
    name: 'Off-center crop',
    category: 'crop',
    scope: 'selection',
    needs: 'selection',
    description: 'Crop off-center',
    keywords: ['crop', 'asymmetric'],
    sample: 'headline',
  },
  {
    id: 'edge-crop',
    name: 'Edge crop',
    category: 'crop',
    scope: 'selection',
    needs: 'selection',
    description: 'Crop hard to one edge',
    keywords: ['crop', 'edge', 'bleed'],
    sample: 'headline',
  },
  {
    id: 'throw-to-edge',
    name: 'Throw to edge',
    category: 'crop',
    scope: 'selection',
    needs: 'selection',
    description: 'Throw the fragment to the poster border',
    keywords: ['edge', 'border', 'bleed', 'move'],
    sample: 'headline',
  },

  // Texture
  {
    id: 'cold-wash',
    name: 'Cold wash',
    category: 'texture',
    scope: 'selection',
    needs: 'image',
    description: 'Wash the selected image in cold print blue',
    keywords: ['wash', 'blue', 'cyan', 'photo', 'image'],
    sample: 'image',
    sampleFrame: 'detail',
  },
  {
    id: 'diagonal-texture',
    name: 'Diagonal texture',
    category: 'texture',
    scope: 'poster',
    needs: 'nothing',
    description: 'Lay diagonal print texture lines',
    keywords: ['lines', 'hatch', 'stripes'],
    sample: 'poster',
  },
  {
    id: 'white-scrapes',
    name: 'White scrapes',
    category: 'texture',
    scope: 'poster',
    needs: 'nothing',
    description: 'Scrape white bands across the poster',
    keywords: ['scrape', 'bands', 'white', 'erase'],
    sample: 'poster',
  },

  // Press
  {
    id: 'press-check',
    name: 'Press Check',
    category: 'press',
    scope: 'poster',
    needs: 'nothing',
    kind: 'toggle',
    description: 'Keep ink spread, misregistration and paper tooth as the print look',
    keywords: ['print', 'ink spread', 'misregistration', 'paper tooth', 'press'],
    sample: 'poster',
  },

  // Poster energy
  {
    id: 'magazine-chaos',
    name: 'Magazine chaos',
    category: 'energy',
    scope: 'poster',
    needs: 'layers',
    description: 'Shift every layer into colliding blend chaos',
    keywords: ['blend', 'collide', 'magazine', 'style'],
    sample: 'poster',
  },
  {
    id: 'oversized-type',
    name: 'Oversized type',
    category: 'energy',
    scope: 'poster',
    needs: 'layers',
    description: 'Rotate the layout toward oversized type',
    keywords: ['big', 'type', 'headline', 'style'],
    sample: 'poster',
  },
  {
    id: 'image-fracture',
    name: 'Image fracture',
    category: 'energy',
    scope: 'poster',
    needs: 'layers',
    description: 'Fracture the layout around imagery',
    keywords: ['image', 'fracture', 'split', 'style'],
    sample: 'poster',
  },
  {
    id: 'bw-red',
    name: 'B/W red',
    category: 'energy',
    scope: 'poster',
    needs: 'layers',
    description: 'Reset to black, white and red minimalism',
    keywords: ['black', 'white', 'red', 'minimal', 'reset', 'style'],
    sample: 'poster',
  },

  // Galleries
  {
    id: 'filter-gallery',
    name: 'Filter gallery',
    category: 'galleries',
    scope: 'selection',
    needs: 'selection',
    kind: 'gallery',
    description: 'Blur, stylize, color and Carson print filters with live preview',
    keywords: ['filter', 'effects', 'blur', 'motion', 'gaussian', 'stylize', 'photoshop'],
    sample: 'none',
    shortcut: 'filterGallery',
  },
  {
    id: 'texture-gallery',
    name: 'Texture gallery',
    category: 'galleries',
    scope: 'poster',
    needs: 'nothing',
    kind: 'gallery',
    description: 'Print, ink, paper and grit textures',
    keywords: ['texture', 'grunge', 'paper', 'ink', 'overlay'],
    sample: 'none',
  },
] as const satisfies readonly CatalogEntry[]

export type CatalogId = (typeof TREATMENT_CATALOG)[number]['id']

const BY_ID = new Map<string, CatalogEntry>(TREATMENT_CATALOG.map((entry) => [entry.id, entry]))

export function getCatalogEntry(id: CatalogId): CatalogEntry {
  const entry = BY_ID.get(id)
  if (!entry) throw new Error(`Unknown treatment: ${id}`)
  return entry
}

export function isCatalogId(value: string): value is CatalogId {
  return BY_ID.has(value)
}

/** Where the rendered sample for an entry lives, relative to the app root. */
export function catalogSamplePath(id: CatalogId) {
  return `treatment-samples/${id}.webp`
}

const CATEGORY_LABEL = new Map(CATALOG_CATEGORIES.map((category) => [category.id, category.label]))

/** Every query word must appear somewhere in the entry's name, category, description or keywords. */
export function matchesCatalogQuery(entry: Pick<CatalogEntry, 'name' | 'category' | 'description' | 'keywords'>, query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = [entry.name, CATEGORY_LABEL.get(entry.category) ?? '', entry.description, ...entry.keywords].join(' ').toLowerCase()
  return words.every((word) => haystack.includes(word))
}

export function searchCatalog(query: string, entries: readonly CatalogEntry[] = TREATMENT_CATALOG): CatalogEntry[] {
  return entries.filter((entry) => matchesCatalogQuery(entry, query))
}

export type CatalogContext = {
  hasSelection: boolean
  selectionIsText: boolean
  selectionIsImage: boolean
  layerCount: number
}

/** Whether an entry can run right now, and if not, what the person should do first. */
export function catalogAvailability(entry: Pick<CatalogEntry, 'needs'>, context: CatalogContext): { enabled: boolean; reason?: string } {
  switch (entry.needs) {
    case 'selection':
      return context.hasSelection ? { enabled: true } : { enabled: false, reason: 'Select a layer first' }
    case 'text':
      return context.selectionIsText ? { enabled: true } : { enabled: false, reason: 'Select a text layer first' }
    case 'image':
      return context.selectionIsImage ? { enabled: true } : { enabled: false, reason: 'Select an image first' }
    case 'layers':
      return context.layerCount > 0 ? { enabled: true } : { enabled: false, reason: 'Add a layer first' }
    default:
      return { enabled: true }
  }
}
