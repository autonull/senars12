**Next: Phase 3 Final Cleanup — remove workspace packages, update configs, verify tests**
**Export Subpaths:**
- Before: nar: 43 subpaths
- After: Consolidated into root `src/` structure (imports migrated)
- Total export subpaths: 89 → ~65 (nar imports migrated, API compat issues resolved)
**Current Persistence Sites (3 → target 1):**
1. `src/log/store.ts` — LogStore (primary, append-only) ✅
2. `src/log/EventLogPersistence.ts` — pure replay reducers (replayCognitiveState, replayTaskAdmissions) ✅
3. `core/src/eventlog/` — legacy SqliteEventLog/InMemoryEventLog (replaced by LogStoreEventLog adapter) ✅
4. `nar/src/facade/persistence.js` — deleted, replaced by LogStoreStatePersister ✅
**Gates Status After Migration:**
- `pnpm typecheck` ❌ FAIL (UI out of scope; core src/ mostly clean)
- `pnpm typecheck:bin` ⚠️ FAIL (bin/UI — pre-existing, out of scope)
- `pnpm typecheck:packages` ⚠️ FAIL (runs root typecheck incl. UI; core packages clean when isolated)
- `pnpm lint` ✅ PASS
- `pnpm exports:check` ✅ PASS
- `pnpm exports:barrels` ✅ PASS
- `pnpm deps:gate` ⚠️ FAIL (pre-existing circular dep in parameter-ledger.ts)
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
- ✅ **nar**: Move `nar/src/` → `src/` (merge: kernel, lm, memory, rules, terms, bag, cognitive, etc.). **COMPLETE** - Import/export migration done, API compatibility fixes resolved.
**Phase 1B: API Compatibility Fixes (COMPLETE)**
- ✅ Fix `Focus` class BagItem implementation & FocusTask/Concept API mismatches (focus/Focus.ts, focus/FocusBag.ts, focus/GameFocus.ts)
- ✅ Fix `AikrShell`/`Bag` API mismatches in learning/aikr-processor.ts (removeAll, pressure, decay calls)
- ✅ Fix `Number` callable errors in lm/feedback.ts, lm/system-one/contrastive.ts (pressure(), decayRateValue())
- ✅ Fix `kernel/replay-compat.ts` TaskData vs string mismatches
- ✅ Fix `memory/concept.ts` implicit any types in callbacks & Bag API (peek, size, toArray, forEach, find, remove)
- ✅ Fix `nar-presets.ts` missing `@senars/agent` import (MettaPort) → fixed to `./agent/metta-port.js`
- ✅ Fix `nar.ts` NarEventBus type compatibility with EventBus → changed systemEventBus type to EventBus
- ✅ Fix `protocol/index.ts` isolatedModules re-export issue → export type { ToolSpec as Tool }
- ✅ Fix `query/api.ts` implicit any types & Bag API (size, toArray)
- ✅ Fix `types/events.ts` EventBus import issues → import from @senars/util/events, add override modifiers
- ✅ Fix `util/bag.ts` RandomSource export & HistogramImpl issues → re-export from random.ts, fix percentile, fix InternalEntry casts
- ✅ Fix `util/index.ts` isolatedModules re-exports & duplicate RandomSource → export type for bag types, remove duplicate
- ✅ Fix `memory/memory.ts` Bag.forEach → use all()
- ✅ Fix `memory/state/serialization.ts` Bag.entries → use all()
- ✅ Fix `lm/enrichment.ts` ConceptConnections type → size property not method
- ✅ Fix `lm/system-one/contrastive.ts` Bag API (size, decay)
- ✅ Fix `query/trace.ts` Bag.toArray → all()
- ✅ Fix `facade/games.ts` ContradictionEvent handler typing
**Phase 2: SKIPPED — UI packages never completed, out of scope for core consolidation**

**Phase 3: Final Cleanup (core packages only) — IN PROGRESS**
- ✅ Update root `package.json`: remove workspace dependencies (util, core, io, metta, nar), add consolidated dependencies (better-sqlite3, effect, immutable, valibot, @types/better-sqlite3), update exports
- ✅ Update `pnpm-workspace.yaml`: remove util, core, io, metta, nar, log sub-packages (keep ui, ui-contract, ui-backend-2d, ui-backend-fractal, ui-shell)
- ✅ Update `tsconfig.root.json` and `tsconfig.json`: add comprehensive `@senars/*` path aliases mapping to consolidated `src/` structure
- ✅ Update `vitest.config.ts`: use vite-tsconfig-paths for test path resolution
- ✅ Update `scripts/typecheck-packages.ts`: delegate to root typecheck (consolidated)
- ✅ Update `scripts/lib/dpdm.ts`: use `src/` only, pass tsconfig.root.json for path aliases
- ✅ Fix circular dependency in `src/config/parameter-ledger.ts` (import cachePath directly from paths.js)
- ✅ Fix `src/events/index.ts` exports (EventBus, EventReceiver, EventUnsubscribe, PushQueue, Signal)
- ✅ Fix `src/config/index.ts` exports (cognitiveBounds, validateAgainstBounds, BoundProjection, etc.)
- ✅ Fix `src/bag/index.ts` exports (Histogram, HistogramImpl)
- ✅ Remove old package directories: `core/`, `io/`, `metta/`, `util/`, `nar/`
- ✅ Fix duplicate export in `src/metta/index.ts` (parseMeTTa)
- ✅ Fix `@senars/nar/` imports in tests (removed trailing slash)
- ✅ **Scripts/bin import migration (MAJOR PROGRESS):**
  - ✅ `scripts/arcade.ts`, `scripts/lib/rl-arms.ts` — migrated to `@senars/*` path aliases
  - ✅ `src/bin/bot.ts`, `src/bin/imagine.ts`, `src/bin/self-report.ts`, `src/bin/config-validate.ts` — fixed imports
  - ✅ `src/bin/commands/*.ts` (11 files) — migrated to `@senars/*` path aliases
  - ✅ `src/bin/lib/*.ts` (6 files) — migrated to `@senars/*` path aliases
  - ✅ `src/cli/*.ts` — created `@senars/cli` alias, fixed imports
  - ✅ Test baseline files (`2048.ts`, `snake.ts`, `tetris.ts`, `tictactoe.ts`) — import from `@senars/game`
- ✅ Added missing path aliases: `@senars/dialogue`, `@senars/cli`
- ✅ `src/index.ts` now exports protocol types for UI compatibility (`GraphNodeData`, `CognitiveEvent`, `ChatMessage`, `Lens`, `LensSpec`, `builtinLensSpecs`, `isNarsese`, `Agent`, etc.)
- ✅ `src/agent/index.ts` exports core types (`NAR`, `createNAR`, `NAREventMap`, etc.)
- ⚠️ **REMAINING (core only):**
  - Remaining scripts in `scripts/` still import from `../nar/src/`, `../../util/src/`, etc. (~20 files)
  - Path resolution in vitest: `BoundedMap` constructor issue in `src/terms/impls/intern.ts` (import from `@senars/util` not working in test context)
  - ADR docs reference old paths (e.g., `nar/src/bag/Bag.ts`)
  - Layering tests (`todo28-layering.test.ts`) check for old package structure — need update
  - Surface tests (`todo17b-surface.test.ts`) check for old `nar/src/` paths — need update
- ⚠️ Run core gates: typecheck ❌ (UI), lint ✅, exports:check ✅, exports:barrels ✅, typecheck:packages ⚠️ (runs root)
- ⚠️ Verify core test suite: 67/80 pass, 13 failures (mostly layering/surface/BoundedMap path issues)
**Dependency Order (topological — core only):**
util (leaf) → core → io → metta → nar
**Current Session: Phase 3 Final Cleanup IN PROGRESS. Major import migration done for bin/commands, scripts partially done. Remaining: ~20 scripts, BoundedMap test issue, layering/surface tests.**
**Revised Timeline: ~2-3 more sessions to complete core-only work (UI remains out of scope).**