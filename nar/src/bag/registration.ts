/**
 * The `strategies.bag` slot's contract (TODO27 §11.4 — the last slot without one).
 *
 * A bag is not a strategy: bags are constructed per concept, so there is no
 * instance for a registry to hold. What the slot *does* have is a name and a
 * configuration bag, and those are the two things this module validates. The
 * per-concept construction stays in `createBag`; only the choice and the knobs
 * come from here, so a typo is a `ConfigurationError` at the boundary rather
 * than a silent fallback to the default implementation.
 */

import { formatIssues } from '@senars/util';
import { z } from 'zod';
import { ConfigurationError } from '../types';
import type { RandomSource } from '../types/primitives.js';
import type { BagImplementation } from './Bag.js';

export const BAG_IMPLEMENTATIONS = ['priority', 'fenwick'] as const satisfies readonly BagImplementation[];

export type { BagImplementation };

const bagConfig = z
  .object({
    decayRate: z.number().min(0).max(1).optional(),
    forgetRate: z.number().min(0).max(1).optional(),
  })
  .strict();

export interface BagSlotParams {
  type: BagImplementation;
  config?: Record<string, unknown>;
}

export interface ResolvedBagSlot {
  implementation: BagImplementation;
  decayRate?: number;
  forgetRate?: number;
  /**
   * The memory's randomness. One stream for every bag it builds and for the link
   * layer's random-forget policy, so seeding a NAR seeds the memory path
   * (TODO27 §16) — a slot is the only thing a memory is configured by.
   */
  rng?: RandomSource;
}

const unknownImplementation = (name: string) =>
  `strategies.bag.type: no bag implementation named '${name}' (available: ${BAG_IMPLEMENTATIONS.join(', ')})`;

/** Every error a `strategies.bag` slot can carry, phrased for `validateParameters`. */
export const bagSlotErrors = (slot: Partial<BagSlotParams> | undefined): string[] => {
  if (!slot) return [];
  const errors: string[] = [];
  if (!(BAG_IMPLEMENTATIONS as readonly string[]).includes(String(slot.type))) {
    errors.push(unknownImplementation(String(slot.type)));
    return errors;
  }
  if (slot.config === undefined) return errors;
  const parsed = bagConfig.safeParse(slot.config);
  if (!parsed.success) {
    errors.push(`strategies.bag.config: ${formatIssues(parsed.error.issues)}`);
    return errors;
  }
  return errors;
};

/** The single read path for the slot: a validated `{ implementation, …knobs, rng }`. */
export const resolveBagSlot = (
  slot: Partial<BagSlotParams> | undefined,
  rng?: RandomSource
): ResolvedBagSlot => {
  const errors = bagSlotErrors(slot);
  if (errors.length) throw new ConfigurationError(errors.join('; '));
  const parsed = slot?.config === undefined ? undefined : bagConfig.parse(slot.config);
  return {
    implementation: (slot?.type ?? 'priority') as BagImplementation,
    decayRate: parsed?.decayRate,
    forgetRate: parsed?.forgetRate,
    rng,
  };
};
