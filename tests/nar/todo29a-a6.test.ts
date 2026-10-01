import { describe, expect, it } from 'vitest';

import { RuleIndex, RuleProcessor, RuleRegistry } from '@senars/nar/rules';
import { createRulePattern } from '@senars/nar/rules/types';
import type { InferenceTable, RegisteredRule } from '@senars/nar/rules/types';
import { bucketCensus, kindViolations } from '../../scripts/lib/dispatch-table.js';
import { OPERATORS, Stamp, TermBuilder, Truth, type Term } from '@senars/nar/terms';

const rule = (id: string, priority: number, ops: [Term['kind'], Term['kind']]): RegisteredRule => ({
  id,
  priority,
  sync: true,
  pattern: createRulePattern(ops[0], ops[1]),
  apply: () => undefined,
});

const ids = (table: InferenceTable, left: Term['kind'], right: Term['kind']) =>
  table.candidates(left, right).map((r) => r.id);

/** The kind census, over the shipped table rather than a hand-written list. */
const declaredKinds = (): Map<string, RegisteredRule[]> => {
  const byKinds = new Map<string, RegisteredRule[]>();
  for (const registered of RuleRegistry.getAll()) {
    const key = `${registered.pattern.left.op}:${registered.pattern.right.op}`;
    byKinds.set(key, [...(byKinds.get(key) ?? []), registered]);
  }
  return byKinds;
};

describe('the gate can fail', () => {
  it('names a rule whose kind is undeclared or unknown', () => {
    const wildcard = {
      id: 'wildcard',
      priority: 1,
      sync: true,
      pattern: { left: {}, right: { op: 'atom' } },
    } as unknown as RegisteredRule;
    const invented = {
      id: 'invented',
      priority: 1,
      sync: true,
      pattern: { left: { op: 'nope' }, right: { op: 'atom' } },
    } as unknown as RegisteredRule;

    expect(kindViolations([wildcard, invented])).toEqual([
      { ruleId: 'wildcard', reason: 'undeclared', detail: ',atom' },
      { ruleId: 'invented', reason: 'unknown-kind', detail: 'nope' },
    ]);
  });

  it('a clean table has no violations and a census that counts every rule', () => {
    const rules = RuleRegistry.getAll();
    expect(kindViolations(rules)).toEqual([]);
    expect([...bucketCensus(rules).values()].reduce((a, b) => a + b, 0)).toBe(rules.length);
  });
});

describe('every registered rule declares its kinds', () => {
  it('the shipped table is non-empty and fully keyed', () => {
    const rules = RuleRegistry.getAll();
    expect(rules.length).toBeGreaterThan(0);

    const undeclared = rules.filter(
      (r) => !r.pattern.left.op || !r.pattern.right.op
    );
    expect(undeclared.map((r) => r.id)).toEqual([]);
  });

  it('no rule sits under a wildcard bucket', () => {
    const wildcardKeys = [...declaredKinds().keys()].filter((key) => key.includes('*'));
    expect(wildcardKeys).toEqual([]);
  });

  it('every declared kind is an operator the term layer defines', () => {
    const known = new Set<string>(['atom', ...Object.keys(OPERATORS)]);
    const unknown = [...declaredKinds().keys()]
      .flatMap((key) => key.split(':'))
      .filter((kind) => !known.has(kind));
    expect(unknown).toEqual([]);
  });
});

describe('dispatch is a port', () => {
  it('the processor reads candidates through InferenceTable, not RuleIndex', () => {
    const seen: [Term['kind'], Term['kind']][] = [];
    const spy: InferenceTable = {
      register: () => {},
      candidates: (left, right) => {
        seen.push([left, right]);
        return [];
      },
      clear: () => {},
    };
    const processor = new RuleProcessor([rule('noop', 1, ['atom', 'atom'])], spy);

    const input = (term: Term) => ({ term, truth: Truth.NEUTRAL, stamp: Stamp.createInput() });
    processor.processSync(
      input(TermBuilder.atom('a')),
      input(TermBuilder.inheritance(TermBuilder.atom('x'), TermBuilder.atom('y'))!)
    );

    expect(seen).toEqual([['atom', 'inheritance']]);
  });

  it('the processor exposes its table so a caller can extend it', () => {
    const processor = new RuleProcessor([rule('base', 1, ['atom', 'atom'])]);
    expect(processor.getTable().candidates('atom', 'atom').map((r) => r.id)).toEqual(['base']);
  });
});

describe('RuleIndex dispatch', () => {
  it('orders a bucket by declared priority', () => {
    const index = new RuleIndex();
    index.register(rule('low', 0.1, ['atom', 'atom']));
    index.register(rule('high', 0.9, ['atom', 'atom']));
    index.register(rule('mid', 0.5, ['atom', 'atom']));

    expect(ids(index, 'atom', 'atom')).toEqual(['high', 'mid', 'low']);
  });

  it('keeps registration order for equal priorities, and does not reorder on repeat', () => {
    const index = new RuleIndex();
    index.register(rule('first', 0.5, ['atom', 'atom']));
    index.register(rule('second', 0.5, ['atom', 'atom']));

    expect(ids(index, 'atom', 'atom')).toEqual(['first', 'second']);
    expect(ids(index, 'atom', 'atom')).toEqual(['first', 'second']);
  });

  it('matches only the declared pair — no wildcard, no catch-all', () => {
    const index = new RuleIndex();
    index.register(rule('exact', 0.9, ['atom', 'atom']));

    expect(ids(index, 'atom', 'atom')).toEqual(['exact']);
    expect(ids(index, 'atom', 'inheritance')).toEqual([]);
    expect(ids(index, 'inheritance', 'atom')).toEqual([]);
    expect(ids(index, 'inheritance', 'inheritance')).toEqual([]);
  });

  it('clears its buckets and dependencies on clear()', () => {
    const index = new RuleIndex();
    index.register(rule('alpha', 0.9, ['atom', 'atom']));
    index.addDependency('alpha', ['beta'], ['gamma']);

    index.clear();

    expect(ids(index, 'atom', 'atom')).toEqual([]);
    expect(index.getRuleDependencies().size).toBe(0);
  });
});