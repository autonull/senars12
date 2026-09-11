import {defineConfig} from 'vitest/config';

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
            '**/benchmark/**',
            // E2E needs live transports; run via `pnpm test:e2e:*` (sets VITEST_E2E=1)
            ...(process.env.VITEST_E2E ? [] : ['**/tests/e2e/**']),
        ],
        setupFiles: ['./tests/setup/vitest-setup.ts'],
        testTimeout: 15000,
        teardownTimeout: 5000,
        coverage: {provider: 'v8', reporter: ['text', 'json', 'html']},
        pool: 'threads',
        maxConcurrency: 16,
        // Share modules across test files in same worker (~4s faster per vitest)
        isolate: false,
        // Cache transformed modules on disk; reuse across reruns/cold starts (slower transform phase)
        fsModuleCache: true,
    },
});
