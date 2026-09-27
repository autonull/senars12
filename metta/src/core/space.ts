import { matches } from './pattern-match.js';
import type { MeTTaAtom } from '../types/ast.js';

export interface Space extends Disposable {
  readonly id: string;
  readonly size: number;
  readonly atoms: ReadonlyArray<MeTTaAtom>;

  add(atom: MeTTaAtom): void;

  remove(atom: MeTTaAtom): boolean;

  query(pattern: MeTTaAtom): Generator<MeTTaAtom>;
}

export class InMemorySpace implements Space {
  readonly id: string;
  private readonly _atoms: MeTTaAtom[] = [];

  constructor(id = 'default') {
    this.id = id;
  }

  get size(): number {
    return this._atoms.length;
  }

  get atoms(): ReadonlyArray<MeTTaAtom> {
    return this._atoms;
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

  [Symbol.dispose](): void {
    this._atoms.length = 0;
  }
}
