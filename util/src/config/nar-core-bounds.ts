/**
 * Shared min/max/default bounds for NAR core config — single source of truth for
 * validation schemas (src/config/schema.ts) and UI slider configs (ui/src/server/config-schema.ts).
 * Avoids drift between validation limits and UI control ranges.
 */
export const narCoreBounds = {
  maxConcepts: { min: 100, max: 10000, default: 1000, step: 100 },
  activationDecayRate: { min: 0, max: 1, default: 0.01, step: 0.001 },
  consolidationInterval: { min: 1, max: 100, default: 10, step: 1 },
  cpuThrottleMs: { min: 0, max: 100, default: 10, step: 1 },
  maxDerivationDepth: { min: 1, max: 100, default: 10, step: 1 },
  maxDerivationsPerStep: { min: 10, max: 10000, default: 1000, step: 10 },
} as const;

export type NarCoreBounds = typeof narCoreBounds;
export type NarCoreBoundKey = keyof NarCoreBounds;
export type BoundProp = 'min' | 'max' | 'default' | 'step';

export function getBound<K extends NarCoreBoundKey, P extends BoundProp>(
  key: K,
  prop: P
): NarCoreBounds[K][P] {
  return narCoreBounds[key][prop];
}