import type { HistoryOp } from './historyLog'

export const MAX_TRAIL_FRAMES = 24

export type TrailFrame = {
  id: string
  opId: string
  label: string
  thumbnail?: string
}

export function newTrailFrameId(): string {
  return `trail-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

export function isTrailWorthy(op: HistoryOp): boolean {
  return op.type !== 'objectPatch' && op.type !== 'layerOrder'
}

export function liveOpIds(ops: HistoryOp[]): string[] {
  return ops.map((op) => op.id).filter((id): id is string => Boolean(id))
}

export function pruneTrailToOps(frames: TrailFrame[], opIds: string[]): TrailFrame[] {
  const live = new Set(opIds)
  return frames.filter((frame) => live.has(frame.opId))
}

export function commitTrailFrame(frames: TrailFrame[], opIds: string[], next: TrailFrame): TrailFrame[] {
  const live = new Set(opIds)
  const kept = frames.filter((frame) => live.has(frame.opId) && frame.opId !== next.opId)
  const last = kept.at(-1)
  const merged = last?.label === next.label ? [...kept.slice(0, -1), next] : [...kept, next]
  return merged.slice(-MAX_TRAIL_FRAMES)
}

export function patchTrailThumbnail(frames: TrailFrame[], opId: string, thumbnail: string): TrailFrame[] {
  return frames.map((frame) => (frame.opId === opId ? { ...frame, thumbnail } : frame))
}

export function activeTrailFrame(frames: TrailFrame[], opIds: string[], cursor: number): TrailFrame | null {
  for (let index = Math.min(cursor, opIds.length - 1); index >= 0; index -= 1) {
    const opId = opIds[index]
    const frame = opId ? frames.find((item) => item.opId === opId) : undefined
    if (frame) return frame
  }
  return frames[0] ?? null
}
