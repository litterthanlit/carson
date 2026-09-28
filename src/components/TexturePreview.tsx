import { useEffect, useRef, useState } from 'react'
import { textureUrl, type TextureAsset } from '../lib/textureGallery'
import { drawTexturePreview, type PosterSnapshot, type TexturePreviewSettings } from '../lib/texturePreview'

const PREVIEW_LONG_SIDE = 900
const FALLBACK_POSTER = { width: 600, height: 800 }

type LoadedTexture = { id: string; element: HTMLImageElement; full: boolean }

export type TexturePreviewProps = {
  texture: TextureAsset
  posterSnapshot: PosterSnapshot | null
  settings: TexturePreviewSettings
  /** The full-size file is known to be absent; preview from the thumbnail. */
  missing: boolean
  onMissing: (id: string) => void
  label: string
}

function loadImage(src: string, onLoad: (element: HTMLImageElement) => void, onError?: () => void) {
  const element = new Image()
  element.decoding = 'async'
  element.onload = () => onLoad(element)
  if (onError) element.onerror = onError
  element.src = src
  return element
}

/**
 * Live composite of a texture over the poster: shows the thumbnail at once, swaps in the
 * full-size file when it arrives, and redraws on every blend, opacity, fit or monochrome change.
 */
export function TexturePreview({ texture, posterSnapshot, settings, missing, onMissing, label }: TexturePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [posterImage, setPosterImage] = useState<HTMLImageElement | null>(null)
  const [loaded, setLoaded] = useState<LoadedTexture | null>(null)

  useEffect(() => {
    if (!posterSnapshot) return
    let live = true
    loadImage(posterSnapshot.url, (element) => {
      if (live) setPosterImage(element)
    })
    return () => {
      live = false
    }
  }, [posterSnapshot])

  useEffect(() => {
    let live = true
    loadImage(textureUrl(texture.thumb), (element) => {
      // Never replace the full-size file with its thumbnail if the full one won the race.
      if (live) setLoaded((current) => (current?.id === texture.id && current.full ? current : { id: texture.id, element, full: false }))
    })
    if (!missing) {
      loadImage(
        textureUrl(texture.src),
        (element) => {
          if (live) setLoaded({ id: texture.id, element, full: true })
        },
        () => {
          if (live) onMissing(texture.id)
        },
      )
    }
    return () => {
      live = false
    }
  }, [texture, missing, onMissing])

  const poster = posterSnapshot ?? FALLBACK_POSTER
  const ratio = Math.min(1, PREVIEW_LONG_SIDE / Math.max(poster.width, poster.height))
  const width = Math.max(1, Math.round(poster.width * ratio))
  const height = Math.max(1, Math.round(poster.height * ratio))
  const current = loaded?.id === texture.id ? loaded : null

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !current) return
    drawTexturePreview(canvas, posterSnapshot ? posterImage : null, poster.width, poster.height, current.element, settings)
  }, [current, posterImage, posterSnapshot, poster.width, poster.height, settings, width, height])

  return (
    <canvas
      ref={canvasRef}
      className="texture-gallery-canvas"
      width={width}
      height={height}
      role="img"
      aria-label={label}
      data-source={current ? (current.full ? 'full' : 'thumb') : 'loading'}
    />
  )
}
