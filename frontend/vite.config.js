import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    include: ['@stellar/stellar-sdk'],
  },
})
