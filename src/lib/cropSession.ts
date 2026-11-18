/**
 * One in-place crop of a photo layer, from entering crop mode to Apply or Cancel.
 *
 * While it runs the layer shows its whole image, posed exactly where the crop
 * left it, and the frame (the crop rectangle, in source px) is drawn over it.
 * Handles change the frame; dragging the photo slides the image under a frame
 * that stays put on the poster. Nothing is committed until `finish(true)`.
 *
 * Live state sits here rather than in React state, so a drag re-renders only
 * the overlay and bar that subscribe to it, not the editor.
 */
import type { FabricImage, FabricObject, Point } from 'fabric'
import {
  fullCrop,
  moveCrop,
  resizeCrop,
  sameCrop,
  setCropField,
  type CropField,
  type CropHandle,
  type CropRect,
  type Size,
  type Vec,
} from './cropGeometry'
import { applyObjectPatch, captureObjectPatch } from './historyObject'
import { applyCrop, fullImageCenter, posterDeltaToLocal, readCrop, shiftInParent, sourceSize } from './photoLayer'

export type CropSnapshot = { rect: CropRect; keepAspect: boolean }

type Chrome = Pick<FabricImage, 'hasControls' | 'hasBorders' | 'lockMovementX' | 'lockMovementY' | 'opacity'>

export type CropSessionOptions = {
  /** Called on every change of the frame, for live readouts. */
  onChange?: (session: CropSession) => void
  /** Copies of the layer drawn by its effects; hidden while cropping, as they show the old crop. */
  hide?: FabricObject[]
  /** An effect that replaces the layer (Copy machine) hides it; show it at this opacity while cropping. */
  revealOpacity?: number | null
}

export class CropSession {
  readonly image: FabricImage
  readonly objectId: string
  readonly source: Size
  readonly startPatch: string
  private readonly startRect: CropRect
  private readonly startCenter: Point
  private center: Point
  private state: CropSnapshot
  private readonly chrome: Chrome
  private readonly listeners = new Set<() => void>()
  private readonly onChange: (session: CropSession) => void
  private readonly hidden: FabricObject[]
  /** The layer's pose before cropping, so effects that re-pose it from a baseline can follow. */
  readonly startPose: { left: number; top: number; scaleX: number; scaleY: number }

  constructor(image: FabricImage, objectId: string, { onChange = () => {}, hide = [], revealOpacity = null }: CropSessionOptions = {}) {
    this.image = image
    this.objectId = objectId
    this.onChange = onChange
    this.startPose = { left: image.left ?? 0, top: image.top ?? 0, scaleX: image.scaleX ?? 1, scaleY: image.scaleY ?? 1 }
    this.source = sourceSize(image)
    this.startPatch = captureObjectPatch(image)
    this.startRect = readCrop(image)
    this.startCenter = fullImageCenter(image)
    this.center = this.startCenter
    this.state = { rect: this.startRect, keepAspect: false }
    this.chrome = {
      hasControls: image.hasControls,
      hasBorders: image.hasBorders,
      lockMovementX: image.lockMovementX,
      lockMovementY: image.lockMovementY,
      opacity: image.opacity,
    }
    image.set({ hasControls: false, hasBorders: false, lockMovementX: true, lockMovementY: true })
    if (revealOpacity != null) image.set({ opacity: revealOpacity })
    this.hidden = hide.filter((object) => object.visible !== false)
    for (const object of this.hidden) object.set({ visible: false })
    this.showWholeImage()
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  snapshot = (): CropSnapshot => this.state

  get rect(): CropRect {
    return this.state.rect
  }

  /** Local (source px, origin at the whole image's centre) → poster px, while the whole image shows. */
  matrix(): number[] {
    return this.image.calcTransformMatrix() as number[]
  }

  /** A drag on the poster as a move in the image's own px. */
  toLocal(delta: Vec): Vec {
    return posterDeltaToLocal(this.image, delta)
  }

  private showWholeImage() {
    applyCrop(this.image, fullCrop(this.source), this.center)
    this.image.canvas?.requestRenderAll()
  }

  private update(next: Partial<CropSnapshot>) {
    this.state = { ...this.state, ...next }
    for (const listener of this.listeners) listener()
    this.onChange(this)
  }

  setRect(rect: CropRect) {
    this.update({ rect })
  }

  setKeepAspect(keepAspect: boolean) {
    this.update({ keepAspect })
  }

  /** Drag a handle: `from` is the frame when the drag began, `delta` the move in local px since then. */
  resize(from: CropRect, handle: CropHandle, delta: Vec, keepAspect = this.state.keepAspect) {
    this.setRect(resizeCrop(from, handle, delta, this.source, keepAspect))
  }

  setField(field: CropField, value: number) {
    this.setRect(setCropField(this.state.rect, field, value, this.source, this.state.keepAspect))
  }

  /** Where the whole image sits, for a pan that starts now. */
  panStart(): { rect: CropRect; center: Point } {
    return { rect: this.state.rect, center: this.center }
  }

  /** Slide the image by `delta` local px under a frame that stays on the poster. */
  pan(from: { rect: CropRect; center: Point }, delta: Vec) {
    const rect = moveCrop(from.rect, { x: -delta.x, y: -delta.y }, this.source)
    this.center = shiftInParent(this.image, from.center, { x: from.rect.x - rect.x, y: from.rect.y - rect.y })
    this.showWholeImage()
    this.setRect(rect)
  }

  /** Whole image back in the frame; the image itself doesn't move. */
  reset() {
    this.setRect(fullCrop(this.source))
  }

  get changed(): boolean {
    return !sameCrop(this.state.rect, this.startRect) || !this.center.eq(this.startCenter)
  }

  /** End the session: write the crop (apply) or put the layer back as it was. */
  finish(apply: boolean): { before: string; after: string } {
    if (apply) applyCrop(this.image, this.state.rect, this.center)
    else applyObjectPatch(this.image, this.startPatch)
    this.image.set(this.chrome)
    this.image.setCoords()
    for (const object of this.hidden) object.set({ visible: true })
    this.listeners.clear()
    return { before: this.startPatch, after: captureObjectPatch(this.image) }
  }
}
