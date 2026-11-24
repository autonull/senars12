# ADR 0001: Schema Unification

## Status
Accepted

## Context
The codebase had 152+ duplicate schema exports across multiple packages (nar, util, core, io, metta). Each package defined its own schemas with overlapping types, leading to:
- Type name collisions (60+)
- Inconsistent validation boundaries
- Maintenance burden when schemas change
- Import confusion for consumers

## Decision
Unify all schemas into a single source of truth under `src/schemas/` with:
- Centralized Zod schemas in `src/schemas/*.ts`
- Generated types in `src/generated/schemas.ts`
- Single export path via `@senars/schemas` barrel
- Genome generator (`src/formats/genome/index.ts`) as the authoritative source
- Schema drift gate (`schema:drift`) enforces generated artifacts are fresh

## Consequences

### Positive
- Single source of truth for all schemas
- Type-safe boundaries between packages
- Automated drift detection
- Reduced duplicate code (~152 exports eliminated)

### Negative
- Migration effort for existing imports
- All schema changes require regeneration
- Couples packages to central schema package

## References
- TODO.core.28.md W1: Schema Unification
- `scripts/schema-drift.ts`
- `src/formats/genome/index.ts`