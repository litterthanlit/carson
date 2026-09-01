/**
 * Shared tension multiplier for Instruments.
 * Grid 0 → 1×, 100 → 2× (see gridTensionScale). Floor matches scatter / Copy Machine.
 */

export function instrumentTensionScale(tensionScale = 1): number {
  if (!Number.isFinite(tensionScale)) return 1
  return Math.max(0.1, tensionScale)
}

/** Multiply named intensity params. Leave seeds, angles, and kind enums to the caller. */
export function scaleInstrumentParams(
  params: Record<string, number>,
  tensionKeys: readonly string[],
  tensionScale = 1,
): Record<string, number> {
  const scale = instrumentTensionScale(tensionScale)
  if (scale === 1 || tensionKeys.length === 0) return params
  const next = { ...params }
  for (const key of tensionKeys) {
    const value = next[key]
    if (typeof value === 'number') next[key] = value * scale
  }
  return next
}
