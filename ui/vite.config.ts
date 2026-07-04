import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: 'src/client',
  base: '/',
  resolve: {
    alias: {
      spacegraphjs: resolve(__dirname, 'spacegraphjs7/src/index.ts'),
    },
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/client/index.html'),
        spacegraph: resolve(__dirname, 'src/client/spacegraph/index.html'),
      },
      output: {
        manualChunks: {
          cytoscape: ['cytoscape'],
          lit: ['lit'],
          three: ['three'],
          gsap: ['gsap'],
          vendor: ['marked', 'marked-highlight', 'highlight.js', 'dompurify'],
        },
      },
    },
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        drop_debugger: true,
      },
    },
  },
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
    port: 5173,
    hmr: { port: 5173 },
    proxy: {
      '/ws': { target: 'ws://localhost:3000', ws: true },
      '/test': { target: 'http://localhost:3000' },
    },
  },
});