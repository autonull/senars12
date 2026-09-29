/**
 * Shared min/max/default bounds for NAR core config — single source of truth for
 * the engine defaults (`nar/src/types/core.ts`), the config-file schemas
 * (`src/config/schema.ts`) and the UI slider configs (`ui/src/server/config-schema.ts`).
 * Avoids drift between validation limits, engine defaults and UI control ranges.
 */
import { z } from 'zod';

export const narCoreBounds = {
  maxConcepts: { min: 100, max: 10000, default: 1000, step: 100 },
  activationDecayRate: { min: 0, max: 1, default: 0.01, step: 0.001 },
  consolidationInterval: { min: 1, max: 100, default: 10, step: 1 },
  cpuThrottleMs: { min: 0, max: 100, default: 10, step: 1 },
  maxDerivationDepth: { min: 1, max: 100, default: 10, step: 1 },
  maxDerivationsPerStep: { min: 10, max: 10000, default: 1000, step: 10 },
  sampleSize: { min: 1, max: 1000, default: 100, step: 1 },
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

/** A zod number constrained by a `narCoreBounds` row — the schema never restates a limit. */
export const narCoreNumber = <K extends NarCoreBoundKey>(key: K) => {
  const b = narCoreBounds[key];
  return z.number().min(b.min).max(b.max);
};

/** The same row as a zod number carrying its default. */
export const narCoreDefaultedNumber = <K extends NarCoreBoundKey>(key: K) =>
  narCoreNumber(key).default(narCoreBounds[key].default);
