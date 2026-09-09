export type CanvasTransformCapture = {
  objectId: string
  patch: string
}

export type CanvasTransformPatch = {
  objectId: string
  before: string
  after: string
}

export function collectCanvasTransformPatches(
  befores: CanvasTransformCapture[],
  afters: CanvasTransformCapture[],
): CanvasTransformPatch[] {
  const afterById = new Map(afters.map((item) => [item.objectId, item.patch]))
  const patches: CanvasTransformPatch[] = []
  for (const before of befores) {
    if (!before.objectId) continue
    const after = afterById.get(before.objectId)
    if (!after || after === before.patch) continue
    patches.push({ objectId: before.objectId, before: before.patch, after })
  }
  return patches
}
