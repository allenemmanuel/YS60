import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Tests must never touch the real event.
    env: { VITE_EVENT_ID: 'ys60-test' },
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
})
