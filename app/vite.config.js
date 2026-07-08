import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // When the Functions API runs locally (func start in /api), proxy to it.
      // If it's not running, the client falls back to the in-browser mock.
      '/api': { target: 'http://localhost:7071', changeOrigin: true },
    },
    fs: { allow: ['..'] },
  },
})
