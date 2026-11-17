import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/protocol/index.ts', 'src/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  target: 'es2020',
  clean: true,
  // tsup 9's dts plugin needs the TypeScript 6 compiler API; TypeScript 7 does
  // not ship it. `core/package.json` exports its types from source, so the
  // declaration bundle is not a consumer here.
  dts: false,
  external: [],
  noExternal: ['zod'],
});
