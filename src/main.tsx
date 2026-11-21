import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { LucideProvider } from 'lucide-react'
import { installTextTypographyRenderPatch } from './lib/textTypography'
import { installFabricDefaults } from './lib/fabricDefaults'
import { installTextClickBehavior } from './lib/textClickBehavior'
import { installLayerStyleRenderPatch } from './lib/layerStyles'
import { installImageSrcCache } from './lib/historySnapshot'
import { applyTheme, resolveInitialTheme } from './lib/theme'
import { installWarpRenderPatch } from './lib/warpRender'
import '@fontsource-variable/inter/opsz.css'
import './index.css'
import App from './App.tsx'

applyTheme(resolveInitialTheme())
installFabricDefaults()
installTextClickBehavior()
installLayerStyleRenderPatch()
// After layer styles: warped sources include shadows/glows/outlines.
installWarpRenderPatch()
installImageSrcCache()
installTextTypographyRenderPatch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* Tactile 1.75px outline icons across the studio; clear at 14–18px. */}
    <LucideProvider strokeWidth={1.75}>
      <App />
    </LucideProvider>
  </StrictMode>,
)
