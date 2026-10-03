import { formatIssues } from '@senars/util';
import { z } from 'zod';
import { ConfigurationError } from '../types';
import type { RandomSource } from '../types/primitives.js';

/**
 * The `strategies.bag` slot's contract (TODO27 §11.4 — the last slot without one).
 *
 * A bag is not a strategy: bags are constructed per concept, so there is no
 * instance for a registry to hold. What the slot *does* have is its
 * configuration, and that is what this module validates — a typo is a
 * `ConfigurationError` at the boundary rather than a silently dropped knob.
 * There is no `type` to choose: `PriorityBag` is the only AIKR queue, so a name
 * for the choice would be a knob that cannot turn anything.
 */

const bagConfig = z
  .object({
    decayRate: z.number().min(0).max(1).optional(),
    forgetRate: z.number().min(0).max(1).optional(),
  })
  .strict();

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
}

/** Every error a `strategies.bag` slot can carry, phrased for `validateParameters`. */
export const bagSlotErrors = (slot: Partial<BagSlotParams> | undefined): string[] => {
  if (slot?.config === undefined) return [];
  const parsed = bagConfig.safeParse(slot.config);
  return parsed.success ? [] : [`strategies.bag.config: ${formatIssues(parsed.error.issues)}`];
};

/** The single read path for the slot: validated decay/forget knobs plus the memory's stream. */
export const resolveBagSlot = (
  slot: Partial<BagSlotParams> | undefined,
  rng?: RandomSource
): ResolvedBagSlot => {
  const errors = bagSlotErrors(slot);
  if (errors.length) throw new ConfigurationError(errors.join('; '));
  const parsed = slot?.config === undefined ? undefined : bagConfig.parse(slot.config);
  return { decayRate: parsed?.decayRate, forgetRate: parsed?.forgetRate, rng };
};
