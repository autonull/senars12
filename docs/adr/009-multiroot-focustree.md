# ADR-009: Multi-root FocusTree Semantics

**Status**: Accepted
**Date**: 2026-09-26
**Deciders**: Architecture team

## Context

Phase D of REFACTOR.todo6 introduces parallel cognition capabilities. The existing `FocusTree` supported a single root with hierarchical children. To enable true parallel cognitive threads with independent budget slices, the tree structure was extended to support multiple independent roots (a forest).

## Decision

**Extend `FocusTree` with `addRoot(rootFocus, rootBudget)` to support multiple independent root nodes.**

### Changes

1. **Internal structure**: `root: FocusTreeNode` → `roots: FocusTreeNode[]`
2. **New method**: `addRoot(rootFocus: FocusOptions, rootBudget: BudgetSlice): FocusTreeNode`
3. **Modified methods**:
   - `sampleLeaf()` — now collects leaves from all roots
   - `getLeaves()` — iterates all roots
   - `getRootRollup()` — returns `FocusTreeRollup[]` (one per root)
   - `tick()` — samples across all roots proportionally by leaf weight
4. **Preserved parity**: Single-root usage (constructor only, no `addRoot` calls) behaves identically to before

### Budget Isolation

Each root receives its own `BudgetSlice` created via `createBudgetSlice()`. Child nodes under a root inherit from that root's budget via `sliceBudget()`, maintaining the existing hierarchical budget semantics within each tree. Roots are completely isolated — no budget sharing between trees.

### Weighted Sampling

Leaf sampling uses `node.weight` (from `FocusOptions.weight`) for proportional selection across all leaves in the forest. Root weight does not directly affect leaf sampling; only leaf node weights matter. This allows fine-grained control over scheduling priority.

## Consequences

- **Backward compatible**: Existing single-root code works unchanged
- **Parallel ready**: Multiple roots map to multiple `CognitiveThread` instances
- **Budget observability**: Each root's budget slice appears in `--budget` CLI output
- **Rollup aggregation**: `getRootRollup()` returns forest-level rollups for meta-learning

## Testing

Falsifying bench: `tests/nar/focustree-cognitivethread.test.ts` (31 tests)
- Single-root parity with flat scheduling
- Multi-root weighted sampling
- Independent budget slices per root
- Rollup aggregation across forest
- Depth limits enforced per tree

## References

- D1: `nar/src/focus/FocusTree.ts`
- D4: `tests/nar/focustree-cognitivethread.test.ts`
- REFACTOR.todo6.md Phase D