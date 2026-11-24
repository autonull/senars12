# ADR 0004: Script Consolidation

## Status
Accepted

## Context
The `scripts/` directory had 114+ TypeScript files with:
- Inconsistent import styles (.js vs .ts extensions)
- Duplicate barrel files
- No clear organization by domain
- 70+ entry points in package.json

## Decision
Consolidate scripts into organized library structure:
- `scripts/lib/core/` - shared types, verdicts, cycles, gates, bench, root, dispatch-table
- `scripts/lib/codegen/` - imports, source-scan, pkg, terms-canonical, layer-boundary, induction-inventory, narsese-literals, rule-fallback, module-closure
- `scripts/lib/analysis/` - attention-surface, complexity-budget, control-budgets, decision-manifest, accumulator-ledger
- `scripts/lib/protocol/` - proposal-protocol, provider-dependency, resource-policy, rule-table
- `scripts/lib/rl/` - rl-arms, dpdm
- All imports use `.ts` extensions for tsx compatibility
- `scripts/lib/index.ts` barrels all domains
- `scripts/gates-consolidated.ts` groups 45+ gates into 9 consolidated groups

## Consequences

### Positive
- Clear module boundaries by domain
- Single reader for production source (`source-scan.ts`)
- Consistent import style
- Gate consolidation reduces CI complexity

### Negative
- Migration effort for existing scripts
- Barrel files add indirection
- Some scripts still need individual fixes

## References
- TODO.core.28.md W20, W25, W26: Scripts/lib Consolidation
- `scripts/lib/`
- `scripts/gates-consolidated.ts`