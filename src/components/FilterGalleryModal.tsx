import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { FabricObject } from 'fabric'
import {
  FILTER_CATEGORIES,
  formatFilterParam,
  isPresetApplicable,
  mergePresetParams,
  presetsForCategory,
  type FilterCategory,
  type FilterPreset,
} from '../lib/filterGallery'
import {
  clearFilterPreviewCache,
  debounce,
  previewBlendMode,
  renderFilterPreview,
  yieldToMain,
} from '../lib/filterPreview'
import { Slider } from './Slider'
import { handleGalleryKeyDown } from './galleryKeys'

/** Long side of rendered previews, in device pixels (thumbs show at 72 CSS px). */
const THUMB_PX = 144
const PREVIEW_PX = 640

export type FilterGalleryModalProps = {
  open: boolean
  source: FabricObject | null
  selectedIsImage: boolean
  onApply: (preset: FilterPreset, params: Record<string, number>) => void
  onClose: () => void
}

export function FilterGalleryModal({
  open,
  source,
  selectedIsImage,
  onApply,
  onClose,
}: FilterGalleryModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const [category, setCategory] = useState<FilterCategory>('blur')
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [params, setParams] = useState<Record<string, number>>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  // Only the newest preview request may write state; slower, older renders are dropped.
  const previewRequestRef = useRef(0)

  const categoryPresets = useMemo(() => presetsForCategory(category), [category])
  const selectedPreset = useMemo(
    () => categoryPresets.find((preset) => preset.id === selectedPresetId) ?? categoryPresets[0] ?? null,
    [categoryPresets, selectedPresetId],
  )

  const selectPreset = useCallback((preset: FilterPreset) => {
    setSelectedPresetId(preset.id)
    setParams({ ...preset.defaultParams })
  }, [])

  useEffect(() => {
    if (!open) return
    const firstApplicable = categoryPresets.find((preset) => isPresetApplicable(preset, selectedIsImage))
    if (firstApplicable) selectPreset(firstApplicable)
  }, [open, category, categoryPresets, selectedIsImage, selectPreset])

  useEffect(() => {
    if (!open) return
    clearFilterPreviewCache()
    setThumbUrls({})
    setPreviewUrl(null)
  }, [open, source])

  useEffect(() => {
    if (!open || !source) return
    let cancelled = false
    const presets = categoryPresets.filter((preset) => isPresetApplicable(preset, selectedIsImage))

    void (async () => {
      for (const preset of presets) {
        if (cancelled) return
        try {
          const url = await renderFilterPreview(source, preset, preset.defaultParams, THUMB_PX)
          if (cancelled) return
          setThumbUrls((current) => (current[preset.id] === url ? current : { ...current, [preset.id]: url }))
        } catch {
          // Preview generation can fail for unsupported layer types.
        }
        await yieldToMain()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, source, category, categoryPresets, selectedIsImage])

  const refreshPreview = useMemo(
    () =>
      debounce((requestId: number, preset: FilterPreset, nextParams: Record<string, number>, layer: FabricObject) => {
        const isLatest = () => previewRequestRef.current === requestId
        void renderFilterPreview(layer, preset, nextParams, PREVIEW_PX)
          .then((url) => {
            if (isLatest()) setPreviewUrl(url)
          })
          .catch(() => {
            if (isLatest()) setPreviewUrl(null)
          })
          .finally(() => {
            if (isLatest()) setPreviewLoading(false)
          })
      }, 120),
    [],
  )

  useEffect(() => {
    if (!open || !source || !selectedPreset) return
    const requestId = ++previewRequestRef.current
    if (!isPresetApplicable(selectedPreset, selectedIsImage)) {
      refreshPreview.cancel()
      setPreviewUrl(null)
      setPreviewLoading(false)
      return
    }
    setPreviewLoading(true)
    refreshPreview(requestId, selectedPreset, params, source)
  }, [open, source, selectedPreset, selectedIsImage, params, refreshPreview])

  useEffect(
    () => () => {
      refreshPreview.cancel()
      previewRequestRef.current += 1
    },
    [refreshPreview],
  )

  useEffect(() => {
    if (open) dialogRef.current?.focus()
  }, [open])

  if (!open) return null

  const canApply = Boolean(source && selectedPreset && isPresetApplicable(selectedPreset, selectedIsImage))

  return (
    <div className="command-backdrop filter-gallery-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="filter-gallery-modal glass-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="filter-gallery-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => handleGalleryKeyDown(event, onClose)}
      >
        <header className="filter-gallery-header">
          <div>
            <h2 id="filter-gallery-title">Filter Gallery</h2>
            <p className="hint filter-gallery-lede">
              Blur, stylize, color, and film looks plus Carson print treatments. Live preview; applies as a removable stack.
            </p>
          </div>
          <button type="button" className="icon-button" aria-label="Close filter gallery" onClick={onClose}>
            <X size={16} />
          </button>
        </header>

        {!source ? (
          <p className="empty filter-gallery-empty">Select a layer first.</p>
        ) : (
          <div className="filter-gallery-layout">
            <aside className="filter-gallery-sidebar">
              <nav className="filter-gallery-categories" aria-label="Filter categories">
                {FILTER_CATEGORIES.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={category === item.id ? 'active' : undefined}
                    onClick={() => {
                      setCategory(item.id)
                      setSelectedPresetId(null)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="filter-gallery-thumbs" role="listbox" aria-label={`${category} filters`}>
                {categoryPresets.map((preset) => {
                  const disabled = !isPresetApplicable(preset, selectedIsImage)
                  const active = selectedPreset?.id === preset.id
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`filter-gallery-thumb asset-thumb${active ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                      disabled={disabled}
                      title={disabled ? 'Requires an image layer' : preset.name}
                      onClick={() => selectPreset(preset)}
                    >
                      {thumbUrls[preset.id] ? (
                        <span className="filter-gallery-thumb-paper">
                          <img src={thumbUrls[preset.id]} alt="" style={{ mixBlendMode: previewBlendMode(preset) }} />
                        </span>
                      ) : (
                        <div className="filter-gallery-thumb-placeholder" aria-hidden />
                      )}
                      <span>{preset.name}</span>
                    </button>
                  )
                })}
              </div>
            </aside>

            <div className="filter-gallery-preview">
              {previewLoading ? <p className="hint filter-gallery-preview-status">Updating preview…</p> : null}
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={selectedPreset ? `${selectedPreset.name} preview` : 'Filter preview'}
                  style={{ mixBlendMode: selectedPreset ? previewBlendMode(selectedPreset) : undefined }}
                />
              ) : (
                <div className="filter-gallery-preview-placeholder">
                  {selectedPreset && !isPresetApplicable(selectedPreset, selectedIsImage)
                    ? 'This filter needs an image layer.'
                    : 'Preview'}
                </div>
              )}
            </div>

            <aside className="filter-gallery-params">
              {selectedPreset ? (
                <>
                  <h3>{selectedPreset.name}</h3>
                  {selectedPreset.description ? <p className="hint">{selectedPreset.description}</p> : null}
                  {selectedPreset.treatmentType === 'fx' && !selectedIsImage ? (
                    <p className="hint">Type and shapes are snapshotted to an image layer so pixel filters can run. Undo restores the original.</p>
                  ) : null}
                  {selectedPreset.paramDefs.length === 0 ? (
                    <p className="hint">No adjustable parameters.</p>
                  ) : (
                    selectedPreset.paramDefs.map((param) => (
                      <Slider
                        key={param.key}
                        label={param.label}
                        value={params[param.key] ?? selectedPreset.defaultParams[param.key] ?? param.min}
                        defaultValue={selectedPreset.defaultParams[param.key]}
                        min={param.min}
                        max={param.max}
                        format={(value) => formatFilterParam(param, value)}
                        onChange={(value) => setParams((current) => ({ ...current, [param.key]: value }))}
                        onCommit={() => undefined}
                      />
                    ))
                  )}
                </>
              ) : null}

              <div className="button-row filter-gallery-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={!canApply}
                  onClick={() => {
                    if (!selectedPreset) return
                    onApply(selectedPreset, mergePresetParams(selectedPreset, params))
                    onClose()
                  }}
                >
                  Apply filter
                </button>
                <button type="button" onClick={onClose}>
                  Cancel
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}
