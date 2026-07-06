import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      spacegraphjs: resolve(__dirname, 'spacegraphjs7/src/index.ts'),
    },
  },
  test: {
    include: ['ui/tests/**/*.test.ts', 'ui/tests/**/*.bench.ts'],
    exclude: ['node_modules/**', 'ui/tests/scenarios/**'],
    environment: 'node',
    globals: true,
    benchmark: {
      include: ['ui/tests/**/*.bench.ts'],
    },
  },
});
