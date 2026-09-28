import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export default defineConfig({
  plugins: [react()],
  // Keep Vite's cache out of OneDrive-synced folders (OneDrive locks it and breaks startup).
  cacheDir: join(tmpdir(), 'onecase-vite-cache'),
  server: {
    port: 5173,
    host: true, // also reachable from phones on the same Wi-Fi
    proxy: { '/api': 'http://localhost:8787' },
  },
})
