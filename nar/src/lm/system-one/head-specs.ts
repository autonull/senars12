/**
 * Head construction: a spec row plus factory options become a `JudgmentHead`. The
 * vocabulary itself is `head-ontology.ts`, which depends on nothing here — so the
 * calibration suite and the pipeline can read the head list without importing a
 * calibrator.
 */

import { getOrInsert, indexBy } from '@senars/util';
import { createIsotonicCalibrator } from './calibration.js';
import { dominantDistribution, legendFrom, uniformDistribution } from './distribution.js';
import {
  ALL_HEAD_SPECS,
  HEAD_SPECS,
  type HeadGroup,
  type HeadId,
  type HeadSpec,
  headSpecsInGroup,
  specToQuery,
} from './head-ontology.js';
import type { HeadFactoryOptions } from './heads/factory.js';
import { getScorer } from './scoring.js';
import type {
  ClassifyQuery,
  EvaluateQuery,
  JudgmentHead,
  JudgmentQuery,
  RubricId,
} from './types.js';

export type { HeadGroup, HeadId, HeadSpec } from './head-ontology.js';
export type { HeadFactoryOptions } from './heads/factory.js';
export type {
  CalibrationVersion,
  ClassifyQuery,
  EmbeddingCache,
  EvaluateQuery,
  JudgmentQuery,
} from './types.js';

/** Build one JudgmentHead from its spec entry (sole implementation; factory.ts delegates). */

export function createHead(spec: HeadSpec, options: HeadFactoryOptions): JudgmentHead {
  const headConfig = options.perHeadConfig?.[spec.rubric];
  const calibrationVersion = headConfig?.calibrationVersion ?? options.calibrationVersion;
  const abstainThreshold = headConfig?.abstainThreshold ?? options.abstainThreshold;
  const enabled = headConfig?.enabled ?? true;

  const calibrator = createIsotonicCalibrator(calibrationVersion, spec.rubric);
  const scorer = getScorer(spec.rubric);
  const isClassify = spec.kind === 'classify';
  const space = isClassify ? (spec.space ?? []) : [];

  return {
    rubric: spec.rubric,
    axis: spec.axis,
    space: isClassify ? space : undefined,
    levels: isClassify ? undefined : spec.levels,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery) => {
      // Choice semantics: the query may declare its own option space (e.g. a
      // candidate-select over live candidates) — the head judges over that.
      const options = isClassify ? ((query as ClassifyQuery).space ?? space) : [];
      const legendLevels = spec.levels ?? (query as EvaluateQuery).levels;
      if (!enabled || (isClassify && options.length === 0)) {
        // Disabled, or a Choice with no options — nothing to judge.
        return {
          score: 0,
          distribution: isClassify ? uniformDistribution(options) : undefined,
          abstained: true,
          abstainReason: 'out-of-domain',
        };
      }
      const calibratedScore = calibrator.calibrate(scorer(embedding, query));
      if (calibratedScore < abstainThreshold) {
        return {
          score: calibratedScore,
          distribution: isClassify ? uniformDistribution(options) : undefined,
          abstained: true,
          abstainReason: 'low-confidence',
        };
      }
      if (isClassify) {
        const dominantIdx = Math.floor(calibratedScore * options.length) % options.length;
        return {
          score: calibratedScore,
          distribution: dominantDistribution(options, calibratedScore, dominantIdx),
          abstained: false,
        };
      }
      // Score semantics: probability-weighted position over the ordered legend —
      // triangular kernel around the calibrated scalar at the level anchors.
      return {
        score: calibratedScore,
        legend: legendFrom(calibratedScore, legendLevels),
        abstained: false,
      };
    },
  };
}

export function createHeadsForGroup(
  group: HeadGroup,
  options: HeadFactoryOptions
): Map<RubricId, JudgmentHead> {
  return indexBy(headSpecsInGroup(group), (spec) => spec.rubric, (spec) => createHead(spec, options));
}

export function createHeadById(id: HeadId, options: HeadFactoryOptions) {
  return createHead(HEAD_SPECS[id], options);
}

/** Every head in one map, in ontology order — what the manifold judges with. */
export function createAllHeads(options: HeadFactoryOptions): Map<RubricId, JudgmentHead> {
  return indexBy(ALL_HEAD_SPECS, (spec) => spec.rubric, (spec) => createHead(spec, options));
}

export function groupQueries(group: HeadGroup): JudgmentQuery[] {
  return headSpecsInGroup(group).map(specToQuery);
}

/** Static, read-only query sets — built once; callers must not mutate them. */
const QUERY_GROUPS = new Map<HeadGroup, JudgmentQuery[]>();
const queriesFor = (group: HeadGroup): readonly JudgmentQuery[] =>
  getOrInsert(QUERY_GROUPS, group, () => groupQueries(group));

export const ingressQueries = (): readonly JudgmentQuery[] => queriesFor('ingress');
export const actionQueries = (): readonly JudgmentQuery[] => queriesFor('action');

export function selectQuery(space: readonly string[], instruction: string): ClassifyQuery {
  return {
    kind: 'classify',
    instruction,
    space,
    axis: 'teleological',
    rubric: 'candidate_select',
    criticality: 'standard',
  };
}
