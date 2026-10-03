import { describe, expect, it } from 'vitest';
import { canonical, roundTrip, tighten } from '../../scripts/lib/narsese-literals.js';

/**
 * TODO30 §2.3 T3 — the `narsese:literals` rule, and its declarations.
 *
 * The gate's rules moved into `scripts/lib/` precisely so this file can exist:
 * a gate whose logic is inline in the script that runs it is a gate nobody can
 * prove works, which is the failure mode §10.1 names. Each case below is a
 * failure the gate must be able to report — a rule that cannot fail is not a
 * rule.
 */

describe('tighten — whitespace is insignificant only where it is', () => {
  it('closes up a copula, where Narsese has no spacing convention', () => {
    expect(tighten('(robin --> bird).')).toBe('(robin-->bird).');
    expect(tighten('(robin-->bird).')).toBe('(robin-->bird).');
    expect(tighten('(robin --> bird).')).toBe(tighten('(robin-->bird).'));
  });

  it('keeps the space inside a multi-word atom', () => {
    // The distinction the whole comparison rests on: `[long cat]` is one atom,
    // so tightening it would assert a different term parsed successfully.
    expect(tighten('(a --> [long cat]).')).toBe('(a-->[long cat]).');
    expect(tighten('(a --> [longcat]).')).not.toBe(tighten('(a --> [long cat]).'));
  });

  it('closes up around brackets and the sentence mark', () => {
    expect(tighten('( a , b ) .')).toBe('(a,b).');
  });
});

describe('canonical — a literal is read as a task or as a bare term', () => {
  it('keeps the mark that makes a judgment a judgment', () => {
    // The mark is not part of a Term, so a term-only reader loses it — which is
    // why the gate had been guaranteed to fail every literal carrying one.
    expect(canonical('(robin --> bird).')).toBe('(robin-->bird).');
    expect(canonical('(robin --> animal)?')).toBe('(robin-->animal)?');
    expect(canonical('(robin --> animal)!')).toBe('(robin-->animal)!');
  });

  it('reads a bare term as a term, with nothing added', () => {
    expect(canonical('(robin --> bird)')).toBe('(robin-->bird)');
  });
});

describe('roundTrip — the gate, on objects rather than on a checkout', () => {
  it('accepts a literal in canonical form', () => {
    const verdict = roundTrip('(robin-->bird).');
    expect(verdict.failure).toBeUndefined();
    expect(verdict.canonicalUpToSpacing).toBe(true);
    expect(verdict.stable).toBe(true);
  });

  it("accepts the same literal with the author's spaces around the copula", () => {
    // Spacing is not syntax. A gate that failed here would be reporting the
    // author's whitespace as a defect, and would have made the canonical form
    // something no reader of the README writes.
    const verdict = roundTrip('(robin --> bird).');
    expect(verdict.failure).toBeUndefined();
    expect(verdict.canonical).toBe('(robin-->bird).');
  });

  it('fails a literal that reads back as a different term', () => {
    // `&&` is not a copula this grammar names; the literal is a broken term the
    // term parser rejects, so the gate must report rather than skip.
    expect(roundTrip('(a --> b &&)').failure).toMatch(/parse failed|re-serialises/);
  });

  it('fails a literal that does not parse at all', () => {
    const verdict = roundTrip('(a --> ).');
    expect(verdict.failure).toBeDefined();
    expect(verdict.failure).toMatch(/parse failed/);
  });

  it('reports the canonical form alongside the failure, so the fix is visible', () => {
    const verdict = roundTrip('(robin --> bird).');
    expect(verdict.canonical).toBe('(robin-->bird).');
  });
});
