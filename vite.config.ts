import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  build: {
    manifest: true,
  },
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
