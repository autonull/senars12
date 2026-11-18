/**
 * Structural identity of a MeTTa atom: the hash that buckets it, the key that
 * names it, and the one descent that says two of them are the same.
 *
 * The three engines that walk an atom — the unifier, a space query and the `=`
 * builtin — each used to carry its own `switch (kind)`. The differences between
 * them were the variable policy and nothing else, so the descent is one function
 * over the dialect below and the variable policy is its one parameter. A kind
 * added to {@link AtomKind} is read in one place, not three.
 */

import { type EqualityDialect, fnv1a, fnv1aCombine, structuralEqual } from '@senars/util';
import type {
  ExpressionAtom,
  GroundedAtom,
  MeTTaAtom,
  NumberAtom,
  StringAtom,
  SymbolAtom,
  VariableAtom,
} from '../types/ast.js';
import { AtomKind, isVariable } from '../types/ast.js';

/** An atom with no children is every kind but `Expression` and `Grounded`. */
const NO_CHILDREN: readonly MeTTaAtom[] = Object.freeze([]);

const atomChildren = (atom: MeTTaAtom): readonly MeTTaAtom[] =>
  atom.kind === AtomKind.Expression
    ? [atom.operator, ...atom.args]
    : atom.kind === AtomKind.Grounded
      ? atom.args
      : NO_CHILDREN;

export function hashAtom(atom: MeTTaAtom): number {
  switch (atom.kind) {
    case 0:
      return fnv1a(`sym:${(atom as SymbolAtom).value}`);
    case 1:
      return fnv1a(`var:${(atom as VariableAtom).name}`);
    case 2:
      return fnv1a(`num:${(atom as NumberAtom).value}`);
    case 3:
      return fnv1a(`str:${(atom as StringAtom).value}`);
    case 4: {
      const expr = atom as ExpressionAtom;
      let h = hashAtom(expr.operator);
      for (const arg of expr.args) h = fnv1aCombine(h, hashAtom(arg));
      return h;
    }
    case 5: {
      const grounded = atom as GroundedAtom;
      let h = fnv1a(`grounded:${grounded.op}`);
      for (const arg of grounded.args) h = fnv1aCombine(h, hashAtom(arg));
      return h;
    }
    default:
      throw new Error(`Unknown atom kind: ${(atom as MeTTaAtom).kind}`);
  }
}

/**
 * String form of {@link hashAtom}, for the map and set keys that need one. Two
 * atoms with equal hashes are candidates for identity and still need
 * {@link equalAtoms} to confirm — this is the bucket key, not the comparison.
 *
 * Kind-tagged so that two atoms of different kinds can never share a bucket on
 * the strength of a hash collision alone; this is the only atom key in the
 * package, and every caller hashes to the same string.
 */
export const atomKey = (atom: MeTTaAtom): string => `${atom.kind}#${hashAtom(atom)}`;

/**
 * Equality of an atom's own payload. A compound's head is its first child, so
 * {@link structuralEqual} descends through the operator and answers that one.
 */
const sameAtom = (a: MeTTaAtom, b: MeTTaAtom): boolean => {
  switch (a.kind) {
    case AtomKind.Symbol:
      return a.value === (b as SymbolAtom).value;
    case AtomKind.Number:
      return a.value === (b as NumberAtom).value;
    case AtomKind.String:
      return a.value === (b as StringAtom).value;
    case AtomKind.Grounded:
      return a.op === (b as GroundedAtom).op;
    case AtomKind.Expression:
      return true;
    default:
      // A variable is answered by `structuralEqual` before it gets here, so this
      // is only an unrecognised kind — and an unrecognised kind matches nothing.
      return false;
  }
};

/** How a structural comparison reads a MeTTa atom. */
export const ATOM_EQUALITY: EqualityDialect<MeTTaAtom> = {
  variableName: (a) => (isVariable(a) ? a.name : null),
  sameHead: (a, b) => a.kind === b.kind,
  equal: sameAtom,
  children: atomChildren,
};

/**
 * Structural equality: a variable is a named node and equals only itself.
 *
 * The whole answer for the unifier and the `=` builtin, and the shared descent
 * they now spell once between them.
 */
export function equalAtoms(a: MeTTaAtom, b: MeTTaAtom): boolean {
  return structuralEqual(ATOM_EQUALITY, a, b);
}

/**
 * Structural match of `atom` against `pattern`: a variable anywhere in the
 * pattern matches anything in its slot.
 *
 * **Fails closed** — an unrecognised atom kind never matches, so a malformed atom
 * cannot widen a query's result set.
 */
export const matchesAtom = (atom: MeTTaAtom, pattern: MeTTaAtom): boolean =>
  structuralEqual(ATOM_EQUALITY, pattern, atom, 'wildcard');
