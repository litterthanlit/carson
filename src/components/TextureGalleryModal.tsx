import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { Slider } from './Slider'
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

export type TexturePlacement = {
  texture: TextureAsset
  blend: string
  opacity: number
  fit: TextureFit
}

export type TextureGalleryModalProps = {
  open: boolean
  onPlace: (placement: TexturePlacement) => void
  onClose: () => void
}

export function TextureGalleryModal({ open, onPlace, onClose }: TextureGalleryModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const categories = useMemo(() => populatedTextureCategories(), [])
  const [category, setCategory] = useState<TextureCategory>(categories[0]?.id ?? 'print')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [blend, setBlend] = useState('multiply')
  const [opacity, setOpacity] = useState(55)
  const [fit, setFit] = useState<TextureFit>('cover')

  const categoryTextures = useMemo(() => texturesForCategory(category), [category])
  const selected = useMemo(
    () => categoryTextures.find((texture) => texture.id === selectedId) ?? categoryTextures[0] ?? null,
    [categoryTextures, selectedId],
  )

  const selectTexture = useCallback((texture: TextureAsset) => {
    setSelectedId(texture.id)
    setBlend(texture.defaultBlend)
    setOpacity(Math.round(texture.defaultOpacity * 100))
    setFit(texture.hasAlpha ? 'layer' : 'cover')
  }, [])

  useEffect(() => {
    if (!open) return
    const first = categoryTextures[0]
    if (first) selectTexture(first)
  }, [open, category, categoryTextures, selectTexture])

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

  const emptyLibrary = TEXTURE_ASSETS.length === 0

  return (
    <div className="command-backdrop filter-gallery-backdrop" role="presentation" onClick={onClose}>
      <div
        ref={dialogRef}
        className="filter-gallery-modal texture-gallery-modal glass-panel"
        role="dialog"
        aria-labelledby="texture-gallery-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
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
                    onClick={() => {
                      setCategory(item.id)
                      setSelectedId(null)
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>

              <div className="filter-gallery-thumbs" role="listbox" aria-label={`${category} textures`}>
                {categoryTextures.map((texture) => {
                  const active = selected?.id === texture.id
                  return (
                    <button
                      key={texture.id}
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={`filter-gallery-thumb asset-thumb${active ? ' active' : ''}`}
                      title={texture.name}
                      onClick={() => selectTexture(texture)}
                    >
                      <img src={textureUrl(texture.thumb)} alt="" />
                      <span>{texture.name}</span>
                    </button>
                  )
                })}
              </div>
            </aside>

            <div className={`filter-gallery-preview texture-gallery-preview${selected?.hasAlpha ? ' checker' : ''}`}>
              {selected ? (
                <img src={textureUrl(selected.src)} alt={selected.name} />
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
                    min={8}
                    max={100}
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

              <div className="button-row filter-gallery-actions">
                <button
                  type="button"
                  className="primary-button"
                  disabled={!selected}
                  onClick={() => {
                    if (!selected) return
                    onPlace({
                      texture: selected,
                      blend,
                      opacity: opacity / 100,
                      fit,
                    })
                    onClose()
                  }}
                >
                  Place texture
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
