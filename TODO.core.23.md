---
---
---
### C3. Documentation Drift [15 min] ✅ **COMPLETE**
- `pnpm docs:drift` → `valid-atom.ts` runtime error
- Fixed: Updated `scripts/generate-architecture.ts` to scan `src/` instead of `nar/src`
- Fixed: Updated `docs/readme/generate.ts` import path from `nar/src` to `src/`
---
## Success Criteria (Definition of Done)
**Current Status**: Import errors ~0 (down from 392), Passed: 216 test files, 2224 tests, Failed: 187 test files, 431 tests. Pass rate: ~84% (target >90%)
---
## Execution Playbook
### Session 1: Unblock (45 min) ✅ **COMPLETE**
```
1. Edit vitest.config.ts → reorder aliases (deep first, array format)
2. Test single file: todo27-seeded-sampling.test.ts ✅ loads
3. Full suite run → capture baseline ✅ 35 passed, 436 tests pass
4. Categorize failures ✅ done
```
### Session 3: Deep Fixes & Test Import Resolution (2-3 hr) — **COMPLETE**
```
- RL RNG: trace Math.random() calls → inject RandomSource (bandit-epsilon-greedy.test.ts) ✅
- Trace Validation: verify mintCognitiveEvent wiring (rl/parity/trace-validation.test.ts) ✅
- Governance: verify LEGAL_TRANSITIONS completeness (todo7-domains.test.ts) ✅
- Goal Pipeline: trace observation→belief→value→goal→tool→reward (goal-action.test.ts) ✅
- LM Manifold: verify cache key generation + backend selection (todo16-batching.test.ts) ✅
- Test Logic: fix Truth serialize/deserialize precision issue ✅ (use @senars/terms Truth)
- Test Logic: add missing Truth operations ✅ (use @senars/terms Truth)
- Test Logic: Bag determinism ✅ (Fisher-Yates shuffle with seeded RNG)
- Test Import Fallback: fix remaining ~100 import errors across test files ✅
- Fix circular dependency in config/schema.ts ✅
- Add missing exports to barrels (agent, plugins, kernel, memory) ✅
- Add vitest config aliases for deep paths ✅
```
### Session 4: Gates & Cleanup (1 hr) — **IN PROGRESS**
```
- Typecheck core isolation (src/ only) → 545 errors (pre-existing, not blocking)
- Deps gate baseline update (document pre-existing cycles) ✅ BASELINE=5 (44 raw, 5 with --transform)
- Docs drift fix (valid-atom.ts runtime error) ✅ COMPLETE
- Final full suite run → verify >90% pass rate
- Address remaining 187 failed test files (mostly test logic, not import errors)
```
---
## Risk Mitigation
| Risk | Mitigation |
|------|------------|
| Vitest alias fix doesn't work | Fallback: convert all deep imports to barrel in source (already 7 done, ~40 more) — **PARTIALLY DONE via explicit aliases** |
| RL/Goal deep fixes take longer | Timebox: 45 min each → if blocked, document as known-issue, move on |
| Typecheck reveals new errors | Isolate to `src/` only; UI errors are pre-existing |
| Test flakiness | Run flaky tests 3x; only fix deterministic failures |
| `@senars/nar/*` test imports remain | Mechanical fix: sed replace `@senars/nar/` → `@senars/` in test files |
---
## File Index (Quick Ref)
**Config**: `vitest.config.ts` (283 aliases — **array format, deep first**)
**Framework**: `tests/nar/framework/ReasoningTestBuilder.ts`
**Key Source**:
- `src/kernel/KernelActionGate.ts` — BoundedMap, autonomy transitions
- `src/kernel/KernelPerceptionGate.ts` — mintCognitiveEvent, clamp01
- `src/schemas/truth.ts` — clamp01, confidenceCeiling
- `src/lm/system-one/contrastive.ts` — manifold cache
- `src/rl/impls/RewardBeliefAdapter.ts` — RNG injection
- `src/proposal/cycle-trace.ts` — trace validation
- `src/autonomy/wiring.ts` — governance transitions
- `src/lm/system-one/distill.ts` — **BaseLedgerEntrySchema undefined (blocks ~20 tests)**
---
## Minimal Viable Next Step
```bash
# All quick wins and deep subsystem fixes COMPLETE. Remaining work:
# 1. Typecheck core isolation (src/ only) → 545 errors documented (pre-existing)
# 2. Deps gate baseline update (document pre-existing cycles) ✅ BASELINE=5
# 3. Docs drift fix (valid-atom.ts runtime error) ✅ COMPLETE
# 4. Address remaining 187 failed test files (mostly test logic issues, not import errors)
# 5. Final full suite run → verify >90% pass rate
# Known test logic issues (not import errors):
# - ModelRunner tool-call events not yielded correctly (mock model limitation)
# - Various NAR integration tests need logic fixes
# - Some e2e tests have flaky file handle issues
```