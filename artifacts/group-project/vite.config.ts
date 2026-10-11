import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Production serves the module from https://perspeakai.cn/group-project/.
  // Local development keeps the root path so the existing Vite workflow works.
  base: process.env.GROUP_PROJECT_BASE || '/',
  plugins: [react()],
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
})
