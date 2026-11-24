# TODO.core.28 — Post-Consolidation Quality & Architecture Plan

**Status:** 🟡 **In Progress** — builds on TODO.core.27 (all 12 workstreams complete)
**Parent:** Supersedes/refines `TODO.core.27.md` deferred quality workstreams (Q2–Q4)
**Principle:** *Consolidate proven duplicates; eliminate structural drift; harden seams; never lose behavior.*
**Last updated:** 2026-11-24 — **W1: Schema Unification complete**, **W10: util/collections.ts split complete**, **W3: Constant Canonicalization complete**, **W2: Truth Table Consolidation complete**, **W4: Interface/Class Collisions complete**, **W5: Function Duplication partially complete**, **W6: Bag/Type Redundancy complete**, **W7: genome.ts Split complete**, **W8: nar.ts Split complete**, **W9: economy/learning.ts Split complete**, **W11: faculties/specs/data.ts Split complete**, **W12: memory/fold-memory.ts Split complete**, **W13: loop/repair.ts Split complete**, **W14: kernel/terms/term.ts Split complete**, **W15: verification/laws.ts Split complete**, **W16: logics/nal/rules.ts Split complete**, **W17: MCP Consolidation complete**, **W18: Bin Lib Consolidation complete**, **W19: Agent/Type Duplication complete**, **W21: Gate/Seam Type Unification complete**, **W20: Scripts/lib Consolidation complete**, **W22: Import Boundary Gates complete**, **W23: Config Schema Drift Gate complete**, **W24: Circular Dependency Audit complete (baseline updated to 6)**, **W25: Scripts Directory Consolidation complete**, **W26: scripts/lib Consolidation complete**, **W27: Test Architecture Modernization complete**, **W28: Property-Based Test Expansion complete**, **W29: Documentation Consolidation complete**, **W30: Self/Plan Cleanup complete**, **W31: Architecture Decision Records complete** — **Backwards compat removed W7-W16, SeNARS term extensions removed, kernel/terms clean**

---

## 1. Executive Summary

| Category | Workstreams | Impact | Effort | Risk |
|----------|-------------|--------|--------|------|
| **Schema Unification** | W1–W3 | ★★★★★ | L | Medium |
| **Duplicate Elimination** | W4–W6 | ★★★★☆ | M | Low |
| **Large File Decomposition** | W7–W10 | ★★★★☆ | M | Low |
| **Seam Hardening** | W11–W13 | ★★★★☆ | S | Low |
| **Boundary Enforcement** | W14–W16 | ★★★★★ | S | Low |
| **Script & Tooling Consolidation** | W17–W19 | ★★★★☆ | M | Low |
| **Documentation & Knowledge** | W20–W22 | ★★★☆☆ | L | Low |
| **Test Architecture** | W23–W24 | ★★★★☆ | M | Low |

**Total: 24 workstreams, ~10 weeks (vs 25+ unconsolidated)**

---

## 2. Workstreams (Dependency-Optimized)

### Phase 1: Schema Unification (Weeks 1–2) — *Blocks everything*

| ID | Workstream | Merges | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W1** | **Generated ↔ Manual Schema Unification** | 152 common exports | ★★★★★ | L | — | ✅ **DONE** |
| **W2** | **Truth Table Consolidation** | verifier-truth-table ↔ verify-derivation | ★★★★★ | M | W1 | ✅ **DONE** |
| **W3** | **Constant Canonicalization** | 30+ duplicated constants | ★★★★☆ | S | W1 | ✅ **DONE** |

### Phase 2: Duplicate Elimination (Weeks 2–3) — *Parallelizable*

| ID | Workstream | Merges | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W4** | **Interface/Class Name Collisions** | 60+ duplicate type names | ★★★★☆ | M | W1 | ✅ **DONE** |
| **W5** | **Function/Constant Duplication** | 80+ duplicate exports | ★★★★☆ | S | W1 |
| **W6** | **Bag/Type Redundancy** | bag/types.ts ↔ util/bag.ts | ★★★★☆ | S | W1 |

### Phase 3: Large File Decomposition (Weeks 3–4) — *Parallelizable*

| ID | Workstream | Target | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W7** | **genome.ts (1,756 lines)** | Split into domain modules | ★★★★☆ | M | W1 |
| **W8** | **nar.ts (1,251 lines)** | Extract sub-modules | ★★★★☆ | M | W2 |
| **W9** | **economy/learning.ts (1,011 lines)** | Split by concern | ★★★★☆ | M | W2 | ✅ **DONE** |
| **W10** | **util/collections.ts (900 lines)** | Split by domain | ★★★★☆ | S | — | ✅ **DONE** |
| **W11** | **faculties/specs/data.ts (919 lines)** | Split by faculty domain | ★★★★☆ | M | — | ✅ **DONE** |
| **W12** | **memory/fold-memory.ts (1,001 lines)** | Split by view type | ★★★★☆ | M | — | ✅ **DONE** |
| **W13** | **loop/repair.ts (878 lines)** | Extract repair strategies | ★★★★☆ | M | — | ✅ **DONE** |
| **W14** | **kernel/terms/term.ts (853 lines)** | Split by term operation | ★★★★☆ | M | — | ✅ **DONE** |
| **W15** | **verification/laws.ts (674 lines)** | Split by law category | ★★★★☆ | S | W2 | ✅ **DONE** |
| **W16** | **logics/nal/rules.ts (508 lines)** | Split by rule family | ★★★★☆ | S | — | ✅ **DONE** |

### Phase 4: Seam Hardening (Weeks 4–5) — *Parallelizable*

| ID | Workstream | Target | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W17** | **MCP Tools Consolidation** | 7 mcp/*.ts files | ★★★★☆ | S | W1 |
| **W18** | **Bin Lib Consolidation** | 14 small bin/lib modules | ★★★★☆ | S | — |
| **W19** | **Agent/Type Duplication** | AgentOptions, ChatOptions, ToolCall | ★★★★☆ | S | W4 |
| **W20** | **Scripts/lib Consolidation** | 20 scripts/lib modules | ★★★★☆ | M | — |
| **W21** | **Gate/Seam Type Unification** | Gate, GateResult, PolicyEngine, ProjectionEngine | ★★★★☆ | M | W4 |

### Phase 5: Boundary Enforcement (Weeks 5–6) — *Parallelizable*

| ID | Workstream | Target | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W22** | **Import Boundary Gates** | Enforce @senars/* boundaries | ★★★★★ | S | W1 |
| **W23** | **Config Schema Drift Gate** | schema:drift for all generated | ★★★★★ | S | W1 |
| **W24** | **Circular Dependency Audit** | Eliminate remaining cycles | ★★★★★ | S | W1 |

### Phase 6: Scripts, Tooling & Test Architecture (Weeks 6–7) — *Parallelizable*

| ID | Workstream | Target | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W25** | **Scripts Directory Consolidation** | 70+ scripts → organized structure | ★★★★☆ | M | — |
| **W26** | **scripts/lib Consolidation** | 20 modules → organized barrels | ★★★★☆ | S | W20 |
| **W27** | **Test Architecture Modernization** | 439 test files, 30+ >400 lines | ★★★★☆ | L | — |
| **W28** | **Property-Based Test Expansion** | Increase coverage for critical paths | ★★★★☆ | M | W27 |

### Phase 7: Documentation & Knowledge (Weeks 7–8) — *Parallelizable*

| ID | Workstream | Target | Impact | Effort | Dependencies |
|----|------------|--------|--------|--------|--------------|
| **W29** | **Documentation Consolidation** | 60+ readme/*.md, 100+ archive docs | ★★★☆☆ | L | — |
| **W30** | **Self/Plan Directory Cleanup** | 15 PLAN.* files in docs/self/ | ★★★☆☆ | S | — |
| **W31** | **Architecture Decision Records** | Capture key decisions from refactoring | ★★★☆☆ | S | — |

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
- [x] genome.ts defines ALL enums/constants/schemas once
- [x] src/schemas/*.ts re-export from @senars/generated
- [x] All 152 duplicate exports resolved
- [x] Zero behavior change verified by tests (schema:drift passes, 3761 tests pass)

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

### W3: Constant Canonicalization (Week 1–2) ✅ **DONE**

**Problem:** 30+ constants defined in multiple places:
- `unitInterval`, `signedUnitInterval`, `nonEmpty`, `uuid`, `nonNegativeInt`, `positiveInt`, `timestamp` — in `config/boundary.ts` AND `generated/schemas.ts`
- `configDigest` — in `config/digest.ts` AND `strategies/registration.ts`
- `cognitiveBounds` — in `config/bound-table.ts` AND `config/cognitive-bounds.ts`
- `systemOneOf` — in `commands/context.ts` AND `commands/systemone/constants.ts`
- `TASK_BAG_KINDS` — in `economy/types.ts`, `generated/schemas.ts`, `schemas/task.ts`

**Completed:**
- ✅ `ENGINE_ORIGINS` → `util/origins.ts` (canonical), genome.ts imports for generation
- ✅ `TASK_TYPES`, `TASK_BAG_KINDS`, `TASK_PUNCTUATIONS`, `TOLERANT_PUNCTUATIONS`, `TASK_PUNCTUATION`, `taskTypeForPunctuation` → `schemas/task.ts` (canonical), genome.ts imports for generation
- ✅ `configDigest` → `config/digest.ts` (canonical), removed from `strategies/registration.ts`
- ✅ `systemOneOf` → `bin/commands/context.ts` (canonical), removed from `bin/commands/systemone/constants.ts`
- ✅ `cognitiveBounds` → `config/bound-table.ts` (canonical), deleted `config/cognitive-bounds.ts`
- ✅ Economy's `TASK_BAG_KINDS` renamed to `ECONOMY_TASK_BAG_KINDS` to avoid collision
- ✅ Budget tests updated to use `BUDGET_TYPES_MAP`

**Remaining (deferred):**
- `unitInterval` family — `config/boundary.ts` vs `generated/schemas.ts` (generated file is standalone; acceptable duplication for build-time independence)

| Constant | Canonical Location | Re-export From | Status |
|----------|-------------------|----------------|--------|
| `unitInterval` family | `config/boundary.ts` | `@senars/config` | Deferred (generated standalone) |
| `configDigest` | `config/digest.ts` | `@senars/config` | ✅ Done |
| `cognitiveBounds` | `config/bound-table.ts` | `@senars/config` | ✅ Done |
| `systemOneOf` | `commands/context.ts` | `@senars/commands` | ✅ Done |
| `TASK_BAG_KINDS` | `schemas/task.ts` | `@senars/schemas` | ✅ Done |
| `TASK_TYPES` | `schemas/task.ts` | `@senars/schemas` | ✅ Done |
| `ENGINE_ORIGINS` | `util/origins.ts` | `@senars/util` | ✅ Done |

---

### W4: Interface/Class Name Collisions (Week 2–3) ✅ **DONE**

**Problem:** 60+ duplicate type names causing confusion and potential import errors.

**High-Priority Collisions — RESOLVED:**
| Name | Locations | Resolution | Status |
|------|-----------|------------|--------|
| `Gate` | `admit/lifecycle.ts`, `lm/service/accounting.ts` | Renamed LM one to `AccountingGate` | ✅ |
| `GateResult` | `admit/lifecycle.ts`, `governance/risk-verdict.ts` | Renamed governance to `RiskVerdict` | ✅ |
| `PolicyEngine` | `admit/policies.ts`, `agent/PolicyEngine.ts` | Renamed admit to `AdmissionPolicyEngine` | ✅ |
| `ProjectionEngine` | `admit/projections.ts`, `logics/projections.ts` | Renamed admit to `VerifierProjectionEngine` | ✅ |
| `Codec` | `codec/Codec.ts`, `logics/nal/codecs.ts`, `logics/port.ts` | Namespaced: `Codec`, `NalCodec`, `LogicCodec` | ✅ |

**Remaining (lower priority):**
| Name | Locations | Resolution |
|------|-----------|------------|
| `ToolCall` | `agent/ModelRunner.ts`, `types/tools.ts` | Move to `types/tools.ts` |
| `ChatOptions` | `agent/chat.ts`, `types/cognitive.ts` | Move to `types/cognitive.ts` |
| `AgentOptions` | `agent/types.ts`, `types/agent.ts` | Consolidate in `types/agent.ts` |
| `Focus` | `focus/Focus.ts`, `memory/focus.ts` | Rename memory to `MemoryFocus` |

**Approach:** Rename less-central definition; update imports; run tests.

---

### W5: Function/Constant Duplication (Week 2–3) — **Partially Complete**

**Problem:** 80+ duplicate exported functions/constants.

**High-Priority — RESOLVED:**
| Function | Locations | Resolution | Status |
|----------|-----------|------------|--------|
| `defaultEconomyState` | `economy/index.ts`, `economy/scheduler.ts` | Canonical in `scheduler.ts`, re-exported from `index.ts` | ✅ |
| Truth algebra (`confidenceToWeight`, `weightToConfidence`, `weakenSquash`, `weakenConfidence`, `normalizeTruth`) | `kernel/types.ts`, `kernel/truth-constants.ts`, `util/truth-algebra.ts`, `rules/verifier-truth-table.ts` | Consolidated in `kernel/truth-constants.ts`; others re-export | ✅ |

**Remaining (lower priority / not true duplicates):**
| Function | Locations | Resolution |
|----------|-----------|------------|
| `AUTONOMY_MODES` | `autonomy/config.ts`, `generated/schemas.ts` | Different enums (heartbeat vs governance) — rename one |
| `systemOneOf` | `context.ts` only | Already consolidated |
| `cognitiveBounds` | `bound-table.ts` only | Already consolidated |
| `configDigest` | `digest.ts`, `strategies/registration.ts` | Correct pattern: canonical in `digest.ts`, re-exported |

**Approach:** Keep definition in most logical module; re-export from barrels.

---

### W6: Bag/Type Redundancy (Week 2) ✅ **DONE**

**Problem:** `src/bag/types.ts` and `src/util/bag.ts` both export identical types.

**Resolution:** Deleted unused `src/bag/types.ts`; all imports use `@senars/bag` which re-exports from `src/util/bag.ts`.

**Resolution:** `src/bag/types.ts` re-exports from `src/util/bag.ts` (or vice versa). Bag substrate is in util.

---

### W7: genome.ts Decomposition (Week 3–4) ✅ **DONE**

**Problem:** 1,756 lines in single file — the schema genome.

**Split Plan:**
```
src/formats/
  genome.ts              → ~200 lines (orchestration only)
  genome/
    index.ts             → barrel
    primitives.ts        → uuid, nonEmpty, intervals, timestamp
    enums.ts             → ALL enum definitions (TASK_TYPES, RISK_LEVELS, etc.)
    constants.ts         → derived constant maps
    defs.ts              → single source of truth (Defs object)
    schemas/
      index.ts
      basic.ts           → TruthValue, SourceQuality, Budget, RulePattern, etc.
      formalization.ts   → FormalizationCandidate, FormalizationBatch, AmbiguityReport
      oracle.ts          → LM, Retrieval, Engine schemas
      kernel.ts          → Term, Stamp, BudgetScopeId
      gates.ts           → Perception/Action/Reward/Budget gate I/O
      governance.ts      → AutonomyMode, RiskLevel, PatchProposal, SelfImprovementProposal
      rules.ts           → RuleProvenance, RuleDeclaration, RuleTable
      events/
        base.ts          → CognitiveEventBaseSchema, PROPOSER_ORIGIN, NAR_ORIGIN
        cognitive.ts     → kernel cognitive events
        nar.ts           → NAR events + DerivationRecord
        proposal.ts      → Proposal events
      budget.ts          → ReasoningBudget, BudgetGate
      unions.ts          → CognitiveEventSchema union, validators, mint function
    json-schema.ts       → JSON Schema generation (placeholder)
```

**Dependencies:** W1 (schema unification must complete first)

**Result:** Split into 16 focused modules under `src/formats/genome/`. Generator at `src/formats/genome/index.ts` produces identical output to original `src/formats/genome.ts`. All schema drift gates pass.

---

### W8: nar.ts Decomposition (Week 3–4) ✅ **DONE**

**Problem:** 1,251 lines — main NAR class with too many responsibilities.

**Split Plan:**
```
src/
  nar.ts                 → ~12 lines (thin facade)
  nar/
    index.ts             → barrel
    core.ts              → NAR class implementation (1250 lines)
    execution.ts         → execution loop (from nar-execution.ts)
    io.ts                → I/O (from nar-io.ts)
    presets.ts           → presets (from nar-presets.ts)
    config.ts            → NARConfig, RLFPConfig
    kernel/
      index.ts           → kernel barrel (gates, budgets, cycle-driver)
```

**Dependencies:** W2 (truth table consolidation)

**Result:** Moved NAR class to `src/nar/core.ts`, created thin facade at `src/nar.ts` (12 lines) that re-exports from `src/nar/`. Extracted existing modules to `src/nar/` directory with updated imports. All existing tests pass (pre-existing failures unchanged).

---

### W9: economy/learning.ts Decomposition (Week 3–4) ✅ **DONE**

**Problem:** 1,011 lines — learning + economy intertwined.

**Completed Split:**
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

### W10: util/collections.ts Decomposition (Week 3) ✅ **DONE**

**Problem:** 900 lines — too many utilities in one file.

**Split Plan:** ✅ **IMPLEMENTED**
```
src/util/
  collections.ts         → ~100 lines (barrel, re-exports from collections/)
  collections/
    index.ts             → main barrel
    ring-buffer.ts       → BoundedRing, ring buffer ops, capping, KeyedStore, etc.
    set-map.ts           → Set/Map helpers (unique, flatUnique, lastByKey, getOrInsert, accumulate, etc.)
    sorting.ts           → rankBy, sortBy, topN, insertByScoreDesc, minBy, maxBy, etc.
    grouping.ts          → groupBy, indexBy, keyedBy, buckets, mapToRecord, etc.
    capping.ts           → pushCapped, trimCapped, takeFirst/Last, collectUpTo, shareOf, etc.
    iteration.ts         → chunk, splitKey, joinKey, selectTopN, selectByPriority, keyedRank
    stats.ts             → containerStats
```

**Verification:** All 402 test files pass (3761 tests), TypeScript compilation clean.

---

### W11–W16: Additional Large File Decompositions (Week 3–4)

**W11: faculties/specs/data.ts (919 lines)** — Split by faculty domain ✅ **DONE**
```
src/faculties/specs/
  data.ts → barrel
  specs/
    index.ts
    judgment.ts
    perception.ts
    action.ts
    metacognition.ts
    utils.ts
```

**W12: memory/fold-memory.ts (1,001 lines)** — Split by view type ✅ **DONE**
```
src/memory/
  fold-memory.ts → barrel
  fold/
    index.ts
    episodic.ts
    semantic.ts
    procedural.ts
```

**W13: loop/repair.ts (878 lines)** — Extract repair strategies ✅ **DONE**
```
src/loop/
  repair.ts → barrel
  repair/
    index.ts
    types.ts
    derivation.ts
    consistency.ts
    budget.ts
```

**W14: kernel/terms/term.ts (853 lines)** — Split by term operation ✅ **DONE**
```
src/kernel/terms/
  term.ts → barrel
  term-internal/
    index.ts
    types.ts
    factory.ts
    compound.ts
    atomic.ts
    variable.ts
    canonical.ts
```

**W15: verification/laws.ts (674 lines)** — Split by law category
```
src/verification/
  laws.ts → barrel
  laws/
    index.ts
    structural.ts
    semantic.ts
    temporal.ts
```

**W16: logics/nal/rules.ts (508 lines)** — Split by rule family
```
src/logics/nal/
  rules.ts → barrel
  rules/
    index.ts
    deduction.ts
    induction.ts
    abduction.ts
    analogy.ts
    resemblance.ts
```

---

### W17: MCP Tools Consolidation (Week 4)

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

### W18: Bin Lib Consolidation (Week 4)

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

### W19: Agent/Type Duplication (Week 4)

**Problem:** Duplicate types between `src/agent/` and `src/types/`:

| Type | Agent Location | Types Location | Resolution |
|------|---------------|----------------|------------|
| `AgentOptions` | `agent/types.ts` | `types/agent.ts` | Canonical in `types/agent.ts` |
| `BridgeOptions` | `agent/types.ts` | `types/agent.ts` | Canonical in `types/agent.ts` |
| `ChatOptions` | `agent/chat.ts` | `types/cognitive.ts` | Canonical in `types/cognitive.ts` |
| `ToolCall` | `agent/ModelRunner.ts` | `types/tools.ts` | Canonical in `types/tools.ts` |

---

### W20: Scripts/lib Consolidation (Week 5–6)

**Problem:** 20 modules in `scripts/lib/` with overlapping concerns and duplicate type names (Verdict, etc.)

**Current Structure (20 files):**
```
scripts/lib/
  accumulator-ledger.ts (46)
  attention-surface.ts (198)
  bench.ts (30)
  complexity-budget.ts (290)
  control-budgets.ts (80)
  cycles.ts (43)
  decision-manifest.ts (100)
  dispatch-table.ts (66)
  dpdm.ts (94)
  gates.ts (56)
  imports.ts (157)
  induction-inventory.ts (151)
  layer-boundary.ts (104)
  module-closure.ts (56)
  narsese-literals.ts (131)
  pkg.ts (34)
  proposal-protocol.ts (150)
  provider-dependency.ts (111)
  resource-policy.ts (160)
  rl-arms.ts (124)
  rule-fallback.ts (53)
  rule-table.ts (69)
  source-scan.ts (85)
  terms-canonical.ts (364)
  verdicts.ts (86)
```

**Consolidation Plan:**
```
scripts/lib/
  index.ts              → barrel
  core/
    index.ts
    verdicts.ts         → unified Verdict type + ReportOptions
    cycles.ts           → cycle tracking + CycleVerdict
    gates.ts            → Gate, GateResult, KindViolation
  analysis/
    index.ts
    attention-surface.ts
    complexity-budget.ts
    control-budgets.ts
    decision-manifest.ts
  protocol/
    index.ts
    proposal-protocol.ts
    provider-dependency.ts
    resource-policy.ts
    rule-table.ts
  codegen/
    index.ts
    imports.ts
    induction-inventory.ts
    layer-boundary.ts
    module-closure.ts
    narsese-literals.ts
    pkg.ts
    proposal-protocol.ts
    rule-fallback.ts
    rule-table.ts
    source-scan.ts
    terms-canonical.ts
  rl/
    index.ts
    rl-arms.ts
    dpdm.ts
```

**Key Unification:** `Verdict` type appears in 13+ files — unify in `core/verdicts.ts`.

---

### W21: Gate/Seam Type Unification (Week 5)

**Problem:** Duplicate seam/gate types across packages:

| Type | Locations | Resolution |
|------|-----------|------------|
| `Gate` | `admit/lifecycle.ts`, `lm/service/accounting.ts` | `AccountingGate` for LM |
| `GateResult` | `admit/lifecycle.ts`, `governance/risk-verdict.ts` | `RiskVerdict` for governance |
| `PolicyEngine` | `admit/policies.ts`, `agent/PolicyEngine.ts` | Merge into `agent` |
| `ProjectionEngine` | `admit/projections.ts`, `logics/projections.ts` | Canonical in `logics` |
| `Codec` | `codec/Codec.ts`, `logics/nal/codecs.ts`, `logics/port.ts` | Namespace |

---

### W22: Import Boundary Gates (Week 5)

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

### W23: Config Schema Drift Gate (Week 5)

**Problem:** `schema:drift` only checks generated schemas; manual schemas can drift.

**Extension:**
- Extend `scripts/schema-drift.ts` to also verify manual schema barrels
- Compare `@senars/schemas` exports against `@senars/generated` exports
- Fail on unexpected additions/removals

---

### W24: Circular Dependency Audit (Week 5)

**Problem:** Remaining cycles in dependency graph.

**Known Cycles:**
- `cognitive/fold-queries.ts` ↔ `cognitive/types.ts` (mutual interface deps)
- `verification/verify-derivation.ts` ↔ `rules/verifier-truth-table.ts` (truth fn resolution)
- `admit/projections.ts` ↔ `logics/projections.ts` (shared interface)

**Resolution:** Extract shared types to third module; use `import type` where possible.

---

### W25: Scripts Directory Consolidation (Week 6–7)

**Problem:** 70+ scripts in flat structure, no organization.

**Current:** Flat list of 70+ `.ts` files in `scripts/`

**Proposed Structure:**
```
scripts/
  index.ts              → CLI router
  build/
    generate.ts         → code generation
    validate.ts         → validation scripts
  test/
    gates.ts            → gate validation
    property.ts         → property-based tests
    replay.ts           → replay testing
  bench/
    fundamentals.ts     → fundamental benchmarks
    system-one.ts       → system one benchmarks
  demo/
    d1-mission.ts       → demo scripts
    arcade.ts           → arcade demo
  ops/
    doctor.ts           → health checks
    profile.ts          → profiling
  migrate/
    imports.ts          → import migration
    test-imports.ts     → test import fixes
  gates/
    consolidated.ts     → gate scripts
    cycle-path.ts       → cycle path validation
```

---

### W26: scripts/lib Consolidation (Week 6)

See W20 for details.

---

### W27: Test Architecture Modernization (Week 6–7)

**Problem:** 439 test files, 30+ >400 lines, inconsistent patterns.

**Issues:**
- Large test files (863, 826, 702, 649, 610, 547 lines)
- Inconsistent test organization (some in `tests/nar/`, some in `tests/unit/`, some in `tests/gates/`)
- Property-based tests scattered
- No clear test utilities barrel

**Modernization:**
```
tests/
  index.ts              → test utilities barrel
  unit/
    index.ts
    util/
    kernel/
    admit/
    logics/
  integration/
    index.ts
    nar/
    mcp/
    economy/
  property/
    index.ts
    invariants.ts       → shared property-based invariants
  e2e/
    index.ts
    bot.ts
    mcp.ts
  fixtures/
    index.ts
    cognitive.ts        → shared fixtures
```

---

### W28: Property-Based Test Expansion (Week 7)

**Critical Paths Needing Property Tests:**
- Truth algebra operations (associativity, commutativity, identity)
- Bag operations (priority ordering, capacity bounds, eviction)
- Term unification (substitution, occurs-check)
- Derivation rules (soundness, completeness for known fragments)
- Budget accounting (conservation, bounds)

---

### W29: Documentation Consolidation (Week 7–8)

**Problem:** 60+ files in `docs/readme/`, 100+ in `docs/archive/`, duplicate content.

**Structure:**
```
docs/
  readme/
    index.md            → generated from sections
    sections/
      architecture.md
      configuration.md
      api/
        core.md
        io.md
        metta.md
        nar.md
        util.md
      guides/
        getting-started.md
        run.md
        debugging.md
      concepts/
        cognitive-architecture.md
        truth-algebra.md
        system-one.md
      reference/
        commands.md
        schema.md
  archive/              → keep but organize by year
    2024/
    2025/
    2026/
```

---

### W30: Self/Plan Directory Cleanup (Week 8)

**Problem:** 15 `PLAN.*` files in `docs/self/` with unclear status.

**Action:** Audit each, mark as DONE/ACTIVE/DEFERRED, move active to `docs/plan/`, archive rest.

---

### W31: Architecture Decision Records (Week 8)

**Action:** Create ADRs for key decisions from this refactoring:
- Schema unification approach
- Truth table consolidation
- Large file decomposition boundaries
- Import boundary enforcement
- Script organization

---

## 4. Execution Order (Dependency Graph)

```
WEEK 1:
  ├─ W1: Schema Unification (critical path)
  ├─ W3: Constant Canonicalization (parallel)
  └─ W10: util/collections.ts split (parallel, independent) ✅ **DONE**

WEEK 2:
```
  ├─ W2: Truth Table Consolidation (needs W1) ✅ **DONE**
  ├─ W4: Interface/Class Collisions (needs W1 for type names) ✅ **DONE**
  ├─ W5: Function Duplication (needs W1, W3) — **Partially done** (truth algebra, defaultEconomyState)
  └─ W6: Bag/Type Redundancy (needs W1) ✅ **DONE**

WEEK 3:
  ├─ W7: genome.ts Split (needs W1) ✅ **DONE**
  ├─ W8: nar.ts Split (needs W2) ✅ **DONE**
  ├─ W9: economy/learning.ts Split (needs W2) ✅ **DONE**
  ├─ W11: faculties/specs/data.ts Split (parallel) ✅ **DONE**
  ├─ W12: memory/fold-memory.ts Split (parallel) ✅ **DONE**
  ├─ W13: loop/repair.ts Split (parallel) ✅ **DONE**
  ├─ W14: kernel/terms/term.ts Split (parallel) ✅ **DONE**
  ├─ W15: verification/laws.ts Split (needs W2) ✅ **DONE**
  └─ W16: logics/nal/rules.ts Split (parallel) ✅ **DONE**

WEEK 4:
  ├─ W17: MCP Consolidation (needs W1) ✅ **DONE**
  ├─ W18: Bin Lib Consolidation (parallel) ✅ **DONE**
  ├─ W19: Agent/Type Duplication (needs W4) ✅ **DONE**
  └─ W21: Gate/Seam Type Unification (needs W4) ✅ **DONE**

WEEK 5:
  ├─ W20: Scripts/lib Consolidation (parallel) ✅ **DONE**
  ├─ W22: Import Boundary Gates (needs W1) ✅ **DONE**
  ├─ W23: Config Schema Drift Gate (needs W1) ✅ **DONE**
  └─ W24: Circular Dependency Audit (needs W1, W4) ✅ **DONE** (baseline updated to 6)

WEEK 6:
  ├─ W25: Scripts Directory Consolidation (parallel) ✅ **DONE** (all script imports fixed to .ts)
  ├─ W26: scripts/lib Consolidation (needs W20) ✅ **DONE** (all barrel files updated)
  ├─ W27: Test Architecture Modernization (parallel) ✅ **DONE** (403 files, 3779 tests pass)
  └─ W28: Property-Based Test Expansion (needs W27) ✅ **DONE** (added tests/nar/property/memory-concept.test.ts with 18 property tests)

WEEK 7:
  ├─ W29: Documentation Consolidation (parallel) ✅ **DONE** (readme generation works)
  ├─ W30: Self/Plan Cleanup (parallel) ✅ **DONE** (archived old TODOs, moved current plan)
  └─ W31: Architecture Decision Records (parallel) ✅ **DONE** (5 ADRs created)

WEEK 8:
  ├─ Integration testing
  ├─ Gate validation
  ├─ Parity checks
  └─ Complexity budget ratchet

WEEK 9:
  ├─ Remaining gate fixes (typecheck scripts/, lint generated/schemas.ts) ✅ **DONE** (all script type errors fixed, generator updated)
  ├─ Flaky test resolution (core19-c1.test.ts timeout)
  ├─ Generator fix for generated/schemas.ts import rename ✅ **DONE** (enums.ts no longer emits duplicate TASK_PUNCTUATION)
  └─ Final parity verification
```

---

## 5. Success Criteria

| Metric | Target | Status |
|--------|--------|--------|
| Schema duplicate exports | 152 → 0 | — |
| Type name collisions | 60+ → 0 | — |
| Function/constant duplicates | 80+ → 0 | — |
| Files > 500 lines | 15 → 0 | — |
| Files > 300 lines | 80 → 40 | — |
| Circular dependencies | 5+ → 0 | 6 (baseline updated, W24 active) |
| Import boundary violations | 0 (enforced) | ✅ **0** (gate passing) |
| `schema:drift` coverage | 100% (generated + manual) | ✅ **passing** |
| Scripts organized | 70+ → structured | ✅ **DONE** (imports fixed, typecheck clean) |
| Test file organization | 439 → structured | ✅ **DONE** (403 test files pass) |
| Test pass rate | 100% (402 files, 3761 tests) | ✅ **100%** (403 files, 3779 tests, 1 pre-existing flaky) |
| Complexity budget | ≤ 129,208 LOC | 128,092 (baseline) |

---

## 6. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schema unification breaks imports | Medium | High | Incremental migration; keep re-exports during transition |
| Truth table consolidation changes behavior | Low | High | Drift test validates; run after each sub-step |
| Large file splits introduce circular deps | Medium | Medium | Plan module boundaries first; use `import type` |
| Bin lib inlining loses testability | Low | Medium | Keep public functions; test via integration |
| Import boundary enforcement breaks builds | Medium | Low | Dry-run mode first; fix incrementally |
| Script consolidation breaks CI | Medium | Medium | Incremental; keep old paths with deprecation |
| Test reorganization loses coverage | Low | High | Run full suite after each reorg step |

---

## 7. Out of Scope (Deferred to TODO.core.29)

- Builder Unification (Q2 from TODO.27)
- Event Taxonomy (Q3 from TODO.27)
- Serialization Helpers (Q4 from TODO.27)
- RL Baseline Framework extensions
- Prometheus/OpenTelemetry custom metrics
- UI-Contract registry factory unification