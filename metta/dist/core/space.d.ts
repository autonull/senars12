import type { MeTTaAtom } from '../types/ast.js';
export interface Space extends Disposable {
    readonly id: string;
    add(atom: MeTTaAtom): void;
    remove(atom: MeTTaAtom): boolean;
    query(pattern: MeTTaAtom): Generator<MeTTaAtom>;
    readonly size: number;
    readonly atoms: ReadonlyArray<MeTTaAtom>;
}
export declare class InMemorySpace implements Space {
    readonly id: string;
    private readonly _atoms;
    constructor(id?: string);
    add(atom: MeTTaAtom): void;
    remove(atom: MeTTaAtom): boolean;
    query(pattern: MeTTaAtom): Generator<MeTTaAtom>;
    get size(): number;
    get atoms(): ReadonlyArray<MeTTaAtom>;
    [Symbol.dispose](): void;
}
//# sourceMappingURL=space.d.ts.map