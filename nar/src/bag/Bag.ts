/**
 * The AIKR bag's implementation lives in `@senars/util/bag` (§22): the attention
 * substrate the UI needs is the same general-purpose container `nar` has been
 * carrying. This module is the nar-side shim — its 17 module dependencies and the
 * `@senars/nar/bag` public subpath import from here, and the existing suites
 * prove the lift did not change behaviour.
 *
 * The one thing `util` cannot own is the domain-event vocabulary, so the
 * announcement is injected here: `@senars/util` owns the policy, this layer owns
 * the sink.
 */
import { emitDomainEvent } from '@senars/core/event-sink';
import {
  type BagItem,
  type BagOptions,
  type PressureTransition,
  PriorityBag as BasePriorityBag,
} from '@senars/util/bag';

/** The pressure transition as the domain-event log has always carried it. */
const announcePressure = ({
  bagId,
  pressure,
  capacity,
  size,
  transition,
}: PressureTransition): void =>
  emitDomainEvent('bag.pressure.transition', '', { bagId, pressure, capacity, size, transition });

/** The AIKR bag with `nar`'s observability default wired in; a caller's `onPressure` overrides it. */
export class PriorityBag<T extends BagItem> extends BasePriorityBag<T> {
  constructor(options: BagOptions) {
    super({ onPressure: announcePressure, ...options });
  }
}

export type { AIKRBudget } from '@senars/core/budget';

export type {
  Bag,
  BagItem,
  BagOptions,
  CyclesBudget,
  EvictStrategy,
  InternalEntry,
  PressureListener,
  PressureTransition,
  RandomSource,
} from '@senars/util/bag';
