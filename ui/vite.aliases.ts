import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const contractSrc = resolve(root, '../ui-contract/src');
const shellSrc = resolve(root, '../ui-shell/src');
const consolidatedSrc = resolve(root, '../src');

/**
 * One alias table for Vite, Vitest, and Storybook.
 * Updated for consolidated src/ structure (core, util, io, metta, nar packages removed).
 * Uses @senars/senars/client-safe for client-safe imports (no llama.cpp).
 * Matches tsconfig.json paths for @senars/util/* subpaths.
 * IMPORTANT: More specific aliases MUST come before general ones.
 */
const utilSrc = resolve(consolidatedSrc, 'util');
const configSrc = resolve(consolidatedSrc, 'config');
const bagSrc = resolve(consolidatedSrc, 'bag');
const eventsSrc = resolve(consolidatedSrc, 'events');
const errorsSrc = resolve(consolidatedSrc, 'errors');
const memorySrc = resolve(consolidatedSrc, 'memory');
const typesSrc = resolve(consolidatedSrc, 'types');
const schemasSrc = resolve(consolidatedSrc, 'schemas');
const protocolSrc = resolve(consolidatedSrc, 'protocol');

// All @senars/util/* subpaths from tsconfig.json + catch-all
const utilSubpaths = [
  // Explicit mappings from tsconfig
  { alias: '@senars/util/assert', path: 'assert.ts' },
  { alias: '@senars/util/bag', path: '../bag/index.ts' },
  { alias: '@senars/util/collections', path: 'collections.ts' },
  { alias: '@senars/util/config', path: '../config/index.ts' },
  { alias: '@senars/util/diagnostics', path: 'diagnostics.ts' },
  { alias: '@senars/util/errors', path: '../errors/index.ts' },
  { alias: '@senars/util/eval', path: 'eval.ts' },
  { alias: '@senars/util/events', path: '../events/index.ts' },
  { alias: '@senars/util/id', path: 'id.ts' },
  { alias: '@senars/util/ledger', path: 'ledger.ts' },
  { alias: '@senars/util/logger', path: 'logger.ts' },
  { alias: '@senars/util/lru-cache', path: 'lru-cache.ts' },
  { alias: '@senars/util/memory', path: '../memory/in-memory-session-manager.ts' },
  { alias: '@senars/util/numeric', path: 'numeric.ts' },
  { alias: '@senars/util/object', path: 'object.ts' },
  { alias: '@senars/util/random', path: 'random.ts' },
  { alias: '@senars/util/result', path: 'result.ts' },
  { alias: '@senars/util/tally', path: 'tally.ts' },
  { alias: '@senars/util/types/cognitive', path: '../types/cognitive.ts' },
  { alias: '@senars/util/types/memory', path: '../types/memory.ts' },
  { alias: '@senars/util/types/transport', path: '../types/transport.ts' },
  // Catch-all util/* -> util/*.ts
  { alias: '@senars/util/unify', path: 'unify.ts' },
  { alias: '@senars/util/truth-schema', path: 'truth-schema.ts' },
  { alias: '@senars/util/truth-algebra', path: 'truth-algebra.ts' },
  { alias: '@senars/util/similarity', path: 'similarity.ts' },
  { alias: '@senars/util/collections', path: 'collections.ts' },
  { alias: '@senars/util/bandit', path: 'bandit.ts' },
  { alias: '@senars/util/bounded-map', path: 'bounded-map.ts' },
  { alias: '@senars/util/capability-risk', path: 'capability-risk.ts' },
  { alias: '@senars/util/circuit-breaker', path: 'circuit-breaker.ts' },
  { alias: '@senars/util/cli', path: 'cli.ts' },
  { alias: '@senars/util/clock', path: 'clock.ts' },
  { alias: '@senars/util/cognitive-schemas', path: 'cognitive-schemas.ts' },
  { alias: '@senars/util/disposal', path: 'disposal.ts' },
  { alias: '@senars/util/divergence', path: 'divergence.ts' },
  { alias: '@senars/util/env-validate', path: 'env-validate.ts' },
  { alias: '@senars/util/error', path: 'error.ts' },
  { alias: '@senars/util/feedback', path: 'feedback.ts' },
  { alias: '@senars/util/format', path: 'format.ts' },
  { alias: '@senars/util/fs', path: 'fs.ts' },
  { alias: '@senars/util/guards', path: 'guards.ts' },
  { alias: '@senars/util/hash', path: 'hash.ts' },
  { alias: '@senars/util/health-status', path: 'health-status.ts' },
  { alias: '@senars/util/json', path: 'json.ts' },
  { alias: '@senars/util/keyed-collection', path: 'keyed-collection.ts' },
  { alias: '@senars/util/middleware', path: 'middleware.ts' },
  { alias: '@senars/util/origins', path: 'origins.ts' },
  { alias: '@senars/util/prompt', path: 'prompt.ts' },
  { alias: '@senars/util/rate-limit', path: 'rate-limit.ts' },
  { alias: '@senars/util/registry', path: 'registry.ts' },
  { alias: '@senars/util/retry', path: 'retry.ts' },
  { alias: '@senars/util/shutdown', path: 'shutdown.ts' },
  { alias: '@senars/util/stats', path: 'stats.ts' },
  { alias: '@senars/util/text', path: 'text.ts' },
  { alias: '@senars/util/witness', path: 'witness.ts' },
  { alias: '@senars/util/alphabet', path: 'alphabet.ts' },
  { alias: '@senars/util/async', path: 'async.ts' },
  { alias: '@senars/util/config-migrate', path: 'config-migrate.ts' },
];

export const resolveAliases = [
  { find: /^spacegraphjs$/, replacement: resolve(root, 'spacegraphjs7/src/index.ts') },
  { find: /^spacegraphjs\/(.*)$/, replacement: resolve(root, 'spacegraphjs7/src/$1') },
  // Client-safe core exports (no server-only deps)
  { find: /^@senars\/core\/lens-schema$/, replacement: resolve(consolidatedSrc, 'protocol/lens-schema.ts') },
  { find: '@senars/core/verify-derivation', replacement: resolve(consolidatedSrc, 'rules/verifier-truth-table.ts') },
  { find: '@senars/core/protocol', replacement: resolve(consolidatedSrc, 'protocol/index.ts') },
  { find: '@senars/core/schemas', replacement: resolve(consolidatedSrc, 'schemas/index.ts') },
  { find: '@senars/core/schemas/governance', replacement: resolve(consolidatedSrc, 'schemas/governance.ts') },
  { find: '@senars/core/schemas/formalization', replacement: resolve(consolidatedSrc, 'schemas/formalization.ts') },
  { find: '@senars/core/schemas/truth', replacement: resolve(consolidatedSrc, 'schemas/truth.ts') },
  { find: '@senars/core/schemas/cognitive-events', replacement: resolve(consolidatedSrc, 'schemas/cognitive-events.ts') },
  { find: '@senars/core/schemas/gate-io', replacement: resolve(consolidatedSrc, 'schemas/gate-io.ts') },
  { find: '@senars/core/schemas/reasoning-budget', replacement: resolve(consolidatedSrc, 'schemas/reasoning-budget.ts') },
  { find: '@senars/core/schemas/derivation-records', replacement: resolve(consolidatedSrc, 'schemas/derivation-records.ts') },
  // Main core entry - use client-safe for browser
  { find: '@senars/core', replacement: resolve(consolidatedSrc, 'client-safe.ts') },
  // @senars/util/* subpaths matching tsconfig.json paths (MUST come before @senars/util)
  ...utilSubpaths.flatMap(({ alias, path }) => [
    { find: alias, replacement: resolve(utilSrc, path) },
    { find: `${alias}.js`, replacement: resolve(utilSrc, path) },
  ]),
  // util main entry - MUST come after all subpaths
  { find: '@senars/util', replacement: resolve(utilSrc, 'index.ts') },
  // @senars/schemas/* subpaths
  { find: '@senars/schemas/cognitive-events', replacement: resolve(schemasSrc, 'cognitive-events.ts') },
  { find: '@senars/schemas/common', replacement: resolve(schemasSrc, 'common.ts') },
  { find: '@senars/schemas/derivation-records', replacement: resolve(schemasSrc, 'derivation-records.ts') },
  { find: '@senars/schemas/event-base', replacement: resolve(schemasSrc, 'event-base.ts') },
  { find: '@senars/schemas/formalization', replacement: resolve(schemasSrc, 'formalization.ts') },
  { find: '@senars/schemas/gate-io', replacement: resolve(schemasSrc, 'gate-io.ts') },
  { find: '@senars/schemas/governance', replacement: resolve(schemasSrc, 'governance.ts') },
  { find: '@senars/schemas/lens-schema', replacement: resolve(protocolSrc, 'lens-schema.ts') },
  { find: '@senars/schemas/nar-events', replacement: resolve(schemasSrc, 'nar-events.ts') },
  { find: '@senars/schemas/proposal', replacement: resolve(schemasSrc, 'proposal.ts') },
  { find: '@senars/schemas/reasoning-budget', replacement: resolve(schemasSrc, 'reasoning-budget.ts') },
  { find: '@senars/schemas/rule-table', replacement: resolve(schemasSrc, 'rule-table.ts') },
  { find: '@senars/schemas/truth', replacement: resolve(schemasSrc, 'truth.ts') },
  { find: /^@senars\/ui-shell\/framework$/, replacement: resolve(shellSrc, 'framework/index.ts') },
  { find: /^@senars\/ui-shell\/core$/, replacement: resolve(shellSrc, 'core/index.ts') },
  { find: '@senars/ui-shell', replacement: resolve(shellSrc, 'index.ts') },
  { find: /^@senars\/ui-contract\/modulation$/, replacement: resolve(contractSrc, 'modulation/index.ts') },
  { find: /^@senars\/ui-contract\/framework$/, replacement: resolve(contractSrc, 'framework/index.ts') },
  { find: /^@senars\/ui-contract\/core$/, replacement: resolve(contractSrc, 'core/index.ts') },
  { find: '@senars/ui-contract', replacement: resolve(contractSrc, 'index.ts') },
];
