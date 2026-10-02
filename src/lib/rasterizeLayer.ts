import { FabricImage, config, type FabricObject } from 'fabric'

/** Type and shapes are snapshotted at this multiplier before fx run. */
export const SNAPSHOT_MULTIPLIER = 2

/**
 * Snapshot multiplier for a layer of these bounds. Fabric's WebGL filter backend draws its last
 * pass into one `config.textureSize` tile, so a larger raster comes back cropped; big layers
 * (an oversized headline is ~3900 units wide) are snapshotted just small enough to fit.
 */
export function snapshotMultiplier(width: number, height: number) {
  const longSide = Math.max(width, height, 1)
  // A few pixels of slack: toDataURL pads the bounds slightly.
  return Math.min(SNAPSHOT_MULTIPLIER, (config.textureSize - 16) / longSide)
}

export async function snapshotObjectToImage(object: FabricObject): Promise<FabricImage> {
  const bounds = object.getBoundingRect()
  const dataUrl = object.toDataURL({ format: 'png', multiplier: snapshotMultiplier(bounds.width, bounds.height) })
  const image = await FabricImage.fromURL(dataUrl, { crossOrigin: 'anonymous' })
  const width = Math.max(1, image.width ?? 1)
  const height = Math.max(1, image.height ?? 1)
  image.set({
    left: bounds.left,
    top: bounds.top,
    originX: 'left',
    originY: 'top',
    scaleX: bounds.width / width,
    scaleY: bounds.height / height,
    angle: 0,
    opacity: 1,
    globalCompositeOperation: object.globalCompositeOperation,
  })
  return image
}
