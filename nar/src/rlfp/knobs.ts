import { getNested, keyedBy, setNested } from '@senars/util';
import {
  type BoundProjection,
  cognitiveBound,
  systemOneBound,
} from '@senars/util/config';
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
  /** Where the value lives in its root's parameter tree. */
  readonly path: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly root: KnobRoot;
  /**
   * `value` snapped onto the row's step and clamped into its range, by the table that owns
   * the row. `set` used to re-derive that arithmetic from its own `min`/`max`/`step`, so a
   * quantizer and the bound it claims to enforce were two implementations.
   */
  quantize(value: number): number;
}

/**
 * One knob, projected from the bound row that owns its numbers.
 *
 * The three limits and the write-time quantization were two spellings of one row: the
 * table held them for validation and the knob re-implemented the clamp for writes. Naming
 * the row is what makes them the same thing.
 */
const knob = <Path extends string, Root extends KnobRoot>(
  root: Root,
  name: string,
  path: string,
  bounds: BoundProjection<Path>,
  boundPath: Path
): KnobSpec => ({
  name,
  path,
  root,
  ...bounds.spec(boundPath),
  quantize: (value) => bounds.quantize(boundPath, value),
});

type ParamObj = Record<string, any>;

/**
 * The tunable subset of `cognitiveBounds`, with every range projected by its own row.
 *
 * These rows used to restate their `min`/`max`/`step` by hand, and nine of the ten had
 * drifted from the canonical table — the tuner could not reach values the config schema
 * already admitted. *Which* parameters are tunable is a decision; the numbers are not.
 */
const cognitiveKnobs: readonly KnobSpec[] = [
  knob('cognitive', 'maxDerivationsPerStep', 'inference.maxDerivationsPerStep', cognitiveBound, 'inference.maxDerivationsPerStep'),
  knob('cognitive', 'maxDerivationDepth', 'inference.maxDerivationDepth', cognitiveBound, 'inference.maxDerivationDepth'),
  knob('cognitive', 'maxRulesPerCycle', 'lm.maxRulesPerCycle', cognitiveBound, 'lm.maxRulesPerCycle'),
  knob('cognitive', 'callTimeoutMs', 'lm.callTimeoutMs', cognitiveBound, 'lm.callTimeoutMs'),
  knob('cognitive', 'decayRate', 'priority.decayRate', cognitiveBound, 'priority.decayRate'),
  knob('cognitive', 'cpuThrottleMs', 'inference.cpuThrottleMs', cognitiveBound, 'inference.cpuThrottleMs'),
  knob('cognitive', 'maxLoops', 'modelRunner.maxLoops', cognitiveBound, 'modelRunner.maxLoops'),
  knob('cognitive', 'activationDecayRate', 'memory.activationDecayRate', cognitiveBound, 'memory.activationDecayRate'),
  knob('cognitive', 'rankingMaxAdmissions', 'inference.ranking.maxAdmissions', cognitiveBound, 'inference.rankingMaxAdmissions'),
  knob('cognitive', 'rankingMinScore', 'inference.ranking.minScore', cognitiveBound, 'inference.rankingMinScore'),
];

/** Every tunable System One row, addressed as `category.key`. */
const SYSTEM_ONE_KNOBS = [
  'budgets.maxJudgmentCallsPerCycle',
  'budgets.maxConsensusPerCycle',
  'budgets.maxLatencyMsPerJudgment',
  'budgets.maxTokensPerCycle',
  'budgets.maxMemoryMbPerCycle',
  'provisional.cInitial',
  'provisional.decayRate',
  'provisional.maxTtlMs',
] as const satisfies Parameters<typeof systemOneBound.spec>[0][];

const systemOneKnobs: readonly KnobSpec[] = SYSTEM_ONE_KNOBS.map((boundPath) =>
  knob('systemOne', `systemOne.${boundPath}`, `systemOne.${boundPath}`, systemOneBound, boundPath)
);

export const KNOB_SPECS: readonly KnobSpec[] = [...cognitiveKnobs, ...systemOneKnobs];

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
      setNested(params as unknown as Record<string, unknown>, spec.path, spec.quantize(value));
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
