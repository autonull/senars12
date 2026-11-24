/**
 * Kernel Terms — canonical term representation with structural sharing.
 *
 * @module
 */

export * from './types';
export * from './factory';
export * from './compound';
export * from './atomic';
export * from './variable';
// canonical.ts is intentionally not re-exported here to avoid duplicates with codec/formatters
// export * from './canonical';