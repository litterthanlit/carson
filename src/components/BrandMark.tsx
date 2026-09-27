// Carson mark: a round C sliced into three strips, the middle one knocked
// out of register, like the Slice and Scatter tools do to type.
export function BrandMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 33 28" aria-hidden="true">
      <path d="M4.85 8A14 14 0 0 1 30.15 8H22A7.5 7.5 0 0 0 13 8Z" />
      <path d="M0.58 10A14 14 0 0 0 0.58 18H7.66A7.5 7.5 0 0 1 7.66 10Z" />
      <path d="M6.35 20A14 14 0 0 0 31.65 20H23.5A7.5 7.5 0 0 1 14.5 20Z" />
    </svg>
  )
}
