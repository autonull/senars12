import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/protocol/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'es2020',
  clean: true,
  dts: true,
  external: [],
  noExternal: ['zod'],
});
