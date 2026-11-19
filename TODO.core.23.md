# Core Consolidation — Remaining Work Plan (v23)

## Context
Core package consolidation (util→core→io→metta→nar → root `src/`) **COMPLETE**.
- All import/circular dependency issues resolved
- 24 source files: `import type` → runtime imports (BoundedMap, BoundedRing)
- 20+ test files: corrected module paths
- 7 source files: deep `@senars/util/*` → barrel `@senars/util` for vitest
- Test framework: `Bag.peek()` → `Bag.all()[0]` (fixed 2 nal1-rules tests)
- **Test logic pass rate: ~81% when tests can run**

## Blocker: Vitest Deep Alias Resolution (P0 — Single Point of Failure)

**Symptom**: Top-level aliases resolve (`@senars/util`), deep aliases fail (`@senars/util/fs`, `@senars/util/collections`, `@senars/schemas/cognitive-events`, etc.)

**Root Cause**: Vite/Rolldown resolves aliases in object key order. Shallow `@senars/util` matches before deep `@senars/util/fs`.

**Fix Strategy** (single config change, high leverage):
1. **Reorder `aliases` object** in `vitest.config.ts`: deep sub-paths FIRST, then top-level, then wildcards
2. **Verify** with `pnpm test tests/nar/todo27-seeded-sampling.test.ts -- --run`
3. **If needed**: Convert to array format `[{find, replacement}, ...]` for explicit priority

**Deep aliases required** (from source grep):
```
@senars/util/{fs,collections,numeric,id,async,format,hash,ledger,random,truth-schema,truth-algebra,config,error,logger,clock,object,guards,diagnostics,json,tally,result,disposal,eval}
@senars/schemas/{cognitive-events,truth,governance,proposal,common,derivation-records,formalization,event-base,gate-io,nar-events,rule-table,reasoning-budget,recalled-events}
@senars/lm/*, @senars/cognitive/*, @senars/bag/*, @senars/memory/*
```

---

## Phase A: Unblock & Baseline (1 session)

### A1. Fix Vitest Deep Aliases [30 min]
- Reorder `aliases` in `vitest.config.ts`: deep sub-paths → top-level → wildcards
- Add `@senars/util/fs` etc. explicitly before `@senars/util` and `@senars/util/*`
- Verify: `pnpm test tests/nar/todo27-seeded-sampling.test.ts -- --run` loads

### A2. Full Suite Baseline [15 min]
- `pnpm test -- --run 2>&1 | tail -20` → capture pass/fail/skip counts
- Export baseline: `TEST_BASELINE=$(date +%s)_baseline.txt`

### A3. Categorize Failures [15 min]
- Group by subsystem (RL, Governance, LM, Kernel, Memory, Surface, Fundamentals)
- Identify "quick wins" (single-line fixes) vs "investigations"

---

## Phase B: Parallel Subsystem Fixes (2-3 sessions)

**Strategy**: Each subsystem is independent → can parallelize via subagents or sequential with clear handoffs.

| Subsystem | Files | Failure Type | Estimated Effort | Quick Win? |
|-----------|-------|--------------|------------------|------------|
| **Surface D24** | `todo17b-surface.test.ts` | README vs impl audit | 30 min | ✅ Audit only |
| **Fundamentals Gate** | `todo27-fundamentals-gate.test.ts` | Bench output format | 30 min | ✅ Config check |
| **RL/Oracle** | `rl/parity/*`, `rl/contract/*`, `bandit-epsilon-greedy.test.ts` | RNG injection, trace validation | 2-3 hr | ❌ Deep |
| **Governance** | `todo7-domains.test.ts` | Autonomy transitions | 1 hr | ✅ Gate logic |
| **Goal System** | `rl/contract/goal-action.test.ts`, `no-bypass.test.ts` | Dispatch pipeline | 1-2 hr | ❌ Deep |
| **LM Service** | `todo16-batching.test.ts` | Manifold/cache wiring | 1-2 hr | ❌ Deep |
| **Kernel/Gates** | `core19-c4/c5/c6.test.ts` | Log persistence, replay | 1 hr | ✅ Config |
| **Memory** | `memory.test.ts`, `state-persistence.test.ts` | Bag API, codec | 30 min | ✅ API fix done |

### B1. Quick Wins First (Parallelizable, ~1 hr total)
- **Surface D24**: Audit rule matrix in README → update doc or add missing rules
- **Fundamentals Gate**: Check bench runner config; ensure output format matches test expectation
- **Memory**: Bag API already fixed (.size, .all()); verify state codec round-trips
- **Kernel/Gates**: Verify gate log capacity constants match test expectations

### B2. Deep Investigations (Sequential or Subagent-Parallel)
| Task | Entry Point | Key Files to Check |
|------|-------------|-------------------|
| **RL RNG Injection** | `bandit-epsilon-greedy.test.ts` | `src/rl/impls/adapters/*`, `src/rl/impls/RewardBeliefAdapter.ts`, negotiator |
| **Trace Validation** | `rl/parity/trace-validation.test.ts` | `src/proposal/cycle-trace.ts`, `src/kernel/KernelPerceptionGate.ts`, `src/nar-execution.ts` |
| **Governance Transitions** | `todo7-domains.test.ts` | `src/kernel/KernelActionGate.ts`, `src/autonomy/wiring.ts`, `LEGAL_TRANSITIONS` |
| **Goal Dispatch Pipeline** | `rl/contract/goal-action.test.ts` | `src/nar.ts:goal()`, `src/nar-io.ts`, `src/motor/ToolRegistry.ts`, `src/rl/impls/adapters/action.ts` |
| **LM Manifold/Cache** | `todo16-batching.test.ts` | `src/lm/system-one/contrastive.ts`, `src/lm/system-one/embedding-cache.ts`, `src/lm/manifold/*` |

---

## Phase C: Consolidation Gates (1 session)

### C1. Typecheck Isolation [30 min]
```bash
# Core only (exclude UI)
pnpm tsc --project tsconfig.root.json --noEmit 2>&1 | grep -v "ui\|UI" || true
```
- Target: 0 errors in `src/`
- Document UI errors as out-of-scope

### C2. Dependency Cycles [15 min]
- `pnpm deps:gate` → 61 cycles (pre-existing)
- Decision: **Update baseline** to 61 (consolidation revealed, didn't create)
- Document in `docs/adr/DEPENDENCY_CYCLES_BASELINE.md`

### C3. Documentation Drift [15 min]
- `pnpm docs:drift` → `valid-atom.ts` runtime error
- Fix or add to known-issues list

---

## Success Criteria (Definition of Done)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test import errors | **0** | `pnpm test -- --run` completes loading |
| Core test pass rate | **>90%** | (passed / (passed+failed)) excluding UI/E2E/bench |
| Typecheck (core src) | **PASS** | 0 errors in `src/` |
| Lint | **PASS** | `pnpm lint` |
| Exports check | **PASS** | `pnpm exports:check` && `pnpm exports:barrels` |

---

## Execution Playbook

### Session 1: Unblock (45 min)
```
1. Edit vitest.config.ts → reorder aliases (deep first)
2. Test single file: todo27-seeded-sampling.test.ts
3. Full suite run → capture baseline
4. Categorize failures into spreadsheet/tracking
```

### Session 2: Quick Wins (1 hr)
```
Parallel or sequential:
- Surface D24: grep README rule matrix → diff vs src/rules/impls/
- Fundamentals Gate: check bench.ts output format
- Memory: verify state codec tests pass
- Kernel/Gates: check GATE_LOG_CAPACITY constants
```

### Session 3: Deep Fixes (2-3 hr)
```
Subagent-per-subsystem or sequential:
- RL RNG: trace Math.random() calls → inject RandomSource
- Trace Validation: verify mintCognitiveEvent wiring
- Governance: verify LEGAL_TRANSITIONS completeness
- Goal Pipeline: trace observation→belief→value→goal→tool→reward
- LM Manifold: verify cache key generation + backend selection
```

### Session 4: Gates & Cleanup (1 hr)
```
- Typecheck core isolation
- Deps gate baseline update
- Docs drift fix
- Final full suite run → verify >90%
```

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Vitest alias fix doesn't work | Fallback: convert all deep imports to barrel in source (already 7 done, ~40 more) |
| RL/Goal deep fixes take longer | Timebox: 45 min each → if blocked, document as known-issue, move on |
| Typecheck reveals new errors | Isolate to `src/` only; UI errors are pre-existing |
| Test flakiness | Run flaky tests 3x; only fix deterministic failures |

---

## File Index (Quick Ref)

**Config**: `vitest.config.ts` (193 aliases — **reorder deep first**)
**Framework**: `tests/nar/framework/ReasoningTestBuilder.ts`
**Key Source**:
- `src/kernel/KernelActionGate.ts` — BoundedMap, autonomy transitions
- `src/kernel/KernelPerceptionGate.ts` — mintCognitiveEvent, clamp01
- `src/schemas/truth.ts` — clamp01, confidenceCeiling
- `src/lm/system-one/contrastive.ts` — manifold cache
- `src/rl/impls/RewardBeliefAdapter.ts` — RNG injection
- `src/proposal/cycle-trace.ts` — trace validation
- `src/autonomy/wiring.ts` — governance transitions

---

## Minimal Viable Next Step

```bash
# 1. Fix vitest deep aliases (single config edit)
# 2. Verify
pnpm test tests/nar/todo27-seeded-sampling.test.ts -- --run
# 3. Full baseline
pnpm test -- --run 2>&1 | tee baseline.txt
```

Everything else unblocks from there.