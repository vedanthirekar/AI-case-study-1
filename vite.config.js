import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  build: {
    rollupOptions: {
      // Libraries change rarely; keep them in their own cacheable chunk.
      output: { manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'zustand', 'idb', '@tanstack/react-virtual'] } },
    },
  },
})
