import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,           // ← change if 5173 is taken
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
