import type { MeTTaAtom } from '../types/ast.js';
export type GroundedOp<Args extends readonly MeTTaAtom[] = readonly MeTTaAtom[], Ret extends MeTTaAtom = MeTTaAtom> = {
    readonly name: string;
    readonly execute: (...args: Args) => Ret;
    readonly pure?: boolean;
    readonly lazy?: boolean;
};
export declare function registerOp(name: string, op: GroundedOp): void;
export declare function getOp(name: string): GroundedOp | undefined;
export declare function hasOp(name: string): boolean;
export declare function clearOps(): void;
export declare function defineOp<Args extends readonly MeTTaAtom[], Ret extends MeTTaAtom>(name: string, impl: (...args: Args) => Ret, opts?: {
    pure?: boolean;
    lazy?: boolean;
}): GroundedOp<Args, Ret>;
//# sourceMappingURL=ops.d.ts.map