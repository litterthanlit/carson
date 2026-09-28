import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { Slider } from './Slider'
import { GalleryDialog } from './GalleryDialog'
import { handleGridKeyDown } from './gridNavigation'
import {
  TEXTURE_ASSETS,
  TEXTURE_BLEND_MODES,
  populatedTextureCategories,
  texturesForCategory,
  textureUrl,
  type TextureAsset,
  type TextureCategory,
  type TextureFit,
} from '../lib/textureGallery'
import {
  TEXTURE_OPACITY_MAX,
  TEXTURE_OPACITY_MIN,
  loadTextureGalleryState,
  missingTextureIds,
  saveTextureGalleryState,
  textureDefaults,
} from '../lib/galleryMemory'

export type TexturePlacement = {
  texture: TextureAsset
  blend: string
  opacity: number
  fit: TextureFit
}

export type TextureGalleryModalProps = {
  open: boolean
  /** Resolves once the texture is on the canvas; rejects if the file can't be loaded. */
  onPlace: (placement: TexturePlacement) => Promise<void>
  onClose: () => void
}

export function TextureGalleryModal({ open, onPlace, onClose }: TextureGalleryModalProps) {
  const categories = useMemo(() => populatedTextureCategories(), [])
  // Reopen on the last texture with the blend, opacity and fit chosen for it.
  const [initial] = useState(() => loadTextureGalleryState(categories))
  const [category, setCategory] = useState<TextureCategory>(initial.category)
  const [selectedId, setSelectedId] = useState<string | null>(initial.textureId)
  const [blend, setBlend] = useState(initial.blend)
  const [opacity, setOpacity] = useState(initial.opacity)
  const [fit, setFit] = useState<TextureFit>(initial.fit)
  // Full-resolution rasters are gitignored, so a clone or deploy can list textures whose files are absent.
  const [missingIds, setMissingIds] = useState<ReadonlySet<string>>(() => new Set(missingTextureIds))
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)

  const categoryTextures = useMemo(() => texturesForCategory(category), [category])
  const categoryLabel = categories.find((item) => item.id === category)?.label ?? category
  const selected = useMemo(
    () => categoryTextures.find((texture) => texture.id === selectedId) ?? categoryTextures[0] ?? null,
    [categoryTextures, selectedId],
  )

  const selectTexture = useCallback((texture: TextureAsset) => {
    const defaults = textureDefaults(texture)
    setSelectedId(defaults.textureId)
    setBlend(defaults.blend)
    setOpacity(defaults.opacity)
    setFit(defaults.fit)
    setPlaceError(null)
  }, [])

  const selectCategory = (next: TextureCategory) => {
    setCategory(next)
    const first = texturesForCategory(next)[0]
    if (first) selectTexture(first)
    else setSelectedId(null)
  }

  const markMissing = useCallback((id: string) => {
    missingTextureIds.add(id)
    setMissingIds((current) => (current.has(id) ? current : new Set(current).add(id)))
  }, [])

  const place = async () => {
    if (!selected || placing) return
    setPlacing(true)
    setPlaceError(null)
    try {
      await onPlace({ texture: selected, blend, opacity: opacity / 100, fit })
      onClose()
    } catch {
      markMissing(selected.id)
      setPlaceError(`Couldn’t load “${selected.name}”.`)
    } finally {
      setPlacing(false)
    }
  }

  useEffect(() => {
    saveTextureGalleryState({ category, textureId: selected?.id ?? null, blend, opacity, fit })
  }, [category, selected, blend, opacity, fit])

  if (!open) return null

  const emptyLibrary = TEXTURE_ASSETS.length === 0
  const selectedMissing = selected ? missingIds.has(selected.id) : false

  return (
    <GalleryDialog
      labelledBy="texture-gallery-title"
      className="filter-gallery-modal texture-gallery-modal"
      onClose={onClose}
    >
      <header className="filter-gallery-header">
        <h2 id="texture-gallery-title">Texture Gallery</h2>
        <button type="button" className="icon-button" aria-label="Close texture gallery" onClick={onClose}>
          <X size={16} />
        </button>
      </header>

      {emptyLibrary ? (
        <p className="empty filter-gallery-empty">
          No textures imported yet. Run <code>npm run import-textures</code> to load your library.
        </p>
      ) : (
        <div className="filter-gallery-layout">
          <aside className="filter-gallery-sidebar">
            <nav className="filter-gallery-categories" aria-label="Texture categories">
              {categories.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={category === item.id ? 'active' : undefined}
                  aria-pressed={category === item.id}
                  onClick={() => selectCategory(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            <div
              className="filter-gallery-thumbs"
              role="listbox"
              aria-label={`${categoryLabel} textures`}
              onKeyDown={(event) =>
                handleGridKeyDown(event, (index) => {
                  const texture = categoryTextures[index]
                  if (texture) selectTexture(texture)
                })
              }
            >
              {categoryTextures.map((texture) => {
                const active = selected?.id === texture.id
                return (
                  <button
                    key={texture.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    tabIndex={active ? 0 : -1}
                    className={`filter-gallery-thumb asset-thumb${active ? ' active' : ''}`}
                    title={texture.name}
                    onClick={() => selectTexture(texture)}
                  >
                    <span className="gallery-thumb-media">
                      <img src={textureUrl(texture.thumb)} alt="" loading="lazy" decoding="async" />
                    </span>
                    <span>{texture.name}</span>
                  </button>
                )
              })}
            </div>
          </aside>

          <div className={`filter-gallery-preview texture-gallery-preview${selected?.hasAlpha ? ' checker' : ''}`}>
            {selected && !selectedMissing ? (
              <img
                key={selected.id}
                src={textureUrl(selected.src)}
                alt={selected.name}
                onError={() => markMissing(selected.id)}
              />
            ) : selected ? (
              <div className="filter-gallery-preview-placeholder texture-gallery-missing">
                <p>
                  Full-resolution file isn’t installed.
                  <br />
                  Run <code>npm run import-textures</code> to load your library.
                </p>
              </div>
            ) : (
              <div className="filter-gallery-preview-placeholder">Preview</div>
            )}
          </div>

          <aside className="filter-gallery-params">
            {selected ? (
              <>
                <h3>{selected.name}</h3>
                <label>
                  Blend
                  <select value={blend} onChange={(event) => setBlend(event.target.value)}>
                    {TEXTURE_BLEND_MODES.map((mode) => (
                      <option key={mode.value} value={mode.value}>
                        {mode.label}
                      </option>
                    ))}
                  </select>
                </label>
                <Slider
                  label="Opacity"
                  value={opacity}
                  min={TEXTURE_OPACITY_MIN}
                  max={TEXTURE_OPACITY_MAX}
                  onChange={setOpacity}
                  onCommit={() => undefined}
                />
                <div className="preset-row">
                  <button
                    type="button"
                    className={fit === 'cover' ? 'active' : undefined}
                    onClick={() => setFit('cover')}
                  >
                    Cover poster
                  </button>
                  <button
                    type="button"
                    className={fit === 'layer' ? 'active' : undefined}
                    onClick={() => setFit('layer')}
                  >
                    Place as layer
                  </button>
                </div>
              </>
            ) : null}

            {placeError ? (
              <p className="hint texture-gallery-error" role="alert">
                {placeError}
              </p>
            ) : null}

            <div className="button-row filter-gallery-actions">
              <button
                type="button"
                className="primary-button"
                disabled={!selected || selectedMissing || placing}
                aria-busy={placing}
                onClick={() => void place()}
              >
                {placing ? 'Placing…' : 'Place texture'}
              </button>
              <button type="button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </aside>
        </div>
      )}
    </GalleryDialog>
  )
}
