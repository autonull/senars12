import { describe, expect, it } from 'vitest';
import {
  type EqualityDialect,
  structuralEqual,
  Unifier,
  type UnifierDialect,
} from '../../../util/src/utils/unify.js';

type T = { v?: string; tag: string; kids: T[] };

const varNode = (v: string): T => ({ v, tag: 'v', kids: [] });
const node = (tag: string, ...kids: T[]): T => ({ tag, kids });
const plain = (tag: string): T => ({ tag, kids: [] });

const DIALECT_KEY = (t: T): string =>
  t.v ? `v:${t.v}` : t.kids.length === 0 ? t.tag : `${t.tag}(${t.kids.map(DIALECT_KEY).join(',')})`;

const READING: EqualityDialect<T> = {
  variableName: (t) => t.v ?? null,
  equal: (a, b) => a.tag === b.tag,
  sameHead: (a, b) => a.tag === b.tag,
  children: (t) => t.kids,
};

const DIALECT: UnifierDialect<T> = {
  ...READING,
  key: DIALECT_KEY,
  rebuild: (t, kids) => ({ ...t, kids: [...kids] }),
};

const unifier = new Unifier(DIALECT);
const noMemo = new Unifier(DIALECT, { memoize: false });

describe('generic unifier', () => {
  it('binds variables structurally, leaving free variables unbound', () => {
    const s = unifier.unify(
      node('f', varNode('x'), varNode('y')),
      node('f', plain('a'), varNode('y'))
    );
    expect(s?.get('x')).toEqual(plain('a'));
    expect(s?.has('y')).toBe(false);
  });

  it('unifies a shared variable with itself without self-binding', () => {
    const s = unifier.unify(node('f', varNode('y')), node('f', varNode('y')));
    expect(s).not.toBeNull();
    expect(s?.size).toBe(0);
  });

  it('fails on a head mismatch without binding anything', () => {
    const pre = new Map<string, T>([['seed', plain('existing')]]);
    const s = unifier.unify(node('f', varNode('x')), node('g', varNode('x')), pre);
    expect(s).toBeNull();
    expect(pre.get('x')).toBeUndefined();
    expect(pre.get('seed')).toEqual(plain('existing'));
  });

  it('leaves the caller substitution untouched on failure', () => {
    const pre = new Map<string, T>();
    expect(
      unifier.unify(
        node('f', varNode('x'), varNode('y')),
        node('f', plain('a'), plain('b'), plain('c')),
        pre
      )
    ).toBeNull();
    expect(pre.size).toBe(0);
  });

  it('never mutates the substitution it is given', () => {
    const pre = new Map<string, T>();
    unifier.unify(varNode('x'), plain('a'), pre);
    expect(pre.size).toBe(0);
  });

  it('rejects cyclic bindings under the occurs check', () => {
    expect(unifier.unify(varNode('x'), node('f', varNode('x')))).toBeNull();
    expect(
      unifier.unify(varNode('x'), node('f', varNode('x')), new Map(), { occursCheck: false })
    ).not.toBeNull();
  });

  it('detects occurs through an existing binding', () => {
    const pre = new Map<string, T>([['y', node('f', varNode('x'))]]);
    expect(unifier.unify(varNode('x'), varNode('y'), pre)).toBeNull();
  });

  it('memoized and unmemoized runs agree', () => {
    const cases: [T, T][] = [
      [node('f', varNode('x'), varNode('y')), node('f', plain('a'), varNode('y'))],
      [plain('a'), plain('b')],
      [node('f', varNode('x')), node('g', varNode('x'))],
      [varNode('x'), node('f', varNode('x'))],
      [node('f', plain('a')), node('f', plain('a'))],
    ];
    for (const [a, b] of cases) {
      const memoized = unifier.unify(a, b, new Map(), { memoize: true });
      const plainRun = noMemo.unify(a, b, new Map(), { memoize: false });
      expect(memoized, `disagreement on ${DIALECT_KEY(a)} vs ${DIALECT_KEY(b)}`).toEqual(plainRun);
    }
  });

  it('reuses a memo entry without aliasing it to the caller', () => {
    const first = unifier.unify(varNode('x'), plain('a'));
    first?.set('x', plain('mutated'));
    const second = unifier.unify(varNode('x'), plain('a'));
    expect(second?.get('x')).toEqual(plain('a'));
  });

  it('applies substitutions to a fixpoint and is idempotent', () => {
    const subst = new Map<string, T>([
      ['x', varNode('y')],
      ['y', plain('a')],
    ]);
    const term = node('f', varNode('x'), plain('b'));
    const once = unifier.apply(term, subst);
    expect(DIALECT_KEY(once)).toBe('f(a,b)');
    expect(unifier.apply(once, subst)).toBe(once);
  });

  it('reports variables in first-occurrence order without duplicates', () => {
    expect(
      unifier.variables(node('f', varNode('x'), node('g', varNode('y'), varNode('x'))))
    ).toEqual(['x', 'y']);
  });

  it('decides a childless node by its payload alone', () => {
    expect(unifier.unify(plain('a'), plain('a'))).not.toBeNull();
    expect(unifier.unify(plain('a'), plain('b'))).toBeNull();
    expect(unifier.unify(node('f', plain('a')), node('f', plain('b')))).toBeNull();
  });
});

describe('structuralEqual', () => {
  it('agrees with itself on identity, shape and payload', () => {
    expect(structuralEqual(READING, plain('a'), plain('a'))).toBe(true);
    expect(structuralEqual(READING, plain('a'), plain('b'))).toBe(false);
    expect(structuralEqual(READING, node('f', plain('a')), node('g', plain('a')))).toBe(false);
    expect(structuralEqual(READING, node('f', plain('a')), node('f', plain('b')))).toBe(false);
    expect(structuralEqual(READING, node('f', plain('a')), node('f', plain('a'), plain('b')))).toBe(
      false
    );
  });

  it('reads a variable as a named node under the strict policy', () => {
    expect(structuralEqual(READING, varNode('x'), varNode('x'))).toBe(true);
    expect(structuralEqual(READING, varNode('x'), varNode('y'))).toBe(false);
    expect(structuralEqual(READING, varNode('x'), plain('x'))).toBe(false);
    expect(structuralEqual(READING, plain('x'), varNode('x'))).toBe(false);
  });

  it('reads a variable in the pattern as a wildcard, and nowhere else', () => {
    const pattern = node('f', varNode('x'), varNode('y'));
    expect(structuralEqual(READING, pattern, node('f', plain('a'), plain('b')), 'wildcard')).toBe(
      true
    );
    expect(structuralEqual(READING, pattern, node('f', plain('a'), varNode('z')), 'wildcard')).toBe(
      true
    );
    expect(
      structuralEqual(READING, pattern, node('f', varNode('z'), varNode('w')), 'wildcard')
    ).toBe(true);
    expect(structuralEqual(READING, pattern, node('f', plain('a')), 'wildcard')).toBe(false);
    expect(structuralEqual(READING, node('f', plain('a')), pattern, 'wildcard')).toBe(false);
  });

  it('answers the same way the unifier does once the variables are gone', () => {
    const cases: [T, T][] = [
      [node('f', plain('a'), plain('b')), node('f', plain('a'), plain('b'))],
      [node('f', plain('a')), node('f', plain('b'))],
      [node('f', plain('a')), node('g', plain('a'))],
      [plain('a'), plain('a')],
      [plain('a'), plain('b')],
    ];
    for (const [a, b] of cases) {
      const equal = structuralEqual(READING, a, b);
      expect(equal, `${DIALECT_KEY(a)} vs ${DIALECT_KEY(b)}`).toBe(unifier.unify(a, b) !== null);
    }
  });
});
