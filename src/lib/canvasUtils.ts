import type { FabricObject } from 'fabric'

export function readObjectProp(object: FabricObject | null, key: string) {
  if (!object) return undefined
  return (object as unknown as Record<string, unknown>)[key]
}

export function round(value: number) {
  return Math.round(value * 100) / 100
}

export function safeFileName(projectName: string) {
  return (
    projectName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'poster'
  )
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export function buildStarPoints(points: number, outer: number, inner: number) {
  const step = Math.PI / points
  const output: { x: number; y: number }[] = []
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner
    const angle = index * step - Math.PI / 2
    output.push({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius })
  }
  return output
}

export const FIT_PADDING = 48

export function computeFitScale(
  stageWidth: number,
  stageHeight: number,
  posterWidth: number,
  posterHeight: number,
  padding = FIT_PADDING,
) {
  const safeStageW = Number.isFinite(stageWidth) && stageWidth > 0 ? stageWidth : 0
  const safeStageH = Number.isFinite(stageHeight) && stageHeight > 0 ? stageHeight : 0
  const safePosterW = Number.isFinite(posterWidth) && posterWidth > 0 ? posterWidth : 1
  const safePosterH = Number.isFinite(posterHeight) && posterHeight > 0 ? posterHeight : 1

  if (safeStageW === 0 || safeStageH === 0) {
    return 0.02
  }

  const availableW = safeStageW - padding
  const availableH = safeStageH - padding
  const scaleW = availableW > 0 ? availableW / safePosterW : 0.02
  const scaleH = availableH > 0 ? availableH / safePosterH : 0.02

  return Math.max(0.02, Math.min(1, scaleW, scaleH))
}

export const formatPercent = (value: number) => `${Math.round(value)}%`
export const formatDegrees = (value: number) => `${Math.round(value)}°`
export const formatLineHeight = (value: number) => (value / 100).toFixed(2)
