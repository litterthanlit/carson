/**
 * Companions that follow their source — the copier's bake and ghost, a
 * misprint echo, type strips. Each is placed from the source's pose when it
 * renders, so a drag must carry them along live and re-render them where the
 * source comes to rest: on a press the spot on the sheet sets the ink.
 */
import type { Canvas, FabricObject } from 'fabric'
import { COPY_GHOST_SOURCE_ID_KEY, COPY_MACHINE_SOURCE_ID_KEY } from './copyMachineTreatment'
import { MISPRINT_SOURCE_ID_KEY } from './misprintTreatment'
import { readTreatments, type TreatmentType } from './treatments'
import { TYPE_STRIP_SOURCE_ID_KEY } from './typeStripsTreatment'

/** Treatments whose companions are placed from — and on a press, inked by — the source's pose. */
export const POSE_FOLLOWING_TREATMENTS: ReadonlySet<TreatmentType> = new Set<TreatmentType>([
  'copy-machine',
  'misprint',
  'type-strips',
])

export const COMPANION_POSE_KEY = 'companionPose'
const FOLLOW_ORIGIN_KEY = 'companionFollowOrigin'
const COMPANION_SOURCE_KEYS = [
  COPY_MACHINE_SOURCE_ID_KEY,
  COPY_GHOST_SOURCE_ID_KEY,
  MISPRINT_SOURCE_ID_KEY,
  TYPE_STRIP_SOURCE_ID_KEY,
] as const

type Pose = { left: number; top: number; angle: number; scaleX: number; scaleY: number }

function record(object: unknown): Record<string, unknown> {
  return object as Record<string, unknown>
}

function poseOf(object: FabricObject): Pose {
  return {
    left: object.left ?? 0,
    top: object.top ?? 0,
    angle: object.angle ?? 0,
    scaleX: object.scaleX ?? 1,
    scaleY: object.scaleY ?? 1,
  }
}

export function companionPoseStamp(object: FabricObject): string {
  const pose = poseOf(object)
  return [pose.left.toFixed(2), pose.top.toFixed(2), pose.angle.toFixed(2), pose.scaleX.toFixed(4), pose.scaleY.toFixed(4)].join(',')
}

export function hasPoseFollowingTreatments(object: FabricObject): boolean {
  return readTreatments(object).some((item) => item.enabled && POSE_FOLLOWING_TREATMENTS.has(item.type))
}

/** Remember the pose the companions were just rendered at (or forget it when there are none). */
export function stampCompanionPose(object: FabricObject) {
  const target = record(object)
  if (hasPoseFollowingTreatments(object)) target[COMPANION_POSE_KEY] = companionPoseStamp(object)
  else delete target[COMPANION_POSE_KEY]
}

/**
 * True when the source has come to rest somewhere other than where its
 * companions were rendered. Inside a multi-selection a layer's pose is
 * relative to the selection, so it waits until the selection lets go.
 */
export function isCompanionPoseStale(object: FabricObject): boolean {
  const stamp = record(object)[COMPANION_POSE_KEY]
  if (typeof stamp !== 'string') return false
  if (object.group?.type === 'activeselection') return false
  if (!hasPoseFollowingTreatments(object)) return false
  return stamp !== companionPoseStamp(object)
}

export function companionsOf(canvas: Canvas, sourceId: string): FabricObject[] {
  return canvas.getObjects().filter((object) => COMPANION_SOURCE_KEYS.some((key) => record(object)[key] === sourceId))
}

/**
 * Slide a source's companions by however far the source has moved since they
 * were rendered — a stand-in until the source settles and re-renders.
 */
export function followSourceLive(canvas: Canvas, source: FabricObject) {
  const stamp = record(source)[COMPANION_POSE_KEY]
  if (typeof stamp !== 'string') return
  const [left, top] = stamp.split(',').map(Number)
  if (!Number.isFinite(left) || !Number.isFinite(top)) return
  const dx = (source.left ?? 0) - left
  const dy = (source.top ?? 0) - top
  const sourceId = String(record(source).id ?? '')
  if (!sourceId) return
  for (const companion of companionsOf(canvas, sourceId)) {
    const target = record(companion)
    const origin = (target[FOLLOW_ORIGIN_KEY] as { left: number; top: number } | undefined) ?? {
      left: companion.left ?? 0,
      top: companion.top ?? 0,
    }
    target[FOLLOW_ORIGIN_KEY] = origin
    companion.set({ left: origin.left + dx, top: origin.top + dy })
    companion.setCoords()
  }
}
