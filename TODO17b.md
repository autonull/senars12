# TODO17b.md — SeNARS Codebase Integrity Sweep: Fail-Closed Repairs, Bounded Runtime & Surface Truth

**Version:** 1.2 · continues TODO17.md v1.8 (Arcade plan — complete) · lineage TODO16c.md (System One) · TODO16b.md
**Progress (2026-09-21):** Phases 0, A, B, C complete — **D22 done, D24 done**. See §7 Status Ledger.
**Philosophy:** *A demo can only be honest if the substrate is. This sweep repairs every place the code fails open, lies about success, grows without bound, or documents what it does not do — each repair falsifiable, each deletion justified by a grep.*

**Core Principle:** *No success flag without the work; no log without a bound; no doc claim without a caller.*

**Method note:** findings below come from three parallel sweeps (resource growth / stubs-and-dead-code / async-races-and-silent-failures) over areas TODO16c never deep-audited (`src/`, `io/`, `metta/`, `nar/src/{memory,cognitive,learning,cooperation,capability,governance,kernel,rules,tools,lm providers}`). Excluded: `nar/src/lm/system-one`, `nar/src/focus`, `nar/src/rl` (already audited). Anchors re-verified 2026-09-21 against post-TODO17 HEAD (`d15c5761`): D1–D10, D18, D19, D21, D23 anchors all confirmed live.

---

## 1. Findings (D-series) & Phased Repairs

### Phase 0 — Full-Suite Determinism (P0) *"the gate we measure the gates by"*

- **D0 (P0, certifies everything else).** The full suite (`pnpm run test` / `pnpm test:unit`) is nondeterministically red at baseline and HEAD (verified 2026-09-21 in a clean worktree at `33661106`): parallel workers collide on process-global state — the module-singleton `gateRegistry` (autonomy mode / allowlists mutated by kernel-gates-style suites) — and load-sensitive legs (SLO p99, RL parity ratios, timing assertions) flake under machine load. CI never sees this because it runs targeted globs. Fix (two parts): (a) **global-state isolation** — a `resetGateRegistry()`/test-scoped registry helper used (or per-file registry instances) so gate-mutating suites cannot leak across files; (b) **load-sensitivity quarantine** — wall-clock/threshold assertions (todo16-slo, parity-restoration ratios) either move behind the dedicated-jobs pattern (F2/TODO16c §11 precedent) or get generous tolerances with seeded determinism. No behavior change in library code. | `nar/src/kernel/index.ts` (gateRegistry), `tests/nar/{kernel-gates,todo16-slo,rl/parity-restoration}.test.ts`, `vitest.config` |

**Acceptance**
- [ ] `pnpm test:unit` passes **three consecutive runs** on one machine
- [ ] No library-code behavior change (diff limited to tests + registry reset helper)

### Phase A — Fail-Closed & Crash Repairs (P0) *“the substrate never lies or falls open”*

- **D1 (P0, security).** `KernelPerceptionGate.admitWithSystemOne` catch returns `{output: null}` and `admit()` falls through to **legacy admission with no injection veto and no calibrated truth** — fail-open on the security gate. Fix: on System One error, degrade to the Tier-0 legacy path *with the injection-veto check applied* (or reject), emit `systemone_ingress_error` telemetry, never silent passthrough. | `nar/src/kernel/KernelPerceptionGate.ts:303-304, 140-147` | Regression-class vs TODO16c Bench 15 semantics.
- **D2 (P0, crash).** `agent.getRecentDerivations` override calls itself → RangeError. Fix: capture the original method before override (real impl at `core/src/Agent.ts:245`). | `nar/src/agent/index.ts:368`
- **D3 (P0, dead path).** Multi-agent CLI awaits an async generator without iterating — chat is a no-op printing `[object AsyncGenerator]`. Fix: `for await (const e of agent.chat(...))`. | `src/bin/lib/multi-agent-runner.ts:64`
- **D4 (P0, provider brick).** `resolveModelId` memoizes failures — first probe before llama-server readiness caches `MODEL_PLACEHOLDER` forever → permanent 400s → breaker trips. Fix: never memoize rejections/placeholder results; log probe failures; retry on next call. | `nar/src/lm/providers/llamacpp.ts:24-39`
- **D5 (P0, spend-cap bypass).** `LMService.stream()` never calls `recordSpend` (`LM_MAX_SPEND_USD` bypassable), no semantic cache, no retry, silent `return` on missing model. Fix: spend accounting + retry + routing telemetry + explicit `LMUnavailableError` on missing model — completes TODO16c F6 parity. | `nar/src/lm/lm-service.ts:589-635`
- **D6 (P0, self-mod honesty).** `register_rule`/`register_tool` return `success:true` without registering ("implementation pending"); `run_scenario` ignores seed/profile. Fix: implement the registrations against RuleProcessor/ToolManager **or** return a typed `NotSupported` failure; no simulated success. | `nar/src/tools/adapters/external-tools.ts:2213-2268, 2317, 2849-2867`
- **D7 (P0, race).** Consolidation `promote` is `void nar.believe(...)` — unhandledRejection risk + false-success in `ConsolidationResult`. Fix: await; tighten the `promote` type to `Promise<void>`; failures propagate into the result. | `src/bin/lib/lifecycle.ts:157`, type at `nar/src/memory/retrieval-verified.ts:30`
- **D8 (P0, silent data loss).** `EpisodicMemory.log()` silently drops episodes at the per-file cap. Fix: rollover to a new file at cap; emit a warning + `episodic_dropped_total` counter. | `nar/src/memory/EpisodicMemory.ts:190-192`
- **D9 (P0, persistence).** Auto-save `setInterval(async () => persist())`: unhandledRejection on write failure, up to `saveInterval` lost on dispose, corrupt load silently overwritten with empty state. Fix: guarded save (catch + log + counter), final flush in `[Symbol.dispose]`, corrupt-load quarantines the file and fails loudly. | `metta/src/extensions/persistent-space.ts:52-78`, `nar/src/memory/TemporalEmbeddingMemory.ts:122-137`
- **D10 (P0, transport silence).** `Promise.allSettled` handler rejections never inspected (LM outage ⇒ no reply, no log, no errorCount); delegation catch covers both JSON-parse and `peer.executeTask` (delegator hangs); `CognitiveTaskResult.success: boolean` hides causes. Fix: inspect allSettled results (log + count); split the catches; reply with a typed failure; `error: string` field on `CognitiveTaskResult`. | `io/src/connections/base.ts:113-119` (+ `cli.ts:99-104`), `nar/src/cooperation/delegation.ts:49-61, 113-125`

**Acceptance**
- [ ] Bench 36 + 37 pass
- [ ] Injection veto holds under fault-injected manifold failure (D1)
- [ ] No `success:true` without the work (D6); consolidation result reflects reality (D7)

### Phase B — Bounded Runtime (P1) *“everything that grows has a bound”*

- **D11.** Gate event logs: rings (drop-oldest, cap 1000) for Action/Budget/Reward gates (PerceptionGate already has one); `releaseScope` invoked by `detachGame`/focus disposal. | `nar/src/kernel/{KernelActionGate,KernelBudgetGate,KernelRewardGate}.ts`
- **D12.** `RuleProcessor.executionLog` cap (ring or bounded deque; `clearLMRuleExecutionLog` stays). | `nar/src/rules/processor.ts:60, 438-448`
- **D13.** `MetacognitiveMonitor`: store the interval handle, `.unref()`, clear in `shutdown()`, remove the 5 listeners. | `nar/src/cognitive/MetacognitiveMonitor.ts:216-275`
- **D14.** Governance/self-improvement queues (`awaitingValidation`, `awaitingApproval`, `SelfRewardGate.queue`): drain APIs + router consumption so routed proposals leave the queue. | `nar/src/governance/pipeline.ts:104-105`, `nar/src/kernel/KernelRewardGate.ts:119`
- **D15.** io: per-session history cap (LRU) in `ConnectionBinder`/`InMemorySessionManager`; WS `eventSubscriptions` cleaned on client close. | `io/src/bridge/ConnectionBinder.ts:24-26`, `src/api/websocket-adapter.ts:130-133`
- **D16.** LMService prompt cache: TTL sweep piggybacked on writes (bounded memory without a timer). | `nar/src/lm/lm-service.ts:192-223`
- **D17 (batch).** Minor growth: `revisionLog` cap; wire or delete `pruneOldEpisodes`; IRC reconnect stops the previous `queueTimer`; e-graph `saturate()` step/node budget; `ProactiveEnricher.results` cap; `FeedbackLearner.corrections` cap. | anchors per finding: `memory/memory.ts:87`, `memory/EpisodicMemory.ts:125`, `io/src/connections/irc.ts:188-190`, `metta/src/engine/egraph.ts:42-52`, `lm/enrichment.ts:101`, `learning/feedback.ts:41`

**Acceptance**
- [ ] Bench 38 passes (soak: flat heap over 10k cycles + 100 conversations)
- [ ] All previously unbounded structures have caps with named constants

### Phase C — Surface Truth: Wire-or-Delete (P1/P2) *“no doc claim without a caller”*

- **D18.** 8 meta-cognitive rules exported as literal `undefined` (`@unimplemented`) while the README rule matrix lists `operation-execution`, `goal-achievement`, etc. Fix (decision DQ1): implement the high-value subset (operation-execution, goal-achievement feed the self-improvement loop) or delete the stubs + their README rows; either way no `undefined` in a public export. | `nar/src/rules/extended/meta/*`, guard at `nar/src/rules/registration.ts:75`
- **D19.** Slash commands broken: bot's `CommandRegistry` never populated; `nar/src/commands` (538 lines) has zero importers; `io` auth command returns hard-coded success without binding. Fix (DQ2): populate the registry from `nar/src/commands` at bind time + implement auth, or delete the dead package and the `/cmd` routing. | `src/bin/bot-ai.ts:47`, `io/src/commands/auth.ts:13`, `nar/src/commands/*`
- **D20.** Governance pipeline has zero production callers. Fix (DQ3): wire `ProposalRouter` into the self-improvement flow (self-game rewards → router, per the RLFP domain split) or reclassify the module as library-only with README honesty. | `nar/src/governance/pipeline.ts`
- **D21.** Config truth: delete ~25 dead fields (+ their env mappings in `util/src/config/env.ts`) or wire them — entire `bot.autonomy`, `bot.tui`, `bot.classifier`, `bot.streaming`, `bot.reasoning.background*`, `bot.policy.*`, `bot.conversation.*`; delete the dead `--migrate` stub; fix `bin.senars` → nonexistent `dist/cli/repl.js`. | `src/config/schema.ts:304-392, 585`, `src/config/loader.ts:57,91`, `package.json:8`
- **D22.** Dead modules — per DQ4, delete or wire: `CognitiveOptimizer` (363 lines), `ObserverService` (242), `WorkingMemory` (instantiated, zero calls), `TemporalEmbeddingMemory`, `FeedbackLearner`, `validateLMOutput`, and the 634-line `src/api` adapter layer (its rate-limit/auth exist only there while live servers are hand-rolled — if deleted, port the protections to `src/bin/mcp-server.ts`/`multi-agent-runner.ts`). | `nar/src/cognitive/{optimizer,ObserverService}.ts`, `nar/src/memory/{WorkingMemory,TemporalEmbeddingMemory}.ts`, `src/api/*`
- **D23 (reconcile).** Ambiguity→Question injection: TODO16c A4 marks it shipped; this audit finds an unimplemented TODO stub at `KernelPerceptionGate.ts:237-242` (**re-verified 2026-09-21 — still a stub**: the ambiguity flag routes through `AMBIGUITY_ROUTER` but the DriveManager curiosity injection is a `// TODO`). Verify against `todo16c-live-ingress.test.ts`; close whichever record is wrong — either implement the injection (DriveManager access through the gate) or amend the TODO16c A4 record.
- **D24.** Doc honesty pass: README rule matrix, governance section, and `doctor` output (`--benchmarks` placeholder, watchdog status) match reality after D18–D22; the audit's minor findings (`NALVetoError` never thrown, `metta` tool catch→`[]`, capability typed-error flattening, `withTimeout` non-cancellation) get one-line doc notes or fixes where trivial.

**Acceptance**
- [ ] Bench 39 passes (grep-verified: no `undefined` rule exports, no zero-reader config fields, README claims ↔ callers)
- [ ] `pnpm typecheck` 0 errors, `pnpm lint` clean, full suite green — **inherited as attainable from Phase 0** (D0/Bench 35* established a green baseline; Phase C changes must not regress it)

---

## 2. Falsification Benchmarks (36–40)

| # | Benchmark | Test file | Obligation |
|---|-----------|-----------|------------|
| 35* | **Full-Suite Determinism** | (whole suite) | Phase 0/D0: `pnpm test:unit` green in three consecutive runs; no flaky-set variance across runs. Falsified by any red file in a clean sequential re-run of the failed set. **CERTIFIED 2026-09-21: 3/3 consecutive green.** |
| 36 | **Fail-Closed Integrity** | `tests/nar/todo17b-failclosed.test.ts` | Fault-injected manifold/judgeBatch throw ⇒ admission still applies injection veto + ceiling (D1); self-tools never report success without registering (D6); auto-save write failure ⇒ logged + counted, dispose flushes, corrupt file quarantined not overwritten (D9); allSettled rejection ⇒ logged + errorCount incremented; peer crash ⇒ typed failure reply, delegator never hangs (D10). |
| 37 | **Async Honesty** | `tests/nar/todo17b-async.test.ts` | No fire-and-forget mutator in the audited paths (grep guard + behavior tests): consolidation result reflects promote outcome (D7); `getRecentDerivations` returns derivations (D2); multi-agent chat streams text (D3); `stream()` records spend and throws `LMUnavailableError` on missing model (D5). |
| 38 | **Bounded Runtime Soak** | `tests/nar/todo17b-bounded.test.ts` | 10k reasoning cycles + 100 io conversations with heap snapshots at intervals: delta within tolerance for gate logs, execution log, proposal queues, session histories, prompt cache, subscriptions (D11–D16); MetacognitiveMonitor teardown clears timer + listeners (D13). |
| 39 | **Boot-Order Resilience** | `tests/nar/todo17b-provider.test.ts` | llamacpp probe failure before server readiness ⇒ retried next call, never memoized (D4); provider recovers when the server appears; no placeholder model id is ever sent twice. |
| 40 | **Surface Truth** | `tests/nar/todo17b-surface.test.ts` | Grep-guard: no `undefined` rule exports in `@senars/nar/rules` (D18); CommandRegistry populated at bind (or `/cmd` routing deleted) (D19); every `src/config/schema.ts` field has ≥1 reader (D21); every README-claimed rule/governance capability has a caller or the claim is amended (D24). |

---

## 3. Decision Points

| # | Question | Default proposal |
|---|----------|------------------|
| DQ1 | Meta rules: implement the subset that feeds self-improvement (`operation-execution`, `goal-achievement`) or delete all 8 stubs? | Implement those two, delete the rest; README matrix amended either way |
| DQ2 | Commands: wire `nar/src/commands` into the bot registry or delete the package + `/cmd` routing? | Wire — the commands are real functionality already written; auth gets implemented, not stubbed |
| DQ3 | Governance: wire `ProposalRouter` into the live self-improvement flow or mark library-only? | Wire — the RLFP domain split (§Self-Improvement) already defines the route; the pipeline is tested and idle |
| DQ4 | Dead modules (CognitiveOptimizer, ObserverService, WorkingMemory, TemporalEmbeddingMemory, FeedbackLearner, src/api layer): delete or wire? | Delete, with two exceptions: port src/api's rate-limit/auth into the live servers before deletion; keep `SchemaInductor` — **rationale corrected for TODO17 v1.8**: TODO17's G2 consumer is `nar/src/focus/schema-induction.ts` (LM-free, unrelated), NOT `SchemaInductor` (`nar/src/learning`). SchemaInductor earns its keep on its own record: README-claimed (§Schema Induction) and asserted by `rl/parity/cognitive-advantage.test.ts` — keep as library-only or fold into the doc-honesty pass, decide at DQ-time |
| DQ5 | WorkingMemory: wire into the agent or delete? | Delete — `Focus.tasks` covers working state; two working memories is redundancy, not richness |
| DQ6 | D0 isolation strategy: per-file registry reset helper vs serial test lane vs both? | Reset helper (fixes the cause) + keep parallelism; serial lane only as a CI fallback if some suite proves un-isolatable |

---

## 4. Rollback

| Phase | Trigger | Action |
|-------|---------|--------|
| A | Any repair regresses a pinned suite | D-items are local; revert per item. D1's veto-preserving fallback is the only semantic change — gated by fault injection only (happy path unchanged) |
| B | Soak reveals a cap too tight | Caps are named constants; widen without code changes |
| C | A wired surface misbehaves | Wiring is behind the existing enable flags (`enableSelf`, `enableLMRules`); deletions are git-recoverable; README amendments revert independently |

---

## 5. Master Checklist

**Phase 0:** D0 full-suite determinism (registry isolation + load-leg quarantine) → [ ] Bench 35* (three consecutive green `pnpm test:unit` runs)

**Phase A:** D1 fail-closed gate · D2 recursion · D3 multi-agent chat · D4 provider probe · D5 stream parity · D6 self-tools honesty · D7 awaited promote · D8 episode rollover · D9 persistence guards · D10 transport/delegation failures → [ ] Bench 36 + 37

**Phase B:** D11 gate rings + scope release · D12 execution-log cap · D13 monitor lifecycle · D14 queue drains · D15 io caps/cleanup · D16 cache sweep · D17 minor batch → [ ] Bench 38

**Phase C:** D18 meta rules · D19 commands · D20 governance wiring · D21 config prune · D22 dead modules · D23 A4 reconciliation · D24 doc honesty → [ ] Benches 39 + 40

---

## 6. Definition of Done

```text
Every gate fails closed      Every promise is awaited    Every structure is bounded
─────────────────────────    ─────────────────────────   ─────────────────────────
injection veto survives      promote/consolidate         gate rings · log caps
manifold faults              report truth                queue drains · cache sweeps
stream pays the same         no [object AsyncGenerator]  sessions/WS cleaned up
toll as generate             no self-recursion           no unstoppable timers

Every export has a caller    Every config field is read  Every README claim is real
─────────────────────────    ─────────────────────────   ─────────────────────────
no undefined rules           25 dead fields gone         rule matrix = registry
commands actually respond    no dead --migrate           governance wired or relabeled
auth binds or refuses        doctor tells the truth      self-tools never lie
```

> TODO16c connected the nerves, TODO17 books the arcade. TODO17b makes the floor safe to dance on: the kernel that judges cannot fail open, the agent that self-improves cannot lie about it, and nothing in the house grows in the dark.

---

## 7. Status Ledger (2026-09-21, post-Phase-C commit `25d23cd8`)

**Certified:** `pnpm test:unit` green **3 consecutive runs** after the D0 fix (Bench 35* closed; 198→204 files at Phase C, 203 files / 1722 tests post-D22 deletions); `pnpm typecheck` **0 errors** (also fixed the 2 pre-existing `todo17-arcade.test.ts` errors); `pnpm lint` clean.

| Item | Status | Where / notes |
|------|--------|---------------|
| D0 | ✅ | `resetGateRegistry()` exported; per-file reset in `tests/setup/vitest-setup.ts`; SLO + parity-restoration legs moved to `test:load-sensitive` (dedicated CI job). Bench 35* run 2/3 green — **one more clean run certifies**. |
| D1 | ✅ | Fault-injected `judgeBatch` throw ⇒ rejection + `policy.violation` (`systemone_ingress_error`) telemetry; no legacy passthrough. Bench 36. |
| D2 | ✅ | Recursion fixed (bound original before override). Bench 37. |
| D3 | ✅ | Multi-agent CLI + WS iterate `agent.chat()`; deltas streamed. |
| D4 | ✅ | `resolveModelId` memoizes successes only; failures logged + retried. Bench 39. `MODEL_PLACEHOLDER` now exported. |
| D5 | ✅ | `stream()` parity: spend (via `result.usage`), semantic cache, one pre-yield retry, routing telemetry, `LMUnavailableError` on missing model. |
| D6 | ✅ | `register_rule`/`register_tool`/`run_scenario` return typed `not-supported` failures (shadow-validated artifacts still reported, registration truthfully denied). |
| D7 | ✅ | `promote` awaits `nar.believe`; failing promote rejects consolidation. |
| D8 | ✅ | Episodic rollover to `<date>-<n>.jsonl`; drop counter `EpisodicMemory.droppedTotal`; prune regex handles suffix files. |
| D9 | ✅ | PersistentSpace + TemporalEmbeddingMemory: guarded saves (`failedSaves` counter), unref'd timer, dispose flush, corrupt-file quarantine (`.corrupt` + loud throw). |
| D10 | ✅ | allSettled rejections logged + `errorCount` (base + cli); delegation peer-crash ⇒ typed failure reply with `error` field. |
| D11–D17 | ✅ | Shared `pushBounded` ring (cap 1000) across gate logs, rule execution log, revision log, enricher results; corrections evict-least-cited; prompt-cache TTL sweep on write; e-graph saturate budget; monitor teardown (`unref` + listener removal); ProposalRouter drain APIs; IRC timer hygiene; InMemorySessionManager LRU caps. Bench 38. |
| D18 | ✅ | All `undefined` rule stubs deleted (8 meta + `nal.compose`/`nal.revision`); registration rows removed; README matrix rewritten to registered-rules truth. |
| D19 | ✅ | DQ2=wired: nar command groups + `createAuthCommands` registered in bot-ai; `CommandContext` gained `nar`; ConnectionBinder passes `agent.getNAR()`. |
| D20 | ✅ | DQ3=wired: `SelfMetaGameImpl.recordFocusStepReport` drains `SelfRewardGate.queue` through `ProposalRouter` with `applyFocusWeight`/`applyKnob` actuators under the live autonomy mode. |
| D21 | ✅ | Dead fields pruned: `bot.reasoning.*`, `bot.streaming`, `bot.tui`, `bot.autonomy`, `bot.policy.*`, `bot.conversation.{maxArtifacts,pinnedBeliefLimit}`, `bot.classifier`, `directives`, `nlParsers`, `prompts`; dead env mappings removed; `--migrate` stub deleted; `bin.senars` → `dist/bin/repl.js`. Kept: `bot.conversation.{maxHistory,summaryThreshold}` (read), `bot.lmRules` (read). |
| D23 | ✅ implemented | `KernelPerceptionGate.setDriveManager()` hook; NAR wires its DriveManager at init; ambiguity ⇒ `stimulate('curiosity', 1)`. TODO16c A4 record now true — no amendment needed. |
| D24 | ✅ | Rule matrix rewritten to registered-rules truth (Bench 40 verifies); README governance section accurate post-D20. Minor findings resolved as one-line doc notes: `NALVetoError` (gate reports vetoes via typed result, class is opt-in for exception-style callers — JSDoc on `KernelActionGate.ts`), `metta` premise-source `catch → []` (best-effort extraction, silent-absence semantics — comment in `MettaEngine.ts`), capability typed-error flattening (`error.message` strings — comment in `capability/space.ts`), `withTimeout` non-cancellation (orphaned work — JSDoc on `wasi-sandbox.ts`). |
| D22 | ✅ | DQ4=delete, executed: `CognitiveOptimizer` + samplers (module deleted incl. `tests/nar/unit/optimizer.test.ts`), `ObserverService` (types `CognitiveState`/`CognitiveAction` moved inline into `nar/src/types/events.ts`), `WorkingMemory` (class + `nar.ts` field/init + `createWorkingMemoryTools` in aisdk-adapter), `TemporalEmbeddingMemory`, `FeedbackLearner`/`validateLMOutput` (label-sources adapters in `lm/system-one/label-sources.ts` are independent — kept; FeedbackLearner-specific tests dropped). `src/api`: adapter layer (http/websocket/unified/registry/response/index, 634 lines) deleted; the **live** MCP modules (`job-manager`, `mcp-prompts`, `mcp-resources`, `mcp-tools`, `mcp-bridge`, `mcp-response`) moved to `src/bin/lib/mcp/`. **Rate-limit + auth ported** into the hand-rolled MCP SSE/HTTP transports via shared `src/bin/lib/http-guards.ts` (`HttpGuard`: `x-api-key` auth via io's `ApiKeyManager` + per-key sliding window at `agent.rateLimitPerMinute`); key from `connections.mcp.{apiKey,apiKeyEnv}` (new config fields), generated+logged when unset; stdio exempt. D15 clause resolved: `io/src/connections/ws.ts` now unsubscribes clients from `eventSubscriptions` on close/error (verified io's own WS lifecycle — the leak was real, fixed at source). README examples/sections for deleted modules removed. |

### Benches
| # | File | Status |
|---|------|--------|
| 36 | `tests/nar/todo17b-failclosed.test.ts` | ✅ 9 tests |
| 37 | `tests/nar/todo17b-async.test.ts` | ✅ 7 tests |
| 38 | `tests/nar/todo17b-bounded.test.ts` | ✅ 9 tests (targeted cap assertions; full heap-soak stays in `tests/soak`) |
| 39 | `tests/nar/todo17b-provider.test.ts` | ✅ 3 tests |
| 40 | `tests/nar/todo17b-surface.test.ts` | ✅ 4 grep-guards |

---

## 8. Remaining Work — Notes for the Next Session

**All items below are DONE (2026-09-21, same day as plan completion):**

1. ~~D20 follow-up~~ ✅ `SelfMetaGameImpl.getGovernanceQueues()` (validation/approval depths), passthrough on `MetaFocus`, and `NAR.getSelfMetaGame()` (lazily created over `attachGame`/`detachGame` bookkeeping) — consumed by `pnpm status`'s new `governance` section (attached games + queue depths).
2. ~~README subpath audit~~ ✅ `nar/package.json` exports now define every README-referenced subpath (`./cognitive`, `./cognitive/analyzers`, `./learning`, `./rlfp`, `./self`, `./config/cognitive-parameters`, `./lm/lm-service`, `./rules/ranking`, `./eval/*`).
3. ~~Arcade LM arm repairs~~ ✅ **the lm arm now wins the tournament on a real model.** Fixes found by instrumentation (per-tick latency + `decisions/served/failures` counters, now printed per episode in the run notes):
   - `RecordingReflex` hid `prefetch`, so the LM was never consulted (the arm silently played the epsilon-greedy fallback). Prefetch now forwards.
   - `LMReflex.propose` compared warm action (string) against raw `legalActions` (numbers) — type mismatch meant warm decisions were never served. Now string-normalized.
   - LM arm's dispatcher had no Tier-1 manifold → all candidates ranked NEUTRAL → first-token bias won. Now the real manifold ranks candidates; `LMReflex` selects the highest-ranked **legal** candidate (stub candidates can no longer shadow a real decision).
   - Decision prompt: completion-style "Top Beliefs" wrapper degraded small-model decisions; `SynthesisQuery.promptOverride` lets `LMReflex` send a natural-language prompt with state observations. `LMReflexOptions.promptTemplate` supports `{feature}` interpolation (games provide narrative templates — small models reason over sentences, not `key=value` digests); `actionLegend` supplies game semantics.
   - Game fixes surfaced: `BanditGame.observe()` exposes per-arm pulls/avg reward history (a decision-maker cannot learn blind); `GridWorldGame` exposes goal position and a real `state().terminal` (episodes previously never ended at the goal — the while-loop guard read an always-undefined `terminal`), plus a `render()`; `TicTacToe.observe()` exposes the board as cell features. `ManifoldRLAgent`'s digest contract (`JSON.stringify(features)`) updated in the two digest-pinned tests accordingly.
   - Result (Qwen3.5-9B Q6, `LM_PROVIDER=llamacpp-embedded LM_LLAMACPP_MODEL=…`, 3 episodes/game): **lm return +416.9** vs heuristic −375.6, random −171.8, manifold +3.1; lm best on snake (survives where baselines die), tictactoe (5/5 wins), gridworld (solves in 3 moves), bandit (near-optimal arm selection); 2nd on 2048. `pnpm arcade -- --render` shows every tick.

**Still open (optional, non-blocking):**
- Tetris LM arm: single-action LMReflex without the placement cascade scores 0 (heuristic wins tetris) — wiring `PlacementCascadeReflex` for the lm arm would make it competitive.
- The rendered demo (`--render`) prints tick panels; the manifold arm's ticks are few in mixed runs (arm-coverage variance) — cosmetic.

**Plan status: complete.** All D-items (D0–D24) done; Benches 35*–40 pass; `pnpm typecheck` 0 errors; `pnpm lint` clean; §8 residue (governance status surface, subpath audit, Arcade LM-arm win) also closed 2026-09-21. TODO17b is done — future work belongs in a new TODO file.

**Build order:** 0 (D0, ~1d — the green baseline everything is certified against) → A (2d) → B (1.5d) → C (2d, DQ-gated) — each phase independently releasable; 0 and A are the only P0s.
