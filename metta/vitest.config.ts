import {defineConfig} from 'vitest/config';

export default defineConfig({
    oxc: {
        target: 'node26',
    },
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        globals: true,
        maxConcurrency: 16,
        isolate: false,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json'],
            include: ['src/**/*.ts'],
        },
    },
});
