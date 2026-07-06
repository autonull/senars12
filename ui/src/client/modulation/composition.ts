import type { Item, Modulation, View } from './types.js';
import { channel, compose, konst, when } from './operators.js';

export function timeGate(base: Modulation): Modulation {
  return compose(
    base,
    when(
      (item: Item, view: View) => (item.occurrenceTime ?? 0) <= view.timeline.t,
      channel('opacity', konst(1.0))
    ),
    when(
      (item: Item, view: View) => (item.occurrenceTime ?? Number.POSITIVE_INFINITY) > view.timeline.t,
      channel('opacity', konst(0.05))
    )
  );
}