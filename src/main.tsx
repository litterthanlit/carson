import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installTextTypographyRenderPatch } from './lib/textTypography'
import './index.css'
import App from './App.tsx'

installTextTypographyRenderPatch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
