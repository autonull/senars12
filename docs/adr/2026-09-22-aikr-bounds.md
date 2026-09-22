# ADR: AIKR Budget Economics Enforced by Capacity-Bounded Bags

## Status

Accepted

## Date

2026-09-22

## Context

NARS assumes AIKR: insufficient knowledge and resources. Every data structure
must therefore be capacity-bounded, and forgetting must be principled rather
than incidental. Unbounded priority queues silently violate this assumption
and make latency and memory unpredictable.

## Decision

The `Bag<T>` in `nar/src/bag/Bag.ts` is the canonical bounded priority
container:

- Constructor takes `capacity` plus `decayRate` (default 0.01) and
  `forgetRate` (default 0.001); both clamped to [0, 1].
- `decay(rate?)` multiplies entry priorities by the decay rate and drops
  entries below `forgetRate` — forgetting is a byproduct of decay, not a
  separate sweep.
- Sampling is priority-biased: `sample()` and `sampleMany(budget)` accept an
  `AIKRBudget | number`, so inference work is allocated against an explicit
  budget rather than "process everything".
- Priority sub-bags (`PriorityBag`) reuse the same strategy for concepts and
  memory (`memory/concept.ts`).

Attention allocation is hierarchical: `focus/focus-scheduler.ts`
(`FocusScheduler`) decides which focus gets ticks each cycle, and each focus
(e.g. `FocusBag`) spends its share of the budget on its own bag sampling.

## Consequences

- Memory and per-tick cost are bounded by construction; no unbounded queue
  exists in the reasoning path.
- Budget decisions are explicit at call sites (`sampleMany(budget)`), making
  resource allocation auditable.
- Decay/forget rates are tunable per bag; defaults are conservative.
- Losing items is a feature: dropped low-priority entries are the price of
  bounded operation and must be accounted for in recall tests.

## References

- `nar/src/bag/Bag.ts`
- `nar/src/bag/index.ts`
- `nar/src/memory/concept.ts`
- `nar/src/focus/focus-scheduler.ts`
- `nar/src/focus/FocusBag.ts`
- `nar/src/tick/tick.ts`
