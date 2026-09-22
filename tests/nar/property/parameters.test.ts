import fc from 'fast-check';
import {
  DEFAULT_COGNITIVE_PARAMETERS,
  mergeParameters,
  PARAMETER_SPACE,
  validateParameters,
  type CognitiveParameters,
} from '../../../nar/src/config/cognitive-parameters';

type Bound = { min: number; max: number; default: number };
type SpaceLeaf = Bound;

const leaves = (): Array<[string, Bound]> => {
  const out: Array<[string, Bound]> = [];
  for (const [category, knobs] of Object.entries(PARAMETER_SPACE)) {
    for (const [knob, bound] of Object.entries(knobs as Record<string, SpaceLeaf>)) {
      out.push([`${category}.${knob}`, bound]);
    }
  }
  return out;
};

describe('CognitiveParameters bounds (property)', () => {
  it('every PARAMETER_SPACE entry satisfies min ≤ default ≤ max', () => {
    for (const [path, { min, max, default: d }] of leaves()) {
      expect(min, path).toBeLessThanOrEqual(max);
      expect(d, path).toBeGreaterThanOrEqual(min);
      expect(d, path).toBeLessThanOrEqual(max);
    }
  });

  it('merged parameters stay in range when set to a valid bound', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...leaves()),
        fc.float({ min: Math.fround(0.001), max: Math.fround(0.999), noNaN: true }),
        ([path, { min, max }], mix) => {
          const value = min + (max - min) * mix;
          const [category = '', knob = ''] = path.split('.');
          const partial = {
            [category]: { [knob]: value },
          } as unknown as Partial<CognitiveParameters>;
          const merged = mergeParameters(partial);
          expect(validateParameters(merged).valid).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('mergeParameters never drops unrelated defaults', () => {
    fc.assert(
      fc.property(fc.float({ min: 0, max: 1, noNaN: true }), (v) => {
        const merged = mergeParameters({ priority: { initialPriority: v } } as Partial<CognitiveParameters>);
        expect(merged.lm).toEqual(DEFAULT_COGNITIVE_PARAMETERS.lm);
        expect(merged.memory).toEqual(DEFAULT_COGNITIVE_PARAMETERS.memory);
      }),
      { numRuns: 50 }
    );
  });
});
