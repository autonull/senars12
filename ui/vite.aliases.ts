import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const contractSrc = resolve(root, '../ui-contract/src');
const shellSrc = resolve(root, '../ui-shell/src');
const consolidatedSrc = resolve(root, '../src');

/**
 * One alias table for Vite, Vitest, and Storybook.
 * Updated for consolidated src/ structure (core, util, io, metta, nar packages removed).
 */
export const resolveAliases = [
  { find: /^spacegraphjs$/, replacement: resolve(root, 'spacegraphjs7/src/index.ts') },
  { find: /^spacegraphjs\/(.*)$/, replacement: resolve(root, 'spacegraphjs7/src/$1') },
  { find: /^@senars\/core\/lens-schema$/, replacement: resolve(consolidatedSrc, 'protocol/lens-schema.ts') },
  { find: '@senars/core/verify-derivation', replacement: resolve(consolidatedSrc, 'eval/verify-derivation.ts') },
  { find: '@senars/core/protocol', replacement: resolve(consolidatedSrc, 'protocol/index.ts') },
  { find: '@senars/core/schemas', replacement: resolve(consolidatedSrc, 'schemas/index.ts') },
  { find: '@senars/core/schemas/governance', replacement: resolve(consolidatedSrc, 'schemas/governance.ts') },
  { find: '@senars/core/schemas/formalization', replacement: resolve(consolidatedSrc, 'schemas/formalization.ts') },
  { find: '@senars/core/schemas/truth', replacement: resolve(consolidatedSrc, 'schemas/truth.ts') },
  { find: '@senars/core/schemas/cognitive-events', replacement: resolve(consolidatedSrc, 'schemas/cognitive-events.ts') },
  { find: '@senars/core/schemas/gate-io', replacement: resolve(consolidatedSrc, 'schemas/gate-io.ts') },
  { find: '@senars/core/schemas/reasoning-budget', replacement: resolve(consolidatedSrc, 'schemas/reasoning-budget.ts') },
  { find: '@senars/core/schemas/derivation-records', replacement: resolve(consolidatedSrc, 'schemas/derivation-records.ts') },
  { find: '@senars/core/event-sink', replacement: resolve(consolidatedSrc, 'agent/event-sink.ts') },
  { find: '@senars/core/budget', replacement: resolve(consolidatedSrc, 'budget/index.ts') },
  { find: '@senars/core/metta-port', replacement: resolve(consolidatedSrc, 'agent/metta-port.ts') },
  { find: '@senars/core/memory', replacement: resolve(consolidatedSrc, 'memory/index.ts') },
  { find: '@senars/core/cortex', replacement: resolve(consolidatedSrc, 'cortex/index.ts') },
  { find: '@senars/core/motor', replacement: resolve(consolidatedSrc, 'motor/index.ts') },
  { find: '@senars/core/engine', replacement: resolve(consolidatedSrc, 'engine/index.ts') },
  { find: '@senars/core/engine/base', replacement: resolve(consolidatedSrc, 'engine/BaseEngine.ts') },
  { find: '@senars/core/bridge/chat-stream-handler', replacement: resolve(consolidatedSrc, 'bridge/ChatStreamHandler.ts') },
  { find: '@senars/core/agent', replacement: resolve(consolidatedSrc, 'agent/index.ts') },
  { find: '@senars/core', replacement: resolve(consolidatedSrc, 'index.ts') },
  { find: /^@senars\/ui-shell\/framework$/, replacement: resolve(shellSrc, 'framework/index.ts') },
  { find: /^@senars\/ui-shell\/core$/, replacement: resolve(shellSrc, 'core/index.ts') },
  { find: '@senars/ui-shell', replacement: resolve(shellSrc, 'index.ts') },
  { find: /^@senars\/ui-contract\/modulation$/, replacement: resolve(contractSrc, 'modulation/index.ts') },
  { find: /^@senars\/ui-contract\/framework$/, replacement: resolve(contractSrc, 'framework/index.ts') },
  { find: /^@senars\/ui-contract\/core$/, replacement: resolve(contractSrc, 'core/index.ts') },
  { find: '@senars/ui-contract', replacement: resolve(contractSrc, 'index.ts') },
];
