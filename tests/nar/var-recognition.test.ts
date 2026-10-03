import { applySubstitution, atom, isVariableSymbol, unify } from '../../nar/src/terms/index.js';
import { describe, expect, it } from 'vitest';

describe('variable recognition', () => {
  it('factory and isVariableSymbol agree on which atoms are variables', () => {
    for (const symbol of ['?x', '$y', '#z', '*a', '%b', 'cat', 'TRUE']) {
      const t = atom(symbol);
      expect(
        isVariableSymbol(symbol),
        `${symbol}: factory marks isVariable=${(t as { isVariable?: boolean }).isVariable} ` +
          `but isVariableSymbol=${isVariableSymbol(symbol)}`
      ).toBe((t as { isVariable?: boolean }).isVariable ?? false);
    }
  });

  it('the unifier binds every variable the factory creates', () => {
    for (const symbol of ['?x', '$y', '#z', '*a', '%b']) {
      const varTerm = atom(symbol);
      const bound = unify(varTerm, atom('cat'));
      expect(bound, `${symbol} should bind to cat`).toBeDefined();
      expect(bound?.get(symbol)).toEqual(atom('cat'));
    }
  });

  it('applySubstitution grounds every variable the unifier binds', () => {
    const varTerm = atom('$y');
    const bindings = new Map([['$y', atom('cat')]]);
    expect(String(applySubstitution(varTerm, bindings))).toBe('cat');
    expect(String(applySubstitution(atom('cat'), bindings))).toBe('cat');
  });
});
