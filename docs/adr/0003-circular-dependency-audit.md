# ADR 0003: Circular Dependency Audit

## Status
Accepted

## Context
The codebase had 276+ circular dependency chains at project start. Through incremental refactoring:
- Type-only edges removed with `--transform`
- Contract/impl splits broke cycles
- Agent factory extraction resolved `nar/src/agent/` cycle
- Current baseline: 6 cycles (44 raw)

Two new cycles discovered in `src/kernel/terms/` during TODO28:
- `term-internal/index.ts → variable.ts → unify.ts → intern.ts`

## Decision
Implement cycle budget gate (`deps:gate`) using `dpdm` that:
- Counts circular chains with `--transform` (erases type-only edges)
- Maintains baseline in `scripts/deps-gate.ts` (`BASELINE = 6`)
- Ratchet: fails on regression or slack
- Runs in CI on every PR
- W24 tracks resolution of remaining 6 cycles

## Consequences

### Positive
- Prevents architectural degradation
- Forces explicit dependency management
- Clear metric for refactoring progress

### Negative
- Some cycles are inherent to mutual recursion (unify/intern)
- Baseline updates require justification
- `--transform` hides type-only cycles that may matter

## References
- TODO.core.28.md W24: Circular Dependency Audit
- `scripts/deps-gate.ts`
- `scripts/lib/rl/dpdm.ts`