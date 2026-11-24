# ADR 0002: Import Boundary Gates

## Status
Accepted

## Context
The "fold" (core reasoning modules: kernel, logics, loop, economy, faculties, admit, mining) must be free of ambient I/O and entropy for deterministic replay. Previously, there was no enforcement, leading to:
- `Math.random()` and `Date.now()` leaking into pure code
- Filesystem/network imports in pure modules
- Non-deterministic behavior in seeded runs

## Decision
Implement import boundary gate (`import:boundary`) that:
- Scans fold modules for forbidden patterns (fs, net, Math.random, Date.now)
- Maintains baseline in `scripts/import-boundary-baseline.json`
- Ratchet: only allows reducing violations, not adding
- Exempts seam modules (`kernel/env.ts`, `faculties/engine.ts`, etc.)
- Runs in CI on every PR

## Consequences

### Positive
- Guarantees deterministic replay for seeded runs
- Clear separation between pure fold and oracle seam
- Automated enforcement prevents regression

### Negative
- Requires routing all effects through `Env` seam
- Baseline maintenance overhead
- Some legitimate patterns (e.g., UUID generation) need explicit routing

## References
- TODO.core.28.md W22: Import Boundary Gates
- `scripts/import-boundary.ts`
- `scripts/import-boundary-baseline.json`