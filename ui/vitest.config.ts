import { defineConfig } from 'vitest/config';
import { resolveAliases } from './vite.aliases.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreSrc = resolve(__dirname, '../core/src');

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
  resolve: {
    alias: resolveAliases,
  },
  optimizeDeps: {
    exclude: ['@senars/nar', '@senars/core', '@senars/util'],
  },
  plugins: [
    {
      name: 'resolve-core-imports',
      transform(code, id) {
        // Rewrite @senars/core imports in nar package files
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
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
