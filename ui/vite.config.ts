import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/client',
  base: '/',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: 5173,
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/test': { target: 'http://localhost:3000' },
    },
  },
});