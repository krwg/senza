import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:5176', changeOrigin: true },
    },
  },
});
