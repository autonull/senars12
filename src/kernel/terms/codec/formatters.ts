/**
 * Shared Narsese Formatters — common term formatting logic.
 *
 * Provides the core formatting functions used by both the Narsese codec
 * and the Term class's toString method.
 */

import type { Term, VariableTerm, ConstantTerm, CompoundTerm } from '../term-internal';
import { TermOp } from '../term-ops';
import { getArgs } from '../term-internal/compound';

/** Operator symbols for Narsese. */
const OPERATOR_SYMBOLS: Record<TermOp, string> = {
  [TermOp.INHERITANCE]: '-->',
  [TermOp.SIMILARITY]: '<->',
  [TermOp.IMPLICATION]: '==>',
  [TermOp.PREDICTIVE_IMPLICATION]: '=/>' ,
  [TermOp.EQUIVALENCE]: '<=>',
  [TermOp.CONJUNCTION]: '&',
  [TermOp.DISJUNCTION]: '|',
  [TermOp.PRODUCT]: '*',
  [TermOp.EXTENSIONAL_IMAGE]: '@',
  [TermOp.INTENSIONAL_IMAGE]: '#',
  [TermOp.PREDICTION]: '|>',
  [TermOp.CONCURRENT]: '||',
  [TermOp.SEQUENTIAL]: ';',
  [TermOp.PARALLEL]: '|~',
  [TermOp.NEGATION]: '~',
  [TermOp.VARIABLE]: '',
  [TermOp.CONSTANT]: '',
  [TermOp.STATEMENT]: '.',
  [TermOp.QUESTION]: '?',
  [TermOp.GOAL]: '!',
};

/** Precedence levels for parentheses handling. */
const PRECEDENCE: Record<TermOp, number> = {
  [TermOp.VARIABLE]: 100,
  [TermOp.CONSTANT]: 100,
  [TermOp.NEGATION]: 90,
  [TermOp.INHERITANCE]: 80,
  [TermOp.SIMILARITY]: 80,
  [TermOp.IMPLICATION]: 80,
  [TermOp.PREDICTIVE_IMPLICATION]: 80,
  [TermOp.EQUIVALENCE]: 80,
  [TermOp.EXTENSIONAL_IMAGE]: 80,
  [TermOp.INTENSIONAL_IMAGE]: 80,
  [TermOp.PREDICTION]: 80,
  [TermOp.CONJUNCTION]: 70,
  [TermOp.DISJUNCTION]: 70,
  [TermOp.PRODUCT]: 70,
  [TermOp.CONCURRENT]: 60,
  [TermOp.SEQUENTIAL]: 60,
  [TermOp.PARALLEL]: 60,
  [TermOp.STATEMENT]: 50,
  [TermOp.QUESTION]: 50,
  [TermOp.GOAL]: 50,
};

/** Binary operators that use infix notation. */
const BINARY_OPS = new Set<TermOp>([
  TermOp.INHERITANCE,
  TermOp.SIMILARITY,
  TermOp.IMPLICATION,
  TermOp.EQUIVALENCE,
  TermOp.EXTENSIONAL_IMAGE,
  TermOp.INTENSIONAL_IMAGE,
  TermOp.PREDICTION,
]);

/** N-ary operators that use infix notation between all args. */
const NARY_OPS = new Set<TermOp>([
  TermOp.CONJUNCTION,
  TermOp.DISJUNCTION,
  TermOp.PRODUCT,
  TermOp.CONCURRENT,
  TermOp.SEQUENTIAL,
  TermOp.PARALLEL,
]);

/** Escape a constant value for Narsese. */
export function escapeConstant(value: string): string {
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) return value;
  return `'${value.replace(/'/g, "\\'")}'`;
}

/** Get operator symbol for a TermOp. */
export function getOperatorSymbol(op: TermOp): string {
  return OPERATOR_SYMBOLS[op] ?? '';
}

/** Get precedence for a TermOp. */
export function getPrecedence(op: TermOp): number {
  return PRECEDENCE[op] ?? 0;
}

/** Format a term as Narsese using precedence-based parentheses. */
export function formatTerm(term: Term, parentPrec = 0): string {
  const opPrec = getPrecedence(term.op);
  const needsParens = opPrec < parentPrec;
  const args = getArgs(term);

  let result: string;

  switch (term.op) {
    case TermOp.VARIABLE:
      result = (term as VariableTerm).name;
      break;

    case TermOp.CONSTANT:
      result = escapeConstant((term as ConstantTerm).value);
      break;

    case TermOp.NEGATION:
      result = '~' + formatTerm(args![0]!, getPrecedence(TermOp.NEGATION));
      break;

    case TermOp.STATEMENT:
      result = formatTerm(args![0]!, opPrec) + '.';
      break;

    case TermOp.QUESTION:
      result = formatTerm(args![0]!, opPrec) + '?';
      break;

    case TermOp.GOAL:
      result = formatTerm(args![0]!, opPrec) + '!';
      break;

    default: {
      if (BINARY_OPS.has(term.op)) {
        const op = getOperatorSymbol(term.op);
        const left = args![0]!;
        const right = args![1]!;
        // Binary ops: left needs parens if its prec < op prec, right if <=
        const leftStr = formatTerm(left, opPrec + 1);
        const rightStr = formatTerm(right, opPrec + 1);
        result = `${leftStr} ${op} ${rightStr}`;
      } else if (NARY_OPS.has(term.op)) {
        const op = getOperatorSymbol(term.op);
        const parts = args!.map(arg => formatTerm(arg, opPrec + 1));
        result = parts.join(` ${op} `);
      } else {
        // Should not reach here for valid terms
        result = '';
      }
      break;
    }
  }

  return needsParens ? `(${result})` : result;
}

/** Get punctuation for a term (., ?, !). */
export function getPunctuation(term: Term): string | null {
  switch (term.op) {
    case TermOp.STATEMENT: return '.';
    case TermOp.QUESTION: return '?';
    case TermOp.GOAL: return '!';
    default: return null;
  }
}