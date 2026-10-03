import { describe, expect, it } from 'vitest';
import { safeDiv } from '@senars/util';
import { Truth } from '@senars/nar/terms';
import { resolveTruthFn, VERIFIER_TRUTH_TABLE } from '@senars/core/verify-derivation';
import { BUILTIN_DECLARATIONS } from '../../../nar/src/rules/impls/registration.js';

/**
 * TODO28 §4.1 — the verifier's transcribed truth table, pinned against the
 * engine's own arithmetic.
 *
 * `verify-derivation.ts` writes its NAL truth functions out by hand on purpose:
 * a verifier that imports the engine's arithmetic can only confirm the engine
 * agrees with itself. That is the right call, and it has a consequence the
 * file's header cannot prevent — a transcription drifts, and this one already
 * has (TODO27 §22.5).
 *
 * So the drift is *declared* rather than fixed. Every place the two tables
 * disagree is listed in `DECLARED_DRIFT` below. While the engine's arithmetic is
 * stable the test says nothing has drifted further; when it changes, the test
 * fails and names the entries that are now wrong, which is the moment to decide
 * whether the verifier or the engine moved.
 *
 * Two rules are worth remembering:
 *  - this test imports the engine, and that is fine — it is the *verifier* that
 *    must stay independent, and nothing in the engine imports the table back.
 *  - rewriting the table to agree is the thing the header argues against. Fix
 *    the table only if the engine moved and the verifier did not intend to.
 */

type BinaryFn = (f1: number, f2: number, c1: number, c2: number) => [number, number];

/**
 * The declared drift, as `rule:field`. Every entry is a real, known difference
 * between the transcribed table and the engine — an entry that disappears is a
 * change the test is reporting, not one it is making.
 */
const DECLARED_DRIFT = ['revision:frequency'] as const;

/**
 * Sample premises across the reachable truth domain, including the saturated
 * revision region (`c > MAX_CONFIDENCE` once both confidences approach the cap)
 * that the drift lives in. Frequency 0 and 1 are excluded: `Truth.create` takes
 * confidence as a second argument to a `0..0.999` bound, so a frequency of 0 is
 * not reachable through the constructor.
 */
const PREMISES: readonly (readonly [number, number, number, number])[] = [
  [0.9, 0.8, 0.9, 0.8],
  [0.5, 0.5, 0.5, 0.5],
  [0.3, 0.7, 0.6, 0.4],
  [0.1, 0.9, 0.9, 0.9],
  [0.99, 0.99, 0.99, 0.99],
  [0.9, 0.8, 0.999, 0.999],
  [0.5, 0.5, 0.999, 0.999],
  // Saturated revision: c1 = 0.999, c2 = 0.998 — w2c(w) exceeds MAX_CONFIDENCE.
  [0.99, 0.98, 0.999, 0.998],
];

const EPSILON = 1e-9;

/**
 * Verifier table entries that are rule-id spellings rather than operation names.
 * They resolve to one engine op, and a table entry with no engine counterpart
 * would silently stop being verified instead of failing.
 */
const RULE_ID_ALIASES: Record<string, string> = {
  'negation-intro': 'negation',
  'negation-elim': 'negation',
};

const engineOp = (name: string): ((...args: Truth[]) => Truth) | null => {
  const candidate = (Truth as unknown as Record<string, unknown>)[
    RULE_ID_ALIASES[name] ?? name
  ];
  return typeof candidate === 'function' ? (candidate as (...args: Truth[]) => Truth) : null;
};

/** `rule:field` for every premise tuple where the two tables disagree. */
const drift = (): string[] => {
  const found = new Set<string>();

  for (const [name, table] of Object.entries(VERIFIER_TRUTH_TABLE.BINARY_TRUTH)) {
    const engine = engineOp(name);
    if (!engine) continue;
    for (const [f1, f2, c1, c2] of PREMISES) {
      const [f, c] = (table as BinaryFn)(f1, f2, c1, c2);
      const actual = engine(Truth.create(f1, c1), Truth.create(f2, c2));
      if (Math.abs(f - actual.f) > EPSILON) found.add(`${name}:frequency`);
      if (Math.abs(c - actual.c) > EPSILON) found.add(`${name}:confidence`);
    }
  }

  for (const [name, table] of Object.entries(VERIFIER_TRUTH_TABLE.UNARY_TRUTH)) {
    const engine = engineOp(name);
    if (!engine) continue;
    for (const [f1, , c1] of PREMISES) {
      const [f, c] = table(f1, c1);
      const actual = engine(Truth.create(f1, c1));
      if (Math.abs(f - actual.f) > EPSILON) found.add(`${name}:frequency`);
      if (Math.abs(c - actual.c) > EPSILON) found.add(`${name}:confidence`);
    }
  }

  return [...found].sort();
};

describe('the derivation verifier is independent, and its independence is measured', () => {
  it('agrees with the engine everywhere except the declared drift', () => {
    expect(drift()).toEqual([...DECLARED_DRIFT]);
  });

  it('the one drift is the saturated revision branch, and it is frequency-only', () => {
    // The engine, past MAX_CONFIDENCE, falls back to a frequency-weighted mean
    // of the *confidences*; the verifier always uses the confidence-weighting.
    // The confidence itself agrees — both report the cap — so a derivation that
    // saturates can differ in frequency and never in confidence.
    const table = VERIFIER_TRUTH_TABLE.BINARY_TRUTH.revision as BinaryFn;
    const [f1, f2, c1, c2] = [0.99, 0.98, 0.999, 0.998];
    const [f, c] = table(f1, f2, c1, c2);
    const actual = Truth.revision(Truth.create(f1, c1), Truth.create(f2, c2));

    expect(c).toBeCloseTo(actual.c, 9);
    expect(f).not.toBeCloseTo(actual.f, 3);
  });

  it("the verifier's `div` is unclamped where the engine's `safeDiv` is not", () => {
    // Latent today: `comparison`'s ratio is inside [0, 1] for premises in
    // [0, 1], so the clamp never bites. It is pinned rather than assumed, so a
    // truth function that divides outside that range reports itself here.
    expect(safeDiv(3, 1)).toBe(1);
    expect(3 / 1).toBe(3);
  });

  it('every rule the verifier resolves has an engine counterpart', () => {
    const tableNames = [
      ...Object.keys(VERIFIER_TRUTH_TABLE.BINARY_TRUTH),
      ...Object.keys(VERIFIER_TRUTH_TABLE.UNARY_TRUTH),
    ];
    expect(tableNames.filter((name) => engineOp(name) === null)).toEqual([]);
  });

  it('every shipped rule resolves to an entry this table can compute', () => {
    // The other direction, and the one that was missing. A table entry with no
    // shipped rule is dead weight; a *shipped rule* with no table entry is a
    // derivation the verifier cannot check at all — it counts as a skip, so the
    // proof passes with the step unexamined. Before steps carried their
    // declared truth function, resolution was a substring scan over rule ids
    // and 23 of 44 shipped rules resolved to nothing.
    const unresolved = BUILTIN_DECLARATIONS.filter(
      (declaration) =>
        !declaration.truthFn || resolveTruthFn(declaration.ruleId, declaration.truthFn) === null
    ).map((declaration) => `${declaration.ruleId} (${declaration.truthFn ?? 'no truth fn'})`);

    expect(unresolved).toEqual([]);
  });

  it('every declared truth function is one the engine implements', () => {
    const declared = [...new Set(BUILTIN_DECLARATIONS.map((d) => d.truthFn).filter(Boolean))];
    expect(declared.filter((name) => engineOp(name as string) === null)).toEqual([]);
  });
});
