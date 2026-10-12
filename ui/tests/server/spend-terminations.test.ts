import { describe, expect, it } from 'vitest';
import { mergeSpendSummaries, spendTerminations } from '../../src/server/spend-terminations.js';

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

describe('mergeSpendSummaries', () => {
  it('merges multiple summaries, preserving termination reasons', () => {
    const s1 = { derivations: { ceiling: 100, spent: 50, terminationReason: 'derivations-budget' } };
    const s2 = { 'proposal-application': { ceiling: 50, spent: 50, terminationReason: 'proposal-budget' } };
    const merged = mergeSpendSummaries(s1, s2);
    expect(merged).toEqual({
      derivations: { ceiling: 100, spent: 50, terminationReason: 'derivations-budget' },
      'proposal-application': { ceiling: 50, spent: 50, terminationReason: 'proposal-budget' },
    });
  });

  it('keeps the first terminationReason when merging same scope', () => {
    const s1 = { derivations: { ceiling: 100, spent: 50, terminationReason: 'derivations-budget' } };
    const s2 = { derivations: { ceiling: 100, spent: 100, terminationReason: 'none' } };
    const merged = mergeSpendSummaries(s1, s2);
    // First exhaustion wins
    expect(merged.derivations.terminationReason).toBe('derivations-budget');
    expect(merged.derivations.spent).toBe(100);
  });

  it('handles undefined inputs gracefully', () => {
    const merged = mergeSpendSummaries(undefined, { derivations: { terminationReason: 'derivations-budget' } }, undefined);
    expect(merged).toEqual({ derivations: { terminationReason: 'derivations-budget' } });
  });
});
