export type LayerKind = 'text' | 'image' | 'shape' | 'fragment'
export type ExportFormat = 'png' | 'jpeg' | 'pdf' | 'tiff'
export type InspectorTab = 'inspect' | 'treatments' | 'layers' | 'assets' | 'layout' | 'print'
export type StrokeDashPreset = 'solid' | 'dashed' | 'dotted'
export type ExportBackground = 'paper' | 'white' | 'transparent'

export type SelectedState = {
  id: string
  kind: LayerKind
  name: string
  left: number
  top: number
  angle: number
  opacity: number
  scaleX: number
  scaleY: number
  visible: boolean
  locked: boolean
  thumbnail?: string | null
  fontFamily?: string
  fontSize?: number
  fontWeight?: string | number
  charSpacing?: number
  lineHeight?: number
  text?: string
  fill?: string
  skewX?: number
  skewY?: number
  blendMode?: string
  stroke?: string
  strokeWidth?: number
}
