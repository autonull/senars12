/**
 * Kernel Terms Tests — test the term representation, interning, and canonicalization.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  TermFactory,
  TermOp,
  Term,
  VariableTerm,
  ConstantTerm,
  CompoundTerm,
  termInterner,
  termEquals,
  termHash,
  termComplexity,
  termFromJSON,
  termToJSON,
  visitTerm,
  mapTerm,
  findSubterms,
  getVariables,
  getConstants,
  substitute,
  containsVariable,
  getVariableSet,
  renameVariables,
  standardizeApart,
  isUnifiable,
  createCanonicalIndex,
  canonicalize,
  canonicalEquals,
  canonicalHash,
} from '../../src/kernel/terms/intern.js';
import { canonicalize as canonicalizeTerm } from '../../src/kernel/terms/canonical.js';

describe('TermFactory', () => {
  beforeEach(() => {
    TermFactory.reset();
  });

  it('should create interned variables', () => {
    const factory = TermFactory.getInstance();
    const v1 = factory.variable('$x');
    const v2 = factory.variable('$x');
    expect(v1).toBe(v2); // Same object
    expect(v1.name).toBe('$x');
    expect(v1.op).toBe(TermOp.VARIABLE);
  });

  it('should create interned constants', () => {
    const factory = TermFactory.getInstance();
    const c1 = factory.constant('Socrates');
    const c2 = factory.constant('Socrates');
    expect(c1).toBe(c2);
    expect(c1.value).toBe('Socrates');
    expect(c1.op).toBe(TermOp.CONSTANT);
  });

  it('should create compound terms', () => {
    const factory = TermFactory.getInstance();
    const a = factory.constant('A');
    const b = factory.constant('B');
    const inh1 = factory.inheritance(a, b);
    const inh2 = factory.inheritance(a, b);
    expect(inh1).toBe(inh2);
    expect(inh1.op).toBe(TermOp.INHERITANCE);
    expect(inh1.arity).toBe(2);
    expect(inh1.args[0]).toBe(a);
    expect(inh1.args[1]).toBe(b);
  });

  it('should parse Narsese', () => {
    const factory = TermFactory.getInstance();
    const term = factory.parse('(Socrates --> Mortal).');
    expect(term.op).toBe(TermOp.STATEMENT);
    expect(term.args[0].op).toBe(TermOp.INHERITANCE);
  });

  it('should format terms as Narsese', () => {
    const factory = TermFactory.getInstance();
    const term = factory.parse('(A --> B).');
    const formatted = factory.format(term);
    expect(formatted).toContain('-->');
    expect(formatted).toContain('.');
  });
});

describe('Term Interning', () => {
  beforeEach(() => {
    TermFactory.reset();
  });

  it('should ensure identity equality', () => {
    const v1 = termInterner.variable('$x');
    const v2 = termInterner.variable('$x');
    expect(termEquals(v1, v2)).toBe(true);
    expect(v1 === v2).toBe(true);
  });

  it('should hash terms consistently', () => {
    const t = termInterner.constant('test');
    const h1 = termHash(t);
    const h2 = termHash(t);
    expect(h1).toBe(h2);
  });

  it('should compute complexity', () => {
    const factory = TermFactory.getInstance();
    const a = factory.constant('A');
    const b = factory.constant('B');
    const inh = factory.inheritance(a, b);
    expect(termComplexity(a)).toBe(1);
    expect(termComplexity(inh)).toBe(3); // 1 + 1 + 1
  });

  it('should serialize to JSON', () => {
    const factory = TermFactory.getInstance();
    const term = factory.inheritance(factory.constant('A'), factory.constant('B'));
    const json = termToJSON(term);
    expect(json.op).toBe('-->');
    expect(json.args).toHaveLength(2);
  });

  it('should deserialize from JSON', () => {
    const json = {
      op: '-->',
      args: [
        { op: 'const', value: 'A' },
        { op: 'const', value: 'B' },
      ],
    };
    const term = termFromJSON(json);
    expect(term.op).toBe(TermOp.INHERITANCE);
    expect(term.args[0].op).toBe(TermOp.CONSTANT);
  });

  it('should visit term trees', () => {
    const factory = TermFactory.getInstance();
    const term = factory.inheritance(factory.constant('A'), factory.constant('B'));
    const visited: Term[] = [];
    visitTerm(term, {
      visitVariable: (t) => { visited.push(t); return undefined as never; },
      visitConstant: (t) => { visited.push(t); return undefined as never; },
      visitCompound: (t) => { visited.push(t); return undefined as never; },
    });
    expect(visited.length).toBe(3);
  });

  it('should map term trees', () => {
    const factory = TermFactory.getInstance();
    const term = factory.inheritance(factory.constant('A'), factory.constant('B'));
    const mapped = mapTerm(term, t => t.op === TermOp.CONSTANT && t.value === 'A'
      ? factory.constant('X')
      : t);
    expect(mapped.args[0].value).toBe('X');
    expect(mapped.args[1].value).toBe('B');
  });

  it('should find subterms', () => {
    const factory = TermFactory.getInstance();
    const term = factory.inheritance(factory.constant('A'), factory.constant('B'));
    const constants = findSubterms(term, t => t.op === TermOp.CONSTANT);
    expect(constants.length).toBe(2);
  });

  it('should get variables', () => {
    const factory = TermFactory.getInstance();
    const term = factory.inheritance(factory.variable('$x'), factory.constant('B'));
    const vars = getVariables(term);
    expect(vars.length).toBe(1);
    expect(vars[0].name).toBe('$x');
  });

  it('should substitute variables', () => {
    const factory = TermFactory.getInstance();
    const x = factory.variable('$x');
    const term = factory.inheritance(x, factory.constant('B'));
    const subbed = substitute(term, new Map([[x, factory.constant('A')]]));
    expect(subbed.args[0].value).toBe('A');
  });

  it('should check variable containment', () => {
    const factory = TermFactory.getInstance();
    const x = factory.variable('$x');
    const term = factory.inheritance(x, factory.constant('B'));
    expect(containsVariable(term, x)).toBe(true);
  });

  it('should rename variables', () => {
    const factory = TermFactory.getInstance();
    const x = factory.variable('$x');
    const term = factory.inheritance(x, factory.constant('B'));
    const renamed = renameVariables(term, 'v');
    expect(renamed.args[0].name).toMatch(/^v\d+$/);
    expect(renamed.args[0]).not.toBe(x);
  });

  it('should standardize apart', () => {
    const factory = TermFactory.getInstance();
    const x = factory.variable('$x');
    const term = factory.inheritance(x, factory.constant('B'));
    const std = standardizeApart(term);
    expect(std.args[0].name).toMatch(/^_v\d+$/);
  });

  it('should check unifiability', () => {
    const factory = TermFactory.getInstance();
    const a = factory.constant('A');
    const b = factory.constant('B');
    const x = factory.variable('$x');
    expect(isUnifiable(a, a)).toBe(true);
    expect(isUnifiable(a, b)).toBe(false);
    expect(isUnifiable(x, a)).toBe(true);
    expect(isUnifiable(x, b)).toBe(true);
  });
});

describe('Canonical Terms', () => {
  beforeEach(() => {
    TermFactory.reset();
  });

  it('should canonicalize terms', () => {
    const factory = TermFactory.getInstance();
    const term = factory.parse('(A & B)');
    const canonical = canonicalize(term);
    expect(canonical.hash).toBeDefined();
    expect(canonical.debruijn).toBeDefined();
    expect(canonical.freeVars).toEqual([]);
  });

  it('should sort commutative arguments', () => {
    const factory = TermFactory.getInstance();
    const term1 = factory.parse('(B & A)');
    const term2 = factory.parse('(A & B)');
    expect(canonicalEquals(term1, term2)).toBe(true);
  });

  it('should flatten associative operators', () => {
    const factory = TermFactory.getInstance();
    const term1 = factory.parse('((A & B) & C)');
    const term2 = factory.parse('(A & B & C)');
    expect(canonicalEquals(term1, term2)).toBe(true);
  });

  it('should eliminate double negation', () => {
    const factory = TermFactory.getInstance();
    const term1 = factory.parse('~~A');
    const term2 = factory.parse('A');
    expect(canonicalEquals(term1, term2)).toBe(true);
  });

  it('should normalize implication', () => {
    const factory = TermFactory.getInstance();
    const term1 = factory.parse('(A ==> B)');
    const term2 = factory.parse('(~A | B)');
    expect(canonicalEquals(term1, term2)).toBe(true);
  });

  it('should create canonical index', () => {
    const factory = TermFactory.getInstance();
    const terms = [
      factory.parse('(A & B)'),
      factory.parse('(B & A)'),
      factory.parse('(C & D)'),
    ];
    const index = createCanonicalIndex(terms);
    expect(index.size()).toBe(2); // (A&B) and (B&A) are same
    expect(index.has(factory.parse('(A & B)'))).toBe(true);
  });
});

describe('Term Parsing', () => {
  beforeEach(() => {
    TermFactory.reset();
  });

  it('should parse inheritance', () => {
    const factory = TermFactory.getInstance();
    const term = factory.parse('(Socrates --> Mortal)');
    expect(term.op).toBe(TermOp.INHERITANCE);
  });

  it('should parse similarity', () => {
    const factory = TermFactory.getInstance();
    const term = factory.parse('(Socrates <-> Human)');
    expect(term.op).toBe(TermOp.SIMILARITY);
  });

  it('should parse implication', () => {
    const factory = TermFactory.getInstance();
    const term = factory.parse('(Rain ==> Wet)');
    expect(term.op).toBe(TermOp.IMPLICATION);
  });

  it('should parse conjunction', () => {
    const factory = TermFactory.getInstance();
    const term = factory.parse('(A & B & C)');
    expect(term.op).toBe(TermOp.CONJUNCTION);
    expect(term.arity).toBe(3);
  });

  it('should parse disjunction', () => {
    const factory = TermFactory.getInstance();
    const term = factory.parse('(A | B)');
    expect(term.op).toBe(TermOp.DISJUNCTION);
  });

  it('should parse negation', () => {
    const factory = TermFactory.getInstance();
    const term = factory.parse('~A');
    expect(term.op).toBe(TermOp.NEGATION);
  });

  it('should parse variables', () => {
    const factory = TermFactory.getInstance();
    const term = factory.parse('$x');
    expect(term.op).toBe(TermOp.VARIABLE);
    expect(term.name).toBe('$x');
  });

  it('should parse statements/questions/goals', () => {
    const factory = TermFactory.getInstance();
    const stmt = factory.parse('A.');
    const ques = factory.parse('A?');
    const goal = factory.parse('A!');
    expect(stmt.op).toBe(TermOp.STATEMENT);
    expect(ques.op).toBe(TermOp.QUESTION);
    expect(goal.op).toBe(TermOp.GOAL);
  });

  it('should handle complex nested terms', () => {
    const factory = TermFactory.getInstance();
    const term = factory.parse('((A --> B) & (B --> C)) ==> (A --> C)');
    expect(term.op).toBe(TermOp.IMPLICATION);
  });
});

describe('Round-trip Serialization', () => {
  beforeEach(() => {
    TermFactory.reset();
  });

  it('should round-trip through JSON', () => {
    const factory = TermFactory.getInstance();
    const original = factory.parse('((A --> B) & (B --> C))');
    const json = termToJSON(original);
    const restored = termFromJSON(json);
    expect(termEquals(original, restored)).toBe(true);
  });

  it('should round-trip through Narsese', () => {
    const factory = TermFactory.getInstance();
    const original = factory.parse('(A --> B).');
    const narsese = factory.format(original);
    const restored = factory.parse(narsese);
    expect(termEquals(original, restored)).toBe(true);
  });
});