# CORE.19 — Non-UI Hardening: Truth, Continuity, Autonomy, Voice

**Status:** Directive · sibling of `TODO.ui.19.md` — not a successor and not a supersession. UI.19 owns presentation; CORE.19 owns everything the presentation stands on.
**Scope:** reasoning kernel, event bus, persistence/replay/determinism, autonomy loop, neuro-symbolic translation, non-UI reach (CLI/MCP/HTTP/SDK), gates/CI/security.
**Character:** Hardening, not a rewrite, not an expansion. Capabilities grow only where a verified kernel, one event stream, and honest persistence already hold. No new registries, no new packages, no UI.

---

## 0. The pivot in one paragraph

UI.19 proved what the bench *should* show: a kernel you can step, watch, and ask. That proof is currently aspirational — the UI sends `cycle.step`/`cycle.rewind` into a server with no handler; `cycle.state` is defined but never emitted; kernel-originated graph changes never become `WorkspaceOp`; and the event "stream" is four disconnected channels. The substrate machinery exists in fragments — `DerivationRecorder`, `StatePersister`, `replayIntoMemory`, `NLUnderstandingService`, `DriveManager`, `ControlBudgets`, 43 gates — but is unwired, unbounded, untested, or inert. CORE.19 wires it, bounds it, tests it, and stops there: one typed event bus (D11), a kernel control plane with a declared checkpoint boundary, a runtime-persisted gate/derivation record, deterministic continuity across restarts, a budgeted and reversible autonomy loop, and a validation-gated neuro-symbolic voice.

## 1. Relationship to UI.19 (division of labor)

| Concern | Owner | CORE.19 contribution |
|---|---|---|
| Kernel step/pause/rewind, `cycle.state` | **CORE.19** | implement + emit |
| Gate/derivation records, provenance data | **CORE.19** | produce + query |
| Event bus unification (D11) | **CORE.19** | produce one stream |
| Persistence / restore / replay | **CORE.19** | own and test |
| Autonomy loop (UI.19 W3) | **CORE.19** | own loop + budgets |
| Translation / `Formalizer` / explanation (UI.19 W2) | **CORE.19** | own provider + IR + validation |
| Thought stream, trace viewer, aspects, renderers | UI.19 | CORE.19 emits; UI.19 renders |
| Surface/aspect/renderer registries, 3D, package extraction | UI.19 | untouched |

**Division rule:** if a task can be expressed as *"emit an event"* or *"expose/restore state,"* it is CORE.19. If it is *"render an event,"* it is UI.19. No workstream here edits anything under `ui/`, `ui-contract/`, `ui-shell/`, `ui-backend-2d/`, or `ui-backend-fractal/`. The one legitimate exception is protocol definitions in `core/src/protocol/` (shared, not UI-owned) and the server host that already lives in `ui/src/server/` — edits there are limited to *routing kernel messages*, never to rendering.

## 2. Halt list (enforced for the duration of CORE.19)

1. **No UI changes.** No renderer, surface, aspect, view-spec, store atom, or contract edit. Where UI needs a seam, emit an event and log the need in §9.
2. **No new registries or contract surface.** `FocusKind`, `Aspect`, `Shape`, `Channel`, `Arrangement` are open and sufficient.
3. **No package extraction or module moves.** The six workspace packages stay as declared.
4. **No `Patch`/`Fidelity` fusion, no `Cell` merge, no fractal work.**
5. **No deleting or rewriting landed slices.** Consume; do not re-shim.
6. **No chasing known-red unless it blocks a workstream.** Log, don't chase (§12).
7. **No new LLM-dependent core path (D10).** Every capability degrades to a deterministic path.
8. **No general soundness claims in docs or demo output.** Results are labeled per-scenario.

Rationale for the executing agent: every halted item is *deliberately* deferred, not forgotten. If a task seems to require one, route around it and record the friction in the progress log.

## 3. Orientation (verified facts — do not re-discover)

### 3.1 Cycle & control
- Cycles are pull-based only: `NAR.run(steps)` → `NARExecution.run` (`nar/src/nar-execution.ts:210`); `_cycleCount` increments (`:220`) but is never transmitted.
- `CycleTrace` (`nar/src/proposal/cycle-trace.ts`, ring depth 512) and `ControlBudgets.beginCycle()` (`nar/src/kernel/control-budgets.ts:79`) already exist and are wired per cycle.
- **No kernel pause/resume/rewind.** Only `AbortSignal`. The closest facility is offline log replay (`nar/src/kernel/replay.ts` → `replayIntoMemory`).
- `CycleStateMsg` exists (`core/src/protocol/sync.ts:50`) but is **not** in `IncomingFromClient` (`core/src/protocol/unions.ts`), not re-exported from `core/src/protocol/index.ts`, and never emitted.
- Server handlers (`ui/src/server/protocol-server.ts` `SERVER_HANDLERS`, `ui/src/server/handlers.ts`) cover `reasoning.step/run/abort`; **no `cycle.*`**. `handleReasoningAdjustBudget`/`handleReasoningAdjustProvider` (`handlers.ts:278,285`) are stubs returning `"… is not yet wired to the engine"`. `runCycles` lives in `ui/src/server/server-utils.ts:259` — a *UI-package* helper driving the kernel.
- `NAREngine.reason` runs a fixed burst `nar.run(5|3)` (`nar/src/engine/NAREngine.ts:52,63,68`); not steppable. `Agent.capabilities()` is hardcoded `autonomyLoop:false`, `drives:false`, `rlfp:false`, `selfReasoning:false` (`core/src/Agent.ts:186`) regardless of wiring.

### 3.2 Event stream (D11 is unrealized)
- Four channels: `Agent.#cognitive` `Signal<CognitiveEvent>`; `NarEventBus` (`nar/src/types/events.ts`); durable `EventLog` (`core/src/eventlog/`, appended only in `core/src/agent/phases.ts:70,211`); `DomainEventSink` → OTel (`core/src/event-sink.ts`, registered only in `initOtel`).
- `nar/src/events/bridge.ts` maps only 9 NAR keys to `CognitiveEvent`. Production emits `nar:reasoning:cycle` (`nar-execution.ts:267`), which is **unmapped**; the mapped `cycle:start` has **no producer**.
- `derivation.accepted` (`core/src/schemas/cognitive-events.ts:52`) has reducers/catalog entries (`nar/src/kernel/EventLogPersistence.ts:122`, `ui/src/server/event-reducers.ts:85`) but **no emitter**. `derivation.record` is the only real derivation event.
- Gate logs (`GATE_LOG_CAPACITY=1000`, `nar/src/kernel/event-ring.ts`) record decisions (`task.admitted`, `policy.violation`, `budget.exhausted`, `autonomy.mode.changed`) — **not** rule premises/conclusions/truth. Those live only in `DerivationRecorder` (`nar/src/rules/impls/recorder.ts`, ring cap 200) exposed via `NAR.getDerivationChains` / `getProofStream`.
- `persistGateLogs` (`nar/src/kernel/EventLogPersistence.ts`) is called **only in tests**; `gate-events.jsonl` is never produced at runtime.

### 3.3 Persistence & determinism
- `StatePersister` (`nar/src/facade/persistence.ts`) writes six files; **`attention.json` is written but never read** (write `:77`, load `:93`).
- `SerializedMemory` (`nar/src/memory/state/serialization.ts`, `encodeMemoryState`/`deserialize`) is **not wired into the NAR restore path** — used only by the replay hasher and tests.
- Three version axes: `NAR_STATE_VERSION=1`, `MEMORY_VERSION=1`, `SNAPSHOT_VERSION=2`. No declared consistency boundary.
- **Not persisted:** cycle counter, pending queue (`nar/src/task/manager.ts:38`), RNG state, id-counter high-water, gate ring, revision log, event-log position.
- Replay (`nar/src/kernel/replay.ts`) accepts no `ids`/`rng`; concept ids use ambient `makeId()`; `Date.now()` stamps (`:219,269,370`) are hidden by a timestamp-stripping hash (`computeReplayStateHash`).
- Injectability already exists: `NARConfig.rng`/`clock`/`ids` (`nar/src/facade/config.ts:73-88`), `SeededRNG`/`mulberry32`/`rngFrom` (`util/src/utils/random.ts`), `installIdSource`/`sequentialIdSource` (`util/src/utils/id.ts`).
- Restart equivalence (`tests/nar/e2e/09-restart-equivalence.test.ts`) compares **term-key sets only** and does not replay the log.

### 3.4 Autonomy
- **No autonomous loop.** `FocusScheduler.start()/tick()` exists (`nar/src/focus/focus-scheduler.ts:102`) with **zero production callers**. `senars.config.json` `backends.nar.autonomy.enabled` has **no reader**.
- Drives initialize *at* target intensity, so `injectMetaGoals` cannot fire and `dispatchToolGoals` finds nothing (`nar/src/nar-execution.ts:43,665`; `nar/src/drives/impls/builtin.ts`).
- Budgets are rich and underused: `KernelBudgetGate` (`NAR_BUDGET_LIMITS`), `ControlBudgets` with 6 scopes (`nar/src/kernel/budget-scopes.ts:60`), `PriorityBag.pressure()` transitions `normal|high|critical` (`util/src/bag/Bag.ts:312`), `evictUnderPressure` (`nar/src/memory/pressure/consolidation.ts:101`).
- No idle curiosity policy; no bag-occupancy backpressure for curiosity. `Memory.consolidate()`/`decayAll` exist (one decay sweep, gate-enforced by `scripts/lib/attention-surface.ts`).

### 3.5 Translation & explanation
- NL→Narsese: `NLUnderstandingService` (`nar/src/nl/understanding.ts`, three-tier LM fallback, `SymbolicFirewall`). Narsese→NL: `NLGenerationService` (`nar/src/nl/generation.ts`, deterministic `fallbackGenerate`). **No `Formalizer`, no `nlToFormal`/`formalToNl`, no `PerceivedInterpretation`** (planned in UI.19 W2).
- Real IR is `FormalizationBatch`/`FormalizationCandidate` (`core/src/schemas/formalization.ts`).
- Admission is already safe: `KernelPerceptionGate.admitFormalization` (`nar/src/kernel/KernelPerceptionGate.ts:365`) re-parses via `termParser.parseTask`, clamps by `SOURCE_QUALITY_CONFIDENCE`; LLM tasks pass `ShadowValidator` (`nar/src/lm/shadow-validation.ts`); `SymbolicFirewall` (`nar/src/nl/firewall.ts`) blocks injection, operators, oversize/depth.
- Explanation is fragmented: `ReasoningTrace.explain` (template, `nar/src/query/trace.ts:86`), `ExplainTool` (declared gaps: "derivations not tracked at concept level"), `ProactiveEnricher.generateExplanation`, `BidirectionalFeedbackLoop.explainContradiction`, LM rule templates. `askNaturalLanguage` (`nar/src/facade/index.ts:325`) validates neither intermediate Narsese.
- LM is provider-agnostic and optional: `defaultLocalProvider()` returns `'mock'` (`nar/src/lm/env-config.ts:122`); `ILMService` + `lm: ILMService | null` null path present (`nar/src/ports/`). System One is wired but off by default and honestly uncalibrated (`util/src/config/system-one.ts:59`).

### 3.6 Reach, gates, CI
- CLI: `src/bin/bot.ts` modes `--status/--doctor/--tune/--arcade/--multiagent`; **no one-shot `--believe/--ask`**; `--tune` is simulated (`src/bin/lib/tune-runner.ts:62-104`); `src/bin/senars.ts` prints a UI URL but starts no server.
- MCP (`src/bin/lib/mcp/mcp-resources.ts`): `nar://episodes` → `{episodes:[]}`, `sessions://list` → `[]`, `self-reasoning://quality` → zeros.
- `/metrics` (`nar/src/metrics/http.ts`) is served **only** by the UI server (`ui/src/server/index.ts:461`); `HTTPConnection` (`io/src/connections/http.ts`) serves only `/health` and `/health/ready`.
- 43 gates in `scripts/lib/gates.ts`; **`egress:invariant` runs in CI but is missing from the registry**. Both workflows are `on: workflow_dispatch` only (CI paused). `tests/nar/rl/budgetgate-verification.test.ts` is referenced by `test:unit` but does not exist (quarantined as `.too_slow`).
- Known-red at root: `tests/framework/prompt-perception.test.ts`, server catalog tests (`tests/unit/server/*`), `tests/nar/refactor{3,4}-*`.

## 4. Decision log (append to progress log)

- **D7 — Integration over abstraction.** (inherited) No new contract surface until the organism runs end-to-end.
- **D8 — Extraction frozen.** (inherited) The six packages exist; contents grow only via bug fixes.
- **D9 — 3D is experimental mode.** (inherited, UI-owned)
- **D10 — LLM layer provider-agnostic and optional.** (inherited) The system functions fully with no LLM configured.
- **D11 — One event stream.** (inherited) Every kernel-originated occurrence flows through a single typed bus consumed by UI, persistence, and logs.
- **D12 — Kernel is authoritative; UI is a consumer.** No backend behavior depends on UI state or on UI-package helpers (`runCycles` moves kernel-side).
- **D13 — Determinism is full-fidelity.** Same inputs + same seed ⇒ byte-identical event stream (ids included). Timestamps are the single declared exemption.
- **D14 — Every persisted artifact declares a consistency boundary and schema version.** Omitted fields are documented, never implied.
- **D15 — No silent no-ops.** Unimplemented kernel paths reject with a typed error or emit a declared-gap event; `capabilities()` reflects reality.
- **D16 — Autonomy is budgeted, observable, and reversible.** Every autonomous action carries provenance, respects bag/cycle/wall-clock budgets, and has an off switch.
- **D17 — LLM output is a proposal, never kernel input.** Admission is only via the perception gate; every admitted block carries `CreatedBy: llm-proposed`.

## 5. Workstreams

Ordering: **M0, then C1 → C2 → C3 → C4 (critical path).** C5 and C6 run in parallel after C3. C7 follows. C8 and C9 close.

---

### M0 — Kernel heartbeat proof (gates everything)

The smallest demonstrable proof the substrate is real, backend-observed. **Nothing else starts until M0 passes and is demonstrated.**

1. Kernel advances exactly one cycle via a kernel-owned step call (`NAR.run(1)` is the primitive; wrap it behind a control-plane method).
2. Kernel emits `cycle.state` (`{state, cycleCount, phase, activeTasks, budget}`) after every cycle; the subscriber sees `_cycleCount` unchanged from the kernel's own.
3. One rule application is recorded with `{rule, premises, conclusion, truthBefore, truthAfter, cycle, timestamp}` and is queryable.
4. That rule record and the cycle event both flow through the **one** event stream (C1) — not a side channel.
5. With a seed and injected id source, two runs of the same M0 sequence produce byte-identical events (D13).
6. Full core battery green; no new reds.

**Acceptance:** a headless test steps one cycle, reads `cycle.state`, reads the derivation record, and asserts deterministic equality across two seeded runs.

---

### C1 — One event stream (realize D11)

**Goal:** collapse four channels into one typed bus that is simultaneously the UI feed, the persistence input, and the audit log.

1. Make `NarEventBus` (`nar/src/types/events.ts`) the single emitter contract; complete `narEventToCognitive` (`nar/src/events/bridge.ts`) so **every** NAR event with a `CognitiveEvent` counterpart is mapped. Add `nar:reasoning:cycle` → `cycle`; give `cycle:start` a real producer or retire the mapping.
2. Route bridge output into the durable `EventLog` (`core/src/eventlog/`) as well as `Agent.#cognitive`, so "append-only log is the source of truth" holds. Gate events and derivation records join the same path.
3. Resolve dead schema (D15): either emit `derivation.accepted` or remove its reducers/catalog/replay entries. No consumer without a producer, no producer without a consumer.
4. Bound everything: every ring/log declares capacity + retention + pressure signal (`nar/src/resources/contracts.ts`); add new sinks to `RESOURCE_CONTRACTS` so `resource:policy` covers them.
5. Add **one** query surface over the stream (by type, correlation, cycle, term) that C3/C4/C6 consume. No per-feature side channels.
6. Kernel-side tests: a seeded N-cycle run asserting the ordered event set and its queryability.

**Acceptance:** one seeded N-cycle run yields a single ordered event sequence; UI, replay, and logs all read that sequence; `resource:policy` and `complexity:budget` still green.

---

### C2 — Kernel control plane & cycle semantics

**Goal:** the kernel exposes an explicit, honest control state machine and the protocol its consumers expect.

1. Define kernel control state `{state: 'running'|'paused'|'stepping', cycleCount, phase, activeTasks, budget}`; implement `step`, `pause`, `resume`, `rewind` in the **kernel** layer. Move `runCycles` kernel-side.
2. Add `cycle.step/rewind/pause/resume` to `IncomingFromClient` (`core/src/protocol/unions.ts`) and `PROTOCOL_SPECS` (`ui/src/client/core/protocol-defs.ts`); implement the server routing (where the server host lives) into the kernel control plane. Export `CycleStateMsg` from `core/src/protocol/index.ts`; emit it after every cycle.
3. **Rewind = declared-partial by default.** Checkpoint = `{graph, priority-bag entries, pending tasks, cycle counter, RNG state, id-counter high-water, gate ring}`. Restore exactly what is in the boundary and report the rest ("rewound graph state; kernel continued from cycle N"). If true replay-rewind is chosen, replay must be deterministic from the checkpoint (C4). Never imply full restore.
4. Make `reasoning.adjust-budget` / `reasoning.adjust-provider` either work against `KernelBudgetGate` / provider runtime, or reject with a typed `not-supported` reason (D15). The string "not yet wired" never reaches a user.
5. `Agent.capabilities()` derived from wired subsystems (`autonomyLoop`, `drives`, `rlfp`, `selfReasoning`) — honesty gate.
6. Tests: step count equals cycles; pause preserves state; resume continues; rewind reports exactly the declared boundary.

**Acceptance:** headless — step N and observe `cycle.state` advance; pause/resume round-trips state; rewind restores the declared boundary and states its gaps; capability report matches reality.

---

### C3 — Gate observation & provenance records

**Goal:** the authoritative rule-fire record the trace viewer and explanations need.

1. Extend gate logging so **every inference-rule application** is recorded as `{rule, ruleCategory, premises[{term,truth}], conclusion{term,truth}, truthBefore, truthAfter, truthFn, evidenceLineage, independence, cycle, correlationId, stepId}` into a bounded, queryable ring (reuse/unify with `DerivationRecorder`). One record per fire, not per chain.
2. Query by id/cycle/concept/conclusion; expose it through C1's stream so UI.19's trace viewer consumes it without new contract surface.
3. Make `persistGateLogs` run at **runtime** (interval + shutdown) via `Ledger` (rotation/retention), not bare `appendJsonl`. This is also C4's replay input.
4. Populate provenance from real records: derivation events carry resolvable refs (block refs, not raw `evidenceLineage` UUIDs), so a derived block points at real parents. `origin` stays declared-empty; `ambient`/`direct` stay declared gaps unless derivable for free.
5. Test: a seeded derivation yields records whose truth algebra verifies via `verifyRecord` (`core/src/verify-derivation.ts`), retrievable by cycle and by concept.

**Acceptance:** a seeded run produces a queryable rule-fire record whose premises/conclusion verify; provenance of a derived term resolves to its real parents.

---

### C4 — Continuity: persistence, restore & deterministic replay

**Goal:** kill-and-restart resumes the organism; replay is genuinely deterministic; the boundary is declared.

1. **Declare the consistency boundary (D14) in one place** and implement both directions. Saved/restored: concept tasks (truth/budget/stamps), priorities, drive intensities, LM rules, **cycle counter, pending queue, RNG state, id-counter high-water, proposals/rule-table revision, bounded gate ring**. Explicitly documented omissions: archive/forgetting internals, link caches, embedding caches, self/metrics state, event-log position (derived).
2. Fix the concrete asymmetries: read `attention.json`; wire `SerializedMemory` `deserialize` into restore **or** delete the parallel path (D15). Unify the three version axes to one `nar.state` schema version with documented migration/refusal (`nar/src/state/codec.ts` already provides the envelope).
3. Restore replays the gate/derivation log where the boundary requires it, so restart is *equivalent*, not merely term-key-equal.
4. Inject entropy (D13): `FullReplayOptions` accepts `ids`/`rng`/`clock`; replay uses `SeededRNG` + `installIdSource`; stop minting ambient ids. Byte-identical ids, timestamps the only exemption.
5. Tests: save → kill → boot → assert resumed state equals the declared boundary (truth/priority/budget/stamps, not just keys); two seeded replays byte-identical; `persistence:replay`, `test:determinism`, `test:hermetic` cover the new fields.
6. Emit a `restored` event ("resumed N concepts, cycle M") on the stream.

**Acceptance:** restart restores the full declared boundary; a deterministic replay matches ids, not only hash; the boundary is written down and tested field-by-field.

---

### C5 — Autonomy core (bounded & observable)

**Goal:** the system thinks unasked, remembers across restarts, asks real questions — budgeted, provenance-carrying, switchable (D16).

1. **Heartbeat:** one kernel-owned loop with modes `manual` (today), `stepping` (autonomous, observable), `continuous`. Add the config reader for `autonomy.enabled` (currently dead) plus per-policy switches (heartbeat, curiosity, consolidation). Cap cycles and wall-clock per idle window.
2. Wire `FocusScheduler.start()/tick()` (or an equivalent bounded loop) as the single driver; in autonomous modes the UI never drives cycles.
3. **Backpressure:** suppress curiosity/consolidation generation above a bag-occupancy threshold (reuse `PriorityBag.pressure()`); aggressive pruning so the bag cannot fill with self-noise.
4. **Curiosity:** idle policy scans high-uncertainty / low-confidence concepts and mints internal questions as tasks, deduplicated by signature, gated by a salience threshold. Every task carries `CreatedBy: autonomy` + provenance `{policy, trigger, concept}`.
5. **Consolidation ("dream"):** maintenance pass reusing the single decay sweep; checkpoint before each pass; emit before/after per change; merge near-duplicates and strengthen co-derived links; recoverable from checkpoint.
6. Fix inert drives: initialize below target so `injectMetaGoals`/`dispatchToolGoals` can fire, **or** retire the path (D15).
7. `capabilities().autonomyLoop` reflects the wired loop.
8. Tests: `stepping` derives without input; at least one curiosity question and one consolidation event, each with a traceable cause; every policy has an off switch; budgets stop a runaway loop.

**Acceptance:** autonomy runs unasked, is fully observable on the stream, cannot exceed its budgets, and each behavior can be turned off.

---

### C6 — Neuro-symbolic translation & explanatory voice

**Goal:** natural language in, validated formalizations through the gate, reasoned natural language out — LLM optional.

1. `Formalizer` interface: `nlToFormal(text, mode) → PerceivedInterpretation` and `formalToNl(derivation|conflict|question) → text`. Implement one hosted provider and one **null provider** (deterministic structured path). D10: no key ⇒ everything still works.
2. `PerceivedInterpretation` typed IR (candidate beliefs/goals/questions + truth + confidence + source spans + `CreatedBy`). One validation gate: term well-formedness, truth-value ranges, syntactic validity; invalid → rejected with reason. Admission **only** through `KernelPerceptionGate.admitFormalization`, tagged `llm-proposed`.
3. Consolidate the existing safe pipeline (TaskBatch zod → `SymbolicFirewall` → gate re-parse → `ShadowValidator`) behind that one gate; document it as the single admission path.
4. **Explanation generator:** given a derivation chain or resolved conflict, walk the provenance (C3 records) and produce a plain-language explanation citing actual steps. Engine facts and LLM paraphrase are labeled distinctly. Expose as a kernel/API surface + an emitted `explanation` event (no UI work). If a UI intent is needed later, log the seam in §9.
5. Contradiction showcase: detect coexist-contradictory beliefs; surface the kernel's resolution or flagged conflict with an explanation and correct provenance.
6. Tests: English sentence → formalization → admission with `llm-proposed`; invalid formalization rejected with reason; explanation cites real derivation ids; the whole path passes with `LM_PROVIDER=mock` and with no provider.

**Acceptance:** structured input works end-to-end with no LLM; with an LLM, a typed formalization is validated before admission and an explanation cites real derivation records.

---

### C7 — Non-UI reach: CLI, MCP, HTTP, SDK

**Goal:** the organism is usable and useful without a browser.

1. CLI one-shot input: `--believe/-b`, `--ask/-q`, `--goal/-g`, `--steps`, `--json` — construct an agent, run, print (with derivation when asked). A scriptable entry the demo can drive.
2. Fix `src/bin/senars.ts` (currently prints a URL, starts nothing) to run the entry it advertises, or state the honest gap.
3. MCP: make resources return real data (`nar://episodes`, `sessions://list`, `self-reasoning://quality`, `nar://state` reflecting persistence) instead of `[]`/zeros (D15).
4. Serve `/metrics` (`nar/src/metrics/http.ts` `handleMetricsRequest`) from `HTTPConnection` and the bot, not only the UI server. Add a minimal, production-safe reasoning endpoint for `believe`/`ask` guarded by env, reusing existing handlers (not the `/test/*` surface).
5. Stabilize the consumer SDK: document the `Agent`/`NAR`/`createAgent` surface; capabilities honest; `getRecentDerivations` and `askWithDerivation` first-class; mark experimental methods.
6. `--status`/`--doctor` read persisted state where it exists; make `--tune` either real or explicitly labeled simulated; implement or declare the `--benchmarks` placeholder (`src/bin/lib/doctor-report.ts:251`).
7. Tests: CLI one-shot round-trip; MCP resource non-empty on a seeded agent; `/metrics` reachable.

**Acceptance:** a script can believe/ask/step and get a derivation with no browser; MCP and metrics report real state.

---

### C8 — Batteries, gates, CI & security hardening

**Goal:** the guardrails match the hardened core; green is never redefined.

1. Add `egress:invariant` to `scripts/lib/gates.ts` so `pnpm gates` matches CI; fix the broken `tests/nar/rl/budgetgate-verification.test.ts` reference (point at the quarantined file or remove).
2. Restore CI triggers (or document the pause and ensure every gate is runnable locally, including `pnpm gates --tier slow`).
3. Re-enable or formally retire quarantined suites (`.too_slow`, `it.skip`); record each in the ledger (§12).
4. Extend the determinism/hermetic gates to cover the new feedback loops (autonomy, event bus, persistence). Currently System One manifold, episode consolidator, and governance are outside hermetic coverage.
5. Security: extend `docs/security.md` invariants to the new LLM admission path (C6) and the new HTTP surface (C7); keep `answer:no-fabrication`, `core:no-lm`, `cycle:no-provider`, `rule:has-fallback`, `dispatch:no-wildcard` green.
6. Keep `complexity:budget` ratcheting: new code must not grow unbounded accumulators; audit any new ring/log into `RESOURCE_CONTRACTS`.
7. Record the known-red ledger with status; fix only what blocks a workstream.

**Acceptance:** `pnpm gates` and `pnpm gates --tier slow` are the local source of truth and pass; no gate is CI-only.

---

### C9 — Document the hardened core

**Goal:** a fresh session knows the substrate's truth without re-discovery.

1. Write `TODO.core.19.md` with the decision log D7–D17, the halt list, the consistency boundary (C4), the gate inventory (C3), and a per-workstream progress log.
2. Document non-UI usage: CLI one-shots, MCP resources, SDK (`USAGE.md`, command-first). Reference UI.19 W6 for the demo/release; do not duplicate.
3. Keep `PHILOSOPHY.md` intent (transparent, auditable, uncapturable reasoning; AGPL rationale) consistent with UI.19; no sentience claims.
4. Update `docs/security.md`, `docs/architecture`, and generated README sections the hardening touches; `pnpm docs:drift` stays clean.

**Acceptance:** a fresh session reads `TODO.core.19.md` alone and knows the kernel's truth, the persistence boundary, and every gap.

## 6. Cross-cutting rules

1. **Green gates are preconditions.** Every commit passes the §11 battery, or explicitly quarantines a failure with a logged reason. The accepted-red ledger stays minimal.
2. **One event stream (D11).** If a feature needs its own side channel, redesign the feature.
3. **Declared gaps over fake states (D15).** Unfinished paths reject or emit a gap event. No silent no-ops, no simulated data presented as real.
4. **Consume the contract, never extend it.** A missing contract feature is worked around and logged in §9.
5. **LLM optional everywhere (D10).** Every path degrades to deterministic behavior.
6. **Autonomy is observable or it doesn't ship (D16).** No background behavior without an event, a trace, a budget, and an off switch.
7. **Determinism is full-fidelity (D13).** Seeds and ids are injectable on every kernel path.

## 7. What this plan deliberately does not do

No UI, renderers, surfaces, or aspects. No second consumer app, conformance suite, or publishing. No performance/accessibility overhaul. No `Cell` merge, `Fidelity` fusion, or 3D growth. No new registries, packages, or module moves. These remain parked in UI.19 §8.

## 8. Acceptance walkthrough (definition of done)

One continuous headless session, `LM_PROVIDER=mock` first, then with a key configured:

1. Step one cycle → `cycle.state` advances on the single stream; a rule-fire record is queryable.
2. Two seeded identical runs → byte-identical event streams (ids included).
3. Type an English sentence → `PerceivedInterpretation` → validated → admitted as `llm-proposed`; invalid input rejected with a reason.
4. In `stepping` mode, derive unasked; observe a curiosity question and a consolidation event, each with provenance and an off switch; budgets stop a runaway.
5. Derive a conclusion → explanation cites real derivation ids; contradiction detected/resolved with a cited explanation.
6. Kill and restart → resume the declared boundary; a `restored` event announces it.
7. Repeat 3–5 with no LLM key → structured path fully functional.
8. Same via CLI one-shot and MCP → no browser.
9. `pnpm gates --tier slow` green; README/USAGE reproduce the above.

## 9. Open seams (reserved, with re-entry triggers)

| Seam | Re-enter when |
|---|---|
| Kernel-originated `WorkspaceOp` producer | UI.19's workspace substrate needs kernel ops rather than projected fragments |
| Multi-instance ecology | C1 bus + C4 boundary are proven; instances have something to exchange |
| True replay-rewind (vs declared-partial) | The C2 checkpoint is stable and C4 replay is byte-identical |
| Distributed / OTel event export | The single stream exists and is bounded |
| System One calibration activation | Real graded labels exist; honesty holds |
| Performance + accessibility gates | Release-to-others replaces release-as-proof |
| UI `explain` intent registration | C6 explanations exist; UI.19 registers the affordance |

## 10. Implementation principle

Smallest change that makes the substrate real. Prefer wiring over building, emitting events over side channels, bounding over growing, and honest gaps over simulations. When torn between an architectural improvement and a verifiable capability, ship the capability and log the improvement in §9.

**Execute M0, then C1 → C2 → C3 → C4; then C5 + C6 in parallel; then C7; then C8; then C9. Log progress per workstream below exactly as UI.18 does. This plan stays open: every seam in §9 is a door, not a wall.**

## 11. Verification battery (run per workstream)

Core green set (must pass after every workstream):

```
pnpm typecheck
pnpm typecheck:bin
pnpm typecheck:packages
pnpm test:unit
pnpm deps:gate
pnpm deps:direction
pnpm core:no-lm
pnpm memory:ports
pnpm attention:write-surface
pnpm control-budgets
pnpm gates:one-cycle-path
pnpm exports:check
pnpm exports:barrels
pnpm complexity:budget
pnpm lint
```

Add per workstream:
- **C4:** `pnpm test:determinism`, `pnpm test:hermetic`, `pnpm persistence:replay`
- **C6:** `pnpm answer:no-fabrication`, `pnpm rule:has-fallback`, `pnpm cycle:no-provider`
- **C8:** `pnpm gates --tier slow`, `pnpm egress:invariant`

UI battery (`pnpm --dir ui typecheck`, `pnpm --dir ui test:unit`) is UI.19's concern; run it only when a shared protocol file under `core/src/protocol/` changes.

## 12. Known-red ledger (pre-existing — document, do not chase unless blocking)

| Failure | Location | Status |
|---|---|---|
| Prompt-perception (root alias gap) | `tests/framework/prompt-perception.test.ts` | red at root; green in `ui`; aliases only in `ui/vite.aliases.ts` |
| Server catalog tests | `tests/unit/server/{lens,field,event}-catalog.test.ts`, `layout-registry`, `scenarios`, `config-reset`, `test-endpoints`, `unified-graph-projection` | red |
| Refactor suites | `tests/nar/refactor3-*.test.ts`, `tests/nar/refactor4-*.test.ts` | red |
| Broken reference | `tests/nar/rl/budgetgate-verification.test.ts` (referenced by `test:unit`; file is `.too_slow`) | C8 fixes |
| Quarantined suites | `tests/nar/{refactor1-source-reputation,refactor1-aikr-induction,rl/budgetgate-verification}.test.ts.too_slow` | C8 triages |
| CI paused | `.github/workflows/{ci,derivation-verify}.yml` (`workflow_dispatch` only) | C8 decides |
| `egress:invariant` not in local registry | `scripts/lib/gates.ts` | C8 fixes |

## 13. Progress log

> Append per workstream as UI.18 does: status, files touched, evidence, friction logged against §9.

### M0 — Kernel heartbeat proof — **NOT STARTED**

### C1 — One event stream — **NOT STARTED**

### C2 — Kernel control plane & cycle semantics — **NOT STARTED**

### C3 — Gate observation & provenance records — **NOT STARTED**

### C4 — Continuity: persistence, restore & deterministic replay — **NOT STARTED**

### C5 — Autonomy core — **NOT STARTED**

### C6 — Neuro-symbolic translation & explanatory voice — **NOT STARTED**

### C7 — Non-UI reach: CLI, MCP, HTTP, SDK — **NOT STARTED**

### C8 — Batteries, gates, CI & security hardening — **NOT STARTED**

### C9 — Document the hardened core — **NOT STARTED**
