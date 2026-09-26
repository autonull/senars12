# REFACTOR.todo5.md

Continuation of REFACTOR.todo4.md. Assumes all TODO4 outcomes are baseline (see §2).

## 0. Philosophy & North Star

The ultimate ideal for SeNARS: a **bounded, auditable, self-improving cognitive runtime** —
truth-maintenance over a time-sliced knowledge graph, bounded by AIKR, with every
selection, derivation, and adaptation provable, replayable, and consistent with the
Knowledge Capability Model (KCM: Competitive. Temporal. Consistency.)

This plan closes the remaining loop: the system must not only *run* cognition but
*describe, budget, and improve* it. Each phase moves a specific dial toward that ideal:

- **A** — hardening foundations (tests, serialization, types)
- **B** — trust & quality foundation (kernel contracts, cycle reduction, one home per strategy type)
- **C** — AIKR resource control made pluggable (Bag strategy, composition, unified budget)
- **D** — structured attention (RuleGraph, FocusTree)
- **E** — self-model & governance (CapabilityOntology, resolver)
- **F** — loop closure (MettaProposer, JudgmentPipeline, CognitiveThread, runtime verification)

## 1. Triage: candidate refactorings (ADOPT/HOLD/DEFER)

| # | ADOPT | Type | Rationale / Seam alignment |
|---|-------|------|---------------------------|
| A1 | Property-test generators: `fc.atomSymbol()` (valid Narsese atoms), `fc.bagState()`, `fc.serializationRoundTrip()` | Correctness | Replaces ad-hoc `fc.string()` + filters; targets state-space corners; single utility, all property suites benefit |
| A2 | JudgmentDataset sidecar collapse: inline 384-d vectors into `Ledger<T>` entries; delete `.vec` files + `vector-sidecar.ts` | Dedup | TODO4 Phase B landed `Ledger<T>`; sidecar is the last bespoke format |
| A3 | Test-only `type` fixes (groundedness gate union in 10 todo16/todo22 suites) | Correctness | Zero runtime delta; unblocks `pnpm typecheck` 0-errors |
| B1 | Kernel contracts: `TermView` (readonly term+truth), `RuleDescriptor` (name, arity, tags), `DerivationRecord` in `kernel/src/` | Cycle reduction | Breaks `reason/strategy.ts` → `../memory`, `../rules`; `strategies/types.ts` → LMRule, Concept, Memory, RuleProcessor, Task. Enables cross-package strategy reuse |
| B2 | Premise-strategy one-home: create `strategies/premise/`, move `reason/premise/*` (formation, sample, index) there; `reason/` keeps reasoner, strategy-algebra, inference-controller | C20 invariant | `CognitiveRegistry` already imports premise strategies from `../reason`; after move, import from `../strategies/premise` |
| B3 | Strategy-algebra unification: move `reason/strategy-algebra.ts` composition logic into `CognitiveRegistry.compose()` (generalize `composePremise`) | Unification | Single composition API for all strategy types |
| B4 | **Genuine PrologResolutionStrategy**: SLD resolution with unification, Horn clause backward chaining, occurs-check, depth-bounded search in `strategies/premise/prolog-resolution.ts` | Prolog unlock | Current `PrologStrategy`/`ResolutionStrategy` are just `samplePremises` wrappers. New strategy implements actual backward chaining: goal → resolve against belief KB → unify → recurse. Registered as `premise` strategy `prolog-resolution`. Enables SeNARS to prove goals via Prolog-style deduction, not just sampling |
| C1 | **Pluggable Bag**: `FenwickBag<T>` as *alternate* `Bag<T>` impl behind `BagOptions.implementation: 'priority' \| 'fenwick'` + `createBag()` factory in `nar/src/bag/` | AIKR unlock | **PriorityBag retained as default.** Default switch requires bench evidence + decision record (C19). `strategies.bag` knob in `CognitiveParameters.strategies` (sibling of sampling/premise/lmRule/attention). FenwickBag must support full `Bag<T>` + `version`/`peek`/`toArray`/`clear` (used by serialization/consumers), all three `EvictStrategy` modes, serialize/restore round-trip. **High-impact targets**: `ContrastiveMemory` (10k+ exemplars, frequent sampling), `HardNegatives` mining bag, `EpisodeConsolidator` chain bag — all currently `PriorityBag` with O(n) sample |
| C2 | Generalized strategy composition: `CognitiveRegistry.compose(type, weights[])` across sampling/premise/derivation/attention/lmRule | Unification | Enables weighted multi-strategy selection in any registry slot without bespoke code |
| C3 | Unified `BudgetSlice` in `kernel/src/budget.ts` flowing gate → thread → focus → bag → derivation | AIKR spine | One budget object; `AIKRBudget`/ThreadScope slices become views. Enables hard accounting, per-thread fairness, budget-aware focus tree |
| D1 | **RuleGraph**: composite `lm-rule` strategy registered in `CognitiveRegistry` — `ConceptGraph`/`Trie`-structured co-activation edges (new `core/src/concept-graph.ts`); fallback edges guarantee non-regression | Attention unlock | Consumes `RLFPLearner` performance rewards; registered as new `lm-rule` strategy or new type `lm-graph` |
| D2 | **FocusTree**: hierarchy over `FocusScheduler`/`FocusBag` (TODO17 A1) with `BudgetSlice` inheritance down the path; per-branch rollups feed domain learner + metaGame | Structured attention | Scheduler samples leaves; tree allocates budgets per branch. Single-root tree must be behaviorally identical to flat scheduling (parity bench) |
| E1 | **CapabilityOntology**: declarative inventory (id, type: tool/rule/metta/skill, schema, costEstimate, prerequisites[]) registering into `CapabilitySpace` (`nar/src/capability/space.ts`) + tool registry | Self-model | NOT a parallel capability system: inventory feeds *existing* sandboxed execution space; consumers: delegation, curriculum probes (`.probes`), self-report |
| E2 | Governance resolver integrated with `governance/pipeline.ts` | Safety | Emits `GovernanceDecision` / `SelfImprovementProposal` (veto/quorum/auto-merge) from `SelfMetaGame` evidence; `.adaptations` audit, `.restore` |
| F1 | **MettaProposer.learn()**: MeTTa rules from `ProofStream` via `PerceptionGate.SELF_METTA`; refactorer inlines them (`metta` tool exists) | Symbolic loop | Closes MeTTa↔NAL arbiter loop on system's own proofs |
| F2 | **JudgmentPipeline spec** composing over `head-specs.ts` HEAD_SPECS (ordered heads + bands + calibrators + router + cascade), versioned pipeline `ModelDigest` | Auditability | HEAD_SPECS already declarative; pipeline adds composition + digest, does not replace the table |
| F3 | **CognitiveThread**: lifecycle (`spawn`/`join`/`kill`) + mailbox + `BudgetSlice` inheritance; `ThreadScope` deprecated alias | Concurrency | Single-thread run byte-identical; enables parallel threads later |
| F4 | Runtime derivation-verification sampling (spot-check with dependency-free `verifyRecord` under budget) | Trust | Cheap in-run checker; complements CI verification |
| H1 | Further MeTTa surface reduction (post-F1) | Dedup | Lower yield after TODO4; revisit when MettaProposer is consumer |
| H2 | `.kiro/legacy-code/` deletion | Dead code | Needs external confirmation of no consumers |
| H3 | Async-generator stream pipeline ↔ middleware adapter (optional) | Architecture | TODO4 recorded stream pipeline as deliberate non-adopter. Optional `StreamPipelineAdapter` wraps `Middleware<CycleContext>` → `AsyncGenerator<Derivation>` for incremental consumers; lands only if a consumer (e.g., live UI, MCP streaming) demands it |
| DEFER | Curriculum generator (capability ontology + focus tree + `.probes` → training task generator) | Capability | Post-TODO5; prerequisites in D/E |

## 2. Baseline (from TODO4 completion — 2026-09-25)

- Zero `TODO|FIXME|XXX` in `src/`/`test/`; `type` in 10 test suites, 0 in `src/` (grep assertion in CI)
- `pnpm typecheck` 0 errors; `pnpm test:all` 100/100 suites, 5107 tests green
- Cycles: `**/*.ts → **/*.ts` 187, zero across `tests/` (TS lint)
- Benches 1–89 green; PARITY GATE: NAR core cycle byte-identical
- ~20% LOC reduction via PrologAction→superclass, SDR internals, shared StrDedup
- Coverage: src 63.28% / 8157, nar/src 75.47% / 7654 (floor `^63.28%`)
- Package.json 100% npm-scripts; grep assertions 100/100 clean
- `serializeBag`/`restoreBag`, `createIsotonicCalibrator`, `WeightedDirectedGraph` public exports
- PARITY; EvidenceLedger; BridgeDatabase; AttentionWorker; `FocusScheduler` (multi-focus weighted sampling, budget allocation, metaGame observation); `SelfMetaGame`; `CapabilitySpace`; `governance/pipeline.ts` (`GovernanceDecision`, `PatchProposal`, `SelfImprovementProposal`); `head-specs.ts` HEAD_SPECS; LMRule 103× verified order-invariant; `PriorityBag` O(n) sample, O(1) add; PriorityHashQueues; GDS `.recall`/`.list`/`.adopt`; `PerceptionGate` .obs/.self/.metta

## 3. Invariants (C11–C18 carried from TODO4; C19–C20 new)

1. **C11 PARITY**: byte-identical single-thread core cycle (default config; unrelated to code path; omits STAMP). If two semantic states are distinguishable, the kernel must know why — or not ship the distinction.
2. **C12**: Everything (LLM, concept, micro-service) bounded via factory + degradation ladder + recovery protocol + defense layering.
3. **C13**: One definition per concept — declarative tables, modular monolith, generic dialects. Tests as *load-bearing verification*.
4. **C14**: Event-sourced replay reducer coverage — pure reducers reconstruct all state; self-generated specs (100% objective space, checker→causality→loop resolver).
5. **C15**: Every new abstraction earns its keep — debt-negative or capability-positive.
6. **C16**: Open-loop → closed-loop; knowledge as E-signal; no static truths, adaptive modulation.
7. **C17**: No regressions in all-round capability, safety, performance.
8. **C18**: Config density 100% — pure API surface.
9. **C19**: **Alternate implementations ship behind the existing seam, never as a fork.** FenwickBag extends `Bag<T>`; PriorityBag is retained as default. A default switch requires bench evidence and an explicit decision record.
10. **C20**: **One home per strategy type.** All strategy implementations live under `strategies/` (premise created there in B2); `reason/` retains reasoner, strategy algebra, inference control.

## 4. Budget: 21 ADOPT refactors / ~12 benches

Metric — "Package count" (baseline 7: nar, core, metta, util, io, kernel, ui): +RuleGraph (D1) and FocusTree (D2) count as **one** net package (they replace bespoke selection code in ≥2 call sites each — C15). Bag implementations must remain exactly two selectable (PriorityBag default, FenwickBag alternate) until a decision record justifies a third. CapabilityOntology + governance resolver + MettaProposer + JudgmentPipeline + CognitiveThread + BudgetSlice each replace ad-hoc logic; budget preserved only if net package count stays ≤ 8 after F3.

## 5. Out of scope

README rewrite; further MeTTa surface reduction (H1, revisit post-F1); `.kiro/legacy-code` deletion (H2); Bag default switch (deferred decision, C19); curriculum generator (DEFER); forcing stream pipeline onto middleware (H3); parallel thread scheduling beyond F3's single-thread parity.

## 6. Risks

| Risk | Mitigation |
|------|------------|
| FenwickBag numerical drift (float accumulation in tree) | Recompute-on-drift guard + statistical parity bench (KS/chi-square vs PriorityBag sampling distribution) |
| FocusTree budget skew vs flat scheduler | Single-root parity test + per-branch rollup validation |
| Governance resolver vetoing too aggressively | Quorum mode default; veto gated by autonomy mode |
| `strategies.bag` config knob | Follow `selectionStrategy`→`strategies.lmRule` deprecation precedent (JSDoc `@deprecated`, 2-minor window) |
| Cycle-count regression from B1 kernel types | Verify 187 → ≤180 at B2 exit; zero new cross-package cycles |
| RuleGraph `ConceptGraph` is new infrastructure | Land as opt-in strategy; parity bench against PrioritySelector; no default enablement |
| PrologResolutionStrategy search explosion | Depth-bounded search + AIKR budget (cycles/depth) + occurs-check; opt-in only; benchmark vs sampling strategies on Horn KB |

## 7. Phases (bench numbers continue from TODO4's 99)

| Phase | Scope | Key Files | Bench | Falsifies |
|-------|-------|-----------|-------|-----------|
| **A** | Hardening: generators, sidecar, test types | `util/test-arbitraries.ts`, `nar/lm/system-one/judgment-dataset.ts`, `tests/nar/todo16*`, `tests/nar/todo22*` | 100 | Property tests generate valid atoms; JudgmentDataset round-trips vectors inline; `typecheck` 0 errors |
| **B** | Kernel contracts + strategy home + composition + Prolog resolution | `kernel/term-view.ts`, `kernel/rule-descriptor.ts`, `kernel/derivation-record.ts`, `strategies/premise/*`, `strategies/premise/prolog-resolution.ts`, `cognitive/registry.ts`, `scripts/deps-gate.ts` | 101 | `deps:gate` ≤ 180; zero premise strategies in `reason/`; `compose(type, weights)` works for all 5 types; `prolog-resolution` proves Horn goals via SLD |
| **C** | Pluggable Bag + BudgetSlice | `nar/bag/Bag.ts` (options + factory), `nar/bag/FenwickBag.ts`, `kernel/budget.ts`, `config/cognitive-parameters.ts`, `memory/concept.ts` | 102 | FenwickBag statistical parity (KS-test); O(log n) sample vs O(n); `strategies.bag` knob selects impl; `version` counter matches PriorityBag semantics; `serializeBag`/`restoreBag` round-trip property test passes; BudgetSlice flows gate→bag |
| **D** | RuleGraph + FocusTree | `core/concept-graph.ts`, `strategies/lm-graph/RuleGraph.ts`, `focus/FocusTree.ts`, `focus/focus-scheduler.ts` | 103 | RuleGraph fallback edges fire on LM failure; FocusTree single-root = flat scheduler; per-branch rollups non-empty |
| **E** | CapabilityOntology + Governance | `capability/ontology.ts`, `governance/pipeline.ts`, `cognition/meta-spec.ts` | 104 | Ontology registers into CapabilitySpace + tools; resolver emits GovernanceDecision; `.adaptations` append-only |
| **F** | MettaProposer + JudgmentPipeline + CognitiveThread + runtime verify | `meta/metta-proposer.ts`, `lm/system-one/judgment-pipeline.ts`, `core/cognitive-thread.ts`, `kernel/verify-derivation.ts` | 105 | MettaProposer emits valid rules; Pipeline digest matches HEAD_SPECS composition; ThreadScope alias parity; verifyRecord samples ≥1/cycle |

## 8. Progress

| # | Phase | Deliverable | Bench | Status |
|---|-------|-------------|-------|--------|
| — | — | Plan revision (corrected seams: `strategies/premise/` creation, `ConceptGraph` new, `GDS`→JudgmentDataset, `RuleMemory`→RLFPLearner, 7 packages, B3 strategy-algebra, C3 BudgetSlice kernel) | — | ✅ |
| A1 | A | Property-test generators: `fc.atomSymbol()`, `fc.bagState()`, `fc.serializationRoundTrip()` in `util/src/test-arbitraries.ts` | 100 | ✅ |
| A2 | A | JudgmentDataset sidecar collapse: inline 384-d vectors into `Ledger<T>` entries; removed `setVectorSidecarPath`, `flushVectors`, `recordVector`, `vecRef`; `record` now stores vectors inline as base64 | 100 | ✅ |
| A3 | A | Test-only `type` fixes: groundedness gate return type changed from `boolean \| { grounded: boolean; score? }` to `{ grounded: boolean; score? }` in `groundedness-gate.ts`, `nar/system-one.ts`, `nar.ts` | 100 | ✅ |
