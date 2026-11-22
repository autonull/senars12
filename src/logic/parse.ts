/**
 * A small Prolog-style reader for the logic CLI.
 *
 * Supports facts (`parent(john, mary).`), rules (`ancestor(X, Y) :- parent(X, Z), ancestor(Z, Y).`),
 * conjunction, and negation (`~p(X)`). Upper-case tokens are variables. This is
 * deliberately small: it is the surface `senars logic prove` needs, not a
 * general Prolog front end.
 */

import { termInterner } from '../kernel/terms/intern';
import type { Atom, Clause, Literal } from '../logics/axiomatic/ast';
import { clause, literal } from '../logics/axiomatic/ast';

const VARIABLE = /^[A-Z_][A-Za-z0-9_]*$/;

/** Split on `separator` at paren depth 0. */
const splitTopLevel = (text: string, separator: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (ch === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts.map((part) => part.trim()).filter(Boolean);
};

/** Parse an atom `pred(args)`, `pred`, or a negated form `~pred(args)`. */
export const parseAtom = (text: string): Atom => {
  const trimmed = text.trim();
  const negated = trimmed.startsWith('~') || trimmed.startsWith('-');
  const body = negated ? trimmed.slice(1).trim() : trimmed;
  const match = /^([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]*)\))?$/.exec(body);
  if (!match) throw new Error(`Invalid atom: ${text}`);
  const predicate = match[1]!;
  const rawArgs = match[2]?.trim();
  const args = rawArgs
    ? splitTopLevel(rawArgs, ',').map((arg) =>
        VARIABLE.test(arg) ? termInterner.variable(arg) : termInterner.constant(arg)
      )
    : [];
  return { predicate, args, negated };
};

/** Parse one clause; `head :- body.` or a fact `head.`. */
export const parseClause = (text: string): Clause => {
  const trimmed = text.trim().replace(/\.$/, '');
  const [head, body] = trimmed.split(/:-/);
  if (!head) throw new Error(`Invalid clause: ${text}`);
  const headLiteral: Literal = literal(parseAtom(head), true);
  if (body === undefined) return clause(headLiteral);
  const bodyLiterals = splitTopLevel(body, ',').map((part) => {
    const negated = part.startsWith('~') || part.startsWith('-');
    const atom = parseAtom(negated ? part : part);
    return literal(atom, !negated);
  });
  return clause(headLiteral, ...bodyLiterals);
};

/** Parse a program: clauses separated by `.` or newlines. */
export const parseProgram = (text: string): Clause[] => {
  const statements = text.includes('.') ? splitTopLevel(text, '.') : splitTopLevel(text, ';');
  return statements.map(parseClause);
};
