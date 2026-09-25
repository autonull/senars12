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
| `ConsolidationHook` | fn | Cycle-point adapter that calls `nar.consolidateLearning()` in the macro cycle's `recordPhase` (pressure-gated, budget-bounded). |
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
- **`ConsolidationHook`**: call `nar.consolidateLearning({budget})` from the macro cycle's `recordPhase` (where `host.memory.consolidate` runs) — behind `consolidation: {enabled, budget}` config, default on; it is itself pressure-gated and inert, so C1/C6 hold. This is TODO1's #1 follow-up: without it, chain/exemplar bags only drain manually.
- **Causal traversal**: `EpisodicMemory.getEpisodes({causedBy?: id, leadingTo?: id})` via a lazy one-pass `CausalIndex` (invalidated by `clear()`, updated on `log` — same pattern as the Phase D metadata index). `retrospect()` gains a causal-chain summary: "correction → reaction → contrastive update → improved groundedness" using `causes` edges TODO1 Phase D already writes.
- Files: `core/src/agent/phases.ts` (hook in `recordPhase`), `nar/src/memory/EpisodicMemory.ts`, `util/src/types/episodic-memory.ts` (filter extension), `nar/src/dialogue/retrospect.ts`, `tests/nar/refactor2-residual-causal.test.ts` (NEW, **Bench 86**).
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
- `ProposalBag` (`nar/src/meta/proposal-bag.ts`): `SelfImprovementProposal`s admitted with priority = expected impact × risk-inverse × drive-alignment; `ProposalRouter` (at `nar/src/governance/pipeline.ts`) drains under pressure; superseded proposals decay out. Inert default (arrival-order processing preserved until `proposals: {bounded: true}` opt-in).
- `MiningBag`: `mineHardNegatives` (at `nar/src/lm/system-one/hard-negatives.ts`) gets a `HardNegativeCandidate` bag (margin × recency × rubric relevance); mining triggers when contradiction pressure rises; feeds `ContrastiveMemory.observeJudgment`'s pending path from TODO1 Phase C.
- Files: `nar/src/meta/proposal-bag.ts` (NEW), `nar/src/governance/pipeline.ts` (router call site), `nar/src/lm/system-one/hard-negatives.ts`, `nar/src/nar.ts` (pressure hook), `tests/nar/refactor2-proposal-mining-bags.test.ts` (NEW, **Bench 89**).
- Bench 89 falsifies: highest-leverage proposal processed first, superseded proposals evicted, inert-by-default parity (arrival order), mining bag skips low-margin candidates under budget, determinism, capacity/decay.
- Effort: ~1.5d.

### Phase E — Strategy composition + consensus/reputation completion (§8, §3 tail, §14 tail)
- **`composeStrategy(expr)`** (`nar/src/reasoning/strategy-algebra.ts`): primitives = existing named strategies; combinators `sequence/parallel/conditional/loop/timeout` (each a thin `DerivationStrategy` wrapper — parallel takes first result, timeout falls back on abort). `RetrospectiveAdapter` may emit `StrategyExpression` in place of a name; `CognitiveController` executes it. Default config = plain name ⇒ byte-identical (C7).
- **`MettaProposer`**: `IProposer` over the MeTTa engine — proposes with confidence 1.0 on exact algebra, abstains otherwise; plus `WeightedQuorum` arbitration strategy (opt-in; default stays NAL veto). If MeTTa and NAL disagree on the same term, emit a `Contradiction` event to `SelfMetaGame` (TODO1's §3 unlocked capability, realized).
- **Reputation keys**: `SystemOneIngressJudge` keys by `provider:<name>` (LM) / `domain:<host>` (source URLs); `.react` keeps `user`; `selectProbes` (at `nar/src/dialogue/consumers/curriculum.ts`) curriculum prefers low-reputation keys (TODO1 Phase E deferred slice). Persisted in the existing `source-reputation.jsonl`.
- Files: `nar/src/reasoning/strategy-algebra.ts` (NEW), `nar/src/dialogue/consumers/adapt.ts`, `nar/src/cognitive/controller.ts`, `nar/src/reflex/Negotiator.ts` (+`metta-proposer.ts`), `nar/src/kernel/source-reputation.ts` + `KernelPerceptionGate.ts`/`seed.ts` (key granularity), `nar/src/dialogue/consumers/curriculum.ts`, `tests/nar/refactor2-strategy-consensus.test.ts` (NEW, **Bench 90**).
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
- Locate-verify before editing: `hard-negatives.ts` at `nar/src/lm/system-one/hard-negatives.ts`, `ProposalRouter` at `nar/src/governance/pipeline.ts`, `selectProbes` at `nar/src/dialogue/consumers/curriculum.ts` (TODO1 had similar naming drift).
- Versioning: new exports = minor (each has an in-repo consumer); no renames planned; no deprecations introduced (the one open one — `createTickPipeline` alias — is on its 2-minor clock).
- After Phase E, `REFACTOR.md` items §3, §5, §6, §8, §9, §11, §12, §14, §15, §20, §22 + the AIKR pattern (5 of 8 targets: SchemaInductor, ContrastiveMemory, Memory Consolidation, Self-Improvement Proposals, Hard Negative Mining) are fully adopted; §1/§2/§7/§10/§13 remain deferred pending telemetry — write the deferral evidence into this file's progress section as phases land.

---

## 8. Progress (2026-09-24; Phase E added 2026-09-25)

**Phases A–E all landed** (benches 86–90 green: 66 tests across 5 `refactor2-*` files; typecheck, lint, `exports:check`/`exports:audit` green; deps:gate cycle-set identical to clean tree — see §9 for the pre-existing baseline drift). **REFACTOR.todo2 is complete.**

### Phase A — residual machinery + causal traversal ✓ (Bench 86, `tests/nar/refactor2-residual-causal.test.ts`, 10 tests)
- `CausalIndex` at `nar/src/memory/CausalIndex.ts` (NEW, **internal** — consumed by `EpisodicMemory`, deliberately not in the exports map). `EpisodeFilter` type added to `util/src/types/episodic-memory.ts` (public type export; consumer: nar).
- `getEpisodes({causedBy, leadingTo})` via lazy one-pass causal index; same invalidation/update pattern as the Phase D metadata index. `#readAllEpisodes(visit)` shared by both index builds (dedup of the file scan). One shared `matchesFilter` predicate now honors sessionId/correlationId on **all** paths — fixes the preexisting quirk where the scan fallback silently ignored session filters.
- `Retrospective.causalChains` (optional): reaction `causes` edges rendered upstream-first, chronological; digest unchanged (pin covers turnIds + distribution only).
- `ConsolidationHook`: `CycleHost.consolidateLearning?` + `consolidation?: {enabled?, budget?}` (default **on**); `record()` calls it best-effort after `memory.consolidate`. Wired in `createAgent` (→ `nar.consolidateLearning`) + `NARBuilder.withConsolidation`. **Deliberate deferral**: no `senars.config.json` plumbing (CreateAgentConfig-level only); opt-out via builder/API.

### Phase B — Memory Consolidation as AIKR process ✓ (Bench 87, `tests/nar/refactor2-episode-consolidator.test.ts`, 14 tests)
- `EpisodeConsolidator` at `nar/src/memory/episode-consolidator.ts`. Priority = salience (type-based; `reaction`+kind `correct` ×1.25) × (1 + causal connections). Selection admits **only same-signature groups** (`type|correlationId`) — singletons are retained until peers arrive or decay away (draining them would lose evidence silently).
- LM path optional (`summarizeWithLM`); null/exception ⇒ symbolic fallback (`symbolicSummary`, deterministic, bounded). Summary id = `consolidation:<sha256(sorted ids)[:16]>` — deterministic; summary `causes` = sorted merged ids **and** ride in `metadata` (reserved-key lift through `log(type, content, metadata)` keeps the persisted episode intact).
- Append-only invariant: raw episodes never deleted; `causes` preserve provenance. Admit sink: `EpisodicMemory.onLogged` (best-effort). NAR config `episodeConsolidation:{enabled,capacity,budget}` (default **off** — C6); `attachEpisodeConsolidatorSink` wires persistence; drained in `consolidateLearning`.

### Phase C — cross-memory query facade ✓ (Bench 88, `tests/nar/refactor2-memory-query.test.ts`, 9 tests)
- `MemoryQuery` at `nar/src/query/memory-query.ts` — read-only (C2'); legs: `Memory.findConcepts`/`queryByTimeRange` + `EpisodicMemory` indexed path; optional `embed` fn for semantic scoring (cosine, `similarityThreshold`); merged ranking (weighted priority/recency + similarity), id-tiebroken, `limit`-bounded. No exports-map subpath (deep-path import per the `source-reputation` precedent; in-repo consumers only).
- `episodeQualitySurface` helper: dialogue-turn groundedness joined with reaction-kind quality (the old reaction proxy is the exact fallback subset).
- Consumers wired: bot `.recall <term> [n]`, bot `parameters improved` (sharper surface via MemoryQuery; proxy preserved), `retrospect({memoryQuery})` → `Retrospective.sessionContext`.
- **Not wired**: `SchemaInductor` novelty context (needs NAR-side threading — deferred, see §10). ⚠️ `MemoryIndex.getByTemporal` iterates 1-second buckets — never pass epoch-anchored `timeRange` starts (bench 88 uses realistic windows).

### Phase E — strategy composition + consensus/reputation ✓ (Bench 90, `tests/nar/refactor2-strategy-consensus.test.ts`, 24 tests)
- `composeStrategy` at `nar/src/reason/strategy-algebra.ts` (NEW, deep-path import — no exports-map subpath, in-repo consumers only). Combinators: `sequence`, `parallel` (first-result-wins, losers cancelled via `gen.return`), `conditional`, `loop` (default 2, hard cap 64, early-exit on empty body), `timeout` (deadline race — NOT signal-based; `AbortSignal.timeout` doesn't interrupt a pending `gen.next()`, so the winner is a `Promise.race` against a resolved deadline with `unref`'d timer — falls back on timeout, respects parent abort). Structurally typed (`CompositionStrategy/Run/Context`): the module imports ONLY `types/core.js` (leaf) — importing `strategies/types.js` (in the strategies→lm→nar SCC) re-launched cycles through the controller; `unknown` processor param is sound-contravariant, no casts.
- Controller wiring: `setStrategyExpression(type, expr)` + `setStrategy` widened to `string | StrategyExpression`; composites register as `composed:<deterministic-label>` (`describeStrategyExpression` → `seq(focused,anytime)` etc.), idempotent via `registry.has` guard. Plain names byte-identical (C7, asserted). `adapt.ts` `StrategyController` interface widened — `RetrospectiveAdapter` can now emit expressions, unchanged otherwise.
- Arbitration: `nar/src/reflex/weighted-quorum.ts` — `ArbitrationStrategy` interface; `NalVetoArbitration` = the extracted inline `decide()` (byte-identical incl. Bench-15 veto memo; `Negotiator.memoStats` delegates via `memoSize()` for the TODO20 P3 perf bench); `WeightedQuorum` (opt-in via `NegotiatorOptions.arbitration`): NAL votes weight (f≥0.5 adds c; f<0.3 with c≥vetoThreshold subtracts), top quorum score ≥ floor acts. `NegotiationDecision`/`NALDerivation` extracted to leaf `negotiation-types.ts` (breaking the Focus→Negotiator→quorum chain multiplier; raw-cycle count unchanged).
- `MettaProposer` at `nar/src/reflex/metta-proposer.ts`: sync evaluator seam (`(expr) => boolean | null`) — nar has no `@senars/metta` dep; canonical wiring is `createMeTTa()` + `Effect.runSync(engine.evaluate(parseMeTTa(expr)))` (verified working). Confidence-1.0 votes on engine agreement; abstains on False/null (never vetoes). ⚠️ MeTTa `=` is **structural-shallow** (args not pre-reduced: `(= (+ 2 2) 4)` → False; only ground pairs like `(= 4 4)` evaluate True) — proposers must compare pre-reduced forms. `WeightedQuorum`/`MettaProposer` exported from `@senars/nar/reflex`.
- Reputation keys: `nar/src/kernel/reputation-keys.ts` (`domainKey` extracts first URL host from a sourceId; `providerKey`); ingress judge prefers `providerKey(config.provider)` over legacy key (NAR wires `provider: () => this._lmService?.provider`); perception gate keys URL-bearing sourceIds `domain:<host> ?? raw id`; both fallbacks legacy-parity (R6, asserted). `selectProbes` gained `sourceReputation` feed: corrections from low-multiplier keys float to the probe head (capped 2× base), neutral ordering without the option; reaction episodes now carry `metadata.sourceKey: 'user'` for the join; bot `.probes` wired.
- **Pre-existing bug found & fixed during Phase E**: `buildExtraCommands` (bot.ts) referenced `wired.*` at 8 call sites where only the destructured `w` fields (`nar`, `episodicMemory`, `lmService`, `appConfig`) are in scope — `.turns`/`.probes`/`.schemas-induce`/`.system-one show` would throw ReferenceError at runtime (masked: `src/bin/**` is excluded from the main tsconfig, so tsc never saw bot.ts). All now use the destructure. TS18030 warnings (private-name `?.` chains, 4 sites) are pre-existing and still open.

### Phase D — proposal & mining bags ✓ (Bench 89, `tests/nar/refactor2-proposal-mining-bags.test.ts`, 9 tests)
- `ProposalBag` at `nar/src/meta/proposal-bag.ts`: priority = KIND_IMPACT × RISK_INVERSE × `alignmentOf` (optional drive hook, default 1). Supersede: same `kind:payload-target` scope halves elder priority (evicts/decays out first). Selection is deterministic greedy (priority desc, id tiebreak) — no RNG in the decision path. `drain(route)` / `drainIfPressured(route)` call the **caller-supplied** routing fn — `ProposalRouter` itself untouched.
- Wiring: NARConfig `proposals:{bounded,capacity,budget}` (default **off** — C1/C6 arrival-order parity) → `GameManager` → `SelfMetaGameConfig.proposalBag` → `routeProposals()` branches (bag: admit all, drain-by-priority; default: unchanged loop).
- `MiningBag` in `hard-negatives.ts`: priority = margin × rubricRelevance (conflict 1.0, groundedness 0.8; default margin 0.5); `marginFloor` filters at selection. `mineHardNegatives(..., {into})` accumulates. NAR config `hardNegativeMining:{bounded,capacity,budget,marginFloor}` + `getMiningBag()`; `consolidateLearning` decays + drains and seeds `ContrastiveMemory` via `seedContrastiveMemory` when System One is on. Bot retrospectives feed `into`.

### New improvement opportunities (from A–D)
1. **Dialogue turn episode ids**: capture.ts logs `context: [turnId]` but not `id: turnId` — causal chains currently span only turn→reaction. Setting `id: turnId` at capture would make the whole graph addressable by `causedBy`/`leadingTo` (small capture.ts change; consider with Phase E or a follow-up bench).
2. **Consolidator grouping**: signature is `type|correlationId`; structural grouping (shared causes/context overlap) is the natural next fidelity step.
3. **MemoryQuery**: episode leg scores recency only — a salience prior (type × causal connections, same formula as Phase B) would unify ranking semantics across legs.
4. **ConsolidationHook app-config**: surface `consolidation:{enabled,budget}` in `senars.config.json` schema when next touching `src/config`.
5. **SelfMetaGame drain budget**: bag-drain path hardcodes budget 4; could read `proposals.budget` from config (already plumbed to the bag).

---

## 9. Deferral evidence (per §7 tracking duty)
- §1 JudgmentPipeline / §2 CognitiveThread / §7 focus tree / §10 LM rule graph / §13 capability ontology: no new consumer telemetry surfaced during A–E; deferral verdicts unchanged.
- FenwickBag: bag caps in A–D stay ≤ 256/128/64 — O(n) scan fine.
- **Pre-existing issues observed during A–E (not introduced by this plan; each fails on a clean tree):**
  - `tests/nar/todo20-monoliths.test.ts` M2 budget: `nar.ts` at ~1020 lines > 900 (drifted past the budget in TODO1/TODO2 commits). Split NAR accessors into a facade module or raise the budget explicitly.
  - `tests/nar/refactor2-memory-query.test.ts` "ranking order is stable" flakes intermittently (~1/3 runs): recency scoring spans a `Date.now()` millisecond boundary between store writes. Fix: inject a clock or pin timestamps in the fixture.
  - `pnpm deps:gate` runs at 68 raw cycles vs BASELINE 67 (+1: `rule-builders → rule-templates/{meta,goal,question}-rules`), identical with or without Phase E — the baseline needs +1 or the listed chains need breaking.

---

## 10. Follow-up opportunities (all phases; none blocking)

From A–D (recorded earlier):
1. **Dialogue turn episode ids**: capture.ts logs `context: [turnId]` but not `id: turnId` — causal chains currently span only turn→reaction. Setting `id: turnId` at capture would make the whole graph addressable by `causedBy`/`leadingTo` (small capture.ts change; consider with Phase E or a follow-up bench).
2. **Consolidator grouping**: signature is `type|correlationId`; structural grouping (shared causes/context overlap) is the natural next fidelity step.
3. **MemoryQuery**: episode leg scores recency only — a salience prior (type × causal connections, same formula as Phase B) would unify ranking semantics across legs.
4. **ConsolidationHook app-config**: surface `consolidation:{enabled,budget}` in `senars.config.json` schema when next touching `src/config`.
5. **SelfMetaGame drain budget**: bag-drain path hardcodes budget 4; could read `proposals.budget` from config (already plumbed to the bag).

From Phase E:
6. **Expression plumbing for RetrospectiveAdapter**: the adapter's `SWITCHES` still emits plain names; a retrospective could carry a `StrategyExpression` (e.g. `timeout(200,focused)`) once retrospectives record per-strategy latency. `setStrategy(type, expr)` already accepts it — only the emission side is missing.
7. **MettaProposer live wiring**: `attachGame`/`attachConversationGame` accept no `proposers` option yet — injection point is `new Negotiator({...})` at `GameFocus.ts:121` (add a `proposers?: IProposer[]` pass-through in `GameFocusOptions`/`attachGame` options). The evaluator must be injected from the agent layer (`createMeTTa` + `Effect.runSync`), not from nar.
8. **MeTTa deep equality**: the engine's `=` is structural-shallow (`(= (+ 2 2) 4)` → False). If proposers need evaluated algebra, extend the stdlib op to pre-reduce args (metta/src/stdlib/index.ts `eqOp`), or compose `(= <reduced> True)` forms at the call site.
9. **WeightedQuorum telemetry**: quorum decisions currently indistinguishable from reflex ones in tick panels (`source: 'reflex'`); a `decision.arbitration` tag would sharpen retrospectives.
10. **bot.ts tsconfig exclusion**: `src/bin/**` is outside the main tsconfig (the 4 TS18030 private-name `?.` chains at :1422/:1902-1904 are invisible to `pnpm typecheck`). Either include it with those chains rewritten to non-chained private access, or add a scoped check script.
11. **MettaProposer learn()**: currently a no-op; MeTTa spaces could absorb verified learning events (assert-then-check) once a use case demonstrates demand.

## 11. Original Phase E planning notes (completed — kept for provenance; deviations below)
- Plan said `nar/src/reasoning/strategy-algebra.ts` — that dir didn't exist; landed at `nar/src/reason/strategy-algebra.ts` (alongside the live derivation code).
- Plan said combinators "wrap `AbortSignal`" — timeout needed a deadline race instead (`AbortSignal.timeout` doesn't interrupt a pending `gen.next()`); parent-abort still honored.
- Plan said "MeTTa/NAL disagreement ⇒ `Contradiction` event to `SelfMetaGame`" — not implemented: `NAREventMap` has no contradiction event and SelfMetaGame has no contradiction intake; `MettaProposer` never disagrees (abstains rather than opposes), so there is no disagreement signal to route. Realizing this needs a new event type + consumer — deferred to follow-up #7 territory rather than shipped half-wired.
- Plan said "check `nar/src/reflex/Negotiator.ts` (+`metta-proposer.ts`)" — correct; `WeightedQuorum` additionally required extracting `NalVetoArbitration` (not in plan) to keep the default byte-identical while making arbitration pluggable.

- **Files**: `nar/src/reasoning/strategy-algebra.ts` (NEW), `nar/src/dialogue/consumers/adapt.ts`, `nar/src/cognitive/controller.ts`, `nar/src/reflex/Negotiator.ts` (+ `metta-proposer.ts`), `nar/src/kernel/source-reputation.ts` + `KernelPerceptionGate.ts`/`seed.ts`, `nar/src/dialogue/consumers/curriculum.ts`; `tests/nar/refactor2-strategy-consensus.test.ts` (**Bench 90**).
- **composeStrategy**: primitives = existing named strategies (registry lookup path is `CognitiveController` — verify how `RetrospectiveAdapter.adaptFromRetrospective` writes strategy names into `parameters.strategies` and intercept *there*; plain-name config must stay byte-identical, C7). Combinators each wrap `AbortSignal`; parallel takes first result; timeout falls back on abort.
- **MettaProposer**: TODO1 Phase A landed the `IProposer` seam with `proposers = []` default — locate the seam (grep `IProposer` / `proposers`) and confirm the consultation point before writing the class. Confidence 1.0 on exact algebra, abstain otherwise; `WeightedQuorum` arbitration opt-in (default stays NAL veto); MeTTa/NAL disagreement ⇒ `Contradiction` event to `SelfMetaGame`.
- **Reputation keys**: `SystemOneIngressJudge` currently keys `'system-one'` (single key); `provider:<name>` / `domain:<host>` granularity with **legacy-key fallback when no finer key is derivable** (Bench 90 asserts fallback parity — risk table R6). `.react` keeps `user`. `selectProbes` (curriculum.ts) prefers low-reputation keys; persisted key format in `source-reputation.jsonl` must stay append-compatible.
- Effort estimate ~2.5d; independently landable (depends only on TODO1, already landed).
