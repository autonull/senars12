/**
 * Single declarative registry of the System One judgment-head ontology (G1/Bench 25).
 * This is the ONLY place head spaces/levels/instructions are written down.
 */
import type { ClassifyQuery, CognitiveAxis, CriticalityLevel, JudgmentHead, JudgmentQuery, RubricId } from './types.js';
import { createIsotonicCalibrator } from './calibration.js';
import { getScorer } from './scoring.js';
import type { HeadFactoryOptions } from './heads/factory.js';

export interface HeadSpec {
  readonly rubric: RubricId;
  readonly axis: CognitiveAxis;
  readonly kind: 'classify' | 'evaluate';
  readonly space?: readonly string[];
  readonly levels?: readonly string[];
  readonly instruction: string;
  readonly criticality?: CriticalityLevel;
  readonly group: 'ingress' | 'action' | 'synthesis' | 'memory';
}

export const HEAD_SPECS = {
  task_type: {
    rubric: 'task_type', axis: 'epistemic', kind: 'classify',
    space: ['belief', 'goal', 'question', 'command'],
    instruction: 'Classify the task type', group: 'ingress',
  },
  illocution: {
    rubric: 'illocution', axis: 'epistemic', kind: 'classify',
    space: ['assert', 'query', 'command', 'promise', 'express'],
    instruction: 'Classify the illocutionary force', group: 'ingress',
  },
  injection: {
    rubric: 'injection', axis: 'epistemic', kind: 'evaluate',
    levels: ['none', 'low', 'medium', 'high', 'critical'],
    instruction: 'Evaluate injection risk', criticality: 'critical', group: 'ingress',
  },
  ambiguity: {
    rubric: 'ambiguity', axis: 'epistemic', kind: 'evaluate',
    levels: ['clear', 'slight', 'moderate', 'high', 'severe'],
    instruction: 'Evaluate ambiguity', group: 'ingress',
  },
  tense: {
    rubric: 'tense', axis: 'epistemic', kind: 'classify',
    space: ['past', 'present', 'future', 'timeless'],
    instruction: 'Classify the tense', group: 'ingress',
  },
  source_quality: {
    rubric: 'source_quality', axis: 'epistemic', kind: 'classify',
    space: ['PRIMARY', 'SECONDARY', 'GENERAL', 'TERTIARY', 'LLM_PRIOR', 'PEER_AGENT'],
    instruction: 'Classify the source quality', group: 'ingress',
  },
  tool_dispatch: {
    rubric: 'tool_dispatch', axis: 'teleological', kind: 'classify',
    space: ['none', 'low', 'medium', 'high', 'critical'],
    instruction: 'Classify the tool dispatch criticality', group: 'action',
  },
  risk: {
    rubric: 'risk', axis: 'teleological', kind: 'classify',
    space: ['none', 'low', 'medium', 'high', 'critical'],
    instruction: 'Classify the risk level', group: 'action',
  },
  feasibility: {
    rubric: 'feasibility', axis: 'teleological', kind: 'evaluate',
    levels: ['impossible', 'unlikely', 'possible', 'likely', 'certain'],
    instruction: 'Evaluate feasibility', group: 'action',
  },
  strategy: {
    rubric: 'strategy', axis: 'teleological', kind: 'classify',
    space: ['explore', 'exploit', 'deliberate', 'delegate'],
    instruction: 'Classify the strategy', group: 'action',
  },
  reflex_value: {
    rubric: 'reflex_value', axis: 'teleological', kind: 'evaluate',
    levels: ['very-low', 'low', 'medium', 'high', 'very-high'],
    instruction: 'Evaluate reflex value', group: 'action',
  },
  candidate_select: {
    rubric: 'candidate_select', axis: 'teleological', kind: 'classify',
    space: ['candidate_1', 'candidate_2', 'candidate_3'],
    instruction: 'Select the best candidate', group: 'synthesis',
  },
  conflict: {
    rubric: 'conflict', axis: 'epistemic', kind: 'evaluate',
    levels: ['support', 'neutral', 'conflict', 'strong-conflict'],
    instruction: 'Evaluate conflict', group: 'synthesis',
  },
  groundedness: {
    rubric: 'groundedness', axis: 'epistemic', kind: 'evaluate',
    levels: ['ungrounded', 'weakly-grounded', 'grounded', 'strongly-grounded'],
    instruction: 'Evaluate groundedness', group: 'synthesis',
  },
  relevance: {
    rubric: 'relevance', axis: 'epistemic', kind: 'evaluate',
    levels: ['irrelevant', 'tangential', 'relevant', 'highly-relevant'],
    instruction: 'Evaluate relevance', group: 'memory',
  },
  episodic_match: {
    rubric: 'episodic_match', axis: 'epistemic', kind: 'evaluate',
    levels: ['no-match', 'weak-match', 'match', 'strong-match'],
    instruction: 'Evaluate episodic match', group: 'memory',
  },
  novelty: {
    rubric: 'novelty', axis: 'epistemic', kind: 'evaluate',
    levels: ['known', 'slightly-novel', 'novel', 'highly-novel'],
    instruction: 'Evaluate novelty', group: 'memory',
  },
} as const satisfies Record<string, HeadSpec>;

export type HeadId = keyof typeof HEAD_SPECS;
export type HeadGroup = HeadSpec['group'];
export const HEAD_GROUPS = ['ingress', 'action', 'synthesis', 'memory'] as const;

/** Build one JudgmentHead from its spec entry (sole implementation; factory.ts delegates). */
const ALL_SPECS: readonly HeadSpec[] = Object.values(HEAD_SPECS);

export function createHead(spec: HeadSpec, options: HeadFactoryOptions): JudgmentHead {
  const headConfig = options.perHeadConfig?.[spec.rubric];
  const calibrationVersion = headConfig?.calibrationVersion ?? options.calibrationVersion;
  const abstainThreshold = headConfig?.abstainThreshold ?? options.abstainThreshold;
  const enabled = headConfig?.enabled ?? true;

  const calibrator = createIsotonicCalibrator(calibrationVersion, spec.rubric);
  const scorer = getScorer(spec.rubric);
  const isClassify = spec.kind === 'classify';
  const space = isClassify ? (spec.space ?? []) : [];
  const uniform = space.map((option) => ({ option, p: 1 / Math.max(1, space.length) }));

  return {
    rubric: spec.rubric,
    axis: spec.axis,
    space: isClassify ? space : undefined,
    levels: isClassify ? undefined : spec.levels,
    evaluate: async (embedding: Float32Array, query: JudgmentQuery) => {
      if (!enabled) {
        return { score: 0, distribution: isClassify ? uniform : undefined, abstained: true, abstainReason: 'out-of-domain' };
      }
      const calibratedScore = calibrator.calibrate(scorer(embedding, query));
      if (calibratedScore < abstainThreshold) {
        return { score: calibratedScore, distribution: isClassify ? uniform : undefined, abstained: true, abstainReason: 'low-confidence' };
      }
      if (isClassify) {
        const dominantIdx = Math.floor(calibratedScore * space.length) % space.length;
        const distribution = space.map((option, i) => ({
          option,
          p: i === dominantIdx ? calibratedScore : (1 - calibratedScore) / Math.max(1, space.length - 1),
        }));
        return { score: calibratedScore, distribution, abstained: false };
      }
      return { score: calibratedScore, abstained: false };
    },
  };
}

export function createHeadsForGroup(group: HeadGroup, options: HeadFactoryOptions): Map<RubricId, JudgmentHead> {
  return new Map(
    ALL_SPECS.filter((spec) => spec.group === group)
      .map((spec) => [spec.rubric, createHead(spec, options)])
  );
}

export function createHeadById(id: HeadId, options: HeadFactoryOptions) {
  return createHead(HEAD_SPECS[id], options);
}

/** Shared query builders (X10) — single construction site for judgment queries. */
export function specToQuery(spec: HeadSpec): JudgmentQuery {
  return spec.kind === 'classify'
    ? { kind: 'classify', instruction: spec.instruction, space: spec.space ?? [], axis: spec.axis, criticality: spec.criticality ?? 'standard' }
    : { kind: 'evaluate', instruction: spec.instruction, rubric: spec.rubric, axis: spec.axis, levels: spec.levels, criticality: spec.criticality ?? 'standard' };
}

export function groupQueries(group: HeadGroup): JudgmentQuery[] {
  return ALL_SPECS.filter((spec) => spec.group === group).map(specToQuery);
}

export const ingressQueries = () => groupQueries('ingress');
export const actionQueries = () => groupQueries('action');

export function selectQuery(space: readonly string[], instruction: string): ClassifyQuery {
  return { kind: 'classify', instruction, space, axis: 'teleological', criticality: 'standard' };
}