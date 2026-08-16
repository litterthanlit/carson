/**
 * Typography loading — self-hosted print library + user uploads (Horizon 2.2).
 */

export type FontCategory = 'condensed' | 'display' | 'grotesk' | 'serif' | 'slab' | 'typewriter'

export type LibraryFont = {
  family: string
  category: FontCategory
  weights: number[]
}

export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: 'condensed', label: 'Condensed' },
  { id: 'display', label: 'Display' },
  { id: 'grotesk', label: 'Grotesk' },
  { id: 'serif', label: 'Serif' },
  { id: 'slab', label: 'Slab' },
  { id: 'typewriter', label: 'Typewriter' },
]

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
  { family: 'Archivo', category: 'grotesk', weights: [400, 700, 900] },
  { family: 'Barlow', category: 'grotesk', weights: [400, 700, 800] },
  { family: 'Chivo', category: 'grotesk', weights: [400, 700, 900] },
  { family: 'Instrument Sans', category: 'grotesk', weights: [400, 700] },
  { family: 'Instrument Serif', category: 'serif', weights: [400] },
  { family: 'Fraunces', category: 'serif', weights: [400, 700] },
  { family: 'Bodoni Moda', category: 'serif', weights: [400, 700, 900] },
  { family: 'Newsreader', category: 'serif', weights: [400, 700] },
  { family: 'Zilla Slab', category: 'slab', weights: [400, 700] },
  { family: 'Special Elite', category: 'typewriter', weights: [400] },
  { family: 'IBM Plex Mono', category: 'typewriter', weights: [400, 700] },
]

/** @deprecated Use FONT_LIBRARY. Kept so older imports keep compiling. */
export const GOOGLE_FONTS = FONT_LIBRARY

const loadedFamilies = new Set<string>()

export function fontsForCategory(category: FontCategory): LibraryFont[] {
  return FONT_LIBRARY.filter((font) => font.category === category)
}

export function libraryFontByFamily(family: string): LibraryFont | undefined {
  return FONT_LIBRARY.find((font) => font.family === family)
}

export function isLibraryFont(family: string) {
  return Boolean(libraryFontByFamily(family))
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

/** Library faces are self-hosted in /fonts.css. Name kept for existing call sites. */
export async function loadGoogleFont(family: string): Promise<void> {
  if (!isLibraryFont(family) || loadedFamilies.has(family)) return
  loadedFamilies.add(family)
  if (typeof document === 'undefined' || !document.fonts) return
  await document.fonts.load(`16px "${family}"`).catch(() => undefined)
}

export function markLibraryLoaded() {
  for (const font of FONT_LIBRARY) loadedFamilies.add(font.family)
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
