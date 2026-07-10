import type {
  ExpressionAtom,
  GroundedAtom,
  MeTTaAtom,
  NumberAtom,
  StringAtom,
  SymbolAtom,
  VariableAtom,
} from '../types/ast.js';

const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

function fnv1a(data: string): number {
  let hash = FNV_OFFSET;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash *= FNV_PRIME;
  }
  return hash >>> 0;
}

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
      for (const arg of expr.args) {
        h = (h ^ hashAtom(arg)) * FNV_PRIME;
      }
      return h >>> 0;
    }
    case 5: {
      const grounded = atom as GroundedAtom;
      let h = fnv1a(`grounded:${grounded.op}`);
      for (const arg of grounded.args) {
        h = (h ^ hashAtom(arg)) * FNV_PRIME;
      }
      return h >>> 0;
    }
    default:
      throw new Error(`Unknown atom kind: ${(atom as MeTTaAtom).kind}`);
  }
}

export function equalAtoms(a: MeTTaAtom, b: MeTTaAtom): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 0:
      return (a as SymbolAtom).value === (b as SymbolAtom).value;
    case 1:
      return (a as VariableAtom).name === (b as VariableAtom).name;
    case 2:
      return (a as NumberAtom).value === (b as NumberAtom).value;
    case 3:
      return (a as StringAtom).value === (b as StringAtom).value;
    case 4: {
      const ae = a as ExpressionAtom;
      const be = b as ExpressionAtom;
      if (!equalAtoms(ae.operator, be.operator)) return false;
      if (ae.args.length !== be.args.length) return false;
      for (let i = 0; i < ae.args.length; i++) {
        if (!equalAtoms(ae.args[i] as MeTTaAtom, be.args[i] as MeTTaAtom)) return false;
      }
      return true;
    }
    case 5: {
      const ag = a as GroundedAtom;
      const bg = b as GroundedAtom;
      if (ag.op !== bg.op) return false;
      if (ag.args.length !== bg.args.length) return false;
      for (let i = 0; i < ag.args.length; i++) {
        if (!equalAtoms(ag.args[i] as MeTTaAtom, bg.args[i] as MeTTaAtom)) return false;
      }
      return true;
    }
    default:
      return false;
  }
}
