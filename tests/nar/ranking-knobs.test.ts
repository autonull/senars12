import { describe, expect, it } from 'vitest';
import { createKnobSet, knobSchema } from '../../nar/src/rlfp/knobs.js';
import { DEFAULT_COGNITIVE_PARAMETERS, mergeParameters } from '../../nar/src/config/cognitive-parameters.js';
import { rankDerivations } from '../../nar/src/rules/ranking.js';

const t = (s: string) => ({ term: { toString: () => s }, truth: { f: 0.9, c: 0.9 } });

describe('todo7: ranking knobs', () => {
  it('schema lists ranking knobs with paths into inference.ranking', () => {
    const names = knobSchema.map((k) => k.name);
    expect(names).toContain('rankingMaxAdmissions');
    expect(names).toContain('rankingMinScore');
  });
  it('knob set/get/clamp round-trips into live ranking behavior', () => {
    const params = mergeParameters({});
    const knobs = createKnobSet(params);
    expect(knobs['rankingMaxAdmissions']?.get()).toBe(100);
    knobs['rankingMaxAdmissions']?.set(5000);
    expect(params.inference.ranking?.maxAdmissions).toBe(1000);
    knobs['rankingMinScore']?.set(0.23);
    expect(params.inference.ranking?.minScore).toBeCloseTo(0.25);
    const many = Array.from({ length: 30 }, (_, i) => t(`(t${i} --> u)`));
    expect(rankDerivations(many, params.inference.ranking)).toHaveLength(30);
    knobs['rankingMaxAdmissions']?.set(23);
    expect(params.inference.ranking?.maxAdmissions).toBe(20);
    expect(rankDerivations(many, params.inference.ranking)).toHaveLength(20);
    void DEFAULT_COGNITIVE_PARAMETERS;
  });
});
