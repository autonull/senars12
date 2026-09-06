import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/benchmark/**', '**/tests/e2e/**'],
    setupFiles: ['./tests/setup/vitest-setup.ts'],
    testTimeout: 15000,
    teardownTimeout: 5000,
    coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
    transform: {
      useOxc: false,
    },
  },
  esbuild: {
    target: 'node20',
  },
});