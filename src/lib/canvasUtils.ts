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

export const formatPercent = (value: number) => `${Math.round(value)}%`
export const formatDegrees = (value: number) => `${Math.round(value)}°`
export const formatLineHeight = (value: number) => (value / 100).toFixed(2)
