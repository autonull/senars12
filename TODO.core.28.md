# TODO.core.28 — Post-Consolidation Quality & Architecture Plan

**Status:** 📋 **Planning** — builds on TODO.core.27 (all 12 workstreams complete)
**Parent:** Supersedes/refines `TODO.core.27.md` deferred quality workstreams (Q2–Q4)
**Principle:** *Consolidate proven duplicates; eliminate structural drift; harden seams; never lose behavior.*
**Last updated:** 2026-11-23 — 47 redundant util barrels removed, systemone.ts (676→19 files), dialogue.ts (316→11 files), config/nar.ts consolidated

---

## 1. Executive Summary

| Category | Workstreams | Impact | Effort | Risk |
|----------|-------------|--------|--------|------|
| **Schema Unification** | W1–W3 | ★★★★★ | L | Medium |
| **Duplicate Elimination** | W4–W6 | ★★★★☆ | M | Low |
| **Large File Decomposition** | W7–W10 | ★★★★☆ | M | Low |
| **Seam Hardening** | W11–W13 | ★★★★☆ | S | Low |
| **Boundary Enforcement** | W14–W16 | ★★★★★ | S | Low |

**Total: 16 workstreams, ~8 weeks (vs 20+ unconsolidated)**

---

## 2. Workstreams (Dependency-Optimized)

### Phase 1: Schema Unification (Weeks 1–2) — *Blocks everything*

| ID | Workstream | Merges | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W1** | **Generated ↔ Manual Schema Unification** | 152 common exports | ★★★★★ | L | — |
| **W2** | **Truth Table Consolidation** | verifier-truth-table ↔ verify-derivation | ★★★★★ | M | W1 |
| **W3** | **Constant Canonicalization** | 30+ duplicated constants | ★★★★☆ | S | W1 |

### Phase 2: Duplicate Elimination (Weeks 2–3) — *Parallelizable*

| ID | Workstream | Merges | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W4** | **Interface/Class Name Collisions** | 60+ duplicate type names | ★★★★☆ | M | W1 |
| **W5** | **Function/Constant Duplication** | 80+ duplicate exports | ★★★★☆ | S | W1 |
| **W6** | **Bag/Type Redundancy** | bag/types.ts ↔ util/bag.ts | ★★★★☆ | S | W1 |

### Phase 3: Large File Decomposition (Weeks 3–4) — *Parallelizable*

| ID | Workstream | Target | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W7** | **genome.ts (1,756 lines)** | Split into domain modules | ★★★★☆ | M | W1 |
| **W8** | **nar.ts (1,251 lines)** | Extract sub-modules | ★★★★☆ | M | W2 |
| **W9** | **economy/learning.ts (1,011 lines)** | Split by concern | ★★★★☆ | M | W2 |
| **W10** | **util/collections.ts (900 lines)** | Split by domain | ★★★★☆ | S | — |

### Phase 4: Seam Hardening (Weeks 4–5) — *Parallelizable*

| ID | Workstream | Target | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W11** | **MCP Tools Consolidation** | 7 mcp/*.ts files | ★★★★☆ | S | W1 |
| **W12** | **Bin Lib Consolidation** | 14 small bin/lib modules | ★★★★☆ | S | — |
| **W13** | **Agent/Type Duplication** | AgentOptions, ChatOptions, ToolCall | ★★★★☆ | S | W4 |

### Phase 5: Boundary Enforcement (Weeks 5–6) — *Parallelizable*

| ID | Workstream | Target | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W14** | **Import Boundary Gates** | Enforce @senars/* boundaries | ★★★★★ | S | W1 |
| **W15** | **Config Schema Drift Gate** | schema:drift for all generated | ★★★★★ | S | W1 |
| **W16** | **Circular Dependency Audit** | Eliminate remaining cycles | ★★★★★ | S | W1 |

---

## 3. Workstream Details

### W1: Generated ↔ Manual Schema Unification (Week 1–2)

**Problem:** 152 common exports between `src/generated/schemas.ts` (genome output) and `src/schemas/` (manual). Two naming conventions: PascalCase (manual) vs UPPER_CASE (generated). Both used throughout codebase.

**Scope:**
- `TASK_TYPES`, `TASK_BAG_KINDS`, `TASK_PUNCTUATIONS`, `SOURCE_QUALITY`, `RULE_CATEGORIES`
- `RISK_LEVELS`, `CAPABILITY_RISKS`, `ENGINE_ORIGINS`, `PROPOSER_ORIGIN`, `NAR_ORIGIN`
- `AMBIGUITY_TYPES`, `AMBIGUITY_SEVERITIES`, `DETECTED_INTENTS`, `STIMULUS_SOURCES`
- `AUTONOMY_MODES`, `AUTONOMITY_AUTHORITIES`, `PROPOSAL_KINDS`, `PROPOSAL_REJECTIONS`
- `BUDGET_SCOPE_IDS`, `BUDGET_TYPES`, `KERNEL_CONTROL_STATES`
- All `*Schema` zod validators duplicated

**Approach:**
1. **Single source of truth:** genome.ts becomes canonical for all enum/constant definitions
2. **Generated re-exports:** `src/schemas/` becomes thin re-export layer from `src/generated/schemas.ts`
3. **Naming convention:** Keep PascalCase types in generated; add UPPER_CASE aliases where needed
4. **Migration:** Update all imports to `@senars/schemas` (already the barrel); remove direct `@senars/generated` imports

**Deliverables:**
- [ ] genome.ts defines ALL enums/constants/schemas once
- [ ] src/schemas/*.ts re-export from @senars/generated
- [ ] All 152 duplicate exports resolved
- [ ] Zero behavior change verified by tests

**Risk Mitigation:**
- Run `schema:drift` after each sub-step
- Keep manual schemas as re-exports until all imports migrated
- TypeScript compilation validates no type drift

---

### W2: Truth Table Consolidation (Week 2)

**Problem:** Two independent truth tables with 80% overlap but different implementations:
- `src/rules/verifier-truth-table.ts` — exact copies from engine for drift detection
- `src/verification/verify-derivation.ts` — transcribed NAL algebra for independent verification

**Overlap:** 15 binary ops + unary ops (deduction, induction, abduction, exemplification, comparison, analogy, resemblance, intersection, union, revision, detachment, contraposition, sameness)

**Approach:**
1. **Extract shared core:** Create `src/verification/truth-core.ts` with canonical implementations
2. **Verifier imports core:** `verifier-truth-table.ts` imports + adds declared drift (revision:frequency)
3. **Verifier imports core:** `verify-derivation.ts` imports + adds inference helpers
4. **Drift test validates:** Both consumers produce same results for non-drift ops

**Deliverables:**
- [ ] `truth-core.ts` with 15 shared operations
- [ ] Both consumers import from core
- [ ] Drift test (`verifier-drift.test.ts`) still detects declared drift
- [ ] Zero behavior change

---

### W3: Constant Canonicalization (Week 1–2)

**Problem:** 30+ constants defined in multiple places:
- `unitInterval`, `signedUnitInterval`, `nonEmpty`, `uuid`, `nonNegativeInt`, `positiveInt`, `timestamp` — in `config/boundary.ts` AND `generated/schemas.ts`
- `configDigest` — in `config/digest.ts` AND `strategies/registration.ts`
- `cognitiveBounds` — in `config/bound-table.ts` AND `config/cognitive-bounds.ts`
- `systemOneOf` — in `commands/context.ts` AND `commands/systemone/constants.ts`
- `TASK_BAG_KINDS` — in `economy/types.ts`, `generated/schemas.ts`, `schemas/task.ts`

**Approach:** Single definition in most logical location, re-export elsewhere.

| Constant | Canonical Location | Re-export From |
|----------|-------------------|----------------|
| `unitInterval` family | `config/boundary.ts` | `@senars/config` |
| `configDigest` | `config/digest.ts` | `@senars/config` |
| `cognitiveBounds` | `config/bound-table.ts` | `@senars/config` |
| `systemOneOf` | `commands/context.ts` | `@senars/commands` |
| `TASK_BAG_KINDS` | `schemas/task.ts` | `@senars/schemas` |
| `TASK_TYPES` | `schemas/task.ts` | `@senars/schemas` |
| `ENGINE_ORIGINS` | `util/origins.ts` | `@senars/util` |

---

### W4: Interface/Class Name Collisions (Week 2–3)

**Problem:** 60+ duplicate type names causing confusion and potential import errors.

**High-Priority Collisions:**
| Name | Locations | Resolution |
|------|-----------|------------|
| `Gate` | `admit/lifecycle.ts`, `lm/service/accounting.ts` | Rename LM one to `AccountingGate` |
| `GateResult` | `admit/lifecycle.ts`, `governance/risk-verdict.ts` | Rename governance to `RiskVerdict` |
| `PolicyEngine` | `admit/policies.ts`, `agent/PolicyEngine.ts` | Merge or namespace |
| `ProjectionEngine` | `admit/projections.ts`, `logics/projections.ts` | Merge into `logics` |
| `ToolCall` | `agent/ModelRunner.ts`, `types/tools.ts` | Move to `types/tools.ts` |
| `ChatOptions` | `agent/chat.ts`, `types/cognitive.ts` | Move to `types/cognitive.ts` |
| `AgentOptions` | `agent/types.ts`, `types/agent.ts` | Consolidate in `types/agent.ts` |
| `Focus` | `focus/Focus.ts`, `memory/focus.ts` | Rename memory to `MemoryFocus` |
| `Codec` | `codec/Codec.ts`, `logics/nal/codecs.ts`, `logics/port.ts` | Namespace or merge |

**Approach:** Rename less-central definition; update imports; run tests.

---

### W5: Function/Constant Duplication (Week 2–3)

**Problem:** 80+ duplicate exported functions/constants.

**High-Priority:**
| Function | Locations | Resolution |
|----------|-----------|------------|
| `AUTONOMY_MODES` | `autonomy/config.ts`, `generated/schemas.ts` | Canonical in generated |
| `systemOneOf` | `context.ts`, `systemone/constants.ts` | Canonical in `context.ts` |
| `cognitiveBounds` | `bound-table.ts`, `cognitive-bounds.ts` | Canonical in `bound-table.ts` |
| `configDigest` | `digest.ts`, `strategies/registration.ts` | Canonical in `digest.ts` |
| `defaultEconomyState` | `economy/index.ts`, `economy/scheduler.ts` | Canonical in `index.ts` |

**Approach:** Keep definition in most logical module; re-export from barrels.

---

### W6: Bag/Type Redundancy (Week 2)

**Problem:** `src/bag/types.ts` and `src/util/bag.ts` both export identical types:
- `BagItem`, `InternalEntry`, `CyclesBudget`, `Bag`, `BagOptions`, `EvictStrategy`, `Histogram`, `PressureListener`, `PressureLevel`, `PressureTransition`, `RandomSource`, `CyclesBudget`

**Resolution:** `src/bag/types.ts` re-exports from `src/util/bag.ts` (or vice versa). Bag substrate is in util.

---

### W7: genome.ts Decomposition (Week 3–4)

**Problem:** 1,756 lines in single file — the schema genome.

**Split Plan:**
```
src/formats/
  genome.ts              → ~200 lines (orchestration only)
  genome/
    index.ts             → barrel
    primitives.ts        → uuid, nonEmpty, intervals, timestamp
    enums.ts             → ALL enum definitions (TASK_TYPES, RISK_LEVELS, etc.)
    schemas/
      index.ts
      cognitive-events.ts
      governance.ts
      derivation-records.ts
      formalization.ts
      proposal.ts
      rule-table.ts
      task.ts
      truth.ts
    zod-builders.ts      → zod schema construction helpers
    generators/
      index.ts
      typescript.ts      → TS type generation
      json-schema.ts     → JSON Schema generation
      docs.ts            → Markdown table generation
```

**Dependencies:** W1 (schema unification must complete first)

---

### W8: nar.ts Decomposition (Week 3–4)

**Problem:** 1,251 lines — main NAR class with too many responsibilities.

**Split Plan:**
```
src/
  nar.ts                 → ~200 lines (facade + composition)
  nar/
    index.ts             → barrel
    execution.ts         → execution loop (from nar-execution.ts)
    io.ts                → I/O (from nar-io.ts)
    presets.ts           → presets (from nar-presets.ts)
    config.ts            → NARConfig, RLFPConfig
    kernel/
      index.ts
      gates/
      contracts/
```

**Dependencies:** W2 (truth table consolidation)

---

### W9: economy/learning.ts Decomposition (Week 3–4)

**Problem:** 1,011 lines — learning + economy intertwined.

**Split Plan:**
```
src/economy/
  learning.ts            → ~200 lines (orchestration)
  learning/
    index.ts
    aikr-processor.ts    → (from learning/aikr-processor.ts)
    schema-induction.ts  → (from learning/schema-induction.ts)
    knobs.ts             → (from rlfp/knobs.ts)
```

---

### W10: util/collections.ts Decomposition (Week 3)

**Problem:** 900 lines — too many utilities in one file.

**Split Plan:**
```
src/util/
  collections.ts         → ~100 lines (barrel)
  collections/
    index.ts
    ring-buffer.ts       → BoundedRing, ring buffer ops
    set-map.ts           → Set/Map helpers (unique, flatUnique, etc.)
    sorting.ts           → rankBy, sortBy, topN, insertByScoreDesc
    grouping.ts          → groupBy, indexBy, keyedBy, buckets
    capping.ts           → pushCapped, trimCapped, takeFirst/Last
    iteration.ts         → chunk, splitKey, perPart
    stats.ts             → containerStats, entryKey, joinKey
```

---

### W11: MCP Tools Consolidation (Week 4)

**Problem:** 7 files in `src/bin/lib/mcp/` with overlapping concerns.

**Current Structure:**
```
mcp/
  job-manager.ts         (66 lines)
  mcp-bridge.ts          (76 lines)
  mcp-dialogue-tools.ts  (154 lines)
  mcp-prompts.ts         (126 lines)
  mcp-resources.ts       (290 lines)
  mcp-response.ts        (108 lines)
  mcp-tools.ts           (462 lines)
```

**Consolidation:**
- `mcp-response.ts` + `mcp-bridge.ts` → `mcp/core.ts` (shared response helpers + bridge)
- `mcp-tools.ts` + `mcp-dialogue-tools.ts` → `mcp/tools.ts` (all tool registration)
- `mcp-resources.ts` + `mcp-prompts.ts` → `mcp/resources.ts` (all resources + prompts)
- `job-manager.ts` → `mcp/jobs.ts` (standalone)

---

### W12: Bin Lib Consolidation (Week 4)

**Problem:** 14 small modules in `src/bin/lib/`, many single-use.

**Consolidation Targets:**
| Module | Lines | Used By | Action |
|--------|-------|---------|--------|
| `metta.ts` | 15 | 1 (self-report) | Inline into self-report |
| `remote-registry.ts` | 39 | 1 (bot) | Inline into bot |
| `multi-agent-entry.ts` | 49 | 1 (bot) | Inline into bot |
| `fatal-error.ts` | 44 | 5 | Keep (shared entrypoint helper) |
| `http-guards.ts` | 52 | 1 (mcp-server) | Move to mcp-server |
| `benchmarks.ts` | 71 | 1 (doctor-report) | Move to doctor-report |
| `doctor-checks.ts` | 59 | 1 (doctor-report) | Move to doctor-report |
| `oneshot.ts` | 125 | 1 (bot) | Inline into bot |
| `env-config.ts` | 50 | 3 | Keep (shared config) |
| `multi-agent-runner.ts` | 93 | 1 (multi-agent-entry) | Inline |

---

### W13: Agent/Type Duplication (Week 4)

**Problem:** Duplicate types between `src/agent/` and `src/types/`:

| Type | Agent Location | Types Location | Resolution |
|------|---------------|----------------|------------|
| `AgentOptions` | `agent/types.ts` | `types/agent.ts` | Canonical in `types/agent.ts` |
| `BridgeOptions` | `agent/types.ts` | `types/agent.ts` | Canonical in `types/agent.ts` |
| `ChatOptions` | `agent/chat.ts` | `types/cognitive.ts` | Canonical in `types/cognitive.ts` |
| `ToolCall` | `agent/ModelRunner.ts` | `types/tools.ts` | Canonical in `types/tools.ts` |

---

### W14: Import Boundary Gates (Week 5)

**Problem:** Direct imports bypassing barrels (e.g., `src/util/collections` instead of `@senars/util/collections`).

**Enforcement:**
1. Add `eslint-plugin-boundaries` or custom rule
2. Define allowed import patterns per package
3. Gate in CI: `pnpm import:boundary`

**Allowed Patterns:**
- `@senars/*` for all internal packages
- Relative imports only within same package
- No `../util/xxx` from outside `src/util/`

---

### W15: Config Schema Drift Gate (Week 5)

**Problem:** `schema:drift` only checks generated schemas; manual schemas can drift.

**Extension:**
- Extend `scripts/schema-drift.ts` to also verify manual schema barrels
- Compare `@senars/schemas` exports against `@senars/generated` exports
- Fail on unexpected additions/removals

---

### W16: Circular Dependency Audit (Week 5)

**Problem:** Remaining cycles in dependency graph.

**Known Cycles:**
- `cognitive/fold-queries.ts` ↔ `cognitive/types.ts` (mutual interface deps)
- `verification/verify-derivation.ts` ↔ `rules/verifier-truth-table.ts` (truth fn resolution)
- `admit/projections.ts` ↔ `logics/projections.ts` (shared interface)

**Resolution:** Extract shared types to third module; use `import type` where possible.

---

## 4. Execution Order (Dependency Graph)

```
WEEK 1:
  ├─ W1: Schema Unification (critical path)
  ├─ W3: Constant Canonicalization (parallel)
  └─ W10: util/collections.ts split (parallel, independent)

WEEK 2:
  ├─ W2: Truth Table Consolidation (needs W1)
  ├─ W4: Interface/Class Collisions (needs W1 for type names)
  ├─ W5: Function Duplication (needs W1, W3)
  └─ W6: Bag/Type Redundancy (needs W1)

WEEK 3:
  ├─ W7: genome.ts Split (needs W1)
  ├─ W8: nar.ts Split (needs W2)
  ├─ W9: economy/learning.ts Split (needs W2)
  └─ W11: MCP Consolidation (needs W1)

WEEK 4:
  ├─ W12: Bin Lib Consolidation (parallel)
  ├─ W13: Agent/Type Duplication (needs W4)
  └─ W14: Import Boundary Gates (needs W1)

WEEK 5:
  ├─ W15: Schema Drift Gate (needs W1)
  └─ W16: Circular Dependency Audit (needs W1, W4)

WEEK 6:
  ├─ Integration testing
  ├─ Gate validation
  ├─ Parity checks
  └─ Complexity budget ratchet
```

---

## 5. Success Criteria

| Metric | Target |
|--------|--------|
| Schema duplicate exports | 152 → 0 |
| Type name collisions | 60+ → 0 |
| Function/constant duplicates | 80+ → 0 |
| Files > 500 lines | 15 → 0 |
| Files > 300 lines | 80 → 40 |
| Circular dependencies | 5+ → 0 |
| Import boundary violations | 0 (enforced) |
| `schema:drift` coverage | 100% (generated + manual) |
| Test pass rate | 100% (402 files, 3761 tests) |
| Complexity budget | ≤ 129,208 LOC |

---

## 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schema unification breaks imports | Medium | High | Incremental migration; keep re-exports during transition |
| Truth table consolidation changes behavior | Low | High | Drift test validates; run after each sub-step |
| Large file splits introduce circular deps | Medium | Medium | Plan module boundaries first; use `import type` |
| Bin lib inlining loses testability | Low | Medium | Keep public functions; test via integration |
| Import boundary enforcement breaks builds | Medium | Low | Dry-run mode first; fix incrementally |

---

## 7. Out of Scope (Deferred to TODO.core.29)

- Builder Unification (Q2 from TODO.27)
- Event Taxonomy (Q3 from TODO.27)
- Serialization Helpers (Q4 from TODO.27)
- RL Baseline Framework extensions
- Prometheus/OpenTelemetry custom metrics
- UI-Contract registry factory unification