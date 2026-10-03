# TODO33: Delete the Lies, Fix the Bugs, Make It Traceable

**Replaces v1–v5, which were an audit rather than a plan.**
Status: **in progress** (§1, §2, §3, §5.P1.2–P1.3 landed) · Predecessor: TODO32

Scope: nothing here touches drives, meta-goals, or homeostasis. That work is deferred by decision and its code is left untouched. See *Not done*.


---

## 0. Progress

| Item | State | Note |
|---|---|---|
| §1.1 `nar/src/tick/` | **done** | deleted (511 LOC + 6 test files); `CycleStage` moved to `nar/src/proposal/stages.ts`, derived from the `CYCLE_STAGES` tuple. OTel's tick instrumentation (`instrumentPipeline`, `wrapMiddlewareWithSpan`, `recordCognitiveEvents`, `emitSpanEvent`, `CognitiveStage`) went with it — it was the only other consumer of `TickContext` — and `StreamReasoner.reasonHook` (0 callers) with it. `@senars/nar/otel` keeps the live surface. |
| §1.2–1.3 README/docs | **done** | 6 traced stages and the 8-phase `DEFAULT_MACRO_PIPELINE` (`Consolidate` precedes `Act`); the two mermaid diagrams now describe the real graph. |
| §1.4 `bot.ts:403` | **done** | log no longer claims reflexes it never steps. |
| §1.5 `capabilities()` | **done** | `autonomyLoop: false`. `drives: false` is true of `Agent` (it holds no `DriveManager`), so it stands. |
| §1.6 retry config | **done** | `maxRetries`, `retryBackoffMs` and — discovered here — `enablePriorityScheduling` removed; the last existed only to call the deleted `reschedulePending`. |
| §1.7 `AgentBridge` | **done** | deleted with `core/src/bridge/AgentBridge.ts`. |
| §1.8 `replaySession()` | **done** | deleted. |
| §2 `askSafely` signal | **done** | `DecisionPort.ask(request, signal?)`; the signal is now handed over. |
| §2 two Narsese sniffs | **done, differently** | `isLikelyNarsese` is gone and `dispatchNarseseIntent` (`nar/src/nl/narsese-intent.ts`) is the one router, but the agreed predicate is still looser than the parser: `isNarsese` matches `-->` anywhere, so `{a --> b}.` still routes to Narsese. The throw is gone — the agent's ingress catches the router/parser disagreement and falls through to the LM path. See *notes*. |
| §2 `reschedulePending` | **done** | `addTask` is O(1) again. |
| §2 `LmCallTimeout` | **falsified** | it *is* caught: `LMRule.apply`'s catch treats it as a failure, records it and returns `applyFallback`. Pinned by `tests/nar/unit/lm-rule-timeout.test.ts`. |
| §2 `Agent.unmount()` | **done** | `Agent.stop()` unmounts each transport before disconnecting it — one choke point rather than a call at each disconnect site. |
| §2 silent `catch {}` + `errorRate` | **done** | engine faults in `reason`/`absorb` are logged and tallied per engine via `CycleHost.onEngineError`; `health()` reports `errorRate` and `byEngine`. |
| §2 gate telemetry | **done** | `recordGateDecision` takes `correlationId` (span attribute, not a label — a per-utterance label is a series per utterance); `admit()` is metered through `emitAdmitted`, the judge-fault path and the veto path, not only `admitTask`. |
| §2 refusals emit events | **already true** | egress veto emits `egress.gate.rejected`; the action gate emits `tool.request` + the failure is recorded as a `tool_result`; budget refusal emits `budget.exhausted`. |
| §2 `memoryPressure` → `'unknown'` | **done** | `CognitiveStateSummary.aikr_pressure` and `self-report` both distinguish unmeasured from zero. |
| §2 two `dispatchNarseseIntent` | **done** (merged with the row above) | one router, three call sites. |
| §2 `createBudget` rename | **done** | `createTaskWeight` in `nar/src/types/core.ts`; `core/budget.ts` keeps `createBudget(limits)`. The `typeof` test and the cast in `manager.ts` are gone. |
| §3 `correlationId` | **done** | optional id on `run`/`runStream`, on `input`/`believe`/`goal`/`question`, through `CycleStageEvent`, and from the agent's Narsese ingress and `NAREngine.reason`. |
| §3 `/metrics` | **done** | `handleMetricsRequest` (`nar/src/metrics/http.ts`) serves `/metrics` and `/metrics.json` from the Web UI server; `ENABLE_WEB_UI` is the only switch. |
| §5.P1.1 `validatePayload` | **blocked — see notes** | the ordering is inverted. |
| §5.P1.2 `Episode` | **done** | core re-exports util's. |
| §5.P1.3 the gate claim | **done** | README states ingress-only; the dead branch says why it is dead. |

**Verification:** `pnpm typecheck`, `pnpm lint`, `pnpm test:unit` (341 files, 3002 tests) green after every commit above.

---

## 0.1 Notes for the remaining work

**§5.P1.1 must move after §5.P2.4, not before.** Deleting
`AbstractEventLog.validatePayload` and calling `validateCognitiveEvent(event)` in `append` was
implemented and reverted: it fails 32 tests, because the core zod union does not accept the util-side
events the repo actually mints (`core` events carry `engine`/`correlationId`; `concept.activated`
needs an `activationSource` it never has). The two validators cannot be unified by deleting one —
they have to be merged first, and then there is only one to delete. Same for the "util becomes a
type-only re-export, direction `core → util`" step in P2.4: `nar` and `core` both mint events, so
the merge has to keep both producers' variants or migrate every producer in one commit.

**`isNarsese` is a shape heuristic, not a parser oracle.** Tightening it to the parser's alphabet is
the real fix and it is not free: `a --> b.` and `a==>b!` are routed as Narsese and still fail to
parse. Options are (a) accept it and rely on the ingress catch, which is what landed, or (b) make the
router parse-tolerant the way `admit()` already is (`parseTaskTolerant` tries four punctuations) —
option (b) is probably worth doing, and it belongs with P3.9 rather than here.

**Two things found while working, not in the plan.** `nar/src/agent/index.ts` asked the manifold for
rubrics `'entailment'` and `'quality'`, which are not `RubricId`s — the `as any` hid it and the
judgments were meaningless; they are now `relevance`/`groundedness`/`plausibility`. And
`SelfReport`'s `memoryPressure ?? 0` had the same "no measurement reads as no pressure" bug the plan
attributes to `nar-execution.ts`.

**Where §5.P2 stands.** P2.4 is unblocked from a sequencing point of view but is the largest item
(~270 LOC, every producer) and should be its own commit with the test suite as its safety net. P2.5
(PhaseTimer as a projection over `CycleTrace.regions()`) is now easier than it was — the trace carries
`correlationId` and every stage already goes through `stage()`. P2.6 (`sample`) and P2.7
(`gateRegistry` global) are untouched and carry no live bug.

**P3.9's premise is settled.** §5.P1.3 landed with the "ingress-only" reading, so a refusal policy for
the tick path is now a feature with a dead branch waiting for it (`nar-execution.ts:397`) rather than a
correction of a claim the system was already honouring.

---

## 1. Delete what lies

| | |
|---|---|
| `nar/src/tick/` — 511 LOC + 3 test files (394) | Nothing runs it. `CycleStage = keyof TickHooks` (`cycle-trace.ts:18`) is load-bearing for the live trace, so move it to `nar/src/proposal/stages.ts` with the type derived from a `const` tuple — then the array and the type can't disagree. |
| `README.md:1034` | Claims 11 micro-stages. It runs 6: `perceive \| attend \| reason \| authorize \| propose \| learn`. |
| `README.md:1209`, `:1245-1251` | Claims 6 macro-phases; there are 8, and `Consolidate` precedes `Act` (`phases.ts:321-330`). |
| `docs/tech/deep-dive.md:48-141`, `docs/intro/conceptual-overview.md:146-174` | Mermaid diagrams for a `Cycle` class, `TaskFactory`, `PriorityManager`, `Reasoner` that don't exist here. |
| `bot.ts:403` | Logs *"ConversationGameFocus attached with reflexes"* for a subsystem nothing steps. |
| `capabilities()` `autonomyLoop: true` (`Agent.ts:172`) | False. Nothing drives the cycle. `drives: false` is also false whenever a `DriveManager` is bound. |
| `maxRetries: 3`, `retryBackoffMs: 1000` (`manager.ts:31-32`) | Configured, never read. No retry path exists. |
| `AgentBridge` (120 LOC) | Constructed at `Agent.ts:83`; `agent.bridge` has no reader anywhere. |
| `replaySession()` (`Agent.ts:258`) | 0 callers, 0 tests. |

---

## 2. Fix the bugs

All on live paths, all cheap, all independent.

| | Fix |
|---|---|
| `askSafely` (`ports/decision.ts:122-130`) creates a `boundedSignal`, ticks it, clears it — and never passes it to `port.ask`, which takes no signal. A hung manifold never cancels. | add `signal?` to `DecisionPort.ask`, pass it |
| `isNarsese` (`util/src/utils/text.ts:71`) vs `isLikelyNarsese` (`nl/classifier.ts:17`) disagree on `{a --> b}.`; the agent routes it to a parser that rejects `{`, so it **throws** instead of falling through to the LM path | delete `isLikelyNarsese`, call `isNarsese` |
| `reschedulePending()` (`manager.ts:210`) runs `sortByDesc` + `clear` + re-insert on every `addTask` — **O(n² log n)** producing an insertion order nothing reads | delete; `addTask` is O(1) |
| `LmCallTimeout` (`lm/rule/LMRule.ts:30`) thrown at `:405,:419`, **caught nowhere** → unhandled rejection | catch at the rule boundary, or delete |
| `Agent.unmount()` (`Agent.ts:144`) never called; `mount()` is (`bot.ts:486`) → transports leak for the process lifetime | call it |
| `catch {}` at `phases.ts:76-78` and `:205-207` — no log, no event. A permanently-throwing engine yields a healthy cycle with zero derivations. `health()` hard-codes `errorRate: 0` | log + per-engine tally + read it |
| `recordGateDecision` (`telemetry/index.ts:12-16`) has no `correlationId` → counters can't be joined to the events explaining them. `KernelPerceptionGate.admit()` meters nothing; only `admitTask` does | add it; meter `admit()` |
| Refusals emit `logger.warn` only — egress veto (`:543`), gate rejection (`:391`), budget exhaustion (`:282`). A refusal that leaves no event is indistinguishable from a bug | emit an event per refusal |
| `control-work` exhausted → `memoryPressure` falls back to `0` → `aikrPressure: 'low'`, the healthy value. Can't tell "no pressure" from "no measurement" | add `'unknown'` |
| `NAREngine.ts:49` and `agent/index.ts:431` each sniff `?`/`!` separately and return **different shapes** for the same input | one `dispatchNarseseIntent(text)` |
| `createBudget` is two unrelated functions with one name (`types/core.ts:96` task weight vs `budget.ts:92` limits) → forces a `typeof` test on a statically-typed field (`manager.ts:97`) plus a cast (`:150`) | rename to `createTaskWeight` |

---

## 3. Make it traceable

Without this, none of §2 is verifiable.

- **`correlationId` through the Micro-Tick.** `CycleTrace` keys on `cycle: number`; `run()` takes no id. So *"which cycle admitted this belief, for which utterance?"* has no answer. Optional param on `run()`, `runStream()`, `CycleStageEvent`. **~15 LOC, the highest-value change here.**
- **`/metrics` endpoint.** 282 LOC of live Prometheus writers (`providers/health.ts:143`, `service/spend.ts:45`, `provider-runtime.ts:281`) and **no endpoint anywhere** — circuit-breaker state and LM spend are invisible in a deployed LM.

---

## 4. Leave alone

Unreachable but harmless. No budget pressure, and it's raw material if deferred work returns.

`cognitive-thread.ts` · `rl/impls/adapters/*` · `lm/system-one/heads/*` (**keep** — TODO32 M1 Variant C needs them) · `judgment-pipeline.ts` · `manifold-rl-agent.ts` · `tools/adapters/aisdk-adapter.ts` · 4 of 5 `aikr-processor` samplers · `gates/*` · `focus/{FocusTree,MetaFocus,nal-ab}` · dead `reflex/` impls · `replay.ts` record persistence · `assertBeliefTask` · `createMockLanguageModel`

**Drive / meta-goal / homeostasis machinery — untouched by decision.** `injectMetaGoals` (`nar-execution.ts:655-668`) cannot fire: `DriveManager.ts:22` initialises drives *at* their targets (curiosity 0.7, competence 0.8) and `:660` skips below-threshold injection at 0.3, so the skip branch is taken every cycle and `curiosity` has no downward path in production. `dispatchToolGoals` therefore finds nothing every cycle. Recording it here so the next person doesn't rediscover it; changing it is not in scope.

---

## 5. Collapse the duplicates — prioritized

Ordered by value ÷ risk. P1 needs no design decision and **reduces** LOC. P2 are migrations with real semantic surface. P3 are features, costed and separable. One hard dependency: **P2.4 requires P1.1**, because unifying two validators means first choosing one.

### P1 — mechanical, no decision required

| | Item | Effect |
|---|---|---|
| **1** | Delete `AbstractEventLog.validatePayload` (`core/src/eventlog/AbstractEventLog.ts:139-296`) — **157 lines** re-implementing validation that `validateCognitiveEvent` already does, and disagreeing with it. Every util-side event the repo mints fails the real schema anyway. `append:64` gains one `validateCognitiveEvent(event)` call. | −157 LOC; one validator instead of two |
| **2** | `Episode` declared twice — `util/src/types/episodic-memory.ts:12` (has `id`/`causes`/`consequences`/`context`) and `core/src/memory/types.ts:20` (drops all four). `MemoryService.queryEpisodic:92-97` builds objects with **no `content`**, so the same episode has two shapes. | core imports util's; delete the second |
| **3** | **The gate claim.** `admitTask` → `decideAdmission` → `emitAdmitted` **always returns `admitted: true`** (`KernelPerceptionGate.ts:300-316`); the branch at `nar-execution.ts:390` is unreachable except via a schema throw. On the tick's write path the perception gate is an event emitter, not a filter — while the README and TODO32 call it a firewall. **The code is right; the documentation is wrong.** Fix the claim (ingress-only) and comment the dead branch. | ~1 h, removes a claim the system doesn't honour |

### P2 — migrations, ascending risk

| | Item | Risk / effect |
|---|---|---|
| **4** | **CognitiveEvent union merge.** Three definitions: `util/src/types/cognitive.ts:21` (23 variants, hand-written), `core/src/schemas/cognitive-events.ts:163` (13, zod), plus a third in `tick/tick.ts` (gone after §1). All 10 util-side events the repo mints **fail** `CognitiveEventSchema`; `events/bridge.ts:58` emits `concept.activated` without the required `activationSource`, and `EventLogPersistence.loadGateEvents:15-22` silently counts it `invalid` on reload. Core's zod union wins (only one with a runtime validator; only one whose `engine` is a real discriminant, which is what makes *"the seam proposes, the kernel admits"* checkable). Util becomes a type-only re-export, direction `core → util`. | **needs P1.1 first.** Touches every producer — highest risk, largest win (~270 LOC net) |
| **5** | **Two timer systems.** `stage()` (`nar-execution.ts:370-376`) drives `PhaseTimer` *and* `CycleTrace` over the same regions; 6 more bare `phaseTimer.begin/end` pairs have no trace counterpart. Worse, `PhaseTimer.end:29` pops blindly while `CycleTrace.end:56` matches by name — on an unbalanced pair the summary mis-attributes and the correctness record doesn't. Make `PhaseTimer` a pure projection over `CycleTrace.regions()`; delete its stack and `begin`/`end`. | −30 LOC; fixes the mis-attribution |
| **6** | **`sample()` means two algorithms.** `Memory.sample()` (`memory.ts:364`) is top-N; `Bag.sample()` is roulette. Same name. Two `SamplingStrategy` interfaces too — `strategies/types.ts:25` has an implicit `Math.random`, `aikr-processor.ts:14` an explicit `rng`. Unify on the explicit-rng shape; rename `Memory.sample` → `topConcepts`. Also remove `Memory.sampleWindow`'s `= Math.random` default (`memory.ts:373`), which silently bypasses the port's `rng`. | latent trap, no live bug yet |
| **7** | **`gateRegistry` process global.** 6 sites fall back to it (`manager.ts:48`, `focus/Focus.ts:93`, `GameFocus.ts:142`, `SelfMetaGame.ts:76`, `lm/admit.ts:12`, `tools/adapters/coverage-concept.ts:57`), so a NAR with an isolated registry silently shares the global's budget and autonomy mode with any separately-built `Focus`. `reset()` exists solely for test isolation — a singleton whose `reset` is a test affordance. Make it non-exported; every consumer takes it as a required arg. | no live bug; isolation hazard |

### P3 — features, costed separately

| | Item | Size |
|---|---|---|
| **8** | **The tool path has no kernel gate.** `phases.ts:193 → ToolRegistry.execute → ToolManager` consults only `PolicyEngine`, an allow/deny list — no `IActionGate`, no budget charge, no reward gate. A tool runs in any autonomy mode including `observe-only`. Thread `IActionGate` + a `control-work` charge through the delegate seam (`ToolRegistry.ts:32`); `KernelActionGate.addAllowedOperation` (0 callers) becomes the control surface it was designed as. | ~1 d |
| **9** | **A real refusal policy for the tick path** (P1.3's counterpart): confidence floor, source reputation, contradiction. Only if P1.3's "ingress-only" reading is rejected. | ~3 d |
| **10** | **Budget engine unification.** `core/src/budget.ts:193` sets `terminationReason`; `KernelBudgetGate.ts:155-195` **never does**, so `control-budgets.ts:83` reports `'none'` for a scope that *just refused a charge* — the operator's diagnostic gives the wrong answer. Operation→dimension table exists twice (`budget.ts:146` `RESOURCES`, `KernelBudgetGate.ts:64-96`). Delete `KernelBudgetGate`, call `core/budget.ts`. | ~1 d, touches accounting semantics |

### Deferred by decision — Architecture B

`GameFocus` (764 LOC) holds the **only** call sites for `Negotiator`, `KernelActionGate.authorize`, `KernelRewardGate.process`, `LearnerRegistry.dispatch`, and the only place reflexes are *stepped*. `bot.ts:403` attaches it; nothing drives it. `FocusScheduler` — self-described "Production multi-focus drive loop," with `hz`, `start`/`stop`, a deadline — has **zero** production callers.

Delete or merge; not costed here. **Needs a forcing function**: `wiring:declared` should require `experimentalSince` + `resolveBy`, and a `wiring:no-expired-experimental` gate should fail once `resolveBy` passes, **defaulting to delete rather than re-review.** Without it, a label plus a passing gate is how a deferral becomes permanent. Decide only after §3 lands, so you can tell which parts do anything.

## Order

```
§1  delete          ~2d   parallel, mechanical
§2  bugs           ~3d   11 independent, one commit each
§3  traceable      ~1d   makes §2 verifiable
§5.P1  mechanical  ~0.5d  −157 LOC, unifies two validators
§5.P2  migrations ~4d    P1.1 must land before P2.4
§5.P3  features   ~5d    separable; decide per item
```

~11 days for §1–§3 + P1 + P2; P3 on top.

§1 first — the type move unblocks the rest, and the README can't be corrected while contradicting live code. §3 before §5.P2, since deciding whether anything is *observably* duplicated (P2.4, P2.7) needs the trace join first. §5.P1.1 before §5.P2.4 — unifying two validators means picking one, and the zod union is the answer.

**Done when:** nothing in the repo asserts something untrue about how the system works; the eleven bugs are fixed (one was falsified, one was already true, one landed differently); given a term and a `correlationId` you can say which cycle admitted it, under which gate decision, for which stimulus; one validator exists instead of two; and three `CognitiveEvent` definitions are one.

**Not done:** unattended operation, drive/meta-goal homeostasis, negotiation, reflexes, multiple operating modes, and Architecture B's fate.
