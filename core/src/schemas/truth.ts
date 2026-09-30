/**
 * The epistemic vocabulary every other schema in this directory is phrased in.
 *
 * A leaf on purpose: the budget, the event log, the derivation records, the
 * gate I/O and the formalization candidates all carry a truth pair and two of
 * them carry a source-quality ceiling, so this is the only module none of the
 * others needs to be checked against.
 */

import { BeliefTruthSchema } from '@senars/util';
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
