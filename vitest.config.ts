import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['ui/**', 'node_modules/**'],
    environment: 'node',
    globals: true,
    alias: {
      '@senars/nar': new URL('./nar/src', import.meta.url).pathname,
      '@senars/agent': new URL('./agent/src', import.meta.url).pathname,
    },
  },
});
