/**
 * Shared min/max/default bounds for NAR core config — single source of truth for
 * the engine defaults (`nar/src/types/core.ts`), the config-file schemas
 * (`src/config/schema.ts`) and the UI slider configs (`ui/src/server/config-schema.ts`).
 * Avoids drift between validation limits, engine defaults and UI control ranges.
 */
import { flatBounds } from './bounds.js';

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

const narCore = flatBounds(narCoreBounds);

/** A bound row's limits, never restated: `narCoreNumber('maxDerivationDepth')`. */
export const narCoreNumber = (key: NarCoreBoundKey) => narCore.schema(key, { defaulted: false });

/** The same row carrying its default — what a config-file field wants. */
export const narCoreDefaultedNumber = (key: NarCoreBoundKey) => narCore.schema(key);

/** Every bound's default, keyed by knob — the projection the engine's `DEFAULT_CONFIG`
 *  and the config-file schema's `narCoreDefaults` both wanted and each re-derived. */
export const narCoreDefaults: Record<NarCoreBoundKey, number> = narCore.defaults;

/** The whole table as one zod object, defaults attached — so the schema is the bounds
 *  rather than a hand-maintained transcription of them. */
export const narCoreDefaultsSchema = narCore.defaultsSchema;
