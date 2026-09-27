import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installTextTypographyRenderPatch } from './lib/textTypography'
import { installFabricDefaults } from './lib/fabricDefaults'
import { installLayerStyleRenderPatch } from './lib/layerStyles'
import { installImageSrcCache } from './lib/historySnapshot'
import './index.css'
import App from './App.tsx'

installFabricDefaults()
installLayerStyleRenderPatch()
installImageSrcCache()
installTextTypographyRenderPatch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
