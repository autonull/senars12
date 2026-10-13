import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { resolveAliases } from './vite.aliases.js';

export default defineConfig({
  root: 'src/client',
  base: '/',
  resolve: {
    alias: resolveAliases,
  },
  build: {
    outDir: '../../dist/client',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/client/apps/ask/index.html'),
        hud: resolve(__dirname, 'src/client/apps/hud/index.html'),
        spacegraph: resolve(__dirname, 'src/client/spacegraph/index.html'),
        ask: resolve(__dirname, 'src/client/apps/ask/index.html'),
        explore: resolve(__dirname, 'src/client/apps/explore/index.html'),
        notebook: resolve(__dirname, 'src/client/apps/notebook/index.html'),
        goals: resolve(__dirname, 'src/client/apps/goals/index.html'),
        console: resolve(__dirname, 'src/client/apps/console/index.html'),
      },
      output: {
        manualChunks: (id) => {
          if (id.includes('cytoscape')) return 'cytoscape';
          if (id.includes('lit')) return 'lit';
          if (id.includes('three')) return 'three';
          if (id.includes('gsap')) return 'gsap';
          if (
            id.includes('marked') ||
            id.includes('marked-highlight') ||
            id.includes('highlight.js') ||
            id.includes('dompurify')
          )
            return 'vendor';
        },
      },
      preserveEntrySignatures: 'strict',
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
