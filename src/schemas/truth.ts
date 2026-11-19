/**
 * The epistemic vocabulary every other schema in this directory is phrased in.
 *
 * A leaf on purpose: the budget, the event log, the derivation records, the
 * gate I/O and the formalization candidates all carry a truth pair and two of
 * them carry a source-quality ceiling, so this is the only module none of the
 * others needs to be checked against.
 */

import { BeliefTruthSchema, clamp01 } from '@senars/util';
import { z } from 'zod';

/**
 * The `0..1` truth pair every event payload, derivation record, and formalization
 * candidate carries. One definition, in the leaf package that owns the truth
 * type — the four event payloads here had each spelled it out inline, and the
 * chat protocol's copy had dropped the bound.
 */
export const TruthValueSchema = BeliefTruthSchema;

export type TruthValue = z.infer<typeof TruthValueSchema>;

/** Where a claim came from. Provenance is what bounds its confidence. */
export const SourceQualitySchema = z.enum([
  'PRIMARY',
  'SECONDARY',
  'GENERAL',
  'TERTIARY',
  'LLM_PRIOR',
  'PEER_AGENT',
  'SELF_METTA',
]);

export type SourceQuality = z.infer<typeof SourceQualitySchema>;

/**
 * Confidence ceiling by source quality — single source of truth.
 * Kernel gates and System One seeding both consume this.
 */
export const SOURCE_QUALITY_CONFIDENCE: Readonly<Record<SourceQuality, number>> = {
  PRIMARY: 0.9,
  SECONDARY: 0.7,
  GENERAL: 0.55,
  TERTIARY: 0.4,
  LLM_PRIOR: 0.5,
  PEER_AGENT: 0.6,
  SELF_METTA: 0.7,
} as const;

/**
 * A source's track record, as the one thing it is allowed to do to a ceiling:
 * lower it. Trust-not-truth — nothing here writes a Truth value, so the shape is
 * one method rather than a multiplier, and a consumer cannot reach past the
 * ceiling to a truth it disagrees with.
 */
export interface CeilingReputation {
  effectiveCeiling(base: number, key: string): number;
}

/**
 * The knobs that lower {@link SOURCE_QUALITY_CONFIDENCE}. Optional throughout: an
 * absent track record is a neutral one, so a caller with no reputation wired
 * reads the same function rather than a fallback branch.
 */
export interface CeilingLimits {
  reputation?: CeilingReputation;
  /** The key that track record is filed under. Without one there is no record to apply. */
  sourceKey?: string;
  /** A second ceiling — calibration authority, a quality grade. The lower of the two wins. */
  atMost?: number;
  /** A reliability that *scales* rather than caps — sensor confidence. */
  scaledBy?: number;
}

/**
 * The confidence a claim from `quality` may carry: the table, lowered by the
 * source's track record, then by whatever else bounds the caller, clamped once.
 *
 * The four consumers of this arithmetic each used to spell out the first two
 * steps, and two of them forgot the clamp — so a well-reported sensor could seed
 * a confidence above 1 through a path the third one could not take. `atMost` and
 * `scaledBy` are separate fields because they are separate claims: authority is
 * a limit and sensor confidence is a reliability, and collapsing them would make
 * one of the two silently the other.
 */
export const confidenceCeiling = (quality: SourceQuality, limits: CeilingLimits = {}): number => {
  const base = SOURCE_QUALITY_CONFIDENCE[quality];
  const rated =
    limits.reputation && limits.sourceKey
      ? limits.reputation.effectiveCeiling(base, limits.sourceKey)
      : base;
  const bounded = limits.atMost === undefined ? rated : Math.min(limits.atMost, rated);
  return clamp01(limits.scaledBy === undefined ? bounded : bounded * limits.scaledBy);
};
