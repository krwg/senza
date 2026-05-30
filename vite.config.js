import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  base: './',
  publicDir: '../public',
  resolve: {
    alias: {
      '@glyph': resolve(__dirname, 'glyph-mi/js'),
    },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/index.html'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    root: __dirname,
    include: ['tests/**/*.test.js'],
  },
});
