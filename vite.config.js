import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  base: './',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'TraceScope',
      formats: ['es', 'cjs', 'umd'],
      fileName: (format) => {
        if (format === 'es') return 'index.mjs'
        if (format === 'cjs') return 'index.cjs'
        return 'index.umd.js'
      }
    },
    rollupOptions: {
      output: {
        assetFileNames: 'trace-scope.[ext]'
      }
    }
  }
})
