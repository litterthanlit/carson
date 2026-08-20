import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    modulePreload: {
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          (dep) =>
            !/jspdf|html2canvas|purify|print-|FilterGallery|TextureGallery|CommandPalette|OnboardingModal|VariantCompare/.test(
              dep,
            ),
        ),
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/fabric')) return 'fabric'
          if (id.includes('node_modules/jspdf')) return 'jspdf'
        },
      },
    },
  },
})
