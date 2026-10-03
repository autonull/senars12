import { clamp, getNested, keyedBy, setNested } from '@senars/util';
import { boundSpec as spec } from '@senars/util/config';
import type { CognitiveParameters } from '../config/cognitive-parameters.js';

export interface TunableKnob {
  readonly name: string;
  readonly path: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;

  get(): number;

  set(value: number): void;
}

export type KnobRoot = 'cognitive' | 'systemOne';

/** Unified knob table (G2/X9) — one spec list covering both roots. */
export interface KnobSpec {
  readonly name: string;
  readonly path: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly root: KnobRoot;
}

type ParamObj = Record<string, any>;

/**
 * The tunable subset of `cognitiveBounds`, with every range projected by `boundSpec`.
 *
 * These rows used to restate their `min`/`max`/`step` by hand, and nine of the ten had
 * drifted from the canonical table — the tuner could not reach values the config schema
 * already admitted. *Which* parameters are tunable is a decision; the numbers are not.
 */
const cognitiveKnobs: readonly Omit<KnobSpec, 'root'>[] = [
  {
    name: 'maxDerivationsPerStep',
    path: 'inference.maxDerivationsPerStep',
    ...spec('inference', 'maxDerivationsPerStep'),
  },
  {
    name: 'maxDerivationDepth',
    path: 'inference.maxDerivationDepth',
    ...spec('inference', 'maxDerivationDepth'),
  },
  { name: 'maxRulesPerCycle', path: 'lm.maxRulesPerCycle', ...spec('lm', 'maxRulesPerCycle') },
  { name: 'callTimeoutMs', path: 'lm.callTimeoutMs', ...spec('lm', 'callTimeoutMs') },
  { name: 'decayRate', path: 'priority.decayRate', ...spec('priority', 'decayRate') },
  { name: 'cpuThrottleMs', path: 'inference.cpuThrottleMs', ...spec('inference', 'cpuThrottleMs') },
  { name: 'maxLoops', path: 'modelRunner.maxLoops', ...spec('modelRunner', 'maxLoops') },
  {
    name: 'activationDecayRate',
    path: 'memory.activationDecayRate',
    ...spec('memory', 'activationDecayRate'),
  },
  {
    name: 'rankingMaxAdmissions',
    path: 'inference.ranking.maxAdmissions',
    ...spec('inference', 'rankingMaxAdmissions'),
  },
  {
    name: 'rankingMinScore',
    path: 'inference.ranking.minScore',
    ...spec('inference', 'rankingMinScore'),
  },
];
type SystemOneKnobSpec = Pick<KnobSpec, 'name' | 'min' | 'max' | 'step'>;

const systemOneKnobs: readonly SystemOneKnobSpec[] = [
  { name: 'systemOne.budgets.maxJudgmentCallsPerCycle', min: 1, max: 32, step: 1 },
  { name: 'systemOne.budgets.maxConsensusPerCycle', min: 1, max: 8, step: 1 },
  { name: 'systemOne.budgets.maxLatencyMsPerJudgment', min: 10, max: 200, step: 1 },
  { name: 'systemOne.budgets.maxTokensPerCycle', min: 256, max: 32768, step: 256 },
  { name: 'systemOne.budgets.maxMemoryMbPerCycle', min: 32, max: 2048, step: 32 },
  { name: 'systemOne.provisional.cInitial', min: 0.01, max: 0.5, step: 0.01 },
  { name: 'systemOne.provisional.decayRate', min: 0.05, max: 1.0, step: 0.05 },
  { name: 'systemOne.provisional.maxTtlMs', min: 5000, max: 300000, step: 5000 },
];
export const KNOB_SPECS: readonly KnobSpec[] = [
  ...cognitiveKnobs.map((k) => ({ ...k, root: 'cognitive' as const })),
  ...systemOneKnobs.map((k) => ({ ...k, root: 'systemOne' as const, path: k.name })),
];

const specByName = new Map(KNOB_SPECS.map((s) => [s.name, s]));

export function findKnobSpec(name: string): KnobSpec | undefined {
  return specByName.get(name);
}

function makeKnob(spec: KnobSpec, params: ParamObj): TunableKnob {
  return {
    ...spec,
    get() {
      return getNested(params, spec.path) as number;
    },
    set(value: number) {
      const clamped = clamp(Math.round(value / spec.step) * spec.step, spec.min, spec.max);
      setNested(params as unknown as Record<string, unknown>, spec.path, clamped);
    },
  };
}

export function createKnobSet(
  params: CognitiveParameters,
  systemOne?: ParamObj
): Record<string, TunableKnob> {
  const roots: Record<KnobRoot, ParamObj | undefined> = {
    cognitive: params as ParamObj,
    systemOne,
  };
  return keyedBy(
    KNOB_SPECS.filter((s) => roots[s.root]),
    (s) => s.name,
    (s) => makeKnob(s, roots[s.root]!)
  );
}

export { cognitiveKnobs as knobSchema, systemOneKnobs as systemOneKnobSchema };
