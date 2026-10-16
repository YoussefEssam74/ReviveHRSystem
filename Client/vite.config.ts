import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The API runs separately (e.g. http://localhost:5248) with no CORS policy;
    // the dev proxy keeps the SPA same-origin so no backend change is required.
    proxy: {
      '/api': {
        target: 'http://localhost:5248',
        changeOrigin: true,
      },
    },
  },
})