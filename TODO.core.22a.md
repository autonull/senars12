**Next: Resolve API compatibility issues after nar package migration**
**Export Subpaths:**
- Before: nar: 43 subpaths
- After: Consolidated into root `src/` structure (imports migrated)
- Total export subpaths: 89 → ~65 (nar imports migrated, API compat issues remain)
**Current Persistence Sites (3 → target 1):**
1. `src/log/store.ts` — LogStore (primary, append-only) ✅
2. `src/log/EventLogPersistence.ts` — pure replay reducers (replayCognitiveState, replayTaskAdmissions) ✅
3. `core/src/eventlog/` — legacy SqliteEventLog/InMemoryEventLog (replaced by LogStoreEventLog adapter) ✅
4. `nar/src/facade/persistence.js` — deleted, replaced by LogStoreStatePersister ✅
**Gates Status After Migration:**
- `pnpm typecheck` ❌ FAIL (~140 errors across 25 files - API compatibility issues)
- `pnpm typecheck:bin` ✅ PASS
- `pnpm typecheck:packages` ✅ PASS (5 packages clean)
- `pnpm lint` ✅ PASS
- `pnpm exports:check` ✅ PASS
- `pnpm deps:gate` ✅ PASS (0 cycles ≤ baseline 0)
- `pnpm docs:drift` ❌ FAIL (pre-existing nar runtime error in `valid-atom.ts`)
- `pnpm env:grammar` ❌ FAIL (pre-existing UI issue — out of scope)
**Export Subpaths Reduced:**
- Before: util:13 subpaths
- After: Consolidated into root `src/` structure (util/types/events/errors/commands/feedback/bag/config/memory)
- Total export subpaths: 89 → 76 (util package exports merged into root)
### Consolidation Plan (M1-M3)
**Phase 1: Core Package Migration (util → core → io → metta → nar)**
- ✅ **util**: Move `util/src/` → `src/util/`, `src/types/`, `src/events/`, `src/errors/`, `src/commands/`, `src/feedback/`, `src/bag/`, `src/config/`, `src/memory/` (merge with existing). Update imports. Remove `util/` package.
- ✅ **core**: Move `core/src/` → `src/` (merge: agent, engine, cortex, motor, memory, protocol, schemas, budget, etc.). Update imports. Remove `core/` package.
- ✅ **io**: Move `io/src/` → `src/io/` (merge with existing). Update imports. Remove `io/` package.
- ✅ **metta**: Move `metta/src/` → `src/metta/` (merge with existing). Update imports. Remove `metta/` package.
- 🔄 **nar**: Move `nar/src/` → `src/` (merge: kernel, lm, memory, rules, terms, bag, cognitive, etc.). **IN PROGRESS** - Import/export migration ~95% complete. Remaining: API compatibility fixes across focus, learning, lm, memory, kernel modules.
**Phase 1B: API Compatibility Fixes (NEW - blocking typecheck)**
- [ ] Fix `Focus` class BagItem implementation & FocusTask/Concept API mismatches (focus/Focus.ts, focus/FocusBag.ts, focus/GameFocus.ts)
- [ ] Fix `AikrShell`/`Bag` API mismatches in learning/aikr-processor.ts (removeAll, pressure, decay calls)
- [ ] Fix `Number` callable errors in lm/feedback.ts, lm/system-one/contrastive.ts (pressure(), decayRateValue())
- [ ] Fix `kernel/replay-compat.ts` TaskData vs string mismatches
- [ ] Fix `memory/concept.ts` implicit any types in callbacks
- [ ] Fix `nar-presets.ts` missing `@senars/agent` import (MettaPort)
- [ ] Fix `nar.ts` NarEventBus type compatibility with EventBus
- [ ] Fix `protocol/index.ts` isolatedModules re-export issue
- [ ] Fix `query/api.ts` implicit any types
- [ ] Fix `types/events.ts` EventBus import issues
- [ ] Fix `util/bag.ts` RandomSource export & HistogramImpl issues
**Phase 2: UI Package Migration**
- [ ] **ui-contract**: Move `ui-contract/src/` → `src/ui-contract/` (merge). Update imports. Remove `ui-contract/` package.
- [ ] **ui-shell**: Move `ui-shell/src/` → `src/ui-shell/` (merge). Update imports. Remove `ui-shell/` package.
- [ ] **ui-backend-2d**: Move `ui-backend-2d/src/` → `src/ui-backend-2d/` (merge). Update imports. Remove `ui-backend-2d/` package.
- [ ] **ui-backend-fractal**: Move `ui-backend-fractal/src/` → `src/ui-backend-fractal/` (merge). Update imports. Remove `ui-backend-fractal/` package.
- [ ] **ui**: Move `ui/src/` → `src/ui/` (merge with existing `src/client`, `src/server`). Update imports. Remove `ui/` package.
**Phase 3: Final Cleanup**
- [ ] Update root `package.json`: remove workspace dependencies, add consolidated dependencies, update exports
- [ ] Update `pnpm-workspace.yaml`: remove all sub-packages
- [ ] Update `tsconfig.root.json`: remove all `@senars/*` path aliases, keep only `src/` structure
- [ ] Run all gates: typecheck, lint, surface-no-legacy, exports:check, deps:gate, typecheck:packages, docs:drift
- [ ] Verify test suite passes
**Dependency Order (topological):**
util (leaf) → core → io → metta → ui-contract → ui-shell → ui-backend-2d/ui-backend-fractal → nar → ui
**Current Session: ✅ Phase 1 - util/core/io/metta package migrations COMPLETE, 🔄 nar package migration IN PROGRESS (imports 95% done, API compat fixes needed across ~15 files)**