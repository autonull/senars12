import { describe, expect, it } from 'vitest';
import { createBudget, Memory, TermBuilder, TermMap, TermSet, termKey, Truth } from '../../../nar/src';
import { foldNary } from '../../../nar/src/rules/impls/builders.js';

/**
 * `serializeTerm` collapses a 1-argument n-ary term onto its argument, so
 * `sequence(a)`, `conjunction(a)` and the atom `a` all print as `"a"`. The
 * printed form is a rendering, not an identity: `termKey` is the one structural
 * identity, and everything that maps, de-duplicates or looks terms up by it.
 */
const a = TermBuilder.atom('a');
const seqA = TermBuilder.sequence(a);
const conjA = TermBuilder.conjunction(a);
const colliding = [
  ['atom', a],
  ['sequence', seqA],
  ['conjunction', conjA],
] as const;

describe('canonical term identity', () => {
  it('the serialized form collides across distinct structures', () => {
    const printed = new Set(colliding.map(([, term]) => term.toString()));
    expect(printed).toEqual(new Set(['a']));
  });

  it('termKey separates every structure that shares a serialized form', () => {
    const keys = new Set(colliding.map(([, term]) => termKey(term)));
    expect(keys.size).toBe(colliding.length);
  });

  it('TermSet holds each of them', () => {
    const set = new TermSet();
    for (const [, term] of colliding) set.add(term);
    expect(set.size).toBe(colliding.length);
    for (const [, term] of colliding) expect(set.has(term)).toBe(true);
  });

  it('TermMap holds each of them, and a non-interned copy addresses the same entry', () => {
    const map = new TermMap<string>();
    for (const [name, term] of colliding) map.set(term, name);

    expect(map.size).toBe(colliding.length);
    expect(map.get(TermBuilder.atom('a'))).toBe('atom');
    expect(map.get({ kind: 'sequence', args: [TermBuilder.atom('a')] } as never)).toBe('sequence');
  });
});

describe('term-keyed consumers do not merge on the serialized form', () => {
  it('revision history is per term, not per printed form', () => {
    const memory = new Memory();
    memory.addTask(seqA, 'belief', Truth.create(0.9, 0.9), createBudget(0.9));

    expect(memory.getRevisionHistory(seqA)).toHaveLength(1);
    expect(memory.getRevisionHistory(a)).toHaveLength(0);
    expect(memory.getRevisionHistory(conjA)).toHaveLength(0);
  });

  it('a union of n-ary terms keeps arguments that print alike', () => {
    const union = foldNary('disjunction', true)([TermBuilder.disjunction(a), TermBuilder.disjunction(seqA)]);

    expect(union).toBeDefined();
    expect(union!.args).toHaveLength(2);
  });

  it('an intersection of n-ary terms keeps arguments that print alike', () => {
    const intersection = foldNary('conjunction')([
      TermBuilder.conjunction(a, seqA),
      TermBuilder.conjunction(seqA),
    ]);

    expect(intersection?.args).toEqual([seqA]);
  });
});
