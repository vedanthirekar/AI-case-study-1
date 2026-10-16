import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// In development, serve api/*.ts the way Vercel does in production, so the
// assistant works under `npm run dev` without the Vercel CLI.
function devApi() {
  return {
    name: 'dev-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''))
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([a-z-]+)/)
        if (!m) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`)
          const handler = mod[req.method ?? 'GET']
          if (!handler) { res.statusCode = 405; return res.end() }
          const chunks = []
          for await (const c of req) chunks.push(c)
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method, headers: req.headers, body: chunks.length ? Buffer.concat(chunks) : undefined,
          })
          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          if (!response.body) return res.end()
          const reader = response.body.getReader()
          for (;;) { const { done, value } = await reader.read(); if (done) break; res.write(value) }
          res.end()
        } catch (e) {
          server.config.logger.error(String(e?.stack ?? e))
          res.statusCode = 500; res.end(String(e?.message ?? e))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), devApi()],
  server: { port: 5173, open: true },
  build: {
    rollupOptions: {
      // Libraries change rarely; keep them in their own cacheable chunk.
      output: { manualChunks: { vendor: ['react', 'react-dom', 'react-router-dom', 'framer-motion', 'zustand', 'idb', '@tanstack/react-virtual'] } },
    },
  },
})
