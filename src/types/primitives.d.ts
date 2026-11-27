export type Timestamp = number & {
    readonly __brand: unique symbol;
};
export type Duration = number & {
    readonly __brand: unique symbol;
};
export declare const createTimestamp: (ms?: number) => Timestamp;
export declare const createDuration: (ms: number) => Duration;
export declare const DEPTH_MAX: 10;
/** Injectable randomness — deterministic tests/simulations seed an LCG here. */
export type { RandomSource } from '@senars/util/random';
//# sourceMappingURL=primitives.d.ts.map