import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LucideProvider } from 'lucide-react'
import { installTextTypographyRenderPatch } from './lib/textTypography'
import { installFabricDefaults } from './lib/fabricDefaults'
import { installLayerStyleRenderPatch } from './lib/layerStyles'
import { installImageSrcCache } from './lib/historySnapshot'
import { applyTheme, resolveInitialTheme } from './lib/theme'
import { installWarpRenderPatch } from './lib/warpRender'
import '@fontsource-variable/inter/opsz.css'
import './index.css'
import App from './App.tsx'

applyTheme(resolveInitialTheme())
installFabricDefaults()
installLayerStyleRenderPatch()
// After layer styles: warped sources include shadows/glows/outlines.
installWarpRenderPatch()
installImageSrcCache()
installTextTypographyRenderPatch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Thin 1.5px outline icons across the UI; quieter than lucide's 2px default. */}
    <LucideProvider strokeWidth={1.5}>
      <App />
    </LucideProvider>
  </StrictMode>,
)
