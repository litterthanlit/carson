/**
 * Photo layers in Fabric: which image layers can be cropped or replaced, and how
 * a crop is written to Fabric's own image crop properties (`cropX`, `cropY`,
 * `width`, `height`). Those serialize with the layer everywhere it goes — saves,
 * autosave, `.carson` files, undo snapshots — and every renderer (export,
 * effects that rasterize the layer) draws the cropped image without knowing.
 */
import { FabricImage, Point, util, type FabricObject } from 'fabric'
import { readObjectProp } from './canvasUtils'
import { cropCenterOffset, type CropRect, type Size, type Vec } from './cropGeometry'
import { instanceRoot } from './components'
import { hasMaskContent, readLayerMask } from './layerMask'
import { isPaintLayer } from './paintLayer'
import { readTreatments, type TreatmentType } from './treatments'
import { readWarp } from './warpRender'

/** A placed photo: an image layer the designer brought in, not a paint layer or an effect's scrap. */
export function isPhotoLayer(object: FabricObject | null | undefined): object is FabricImage {
  return Boolean(object) && object instanceof FabricImage && readObjectProp(object, 'kind') === 'image' && !isPaintLayer(object)
}

/** Effects that hide the layer and show cut-up pieces of it instead. */
const SOURCE_HIDING: Partial<Record<TreatmentType, string>> = {
  slice: 'Slice',
  crop: 'Aggressive crop',
  tear: 'Tear',
  'bad-crop': 'Bad crop',
  'glyph-break': 'Glyph break',
}

/** Why this photo can't be replaced, or null. */
export function replaceBlocker(object: FabricObject): string | null {
  if (instanceRoot(object)) return 'This photo is part of a component instance. Detach the instance to replace its image.'
  return null
}

/** Why this photo can't be cropped in place, or null. Each reason says what to do instead. */
export function cropBlocker(object: FabricObject): string | null {
  if (object.group && object.group.type === 'group') return 'This photo is inside a group. Ungroup it to crop it.'
  const instance = replaceBlocker(object)
  if (instance) return 'This photo is part of a component instance. Detach the instance to crop it.'
  const mask = readLayerMask(object)
  if (hasMaskContent(mask)) {
    return mask.clipGeom?.kind === 'polygon'
      ? 'This photo has torn edges, which would no longer line up. Remove the layer mask, crop, then tear again.'
      : 'This photo has a layer mask, which would no longer line up. Remove the mask to crop it.'
  }
  if (readWarp(object)) return 'This photo is distorted or warped. Remove the warp to crop it.'
  const hiding = readTreatments(object).find((item) => item.enabled && SOURCE_HIDING[item.type])
  if (hiding) return `This photo is cut up by ${SOURCE_HIDING[hiding.type]}. Turn that effect off to crop it.`
  return null
}

export function sourceSize(image: FabricImage): Size {
  return image.getOriginalSize()
}

export function readCrop(image: FabricImage): CropRect {
  return { x: image.cropX ?? 0, y: image.cropY ?? 0, width: image.width ?? 0, height: image.height ?? 0 }
}

/** The layer's own transform without its translation: local px → parent px. */
function linear(image: FabricObject): number[] {
  const [a, b, c, d] = image.calcOwnMatrix()
  return [a, b, c, d, 0, 0]
}

function applyLinear(m: number[], v: Vec): Point {
  return new Point(m[0] * v.x + m[2] * v.y, m[1] * v.x + m[3] * v.y)
}

/** Where the centre of the whole (uncropped) image lies, in the layer's parent plane. */
export function fullImageCenter(image: FabricImage): Point {
  const offset = applyLinear(linear(image), cropCenterOffset(readCrop(image), sourceSize(image)))
  return image.getRelativeCenterPoint().subtract(offset)
}

/**
 * Show `crop` of the source with the whole image posed so its centre is at
 * `center` (parent plane). The pixels the crop keeps stay exactly where they
 * were on the poster, whatever the layer's rotation, scale or flip.
 */
export function applyCrop(image: FabricImage, crop: CropRect, center: Point = fullImageCenter(image)) {
  const offset = applyLinear(linear(image), cropCenterOffset(crop, sourceSize(image)))
  image.set({ cropX: crop.x, cropY: crop.y, width: crop.width, height: crop.height, dirty: true })
  image.setPositionByOrigin(center.add(offset), 'center', 'center')
  image.setCoords()
}

/** Move the whole image by `delta` local source px (the layer's own axes). */
export function shiftInParent(image: FabricObject, center: Point, delta: Vec): Point {
  return center.add(applyLinear(linear(image), delta))
}

/** A drag on the poster, in poster px, as a move in the layer's own source px. */
export function posterDeltaToLocal(image: FabricObject, delta: Vec): Vec {
  const inverse = util.invertTransform(image.calcTransformMatrix())
  return { x: inverse[0] * delta.x + inverse[2] * delta.y, y: inverse[1] * delta.x + inverse[3] * delta.y }
}

/** The pixels a photo shows and the size they take on the poster, for `effectiveResolution`. */
export function measurePhoto(image: FabricImage, crop: CropRect = readCrop(image)): { shown: Size; onPoster: Size } {
  const { scaleX, scaleY } = util.qrDecompose(image.calcTransformMatrix())
  return {
    shown: { width: crop.width, height: crop.height },
    onPoster: { width: crop.width * Math.abs(scaleX), height: crop.height * Math.abs(scaleY) },
  }
}
