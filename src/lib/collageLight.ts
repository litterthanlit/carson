/**
 * Photograph the collage — light the paste-up the way Carson shoots his.
 *
 * Carson lays a collage out loose and photographs it with his phone before
 * gluing anything down, because the photo keeps "depth and texture, even
 * shadows, that a scanner wouldn't do". So: one light for the whole board, and
 * every scrap sits at a height — one sheet per scrap it lies on, plus a little
 * curl — that sets how far and how soft its shadow falls. Ink lies flat on its
 * paper and casts nothing.
 *
 * Shadows are written as the layer's ordinary drop-shadow style, so each one
 * stays live and editable.
 */
import { outlinesOverlap, type Point } from './weave'
import { createSeededRandom } from './random'
import type { DropShadowStyle } from './layerStyles'

export type CollageScrap = {
  id: string
  outline: Point[]
  /** Position in the stack, bottom = 0. */
  stackIndex: number
}

export type CollageLightOptions = {
  seed: number
  /** Effect scale for the poster size (see layerStyleScale). */
  scale: number
  /** 0–100: how far the paper sits off the board. */
  lift?: number
}

/** Layers in the stack that can cast a shadow: paper, not ink. */
export function castsCollageShadow(object: { type?: string; kind?: unknown; globalCompositeOperation?: string }): boolean {
  if (object.kind === 'adjustment' || object.kind === 'group') return false
  if (object.type === 'textbox' || object.type === 'i-text' || object.type === 'text' || object.type === 'line') return false
  // Multiply layers are printed onto what's below, not pasted on it.
  if (object.globalCompositeOperation === 'multiply') return false
  return true
}

/** How many sheets lie under each scrap where it sits. */
export function scrapHeights(scraps: CollageScrap[]): Map<string, number> {
  const heights = new Map<string, number>()
  const ordered = [...scraps].sort((a, b) => a.stackIndex - b.stackIndex)
  ordered.forEach((scrap, index) => {
    let height = 1
    for (let below = 0; below < index; below++) {
      const under = ordered[below]
      if (outlinesOverlap(scrap.outline, under.outline)) height = Math.max(height, (heights.get(under.id) ?? 1) + 1)
    }
    heights.set(scrap.id, height)
  })
  return heights
}

/** One light, one shadow per scrap. Same seed, same photograph. */
export function planCollageLight(scraps: CollageScrap[], options: CollageLightOptions): Map<string, DropShadowStyle> {
  const random = createSeededRandom(options.seed)
  const lift = Math.max(0, Math.min(100, options.lift ?? 50)) / 100
  // Light from somewhere over the top-left shoulder, as by a window.
  const angle = 105 + random() * 50
  const heights = scrapHeights(scraps)
  const styles = new Map<string, DropShadowStyle>()
  const ordered = [...scraps].sort((a, b) => a.stackIndex - b.stackIndex)
  for (const scrap of ordered) {
    // Paper never lies quite flat: each scrap curls a little on its own.
    const curl = 0.6 + random() * 0.8
    const height = Math.min(4, heights.get(scrap.id) ?? 1) * curl
    const distance = Math.max(1, Math.round(height * (2 + lift * 8) * options.scale))
    styles.set(scrap.id, {
      enabled: true,
      color: '#1d160d',
      opacity: Math.min(0.42, 0.16 + 0.06 * height),
      blur: Math.round(distance * 1.7 + 2 * options.scale),
      distance,
      angle: Math.round(angle + (random() - 0.5) * 6),
    })
  }
  return styles
}
