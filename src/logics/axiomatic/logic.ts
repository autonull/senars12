/**
 * Axiomatic Logic — Axiomatic logic implementation of the Logic port.
 *
 * Implements the Logic<Formula> interface for axiomatic formulas
 * with SLD resolution, model checking, and MUS extraction.
 */

import {
  Formula,
  Atom,
  Clause,
  Literal,
  Connective,
  isAtom,
  isCompound,
  implies,
  iff,
  and,
  or,
  not,
  Model,
  MUS,
  SymmetryGroup,
} from './ast';
import type { Term as AxiomaticTerm } from '../../kernel/terms/intern';
import { SLDResolver, type SLDConfig, type SLDResult, type Substitution } from './sld';
import { ModelFinder, type ModelResult } from './models';
import { MUSExtractor } from './mus';
import { SymmetryDetector } from './symmetry';
import { Term, VariableTerm, ConstantTerm, CompoundTerm, TermOp, termInterner } from '../../kernel/terms/intern';
import { Truth, type TruthValue } from '../../kernel/truth';
import { Stamp } from '../../kernel/stamp';
import type { Logic, LogicCodec, RuleAST, ConditionAST, ConclusionAST, TermRef, Premise, StepResult } from '../port';

/** Axiomatic formula codec. */
const AXIOMATIC_CODEC: LogicCodec<Formula> = {
  encode: (f: Formula) => formulaToString(f),
  decode: (s: string) => {
    try {
      return parseFormula(s);
    } catch {
      return null;
    }
  },
};

/** Axiomatic truth codec. */
const AXIOMATIC_TRUTH_CODEC: LogicCodec<TruthValue> = {
  encode: (t: TruthValue) => `${t.f},${t.c}`,
  decode: (s: string) => {
    const parts = s.split(',');
    if (parts.length !== 2) return null;
    const f = parseFloat(parts[0]!);
    const c = parseFloat(parts[1]!);
    if (isNaN(f) || isNaN(c)) return null;
    return { f, c };
  },
};

/** Convert formula to string. */
function formulaToString(f: Formula): string {
  if (isAtom(f)) {
    const args = f.args.map(a => termToString(a)).join(', ');
    return `${f.predicate}(${args})${f.negated ? ' (negated)' : ''}`;
  }
  if ('quantifier' in f) {
    return `${f.quantifier} ${f.variables.map(v => v.name).join(', ')}. ${formulaToString(f.body)}`;
  }
  const left = formulaToString(f.left!);
  const right = formulaToString(f.right!);
  const conn = connectiveToString(f.connective);
  return `(${left} ${conn} ${right})`;
}

/** Convert term to string. */
function termToString(t: AxiomaticTerm): string {
  if (t.op === TermOp.CONSTANT) return (t as ConstantTerm).value;
  if (t.op === TermOp.VARIABLE) return `?${(t as VariableTerm).name}`;
  const ct = t as CompoundTerm;
  return `${ct.op}(${ct.args.map(termToString).join(', ')})`;
}

/** Convert connective to string. */
function connectiveToString(c: Connective): string {
  switch (c) {
    case Connective.AND: return 'AND';
    case Connective.OR: return 'OR';
    case Connective.IMPLIES: return '->';
    case Connective.IFF: return '<->';
    case Connective.NOT: return 'NOT';
    case Connective.FORALL: return 'FORALL';
    case Connective.EXISTS: return 'EXISTS';
  }
}

/** Parse formula from string (simplified). */
function parseFormula(s: string): Formula | null {
  // Simplified parser - real implementation would be more robust
  s = s.trim();
  if (s.startsWith('(') && s.endsWith(')')) {
    s = s.slice(1, -1);
  }
  // This is a placeholder - real implementation needed
  return null;
}

/** Evaluate axiomatic expectation. */
function axiomaticExpect(formula: Formula): number {
  // Expectation based on formula structure
  if (isAtom(formula)) return 0.5;
  if ('connective' in formula && formula.connective === Connective.IMPLIES) return 0.7;
  if ('connective' in formula && formula.connective === Connective.IFF) return 0.8;
  return 0.5;
}

/** Evaluate axiomatic confidence. */
function axiomaticConf(formula: Formula): number {
  // Confidence based on formula complexity
  let complexity = 0;
  function countComplexity(f: Formula) {
    complexity++;
    if (!isAtom(f)) {
      if ('left' in f && f.left) countComplexity(f.left);
      if ('right' in f && f.right) countComplexity(f.right);
      if ('body' in f && f.body) countComplexity(f.body);
    }
  }
  countComplexity(formula);
  return Math.max(0.1, 1 - complexity * 0.05);
}

/** Check if two axiomatic formulas contradict. */
function axiomaticContradicts(a: Formula, b: Formula): boolean {
  // Contradiction if a implies not b or vice versa
  if (isAtom(a) && isAtom(b)) {
    return a.predicate === b.predicate &&
           a.args.length === b.args.length &&
           a.negated !== b.negated &&
           a.args.every((arg, i) => termEquals(arg, b.args[i]!));
  }
  return false;
}

/** Check term equality. */
function termEquals(a: AxiomaticTerm, b: AxiomaticTerm): boolean {
  if (a.op !== b.op) return false;
  if (a.op === TermOp.CONSTANT) return (a as ConstantTerm).value === (b as ConstantTerm).value;
  if (a.op === TermOp.VARIABLE) return (a as VariableTerm).name === (b as VariableTerm).name;
  // CompoundTerm
  const ca = a as CompoundTerm;
  const cb = b as CompoundTerm;
  return ca.op === cb.op && ca.args.length === cb.args.length &&
         ca.args.every((arg, i) => termEquals(arg, cb.args[i]!));
}

/** Axiomatic rules as formula-ASTs. */
const AXIOMATIC_RULES_AST: readonly RuleAST<Formula>[] = [
  // Modus Ponens: (A -> B), A |- B
  {
    id: 'modus_ponens',
    name: 'Modus Ponens',
    category: 'propositional',
    arity: 2,
    premiseRoles: ['implication', 'antecedent'],
    truthFn: 'modusPonens',
    priority: 100,
    condition: {
      op: 'and',
      args: [
        { op: 'eq', left: { op: 'premise', index: 0, field: 'term' }, right: { op: 'constant', value: 'implies' } },
        { op: 'eq', left: { op: 'premise', index: 1, field: 'term' }, right: { op: 'premise', index: 0, field: 'term' } },
      ],
    },
    conclusion: { op: 'premise', index: 0, field: 'term' },
  },

  // Modus Tollens: (A -> B), ~B |- ~A
  {
    id: 'modus_tollens',
    name: 'Modus Tollens',
    category: 'propositional',
    arity: 2,
    premiseRoles: ['implication', 'negated_consequent'],
    truthFn: 'modusTollens',
    priority: 95,
    condition: {
      op: 'and',
      args: [
        { op: 'eq', left: { op: 'premise', index: 0, field: 'term' }, right: { op: 'constant', value: 'implies' } },
        { op: 'eq', left: { op: 'premise', index: 1, field: 'term' }, right: { op: 'not', arg: { op: 'premise', index: 0, field: 'term' } } },
      ] as const,
    } as ConditionAST,
    conclusion: { op: 'negation', term: { op: 'premise', index: 0, field: 'term' } },
  },

  // And Introduction: A, B |- A AND B
  {
    id: 'and_intro',
    name: 'And Introduction',
    category: 'propositional',
    arity: 2,
    premiseRoles: ['left', 'right'],
    truthFn: 'andIntro',
    priority: 90,
    condition: { op: 'true' },
    conclusion: { op: 'constant', value: 'and' }, // Simplified
  },

  // And Elimination: A AND B |- A
  {
    id: 'and_elim_left',
    name: 'And Elimination (Left)',
    category: 'propositional',
    arity: 1,
    premiseRoles: ['conjunction'],
    truthFn: 'andElim',
    priority: 90,
    condition: { op: 'eq', left: { op: 'premise', index: 0, field: 'term' }, right: { op: 'constant', value: 'and' } },
    conclusion: { op: 'premise', index: 0, field: 'term' },
  },

  // Or Introduction: A |- A OR B
  {
    id: 'or_intro',
    name: 'Or Introduction',
    category: 'propositional',
    arity: 1,
    premiseRoles: ['premise'],
    truthFn: 'orIntro',
    priority: 85,
    condition: { op: 'true' },
    conclusion: { op: 'constant', value: 'or' },
  },

  // Resolution: (A OR B), (~A OR C) |- (B OR C)
  {
    id: 'resolution',
    name: 'Resolution',
    category: 'propositional',
    arity: 2,
    premiseRoles: ['clause1', 'clause2'],
    truthFn: 'resolution',
    priority: 80,
    condition: {
      op: 'and',
      args: [
        { op: 'eq', left: { op: 'premise', index: 0, field: 'term' }, right: { op: 'constant', value: 'or' } },
        { op: 'eq', left: { op: 'premise', index: 1, field: 'term' }, right: { op: 'constant', value: 'or' } },
      ],
    },
    conclusion: { op: 'constant', value: 'or' },
  },
] as const;

/** Axiomatic Logic implementation. */
export const AXIOMATIC_LOGIC: Logic<Formula> = {
  id: 'axiomatic',
  version: '1.0.0',
  codec: AXIOMATIC_CODEC,
  expect: axiomaticExpect,
  conf: axiomaticConf,
  contradicts: axiomaticContradicts,
  policy: 'report',
  rules: AXIOMATIC_RULES_AST,
} as const;