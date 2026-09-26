# ADR-006: FenwickBag Default Decision

**Status**: Accepted
**Date**: 2026-09-26
**Deciders**: Architecture team

## Context

TODO5 introduced two Bag implementations behind the `strategies.bag` knob:
- `PriorityBag` (default) — array-backed, O(n) add/sample/evict, simple and correct
- `FenwickBag` (alternate) — Fenwick tree for O(log n) sampling, but O(n) add/evict due to array splice + tree rebuild

The TODO5 claim was "FenwickBag provides O(log n) sample vs O(n) for PriorityBag" with statistical parity via KS-test. However:
- No fidelity tests existed for FenwickBag (TODO5 gap §3b)
- No performance benchmarks compared both implementations (TODO5 gap §3b)
- `add` is O(n) in FenwickBag (findIndex + splice + rebuildTree), not O(log n)
- The `strategies.bag` knob was never wired to `Memory.addConcept` (dead config, A4)

## Evidence (B1 + B2)

### Fidelity (B1 — bag-fidelity.test.ts)
- **TV-distance ≤ 0.02 @ 50k samples**: Both implementations PASS
- **Chi-squared test (p=0.05)**: Both implementations PASS
- **Post-removal fidelity**: Both implementations PASS after `remove()` and `removeMany()`
- **Seed parity**: Identical sample sequences for same seed/rng across implementations — PASS
- **Decay uniformity**: Relative priorities preserved — PASS
- **EvictStrategy invariant preservation**: LRU/LowestPriority/Random all maintain sorted order — PASS
- **Round-trip serialization**: Cross-implementation (PriorityBag → FenwickBag) — PASS

### Performance (B2 — bag-perf.test.ts, N=1000)

| Operation | PriorityBag | FenwickBag | Ratio |
|-----------|-------------|------------|-------|
| `add` (insert-heavy) | 8.2 μs | 2,098 μs | **256× slower** |
| `sample` (insert-heavy) | 3.5 μs | 3.3 μs | ~1× (FenwickBag marginally faster) |
| `evict` (insert-heavy) | 1.2 μs | 2,691 μs | **2,243× slower** |
| `add` (sample-heavy) | 6.9 μs | 1,876 μs | **272× slower** |
| `sample` (sample-heavy) | 2.6 μs | 1.5 μs | **1.7× faster** |
| `evict` (sample-heavy) | 0.8 μs | 1,906 μs | **2,383× slower** |
| Pure sample | 1.9 μs | 1.2 μs | **1.6× faster** |
| Pure add | 6.1 μs | 1,724 μs | **283× slower** |

## Decision

**Keep `PriorityBag` as the default implementation.**

### Rationale

1. **No sample-heavy p99 speedup ≥ 3× at 10k+**: FenwickBag's `sample` is only ~1.6× faster, well below the 3× threshold proposed in REFACTOR.todo6.md §B3.

2. **Catastrophic add/evict regression**: FenwickBag's `add` and `evict` are 250–3000× slower due to O(n) array splice + tree rebuild. Real workloads (ContrastiveMemory, HardNegatives, EpisodeConsolidator) are insert-heavy or mixed.

3. **Fidelity is equivalent**: Both implementations pass identical statistical fidelity tests. No accuracy advantage for FenwickBag.

4. **Knob remains for opt-in**: `strategies.bag.type = 'fenwick'` is now wired (A4 complete) for any future workload that is *purely* sample-heavy with static populations. Default stays `'priority'`.

## Consequences

- `DEFAULT_COGNITIVE_PARAMETERS.strategies.bag.type` remains `'priority'`
- `FenwickBag` stays exported and tested for opt-in use
- ADR-006 records the evidence; no code removal
- Future reconsideration if a workload demonstrates ≥ 3× sample-heavy p99 speedup at scale with fidelity intact

## References

- B1: `tests/nar/bag-fidelity.test.ts` (20 tests)
- B2: `tests/benchmark/bag-perf.test.ts` (8 tests)
- A4: `strategies.bag` knob wiring in `nar/src/memory/memory.ts:231`
- REFACTOR.todo6.md §B3 decision rule