import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  // Set VITE_BASE_PATH=/REPO_NAME/ for GitHub Pages (e.g. /TSNet-ts/)
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tsnet-ts/ts-net': path.resolve(__dirname, '../TSNET-TS/src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    exclude: ['@tsnet-ts/ts-net'],
  },
})
