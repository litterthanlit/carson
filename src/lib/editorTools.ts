import type { EditorTool } from '../types/editor'

export function cursorForTool(
  tool: EditorTool,
  options: { pan?: boolean; pen?: boolean } = {},
): string {
  if (options.pan) return 'grab'
  if (options.pen) return 'crosshair'
  switch (tool) {
    case 'text':
      return 'text'
    case 'shape':
      return 'crosshair'
    case 'mask':
      return 'cell'
    default:
      return 'default'
  }
}

export function hoverCursorForTool(tool: EditorTool, options: { pan?: boolean; pen?: boolean } = {}): string {
  if (options.pan) return 'grab'
  if (options.pen) return 'crosshair'
  if (tool === 'text' || tool === 'shape' || tool === 'mask') return cursorForTool(tool, options)
  return 'move'
}
