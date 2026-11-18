import { useRef, useState, type MutableRefObject } from 'react'
import { util, type Canvas, type FabricImage, type FabricObject } from 'fabric'
import { readFileAsDataUrl, readObjectProp } from '../lib/canvasUtils'
import { coverCrop, fullCrop, isFullCrop, type CropRect } from '../lib/cropGeometry'
import { CropSession } from '../lib/cropSession'
import { captureObjectPatch } from '../lib/historyObject'
import { isLayerGroup } from '../lib/layerGroups'
import { applyLayerMask, readLayerMask } from '../lib/layerMask'
import { companionsOf } from '../lib/companionFollow'
import { patchTransformBaseline, readTransformBaseline, readTreatments } from '../lib/treatments'
import { applyCrop, cropBlocker, isPhotoLayer, readCrop, replaceBlocker, sourceSize } from '../lib/photoLayer'

type UsePhotoToolsOptions = {
  canvasRef: MutableRefObject<Canvas | null>
  activeObject: () => FabricObject | null
  findObjectById: (id: string) => FabricObject | null
  setStatus: (message: string) => void
  /** One undo step that restores this object's patch. */
  commitObjectPatch: (objectId: string, label: string, before: string, after: string) => void
  /** One undo step from a full snapshot (the image's pixels changed). */
  commitHistory: (label: string) => void
  /** The photo's pixels or crop changed: re-render its effects, thumbnail, panels. */
  afterPhotoChange: (image: FabricImage) => void
  /** Canvas picking back as the current tool wants it. */
  restoreCanvasSelection: () => void
  /** Live crop changes, for readouts that follow the frame (resolution). */
  onCropPreview?: (image: FabricImage, crop: CropRect) => void
  /** A new picture also lands in the asset library, as any placed image does. */
  persistAsset?: (file: File) => Promise<void>
}

const objectId = (object: FabricObject) => String(readObjectProp(object, 'id') ?? '')

type Pose = { left: number; top: number; scaleX: number; scaleY: number }

const poseOf = (object: FabricObject): Pose => ({
  left: object.left ?? 0,
  top: object.top ?? 0,
  scaleX: object.scaleX ?? 1,
  scaleY: object.scaleY ?? 1,
})

/**
 * Effects re-pose a layer from its transform baseline when they re-render; move
 * and scale the baseline with the layer so a crop or replace doesn't snap back.
 */
function followBaseline(object: FabricObject, before: Pose) {
  const baseline = readTransformBaseline(object)
  if (!baseline) return
  const after = poseOf(object)
  patchTransformBaseline(object, {
    left: baseline.left + after.left - before.left,
    top: baseline.top + after.top - before.top,
    angle: baseline.angle,
    scaleX: baseline.scaleX * (after.scaleX / (before.scaleX || 1)),
    scaleY: baseline.scaleY * (after.scaleY / (before.scaleY || 1)),
  })
}

function sizeLabel(rect: CropRect) {
  return `${Math.round(rect.width)} × ${Math.round(rect.height)} px`
}

/**
 * Photo basics for image layers: crop in place (a session the canvas overlay and
 * crop bar drive), reset crop, and replace the picture keeping the layout.
 */
export function usePhotoTools({
  canvasRef,
  activeObject,
  findObjectById,
  setStatus,
  commitObjectPatch,
  commitHistory,
  afterPhotoChange,
  restoreCanvasSelection,
  onCropPreview,
  persistAsset,
}: UsePhotoToolsOptions) {
  const [cropSession, setCropSession] = useState<CropSession | null>(null)
  /** Entered from the keyboard: the crop bar takes focus so its fields and buttons are a Tab away. */
  const [cropBarFocus, setCropBarFocus] = useState(false)
  const cropSessionRef = useRef<CropSession | null>(null)
  cropSessionRef.current = cropSession

  /** The selected photo, or a status line saying why there isn't one. */
  function selectedPhoto(verb: string): FabricImage | null {
    const object = activeObject()
    if (object && isLayerGroup(object) && object.getObjects().some((child) => isPhotoLayer(child))) {
      setStatus(`That’s a group. Ungroup it to ${verb} the image inside.`)
      return null
    }
    if (!object || object.type === 'activeselection' || !isPhotoLayer(object)) {
      setStatus(`Select one image layer to ${verb} it`)
      return null
    }
    return object
  }

  function startCrop(target?: FabricObject | null, options: { focusBar?: boolean } = {}) {
    const canvas = canvasRef.current
    if (!canvas || cropSessionRef.current) return
    const image = target ?? selectedPhoto('crop')
    if (!image || !isPhotoLayer(image)) return
    const blocked = cropBlocker(image)
    if (blocked) {
      setStatus(blocked)
      return
    }
    if (canvas.getActiveObject() !== image) canvas.setActiveObject(image)
    canvas.selection = false
    canvas.skipTargetFind = true
    const id = objectId(image)
    // Effects that draw copies of the layer show the old crop: hide them, and show a layer they hide.
    const treated = readTreatments(image).some((item) => item.enabled)
    const session = new CropSession(image, id, {
      onChange: (live) => onCropPreview?.(live.image, live.rect),
      hide: companionsOf(canvas, id),
      revealOpacity: treated && image.opacity === 0 ? (readTransformBaseline(image)?.opacity ?? 1) : null,
    })
    cropSessionRef.current = session
    setCropSession(session)
    setCropBarFocus(Boolean(options.focusBar))
    setStatus(
      `Cropping ${String(readObjectProp(image, 'name') ?? 'image')}: drag the handles or the photo, Shift keeps the shape. Enter applies, Esc cancels.`,
    )
  }

  function finishCrop(apply: boolean) {
    const session = cropSessionRef.current
    if (!session) return
    cropSessionRef.current = null
    setCropSession(null)
    const changed = session.changed
    const rect = session.rect
    const { before, after } = session.finish(apply && changed)
    restoreCanvasSelection()
    canvasRef.current?.requestRenderAll()
    if (!apply) {
      afterPhotoChange(session.image)
      setStatus('Crop cancelled')
      return
    }
    if (!changed || before === after) {
      afterPhotoChange(session.image)
      setStatus('Crop unchanged')
      return
    }
    followBaseline(session.image, session.startPose)
    commitObjectPatch(session.objectId, 'Cropped image', before, after)
    afterPhotoChange(session.image)
    setStatus(
      isFullCrop(rect, session.source) ? 'Crop removed: showing the whole image' : `Cropped to ${sizeLabel(rect)} of ${sizeLabel(fullCrop(session.source))}`,
    )
  }

  /** Show the whole image again, keeping what the crop showed where it was. One undo step. */
  function resetCrop() {
    const image = selectedPhoto('reset the crop of')
    if (!image) return
    const blocked = cropBlocker(image)
    if (blocked) {
      setStatus(blocked)
      return
    }
    if (isFullCrop(readCrop(image), sourceSize(image))) {
      setStatus('This image isn’t cropped')
      return
    }
    const before = captureObjectPatch(image)
    const pose = poseOf(image)
    applyCrop(image, fullCrop(sourceSize(image)))
    followBaseline(image, pose)
    commitObjectPatch(objectId(image), 'Reset crop', before, captureObjectPatch(image))
    afterPhotoChange(image)
    setStatus('Crop reset: showing the whole image')
  }

  /**
   * Swap the picture under a photo layer. The new image covers the old layer's
   * box on the poster (centred, cropped to fit), so position, rotation, stacking,
   * name, opacity, blend, effects, mask and styles all stay. One undo step.
   */
  async function replaceImage(file: File, targetId: string) {
    const target = findObjectById(targetId)
    if (!target || !isPhotoLayer(target)) {
      setStatus('The image layer to replace is gone')
      return
    }
    const blocked = replaceBlocker(target)
    if (blocked) {
      setStatus(blocked)
      return
    }
    setStatus(`Replacing with ${file.name}…`)
    let element: HTMLImageElement
    try {
      element = await util.loadImage(await readFileAsDataUrl(file))
    } catch {
      setStatus(`Couldn’t read ${file.name} as an image`)
      return
    }
    const image = findObjectById(targetId)
    if (!image || !isPhotoLayer(image)) return
    const source = { width: element.naturalWidth || element.width, height: element.naturalHeight || element.height }
    if (!source.width || !source.height) {
      setStatus(`Couldn’t read ${file.name} as an image`)
      return
    }
    const box = { width: (image.width ?? 1) * Math.abs(image.scaleX ?? 1), height: (image.height ?? 1) * Math.abs(image.scaleY ?? 1) }
    const center = image.getRelativeCenterPoint()
    const pose = poseOf(image)
    const { crop, scale } = coverCrop(source, box)
    image.setElement(element)
    image.set({
      cropX: crop.x,
      cropY: crop.y,
      width: crop.width,
      height: crop.height,
      scaleX: scale * Math.sign(image.scaleX || 1),
      scaleY: scale * Math.sign(image.scaleY || 1),
      dirty: true,
    })
    image.setPositionByOrigin(center, 'center', 'center')
    image.setCoords()
    followBaseline(image, pose)
    // The mask is normalized to the layer's box; rebuild it at the new pixel size.
    if (readLayerMask(image)) await applyLayerMask(image)
    canvasRef.current?.requestRenderAll()
    commitHistory('Replaced image')
    afterPhotoChange(image)
    setStatus(`Replaced the image with ${file.name}`)
    void persistAsset?.(file).catch(() => undefined)
  }

  /**
   * Keys while cropping. Everything else the editor binds is suspended: Enter
   * applies, Esc cancels, arrows slide the photo (Shift ×10), Cmd/Ctrl+Z cancels.
   */
  function handleCropKey(event: KeyboardEvent, typing: boolean) {
    const session = cropSessionRef.current
    if (!session) return
    const meta = event.metaKey || event.ctrlKey
    const target = event.target as HTMLElement | null
    if (event.key === 'Escape') {
      event.preventDefault()
      finishCrop(false)
      return
    }
    if (meta && event.key.toLowerCase() === 'z') {
      event.preventDefault()
      finishCrop(false)
      return
    }
    if (typing) return
    // A focused button or checkbox does its own thing with Enter.
    const control = target?.closest?.('button, a, input, select, summary, [role="button"], [role="radio"], [role="checkbox"]')
    if (event.key === 'Enter') {
      if (control) return
      event.preventDefault()
      finishCrop(true)
      return
    }
    if (meta) {
      // Save, export, palette…: not while a crop is open.
      event.preventDefault()
      return
    }
    const step = event.shiftKey ? 10 : 1
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }
    const move = arrows[event.key]
    const onCanvas = !control && (!target || target === document.body || target.closest('.canvas-scroll, .crop-overlay'))
    if (move && onCanvas) {
      event.preventDefault()
      session.pan(session.panStart(), { x: move[0], y: move[1] })
    }
  }

  return { cropSession, cropSessionRef, cropBarFocus, startCrop, finishCrop, resetCrop, replaceImage, handleCropKey }
}
