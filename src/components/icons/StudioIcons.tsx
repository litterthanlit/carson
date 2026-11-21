import type { SVGProps } from 'react'

export type StudioIconProps = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
  size?: number
  strokeWidth?: number
}

const baseProps = (size: number, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
})

/** Classic layer-mask glyph: frame with circular cutout. */
export function MaskIcon({ size = 18, strokeWidth = 1.75, ...rest }: StudioIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth)} {...rest}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" />
      <circle cx="12" cy="12" r="3.6" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Carson's graphic frame tool: bounding frame with crisp corner handles. */
export function FrameHandlesIcon({ size = 18, strokeWidth = 1.75, ...rest }: StudioIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth)} {...rest}>
      <rect x="5.5" y="5.5" width="13" height="13" />
      <rect x="3.5" y="3.5" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="17" y="3.5" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="3.5" y="17" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="17" y="17" width="3.5" height="3.5" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Graduated 3x3 halftone dot cluster for Carson's Effects / Print instruments drawer. */
export function EffectsPressIcon({ size = 18, ...rest }: StudioIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...rest}>
      <circle cx="6.5" cy="6.5" r="2.1" />
      <circle cx="12" cy="6.5" r="1.65" />
      <circle cx="17.5" cy="6.5" r="1.15" />
      <circle cx="6.5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="2.1" />
      <circle cx="17.5" cy="12" r="1.45" />
      <circle cx="6.5" cy="17.5" r="1.2" />
      <circle cx="12" cy="17.5" r="1.65" />
      <circle cx="17.5" cy="17.5" r="2.1" />
    </svg>
  )
}

/** Torn paper scrap glyph for fragment layers. */
export function FragmentLayerIcon({ size = 14, strokeWidth = 1.75, ...rest }: StudioIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth)} {...rest}>
      <path d="M5 4h14v11.5l-2.4-1.3-2.3 2.1-2.3-1.6-2.3 2-2.3-1.4L5 16.5V4Z" />
    </svg>
  )
}

/** Stacked poster proof sheets for "New version" (replaces developer GitFork). */
export function VersionProofIcon({ size = 14, strokeWidth = 1.75, ...rest }: StudioIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth)} {...rest}>
      <rect x="4" y="3.5" width="11.5" height="14.5" rx="1.5" />
      <path d="M15.5 7.5H18a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H9.5A1.5 1.5 0 0 1 8 19v-1" />
      <path d="M9.75 8.5v4.5M7.5 10.75H12" />
    </svg>
  )
}

/** Vertical column layout grid icon. */
export function ColumnGridIcon({ size = 14, strokeWidth = 1.75, ...rest }: StudioIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth)} {...rest}>
      <rect x="3.5" y="4" width="17" height="16" rx="1.75" />
      <line x1="9.25" y1="4.5" x2="9.25" y2="19.5" />
      <line x1="14.75" y1="4.5" x2="14.75" y2="19.5" />
    </svg>
  )
}

/** Horizontal baseline / row layout grid icon. */
export function RowGridIcon({ size = 14, strokeWidth = 1.75, ...rest }: StudioIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth)} {...rest}>
      <rect x="3.5" y="4" width="17" height="16" rx="1.75" />
      <line x1="4" y1="9.5" x2="20" y2="9.5" />
      <line x1="4" y1="14.5" x2="20" y2="14.5" />
    </svg>
  )
}

/** Tiny bottom-right corner disclosure triangle for tool-rail buttons with submenus. */
export function FlyoutCornerCaret({ className = 'tool-flyout-caret' }: { className?: string }) {
  return (
    <svg className={className} width="5" height="5" viewBox="0 0 5 5" fill="currentColor" aria-hidden="true" focusable="false">
      <polygon points="5,0 5,5 0,5" />
    </svg>
  )
}
