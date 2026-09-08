import type {MeTTaAtom} from './ast.js';

export interface MeTTaSpace {
    readonly id: string;
    readonly size: number;

    add(atom: MeTTaAtom): void;

    remove(atom: MeTTaAtom): boolean;

    query(pattern: MeTTaAtom): Generator<MeTTaAtom>;
}

export interface ImmutableSpace extends MeTTaSpace {
    readonly atoms: ReadonlyArray<MeTTaAtom>;

    withAtom(atom: MeTTaAtom): ImmutableSpace;
}
