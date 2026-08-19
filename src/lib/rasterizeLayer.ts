import { FabricImage, type FabricObject } from 'fabric'

export async function snapshotObjectToImage(object: FabricObject): Promise<FabricImage> {
  const bounds = object.getBoundingRect()
  const dataUrl = object.toDataURL({ format: 'png', multiplier: 2 })
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
