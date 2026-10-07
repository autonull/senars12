import { defineConfig } from 'vitest/config';
import { resolveAliases } from './vite.aliases.js';

export default defineConfig({
  resolve: {
    alias: resolveAliases,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
  },
});
