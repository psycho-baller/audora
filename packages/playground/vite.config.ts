import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    jsx: 'automatic'
  },
  server: {
    host: '127.0.0.1',
    port: 4176,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8765',
        changeOrigin: true
      }
    }
  },
  preview: {
    host: '127.0.0.1',
    port: 4176
  }
});
