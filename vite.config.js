import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Proxy same-origin des images Refuges.info (pas de CORS côté source) pour le hash perceptuel.
    // En production, voir vercel.json.
    proxy: {
      '/rimg': {
        target: 'https://www.refuges.info',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rimg/, ''),
      },
    },
  },
})
