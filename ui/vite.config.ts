import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src/client',
  base: '/',
  resolve: {
    alias: {
      spacegraphjs: resolve(__dirname, 'spacegraphjs7/src/index.ts'),
      '@senars/core': resolve(__dirname, '../core/src/protocol/index.ts'),
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
  plugins: [
    {
      name: 'preserve-entry-side-effects',
      enforce: 'pre',
      resolveId(id, importer) {
        if (id.endsWith('entry.ts') || id === './entry.ts' || id.includes('entry.ts')) {
          return { id, moduleSideEffects: true };
        }
        return null;
      }
    },
    {
      name: 'inject-entry-import',
      enforce: 'post',
      generateBundle(options, bundle) {
        for (const [name, chunk] of Object.entries(bundle)) {
          if (chunk.type === 'chunk' && chunk.isEntry && chunk.fileName.startsWith('assets/main')) {
            chunk.code = `import './entry.ts';\n${chunk.code}`;
          }
        }
      }
    }
  ],
});