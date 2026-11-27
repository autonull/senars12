import { removeBy } from '@senars/util/collections';
import { matchesAtom } from './hash';
/**
 * Linear-scan space over an atom array: the shared substrate for every `Space`
 * implementation. Subclasses override {@link onAdd} for write side effects
 * (persistence, auto-save) rather than reimplementing `add`/`remove`/`query`.
 */
export class ArraySpace {
    id;
    _atoms = [];
    constructor(id = 'default') {
        this.id = id;
    }
    get size() {
        return this._atoms.length;
    }
    get atoms() {
        return this._atoms;
    }
    /** Write side effect hook, called after an atom is appended. */
    onAdd(_atom) { }
    add(atom) {
        this._atoms.push(atom);
        this.onAdd(atom);
    }
    remove(atom) {
        return removeBy(this._atoms, (candidate) => candidate === atom) !== undefined;
    }
    *query(pattern) {
        for (const atom of this._atoms) {
            if (matchesAtom(atom, pattern))
                yield atom;
        }
    }
}
export class InMemorySpace extends ArraySpace {
    [Symbol.dispose]() {
        this._atoms.length = 0;
    }
}
