/**
 * NAR — Neuro-Symbolic Agent Runtime
 *
 * Main facade — re-exports the modular NAR implementation.
 * The implementation is split across src/nar/ for maintainability.
 */

export { NAR } from './nar/core';
export * from './nar/config';
export * from './nar/execution';
export * from './nar/io';
export * from './nar/presets';
export * from './nar/kernel';