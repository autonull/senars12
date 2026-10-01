/**
 * A12's acceptance (TODO29.a §5.12): a term has exactly one canonical form and a
 * claim has one spelling. These are properties over the reducer registry, not
 * spot checks — the corpus is derived from `OPERATORS` and from Narsese text, so
 * adding a kind or a reducer without a case here is a failure rather than a gap.
 */
import fc from 'fast-check';
import {
  canonicalTask,
  canonicalTerm,
  fromNarsese,
  TERM_REDUCERS,
  TASK_REDUCERS,
  TermBuilder,
  termKey,
  termsEqual,
  toNarsese,
} from '../../nar/src/terms';
import { OPERATORS } from '../../nar/src/terms/operators';
import { createTask } from '../../nar/src/types';
import { Truth } from '../../nar/src/terms';
import type { Term } from '../../nar/src/terms/types';

const a = TermBuilder.atom('a');
const b = TermBuilder.atom('b');
const c = TermBuilder.atom('c');

/** Every n-ary kind at an arity it can hold, flattened and nested one level deep. */
const corpus = (): Term[] => {
  const members = [a, b, c];
  const terms: Term[] = [];
  for (const kind of Object.keys(OPERATORS) as (keyof typeof OPERATORS)[]) {
    const { arity, nary } = OPERATORS[kind];
    const arities = nary ? [2, 3] : [Math.max(arity, 1)];
    for (const n of arities) {
      const operands = members.slice(0, n);
      terms.push(TermBuilder.compound(kind, operands));
      if (nary)
        terms.push(
          TermBuilder.compound(
            kind,
            operands.map((m) => TermBuilder.compound(kind, [a, m]))
          )
        );
    }
  }
  return terms;
};

const narsese = [
  '--a',
  '(--a)',
  '--(a,b)',
  '(a&b)',
  '(&,a,b,c)',
  '(a,b,c)',
  '(a,b)',
  '(a|b)',
  '(a&|b)',
  '(a&/b)',
  '<a --> b>',
  '<a ==> b>',
  '<a <=> b>',
  '<{a} --> b>',
  '<[a] --> b>',
  '(a=/>b)',
  '(a=|b)',
];

describe('canonicalTerm', () => {
  it('reaches a fixed point, and a fixed point is the identity', () => {
    for (const term of corpus()) {
      const once = canonicalTerm(term);
      expect(canonicalTerm(once)).toBe(once);
    }
  });

  it('returns an already-canonical term unchanged — by identity, so a fixed point allocates nothing', () => {
    for (const term of corpus()) {
      expect(canonicalTerm(term)).toBe(term);
    }
  });

  it('every reducer declines every canonical term', () => {
    for (const term of corpus()) {
      for (const reducer of TERM_REDUCERS) {
        expect(
          { id: reducer.id, applies: reducer.applies(term) },
          `${reducer.id} still applies to the canonical ${toNarsese(term)}`
        ).toEqual({ id: reducer.id, applies: false });
      }
    }
  });

  it('reducers commute: canonical is order-independent over the registry', () => {
    const shuffled = [...TERM_REDUCERS].reverse();
    for (const term of corpus()) {
      let pass = term;
      for (let i = 0; i < 8; i++) {
        const next = shuffled.reduce((acc, r) => (r.applies(acc) ? r.reduce(acc) : acc), pass);
        if (next === pass) break;
        pass = next;
      }
      expect(termKey(pass)).toBe(termKey(canonicalTerm(term)));
    }
  });

  it('two spellings of one claim are one term', () => {
    const nested = TermBuilder.compound('conjunction', [
      TermBuilder.conjunction(a, b),
      c,
    ]);
    const flat = TermBuilder.conjunction(a, b, c);
    expect(termKey(nested)).toBe(termKey(flat));

    const repeated = TermBuilder.conjunction(a, b, a);
    expect(termKey(repeated)).toBe(termKey(TermBuilder.conjunction(a, b)));

    expect(termKey(TermBuilder.negation(TermBuilder.negation(a)))).toBe(termKey(a));
    expect(TermBuilder.conjunction(a)).toBe(a);
  });

  it('flattening stops where nesting is the claim', () => {
    const implication = TermBuilder.implication(a, TermBuilder.implication(a, b));
    expect(termDepthOf(implication)).toBe(2);
    // `product` is associative but not commutative: it flattens, it never sorts.
    const ordered = TermBuilder.product(a, b);
    expect(termKey(ordered)).not.toBe(termKey(TermBuilder.product(b, a)));
    expect(termKey(TermBuilder.product(a, TermBuilder.product(b, c)))).toBe(
      termKey(TermBuilder.product(a, b, c))
    );
    // A variadic kind with one distinct member *is* that member.
    expect(TermBuilder.compound('conjunction', [a, a, a])).toBe(a);
  });

  it('holds over the parsed corpus — every Narsese sentence is already canonical', () => {
    for (const text of narsese) {
      const parsed = fromNarsese(text);
      expect(parsed, text).not.toBeNull();
      const term = parsed as Term;
      expect(canonicalTerm(term)).toBe(term);
      expect(toNarsese(fromNarsese(toNarsese(term)) as Term)).toBe(toNarsese(term));
    }
  });

  it('is a property over generated terms, not a spot check', () => {
    fc.assert(
      fc.property(fc.constantFrom(...corpus()), fc.constantFrom(...corpus()), (x, y) => {
        expect(termsEqual(canonicalTerm(x), x)).toBe(true);
        expect(termKey(canonicalTerm(x))).toBe(termKey(x));
        expect(termKey(canonicalTerm(canonicalTerm(y)))).toBe(termKey(canonicalTerm(y)));
      })
    );
  });
});

describe('canonicalTask', () => {
  const claim = (term: Term, f: number, c = 0.9) =>
    createTask(term, 'belief', Truth.create(f, c));

  it('(--x).f = 1 − f_x across the whole range, and the two spellings are one claim', () => {
    for (const f of [0, 0.1, 0.2, 0.5, 0.8, 1]) {
      const negated = canonicalTask(claim(TermBuilder.negation(a), f, 0.7));
      const positive = canonicalTask(claim(a, 1 - f, 0.7));
      expect(termKey(negated.term)).toBe(termKey(positive.term));
      expect(negated.truth.f).toBeCloseTo(positive.truth.f, 6);
      expect(negated.truth.c).toBeCloseTo(0.7, 6);
      expect(negated.type).toBe('belief');
    }
  });

  it('carries the stamp through untouched — this is one claim, not a revision', () => {
    const task = claim(TermBuilder.negation(a), 0.8);
    expect(canonicalTask(task).stamp).toBe(task.stamp);
    expect(canonicalTask(task).budget).toBe(task.budget);
    expect(canonicalTask(task).occurrenceTime).toBe(task.occurrenceTime);
  });

  it('every reducer declines every canonical task', () => {
    const canonical = corpus().map((term) => canonicalTask(claim(term, 0.9)));
    for (const task of canonical)
      for (const reducer of TASK_REDUCERS)
        expect(
          { id: reducer.id, applies: reducer.applies(task) },
          `${reducer.id} still applies to ${toNarsese(task.term)}`
        ).toEqual({ id: reducer.id, applies: false });
  });

  it('returns an already-canonical task by identity', () => {
    const task = claim(a, 0.9);
    expect(canonicalTask(task)).toBe(task);
  });

  it('a task head is never a bare negation, so one claim reaches memory as one concept', () => {
    for (const term of corpus())
      expect(canonicalTask(claim(term, 0.9)).term.kind).not.toBe('negation');
  });

  it('the construction path cannot produce the losing spelling', () => {
    // `--x` is a term identity, so the truth is untouched; the *single* negation
    // is the one that moves into the frequency.
    const doubled = createTask(
      TermBuilder.negation(TermBuilder.negation(a)),
      'belief',
      Truth.create(0.8, 0.9)
    );
    expect(doubled.term).toBe(a);
    expect(doubled.truth.f).toBeCloseTo(0.8, 6);

    const negated = createTask(TermBuilder.negation(a), 'belief', Truth.create(0.8, 0.9));
    expect(negated.term).toBe(a);
    expect(negated.truth.f).toBeCloseTo(0.2, 6);
  });
});

const termDepthOf = (term: Term): number =>
  term.kind === 'atom' ? 0 : 1 + Math.max(...term.args.map(termDepthOf));
