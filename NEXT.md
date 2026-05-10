# NEXT.md — Completion & Quality Plan (Revised)

> **Status baseline**: 90+ source files, 283 passing tests, 0 TS errors, NAL1-9 rules, 3 LM clients, streaming, RLFP, metacognition, full CLI, HTTP/WS agent, IRC bot. **The engine works; now: strip cruft, deepen testing, ship a real bot.**
> 
> **🟢 Progress Update**: Phase 2 (Bot) fully completed. Phase 3 (Test Coverage) started. 336 tests passing. Bot split into handlers/router/session with unit tests, RealIRCClient with reconnect/flood protection, config profiles refactored. LM and stream tests added.

---

## Priorities

| Rank | Concern | Rationale |
|------|---------|-----------|
| **1** | Refactor/deduplicate | The foundation must be clean before building on it |
| **2** | Bot reliability | The primary application — must be rugged, tested, debuggable |
| **3** | Test coverage | 80% branches / 90% lines — prove correctness before production |
| **4** | Persistence | Structured WAL so state survives crashes |
| **5** | Ecosystem | Plugin system, NPM split — enable reuse |
| **6** | Prod/lint/docs | Docker, CI, lint — surfacing work, not blocking |

---

## Phase 1 — Refactor: Eliminate Duplication, Flatten Complexity

**Status**: Items 1.4, 1.5, 1.6, 1.7, 1.9, 1.11 completed. Phase 2 (Bot) fully completed. Phase 3 (Test Coverage) started. 336 tests passing, 0 TS errors.

### 1.5 Centralize Error Handling ✅ COMPLETED
- Created `errMsg()`, `errObj()`, `catchAndLog()` in `src/nar/utils/helpers.ts`
- Replaced 9 instances of inline error pattern across codebase
- Updated utils/index.ts exports

### 1.6 Restructure Terms types.ts ✅ COMPLETED
- Split into focused modules: `serialize.ts`, `complexity.ts`, `similarity.ts`, `substitute.ts`
- `types.ts` now contains only pure type definitions
- `normalize.ts` enhanced with `improveNormalization()`
- All exports consolidated in `index.ts`

### 1.11 Replace Hash-Based Term Comparison ✅ COMPLETED
**Problem**: Using `.hash ===` for term comparison is naive and fails when distinct terms have the same hash collision. Must use `termsEqual()` for structural equality.

**Solution**: 
1. Fixed `termsEqual()` in `accessors.ts` to do full structural comparison
2. Re-export from `types.ts` for barrel compatibility
3. Replaced all `.hash ===` comparisons with `termsEqual()` calls:
   - `normalize.ts`, `similarity.ts`, `utils.ts` - early exit optimization
   - `concept.ts`, `memory-revision.ts` - belief lookup, task comparison
   - `bounded-bag.ts` - bag item matching
   - `nal.ts`, `nal-extended.ts` - all rule comparisons
4. Removed `sameHash()`, `sameTerm()`, `termKey` aliases from `guards.ts` (backwards compat not needed)

---

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

The core `nar.ts` class keeps public readonly fields (memory, reasoner, query, tools, self, rlfp, etc.) and delegates all logic to focused modules passed as constructor dependencies.

---

### 1.2 Eliminate NAL Rule Boilerplate (365 + 471 = 836 LOC → ~300 LOC)

**Problem**: 59 rules across `nal.ts` and `nal-extended.ts` share 3 repeating patterns:

**Pattern A — Syllogism** (deduction, induction, abduction, analogy, comparison, exemplification, etc.):
```typescript
([t1, t2]) => {
    if (t1.kind !== 'X' || t2.kind !== 'Y') return undefined;
    const s1 = getSubject(t1), p1 = getPredicate(t1);
    const s2 = getSubject(t2), p2 = getPredicate(t2);
    if (!s1 || !p1 || !s2 || !p2 || !sameHash(MIDDLE_T1, MIDDLE_T2)) return undefined;
    return TermBuilder.inheritance(LEFT, RIGHT);
}
```

**Solution**: A single `syllogism` helper that takes a guard config and two selector functions:

```typescript
type SyllogismConfig = {
    leftKind: Term['kind'];
    rightKind: Term['kind'];
    link: (l: Term, r: Term) => boolean;    // which parts must match
    build: (l: Term, r: Term) => Term | undefined;  // result constructor
};

const syllogize = (cfg: SyllogismConfig): RuleFn => ([l, r]) => {
    if (l.kind !== cfg.leftKind || r.kind !== cfg.rightKind) return;
    return cfg.link(l, r) ? cfg.build(l, r) : undefined;
};
```

Then all syllogistic rules become single-line declarations:

```typescript
const deduction = syllogize({
    leftKind: 'inheritance', rightKind: 'inheritance',
    link: (l, r) => sameHash(getPredicate(l), getSubject(r)),
    build: (l, r) => {
        const s = getSubject(l), p = getPredicate(r);
        return s && p ? TermBuilder.inheritance(s, p) : undefined;
    }
});
```

**Pattern B — Single-premise transform** (conversion, contraposition, negation, structural reduction, etc.):
```typescript
const transform = (kind: Term['kind'], fn: (t: Term) => Term | undefined): RuleFn =>
    ([t]) => t.kind === kind ? fn(t) : undefined;
```

**Pattern C — Kind-based extract** (intersection, union, destruct, decompose):
```typescript
const foldKind = (kind: Term['kind'], fn: (l: Term, r: Term) => Term | undefined): RuleFn =>
    ([l, r]) => l.kind === kind && r.kind === kind ? fn(l, r) : undefined;
```

**Also**: Remove dead metadata objects (`deductionMeta`, `inductionMeta`, etc.) — they're defined alongside each rule but never referenced by any code. If they're documentation, put them in comments.

**Also**: Merge `registerRule` (nal.ts:322) and `registerExtendedRule` (nal-extended.ts:417) — they're identical functions. One `register` helper in `shared.ts`.

Target: 836 LOC → ~300 LOC in two clean files (`nal-syllogism.ts` + `nal-combinator.ts`).

---

### 1.3 Unify the 5× Duplicated Premise Selection Loop

The same pattern repeats in:
- `formation.ts` `TermMatchingSelector.select()` (line 77)
- `formation.ts` `DecompositionSelector.select()` (line 102)  
- `formation.ts` `AnalogySelector.select()` (line 131)
- `strategies/base.ts` `createStrategy().selectSecondary()` (line 20)
- `pipeline.ts` `derive()` (line 190)

All share: sample concepts → for each concept: peek belief, check truth, check filter, build task, limit results.

**Solution**: A single `samplePremises` generator:

```typescript
const samplePremises = (
    memory: Memory,
    sampleSize: number,
    filter: (concept: Concept, task: Task) => boolean,
    limit: number
): Task[] => {
    const results: Task[] = [];
    for (const concept of memory.sample(sampleSize)) {
        const belief = concept.beliefBag.peek();
        if (!belief?.truth) continue;
        const task = createSecondaryTask(concept.term, concept.priority, belief.truth);
        if (!filter(concept, task)) continue;
        results.push(task);
        if (results.length >= limit) break;
    }
    return results;
};
```

Selectors become tiny configurations of this function. `PremiseFormation` class (69 lines) is mostly a `Set` dedup cache wrapper — extract the cache as `DedupTracker` and drop the class.

---

### 1.4 Deduplicate LM Rule Factory Boilerplate ✅ COMPLETED

`src/nar/lm/rules.ts` defined 13 identical `createXxxRule()` methods. Consolidated into:

```typescript
export const LMRules = Object.freeze({
    create: (index: number, lm: LMClient | null, config?: Partial<LMRuleConfig>): LMRule =>
        createRule(lm, getRuleDef(index), config),
    createById: (id: string, lm: LMClient | null, config?: Partial<LMRuleConfig>): LMRule | undefined => {...},
    createAll: (lm: LMClient | null, config?: Partial<LMRuleConfig>): LMRule[] =>
        ruleDefs.map(d => createRule(lm, d, config)),
    getRuleDef,
    ruleDefs
});
```

All 13 rules now created via `LMRules.createAll(lmClient)` in `nar.ts`.

---

### 1.5 Centralize Error Handling

The pattern `error instanceof Error ? error.message : String(error)` appears 40+ times across `repl.ts`, `nar.ts`, `processor.ts`, `tools/manager.ts`, `lm/` clients. 

**Solution**: `src/nar/utils/errors.ts`:

```typescript
const errMsg = (e: unknown): string => e instanceof Error ? e.message : String(e);
const errObj = (e: unknown): Error => e instanceof Error ? e : new Error(String(e));
```

Replace all 40+ inline instances with one utility. Also create `catchAndLog(logger, context)` for the common `try { ... } catch(e) { logger.warn(ctx, errMsg(e)) }` pattern.

---

### 1.6 Restructure Terms `types.ts`

`src/nar/terms/types.ts` (236 LOC) mixes type defs, serialization, deserialization, complexity, similarity, substitution, and normalization. Move each concern to its own module:

| From types.ts | To |
|---|---|
| `OPERATORS`, `AtomicTerm`, `CompoundTerm`, `Term`, type guards, accessors | `terms/types.ts` (keep, pure types only) |
| `serializeTerm` | `terms/serialize.ts` |
| `deserializeTerm` | `terms/deserialize.ts` |
| `getTermComplexity` | `terms/complexity.ts` |
| `getTermSimilarity` | `terms/similarity.ts` |
| `substituteVariables` | `terms/substitute.ts` |
| `improveNormalization` | `terms/normalize.ts` (merge) |

Drop `toString()` from Term interfaces — use `serializeTerm(term)` universally. Serialization is a function, not a method on immutable data.

---

### 1.7 Consistify Barrels & Clean Imports ✅ COMPLETED

Replaced all `export *` with explicit named exports in:
- `nar/tools/index.ts` (14 explicit exports)
- `nar/types/index.ts` (split by module)
- `nar/reason/premise/index.ts` (2 explicit exports)
- `nar/reason/strategy.ts` (Strategy interface + strategies)
- `agent/index.ts` (Agent + types)
- `index.ts` (NAR, Agent, config)

Also cleaned up duplicate `getCompoundArgs` definition in `guards.ts`.

---

### 1.8 Unify Lifecycle via BaseComponent

`EmbeddedIRCServer`, `ToolManager`, and `Bot` have manual `start()`/`stop()`/`shutdown()` lifecycle methods. `BaseComponent` already exists. Make `EmbeddedIRCServer` and `ToolManager` extend it, and make `Bot` compose them through `Container`.

Remove duplicated async lifecycle boilerplate (start promise, cleanup sets, destroy sockets, etc.).

---

### 1.9 Replace Regex Term Inversion ✅ COMPLETED

Replaced naive string manipulation `invert()` with structural term negation:

```typescript
private contradicts(a: Term, b: Term): boolean {
    if (termsEqual(a, b)) return true;
    if (a.kind === 'negation' && termsEqual(a.args[0], b)) return true;
    if (b.kind === 'negation' && termsEqual(b.args[0], a)) return true;
    return false;
}
```

---

### 1.10 Config Defaults Single-Source

`DEFAULT_CONFIG` appears in 4 places (`types/core.ts`, `memory/memory.ts`, `stream/pipeline.ts`, `factory.ts`). Consolidate: `types/core.ts` is the single source; all others import from it. Environment-based overrides through one `ConfigLoader` path.

---

## Phase 2 — Stabilize the Bot

### 2.1 Split Bot Monolith

`src/bot/index.ts` single 99-line function mixes concerns:
- NAR construction
- IRC server wiring
- Message parsing (PRIVMSG, URL detection, command prefix, Narsese detection)
- Command handling (.help, .stats, .clear)
- NAR interaction (believe, question, run)
- Response formatting

**Split into**:

```
src/bot/
├── index.ts              # createBot() — thin orchestrator (~30 LOC)
├── BotSession.ts         # BotSession class: holds NAR + IRC server, manages lifecycle
├── message-router.ts     # Route IRC message → handler based on content type
├── handlers/
│   ├── command-handler.ts   # .help, .stats, .clear, .constitution, .attention
│   ├── belief-handler.ts    # text ending with '.'
│   ├── question-handler.ts  # text ending with '?'
│   └── nl-handler.ts        # fallback natural language via LM
├── response-formatter.ts # Standardize reply formatting (prefix, ratio, etc.)
├── session-persistence.ts # Auto-save/load bot session state
└── config.ts             # Keep existing
```

### 2.2 Proper IRC Client Integration

Current bot uses `EmbeddedIRCServer` (a local TCP server for IRC clients to connect TO). This is backwards from the expected model — real multi-user IRC requires the bot to CONNECT to a remote IRC server as a client.

**Add**: `RealIRCClient` using the existing `irc` npm dependency that's already in `package.json`:

```typescript
// src/bot/IRCClient.ts
import irc from 'irc';

class IRCClient extends EventEmitter {
    constructor(config: { server: string; port: number; nick: string; channels: string[]; tls?: boolean })
    // Wraps irc.Client with:
    // - Auto-reconnect with backoff
    // - SASL auth support
    // - Channel join throttling
    // - Flood protection (rate limiting per NickServ conventions)
    // - Ping timeout detection
}
```

**Keep** `EmbeddedIRCServer` for testing (allows writing deterministic bot tests without a real IRC network), but make the real client the default for `pnpm bot` mode.

### 2.3 Bot Testing

Currently: 3 test files (config, embedded-irc, single-bot e2e). Add:

- **Unit**: `handlers/command-handler.test.ts`, `handlers/belief-handler.test.ts`, `handlers/question-handler.test.ts` — test each handler in isolation with a NAR stub
- **Integration**: `BotSession.test.ts` — full lifecycle with embedded IRC, inject Narsese inputs, assert bot responses
- **Property-based**: `bot-property.test.ts` — random Narsese inputs never crash the bot; bot replies are always non-empty for valid input

### 2.4 Bot Fault Tolerance

- **Reconnection**: Exponential backoff (1s → 2s → 4s → 8s → 16s max, with jitter)
- **Message black hole**: If IRC server doesn't respond for 60s, force disconnect and reconnect
- **NAR crash isolation**: If `nar.run()` throws, catch, log, and continue serving (don't crash the IRC session)
- **Flood protection**: Max 5 messages per 10s per channel; queue and drip-feed
- **State recovery**: On reconnect, re-announce presence and re-sync nick/channel state

### 2.5 Bot Configuration Profiles

Current `PROFILES` in `config.ts` duplicate large blocks of config. Refactor to layered defaults:

```typescript
const BASE = { nick: 'SeNARchy', lm: { provider: 'transformers', modelName: '...SmolLM2-360M', temperature: 0.7, ... } };
const PROFILES = {
    minimal: overrides(BASE, { loop: { budget: 10, sleepMs: 1000 }, capabilities: { all: false } }),
    standard: overrides(BASE, { loop: { budget: 50, sleepMs: 500 }, capabilities: { contextBudgets: true, ... } }),
    full: overrides(BASE, { loop: { budget: 100, sleepMs: 200 }, capabilities: { all: true } }),
};
```

---

## Phase 3 — Test Coverage (Target: 80% branch, 90% line)

### 3.1 LM Client Testing

Currently: zero LM tests. Issues to catch:
- `LMResponseParser` edge cases (malformed JSON, empty response, Narsese with embedded quotes)
- `VercelLMClient` / `OllamaLMClient` error modes (timeout, rate limit, model not found)
- `EnhancedLMClient` cache hits/misses, `FallbackLMClient` fallover
- `StreamingLMClient` partial tokens, cancellation mid-stream
- `LMRouter` model selection logic (speed vs quality vs cost routing)
- `DynamicLMRuleGenerator` rule generation from examples

Use `MockLMClient` and `RuleBasedLMClient` (both already exist in `lm/`) for deterministic tests.

### 3.2 RLFP Testing

- `RewardModel` feature extraction and scoring
- `PolicyOptimizer` ε-greedy exploration/exploitation
- `PreferenceCollector` explicit (`.prefer A B`) and implicit (cycle success rate) signals
- `RLFPLearner` orchestration: optimize interval, trajectory batching

### 3.3 Self/Metacognition Testing

- `MetacognitiveMonitor` event subscription and threshold detection
- `SelfAnalyzer` optimization generation and application
- `ReasoningAboutReasoning` lifecycle (start/stop/shutdown with event bus)

### 3.4 Stream Pipeline Testing

- `throttled()` yield timing
- `backpressureAware()` buffer behavior at capacity
- `createPipeline()` depth limit cutoff
- `MemoryPremiseSource` / `FocusPremiseSource` sampling distributions

### 3.5 Property-Based Tests

Expand `property-based.test.ts` with:
- **Hash stability**: `normalize(normalize(t)).hash === normalize(t).hash`
- **Structure preservation**: `serializeTerm(parse(s))` round-trips for any valid Narsese
- **Bag invariants**: After N insertions at capacity, bag size never exceeds capacity
- **Rule idempotence**: `deduction([a, b]) === deduction([a, b])` always (same inputs → same output)

### 3.6 E2E Tests in CI

Currently excluded from Jest. Enable `e2e/` tests, fix failures, add to CI.

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
Week 1: Phase 1 (Refactor)
✅ 1.4 LM rule factory dedup - COMPLETED
✅ 1.5 Error handling centralization - COMPLETED
✅ 1.6 Terms types restructure - COMPLETED
✅ 1.7 Consistify barrel exports - COMPLETED
✅ 1.9 Regex invert() removal - COMPLETED
✅ 1.11 Replace hash-based comparison - COMPLETED
[ ] 1.1 NAR god class split (complex - deferred)
[ ] 1.2 NAL rule boilerplate elimination (complex - deferred)
[ ] 1.3 Premise loop unification (deferred)
[ ] 1.8 BaseComponent lifecycle (deferred)
[ ] 1.10 Config single-source (already correct)

Verify: pnpm typecheck && pnpm test (all 336 tests green) ✅ PASSED

Week 2: Phase 2 (Bot) + Phase 3 (Tests) — parallel tracks
✅ 2.1 Bot monolith split - COMPLETED (handlers, router, BotSession)
✅ 2.2 Real IRC client - COMPLETED (RealIRCClient with reconnect/flood protection)
✅ 2.3 Bot testing - COMPLETED (unit tests for handlers, BotSession, message-router)
✅ 2.4 Bot fault tolerance - COMPLETED (ping timeout, auto-reconnect, flood protection)
✅ 2.5 Bot config profiles refactor - COMPLETED (layered profiles with BASE override)
✅ 3.1 LM client testing - COMPLETED (lm.test.ts: parser, MockLMClient, RuleBasedLMClient)
✅ 3.4 Stream pipeline testing - COMPLETED (stream.test.ts: MemoryPremiseSource, FocusPremiseSource, throttled, backpressureAware, createPipeline)

  Verify: 336 tests green ✅
  
Week 3: Phase 3 continuation + Phase 4 (Persistence)
  3.5 Property-based tests
  3.6 E2E tests enabled
  4.1 WAL + snapshot
  4.2 TaskSnapshot format
  4.3 Bot session persistence

  Verify: WAL round-trip test, bot resumes from saved state

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

- [x] `pnpm typecheck` zero errors ✅
- [x] `pnpm test` all suites pass (336 tests) ✅
- [ ] NAR god class split into 5 focused modules
- [ ] NAL rules 836 LOC → ~300 LOC via `syllogize`/`transform`/`foldKind` helpers
- [ ] Premise selection loop unified: 1 function serving 5 call sites
- [x] LM rule factory: 13 methods → 1 `create(idx)` with constant array ✅
- [x] No `export *` in barrel files ✅
- [x] Regex `invert()` replaced with term negation via termsEqual() ✅
- [ ] NAR god class split into 5 focused modules
- [x] Real IRC `irc` npm client with reconnect, flood protection, fault tolerance ✅
- [x] Bot tests: unit (each handler), integration (BotSession), message-router ✅
- [x] LM tests: parser, MockLMClient, RuleBasedLMClient ✅
- [x] RLFP tests: already exists in rlfp.test.ts ✅
- [x] Self tests: already exists in nal9-self.test.ts ✅
- [x] Stream pipeline tests: throttle, backpressure, createPipeline ✅
- [x] Property-based tests: already exists in property-based.test.ts ✅
- [ ] E2E tests enabled in Jest config and passing
- [ ] WAL + snapshot persistence with 2 backends (Fs, Memory)
- [ ] TaskSnapshot format round-trips without data loss
- [ ] Bot auto-save/load session persistence
- [ ] Plugin system: `nar.use()` / `nar.unuse()`
- [ ] NPM workspace: 8 packages with pnpm catalog
- [ ] MeTTa adapter bridge
- [ ] Dockerfile + compose (bot, server, cli profiles)
- [ ] GitHub Actions CI: typecheck, lint, test
- [ ] Zero `no-explicit-any` warnings
- [ ] Jest → Vitest migration complete
- [ ] Docs: ARCHITECTURE, BOT, PLUGINS