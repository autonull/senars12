import type {
  ExpressionAtom,
  GroundedAtom,
  MeTTaAtom,
  NumberAtom,
  StringAtom,
  SymbolAtom,
} from '../types/ast.js';

/**
 * Structural pattern match used by every space implementation.
 *
 * Fails **closed**: an unrecognised atom kind never matches, so a malformed atom cannot
 * widen a query's result set. `AtomKind.Variable` patterns match any atom of the same slot.
 */
export function matches(atom: MeTTaAtom, pattern: MeTTaAtom): boolean {
  if (pattern.kind === 1) return true;
  if (atom.kind !== pattern.kind) return false;

  switch (atom.kind) {
    case 0:
      return (atom as SymbolAtom).value === (pattern as SymbolAtom).value;
    case 2:
      return (atom as NumberAtom).value === (pattern as NumberAtom).value;
    case 3:
      return (atom as StringAtom).value === (pattern as StringAtom).value;
    case 4: {
      const a = atom as ExpressionAtom;
      const p = pattern as ExpressionAtom;
      if (!matches(a.operator, p.operator)) return false;
      if (a.args.length !== p.args.length) return false;
      return a.args.every((arg, i) => matches(arg, p.args[i] as MeTTaAtom));
    }
    case 5: {
      const a = atom as GroundedAtom;
      const p = pattern as GroundedAtom;
      if (a.op !== p.op) return false;
      if (a.args.length !== p.args.length) return false;
      return a.args.every((arg, i) => matches(arg, p.args[i] as MeTTaAtom));
    }
    default:
      return false;
  }
}
