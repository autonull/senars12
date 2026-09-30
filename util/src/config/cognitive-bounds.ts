/**
 * Shared min/max/default bounds for cognitive parameters — single source of truth for
 * validation schemas (nar/src/config/cognitive-parameters.ts), config file schema
 * (src/config/schema.ts), and UI slider configs.
 * Avoids drift between validation limits, config defaults, and UI control ranges.
 */
import type { BoundProp } from './nar-core-bounds.js';

export const cognitiveBounds = {
  priority: {
    initialPriority: { min: 0.01, max: 1.0, default: 0.1, step: 0.01 },
    maxPriority: { min: 0.5, max: 2.0, default: 1.0, step: 0.1 },
    directMentionBoost: { min: 0.0, max: 1.0, default: 0.3, step: 0.05 },
    relatedConceptBoost: { min: 0.0, max: 1.0, default: 0.15, step: 0.05 },
    decayRate: { min: 0.0, max: 0.5, default: 0.05, step: 0.01 },
    propagationStrength: { min: 0.0, max: 1.0, default: 0.1, step: 0.05 },
  },
  lm: {
    enabled: { min: 0, max: 1, default: 1, step: 1 },
    singlePremiseEnabled: { min: 0, max: 1, default: 1, step: 1 },
    maxRulesPerCycle: { min: 1, max: 20, default: 13, step: 1 },
    callTimeoutMs: { min: 500, max: 60000, default: 5000, step: 500 },
    selectionStrategy: { min: 0, max: 3, default: 0, step: 1 },
  },
  attention: {
    autoPrime: { min: 0, max: 1, default: 1, step: 1 },
    primeBoost: { min: 0.0, max: 1.0, default: 0.3, step: 0.05 },
    relatedBoost: { min: 0.0, max: 1.0, default: 0.15, step: 0.05 },
    structuralSimilarity: { min: 0, max: 1, default: 1, step: 1 },
    semanticRelatedness: { min: 0, max: 1, default: 0, step: 1 },
    propagateActivation: { min: 0, max: 1, default: 1, step: 1 },
    propagationIterations: { min: 1, max: 10, default: 2, step: 1 },
  },
  inference: {
    maxDerivationsPerStep: { min: 10, max: 10000, default: 1000, step: 10 },
    maxDerivationDepth: { min: 1, max: 20, default: 10, step: 1 },
    enableCircularDetection: { min: 0, max: 1, default: 1, step: 1 },
    enableTraceCollection: { min: 0, max: 1, default: 0, step: 1 },
    cpuThrottleMs: { min: 0, max: 100, default: 0, step: 1 },
    maxSampledConcepts: { min: 10, max: 1000, default: 100, step: 10 },
    rankingMaxAdmissions: { min: 10, max: 1000, default: 100, step: 10 },
    rankingMinScore: { min: 0.0, max: 1.0, default: 0.0, step: 0.05 },
  },
  modelRunner: {
    maxLoops: { min: 1, max: 20, default: 5, step: 1 },
  },
  memory: {
    activationDecayRate: { min: 0.001, max: 0.5, default: 0.01, step: 0.001 },
  },
} as const;

export type CognitiveBounds = typeof cognitiveBounds;

export type CognitiveBoundCategory = keyof CognitiveBounds;

export type CognitiveBoundKey<C extends CognitiveBoundCategory> = keyof CognitiveBounds[C];

export function getCognitiveBound(category: string, key: string, prop: BoundProp): number {
  const cat = cognitiveBounds[category as keyof CognitiveBounds];
  if (!cat) throw new Error(`Unknown cognitive bound category: ${category}`);
  const bound = cat[key as keyof typeof cat];
  if (!bound) throw new Error(`Unknown cognitive bound key: ${key} in category ${category}`);
  return bound[prop] as number;
}

export function getAllCognitiveBounds(): CognitiveBounds {
  return cognitiveBounds;
}

/** A bound row as a plain `{min,max,default}` triple. */
export type BoundRange = { readonly min: number; readonly max: number; readonly default: number };

/**
 * One row projected to its `{min,max,default}` triple.
 *
 * Consumers that restate a table by calling `getCognitiveBound` three times per
 * row are a copy of the table that no ratchet can see. Naming the row instead
 * keeps the number in `cognitiveBounds` and makes the shape a convention of the
 * table's owner rather than of each reader. `step` is deliberately absent: it
 * quantizes writes, it does not describe the search space.
 */
export function boundRange<C extends CognitiveBoundCategory, K extends CognitiveBoundKey<C>>(
  category: C,
  key: K
): BoundRange {
  const row = cognitiveBounds[category][key] as BoundRange;
  return { min: row.min, max: row.max, default: row.default };
}

/** A bound row as a plain `{min,max,step}` triple — the search space a tuner scans. */
export type BoundSpec = { readonly min: number; readonly max: number; readonly step: number };

/**
 * One row projected to the `{min,max,step}` triple a tuner needs — {@link boundRange}
 * for the surface that quantizes writes instead of picking one.
 *
 * The tuner had hand-copied these nine numbers per row and nine of ten had drifted:
 * `maxDerivationsPerStep` capped tuning at 500 where the config schema admits 10000,
 * so the tuner could not reach values the engine already accepted. Naming the row is
 * what makes the drift a test failure instead of a surprise.
 */
export function boundSpec<C extends CognitiveBoundCategory, K extends CognitiveBoundKey<C>>(
  category: C,
  key: K
): BoundSpec {
  const row = cognitiveBounds[category][key] as BoundSpec;
  return { min: row.min, max: row.max, step: row.step };
}
