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

const cognitiveKnobs: readonly Omit<KnobSpec, 'root'>[] = [
  {
    name: 'maxDerivationsPerStep',
    path: 'inference.maxDerivationsPerStep',
    min: 10,
    max: 500,
    step: 10,
  },
  { name: 'maxDerivationDepth', path: 'inference.maxDerivationDepth', min: 5, max: 20, step: 1 },
  { name: 'maxRulesPerCycle', path: 'lm.maxRulesPerCycle', min: 1, max: 13, step: 1 },
  { name: 'callTimeoutMs', path: 'lm.callTimeoutMs', min: 1000, max: 30000, step: 500 },
  { name: 'decayRate', path: 'priority.decayRate', min: 0.001, max: 0.1, step: 0.001 },
  { name: 'cpuThrottleMs', path: 'inference.cpuThrottleMs', min: 0, max: 50, step: 1 },
  { name: 'maxLoops', path: 'modelRunner.maxLoops', min: 1, max: 10, step: 1 },
  {
    name: 'activationDecayRate',
    path: 'memory.activationDecayRate',
    min: 0.001,
    max: 0.1,
    step: 0.001,
  },
  {
    name: 'rankingMaxAdmissions',
    path: 'inference.ranking.maxAdmissions',
    min: 10,
    max: 1000,
    step: 10,
  },
  { name: 'rankingMinScore', path: 'inference.ranking.minScore', min: 0, max: 0.5, step: 0.05 },
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

function getNested(obj: ParamObj, path: string): number {
  return path.split('.').reduce((o: any, k: string) => o?.[k], obj) as number;
}

function setNested(obj: ParamObj, path: string, value: number): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce((o: any, k: string) => o[k], obj);
  target[last] = value;
}

function makeKnob(spec: KnobSpec, params: ParamObj): TunableKnob {
  return {
    ...spec,
    get() {
      return getNested(params, spec.path);
    },
    set(value: number) {
      const clamped = Math.max(
        spec.min,
        Math.min(spec.max, Math.round(value / spec.step) * spec.step)
      );
      setNested(params, spec.path, clamped);
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
  return Object.fromEntries(
    KNOB_SPECS.filter((s) => roots[s.root]).map((s) => [s.name, makeKnob(s, roots[s.root]!)])
  );
}

export { cognitiveKnobs as knobSchema, systemOneKnobs as systemOneKnobSchema };
