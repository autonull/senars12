import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      spacegraphjs: resolve(__dirname, 'spacegraphjs7/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules/**', 'tests/scenarios/**', 'tests/**/*.bench.ts'],
    environment: 'node',
    globals: true,
    benchmark: {
      include: ['ui/tests/**/*.bench.ts'],
    },
  },
});
