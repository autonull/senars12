/**
 * Unified schema barrel — re-exports all contracts from the generated genome.
 *
 * This is the single public surface for all kernel contracts. The actual
 * definitions live in the genome (`src/formats/genome.ts`) and are emitted to
 * `src/generated/schemas.ts`. This barrel preserves the original sub-module
 * paths for backward compatibility.
 */

// Re-export everything from generated schemas
export * from '@senars/generated';

// Sub-module re-exports for backward compatibility
export * from './cognitive-events';
export * from './common';
export * from './derivation-records';
export * from './event-base';
export * from './formalization';
export * from './gate-io';
export * from './governance';
export * from './nar-events';
export * from './proposal';
export * from './proposal-events';
export * from './reasoning-budget';
export * from './recalled-events';
export * from './rule-table';
export * from './task';
export * from './truth';
export * from './budget-types';