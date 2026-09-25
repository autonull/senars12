# REFACTOR.todo1: Cycle Unification, Outcome-Ledger Learning & AIKR-Bounded Processing

**Version:** 1.1 (2026-09-24) · **Follows** TODO25 (retrospective consumers, complete; benches 77–80 green) and the `REFACTOR.md` opportunity survey.

**Philosophy:** `REFACTOR.md` lists 15+ structural generalizations. Several misread the substrate: the tick pipeline is *dormant in production*, `Bag<T>` sampling is not hardcoded-single-strategy, `GroundingPipeline` is dead code. The highest-leverage moves consolidate three divergent cycles onto one abstraction, give self-tuning a memory of cause→effect, and instantiate the AIKR-Bounded Processor pattern — proving it generalizes on TWO processes immediately (SchemaInductor + ContrastiveMemory). Every phase is additive, bench-gated, independently shippable, and leaves disabled paths byte-identical.

---

## 1. Opportunity Triage

| REFACTOR.md item | Verdict | Rationale |
|---|---|---|
| §22 Agent macro-cycle → phase pipeline | **ADOPT (Phase A)** | Three parallel cycle implementations (dormant `tick.ts` onion, `GameFocus` 5-stage, hardcoded `phases.ts`) + two unrelated `createPipeline` exports. Consolidation onto the **shared `TickMiddleware` onion** unlocks §22's configurable architectures AND makes §12 trivial later. |
| §11 ParameterTable → outcome-correlated history | **ADOPT (Phase B)** | `ParameterTable` (96 ln) has zero history; `RLFPLearner` knobs write silently; `traceGradeHistory`, arcade Brier, retrospectives exist as outcome signals. Ledger + `OutcomeLinker` makes tuning evidence-gated. Also feeds retrospectives. |
| AIKR-Bounded Processing pattern (SchemaInductor + ContrastiveMemory) | **ADOPT (Phase C)** | Pattern section's strongest idea. TODO25 wired the derivation-chain ring; induction is still batch CLI. **Prove generalization immediately** by applying the same `AIKRProcessor` to ContrastiveMemory (§20) — closes "judgments → exemplars → better judgments" flywheel. Also resolves two-`schema-induction.ts` collision. |
| §6 Event log + §15 cross-memory query + §4 ProofStream + §9 causal graph infra | **ADOPT (Phase D)** | `retrospect.ts:73–75` documents O(all-episodes) scan; `SqliteEventLog` has unused `correlation_id`; derivation ring exists (TODO25). Single phase adds: indexed queries, `Episode.id` + causal edge fields, live `ProofStream` AsyncIterable on the ring. Cheap, high enablement. |
| §14 Source reputation (+ GroundingPipeline removal) | **ADOPT (Phase E)** | `nar/src/grounding.ts` unexported dead code (zero consumers). Reputation at real seam (`SOURCE_QUALITY_CONFIDENCE` → `seedTruth`/`KernelPerceptionGate`), trust-not-truth (RewardGate pattern). Also fixes ContrastiveMemory eager construction (SystemOneRuntime:44). |
| §12 Tick stage graph | **TRIVIAL AFTER A** | Phase A makes macro pipeline use the kernel's `TickMiddleware`; conditional stage graph becomes a small delta on one shared abstraction. |
| §3 Negotiator → ConsensusEngine | **LIGHTWEIGHT IN A** | Negotiator (152 ln) called from GameFocus + tick bindings. Add `IProposer` interface + `proposers[]` array in same cycle refactor; zero behavior change, enables MeTTa-as-voter later. |
| §5 Bag sampling / FairnessSampling | **IN C** | `AIKRProcessor` uses `Bag<T>`; FairnessSampling (Proof Obligation #6) added as a sampling strategy option on the processor. |
| §1 JudgmentPipeline registry · §2 CognitiveThread · §7 Focus tree · §8 Strategy algebra · §10 LM rule graph · §13 Capability ontology | **DEFER** | Speculative generality; revisit when Phase B outcome data demonstrates need. |

---

## 2. Design Invariants (inherited + new)

TODO20–25 invariants carry forward (I1–I7, N1–N3). New:

| # | Invariant | Enforcement |
|---|---|---|
| C1 | **Disabled ⇒ byte-identical.** Default macro pipeline = hardcoded sequence; ledger off; reputation multiplier = 1.0; induction inert below pressure; ProofStream off; Episode `id` optional. | Benches 81–86 each assert inert path. |
| C2 | **Ledgers observe; never decide.** Parameter history, reputation, exemplar pools are append-only records consulted by governors — no write path mutates `Truth.frequency`/`confidence`. | Epistemic firewall precedent; Bench 82/85/86. |
| C3 | **All new accumulation is AIKR-bounded.** Bags with capacity, decay, eviction, pressure triggers, `AbortSignal` anywhere processing happens. | `AIKRProcessor` contract; Bench 83/86. |
| C4 | **No speculative exports.** Every new export has an in-repo consumer the same phase. | `pnpm exports:audit`. |
| C5 | **One pipeline abstraction.** Macro-cycle and kernel tick both use `TickMiddleware` onion; `stream/pipeline.ts` retains its async-generator contract for reasoning streams. | Bench 81 parity + type identity. |

---

## 3. Naming & Vocabulary

| Identifier | Kind | Meaning |
|---|---|---|
| `MacroPhase` | type | `TickMiddleware` — one Agent macro-cycle phase using the **kernel's onion shape** (preserves streaming narration via async `next()`). |
| `createMacroPipeline` / `DEFAULT_MACRO_PIPELINE` | fn/const | Ordered phase list; default reproduces `phases.ts` `runCycleStream` exactly. |
| `createReflectPhase` / `createCapturePhase` | fn | Optional phases: metacognition; DialogueCapture promotion from bot hook. |
| `ParameterLedger` | class | Append-only `{writer, scope, parameter, oldValue, newValue, at, trigger}` + `OutcomeLinker`. |
| `AIKRProcessor<TIn, TOut>` | interface | `admit / pressure / process / processIfPressured / decay` — six-stage bag pattern; takes `samplingStrategy?: SamplingStrategy<TIn>` (default `PrioritySampling` softmax T=1.0). |
| `SamplingStrategy<T>` | interface | `select(items: T[], budget: number, rng: RandomSource): T[]` — implemented by `PrioritySampling` (softmax, T=1.0), `PowerLawSampling` (α=1.5), `FairnessSampling` (aging boost), `TopKSampling` (k=budget), `PriorityProportional` (legacy raw). Used by `AIKRProcessor`. |
| `SourceReputation` | class | Per-source-key track record → `effectiveCeiling = base × multiplier` (clamped). |
| `ProofStream` | type | `AsyncIterable<DerivationRecord>` on the existing bounded ring (`NAR.getDerivationChains()`). |
| `Episode` (extended) | type | Adds optional `id: string`, `causes: string[]`, `consequences: string[]`, `context: string[]` for causal graph (§9). |
| `createTickPipeline` | fn | Renamed `tick.ts` `createPipeline`; old name `@deprecated since 1.x — use createTickPipeline` alias. |
| `IProposer` | interface | `{ propose(state): Proposal[]; learn(event): void }` — Negotiator generalization. |

---

## 4. Phases

### Phase A — One cycle abstraction: macro-cycle uses the kernel's middleware onion
- **Core deliverable**: `MacroPhase` = `TickMiddleware` (from `nar/src/tick/tick.ts:37`). The macro pipeline IS a `TickMiddleware[]` executed by the same onion dispatch (`runTick` logic, adapted for `CycleHost` context). `runCycleStream`'s seven steps become `DEFAULT_MACRO_PIPELINE` — behavior-identical, streamed narration preserved via the middleware's `next()` passing.
- `AgentOptions.macroPipeline: MacroPhase[]` accepts custom phase lists; `Agent.cycle/chat` executes via the shared dispatcher.
- **Promoted phases**: `createCapturePhase` (wraps `DialogueCapture.onExchange` — replaces bot's fire-and-forget hook at `src/bin/bot.ts:150–155`); `createReflectPhase` (wraps `ReasoningAboutReasoning.performMetaCognitiveReasoning`). Opt-in; dialogue-disabled path unchanged.
- **Negotiator generalization (lightweight)**: `IProposer` interface + `Negotiator` constructor accepts `proposers: IProposer[]` (default `[reflex, nal]`). `resolve()` loops proposers, applies arbitration strategy (default = current NAL veto). Zero behavior change; enables MeTTa-as-voter/peer-delegation later. Exported from `nar/src/reflex`.
- **Name collision fix**: `nar/src/tick/tick.ts` export renamed `createTickPipeline`; old name kept as `@deprecated since 1.x — use createTickPipeline` alias (2-minor lifecycle). `stream/pipeline.ts` untouched.
- Files: `core/src/agent/pipeline.ts` (NEW — shared dispatcher), `core/src/agent/phases.ts` (refactor to `TickMiddleware`), `core/src/Agent.ts`, `nar/src/reflex/Negotiator.ts` (add `IProposer`), `nar/src/tick/tick.ts` (rename export), `src/bin/bot.ts` (Capture wiring), `tests/nar/refactor1-macro-pipeline.test.ts` (NEW, **Bench 81**).
- Bench 81 falsifies: default macro pipeline emits identical event sequence + stream chunks vs. pre-refactor on scripted engine; custom phase ordering honored; `Reflect`/`Capture` absent by default; `Negotiator` with default proposers matches current behavior byte-for-byte; `createTickPipeline` alias equivalence.
- Effort: ~2d.

### Phase B — Parameter & strategy outcome ledger (with retrospective integration)
- `ParameterLedger` (`nar/src/config/parameter-ledger.ts`): every changed-parameter write through `ParameterTable.setMany`, `RLFPLearner.applyTuningUpdate`, and `RetrospectiveAdapter` appends `{writer, scope, parameter, oldValue, newValue, at, trigger}` to `.cache/parameters/ledger.jsonl` (digest-pinned, no raw utterances — I6 style).
- `OutcomeLinker.correlate({parameter, windowMs})`: joins ledger against existing outcome surfaces — `traceGradeHistory` (correlationId→quality), arcade `BrierHarness`, retrospective correction rates — emitting per-parameter improvement series.
- Query: `ledger.query({parameter?, writer?, improvedOnly?})`; surfaced as `.parameters` bot command + readonly MCP tool.
- **Retrospective integration**: `retrospect()` (TODO24) automatically enriches `strategyAudit` with ledger entries for the session's `correlationId` window — showing which parameter changes preceded quality shifts.
- `CognitiveController.adapt()` and `SelfMetaGame` consult `improvedOnly` series before proposing changes (evidence-gated, clamped per N1).
- Files: `nar/src/config/parameter-ledger.ts` (NEW), `nar/src/config/parameter-table.ts` (emit), `nar/src/rlfp/RLFPLearner.ts`, `nar/src/dialogue/consumers/adapt.ts`, `nar/src/dialogue/retrospect.ts` (ledger enrichment), `nar/src/cognitive/controller.ts`, `src/bin/bot.ts` (`.parameters`), `tests/nar/refactor1-parameter-ledger.test.ts` (NEW, **Bench 82**).
- Bench 82 falsifies: exactly-once per changed param (coalesced writes = one record), all-or-nothing `setMany` scope-failure records nothing, `improvedOnly` filter on synthetic outcomes, ledger-off default, retrospective enrichment present and correct.
- Effort: ~1.5d.

### Phase C — `AIKRProcessor`: SchemaInductor + ContrastiveMemory as cognitive processes
- `AIKRProcessor<TIn,TOut>` (`nar/src/learning/aikr-processor.ts`): six-stage contract (admit → accumulate → trigger → process → emit → decay) over injected `Bag<T>`s with `RandomSource` (TODO20 T1) determinism. Adds `samplingStrategy?: SamplingStrategy<TIn>` with implementations:
  - `PrioritySampling` — **softmax with temperature** (default, `T=1.0` configurable): `exp(priority / T) / Σexp(...)`. Replaces raw proportional; controllable exploration/exploitation, standard in RL/cognitive architectures.
  - `PowerLawSampling` — `priority^α` (α=1.5 default) for heavier tail / more exploitation; `α=0.5` for exploration.
  - `FairnessSampling` — aging boost: `effectivePriority = priority × (1 + ageFactor × cyclesSinceLastSample)`. Satisfies Proof Obligation #6 (scheduler fairness).
  - `TopKSampling` — truncates to top-k by priority, then softmax; budget-bounded exploration.
  - `PriorityProportional` — legacy raw proportional (current `PriorityBag.sample()`), preserved for exact backward compat.
  Default `PrioritySampling(T=1.0)` chosen because: temperature is interpretable, matches RLFP's policy temperature, degrades gracefully (T→∞ = uniform, T→0 = greedy), and avoids the current method's exponential starvation of low-priority items.
- **SchemaInductor revision**: input bag (cap 256, priority = novelty × chain length) fed continuously from `NAR.getDerivationChains()` via existing `onDerivation` sink; candidate bag (cap 128, priority = frequency × confidence) gates promotion. `induceIfPressured({budget?, signal?})` is micro-tick-compatible (no-op below pressure 0.7); LM failure → symbolic structural induction; interruptible, partial results on abort. `.schemas-induce` CLI drains `process({budget})`.
- **ContrastiveMemory self-maintenance (§20)**: second `AIKRProcessor` instantiation. Exemplar bag (cap per-rubric, priority = discrimination margin × recency × coverage). On each `decide()` with high confidence, judgment auto-admitted to exemplar bag if it improves coverage/margin. Pool self-balances to 40/60 target via eviction; `decay()` called per cycle reduces stale priority. `refreshSystemOneContrastive` becomes a no-op (kept for compat). Flywheel closes: judgments → exemplars → better calibrated judgments.
- **Disambiguate collision**: `nar/src/focus/schema-induction.ts` → `nar/src/focus/episode-schemas.ts` (exports unchanged, patch).
- Files: `nar/src/learning/aikr-processor.ts` (NEW), `nar/src/learning/schema-induction.ts` (bag-backed), `nar/src/lm/system-one/contrastive.ts` (exemplar bag + AIKRProcessor), `nar/src/nar.ts` (pressure hook in consolidate), `nar/src/focus/episode-schemas.ts` (rename), `tests/nar/refactor1-aikr-induction.test.ts` + `tests/nar/refactor1-contrastive-processor.test.ts` (NEW, **Bench 83**).
- Bench 83 falsifies (both processors): capacity eviction drops lowest priority, pressure threshold gates processing, decay forgets stale items, `AbortSignal` yields partial results, LM-failure symbolic fallback, inert-below-pressure default, determinism under fixed `RandomSource`, **each `SamplingStrategy` produces correct distribution (softmax temperature sweep, power-law α, fairness aging boost, top-k truncation, legacy proportional parity)**, FairnessSampling guarantees >0% allocation to aged items, ContrastiveMemory pool self-balances 40/60 without manual refresh.
- Effort: ~3d (includes 5 `SamplingStrategy` implementations + dual processor wiring).

### Phase D — Indexed cognitive timeline + ProofStream + Episode causal infra
- `EpisodicMemory.getEpisodes` gains `sessionId?`, `correlationId?` filters backed by load-time metadata index; removes O(all-episodes) scan (`retrospect.ts:73–75`).
- `SqliteEventLog.query({correlationId?, types?, timeRange?, limit?})` using existing `correlation_id` + timestamp index; `InMemoryEventLog` implements same optional interface. `getRange` unchanged.
- **Episode causal infra**: `Episode` type extended with optional `id: string` (ULID at write), `causes: string[]`, `consequences: string[]`, `context: string[]` — metadata-only, no schema migration (JSONL tolerant). `retrospect.ts` and `DialogueCapture` populate `id` and `causes` (reaction → dialogue turn) automatically. Full causal traversal (§9) deferred until consumers exist.
- **ProofStream**: `NAR.getProofStream(): AsyncIterable<DerivationRecord>` wraps the existing bounded ring (`getDerivationChains()` source) — zero-cost-when-unset, respects `AbortSignal`, one consumer per subscription (tee). Enables live Lens/MCP chain-of-thought and future `CriticReflex`.
- `retrospect()` / `selectProbes()` consume indexed path — session scoping O(matches).
- Files: `nar/src/memory/EpisodicMemory.ts`, `core/src/eventlog/{SqliteEventLog,InMemoryEventLog,EventLog}.ts`, `util/src/types/episodic-memory.ts` (Episode extension), `nar/src/rules/recorder.ts` (ProofStream export), `nar/src/nar.ts` (ProofStream getter), `nar/src/dialogue/{retrospect,capture}.ts`, `tests/nar/refactor1-timeline.test.ts` (NEW, **Bench 84**).
- Bench 84 falsifies: indexed query parity with brute-force, `sessionId`/`correlationId` filters exclude foreign, `ProofStream` emits ring contents in order + respects abort, `Episode.id` ULID unique, causal fields round-trip JSONL, interface defaults keep non-indexed implementations working.
- Effort: ~1.5d.

### Phase E — Source reputation (and dead-code removal + small fixes)
- **Delete `nar/src/grounding.ts`**: unexported, zero consumers; duplicate `SourceQuality` enum shadows `kernel/schemas.ts`. Update README §"Source Quality & Grounding" to point at `SOURCE_QUALITY_CONFIDENCE` (kernel) as the single table.
- **Fix ContrastiveMemory eager construction**: `SystemOneRuntime` (line 44) constructs `contrastive = new ContrastiveMemory()` unconditionally. Change to lazy init behind `getSystemOneContrastive()` — saves allocation when System One disabled.
- `SourceReputation` (`nar/src/kernel/source-reputation.ts`): per source key (URL domain, peer id, LM provider) accumulates `{confirmed, contradicted}` from *verification signals only* — egress-gate rejections, `.react` corrections, peer shadow-validation failures. `effectiveCeiling = baseQuality × clamp(multiplier, floor, 1)` consumed at `seedTruth` and `KernelPerceptionGate.sourceQualityToConfidence`.
- RewardGate-compatible (C2): adjusts trust ceiling, never truth values; domain split unchanged. Default multiplier 1.0 ⇒ byte-identical (C1). Persisted to `.cache/parameters/source-reputation.jsonl` (ledger-backed, Phase B machinery).
- Surfaced: `.status` reputation table + retrospective source audit ("which sources contributed most corrections"); low-reputation sources feed `selectProbes` curriculum.
- Files: `nar/src/grounding.ts` (DELETE), `nar/src/kernel/source-reputation.ts` (NEW), `nar/src/nar/system-one.ts` (lazy contrastive), `nar/src/kernel/KernelPerceptionGate.ts`, `nar/src/lm/system-one/seed.ts`, `src/bin/bot.ts` (`.status`), `tests/nar/refactor1-source-reputation.test.ts` (NEW, **Bench 85**).
- Bench 85 falsifies: multiplier clamping, confirmation/contradiction accounting, no-Truth-mutation (firewall), default-neutral ceiling, reputation feeds probe selection, lazy ContrastiveMemory avoids allocation when System One disabled.
- Effort: ~1.5d.

---

## 5. Out of Scope
❌ CognitiveThread / multi-tenant isolation (§2) — await telemetry demonstrating bleed. ❌ Hierarchical focus tree (§7), LM rule graph (§10), capability ontology (§13) — research questions, not engineering today. ❌ Any new export without in-repo consumer (`pnpm exports:audit` gate).

## 6. Risks
| Risk | Mitigation |
|---|---|
| Macro-pipeline refactor changes chat behavior | Bench 81 parity harness on scripted engines; default pipeline is mechanical extraction |
| Ledger grows unbounded / writes on hot path | Append-only JSONL with rotation, write-batched with `setMany`, ledger-off default, bounded query |
| Induction/exemplar pressure-hook perturbs cycle timing | `processIfPressured` respects AIKR budget + cooperative yield; inert below 0.7 pressure |
| Default sampling change (softmax vs legacy proportional) | `PriorityProportional` opt-in preserves exact legacy behavior; bench asserts parity; default `T=1.0` softmax is backward-compatible for most priority distributions |
| Reputation miscalibration degrades admission | Clamped multiplier band, neutral default, `.status` visibility, ledger rollback |
| Episode `id` field adds JSONL size | ULID is 26 chars; optional; only written when episodic enabled (default on) |

## 7. Notes for Implementation
- Bench-first per phase (pattern from DQ6/DQ2, TODO25). Bench numbers 81–85 continue the TODO25 sequence.
- Phase D is cheapest and unblocks retrospective performance; it may land first without reordering.
- Phase B's ledger is the prerequisite for later adopting §8 (strategy composition) and §1 (pipeline registry) — re-evaluate once `improvedOnly` series exist.
- Versioning: Phase A's `createTickPipeline` rename follows deprecation lifecycle (JSDoc `@deprecated`, 2-minor keep, remove next major); everything else is minor (new exports) or patch (file rename with unchanged exports).
- `GroundingPipeline` deletion is pre-policy-class (never exported, zero consumers) but README must be corrected in the same change.
- **Phase ordering flexibility**: A→B→C→D→E is logical but D and E are independently landable. C depends on A's pressure-hook location in `nar.ts` consolidate.
- **Sampling optimization note**: Current `PriorityBag.sample()` is O(n) linear scan (n ≤ 256); `decay()` mutates all weights every cycle, so CDF/histogram rebuild would cost O(n) anyway. For future scale: `FenwickBag` (Binary Indexed Tree) gives O(log n) `sample` + `updatePriority` with lazy multiplier for bulk `decay` — behind same `Bag<T>` interface. Not needed now.

---

## 8. Progress — ALL PHASES LANDED (2026-09-24)

Benches 81–85 implemented as `tests/nar/refactor1-*.test.ts`; all green, plus full `tests/unit` (230) and benchmark suites. One commit per phase.

### Phase A — macro-cycle middleware onion ✅
- `core/src/agent/pipeline.ts` (NEW): `MacroPhase` onion (`dispatchMacro`, same guard as `runTick`), `AsyncQueue` joining middleware-dispatched narration to `runCycleStream`, `createCapturePhase`/`createReflectPhase` factories.
- `phases.ts`: `DEFAULT_MACRO_PIPELINE` (8 phases: perceive → recall → reason → narrate → consolidate → act → record → announce) reproduces the old `runCycleStream` step-for-step (Bench 81 parity trace). `runCycle`/`runCycleStream` keep their names (compat; existing `tests/unit/core/agent-phases.test.ts` passes unchanged).
- `AgentOptions.macroPipeline` + `Agent.setMacroPipeline()`; bot installs `[..., DEFAULT_MACRO_PIPELINE, createCapturePhase(...)]`, replacing the fire-and-forget `collectChat` hook (capture joins on the cycle's correlationId; `at` = stimulus.timestamp).
- Negotiator: `IProposer`/`NegotiationInput`/`ProposerContribution`; **deviation**: default `proposers = []` (not `[reflex, nal]`) — reflex/NAL data still arrive as `resolve()` arguments, so adapters would be dead code today; `resolve()` merges proposer contributions then applies the unchanged NAL-veto arbitration; `Negotiator.learn()` fans out.
- `createPipeline` → `createTickPipeline` with `@deprecated` alias (2-minor lifecycle); stream/`createPipeline` (different module) untouched.

### Phase B — parameter & outcome ledger ✅
- `nar/src/config/parameter-ledger.ts`: `ParameterLedger` (append-only JSONL, sync writes, in-memory query), `OutcomeLinker` (before/after quality windows, `improvedOnly`).
- Writers: `ParameterTable.attachLedger` (exactly-once per *changed* param; all-or-nothing `setMany` failure records nothing), `RLFPLearner` (`ledger` config option or `attachLedger`), `RetrospectiveAdapter` (`ledger` option, strategy switches recorded with the retrospective digest as trigger).
- `NAR.setParameterLedger()` wires rlfp + self-meta-game table. `retrospect()` gains `ledgerEntries?` → `StrategyAuditEntry.parameterChanges`; bot feeds the session-window slice.
- Bot: shared ledger at `.cache/parameters/ledger.jsonl` + `.parameters [improved]` command (improved series uses dialogue-reaction quality as the outcome surface: accept=1, clarify/redirect=0.5, negative=0).

### Phase C — AIKRProcessor ✅
- `nar/src/learning/aikr-processor.ts`: `AIKRProcessor<TIn,TOut>` (six-stage; **aborted batch is not consumed** — unprocessed items stay for a later pass) + `PrioritySampling` (softmax T, default), `PowerLawSampling` (α via log-space softmax), `FairnessSampling` (aging boost; per-item age counters), `TopKSampling` (truncate-then-softmax), `PriorityProportional` (exact legacy parity).
- SchemaInductor: chain bag (cap 256, priority = novelty×length, novelty gate via bounded signature set), `onDerivation` fed from `NAR.#recordDerivationChain`, `induceIfPressured` (inert <0.7) + `induceNow` (CLI drain), **LM null-response *and* exception both fall back** to symbolic structural induction (`?V` templates, confidence = min chain conf).
- ContrastiveMemory: per-rubric exemplar `PriorityBag`s (pos/neg caps = 40/60 of maxPerRubric; priority eviction replaces FIFO), `observeJudgment` auto-admission gate (threshold 0.8, priority = margin×confidence) into a per-rubric **pending bag + AIKR maintainer** that promotes under pressure, `decay()` per cycle. *Behavior delta (intentional):* `add()` returns the admitted count (priority-gated) — one TODO22 assertion updated (6→5); kept exemplars under ties are first-come (FIFO trim kept last-come; no test depended on which).
- `focus/schema-induction.ts` → `focus/episode-schemas.ts` (patch rename; exports unchanged). `NAR.consolidateLearning()` = periodic hook (decay + pressure-gated drain); **note**: it is exported but no per-cycle call site is wired yet — call it from a cycle point (e.g. System One refresh path or the kernel controller) when telemetry shows pressure.
- `getSchemaInductor()` (undefined without LM); `.schemas-induce` drains the NAR-owned inductor.

### Phase D — indexed timeline + ProofStream + causal episodes ✅
- `EpisodicMemory.getEpisodes({sessionId?, correlationId?})`: lazy one-pass metadata index (invalidated by `clear()`, updated on `log`); most-recent-`limit` semantics. `retrospect()` consumes the indexed path.
- `Episode` gains optional `id` (**ULID assigned at write**), `causes`/`consequences`/`context` — reserved metadata keys (`id/causes/consequences/context`) are lifted onto the Episode and stripped from metadata; DialogueCapture writes `causes:[turnId]` on reactions, `context:[turnId]` on turns.
- `EventLog.query?({correlationId,types,timeRange,limit})` on Sqlite (indexed SQL) + InMemory; limit keeps the most recent N (both implementations).
- `ProofStreamRing<T>` (recorder.ts) backs the derivation ring; `NAR.getProofStream(signal?)` = ring snapshot replay + live push, tee per subscription, abort/unsubscribe clean. *Note*: the ring holds `Task[]` chains, so the stream type is `AsyncIterable<readonly Task[]>` (plan's naming table said `DerivationRecord` — the recorder's `DerivationRecord`s remain a separate CLI/retrospect surface).

### Phase E — source reputation ✅
- `nar/src/kernel/source-reputation.ts`: `confirmed/contradicted` per key → clamped multiplier (gate ≥2 contradictions, floor 0.5, neutral 1.0), JSONL reload on construction; firewall-tested (frequency untouched).
- Consumed at `KernelPerceptionGate.admit` (per `sourceId`) and `seedTruth` (via `SystemOneIngressJudge` lazy `reputation`/`sourceKey` config). `GateRegistry.setReputation`; `NAR.setSourceReputation/getSourceReputation`.
- Bot: egress-gate verdicts → `llm-narration` key; `.react` → `user` key; reputation table appended to the System One status block. selectProbes/retrospective source-audit integration deferred (see below).
- `nar/src/grounding.ts` deleted (never exported, zero consumers); README corrected.
- `SystemOneRuntime.contrastive` lazy getter — no allocation when System One disabled.

### New improvement opportunities
1. **Wire `consolidateLearning()` into a real cycle point** — currently only reachable manually; the kernel controller's end-of-step is the natural home (Residual from Phase C).
2. **Finer reputation keys** — ingress judge uses a single `'system-one'` key; peer-agent grounding (when it lands) should key by peer id / URL domain, and feed `selectProbes` curriculum (Phase E's deferred slice).
3. **Outcome surfaces for `OutcomeLinker`** — reaction-quality proxy today; swap in `traceGradeHistory` timestamps (currently correlationId→quality, no time) or arcade Brier series for sharper `improvedOnly` evidence.
4. **`FenwickBag`** (§7 note) still open; only worth it if bag caps grow past ~1k.
5. **MeTTa proposer** — `IProposer` seam ready; a MeTTa voter adapter is now a small consumer.
6. **Deprecation sweep** — `createPipeline` alias removal due after 2 minors; `refreshSystemOneContrastive` no-op conversion (plan) was **not** needed (it still mines hard negatives; only construction went lazy).
7. Deferred REFACTOR.md items (§1/§2/§7/§8/§10/§13) remain deferred — re-evaluate §8/§1 once `improvedOnly` series accumulate.