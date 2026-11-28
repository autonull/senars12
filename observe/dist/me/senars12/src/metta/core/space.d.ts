import type { MeTTaAtom } from '../types/ast';
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
export declare abstract class ArraySpace implements Space {
    abstract [Symbol.dispose](): void;
    readonly id: string;
    protected readonly _atoms: MeTTaAtom[];
    constructor(id?: string);
    get size(): number;
    get atoms(): ReadonlyArray<MeTTaAtom>;
    /** Write side effect hook, called after an atom is appended. */
    protected onAdd(_atom: MeTTaAtom): void;
    add(atom: MeTTaAtom): void;
    remove(atom: MeTTaAtom): boolean;
    query(pattern: MeTTaAtom): Generator<MeTTaAtom>;
}
export declare class InMemorySpace extends ArraySpace {
    [Symbol.dispose](): void;
}
//# sourceMappingURL=space.d.ts.map