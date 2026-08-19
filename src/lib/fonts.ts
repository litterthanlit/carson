/**
 * Typography loading — self-hosted print library, Studio OS Google Fonts / Fontshare, and uploads.
 */

export type FontCategory = 'condensed' | 'display' | 'grotesk' | 'serif' | 'slab' | 'typewriter'
export type FontSource = 'local' | 'google' | 'fontshare'

export type LibraryFont = {
  family: string
  category: FontCategory
  weights: number[]
  source?: FontSource
  slug?: string
}

export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: 'condensed', label: 'Condensed' },
  { id: 'display', label: 'Display' },
  { id: 'grotesk', label: 'Grotesk' },
  { id: 'serif', label: 'Serif' },
  { id: 'slab', label: 'Slab' },
  { id: 'typewriter', label: 'Typewriter' },
]

const google = (family: string, category: FontCategory, weights: number[]): LibraryFont => ({
  family,
  category,
  weights,
  source: 'google',
})

const fontshare = (family: string, category: FontCategory, slug: string, weights: number[]): LibraryFont => ({
  family,
  category,
  weights,
  source: 'fontshare',
  slug,
})

export const FONT_LIBRARY: LibraryFont[] = [
  { family: 'Bebas Neue', category: 'condensed', weights: [400] },
  { family: 'Oswald', category: 'condensed', weights: [400, 700] },
  { family: 'Anton', category: 'condensed', weights: [400] },
  { family: 'Barlow Condensed', category: 'condensed', weights: [400, 700, 800] },
  { family: 'Saira Extra Condensed', category: 'condensed', weights: [400, 700, 800] },
  { family: 'Big Shoulders Display', category: 'condensed', weights: [400, 700, 900] },

  { family: 'Archivo Black', category: 'display', weights: [400] },
  { family: 'Staatliches', category: 'display', weights: [400] },
  { family: 'Syne', category: 'display', weights: [700, 800] },
  { family: 'Anybody', category: 'display', weights: [400, 700, 900] },
  google('Playfair Display', 'display', [400, 700]),
  google('DM Serif Display', 'display', [400]),
  fontshare('Clash Display', 'display', 'clash-display', [400, 500, 700]),
  fontshare('Cabinet Grotesk', 'display', 'cabinet-grotesk', [400, 700, 800]),
  fontshare('Panchang', 'display', 'panchang', [400, 500, 700, 800]),
  fontshare('Plein', 'display', 'plein', [400, 500, 700]),
  fontshare('Bespoke Stencil', 'display', 'bespoke-stencil', [400, 500, 700]),
  fontshare('Tanker', 'display', 'tanker', [400]),
  fontshare('Array', 'display', 'array', [400]),
  fontshare('Stardom', 'display', 'stardom', [400]),

  { family: 'Archivo', category: 'grotesk', weights: [400, 700, 900] },
  { family: 'Barlow', category: 'grotesk', weights: [400, 700, 800] },
  { family: 'Chivo', category: 'grotesk', weights: [400, 700, 900] },
  { family: 'Instrument Sans', category: 'grotesk', weights: [400, 700] },
  google('Inter', 'grotesk', [400, 500, 600, 700]),
  google('Geist', 'grotesk', [400, 500, 600, 700]),
  google('Space Grotesk', 'grotesk', [400, 500, 700]),
  google('DM Sans', 'grotesk', [400, 500, 700]),
  google('Plus Jakarta Sans', 'grotesk', [400, 500, 700]),
  google('Outfit', 'grotesk', [400, 500, 700]),
  google('Sora', 'grotesk', [400, 600, 700]),
  google('Manrope', 'grotesk', [400, 500, 700]),
  google('Roboto', 'grotesk', [400, 500, 700]),
  google('Open Sans', 'grotesk', [400, 600, 700]),
  google('Lato', 'grotesk', [400, 700]),
  google('Montserrat', 'grotesk', [400, 600, 700]),
  google('Poppins', 'grotesk', [400, 600, 700]),
  google('Raleway', 'grotesk', [400, 600, 700]),
  google('Work Sans', 'grotesk', [400, 600, 700]),
  fontshare('Satoshi', 'grotesk', 'satoshi', [400, 500, 700]),
  fontshare('General Sans', 'grotesk', 'general-sans', [400, 500, 700]),
  fontshare('Clash Grotesk', 'grotesk', 'clash-grotesk', [400, 500, 700]),
  fontshare('Switzer', 'grotesk', 'switzer', [400, 500, 700]),
  fontshare('Nippo', 'grotesk', 'nippo', [400, 500, 700]),
  fontshare('Chillax', 'grotesk', 'chillax', [400, 500, 700]),
  fontshare('Synonym', 'grotesk', 'synonym', [400, 500, 700]),
  fontshare('Ranade', 'grotesk', 'ranade', [400, 500, 700]),
  fontshare('Author', 'grotesk', 'author', [400, 500, 700]),
  fontshare('Bespoke Sans', 'grotesk', 'bespoke-sans', [400, 500, 700]),
  fontshare('Alpino', 'grotesk', 'alpino', [400, 500, 700]),
  fontshare('Supreme', 'grotesk', 'supreme', [400, 500, 700, 800]),

  { family: 'Instrument Serif', category: 'serif', weights: [400] },
  { family: 'Fraunces', category: 'serif', weights: [400, 700] },
  { family: 'Bodoni Moda', category: 'serif', weights: [400, 700, 900] },
  { family: 'Newsreader', category: 'serif', weights: [400, 700] },
  google('Libre Baskerville', 'serif', [400, 700]),
  google('Lora', 'serif', [400, 700]),
  google('Source Serif 4', 'serif', [400, 600, 700]),
  google('Merriweather', 'serif', [400, 700]),
  google('Crimson Text', 'serif', [400, 600, 700]),
  fontshare('Zodiak', 'serif', 'zodiak', [400, 700]),
  fontshare('Erode', 'serif', 'erode', [400, 500, 700]),
  fontshare('Boska', 'serif', 'boska', [400, 500, 700]),
  fontshare('Gambarino', 'serif', 'gambarino', [400]),
  fontshare('Sentient', 'serif', 'sentient', [400, 700]),
  fontshare('Melodrama', 'serif', 'melodrama', [400, 500, 700]),
  fontshare('Bespoke Serif', 'serif', 'bespoke-serif', [400, 500, 700]),
  fontshare('Bonny', 'serif', 'bonny', [400, 700]),

  { family: 'Zilla Slab', category: 'slab', weights: [400, 700] },
  google('Roboto Slab', 'slab', [400, 700]),

  { family: 'Special Elite', category: 'typewriter', weights: [400] },
  { family: 'IBM Plex Mono', category: 'typewriter', weights: [400, 700] },
  google('JetBrains Mono', 'typewriter', [400, 500, 700]),
  google('Fira Code', 'typewriter', [400, 700]),
  google('Space Mono', 'typewriter', [400, 700]),
  google('Geist Mono', 'typewriter', [400, 500, 700]),
]

/** @deprecated Use FONT_LIBRARY. Kept so older imports keep compiling. */
export const GOOGLE_FONTS = FONT_LIBRARY

const loadedFamilies = new Set<string>()

export function fontSource(font: LibraryFont): FontSource {
  return font.source ?? 'local'
}

export function fontsForCategory(category: FontCategory): LibraryFont[] {
  return FONT_LIBRARY.filter((font) => font.category === category)
}

export function libraryFontByFamily(family: string): LibraryFont | undefined {
  return FONT_LIBRARY.find((font) => font.family === family)
}

export function isLibraryFont(family: string) {
  return Boolean(libraryFontByFamily(family))
}

export function isRemoteFont(family: string) {
  const spec = libraryFontByFamily(family)
  return spec ? fontSource(spec) !== 'local' : false
}

export function buildGoogleFontsUrl(families: string[]) {
  const query = families
    .map((family) => {
      const spec = libraryFontByFamily(family)
      const weights = spec?.weights.join(';') ?? '400'
      return `family=${encodeURIComponent(family)}:wght@${weights}`
    })
    .join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}

function buildFontshareUrl(slug: string, weights: number[]) {
  return `https://api.fontshare.com/v2/css?f[]=${encodeURIComponent(slug)}@${weights.join(',')}&display=swap`
}

function injectStylesheet(href: string): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  const existing = document.querySelector(`link[data-carson-font="${href}"]`)
  if (existing) return Promise.resolve()
  return new Promise((resolve) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href
    link.dataset.carsonFont = href
    link.onload = () => resolve()
    link.onerror = () => resolve()
    document.head.appendChild(link)
  })
}

export async function loadGoogleFont(family: string): Promise<void> {
  const spec = libraryFontByFamily(family)
  if (!spec) return
  const source = fontSource(spec)
  if (loadedFamilies.has(family)) {
    if (typeof document === 'undefined' || !document.fonts) return
    await document.fonts.load(`16px "${family}"`).catch(() => undefined)
    return
  }
  loadedFamilies.add(family)
  if (typeof document === 'undefined') return

  if (source === 'google') {
    await injectStylesheet(buildGoogleFontsUrl([family]))
  } else if (source === 'fontshare' && spec.slug) {
    await injectStylesheet(buildFontshareUrl(spec.slug, spec.weights))
  }

  if (!document.fonts) return
  await document.fonts.load(`16px "${family}"`).catch(() => undefined)
}

export function markLibraryLoaded() {
  for (const font of FONT_LIBRARY) {
    if (fontSource(font) === 'local') loadedFamilies.add(font.family)
  }
}

export function collectFontFamilies(value: unknown, into = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return into
  if (Array.isArray(value)) {
    for (const item of value) collectFontFamilies(item, into)
    return into
  }
  const record = value as Record<string, unknown>
  if (typeof record.fontFamily === 'string' && record.fontFamily) into.add(record.fontFamily)
  for (const nested of Object.values(record)) collectFontFamilies(nested, into)
  return into
}

export async function ensureLibraryFonts(families: Iterable<string>) {
  await Promise.all([...new Set(families)].filter(isLibraryFont).map((family) => loadGoogleFont(family)))
}

export async function loadFontFile(file: File): Promise<string> {
  const family = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')
  const url = URL.createObjectURL(file)
  const face = new FontFace(family, `url(${url})`)
  await face.load()
  document.fonts.add(face)
  loadedFamilies.add(family)
  return family
}

export function allFontFamilies(systemFonts: string[], customFonts: string[]) {
  const library = FONT_LIBRARY.map((item) => item.family)
  return [...new Set([...systemFonts, ...library, ...customFonts])]
}
