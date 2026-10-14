import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { resolveAliases } from './vite.aliases.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreSrc = resolve(__dirname, '../core/src');
const nodeBuiltinShim = resolve(__dirname, 'src/client/shims/node-builtins.ts');

const nodeBuiltinAliases = [
  { find: /^node:path$/, replacement: nodeBuiltinShim },
  { find: /^node:fs$/, replacement: nodeBuiltinShim },
  { find: /^node:fs\/promises$/, replacement: nodeBuiltinShim },
  { find: /^node:crypto$/, replacement: nodeBuiltinShim },
  { find: /^node:util$/, replacement: nodeBuiltinShim },
];

const coreSubpathMap: Record<string, string> = {
  'schemas/governance': 'schemas/governance.ts',
  'schemas/formalization': 'schemas/formalization.ts',
  'schemas/truth': 'schemas/truth.ts',
  'schemas/cognitive-events': 'schemas/cognitive-events.ts',
  'schemas/gate-io': 'schemas/gate-io.ts',
  'schemas/reasoning-budget': 'schemas/reasoning-budget.ts',
  'schemas/derivation-records': 'schemas/derivation-records.ts',
  'schemas': 'schemas/index.ts',
  'event-sink': 'event-sink.ts',
  'budget': 'budget.ts',
  'verify-derivation': 'verify-derivation.ts',
  'metta-port': 'metta-port.ts',
  'memory': 'memory/index.ts',
  'cortex': 'cortex/index.ts',
  'motor': 'motor/index.ts',
  'engine': 'engine/index.ts',
  'engine/base': 'engine/BaseEngine.ts',
  'bridge/chat-stream-handler': 'bridge/ChatStreamHandler.ts',
  'agent': 'agent/index.ts',
  'lens-schema': 'lens-schema.ts',
  'protocol': 'protocol/index.ts',
};

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
      transform(code, id) {
        // Rewrite @senars/core imports in nar package files (for tests)
        if (id.includes('/nar/src/') && code.includes('@senars/core')) {
          let transformed = code;
          for (const [subpath, filePath] of Object.entries(coreSubpathMap)) {
            const importPath = `@senars/core/${subpath}`;
            const resolvedPath = resolve(coreSrc, filePath);
            transformed = transformed.replaceAll(`"${importPath}"`, `"${resolvedPath}"`);
            transformed = transformed.replaceAll(`'${importPath}'`, `'${resolvedPath}'`);
          }
          // Handle bare @senars/core
          transformed = transformed.replaceAll('"@senars/core"', `"${resolve(coreSrc, 'index.ts')}"`);
          transformed = transformed.replaceAll("'@senars/core'", `'${resolve(coreSrc, 'index.ts')}'`);
          // Handle @senars/util
          transformed = transformed.replaceAll('"@senars/util"', `"${resolve(__dirname, '../util/src/index.ts')}"`);
          transformed = transformed.replaceAll("'@senars/util'", `'${resolve(__dirname, '../util/src/index.ts')}'`);
          return transformed;
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
      external: (id) => id === '@senars/nar' || id.startsWith('@senars/nar/') || id.includes('/nar/src/'),
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
