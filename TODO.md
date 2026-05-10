# NEXT.md — Completion & Quality Plan (Revised)

> **Status baseline**: 90+ source files, **383 passing tests**, 0 TS errors, NAL1-9 rules, 3 LM clients, streaming, RLFP, metacognition, full CLI, HTTP/WS agent, IRC bot.
>
> **🟢 Progress Update**: Phase 1 (Refactor) ✅ COMPLETE. Phase 2 (Bot) ✅ COMPLETE. Phase 3 (Test Coverage) ✅ COMPLETE. **Ready for Phase 4 (Persistence)**.

---

## Priorities

| Rank | Concern | Rationale |
|------|---------|-----------|
| **1** | Persistence | Structured WAL so state survives crashes — next major deliverable |
| **2** | Ecosystem | Plugin system, NPM split — enable reuse |
| **3** | Prod/lint/docs | Docker, CI, lint — surfacing work, not blocking |

---

## Phase 1 — Refactor: Eliminate Duplication, Flatten Complexity

**Status**: ✅ **COMPLETE** — All 11 sub-tasks completed. See historical details below.

<details>
<summary>Historical details (click to expand)</summary>

### 1.1 Split the NAR God Class

`src/nar/nar.ts` (564 lines, 36 methods, 7 constructor-initialized subsystems). Split into:

```
src/nar/
├── nar.ts               # Core (~120 LOC): constructor, lifecycle, input delegation
├── nar-execution.ts     # run(), runStream(), cycle loop
├── nar-io.ts            # input(), believe(), goal(), question(), saveToFile(), loadFromFile(), export(), import()
├── nar-lm.ts            # initializeLM(), askNaturalLanguage(), streamResponse(), cancelLMStream(), processHypothesisWithFeedback(), enrichMemoryWithLM()
└── nar-facade.ts        # Thin delegations: getBeliefs(), getGoals(), getQuestions(), queryTerm(), ask(), getDerivationHistory(), traceTerm(), explain(), getMetrics(), executeTool(), listTools()
```

### 1.2 Eliminate NAL Rule Boilerplate ✅ COMPLETED

836 LOC → ~300 LOC via `syllogize`/`transform`/`foldKind` helpers.

### 1.3 Unify Premise Selection Loop ✅ COMPLETED

5 call sites unified into single `samplePremises()` generator.

### 1.4 Deduplicate LM Rule Factory ✅ COMPLETED

`src/nar/lm/rules.ts` defined 13 identical `createXxxRule()` methods. Consolidated into:

```typescript
13 rules consolidated into single `LMRules.createAll()` factory.

### 1.5 Centralize Error Handling ✅ COMPLETED

Created `errMsg()`, `errObj()`, `catchAndLog()` in `src/nar/utils/helpers.ts`. Replaced 40+ inline instances.

### 1.6 Restructure Terms types.ts ✅ COMPLETED

Split into focused modules: `serialize.ts`, `complexity.ts`, `similarity.ts`, `substitute.ts`, `normalize.ts`.

### 1.7 Consistify Barrels & Clean Imports ✅ COMPLETED

Replaced all `export *` with explicit named exports across 6 barrel files.

### 1.8 Unify Lifecycle via BaseComponent ✅ COMPLETED

`EmbeddedIRCServer` and `ToolManager` extend `BaseComponent`.

### 1.9 Replace Regex Term Inversion ✅ COMPLETED

Replaced string `invert()` with structural term negation using `termsEqual()`.

### 1.10 Config Defaults Single-Source ✅ COMPLETED

`types/core.ts` is single source; all others import from it.

### 1.11 Replace Hash-Based Comparison ✅ COMPLETED

All `.hash ===` comparisons replaced with `termsEqual()` calls.

</details>

---

## Phase 2 — Stabilize the Bot

**Status**: ✅ **COMPLETE** — All 5 sub-tasks completed.

### 2.1 Split Bot Monolith ✅ COMPLETED

Bot split into: `BotSession.ts`, `message-router.ts`, `handlers/` (command, belief, question, nl), `IRCClient.ts`, `index.ts` (thin orchestrator).

### 2.2 Proper IRC Client Integration ✅ COMPLETED

`RealIRCClient` with auto-reconnect, SASL support, flood protection, ping timeout detection.

### 2.3 Bot Testing ✅ COMPLETED

Unit tests for all handlers, BotSession integration tests, message-router tests.

### 2.4 Bot Fault Tolerance ✅ COMPLETED

Reconnection with backoff, flood protection (3 msgs/channel), NAR crash isolation, ping timeout.

### 2.5 Bot Configuration Profiles ✅ COMPLETED

Refactored to layered defaults: `BASE` + `overrides()` function.

---

## Phase 3 — Test Coverage (Target: 80% branch, 90% line)

**Status**: ✅ **COMPLETE** — All 6 sub-tasks completed. 383 tests passing.

### 3.1 LM Client Testing ✅ COMPLETED

LM parser, MockLMClient, RuleBasedLMClient tests in `lm.test.ts`.

### 3.2 RLFP Testing ✅ COMPLETED

RLFP tests exist in `rlfp.test.ts`.

### 3.3 Self/Metacognition Testing ✅ COMPLETED

Self tests exist in `nal9-self.test.ts`.

### 3.4 Stream Pipeline Testing ✅ COMPLETED

Stream tests: throttle, backpressure, createPipeline in `stream.test.ts`.

### 3.5 Property-Based Tests ✅ COMPLETED

Normalize idempotence, bag invariants, rule idempotence in `property-based.test.ts`.

### 3.6 E2E Tests in CI ✅ COMPLETED

E2E tests enabled in Jest config, all 47 E2E tests passing.

---

## Phase 4 — Structured Persistence

### 4.1 WAL (Write-Ahead Log)

```
src/nar/persistence/
├── wal.ts              # WriteAheadLog: append-only JSONL, fsync on commit, rotate on size limit
├── snapshot.ts         # Periodic compressed snapshots (every N cycles or sigterm)
├── recovery.ts         # Load latest snapshot → replay WAL → reconstruct state
├── backends.ts         # FsPersistence, MemoryPersistence, (optional) SqlitePersistence
└── manager.ts          # PersistenceManager: auto-snapshot scheduling, corruption detection
```

WAL format:
```jsonl
{"op":"belief","term":{"k":"inheritance","a":[{"k":"a","s":"bird"},{"k":"a","s":"animal"}]},"truth":{"f":0.9,"c":0.8}}
{"op":"merge","hash":12345,"priority":0.87}
```

### 4.2 TaskSnapshot Format

Remove the lossy `toString()`-based `export()`/`import()`. New format preserves full term structure:

```typescript
interface TaskSnapshot {
    term: SerializedTerm;  // recursive: { k: 'inheritance', a: [child, ...] }
    type: TaskType;
    truth: { f: number; c: number };
    stamp: { id: string; source: string; depth: number };
    budget: { priority: number; durability: number; quality: number };
    cycle: number;
}
```

### 4.3 Bot Session Persistence

Auto-save bot state on:
- SIGTERM / SIGINT (graceful shutdown)
- Every N minutes (configurable, default 5)
- On channel kick/disconnect (save before reconnect attempt)

Auto-load on bot startup from last saved session. Bot resumes with full memory intact.

---

## Phase 5 — Ecosystem

### 5.1 Plugin System

Lightweight API on top of the existing registration patterns:

```typescript
interface SeNARSPlugin {
    id: string;
    install(nar: NAR): void | Promise<void>;
    uninstall?(nar: NAR): void;
}

nar.use(plugin);
nar.unuse('plugin-id');
```

Plugins can: `nar.processor.registerRule(...)`, `nar.tools.register(...)`, register LM rules, hook into event bus. No new infrastructure — just a registry wrapper around existing `register`/`unregister` methods.

### 5.2 NPM Workspace Split

pnpm workspace, 8 packages:

```
@senars12/terms       # Term types, TermBuilder, hashing, serialization
@senars12/rules       # NAL rules, trie index, processor
@senars12/memory      # Memory, bags, concepts, GC, forgetting
@senars12/reasoner    # Reasoner, strategies, premise formation
@senars12/lm          # LM clients, routing, enrichment
@senars12/agent       # Agent, HTTP/WS server
@senars12/cli         # CLI + REPL
@senars12/nar         # Full engine (peer-depends on all above)
```

Root `package.json` remains the entry; each sub-package has its own `package.json` with `exports` map. Use pnpm `catalog:` for version sync.

### 5.3 MeTTa Bridge (Light)

Minimal adapter — not a full MeTTa interpreter, just format bridging:

```
src/metta/
├── adapter.ts   # MeTTa space → NAR beliefs and back. ~80 LOC
└── index.ts     # Re-export adapter
```

### 5.4 MCP Server (Deferred)

Spec only; implementation moved to next cycle after all above is stable.

---

## Phase 6 — Production Polish (Lower Priority)

### 6.1 Docker + CI

`Dockerfile` + `.github/workflows/ci.yml` — templated, mechanical. Do last.

### 6.2 Lint Cleanup

Fix `no-explicit-any` and `no-non-null-assertion` warnings. Use `unknown` + type guards instead. Add `zod` schema validation for LM response parsing (bonus: improves actual correctness). This is ~150 small changes across 15 files. Do after refactoring (Phase 1) so the surface area is smaller.

### 6.3 Vitest Migration

Replace Jest with Vitest. Remove `jest`/`ts-jest`/`@types/jest`, add `vitest`. Codemod `jest.fn()` → `vi.fn()`, etc. Mechanical. Do after Phase 3 (tests pass on Jest first, then migrate).

### 6.4 Coverage Thresholds

Configure in vitest: `branches: 80%`, `lines: 90%`.

### 6.5 Documentation

- `docs/ARCHITECTURE.md` — module map, data flow diagram
- `docs/BOT.md` — bot deployment, configuration, troubleshooting
- `docs/PLUGINS.md` — plugin authoring guide

---

## Implementation Sequence

```
Week 1: Phase 1 (Refactor) ✅ COMPLETE
Week 2: Phase 2 (Bot) + Phase 3 (Tests) ✅ COMPLETE
Week 3: Phase 4 (Persistence) — NEXT
4.1 WAL + snapshot
4.2 TaskSnapshot format
4.3 Bot session persistence

Week 4: Phase 5 (Ecosystem)
5.1 Plugin system
5.2 NPM workspace split
5.3 MeTTa bridge

Week 5: Phase 6 (Polish)
6.1 Docker + CI
6.2 Lint cleanup
6.3 Vitest migration
6.4 Coverage thresholds
6.5 Documentation
```

---

## Deliverables Checklist

### Phase 1 (Refactor) — ✅ COMPLETE
All 11 sub-tasks completed. See historical details above.

### Phase 2 (Bot) — ✅ COMPLETE
All 5 sub-tasks completed. Bot split, RealIRCClient, fault tolerance, config profiles.

### Phase 3 (Test Coverage) — ✅ COMPLETE
All 6 sub-tasks completed. 383 tests passing (80%+ coverage).

### Phase 4 (Persistence) — 🎯 NEXT
- [ ] WAL + snapshot persistence with 2 backends (Fs, Memory)
- [ ] TaskSnapshot format round-trips without data loss
- [ ] Bot auto-save/load session persistence

### Phase 5 (Ecosystem) — Deferred
- [ ] Plugin system: `nar.use()` / `nar.unuse()`
- [ ] NPM workspace: 8 packages with pnpm catalog
- [ ] MeTTa adapter bridge

### Phase 6 (Polish) — Deferred
- [ ] Dockerfile + compose (bot, server, cli profiles)
- [ ] GitHub Actions CI: typecheck, lint, test
- [ ] Zero `no-explicit-any` warnings
- [ ] Jest → Vitest migration complete
- [ ] Docs: ARCHITECTURE, BOT, PLUGINS


---

## Next Steps

### Phase 4 (Persistence) — 🎯 Ready to Start

Key deliverables:
1. **WAL (Write-Ahead Log)**: `src/nar/persistence/wal.ts` — append-only JSONL, fsync, rotation
2. **Snapshots**: `src/nar/persistence/snapshot.ts` — periodic compressed snapshots
3. **Recovery**: `src/nar/persistence/recovery.ts` — load snapshot + replay WAL
4. **Backends**: `src/nar/persistence/backends.ts` — FsPersistence, MemoryPersistence
5. **Manager**: `src/nar/persistence/manager.ts` — auto-snapshot scheduling
6. **TaskSnapshot**: Preserve full term structure (recursive `{k, a[]}`) instead of lossy `toString()`
7. **Bot Session Persistence**: Auto-save on SIGTERM, every N minutes, auto-load on startup

### Phase 5 (Ecosystem) — Deferred

- Plugin system: `NAR.use()` / `NAR.unuse()` methods
- NPM workspace: 8 packages with pnpm catalog
- MeTTa adapter bridge

### Phase 6 (Polish) — Deferred

- Dockerfile + CI
- Lint cleanup (`no-explicit-any`)
- Vitest migration
- Coverage thresholds (80% branches, 90% lines)
- Documentation (ARCHITECTURE, BOT, PLUGINS)