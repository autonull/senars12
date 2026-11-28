import type { Clock } from '@senars/util/clock';
import type { RandomSource } from '@senars/types/primitives';
export interface BagSlotParams {
    config?: Record<string, unknown>;
}
export interface ResolvedBagSlot {
    decayRate?: number;
    forgetRate?: number;
    /**
     * The memory's randomness. One stream for every bag it builds and for the link
     * layer's random-forget policy, so seeding a NAR seeds the memory path
     * (TODO27 §16) — a slot is the only thing a memory is configured by.
     */
    rng?: RandomSource;
    /**
     * The memory's clock. `Bag` already took one for `createdAt`/`lastAccessedAt`;
     * a concept stamps its own the same way and reads it through this slot, so one
     * injected clock pins every retention fact the store holds rather than the
     * three the bags happened to own.
     */
    clock?: Clock;
}
/** Every error a `strategies.bag` slot can carry, phrased for `validateParameters`. */
export declare const bagSlotErrors: (slot: Partial<BagSlotParams> | undefined) => string[];
/** The single read path for the slot: validated decay/forget knobs plus the memory's stream. */
export declare const resolveBagSlot: (slot: Partial<BagSlotParams> | undefined, rng?: RandomSource, clock?: Clock) => ResolvedBagSlot;
//# sourceMappingURL=registration.d.ts.map