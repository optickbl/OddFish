import { defineConfig } from 'vite';

// GitHub Pages serves the site from /oddfish/. Override with ODDFISH_BASE for other hosts.
export default defineConfig({
  base: process.env.ODDFISH_BASE ?? '/oddfish/',
  // three.js (~156 kB gzipped) is its own lazy chunk, loaded after the first screen.
  build: { target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 700 },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
