import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/client',
  base: '/',
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          cytoscape: ['cytoscape'],
          lit: ['lit'],
          vendor: ['marked', 'marked-highlight', 'highlight.js', 'dompurify'],
        },
      },
    },
    // Target modern browsers for smaller bundles
    target: 'es2020',
    // Minify aggressively
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