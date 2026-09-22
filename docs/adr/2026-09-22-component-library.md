# ADR: Shared Component Library for Cognitive Subsystems

## Status

Accepted

## Date

2026-09-22

## Context

Cognitive subsystems (memory, focus, reason, reflex, game) repeat the same
scaffolding: lifecycle management, config resolution, strategy selection,
resilience (retry/circuit-break), and result handling. Copying this per
subsystem drifts behavior and multiplies maintenance.

## Decision

Shared primitives live in three places and are consumed by all subsystems:

- `nar/src/lifecycle/BaseComponent.ts` — common component lifecycle;
  registration via `cognitive/registry.ts` / `lifecycle/Container.ts`.
- `nar/src/config/cognitive-parameters.ts` — single source of default
  parameters (`DEFAULT_COGNITIVE_PARAMETERS`, deep-frozen) with grouped
  interfaces (`AttentionConfig`, `InferenceConfig`, `MemoryConfig`,
  `LMConfig`, `PriorityConfig`).
- `nar/src/utils/` — cross-cutting utilities: `result.ts` (Result type),
  `resilience.ts` + `circuit-breaker.ts`, `throttle.ts`, `weak-cache.ts`,
  `collections.ts`, `hash.ts`, `similarity.ts`.

Strategies are plug-ins over this base: `reason/strategy.ts` defines the
`Strategy` interface with `BagStrategy` (priority-sampled) and
`ExhaustiveStrategy` as swappable reasoners, and bag behavior itself is
parameterized (`decayRate`, `forgetRate`, sampling budget).

## Consequences

- One lifecycle, one defaults table, one resilience story: behavioral drift
  between subsystems is eliminated by construction.
- Strategy selection is data, not branching code; new strategies implement
  `Strategy` without touching call sites.
- Deep-frozen defaults prevent accidental mutation of shared config.
- Cost: changes to `BaseComponent` or `cognitive-parameters.ts` are
  cross-cutting and need broader review.

## References

- `nar/src/lifecycle/BaseComponent.ts`
- `nar/src/lifecycle/Container.ts`
- `nar/src/cognitive/registry.ts`
- `nar/src/config/cognitive-parameters.ts`
- `nar/src/reason/strategy.ts`
- `nar/src/utils/`
