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
  { find: '@senars/core/verify-derivation', replacement: resolve(coreSrc, 'verify-derivation.ts') },
  { find: '@senars/core/protocol', replacement: resolve(coreSrc, 'protocol/index.ts') },
  { find: '@senars/core/schemas', replacement: resolve(coreSrc, 'schemas/index.ts') },
  { find: '@senars/core/schemas/governance', replacement: resolve(coreSrc, 'schemas/governance.ts') },
  { find: '@senars/core/schemas/formalization', replacement: resolve(coreSrc, 'schemas/formalization.ts') },
  { find: '@senars/core/schemas/truth', replacement: resolve(coreSrc, 'schemas/truth.ts') },
  { find: '@senars/core/schemas/cognitive-events', replacement: resolve(coreSrc, 'schemas/cognitive-events.ts') },
  { find: '@senars/core/schemas/gate-io', replacement: resolve(coreSrc, 'schemas/gate-io.ts') },
  { find: '@senars/core/schemas/reasoning-budget', replacement: resolve(coreSrc, 'schemas/reasoning-budget.ts') },
  { find: '@senars/core/schemas/derivation-records', replacement: resolve(coreSrc, 'schemas/derivation-records.ts') },
  { find: '@senars/core/event-sink', replacement: resolve(coreSrc, 'event-sink.ts') },
  { find: '@senars/core/budget', replacement: resolve(coreSrc, 'budget.ts') },
  { find: '@senars/core/metta-port', replacement: resolve(coreSrc, 'metta-port.ts') },
  { find: '@senars/core/memory', replacement: resolve(coreSrc, 'memory/index.ts') },
  { find: '@senars/core/cortex', replacement: resolve(coreSrc, 'cortex/index.ts') },
  { find: '@senars/core/motor', replacement: resolve(coreSrc, 'motor/index.ts') },
  { find: '@senars/core/engine', replacement: resolve(coreSrc, 'engine/index.ts') },
  { find: '@senars/core/engine/base', replacement: resolve(coreSrc, 'engine/BaseEngine.ts') },
  { find: '@senars/core/bridge/chat-stream-handler', replacement: resolve(coreSrc, 'bridge/ChatStreamHandler.ts') },
  { find: '@senars/core/agent', replacement: resolve(coreSrc, 'agent/index.ts') },
  { find: '@senars/core', replacement: resolve(coreSrc, 'index.ts') },
];

console.log('resolveAliases loaded:', resolveAliases.length);
