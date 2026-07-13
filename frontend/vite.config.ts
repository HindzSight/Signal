import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// The dashboard talks to the local Node backend (src/server.js) on :8787.
// In dev we proxy the API, the SSE stream, the public share routes, and the
// server-rendered recipient stylesheet so the React app behaves exactly like prod.
const BACKEND = 'http://127.0.0.1:8787';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      // NOTE: keep '/s/' with the trailing slash — a bare '/s' prefix-matches
      // Vite's own '/src/*' module requests and breaks the whole dev server.
      '/api': { target: BACKEND, changeOrigin: true },
      '/s/': { target: BACKEND, changeOrigin: true },
      '/style.css': { target: BACKEND, changeOrigin: true },
      '/public-recipient.js': { target: BACKEND, changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
