# ADR-018: C3 Hot-Path Profiling — No Action Needed

**Date:** 2026-09-27
**Status:** Accepted

## Context

TODO8 Phase C3 required profiling a golden scenario (belief-derivation-ask) to identify measurable hot-path fixes with ≥5% cycle-time win. Three candidates were identified in the plan:

1. **BudgetSlice allocation churn** — frequent `createBudgetSlice`/`consumeCycles` calls
2. **EmbeddingCache incremental insert** — `write()` on cache miss/hit paths
3. **`rankDerivations` comparator allocation** — `map`→`filter`→`sort`→`slice`→`map` chain per cycle

## Decision

After profiling (bench 119, `tests/nar/c3-hotpath-perf.test.ts`), **no fixes are adopted**. All three candidates measure well within acceptable limits:

| Hot Path | Measurement | Assessment |
|----------|-------------|------------|
| `createBudgetSlice` (child) | 1.31 ns/op | Negligible; 100K ops = 0.13 ms |
| `consumeCycles` | 0.37 ns/op | Negligible; 1M ops = 0.37 ms |
| `EmbeddingCache.write` (hit) | 5.72 ns/op | Fast; cache hits dominate |
| `EmbeddingCache.read` | 0.02 ns/op | Near-zero overhead |
| `rankDerivations` (100) | 12.89 ns/op | Well under budget |
| `rankDerivations` (1000) | 331.89 ns/op | Acceptable for rare large batches |
| `InferenceController.step()` | 87.77 ns/op | Includes sampling, priming, strategy |
| Premise scoring (100 targets) | 61.28 ns/op | O(1) link + co-activation lookup |

No candidate exceeds 1 µs/op. At 100 cycles/sec, total hot-path overhead < 0.1 ms/cycle — far below the 5% threshold (which would require ~5 ms savings per cycle at typical 100 ms/cycle).

## Consequences

- **Positive**: No speculative optimization; code simplicity preserved; golden parity (C31) trivially maintained.
- **Negative**: None — the "no action" decision is itself the optimization (avoiding churn).

## ADR-017 Reference

This ADR complements ADR-017 (Golden-scenario characterization as parity gate): the C3 gate is "measure and only adopt if ≥5% win". The measurements show 0% win available.

## Future Work

Re-profile when:
- Cycle time increases >2× (e.g., LM rule integration adds latency)
- New hot paths emerge (e.g., `EmbeddingCache` with real transformer generator)
- `rankDerivations` input size grows beyond 1000 regularly