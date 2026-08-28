export type EditorTool = 'move' | 'text' | 'shape' | 'image' | 'mask' | 'instruments'
export type ShapeKind = 'rect' | 'ellipse' | 'line' | 'star' | 'pen'
export type MaskKind = 'clip' | 'brush' | 'scrape'

export type LayerKind = 'text' | 'image' | 'shape' | 'fragment' | 'group'
export type ExportFormat = 'png' | 'jpeg' | 'pdf' | 'tiff' | 'svg'
export type InspectorTab = 'inspect' | 'treatments' | 'layers' | 'assets' | 'layout' | 'print'
export type StrokeDashPreset = 'solid' | 'dashed' | 'dotted'
export type ExportBackground = 'paper' | 'white' | 'transparent'

export type OpenTypeFeatures = {
  kern: boolean
  liga: boolean
  smcp: boolean
}

export type TextSelectionRange = {
  start: number
  end: number
}

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
  textAlign?: 'left' | 'center' | 'right' | 'justify'
  fontStyle?: '' | 'normal' | 'italic' | 'oblique'
  underline?: boolean
  openTypeFeatures?: OpenTypeFeatures
  depth?: number
  parentId?: string | null
  componentId?: string
  overrideCount?: number
}
