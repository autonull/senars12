import { describe, expect, it } from 'vitest';
import { spendTerminations } from '../../src/server/spend-terminations.js';

describe('spend terminations', () => {
  it('keeps only the scopes that refused work, with their reasons', () => {
    expect(
      spendTerminations({
        derivations: { terminationReason: 'derivations-budget' },
        'proposal-application': { terminationReason: 'none' },
        'control-work': {},
      })
    ).toEqual([{ scope: 'derivations', reason: 'derivations-budget' }]);
  });

  it('reports nothing for an absent or unexhausted summary', () => {
    expect(spendTerminations(undefined)).toEqual([]);
    expect(spendTerminations({ derivations: { terminationReason: 'none' } })).toEqual([]);
  });
});
