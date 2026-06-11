/**
 * Typography loading — Google Fonts + user uploads (Horizon 2.2).
 */

export type GoogleFont = {
  family: string
  category: string
  weights: number[]
}

export const GOOGLE_FONTS: GoogleFont[] = [
  { family: 'Bebas Neue', category: 'display', weights: [400] },
  { family: 'Oswald', category: 'display', weights: [400, 700] },
  { family: 'Anton', category: 'display', weights: [400] },
  { family: 'Archivo Black', category: 'display', weights: [400] },
  { family: 'Space Grotesk', category: 'sans', weights: [400, 700] },
  { family: 'DM Sans', category: 'sans', weights: [400, 700] },
  { family: 'Playfair Display', category: 'serif', weights: [400, 700] },
  { family: 'Libre Baskerville', category: 'serif', weights: [400, 700] },
  { family: 'IBM Plex Mono', category: 'mono', weights: [400, 700] },
  { family: 'Rubik Mono One', category: 'display', weights: [400] },
]

const loadedFamilies = new Set<string>()

export function buildGoogleFontsUrl(families: string[]) {
  const query = families
    .map((family) => {
      const spec = GOOGLE_FONTS.find((item) => item.family === family)
      const weights = spec?.weights.join(';') ?? '400'
      return `family=${encodeURIComponent(family)}:wght@${weights}`
    })
    .join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}

export async function loadGoogleFont(family: string): Promise<void> {
  if (loadedFamilies.has(family)) return
  const linkId = `carson-font-${family.replace(/\s+/g, '-').toLowerCase()}`
  if (document.getElementById(linkId)) {
    loadedFamilies.add(family)
    return
  }
  await new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.id = linkId
    link.rel = 'stylesheet'
    link.href = buildGoogleFontsUrl([family])
    link.onload = () => {
      loadedFamilies.add(family)
      resolve()
    }
    link.onerror = () => reject(new Error(`Failed to load font: ${family}`))
    document.head.appendChild(link)
  })
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
  const google = GOOGLE_FONTS.map((item) => item.family)
  return [...new Set([...systemFonts, ...google, ...customFonts])]
}
