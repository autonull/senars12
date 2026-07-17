import type { MeTTaAtom } from './ast.js';
export interface MeTTaSpace {
    readonly id: string;
    add(atom: MeTTaAtom): void;
    remove(atom: MeTTaAtom): boolean;
    query(pattern: MeTTaAtom): Generator<MeTTaAtom>;
    readonly size: number;
}
export interface ImmutableSpace extends MeTTaSpace {
    readonly atoms: ReadonlyArray<MeTTaAtom>;
    withAtom(atom: MeTTaAtom): ImmutableSpace;
}
//# sourceMappingURL=space.d.ts.map