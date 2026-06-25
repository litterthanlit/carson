import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import type { FabricObject } from 'fabric'
import {
  FILTER_CATEGORIES,
  isPresetApplicable,
  mergePresetParams,
  presetsForCategory,
  type FilterCategory,
  type FilterPreset,
} from '../lib/filterGallery'
import { clearFilterPreviewCache, debounce, renderFilterPreview } from '../lib/filterPreview'
import { Slider } from './Slider'

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
  const [category, setCategory] = useState<FilterCategory>('print')
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [params, setParams] = useState<Record<string, number>>({})
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({})
  const [previewLoading, setPreviewLoading] = useState(false)

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
      const next: Record<string, string> = {}
      for (const preset of presets) {
        if (cancelled) return
        try {
          next[preset.id] = await renderFilterPreview(source, preset, preset.defaultParams, 72)
        } catch {
          // Preview generation can fail for unsupported layer types.
        }
      }
      if (!cancelled) setThumbUrls(next)
    })()

    return () => {
      cancelled = true
    }
  }, [open, source, category, categoryPresets, selectedIsImage])

  const refreshPreview = useMemo(
    () =>
      debounce((preset: FilterPreset, nextParams: Record<string, number>, layer: FabricObject) => {
        if (!isPresetApplicable(preset, selectedIsImage)) {
          setPreviewUrl(null)
          return
        }
        setPreviewLoading(true)
        void renderFilterPreview(layer, preset, nextParams, 420)
          .then((url) => setPreviewUrl(url))
          .catch(() => setPreviewUrl(null))
          .finally(() => setPreviewLoading(false))
      }, 120),
    [selectedIsImage],
  )

  useEffect(() => {
    if (!open || !source || !selectedPreset) return
    refreshPreview(selectedPreset, params, source)
  }, [open, source, selectedPreset, params, refreshPreview])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    dialogRef.current?.focus()
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  const canApply = Boolean(source && selectedPreset && isPresetApplicable(selectedPreset, selectedIsImage))

  return (
    <div className="command-backdrop filter-gallery-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="filter-gallery-modal glass-panel"
        role="dialog"
        aria-labelledby="filter-gallery-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="filter-gallery-header">
          <h2 id="filter-gallery-title">Filter Gallery</h2>
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
                        <img src={thumbUrls[preset.id]} alt="" />
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
                <img src={previewUrl} alt="Filter preview" />
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
                  {selectedPreset.paramDefs.length === 0 ? (
                    <p className="hint">No adjustable parameters.</p>
                  ) : (
                    selectedPreset.paramDefs.map((param) => (
                      <Slider
                        key={param.key}
                        label={param.label}
                        value={params[param.key] ?? selectedPreset.defaultParams[param.key] ?? param.min}
                        min={param.min}
                        max={param.max}
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
