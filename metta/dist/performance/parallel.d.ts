import { Effect } from 'effect';
import type { MeTTaAtom } from '../types/ast.js';
export interface ParallelOptions {
    readonly workers?: number;
    readonly chunkSize?: number;
}
export declare const parallelReduce: (atoms: readonly MeTTaAtom[], reducer: (atom: MeTTaAtom) => MeTTaAtom, opts?: ParallelOptions) => Effect.Effect<readonly MeTTaAtom[], Error>;
export declare const parallelMap: <T, R>(items: readonly T[], mapper: (item: T) => R, opts?: ParallelOptions) => Effect.Effect<readonly R[], Error>;
//# sourceMappingURL=parallel.d.ts.map