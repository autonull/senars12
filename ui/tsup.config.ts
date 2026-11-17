import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server/index.ts'],
  outDir: 'dist/server',
  format: 'esm',
  target: 'es2022',
  clean: true,
  // Vite 8 imports its optional devtools config dynamically. The server build
  // bundles Vite, but not the devtools; leave the optional import to runtime.
  external: ['@vitejs/devtools/config'],
});
