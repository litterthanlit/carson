/**
 * Crop rectangles for image layers, in the source image's own pixels.
 *
 * Pure: no Fabric, no DOM. A crop is the part of the source an image layer
 * shows (Fabric's `cropX`, `cropY`, `width`, `height`); the source pixels are
 * never changed, so a crop can always grow back to the whole image.
 */

export type Size = { width: number; height: number }
export type Vec = { x: number; y: number }
export type CropRect = { x: number; y: number; width: number; height: number }

/** Handles around a crop frame: corners and edge midpoints, clockwise from top-left. */
export type CropHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const CROP_HANDLES: readonly CropHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

/** The smallest crop, in source px, so a frame never collapses to nothing. */
export const MIN_CROP_SIZE = 8

export function fullCrop(source: Size): CropRect {
  return { x: 0, y: 0, width: source.width, height: source.height }
}

export function isFullCrop(rect: CropRect, source: Size, tolerance = 0.5): boolean {
  return (
    Math.abs(rect.x) <= tolerance &&
    Math.abs(rect.y) <= tolerance &&
    Math.abs(rect.width - source.width) <= tolerance &&
    Math.abs(rect.height - source.height) <= tolerance
  )
}

export function sameCrop(a: CropRect, b: CropRect, tolerance = 1e-6): boolean {
  return (
    Math.abs(a.x - b.x) <= tolerance &&
    Math.abs(a.y - b.y) <= tolerance &&
    Math.abs(a.width - b.width) <= tolerance &&
    Math.abs(a.height - b.height) <= tolerance
  )
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** Keep a crop inside the source and at least the minimum size. */
export function clampCrop(rect: CropRect, source: Size): CropRect {
  const minWidth = Math.min(MIN_CROP_SIZE, source.width)
  const minHeight = Math.min(MIN_CROP_SIZE, source.height)
  const width = clamp(rect.width, minWidth, source.width)
  const height = clamp(rect.height, minHeight, source.height)
  return {
    x: clamp(rect.x, 0, source.width - width),
    y: clamp(rect.y, 0, source.height - height),
    width,
    height,
  }
}

/**
 * Where the crop's centre sits relative to the whole image's centre, in source
 * px. A layer's own transform maps this offset onto the poster, which is how a
 * crop keeps the region it shows in place.
 */
export function cropCenterOffset(rect: CropRect, source: Size): Vec {
  return { x: rect.x + rect.width / 2 - source.width / 2, y: rect.y + rect.height / 2 - source.height / 2 }
}

/** Slide the crop by `delta` source px, stopping at the image's edges. */
export function moveCrop(rect: CropRect, delta: Vec, source: Size): CropRect {
  return {
    ...rect,
    x: clamp(rect.x + delta.x, 0, Math.max(0, source.width - rect.width)),
    y: clamp(rect.y + delta.y, 0, Math.max(0, source.height - rect.height)),
  }
}

function handleSides(handle: CropHandle) {
  return {
    left: handle.includes('w'),
    right: handle.includes('e'),
    top: handle.startsWith('n'),
    bottom: handle.startsWith('s'),
  }
}

/**
 * Drag one handle of the crop `start` by `delta` source px. The opposite side
 * (or corner) stays put; with `keepAspect` the frame keeps its proportions, an
 * edge handle growing it about its centre line. Always stays inside the source.
 */
export function resizeCrop(start: CropRect, handle: CropHandle, delta: Vec, source: Size, keepAspect = false): CropRect {
  const sides = handleSides(handle)
  const minWidth = Math.min(MIN_CROP_SIZE, source.width)
  const minHeight = Math.min(MIN_CROP_SIZE, source.height)
  let left = start.x
  let top = start.y
  let right = start.x + start.width
  let bottom = start.y + start.height

  if (!keepAspect) {
    if (sides.left) left = clamp(left + delta.x, 0, right - minWidth)
    if (sides.right) right = clamp(right + delta.x, left + minWidth, source.width)
    if (sides.top) top = clamp(top + delta.y, 0, bottom - minHeight)
    if (sides.bottom) bottom = clamp(bottom + delta.y, top + minHeight, source.height)
    return { x: left, y: top, width: right - left, height: bottom - top }
  }

  const ratio = start.width / Math.max(1e-9, start.height)
  const horizontal = sides.left || sides.right
  const vertical = sides.top || sides.bottom
  // Proposed size from the moved edges.
  let width = start.width + (sides.right ? delta.x : sides.left ? -delta.x : 0)
  let height = start.height + (sides.bottom ? delta.y : sides.top ? -delta.y : 0)
  if (horizontal && vertical) {
    // A corner follows whichever edge moved further, relative to the frame.
    if (Math.abs(width / start.width - 1) >= Math.abs(height / start.height - 1)) height = width / ratio
    else width = height * ratio
  } else if (horizontal) {
    height = width / ratio
  } else {
    width = height * ratio
  }

  // Anchors: the fixed side, or the centre line for an edge handle's other axis.
  const centerX = start.x + start.width / 2
  const centerY = start.y + start.height / 2
  const maxWidth = sides.left ? right : sides.right ? source.width - left : 2 * Math.min(centerX, source.width - centerX)
  const maxHeight = sides.top ? bottom : sides.bottom ? source.height - top : 2 * Math.min(centerY, source.height - centerY)
  if (width > maxWidth) {
    width = maxWidth
    height = width / ratio
  }
  if (height > maxHeight) {
    height = maxHeight
    width = height * ratio
  }
  if (width < minWidth) {
    width = minWidth
    height = width / ratio
  }
  if (height < minHeight) {
    height = minHeight
    width = height * ratio
  }

  const x = sides.left ? right - width : sides.right ? left : centerX - width / 2
  const y = sides.top ? bottom - height : sides.bottom ? top : centerY - height / 2
  return clampCrop({ x, y, width, height }, source)
}

export type CropField = 'x' | 'y' | 'width' | 'height'

/**
 * Set one number of the crop, as typed in a field. Position fields move the
 * frame; size fields grow it from its top-left, and with `keepAspect` change the
 * other side to match.
 */
export function setCropField(rect: CropRect, field: CropField, value: number, source: Size, keepAspect = false): CropRect {
  if (!Number.isFinite(value)) return rect
  if (field === 'x' || field === 'y') return moveCrop(rect, field === 'x' ? { x: value - rect.x, y: 0 } : { x: 0, y: value - rect.y }, source)
  if (!keepAspect) return clampCrop({ ...rect, [field]: value }, source)
  // The bottom-right corner, moved along one axis only, follows that axis and keeps the top-left put.
  const delta = field === 'width' ? { x: value - rect.width, y: 0 } : { x: 0, y: value - rect.height }
  return resizeCrop(rect, 'se', delta, source, true)
}

/**
 * Fit a new source so it covers `box` (the old layer's size on the poster):
 * the uniform scale, and the centred crop that fills the box exactly.
 */
export function coverCrop(source: Size, box: Size): { crop: CropRect; scale: number } {
  const scale = Math.max(box.width / source.width, box.height / source.height)
  const width = Math.min(source.width, box.width / scale)
  const height = Math.min(source.height, box.height / scale)
  return {
    scale,
    crop: { x: (source.width - width) / 2, y: (source.height - height) / 2, width, height },
  }
}
