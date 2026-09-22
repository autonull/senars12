// Branded primitive types - no external dependencies
export type Timestamp = number & { readonly __brand: unique symbol };
export type Duration = number & { readonly __brand: unique symbol };

export const createTimestamp = (ms?: number): Timestamp => (ms ?? Date.now()) as Timestamp;
export const createDuration = (ms: number): Duration => ms as Duration;

export const DEPTH_MAX = 10 as const;

/** Injectable randomness — deterministic tests/simulations seed an LCG here. */
export type RandomSource = () => number;