import { defineConfig } from 'vite'

// Separate Vite config for building the GitHub Pages demo.
// Output goes to docs/ so GitHub Pages can serve it from that folder.
export default defineConfig({
  base: '/event-lens/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    rollupOptions: {
      input: 'index.html',
    },
  },
})
