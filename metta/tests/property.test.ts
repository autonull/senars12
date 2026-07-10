import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applySubst, unify } from '../src/engine/unify.js';
import { expr, num, sym, varr } from '../src/types/ast.js';

describe('Property-based tests', () => {
  describe('Unification', () => {
    it('reflexive: a unifies with a', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 10 }), (s) => {
          const result = unify(sym(s), sym(s));
          expect(result).not.toBeNull();
        })
      );
    });

    it('symmetric: if a unifies with b, b unifies with a', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10 }),
          fc.string({ minLength: 1, maxLength: 10 }),
          (s1, s2) => {
            const subst = new Map();
            const result = unify(sym(s1), sym(s2), subst);
            if (result === null) {
              const result2 = unify(sym(s2), sym(s1), new Map());
              expect(result2).toBeNull();
            }
          }
        )
      );
    });

    it('substitution idempotence: applying subst twice is same as once', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 5 }),
          fc.string({ minLength: 1, maxLength: 5 }),
          (varName, value) => {
            const subst = new Map([[varName, sym(value)]]);
            const atom = varr(varName);
            const once = applySubst(atom, subst);
            const twice = applySubst(once, subst);
            expect(once).toEqual(twice);
          }
        )
      );
    });
  });
});
