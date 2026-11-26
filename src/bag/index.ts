import { emitDomainEvent } from '../agent/event-sink';
import { DOMAIN_EVENTS } from '../events';
import {
  PriorityBag,
  type Bag,
  type BagItem,
  type BagOptions,
  type PressureTransition,
  type EvictStrategy,
  type Histogram,
  type PressureLevel,
  type PressureListener,
  type CyclesBudget,
  type RandomSource,
} from '../util/bag';

export { PriorityBag };
export type {
  Bag,
  BagItem,
  BagOptions,
  EvictStrategy,
  Histogram,
  PressureLevel,
  PressureListener,
  PressureTransition,
  CyclesBudget,
  RandomSource,
} from '../util/bag';

export type { BagSlotParams, ResolvedBagSlot } from './registration';
export { bagSlotErrors, resolveBagSlot } from './registration';
export type { InternalEntry } from './types';

/** Announce pressure transitions as domain events. */
const announcePressure = ({
  bagId,
  pressure,
  capacity,
  size,
  transition,
}: PressureTransition): void =>
  emitDomainEvent(DOMAIN_EVENTS.BAG_PRESSURE_TRANSITION, '', { bagId, pressure, capacity, size, transition });

/** The one construction path for an AIKR bag: capacity is the caller's bound, the rest is knobs. */
export const createBag = <T extends BagItem>(options: BagOptions): Bag<T> =>
  new PriorityBag<T>({ onPressure: announcePressure, ...options });
