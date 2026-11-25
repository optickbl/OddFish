import { defineConfig } from 'vite';

// GitHub Pages serves the site from /oddfish/. Override with ODDFISH_BASE for other hosts.
export default defineConfig({
  base: process.env.ODDFISH_BASE ?? '/oddfish/',
  build: { target: 'es2020', sourcemap: false },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
