import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
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
  renderOriginalPreview,
  yieldToMain,
} from '../lib/filterPreview'
import { filterStateForCategory, loadFilterGalleryState, saveFilterGalleryState } from '../lib/galleryMemory'
import { CategoryChips } from './CategoryChips'
import { Slider } from './Slider'
import { GalleryDialog } from './GalleryDialog'
import { handleGridKeyDown } from './gridNavigation'

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
  // Reopen on the last filter and settings, as long as that filter still fits this layer.
  const [initial] = useState(() => loadFilterGalleryState(selectedIsImage))
  const [category, setCategory] = useState<FilterCategory>(initial.category)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(initial.presetId)
  const [params, setParams] = useState<Record<string, number>>(initial.params)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({})
  const [previewLoading, setPreviewLoading] = useState(false)
  // Before/after: the unfiltered layer, shown while "Original" is held (or toggled on by keyboard).
  const [originalUrl, setOriginalUrl] = useState<string | null>(null)
  const [showOriginal, setShowOriginal] = useState(false)
  // Only the newest preview request may write state; slower, older renders are dropped.
  const previewRequestRef = useRef(0)

  const categoryPresets = useMemo(() => presetsForCategory(category), [category])
  const categoryLabel = FILTER_CATEGORIES.find((item) => item.id === category)?.label ?? category
  const selectedPreset = useMemo(
    () => categoryPresets.find((preset) => preset.id === selectedPresetId) ?? categoryPresets[0] ?? null,
    [categoryPresets, selectedPresetId],
  )

  const selectPreset = useCallback((preset: FilterPreset) => {
    setSelectedPresetId(preset.id)
    setParams({ ...preset.defaultParams })
  }, [])

  const selectCategory = (next: FilterCategory) => {
    const state = filterStateForCategory(next, selectedIsImage)
    setCategory(state.category)
    setSelectedPresetId(state.presetId)
    setParams(state.params)
  }

  useEffect(() => {
    if (!selectedPreset) return
    saveFilterGalleryState({
      category,
      presetId: selectedPreset.id,
      params: mergePresetParams(selectedPreset, params),
    })
  }, [category, selectedPreset, params])

  useEffect(() => {
    if (!open) return
    clearFilterPreviewCache()
    setThumbUrls({})
    setPreviewUrl(null)
    setOriginalUrl(null)
    setShowOriginal(false)
  }, [open, source])

  // Fetched up front so pressing "Original" swaps at once; it is the raster the previews share.
  useEffect(() => {
    if (!open || !source) return
    let cancelled = false
    renderOriginalPreview(source, PREVIEW_PX)
      .then((url) => {
        if (!cancelled) setOriginalUrl(url)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
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

  if (!open) return null

  // Pointer and touch press-and-hold to peek. A click with no pointer behind it (`detail` 0: Space,
  // Enter, a screen reader's activate) toggles instead, and blur always lets go.
  const holdOriginal = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setShowOriginal(true)
  }
  const releaseOriginal = () => setShowOriginal(false)
  const toggleOriginal = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) setShowOriginal((current) => !current)
  }
  // Enter clicks on every key repeat; holding it should not flicker.
  const ignoreRepeat = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault()
  }

  const canApply = Boolean(source && selectedPreset && isPresetApplicable(selectedPreset, selectedIsImage))

  return (
    <GalleryDialog labelledBy="filter-gallery-title" className="filter-gallery-modal" onClose={onClose}>
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
            <CategoryChips items={FILTER_CATEGORIES} active={category} ariaLabel="Filter categories" onSelect={selectCategory} />

            <div
              className="filter-gallery-thumbs"
              role="listbox"
              aria-label={`${categoryLabel} filters`}
              onKeyDown={(event) =>
                handleGridKeyDown(event, (index) => {
                  const preset = categoryPresets[index]
                  if (preset) selectPreset(preset)
                })
              }
            >
              {categoryPresets.map((preset) => {
                const disabled = !isPresetApplicable(preset, selectedIsImage)
                const active = selectedPreset?.id === preset.id
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    aria-disabled={disabled || undefined}
                    aria-describedby={disabled ? 'filter-gallery-needs-image' : undefined}
                    tabIndex={active ? 0 : -1}
                    className={`filter-gallery-thumb asset-thumb${active ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                    title={disabled ? 'Requires an image layer' : preset.name}
                    onClick={() => selectPreset(preset)}
                  >
                    {thumbUrls[preset.id] ? (
                      <span className="gallery-thumb-media filter-gallery-thumb-paper">
                        <img src={thumbUrls[preset.id]} alt="" style={{ mixBlendMode: previewBlendMode(preset) }} />
                      </span>
                    ) : (
                      <span className="gallery-thumb-media filter-gallery-thumb-placeholder" aria-hidden />
                    )}
                    <span>{preset.name}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className="filter-gallery-preview">
            {previewLoading ? <p className="hint filter-gallery-preview-status">Updating preview…</p> : null}
            {showOriginal && originalUrl ? (
              <img src={originalUrl} alt="Original layer, without the filter" />
            ) : previewUrl ? (
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
            {showOriginal ? (
              <span className="filter-gallery-original-badge" aria-hidden>
                Original
              </span>
            ) : null}
            <button
              type="button"
              className="filter-gallery-original"
              aria-pressed={showOriginal}
              title="Hold to compare with the layer before the filter"
              disabled={!originalUrl}
              onPointerDown={holdOriginal}
              onPointerUp={releaseOriginal}
              onPointerCancel={releaseOriginal}
              onLostPointerCapture={releaseOriginal}
              onBlur={releaseOriginal}
              onClick={toggleOriginal}
              onKeyDown={ignoreRepeat}
              onContextMenu={(event) => event.preventDefault()}
            >
              Original
            </button>
          </div>

          <aside className="filter-gallery-params">
            {selectedPreset ? (
              <>
                <h3>{selectedPreset.name}</h3>
                {selectedPreset.description ? <p className="hint">{selectedPreset.description}</p> : null}
                {!isPresetApplicable(selectedPreset, selectedIsImage) ? (
                  <p className="hint filter-gallery-unavailable">
                    Needs an image layer. Select a photo or placed image to use this filter.
                  </p>
                ) : null}
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
      <p id="filter-gallery-needs-image" hidden>
        Needs an image layer.
      </p>
    </GalleryDialog>
  )
}
