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