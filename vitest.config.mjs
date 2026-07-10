import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['tests/setup/vitest-setup.ts'],
    server: {
      deps: {
        inline: [
          '@senars/core',
          '@senars/io',
          '@senars/nar',
          '@senars/metta',
        ],
      },
    },
  },
  resolve: {
    alias: [
      { find: /^@senars\/core(?:\/.*)?$/, replacement: resolve(__dirname, './core/src/index.ts') },
      { find: /^@senars\/io(?:\/.*)?$/, replacement: resolve(__dirname, './io/src/index.ts') },
      { find: /^@senars\/nar(?:\/.*)?$/, replacement: resolve(__dirname, './nar/src/index.ts') },
      { find: /^@senars\/metta(?:\/.*)?$/, replacement: resolve(__dirname, './metta/src/index.ts') },
    ],
  },
});
