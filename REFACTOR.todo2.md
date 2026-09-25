# REFACTOR.todo2: Cognitive-Process Completion, Cross-Memory Query & Strategy Composition

**Version:** 1.0 (2026-09-24) · **Follows** `REFACTOR.todo1.md` (all phases A–E landed; benches 81–85 green) and the `REFACTOR.md` opportunity survey.

**Philosophy:** TODO1 unified the cycles, gave tuning a memory, and instantiated the `AIKRProcessor` pattern on two processes. What remains from `REFACTOR.md` splits into three classes: **residuals** (TODO1 machinery exists but isn't wired to a consumer — wire it, don't rebuild it), **pattern extensions** (the remaining batch processes from the AIKR-Bounded survey), and **generalizations** (§8 strategy algebra, §15 cross-memory query) whose prerequisites now exist. Items still lacking a demonstrating consumer (§1/§2/§7/§10/§13) stay deferred. Every phase is additive, bench-gated, independently shippable, and inert-by-default (C1 carry-forward).

---

## 1. Opportunity Triage

| REFACTOR.md item | Verdict | Rationale |
|---|---|---|
| TODO1 residual: `consolidateLearning()` never called | **ADOPT (Phase A)** | `nar/src/nar.ts:466` defines it; zero call sites. Decay + pressure-gated induction/exemplar maintenance only run when invoked manually. The kernel controller's end-of-cycle is the natural home; without this, Phase C's bags never drain in production. |
| §9 causal graph traversal | **ADOPT (Phase A)** | TODO1 Phase D added `Episode.id/causes/consequences/context` and populates them — but `getEpisodes` has no `causedBy`/`leadingTo` traversal. Pure read-side delta on indexed `EpisodicMemory`; feeds retrospectives immediately. |
| AIKR pattern → Memory Consolidation (#1) | **ADOPT (Phase B)** | Survey's next-simplest target; `EpisodicMemory` accumulates unbounded. `Bag<Episode>` (priority = recency × salience × connections) + compression task under existing `consolidateLearning` trigger. Proves the pattern's third instantiation on a *different* substrate (persistence, not induction). |
| §15 cross-memory query | **ADOPT (Phase C)** | Working/episodic/semantic memory still have separate APIs; `retrospect.ts` joins them manually by `correlationId`. A read-only `MemoryQuery` facade unlocks analogical retrieval and richer retrospectives; also supplies the missing **outcome surfaces** TODO1 flagged for `OutcomeLinker`. |
| AIKR pattern → Self-Improvement Proposals (#4) + Hard Negative Mining (#5) | **ADOPT (Phase D)** | Both accumulate from flywheel sources and process in arrival/batch order. Small, isolated bags; same six-stage contract; pressure triggers come from TODO1's own telemetry (contradiction count, proposal arrival). |
| §8 strategy composition algebra | **ADOPT (Phase E)** | TODO1 gated this on `improvedOnly` series existing — they do now (`ParameterLedger` + `OutcomeLinker`). `sequence/parallel/conditional/loop/timeout` over existing `DerivationStrategy` primitives; `RetrospectiveAdapter.adaptFromRetrospective` becomes the first composer of retrospective-derived plans. |
| §3 completion: MeTTa proposer + peer-delegation `IProposer` | **ADOPT (Phase E, lightweight)** | `IProposer` seam landed in TODO1 Phase A with `proposers = []` default; a MeTTa voter (confidence 1.0 on exact algebra) is now a small consumer, plus `WeightedQuorum` arbitration as opt-in. |
| Reputation refinement: peer/domain keys + `selectProbes` feed | **ADOPT (Phase E)** | TODO1 flagged: ingress judge uses a single `'system-one'` key; key by LM provider / URL domain / peer id and feed low-reputation sources to probe curriculum (Phase E's deferred slice). |
| AIKR pattern → LM Rule Firing (#2), Distillation Training (#3), Tool Execution (#7) | **DEFER** | Rule firing needs §10's graph to be meaningful; distillation training cadence is dominated by CLI batch economics, not cycle pressure; tool execution is already budget-gated. Revisit when telemetry shows pressure. |
| §1 JudgmentPipeline registry · §2 CognitiveThread · §7 focus tree · §10 LM rule graph · §13 capability ontology | **DEFER** | TODO1 verdict unchanged: speculative generality. §1/§2 need multi-tenant/bleed telemetry; §7/§10/§13 need demonstrated demand. |
| FenwickBag (TODO1 §7 note) | **DEFER** | Caps stay ≤256/128; O(n) scan is fine. Revisit past ~1k. |
| Deprecation sweep | **TRACKED** | `createTickPipeline` alias removal due after 2 minors; `refreshSystemOneContrastive` stays (still mines hard negatives). |

---

## 2. Design Invariants (carry-forward)

I1–I7, N1–N3, C1–C5 from TODO20–25 and TODO1 carry unchanged. Reinforcements:

| # | Invariant | Notes |
|---|---|---|
| C2' | **Query facades are read-only.** `MemoryQuery` (Phase C) and causal traversal (Phase A) never mutate stores; consolidation (Phase B) is the only new write path and stays ledger-recorded. | Extends C2. |
| C6 | **New AIKRProcessors are inert until wired.** Pressure triggers default off; `processIfPressured` is a no-op below threshold; enabling requires an explicit opt-in config key or cycle hook. | Benches 86–89 each assert the inert path. |
| C7 | **Composition algebra is derived, not installed.** Default strategy selection is unchanged; `StrategyExpression` only activates where `RetrospectiveAdapter`/config names one. | Bench 90 asserts byte-identical default. |

---

## 3. Naming & Vocabulary

| Identifier | Kind | Meaning |
|---|---|---|
| `ConsolidationHook` | fn | Cycle-point adapter that calls `nar.consolidateLearning()` at the kernel controller's end-of-cycle (pressure-gated, budget-bounded). |
| `CausalIndex` | class | One-pass episode edge index over `causes/consequences`; serves `getEpisodes({causedBy, leadingTo})`. |
| `EpisodeConsolidator` | class | `AIKRProcessor<Episode, ConsolidationResult>` — bag of episodes, priority = recency × salience × connection count; emits compressed/deduplicated episodes. |
| `ProposalBag` / `MiningBag` | class | `AIKRProcessor` instantiations for `SelfImprovementProposal` (priority = impact × risk-inverse × drive-alignment) and `HardNegativeCandidate` (priority = margin × recency × rubric relevance). |
| `MemoryQuery` / `MemoryResult` | class/type | Cross-memory facade: `{concept?, episodeType?, timeRange?, minPriority?, embedding?, similarityThreshold?}` → merged ranked results from working + episodic + semantic memory. |
| `StrategyExpression` | type | `string \| {op:'sequence'\|'parallel'\|'conditional'\|'loop'\|'timeout', ...}`; `composeStrategy(expr)` → `DerivationStrategy`. |
| `WeightedQuorum` | class | `ArbitrationStrategy` for `Negotiator` (NAL veto stays default). |
| `MettaProposer` | class | `IProposer` wrapping MeTTa exact-computation results (confidence 1.0 on algebraic facts). |
| `SourceKey` | type | Finer reputation keys: `provider:<name>`, `domain:<host>`, `peer:<id>` (replaces single `'system-one'`/`'user'` defaults at ingress/judge seams). |

---

## 4. Phases

### Phase A — Wire the residual machinery + causal traversal (§9)
- **`ConsolidationHook`**: call `nar.consolidateLearning({budget})` from the kernel controller's end-of-cycle (behind `consolidation: {enabled, budget}` config, default on — it is itself pressure-gated and inert, so C1/C6 hold). This is TODO1's #1 follow-up: without it, chain/exemplar bags only drain manually.
- **Causal traversal**: `EpisodicMemory.getEpisodes({causedBy?: id, leadingTo?: id})` via a lazy one-pass `CausalIndex` (invalidated by `clear()`, updated on `log` — same pattern as the Phase D metadata index). `retrospect()` gains a causal-chain summary: "correction → reaction → contrastive update → improved groundedness" using `causes` edges TODO1 Phase D already writes.
- Files: `nar/src/nar.ts` (hook call site), `core/src/agent` (controller wiring), `nar/src/memory/EpisodicMemory.ts`, `util/src/types/episodic-memory.ts` (filter extension), `nar/src/dialogue/retrospect.ts`, `tests/nar/refactor2-residual-causal.test.ts` (NEW, **Bench 86**).
- Bench 86 falsifies: hook drains bags under pressure (decay happens per cycle), inert when disabled/below pressure, `causedBy`/`leadingTo` parity with brute-force scan, foreign-id exclusion, retrospective causal chain renders edges in order.
- Effort: ~1d.

### Phase B — Memory Consolidation as a cognitive process (AIKR pattern #1)
- `EpisodeConsolidator` (`nar/src/memory/episode-consolidator.ts`): episodes admitted with priority = recency × salience (correction/reaction weighting) × connection count (causal edges from Phase A); capacity-bounded; `process({budget, signal})` yields partial consolidation; `consolidateIfPressured` under the Phase A hook; LM path optional with symbolic fallback (dedup/merge by structural similarity only).
- `EpisodicMemory` remains the store; consolidation emits *compressed summaries* as new episodes with `causes` pointing at the merged set — append-only, nothing deleted (I6-style: raw episodes survive; the summary is an index, not a replacement).
- Files: `nar/src/memory/episode-consolidator.ts` (NEW), `nar/src/memory/EpisodicMemory.ts` (admit sink), `nar/src/nar.ts` (hook + config), `tests/nar/refactor2-episode-consolidator.test.ts` (NEW, **Bench 87**).
- Bench 87 falsifies: capacity eviction drops lowest priority, pressure gate, decay forgets stale episodes, `AbortSignal` partial results, symbolic fallback on LM null + exception, determinism under fixed `RandomSource`, summaries carry correct causal edges, raw episodes never deleted.
- Effort: ~1.5d.

### Phase C — Cross-memory query facade (§15)
- `MemoryQuery` (`nar/src/query/memory-query.ts`): read-only facade fanning `{concept?, episodeType?, timeRange?, minPriority?, embedding?, similarityThreshold?}` to `Memory` (concept bags — `queryBySymbol`/`queryByTimeRange` already exist at `memory.ts:415/420`), `EpisodicMemory` (indexed path from TODO1 Phase D), and semantic associations; results merged and ranked (relevance = weighted priority + embedding similarity). One-pass, bounded `limit`.
- Consumers same phase: `retrospect()` uses it for richer session context (semantic activations around dialogue turns); **`OutcomeLinker` gains a sharper outcome surface** — query quality signals by concept/time instead of the reaction-quality proxy (TODO1 opportunity #3); `SchemaInductor` context lookup (concept → related episodes) for chain novelty.
- Files: `nar/src/query/memory-query.ts` (NEW), `nar/src/dialogue/retrospect.ts`, `nar/src/config/parameter-ledger.ts` (outcome surface option), `nar/src/learning/schema-induction.ts` (novelty context), `src/bin/bot.ts` (`.recall <term>` command), `tests/nar/refactor2-memory-query.test.ts` (NEW, **Bench 88**).
- Bench 88 falsifies: fan-out merges all three subsystems, ranking order stable under fixed seed, empty-subsystem tolerance (each optional), `limit` bounds results, read-only (store snapshots unchanged), retrospective + OutcomeLinker consume it.
- Effort: ~1.5d.

### Phase D — Self-Improvement & Hard-Negative bags (AIKR pattern #4, #5)
- `ProposalBag` (`nar/src/meta/proposal-bag.ts`): `SelfImprovementProposal`s admitted with priority = expected impact × risk-inverse × drive-alignment; `ProposalRouter` drains under pressure; superseded proposals decay out. Inert default (arrival-order processing preserved until `proposals: {bounded: true}` opt-in).
- `MiningBag`: `mineHardNegatives` gets a `HardNegativeCandidate` bag (margin × recency × rubric relevance); mining triggers when contradiction pressure rises; feeds `ContrastiveMemory.observeJudgment`'s pending path from TODO1 Phase C.
- Files: `nar/src/meta/proposal-bag.ts` (NEW), `nar/src/reflex` proposal router call site, `nar/src/lm/system-one/hard-negative-mining.ts` (locate actual module), `nar/src/nar.ts` (pressure hook), `tests/nar/refactor2-proposal-mining-bags.test.ts` (NEW, **Bench 89**).
- Bench 89 falsifies: highest-leverage proposal processed first, superseded proposals evicted, inert-by-default parity (arrival order), mining bag skips low-margin candidates under budget, determinism, capacity/decay.
- Effort: ~1.5d.

### Phase E — Strategy composition + consensus/reputation completion (§8, §3 tail, §14 tail)
- **`composeStrategy(expr)`** (`nar/src/reasoning/strategy-algebra.ts`): primitives = existing named strategies; combinators `sequence/parallel/conditional/loop/timeout` (each a thin `DerivationStrategy` wrapper — parallel takes first result, timeout falls back on abort). `RetrospectiveAdapter` may emit `StrategyExpression` in place of a name; `CognitiveController` executes it. Default config = plain name ⇒ byte-identical (C7).
- **`MettaProposer`**: `IProposer` over the MeTTa engine — proposes with confidence 1.0 on exact algebra, abstains otherwise; plus `WeightedQuorum` arbitration strategy (opt-in; default stays NAL veto). If MeTTa and NAL disagree on the same term, emit a `Contradiction` event to `SelfMetaGame` (TODO1's §3 unlocked capability, realized).
- **Reputation keys**: `SystemOneIngressJudge` keys by `provider:<name>` (LM) / `domain:<host>` (source URLs); `.react` keeps `user`; `selectProbes` curriculum prefers low-reputation keys (TODO1 Phase E deferred slice). Persisted in the existing `source-reputation.jsonl`.
- Files: `nar/src/reasoning/strategy-algebra.ts` (NEW), `nar/src/dialogue/consumers/adapt.ts`, `nar/src/cognitive/controller.ts`, `nar/src/reflex/Negotiator.ts` (+`metta-proposer.ts`), `nar/src/kernel/source-reputation.ts` + `KernelPerceptionGate.ts`/`seed.ts` (key granularity), `nar/src/learning/curriculum.ts` (probe feed — locate actual module), `tests/nar/refactor2-strategy-consensus.test.ts` (NEW, **Bench 90**).
- Bench 90 falsifies: each combinator semantics (sequence order, parallel first-result, conditional branch, loop bound, timeout fallback), plain-name parity byte-for-byte, MeTTa proposer abstains off-engine, quorum ≠ veto only when configured, per-key reputation isolation (one provider's contradictions don't move another's ceiling), probe curriculum targets low-reputation keys.
- Effort: ~2.5d.

---

## 5. Out of Scope
❌ §1 JudgmentPipeline registry / §2 CognitiveThread (§1 survey items) — need concurrency telemetry. ❌ §7 focus tree, §10 LM rule graph, §13 capability ontology — no demonstrating consumer. ❌ AIKR pattern on LM rule firing / distillation / tool execution. ❌ FenwickBag. ❌ Any new export without an in-repo consumer (`pnpm exports:audit` gate).

## 6. Risks
| Risk | Mitigation |
|---|---|
| Consolidation hook perturbs cycle timing | Pressure-gated + budget-bounded + opt-out config; Bench 86 asserts inert path; cooperative yield per TODO1 Phase C precedent |
| Episode consolidation discards evidence | Append-only: summaries add, raw episodes never deleted; causal edges preserve provenance |
| `MemoryQuery` becomes a hidden hot path | Bounded `limit`, lazy per-subsystem indexes only (reuse Phase D/TODO1), no fan-out without a filter |
| Proposal/Mining bags reorder behavior silently | Inert-by-default with explicit opt-in; Bench 89 asserts arrival-order parity |
| Strategy algebra miscomposes under abort | Every combinator wraps `AbortSignal`; timeout/parallel fall back to the next branch; Bench 90 abort cases |
| Reputation key granularity fragments the track record | Default keys unchanged (`user`, legacy key as fallback when no finer key derivable); Bench 90 asserts fallback parity |

## 7. Notes for Implementation
- Bench-first per phase; benches continue at 86–90 in the TODO25/TODO1 sequence, one `refactor2-*` file per phase.
- **Phase ordering flexibility**: A → B (B depends on A's hook); C and D are independently landable; E depends only on TODO1 (already landed). If time-boxed, land A alone — it is the single highest-leverage residual.
- Phase B reuses TODO1's `AIKRProcessor` + `SamplingStrategy` verbatim — no new bag mechanics. Same for D.
- Phase C's `OutcomeLinker` surface upgrade should preserve the current reaction-quality proxy as fallback; the ledger format does not change (only which quality signal feeds `improvedOnly`).
- Locate-verify before editing: `hard-negative-mining` and `curriculum` module names are best-guesses from REFACTOR.md prose; grep first (TODO1 had similar naming drift: `mineHardNegatives` lives in the LM/system-one subtree).
- Versioning: new exports = minor (each has an in-repo consumer); no renames planned; no deprecations introduced (the one open one — `createTickPipeline` alias — is on its 2-minor clock).
- After Phase E, `REFACTOR.md` items §3, §5, §6, §8, §9, §11, §12, §14, §15, §20, §22 + the AIKR pattern (2 of 7 targets) are fully adopted; §1/§2/§7/§10/§13 remain deferred pending telemetry — write the deferral evidence into this file's progress section as phases land.
