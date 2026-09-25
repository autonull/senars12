# REFACTOR.todo3: Pay Down Technical Debt, Close Unlocked Capabilities & Harden Flywheel

**Version:** 1.0 (2026-09-25) · **Follows** `REFACTOR.todo2.md` (all Phases A–F landed; benches 86–90 green + audit remediations).

**Philosophy:** TODO2 completed the AIKR pattern extensions and strategy algebra. What remains splits into: **pay-down** (pre-existing test failures the repo tolerates but shouldn't), **wiring** (capabilities unlocked by TODO1/2 but never hooked to a consumer), and **hardening** (making the flywheel self-sustaining). Every phase is bench-gated, independently shippable, and inert-by-default (C1/C6/C7 carry-forward).

---

## 1. Opportunity Triage

| Source | Verdict | Rationale |
|---|---|---|
| Pre-existing: `nar.ts` > 900 lines (M2 budget) | **ADOPT (Phase A)** | Gate exists (`todo20-monoliths.test.ts`), budget drifted to 1019. Split NAR accessors into a facade module (`nar/src/nar/facade.ts`) — narrow the public surface, keep implementation private. |
| Pre-existing: `MemoryQuery` bench flake (1/3 runs) | **ADOPT (Phase A)** | `Date.now()` millisecond boundary between store writes. Fix: inject a `Clock` abstraction (test doubles pin timestamps; production uses `Date.now()`). One-line fixture change + test update. |
| Pre-existing: `deps:gate` baseline 68 vs 67 | **ADOPT (Phase A)** | Extra cycle: `rule-builders → rule-templates/{meta,goal,question}-rules`. Update baseline to 68 or break the chain (move one template). |
| Pre-existing: RL parity bandit failure (seed ratio 0.37) | **DEFER** | Intermittent; requires dedicated RL debugging. Not a refactoring target. |
| TODO2 §10.1: Dialogue turn episode `id` | **ADOPT (Phase B)** | Capture writes `context: [turnId]` but not `id: turnId`. Causal chains span only turn→reaction; adding `id` makes the full graph traversable by `causedBy`/`leadingTo`. |
| TODO2 §10.3: `MemoryQuery` episode leg salience prior | **ADOPT (Phase B)** | Episode leg scores recency only; Phase B priority = salience × (1 + causal connections). Unifies ranking across legs; may also fix flake. |
| TODO2 §10.5: `SelfMetaGame` drain budget from config | **ADOPT (Phase B)** | Bag-drain hardcodes budget 4; `proposals.budget` already plumbed. One-line read. |
| TODO2 §10.6: RetrospectiveAdapter expression emission | **ADOPT (Phase C)** | `SWITCHES` still emits plain names; `setStrategy(type, expr)` accepts expressions. Needs per-strategy latency in retrospectives first, then emit `StrategyExpression`. |
| TODO2 §10.7 / §11: `MettaProposer` live wiring | **ADOPT (Phase C)** | `attachGame`/`attachConversationGame` lack `proposers` pass-through. Injection point: `GameFocus.ts:121` → add `proposers?: IProposer[]` to `GameFocusOptions`. Evaluator injected from agent layer. |
| TODO2 §10.8 / §11: MeTTa `=` structural-shallow | **ADOPT (Phase C)** | `(= (+ 2 2) 4)` → False. Fix: extend stdlib `eqOp` to pre-reduce args (metta/src/stdlib/index.ts), or compose `(= <reduced> True)` at call site. First is cleaner. |
| TODO2 §10a M5: Contradiction event + SelfMetaGame intake | **ADOPT (Phase C)** | `NAREventMap` has no contradiction event; SelfMetaGame uses substring sniff. Add typed `contradiction` event + consumer. Enables MeTTa/NAL disagreement → meta-game loop. |
| TODO2 §10a M4 remainder: bot.ts 18 strictness errors | **ADOPT (Phase D)** | `typecheck:bin` surfaces 18 pre-existing TS errors (private field access, etc.). Fix or exclude with `@ts-expect-error` + issue. |
| TODO2 §10a M5 deferral: MettaProposer `learn()` no-op | **DEFER** | No use case yet. Keep deferred. |
| TODO2 §10.2: Consolidator structural grouping | **DEFER** | `type|correlationId` works; structural grouping is fidelity increment, no demand signal. |
| TODO2 §10.4: ConsolidationHook app-config | **DEFER** | Hook wired; config lives in builder/API. Schema change when next touching `src/config`. |
| REFACTOR.md §1: JudgmentPipeline registry (lite) | **DEFER** | Multi-transport bot is the consumer; per-transport epistemic profiles can wait for Phase B thread isolation. |
| REFACTOR.md §2: CognitiveThread (lite) | **ADOPT (Phase D)** | Bot runs IRC+WS+MCP simultaneously; sourceKey stamping exists, but `ContrastiveMemory`/embedding cache are global. Scope by `correlationId` (no `AsyncLocalStorage` yet). |
| REFACTOR.md §3: ProofStream → CriticReflex | **ADOPT (Phase D)** | `ProofStream` landed (TODO1 D); `CriticReflex` subscribes, detects low-confidence leaps/circularity, injects `^doubt` into `FocusBag`. Highest-value unlocked capability. |
| REFACTOR.md §6: EventLog query → `.timeline` CLI | **ADOPT (Phase D)** | `SqliteEventLog.query` exists; `.timeline <correlationId>` command is nearly free. Realizes time-travel debugging. |
| REFACTOR.md §12: Tick stage graph | **ADOPT (Phase D)** | TODO1 called this "trivial after A" — kernel macro-cycle already uses `TickMiddleware` onion. Conditional edges on bag pressure/drive. |

---

## 2. Design Invariants (carry-forward)

All invariants from TODO1 (I1–I7, N1–N3, C1–C5) and TODO2 (C2', C6, C7) hold. Reinforcements:

| # | Invariant | Notes |
|---|---|---|
| C8 | **Test flakes are bugs.** Intermittent failures block merge; fix the root cause (clock, RNG, timing) rather than retry. | `ranking order` flake → injected clock. |
| C9 | **Public API surface shrinks, never grows.** `nar.ts` facade split reduces exports; `exports:audit` enforces. | Monolith budget is an API surface constraint. |
| C10 | **Flywheel consumers are first-class.** Every new wire path (Contradiction event, CriticReflex, thread-scoped reputation) must have a benching consumer. | No speculative wiring. |

---

## 3. Naming & Vocabulary

| Identifier | Kind | Meaning |
|---|---|---|
| `NarFacade` | class | Narrow public API re-exporting only consumer-facing methods from `nar.ts` internals; implementation stays private. |
| `Clock` | interface | `{ now(): number }` — injected into `MemoryQuery`, `EpisodicMemory`, tests; production = `SystemClock`. |
| `ThreadScope` | class | Per-`correlationId` view: scoped `ContrastiveMemory` slice, `sourceKey` filter, embedding cache partition. |
| `ContradictionEvent` | type | `{ source: 'metta'|'nal', term: Term, mettaVote: boolean, nalVote: boolean, at: number }` in `NAREventMap`. |
| `CriticReflex` | class | `IReflex` subscribing to `ProofStream`; emits `^doubt` goal when derivation confidence < threshold or circular dependency detected. |
| `stageGraph` | fn | Macro-cycle `TickMiddleware[]` with conditional edges (`bagPressure > 0.7 ⇒ run consolidate twice`). |

---

## 4. Phases

### Phase A — Test hygiene & monolith paydown (Bench 91)
- **`NarFacade`**: Extract consumer-facing methods from `nar/src/nar.ts` into `nar/src/nar/facade.ts` (public). `nar.ts` becomes internal implementation; `exports` map points to facade. Bench 91: `loc(nar.ts) < 900` + `exports:check` green.
- **`Clock` injection**: `MemoryQuery`, `EpisodicMemory` accept optional `clock?: Clock`. Tests use `FixedClock` with pinned timestamps. Bench 91: `ranking order is stable` passes 100/100 runs.
- **`deps:gate` baseline**: Update `BASELINE` to 68 or break `rule-builders → rule-templates/...` chain (move one template to `internal/`). Bench 91: `deps:gate` passes with clean tree.
- Files: `nar/src/nar/facade.ts` (NEW), `nar/src/nar.ts` (shrink), `nar/src/query/memory-query.ts` (clock param), `nar/src/memory/EpisodicMemory.ts` (clock param), `tests/nar/refactor2-memory-query.test.ts` (FixedClock), `tests/nar/todo20-monoliths.test.ts` (budget assert), `scripts/deps-gate.ts` (baseline or chain break), `tests/nar/refactor3-hygiene.test.ts` (NEW, **Bench 91**).

### Phase B — Episode graph completeness & MemoryQuery hardening (Bench 92)
- **Dialogue turn `id`**: `DialogueCapture` writes `id: turnId` (ULID) alongside `context: [turnId]`. CausalIndex now covers full turn→reaction→consolidation chain.
- **MemoryQuery salience prior**: Episode leg scoring uses `priority = recency × salience × (1 + causalConnections)` (same as `EpisodeConsolidator`). Unifies ranking semantics across concept/episodic/semantic legs.
- **SelfMetaGame drain budget**: Read `proposals.budget` from config (default 4) instead of hardcoded.
- Files: `nar/src/dialogue/capture.ts`, `nar/src/query/memory-query.ts` (scoring), `nar/src/game/SelfMetaGame.ts` (config read), `tests/nar/refactor3-episode-graph.test.ts` (NEW, **Bench 92** — causal traversal depth, salience ranking parity, config budget).

### Phase C — Consensus completion & ProofStream consumer (Bench 93)
- **Contradiction event**: Add `contradiction` to `NAREventMap` (types/core). `Negotiator` emits when `MettaProposer` and NAL votes diverge on same term. `SelfMetaGame` consumes → proposes resolution strategy.
- **MettaProposer live wiring**: `GameFocusOptions.proposers?: IProposer[]`; `attachGame`/`attachConversationGame` pass through. Agent layer injects `createMeTTa()` + `Effect.runSync` evaluator.
- **MeTTa `=` deep equality**: Extend `eqOp` in `metta/src/stdlib/index.ts` to normalize args before structural compare (pre-reduce arithmetic/logic). Bench 93: `(= (+ 2 2) 4)` → True.
- **WeightedQuorum telemetry**: `NegotiationDecision.arbitration: 'nal-veto'|'weighted-quorum'` field; tick panel surfaces it.
- Files: `nar/src/types/core.ts` (event), `nar/src/reflex/Negotiator.ts` (emit), `nar/src/game/SelfMetaGame.ts` (consume), `nar/src/focus/GameFocus.ts` (proposers option), `metta/src/stdlib/index.ts` (eqOp), `nar/src/reflex/weighted-quorum.ts` (telemetry), `tests/nar/refactor3-consensus-proof.test.ts` (NEW, **Bench 93**).

### Phase D — Thread isolation, CriticReflex, timeline CLI (Bench 94)
- **ThreadScope (lite)**: Per-`correlationId` `ContrastiveMemory` view + `sourceKey` filter. `KernelPerceptionGate`/`ingressJudge` read thread-scoped reputation. No `AsyncLocalStorage` — explicit context passing through `CycleHost`.
- **CriticReflex**: Subscribes to `NAR.getProofStream()`. Detects: (a) confidence < 0.3 on any step, (b) circular subterm dependency, (c) derivation depth > threshold without progress. Emits `^doubt` goal into `FocusBag` via `TaskManager`.
- **`.timeline` bot command**: Wraps `EventLog.query({ correlationId, limit: 1000 })` → renders cognitive state at each tick.
- **Stage graph**: Macro-cycle `TickMiddleware[]` with conditional edges (e.g., `bagPressure > 0.7 ⇒ consolidate` runs twice). `createMacroPipeline` accepts graph config.
- **bot.ts strictness**: Fix 18 `typecheck:bin` errors or add targeted `@ts-expect-error` with issue links.
- Files: `nar/src/kernel/thread-scope.ts` (NEW), `nar/src/reflex/CriticReflex.ts` (NEW), `src/bin/bot.ts` (timeline command + strictness fixes), `core/src/agent/pipeline.ts` (stage graph), `tests/nar/refactor3-thread-critic.test.ts` (NEW, **Bench 94**).

---

## 5. Out of Scope
❌ `MettaProposer.learn()` — no use case. ❌ Consolidator structural grouping — fidelity increment. ❌ ConsolidationHook app-config schema — wait for next `src/config` touch. ❌ Full §1 JudgmentPipeline registry — lite per-transport profiles deferred to post-Phase D. ❌ FenwickBag — caps ≤256. ❌ §7 focus tree, §10 LM rule graph, §13 capability ontology — no consumer.

---

## 6. Risks

| Risk | Mitigation |
|---|---|
| Facade split breaks internal consumers | Only `exports` map consumers are public; internal code uses relative imports (unchanged). |
| Clock injection pollutes hot path | Optional param; production uses zero-cost `SystemClock` (`() => Date.now()`). |
| ThreadScope adds memory overhead | Only allocates when >1 concurrent correlationId; single-thread path unchanged. |
| CriticReflex injects too many `^doubt` goals | Confidence threshold configurable; default 0.3 (tuned from trace grade distribution). |
| Stage graph changes cycle semantics | Default graph = current linear pipeline (behavior-identical, C7). |

---

## 7. Notes for Implementation
- Bench-first: Benches 91–94 continue sequence, one `refactor3-*` file per phase.
- Phase ordering: A (paydown) unblocks B/C/D; B/C/D are independently landable after A.
- Versioning: New exports = minor (each has in-repo consumer); `nar.ts` facade is minor (surface shrink); no deprecations introduced.
- `pnpm exports:audit` + `pnpm typecheck` + `pnpm lint` + `pnpm deps:gate` must pass each phase.

---

## 8. Progress
(To be filled as phases land)