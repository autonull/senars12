/**
 * Cross-component UI signals. One `EventBus`, the shared one — this used to be a
 * second implementation whose listener loop had no error isolation, so one
 * throwing subscriber silently cancelled every subscriber behind it and the
 * component that owned it just stopped responding. `ListenerBag` isolates and
 * logs each listener instead.
 *
 * The event map is what the previous untyped version could not give: a
 * misspelled event name or a `pan-to` carrying the wrong shape is a compile
 * error rather than a dead control.
 */
import { EventBus } from '@senars/util';

/**
 * Payload per signal. `void` marks a signal that carries nothing, and is emitted
 * with no argument. A `type` rather than an `interface` because `EventBus`
 * constrains its map to `Record<string, unknown>`, which only a type alias
 * satisfies — an interface would need a hand-written index signature.
 */
export type UiSignals = {
  'graph:search': string;
  'graph:layout': string;
  'graph:pan-to': { x: number; y: number };
  'graph:zoom-in': void;
  'graph:zoom-out': void;
  'graph:fit': void;
  'graph:minimap-toggle': void;
};

export const eventBus = new EventBus<UiSignals>();
