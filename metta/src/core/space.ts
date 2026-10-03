import { removeBy } from '@senars/util';
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

/**
 * Linear-scan space over an atom array: the shared substrate for every `Space`
 * implementation. Subclasses override {@link onAdd} for write side effects
 * (persistence, auto-save) rather than reimplementing `add`/`remove`/`query`.
 */
export abstract class ArraySpace implements Space {
  abstract [Symbol.dispose](): void;

  readonly id: string;
  protected readonly _atoms: MeTTaAtom[] = [];

  constructor(id = 'default') {
    this.id = id;
  }

  get size(): number {
    return this._atoms.length;
  }

  get atoms(): ReadonlyArray<MeTTaAtom> {
    return this._atoms;
  }

  /** Write side effect hook, called after an atom is appended. */
  protected onAdd(_atom: MeTTaAtom): void {}

  add(atom: MeTTaAtom): void {
    this._atoms.push(atom);
    this.onAdd(atom);
  }

  remove(atom: MeTTaAtom): boolean {
    return removeBy(this._atoms, (candidate) => candidate === atom) !== undefined;
  }

  *query(pattern: MeTTaAtom): Generator<MeTTaAtom> {
    for (const atom of this._atoms) {
      if (matches(atom, pattern)) {
        yield atom;
      }
    }
  }
}

export class InMemorySpace extends ArraySpace {
  [Symbol.dispose](): void {
    this._atoms.length = 0;
  }
}
