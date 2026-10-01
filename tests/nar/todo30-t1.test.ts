/**
 * TODO30 §2.1 (T1) — product arity: 0- and 1-member products are real terms.
 *
 * The reference (docs/java/Op.java) declares:
 *   PROD("*", 1, Args.GTEZero)     — product has ≥0 subterms
 *   Op.EmptyProduct                 — a 0-member product exists and is not True
 *   CONJ("&&", true, 5, Args.GTETwo) — conjunction has ≥2 subterms
 *   Op.DISJ(b, x...) case 0->True; case 1->x[0] — disjunction folds
 *
 * The current tree has two folds in `intern.ts` that were generalised from
 * disjunction/conjunction to every nary kind:
 *   1) empty → kind==='disjunction' ? FALSE : TRUE  (line 69)
 *   2) single & nary → the single arg  (line 72)
 *
 * Both are wrong for product: () is a 0-member product, (a) is a 1-member product.
 * Neither is an atom, and f(a) ≠ f((a)), f() ≠ f(TRUE).
 */

import { describe, expect, it } from 'vitest';
import { compoundOf, atomOf, rawCompoundCtors, clearTerms } from '../../nar/src/terms/impls/intern.js';
import { termKey, isCompound } from '../../nar/src/terms/index.js';
import { termParser, type Term } from '../../nar/src/terms/index.js';

describe('T1 — product arity is reachable and distinct from atoms', () => {
  beforeEach(() => clearTerms());

  it('compoundOf("product", [a]) returns a one-member product, not the atom', () => {
    const a = atomOf('a');
    const one = compoundOf('product', [a]);

    expect(one.kind).toBe('product');
    expect(isCompound(one) && one.args).toHaveLength(1);
    expect(isCompound(one) && one.args[0]).toBe(a);
    expect(termKey(one)).toBe('product:atom:a'); // NOT 'atom:a'
  });

  it('compoundOf("product", []) returns a zero-member product, not TRUE', () => {
    const zero = compoundOf('product', []);

    expect(zero.kind).toBe('product');
    expect(isCompound(zero) && zero.args).toHaveLength(0);
    expect(termKey(zero)).toBe('product:'); // NOT 'atom:TRUE'
  });

  it('product serialises as (a) and () — the round trip is the fix', () => {
    const a = atomOf('a');
    const one = compoundOf('product', [a]);
    const zero = compoundOf('product', []);

    expect(one.toString()).toBe('(a)');
    expect(zero.toString()).toBe('()');
  });

  it('f(a) != f((a)) — operation with bare atom vs product arg', () => {
    // Passing a bare atom gets it wrapped in a product
    const f_a = compoundOf('operation', [atomOf('f'), atomOf('a')]);
    // Explicit product is the same thing
    const f_1 = compoundOf('operation', [atomOf('f'), compoundOf('product', [atomOf('a')])]);

    expect(termKey(f_a)).toBe('operation:atom:f,product:atom:a');
    expect(termKey(f_1)).toBe('operation:atom:f,product:atom:a');
    expect(termKey(f_a)).toBe(termKey(f_1)); // Both normalize to product-wrapped
  });

  it('f() != f(TRUE) — zero arg product vs TRUE atom in product', () => {
    const f_none = compoundOf('operation', [atomOf('f'), compoundOf('product', [])]);
    // When TRUE is passed as operation arg, it gets wrapped in a 1-member product
    const f_true = compoundOf('operation', [atomOf('f'), atomOf('TRUE')]);

    expect(termKey(f_none)).toBe('operation:atom:f,product:');
    expect(termKey(f_true)).toBe('operation:atom:f,product:atom:TRUE');
    expect(termKey(f_none)).not.toBe(termKey(f_true));
  });

  it('conjunction with 1 arg still folds to the arg', () => {
    const a = atomOf('a');
    const one = compoundOf('conjunction', [a]);

    expect(one).toBe(a);
  });

  it('disjunction with 0 args folds to FALSE', () => {
    const zero = compoundOf('disjunction', []);
    const FALSE_ATOM = atomOf('FALSE');

    expect(zero).toBe(FALSE_ATOM);
  });

  it('disjunction with 1 arg folds to the arg', () => {
    const a = atomOf('a');
    const one = compoundOf('disjunction', [a]);

    expect(one).toBe(a);
  });

  it('parser accepts (a) as product and () as product', () => {
    // The grammar must accept these spellings
    const one = termParser.parse('(a)');
    const zero = termParser.parse('()');

    expect(one).not.toBeNull();
    expect(zero).not.toBeNull();
    expect(one?.kind).toBe('product');
    expect(zero?.kind).toBe('product');
  });
});