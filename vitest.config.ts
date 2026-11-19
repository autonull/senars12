import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  // Prefer oxc transformer (much faster than esbuild); target matches Node runtime
  oxc: {
    target: 'node26',
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // E2E needs live transports; run via `pnpm test:e2e:*` (sets VITEST_E2E=1)
      ...(process.env.VITEST_E2E ? [] : ['**/tests/e2e/**']),
    ],
    setupFiles: ['./tests/setup/vitest-setup.ts'],
    testTimeout: 15000,
    teardownTimeout: 5000,
    coverage: { provider: 'v8', reporter: ['text', 'json', 'html'] },
    // Forks pool for E2E (native modules); threads for unit tests (shared module cache).
    pool: process.env.VITEST_E2E ? 'forks' : 'threads',
    maxConcurrency: 16,
    // Isolation only for E2E; unit tests share module cache to avoid 354x import overhead.
    isolate: !!process.env.VITEST_E2E,
    // Cache transformed modules on disk; reuse across reruns/cold starts.
    fsModuleCache: true,
  },
});
