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

type ParamObj = Record<string, any>;

const knobSchema = [
  { name: 'maxDerivationsPerStep', path: 'inference.maxDerivationsPerStep', min: 10, max: 500, step: 10 },
  { name: 'maxDerivationDepth', path: 'inference.maxDerivationDepth', min: 5, max: 20, step: 1 },
  { name: 'maxRulesPerCycle', path: 'lm.maxRulesPerCycle', min: 1, max: 13, step: 1 },
  { name: 'callTimeoutMs', path: 'lm.callTimeoutMs', min: 1000, max: 30000, step: 500 },
  { name: 'decayRate', path: 'priority.decayRate', min: 0.001, max: 0.1, step: 0.001 },
  { name: 'cpuThrottleMs', path: 'inference.cpuThrottleMs', min: 0, max: 50, step: 1 },
  { name: 'maxLoops', path: 'modelRunner.maxLoops', min: 1, max: 10, step: 1 },
  { name: 'activationDecayRate', path: 'memory.activationDecayRate', min: 0.001, max: 0.1, step: 0.001 },
] as const;

function getNested(obj: ParamObj, path: string): number {
  return path.split('.').reduce((o: any, k: string) => o?.[k], obj) as number;
}

function setNested(obj: ParamObj, path: string, value: number): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce((o: any, k: string) => o[k], obj);
  target[last] = value;
}

function makeKnob(spec: typeof knobSchema[number], params: ParamObj): TunableKnob {
  return {
    ...spec,
    get() { return getNested(params, spec.path); },
    set(value: number) {
      const clamped = Math.max(spec.min, Math.min(spec.max, Math.round(value / spec.step) * spec.step));
      setNested(params, spec.path, clamped);
    },
  };
}

export function createKnobSet(params: CognitiveParameters): Record<string, TunableKnob> {
  const p = params as ParamObj;
  return Object.fromEntries(knobSchema.map(s => [s.name, makeKnob(s, p)])) as Record<string, TunableKnob>;
}

export { knobSchema };