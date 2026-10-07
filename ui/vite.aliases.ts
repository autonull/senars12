import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const coreSrc = resolve(root, '../core/src');

/**
 * One alias table for Vite, Vitest, and Storybook. These diverged — Storybook
 * pointed at `/home/me/senars12b/...`, and both the bare `spacegraphjs` and
 * `@senars/core` entries replaced by prefix, so a subpath import resolved to
 * `index.ts/lens-schema` instead of a file.
 */
export const resolveAliases = [
  { find: /^spacegraphjs$/, replacement: resolve(root, 'spacegraphjs7/src/index.ts') },
  { find: /^spacegraphjs\/(.*)$/, replacement: resolve(root, 'spacegraphjs7/src/$1') },
  { find: /^@senars\/core\/lens-schema$/, replacement: resolve(coreSrc, 'lens-schema.ts') },
  { find: '@senars/core', replacement: resolve(coreSrc, 'protocol/index.ts') },
];
