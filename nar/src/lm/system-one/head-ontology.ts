/**
 * The judgment-head ontology: which rubrics exist, what each judges over, and
 * which group judges it. The vocabulary, with nothing that builds anything in it.
 *
 * It is a module of its own because three readers need the table without the
 * machinery that consumes it — the calibration suite (which calibrates one
 * calibrator per rubric), the judgment pipeline (whose default stages are the
 * groups), and the head factory (which builds a head from a row). Keeping the
 * table inside the factory meant those two readers had to restate the list, and
 * they did: the calibrators were built for a hand-written copy that listed
 * `feasibility` twice and had never heard of `episodic_match`.
 */

import { SourceQualitySchema } from '@senars/core/schemas';
import type { CognitiveAxis, CriticalityLevel, RubricId } from './types.js';

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
    rubric: 'task_type',
    axis: 'epistemic',
    kind: 'classify',
    space: ['belief', 'goal', 'question', 'command'],
    instruction: 'Classify the task type',
    group: 'ingress',
  },
  illocution: {
    rubric: 'illocution',
    axis: 'epistemic',
    kind: 'classify',
    space: ['assert', 'query', 'command', 'promise', 'express'],
    instruction: 'Classify the illocutionary force',
    group: 'ingress',
  },
  injection: {
    rubric: 'injection',
    axis: 'epistemic',
    kind: 'evaluate',
    levels: ['none', 'low', 'medium', 'high', 'critical'],
    instruction: 'Evaluate injection risk',
    criticality: 'critical',
    group: 'ingress',
  },
  ambiguity: {
    rubric: 'ambiguity',
    axis: 'epistemic',
    kind: 'evaluate',
    levels: ['clear', 'slight', 'moderate', 'high', 'severe'],
    instruction: 'Evaluate ambiguity',
    group: 'ingress',
  },
  tense: {
    rubric: 'tense',
    axis: 'epistemic',
    kind: 'classify',
    space: ['past', 'present', 'future', 'timeless'],
    instruction: 'Classify the tense',
    group: 'ingress',
  },
  source_quality: {
    rubric: 'source_quality',
    axis: 'epistemic',
    kind: 'classify',
    // The provenance space, not a transcription of it: a source quality the
    // PerceptionGate accepts but this head cannot name is a class nothing can be
    // assigned to, which is how `SELF_METTA` (MeTTa-proved facts) went missing.
    space: SourceQualitySchema.options,
    instruction: 'Classify the source quality',
    group: 'ingress',
  },
  tool_dispatch: {
    rubric: 'tool_dispatch',
    axis: 'teleological',
    kind: 'classify',
    space: ['none', 'low', 'medium', 'high', 'critical'],
    instruction: 'Classify the tool dispatch criticality',
    group: 'action',
  },
  risk: {
    rubric: 'risk',
    axis: 'teleological',
    kind: 'classify',
    space: ['none', 'low', 'medium', 'high', 'critical'],
    instruction: 'Classify the risk level',
    group: 'action',
  },
  feasibility: {
    rubric: 'feasibility',
    axis: 'teleological',
    kind: 'evaluate',
    levels: ['impossible', 'unlikely', 'possible', 'likely', 'certain'],
    instruction: 'Evaluate feasibility',
    group: 'action',
  },
  strategy: {
    rubric: 'strategy',
    axis: 'teleological',
    kind: 'classify',
    space: ['explore', 'exploit', 'deliberate', 'delegate'],
    instruction: 'Classify the strategy',
    group: 'action',
  },
  reflex_value: {
    rubric: 'reflex_value',
    axis: 'teleological',
    kind: 'evaluate',
    levels: ['very-low', 'low', 'medium', 'high', 'very-high'],
    instruction: 'Evaluate reflex value',
    group: 'action',
  },
  candidate_select: {
    rubric: 'candidate_select',
    axis: 'teleological',
    kind: 'classify',
    space: ['candidate_1', 'candidate_2', 'candidate_3'],
    instruction: 'Select the best candidate',
    group: 'synthesis',
  },
  plausibility: {
    rubric: 'plausibility',
    axis: 'epistemic',
    kind: 'evaluate',
    levels: ['false', 'true'],
    instruction: 'Evaluate whether the statement is true',
    group: 'synthesis',
  },
  assertion: {
    rubric: 'assertion',
    axis: 'epistemic',
    kind: 'evaluate',
    levels: ['unsupported', 'supported'],
    instruction: 'Evaluate whether the claim is supported by the evidence',
    criticality: 'high',
    group: 'synthesis',
  },
  conflict: {
    rubric: 'conflict',
    axis: 'epistemic',
    kind: 'evaluate',
    levels: ['support', 'neutral', 'conflict', 'strong-conflict'],
    instruction: 'Evaluate conflict',
    group: 'synthesis',
  },
  groundedness: {
    rubric: 'groundedness',
    axis: 'epistemic',
    kind: 'evaluate',
    levels: ['ungrounded', 'weakly-grounded', 'grounded', 'strongly-grounded'],
    instruction: 'Evaluate groundedness',
    group: 'synthesis',
  },
  relevance: {
    rubric: 'relevance',
    axis: 'epistemic',
    kind: 'evaluate',
    levels: ['irrelevant', 'tangential', 'relevant', 'highly-relevant'],
    instruction: 'Evaluate relevance',
    group: 'memory',
  },
  episodic_match: {
    rubric: 'episodic_match',
    axis: 'epistemic',
    kind: 'evaluate',
    levels: ['no-match', 'weak-match', 'match', 'strong-match'],
    instruction: 'Evaluate episodic match',
    group: 'memory',
  },
  novelty: {
    rubric: 'novelty',
    axis: 'epistemic',
    kind: 'evaluate',
    levels: ['known', 'slightly-novel', 'novel', 'highly-novel'],
    instruction: 'Evaluate novelty',
    group: 'memory',
  },
} as const satisfies Record<string, HeadSpec>;

export type HeadId = keyof typeof HEAD_SPECS;
export type HeadGroup = HeadSpec['group'];

/** Every spec, in declaration order. */
export const ALL_HEAD_SPECS: readonly HeadSpec[] = Object.values(HEAD_SPECS);

/** The specs of one group, in declaration order — a pipeline stage, a head set. */
export const headSpecsInGroup = (group: HeadGroup): readonly HeadSpec[] =>
  ALL_HEAD_SPECS.filter((spec) => spec.group === group);

/** One rubric per head, in declaration order: everything a calibrator is built for. */
export const headRubrics = (): readonly RubricId[] => ALL_HEAD_SPECS.map((spec) => spec.rubric);
