import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/auth': { target: 'http://localhost:9999', changeOrigin: true, rewrite: (p) => p.replace(/^\/auth/, '') },
      '/rest': { target: 'http://localhost:3000', changeOrigin: true, rewrite: (p) => p.replace(/^\/rest/, '') },
    },
  },
})
