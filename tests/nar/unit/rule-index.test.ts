import { describe, expect, it } from 'vitest';
import { RuleIndex } from '../../../nar/src/rules/impls/RuleIndex.js';
import { createRulePattern, type RegisteredRule } from '../../../nar/src/rules/types.js';
import { TermBuilder } from '../../../nar/src/terms';

const rule = (id: string, priority: number, ops: [string?, string?] = []): RegisteredRule => ({
  id,
  priority,
  sync: true,
  pattern: createRulePattern(ops[0], ops[1]),
  apply: () => undefined,
});

const ids = (index: RuleIndex) =>
  index.match(TermBuilder.atom('a'), TermBuilder.atom('b')).map((r) => r.id);

describe('RuleIndex ordering', () => {
  it('orders matched rules by declared priority', () => {
    const index = new RuleIndex();
    index.register(rule('low', 0.1));
    index.register(rule('high', 0.9));
    index.register(rule('mid', 0.5));

    expect(ids(index)).toEqual(['high', 'mid', 'low']);
  });

  it('keeps priority order across repeated matches', () => {
    const index = new RuleIndex();
    index.register(rule('low', 0.1));
    index.register(rule('high', 0.9));

    expect(ids(index)).toEqual(['high', 'low']);
    expect(ids(index)).toEqual(['high', 'low']);
    expect(ids(index)).toEqual(['high', 'low']);
  });

  it('re-orders rather than serving a stale ranking after a hit', () => {
    const index = new RuleIndex();
    index.register(rule('alpha', 0.9));
    index.register(rule('beta', 0.1));
    expect(ids(index)).toEqual(['alpha', 'beta']);

    // A hit demotes the rule that just fired; the memoised order must not
    // outlive the state it was computed from.
    index.recordRuleHit('alpha', true, 1);
    expect(ids(index)).toEqual(['beta', 'alpha']);
  });

  it('demotes a rule that just fired, and expires the demotion', async () => {
    vi.useFakeTimers();
    try {
      const index = new RuleIndex();
      index.register(rule('alpha', 0.9));
      index.register(rule('beta', 0.1));

      index.recordRuleHit('alpha', true, 1);
      expect(ids(index)).toEqual(['beta', 'alpha']);

      vi.advanceTimersByTime(1500);
      expect(ids(index)).toEqual(['alpha', 'beta']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('probes atom, wildcard and catch-all buckets', () => {
    const index = new RuleIndex();
    index.register(rule('exact', 0.9, ['atom', 'atom']));
    index.register(rule('right-wildcard', 0.8, [undefined, 'atom']));
    index.register(rule('catch-all', 0.7));

    // `*:atom` is only probed when the left premise is compound, so an
    // atom/atom match sees the exact bucket and the catch-all.
    expect(ids(index)).toEqual(['exact', 'catch-all']);

    const compound = index.match(
      TermBuilder.inheritance(TermBuilder.atom('cat'), TermBuilder.atom('animal'))!,
      TermBuilder.atom('b')
    );
    expect(compound.map((r) => r.id)).toEqual(['right-wildcard', 'catch-all']);
  });

  it('clears every index on clear()', () => {
    const index = new RuleIndex();
    index.register(rule('alpha', 0.9));
    index.recordRuleHit('alpha', true, 1);
    index.addDependency('alpha', ['beta'], ['gamma']);

    index.clear();

    expect(ids(index)).toEqual([]);
    expect(index.getStatistics().size).toBe(0);
    expect(index.getRuleDependencies().size).toBe(0);
  });
});
