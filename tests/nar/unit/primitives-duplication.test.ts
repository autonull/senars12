import { describe, expect, it } from 'vitest';
import { shannonEntropy, topOption } from '../../../nar/src/lm/system-one/distribution.js';
import { rewardBeliefTerm, rewardLevel } from '../../../nar/src/rl/impls/reward-term.js';
import { filterByTerm, termMatches } from '../../../nar/src/memory/term-filter.js';
import { recallEpisodes } from '../../../nar/src/agent/recall.js';

const termOf = (s: string) => ({ toString: () => s });
const dist = (pairs: [string, number][]) => pairs.map(([option, p]) => ({ option, p }));

describe('shannonEntropy', () => {
  it('is zero for a point mass and maximal for a uniform spread', () => {
    expect(shannonEntropy(dist([['a', 1]]))).toBe(0);
    expect(shannonEntropy(dist([['a', 0.5], ['b', 0.5]]))).toBe(1);
    expect(shannonEntropy(dist([['a', 0.25], ['b', 0.25], ['c', 0.25], ['d', 0.25]]))).toBe(2);
  });

  it('ignores zero-probability options', () => {
    expect(shannonEntropy(dist([['a', 0.5], ['b', 0.5], ['c', 0]]))).toBe(1);
  });
});

describe('topOption', () => {
  it('picks the highest probability, tolerating ties and emptiness', () => {
    expect(topOption(dist([['a', 0.2], ['b', 0.8]]))?.option).toBe('b');
    expect(topOption(dist([['a', 0.5], ['b', 0.5]]))?.option).toBe('a');
    expect(topOption([])).toEqual({ option: '', p: 0 });
  });
});

describe('reward representation', () => {
  it('classifies reward sign', () => {
    expect(rewardLevel(0.1)).toBe('high');
    expect(rewardLevel(0)).toBe('neutral');
    expect(rewardLevel(-0.1)).toBe('low');
  });

  it('builds the reward_<level> --> achieved belief', () => {
    expect(rewardBeliefTerm(1).toString()).toBe('(reward_high --> achieved)');
    expect(rewardBeliefTerm(0).toString()).toBe('(reward_neutral --> achieved)');
    expect(rewardBeliefTerm(-1).toString()).toBe('(reward_low --> achieved)');
  });
});

describe('term substring filtering', () => {
  const items = [
    { term: termOf('(Cat --> animal)') },
    { term: termOf('(dog --> animal)') },
    { term: termOf('(bird --> animal)') },
  ];

  it('matches a pre-lowered needle against the lowercased term', () => {
    expect(termMatches(items[0]!, 'cat')).toBe(true);
    expect(termMatches(items[0]!, '(cat')).toBe(true);
    expect(termMatches(items[1]!, 'cat')).toBe(false);
  });

  it('honours the result limit', () => {
    expect(filterByTerm(items, 'animal')).toHaveLength(3);
    expect(filterByTerm(items, 'animal', 2)).toHaveLength(2);
  });
});

describe('recallEpisodes', () => {
  const memory = {
    getEpisodes: async ({ limit }: { limit: number }) =>
      [{ content: 'the cat sat' }, { content: 'a dog barked' }].slice(0, limit),
  };

  it('returns everything without a query', async () => {
    expect(await recallEpisodes({ episodicMemory: memory })).toHaveLength(2);
  });

  it('filters case-insensitively', async () => {
    expect(await recallEpisodes({ episodicMemory: memory }, 'CAT')).toHaveLength(1);
  });

  it('returns nothing without episodic memory', async () => {
    expect(await recallEpisodes({})).toEqual([]);
  });
});
