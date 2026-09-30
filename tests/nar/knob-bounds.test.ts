import { type BoundSpec, cognitiveBounds } from '@senars/util/config';
import { describe, expect, it } from 'vitest';

import { KNOB_SPECS } from '../../nar/src/rlfp/knobs.js';

/**
 * The RLFP tuner and `SelfMetaGame` both hand-tune cognitive parameters, and both used to
 * restate their `min`/`max`/`step`/`default` by hand. Nine of the ten tuner rows had
 * drifted from `cognitiveBounds` — `maxDerivationsPerStep` capped tuning at 500 where the
 * config schema admits 10000, so the tuner could not reach values the engine already
 * accepted, and `SelfMetaGame` clamped self-tuning at 2000. Two tests asserted the drifted
 * numbers, which is what made the drift load-bearing.
 *
 * Both now project the rows with `boundSpec`/`boundRange`, so this ratchet is about the
 * projection rather than the arithmetic: a knob must still *name* a row in the canonical
 * table, and that row's category must still be where the knob writes.
 */

type BoundsRow = BoundSpec & { readonly default: number };

/** Leaf rows of `cognitiveBounds`, keyed by the leaf's own name. */
const BOUNDS_BY_NAME = new Map<string, { category: string; row: BoundsRow }>(
  Object.entries(cognitiveBounds).flatMap(([category, rows]) =>
    Object.entries(rows).map(
      ([name, row]) =>
        [name, { category, row: row as BoundsRow }] as [string, { category: string; row: BoundsRow }]
    )
  )
);

const cognitiveSpecs = () => KNOB_SPECS.filter((s) => s.root === 'cognitive');

describe('knob bounds', () => {
  it('declares a unique spec per knob name', () => {
    const names = KNOB_SPECS.map((s) => s.name);
    expect(names.filter((n, i) => names.indexOf(n) !== i)).toEqual([]);
  });

  it.each(cognitiveSpecs())('$name names a cognitiveBounds row', (spec) => {
    expect(BOUNDS_BY_NAME.get(spec.name)).toBeDefined();
  });

  it.each(cognitiveSpecs())('$name projects the canonical row', (spec) => {
    const row = BOUNDS_BY_NAME.get(spec.name)?.row;
    expect({ min: spec.min, max: spec.max, step: spec.step }).toEqual({
      min: row?.min,
      max: row?.max,
      step: row?.step,
    });
  });

  it.each(cognitiveSpecs())('$name writes inside the row it names', (spec) => {
    expect(spec.path.startsWith(`${BOUNDS_BY_NAME.get(spec.name)?.category}.`)).toBe(true);
  });
});
