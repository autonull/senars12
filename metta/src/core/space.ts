import type { MeTTaAtom } from '../types/ast.js';

export interface Space extends Disposable {
  readonly id: string;
  add(atom: MeTTaAtom): void;
  remove(atom: MeTTaAtom): boolean;
  query(pattern: MeTTaAtom): Generator<MeTTaAtom>;
  readonly size: number;
  readonly atoms: ReadonlyArray<MeTTaAtom>;
}

export class InMemorySpace implements Space {
  readonly id: string;
  private readonly _atoms: MeTTaAtom[] = [];

  constructor(id = 'default') {
    this.id = id;
  }

  add(atom: MeTTaAtom): void {
    this._atoms.push(atom);
  }

  remove(atom: MeTTaAtom): boolean {
    const index = this._atoms.indexOf(atom as never);
    if (index === -1) return false;
    this._atoms.splice(index, 1);
    return true;
  }

  *query(pattern: MeTTaAtom): Generator<MeTTaAtom> {
    for (const atom of this._atoms) {
      if (matches(atom, pattern)) {
        yield atom;
      }
    }
  }

  get size(): number {
    return this._atoms.length;
  }

  get atoms(): ReadonlyArray<MeTTaAtom> {
    return this._atoms;
  }

  [Symbol.dispose](): void {
    this._atoms.length = 0;
  }
}

function matches(atom: MeTTaAtom, pattern: MeTTaAtom): boolean {
  if (pattern.kind === 1) return true;
  if (atom.kind !== pattern.kind) return false;

  switch (atom.kind) {
    case 0:
      return (atom as { value: string }).value === (pattern as { value: string }).value;
    case 2:
      return (atom as { value: number }).value === (pattern as { value: number }).value;
    case 3:
      return (atom as { value: string }).value === (pattern as { value: string }).value;
    case 4: {
      const a = atom as { operator: MeTTaAtom; args: readonly MeTTaAtom[] };
      const p = pattern as { operator: MeTTaAtom; args: readonly MeTTaAtom[] };
      if (!matches(a.operator, p.operator)) return false;
      if (a.args.length !== p.args.length) return false;
      for (let i = 0; i < a.args.length; i++) {
        if (!matches(a.args[i] as MeTTaAtom, p.args[i] as MeTTaAtom)) return false;
      }
      return true;
    }
    case 5: {
      const a = atom as { op: string; args: readonly MeTTaAtom[] };
      const p = pattern as { op: string; args: readonly MeTTaAtom[] };
      if (a.op !== p.op) return false;
      if (a.args.length !== p.args.length) return false;
      for (let i = 0; i < a.args.length; i++) {
        if (!matches(a.args[i] as MeTTaAtom, p.args[i] as MeTTaAtom)) return false;
      }
      return true;
    }
    default:
      return false;
  }
}
