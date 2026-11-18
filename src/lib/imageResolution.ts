/**
 * Effective resolution of a placed image: how many of its own pixels land on
 * each printed inch (print posters), or how far it is blown up past its pixels
 * (screen posters).
 *
 * Pure and free of React and Fabric, so a preflight check before export can use
 * it as it is.
 */

export type Size = { width: number; height: number }

/**
 * Below this a photo starts to look soft or pixelated on a poster seen from
 * arm's length. 300 ppi is the magazine rule for close reading; posters are
 * read from further away, and 150 is the usual large-format floor.
 */
export const MIN_PRINT_PPI = 150

/** Enlarged past this share of its own pixels, a photo looks soft on screen. */
export const MAX_SCREEN_ENLARGEMENT_PERCENT = 133

/** How a poster is measured: print sizes in ppi at the document's dpi, screen sizes in px. */
export type ResolutionUnits = { kind: 'print'; dpi: number } | { kind: 'screen' }

export type ImageResolutionInput = {
  /** Source pixels the layer actually shows (after any crop). */
  shown: Size
  /** The size those pixels take on the poster, in poster px (after scaling). */
  onPoster: Size
  units: ResolutionUnits
}

export type EffectiveResolution =
  | { kind: 'print'; ppi: number; low: boolean }
  | { kind: 'screen'; percent: number; low: boolean }

/**
 * Print presets carry a physical size (mm) and are measured at the document's
 * dpi; screen presets (Instagram, Square, custom px sizes) are not.
 */
export function resolutionUnits(preset: { widthMm?: number; heightMm?: number; dpi?: number }, documentDpi?: number): ResolutionUnits {
  if (!preset.widthMm || !preset.heightMm) return { kind: 'screen' }
  const dpi = documentDpi && documentDpi > 0 ? documentDpi : (preset.dpi ?? 300)
  return { kind: 'print', dpi }
}

const valid = (size: Size) => Number.isFinite(size.width) && Number.isFinite(size.height) && size.width > 0 && size.height > 0

/**
 * The worse of the two axes counts: a photo stretched one way is only as sharp
 * as that direction. Values are rounded to whole numbers, and the warning is
 * judged on the rounded value, so the words and the warning always agree.
 */
export function effectiveResolution({ shown, onPoster, units }: ImageResolutionInput): EffectiveResolution | null {
  if (!valid(shown) || !valid(onPoster)) return null
  if (units.kind === 'print') {
    // Printed inches = poster px / dpi; ppi = source px per printed inch.
    const ppi = Math.round(Math.min((shown.width * units.dpi) / onPoster.width, (shown.height * units.dpi) / onPoster.height))
    return { kind: 'print', ppi, low: ppi < MIN_PRINT_PPI }
  }
  const percent = Math.round(Math.max(onPoster.width / shown.width, onPoster.height / shown.height) * 100)
  return { kind: 'screen', percent, low: percent > MAX_SCREEN_ENLARGEMENT_PERCENT }
}

/** Plain words for the Properties panel, and a warning sentence when it is low. */
export function describeResolution(resolution: EffectiveResolution): { text: string; warning: string | null } {
  if (resolution.kind === 'print') {
    return {
      text: `${resolution.ppi} ppi at print size`,
      warning: resolution.low ? `Low resolution: may print soft. Aim for ${MIN_PRINT_PPI} ppi or more — use a larger image or show it smaller.` : null,
    }
  }
  return {
    text: `Shown at ${resolution.percent}% of its pixels`,
    warning: resolution.low
      ? `Enlarged past ${MAX_SCREEN_ENLARGEMENT_PERCENT}%: may look soft. Use a larger image or show it smaller.`
      : null,
  }
}
