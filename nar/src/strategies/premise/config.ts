/**
 * The premise primitives' configuration surface, as a zod shape (TODO27 §11.4).
 *
 * `PREMISE_PRIMITIVES` declares *what* a primitive samples from, scores with and
 * filters on; this module projects the three registries behind those fields into
 * validated enums, so the knobs are user-configurable and a typo'd scorer is a
 * validation error at the boundary rather than a strategy that silently returns
 * zero premises. The names are read off the registries — adding a source, scorer
 * or filter widens the schema automatically.
 */

import { z } from 'zod';
import {
  PREMISE_FILTER_REGISTRY,
  PREMISE_SCORER_REGISTRY,
  PREMISE_SAMPLE_FALLBACK,
  PREMISE_SOURCES,
  type FilterName,
  type FilterSpec,
  type LinearWeights,
  type ScorerName,
  type SourceName,
} from './primitives.js';

export const PREMISE_SOURCE_NAMES = Object.keys(PREMISE_SOURCES) as SourceName[];
/** Every filter name, curried ones included: a bare `highConfidence` uses its declared default. */
export const PREMISE_FILTER_NAMES = Object.keys(PREMISE_FILTER_REGISTRY) as FilterName[];
/** Scorers with a bare spelling; `linear` is curried and has none. */
export const PREMISE_SCORER_NAMES = Object.keys(PREMISE_SCORER_REGISTRY).filter(
  (name) => !PREMISE_SCORER_REGISTRY[name as ScorerName].isExtended
) as ScorerName[];

const enumOf = <T extends string>(values: readonly T[]) => z.enum(values as [T, ...T[]]);

const linearWeights = z
  .object({
    link: z.number().min(0).max(1),
    embed: z.number().min(0).max(1),
    pri: z.number().min(0).max(1),
  })
  .strict();

/** A curried filter takes a parameter, or the bare name uses its declared default. */
const filterSpec = z.union([
  enumOf(PREMISE_FILTER_NAMES),
  z.object({ highConfidence: z.number().min(0).max(1) }).strict(),
]);

const scorer = z.union([enumOf(PREMISE_SCORER_NAMES), z.object({ linear: linearWeights }).strict()]);

/** The sampling pipeline a primitive exposes, minus the two size knobs. */
export interface PremiseSampleSpec {
  source?: SourceName;
  scorer?: ScorerName | { linear: LinearWeights };
  filters?: FilterSpec[];
  minScore?: number;
  skipSameTerm?: boolean;
}

/** The overrides `createPremiseStrategy` accepts; size knobs are required, the rest optional. */
export type PremiseOverrides = PremiseSampleSpec & { sampleSize: number; limit: number };

/**
 * The zod shape for one primitive: the table entry is the default, so a
 * configured variant and the exported singleton can never drift.
 */
export const premiseSampleShape = (
  spec: PremiseSampleSpec & { sampleSize: number; limit: number }
): z.ZodRawShape => ({
  sampleSize: z.number().int().min(1).default(spec.sampleSize),
  limit: z.number().int().min(1).default(spec.limit),
  source: enumOf(PREMISE_SOURCE_NAMES).default(spec.source ?? PREMISE_SAMPLE_FALLBACK.source),
  scorer: scorer.default(spec.scorer ?? PREMISE_SAMPLE_FALLBACK.scorer),
  filters: z.array(filterSpec).default(spec.filters ?? PREMISE_SAMPLE_FALLBACK.filters),
  minScore: z.number().min(0).max(1).default(spec.minScore ?? PREMISE_SAMPLE_FALLBACK.minScore),
  skipSameTerm: z.boolean().default(spec.skipSameTerm ?? PREMISE_SAMPLE_FALLBACK.skipSameTerm),});
