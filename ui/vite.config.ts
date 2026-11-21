import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { resolveAliases } from './vite.aliases.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const nodeBuiltinShim = resolve(__dirname, 'src/client/shims/node-builtins.ts');

const nodeBuiltinAliases = [
  { find: /^node:path$/, replacement: nodeBuiltinShim },
  { find: /^node:fs$/, replacement: nodeBuiltinShim },
  { find: /^node:fs\/promises$/, replacement: nodeBuiltinShim },
  { find: /^node:crypto$/, replacement: nodeBuiltinShim },
  { find: /^node:util$/, replacement: nodeBuiltinShim },
];

export default defineConfig({
  root: 'src/client',
  base: '/',
  resolve: {
    alias: [...resolveAliases, ...nodeBuiltinAliases],
  },
  plugins: [
    {
      name: 'resolve-core-imports',
      resolveId(source, importer) {
        // Skip nar package entirely for client build
        if (source === '@senars/nar' || source.startsWith('@senars/nar/')) {
          return { id: source, external: true };
        }
        return null;
      },
    },
  ],
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
        lab: resolve(__dirname, 'src/client/apps/lab/index.html'),
        studio: resolve(__dirname, 'src/client/apps/studio/index.html'),
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
      external: (id) => id === '@senars/nar' || id.startsWith('@senars/nar/') || id.includes('/nar/src/') || id.includes('node-llama-cpp') || id.includes('@node-llama-cpp') || id.includes('ora') || id.includes('cli-cursor') || id.includes('signal-exit') || id.includes('cross-spawn') || id.includes('which') || id.includes('isexe') || id.includes('graceful-fs') || id.includes('fs-extra') || id.includes('jsonfile') || id.includes('proper-lockfile') || id.includes('simple-git') || id.includes('stdin-discarder') || id.includes('restore-cursor') || id.includes('ansi-escapes'),
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
