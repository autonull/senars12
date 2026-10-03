import { describe, expect, it } from 'vitest';
import {
  createTaskWeight,
  Memory,
  TermBuilder,
  TermMap,
  TermSet,
  Truth,
  termKey,
} from '../../../nar/src';
import { foldNary } from '../../../nar/src/rules/impls/builders.js';

/**
 * A canonical form is injective: a term's printed form names exactly one term,
 * and a term's structural key names it whatever it prints as.
 *
 * This used to be recorded the other way round — three structures (`a`,
 * `sequence(a)`, `conjunction(a)`) printing alike and held apart only by
 * `termKey`, which is the state a canonical form exists to remove. A variadic
 * kind with one member now *is* that member, so the collision cannot be built.
 * The property that made those tests necessary is kept, one level up: no two
 * distinct terms print alike, so `toString` is usable as an identity too.
 */
const a = TermBuilder.atom('a');
const b = TermBuilder.atom('b');
const seqA = TermBuilder.sequence(a, b);
const conjA = TermBuilder.conjunction(a, b);
const inh = TermBuilder.inheritance(a, b)!;

const distinct = [
  ['atom', a],
  ['sequence', seqA],
  ['conjunction', conjA],
  ['inheritance', inh],
] as const;

describe('canonical term identity', () => {
  it('a one-member variadic compound folds for disjunction, conjunction, parallel', () => {
    // Disjunction, conjunction, parallel fold 1-arg to the arg (n-ary kinds)
    expect(TermBuilder.disjunction(a)).toBe(a);
    expect(TermBuilder.conjunction(a)).toBe(a);
    expect(TermBuilder.parallel(a)).toBe(a);
    // Product with 1 arg is a real 1-member product term, distinct from the atom
    expect(TermBuilder.product(a)).not.toBe(a);
    expect(TermBuilder.product(a).kind).toBe('product');
    // Sequence is binary in SeNARS — throws on 1-arg
    expect(() => TermBuilder.sequence(a)).toThrow('exactly 2');
  });

  it('no two distinct structures share a printed form', () => {
    const printed = new Set(distinct.map(([, term]) => term.toString()));
    expect(printed.size).toBe(distinct.length);
  });

  it('termKey separates every structure', () => {
    const keys = new Set(distinct.map(([, term]) => termKey(term)));
    expect(keys.size).toBe(distinct.length);
  });

  it('TermSet holds each of them', () => {
    const set = new TermSet();
    for (const [, term] of distinct) set.add(term);
    expect(set.size).toBe(distinct.length);
    for (const [, term] of distinct) expect(set.has(term)).toBe(true);
  });

  it('TermMap holds each of them, and a non-interned copy addresses the same entry', () => {
    const map = new TermMap<string>();
    for (const [name, term] of distinct) map.set(term, name);

    expect(map.size).toBe(distinct.length);
    expect(map.get(TermBuilder.atom('a'))).toBe('atom');
    expect(
      map.get({ kind: 'sequence', args: [TermBuilder.atom('a'), TermBuilder.atom('b')] } as never)
    ).toBe('sequence');
  });
});

describe('term-keyed consumers do not merge on the printed form', () => {
  it('revision history is per term, not per printed form', () => {
    const memory = new Memory();
    memory.addTask(seqA, 'belief', Truth.create(0.9, 0.9), createTaskWeight(0.9));

    expect(memory.getRevisionHistory(seqA)).toHaveLength(1);
    expect(memory.getRevisionHistory(a)).toHaveLength(0);
    expect(memory.getRevisionHistory(conjA)).toHaveLength(0);
  });

  it('a union of n-ary terms keeps arguments that print alike', () => {
    const union = foldNary(
      'disjunction',
      true
    )([TermBuilder.disjunction(a, b), TermBuilder.disjunction(b, seqA)]);

    expect(union).toBeDefined();
    expect(union!.args).toHaveLength(3);
  });

  it('an intersection of n-ary terms keeps arguments that print alike', () => {
    const intersection = foldNary('conjunction')([
      TermBuilder.conjunction(a, b, seqA),
      TermBuilder.conjunction(a, b),
    ]);

    expect(intersection?.args).toEqual([a, b]);
  });
});
