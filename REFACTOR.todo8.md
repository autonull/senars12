# REFACTOR.todo8.md

Continuation of REFACTOR.todo7.md. All TODO7 phases A–F shipped (benches 112–117). This sprint
converts the accumulated infrastructure into a **coherent whole**: deterministic end-to-end
verification, architectural simplification without capability loss, and a real-world surface
that makes the cognitive runtime usable by non-framework consumers.

## 0. Philosophy & North Star

Same ideal: **bounded, auditable, self-improving cognitive runtime** — truth-maintenance over a
time-sliced knowledge graph, bounded by AIKR, with every selection, derivation, and adaptation
provable, replayable, and consistent with KCM (Competitive. Temporal. Consistency.).

TODO5–7 built and wired the parts. TODO8's discovery: **the parts are not yet a system you can
hand to a user**. Concretely:

- Nothing proves the *whole* loop works end-to-end under deterministic conditions (one e2e
  smoke test exists; the flagship self-improvement loop has never been run end-to-end).
- The assembly layer accreted: a 932-line `NAR` god object, monkey-patched controller hooks,
  four copy-pasted composite classes, three scorer-map tiers, ad-hoc event buses.
- The "manual renames" from TODO6/7 were executed as copies — `cognition/` **and** `game/`,
  `rl/` **and** `rlfp/` all exist. The wrapper/shadow collision class (TODO6 §1.1) is back in
  directory form.
- There is no single coherent API for a real-world consumer: no presets, no session lifecycle,
  no MCP/HTTP surface, no LM-spend accounting.

TODO8 dials (map 1:1 to Phases A–F in §8):

- **A** — **Deterministic scenario harness**: seeded-rng + injected-clock whole-system
  characterization tests; golden scenarios become the parity gate for every later refactor.
- **B** — **Architecture simplification**: facade split, hook-based wiring, composite/scorer
  unification, legacy directory retirement — zero capability delta, golden scenarios green.
- **C** — **Efficiency**: measured hot-path fixes (scorer indexes, inference path unification).
- **D** — **E2E tier completion**: self-improvement loop, parallel cognition, chaos, replay
  parity, property-based full-loop.
- **E** — **Real-world surface**: `createCognitiveAgent()`, session lifecycle, MCP + HTTP,
  presets, streaming subscriptions.
- **F** — **Capability + production**: planning surface, contradiction resolution closure,
  answer provenance, LM-spend budgeting, KernelEvent unification, graph persistence,
  MeTTa validation, API docs.

**Real-world coherence target** (what "done" means for E+F):

```
createCognitiveAgent({ preset: 'assistant' })   // one line
  .teach('(cat --> animal).')                    // belief ingress via perception gate
  .ask('what is a cat?')                         // answer + truth + derivation + reputation
  .act('^search("weather")')                     // tool execution with budget
  .checkpoint() / .resume()                      // session lifecycle incl. strategy stats
  // + MCP server exposing tools/query/status to external LLM clients
  // + HTTP /health /ready /metrics /status for ops
  // + governance-gated self-improvement running inside, fully audited
```

---

## 1. Current-state audit (2026-09-27 codebase review — verified)

| # | Finding | Evidence | TODO8 fix |
|---|---------|----------|-----------|
| 1 | **NAR god object**: 932 lines, ~60 public methods; constructor wires 15+ subsystems inline; `reconfigure()` rebuilds all of `NARExecution` wholesale instead of reconfiguring the inference controller | `nar/src/nar.ts` (129–292, 669–701) | B6 |
| 2 | **Monkey-patched hooks**: `#wireRuleGraphCallbacks` reassigns `this.adapt` and `this.onDerivationCallback` by closure rebinding — fragile, order-dependent, un-stackable | `nar/src/cognitive/controller.ts:177–207` | B3 |
| 3 | **Four near-identical composite classes** (`CompositeSampling`, `CompositeLMRuleSelector`, `CompositeAttentionModel`, `CompositeDerivationStrategy`) differing only in the invoked method; `compose()` switch is four copies of the same bag-weighted pattern | `nar/src/cognitive/registry.ts:71–148, 240–262` | B1 |
| 4 | **Three scorer map tiers** (`PREMISE_SCORERS` / `PREMISE_SCORERS_CURRIED` / `PREMISE_SCORERS_EXTENDED`) with inconsistent shapes; `resolveFilters` special-cases `highConfidence` (the only curried filter) instead of generalizing | `nar/src/strategies/premise/primitives.ts:55–116, 172–189` | B2 |
| 5 | **`step()`/`run()` divergence**: `run()` bypasses `samplingStrategy` (hardcodes `memory.sample(100)`); `step()` hardcodes `sample(...100)` too | `nar/src/reason/inference-controller.ts:64, 110` | C2 |
| 6 | **String-sniffing of semantic state**: drive stimulation keyed on `termStr.includes('test_passed')` / `includes('contradiction')` | `nar/src/nar-execution.ts:266–284` | B4 |
| 7 | **O(n) scorer lookups**: `getLinkStrength` does `links.find(...)` per scored concept; `edgeWeight` calls `getCoActivations(task.term, 20)` *per concept* (quadratic over the scored set) | `nar/src/strategies/premise/primitives.ts:48–53, 62–68` | C1 |
| 8 | **Legacy directory copies**: `nar/src/cognition/` coexists with `nar/src/game/`; `nar/src/rl/` coexists with `nar/src/rlfp/` — the TODO6/7 "manual renames" were done as copies, leaving the exact collision class TODO6 §1.1 killed | `ls nar/src/` | B7 |
| 9 | **Multiple ad-hoc event buses**: BaseComponent `eventBus`, `systemEventBus` (`NarEventBus`), per-game `eventBus`, OTel spans — no taxonomy of which event lives where | `nar.ts:130, 243; games wiring` | B5 |
| 10 | **E2E coverage = one smoke test** (UI websocket delta); no full-loop, self-improvement, parallel, chaos, or replay-parity scenarios | `tests/e2e/production-loop.test.ts` | A, D |
| 11 | **LM calls not spend-accounted**: budget counts `llmCalls` but no cost/quota admission, no per-judgment cost attribution | `kernel/budget.ts` (llmCalls counter only) | F4 |
| 12 | **TODO7 §15 cross-cutting items unfired** (12 items; 5 adopted here, 4 HOLD, rest superseded) | TODO7 §15 | F5–F8 |
| 13 | **Facade sprawl, no coherent consumer API**: `askNaturalLanguage`/`query`/`getSystemOne*` ad-hoc accessors; no presets, no session lifecycle, no MCP/HTTP surface | `nar.ts` public surface | E |
| 14 | **Clock injectability is partial**: bags have `BagOptions.clock` (TODO6 A3) but scenario-level determinism needs NAR-wide clock/rng injection | `nar/src/clock.ts` (exists, narrow) | A1 |
| 15 | **Strategy effectiveness not persisted**: `AdaptiveStrategy` tracks in-memory only; lost on restart (TODO7 15.2) | `nar/src/strategies/premise/selection-strategies.ts` | E2 |
| 16 | **Contradiction event exists but no resolution consumer**: `nar-execution.ts:277` emits `contradiction`; SelfMetaGame subscribes but has no resolution logic | `nar/src/self/ReasoningAboutReasoning.ts` | F2 |

---

## 2. Triage: candidate refactorings (ADOPT/HOLD/DEFER)

| # | ADOPT | Type | Rationale / Seam alignment |
|---|-------|------|---------------------------|
| A1 | **Scenario harness**: `tests/e2e/harness.ts` — builds NAR with seeded rng (`config.rng`), injected bag clocks (`BagOptions.clock` + global `Clock` from `nar/src/clock.ts`), a bus tap recording every typed event, and fixed tick stepping; `runScenario(spec)` returns a normalized trace `{ tasks, derivations, budgetEvents, adaptations, stateHash }` | Testing infra | C27 foundation; the harness is the only new "component" — it replaces zero runtime code |
| A2 | **Golden characterization scenarios (Tier 1)**: 5 scenarios pinned as golden traces — (i) belief→derivation→`ask()` answer, (ii) goal→tool→feedback, (iii) contradiction→drive→adaptation, (iv) question→prolog-resolution proof, (v) LM-rule fire with fallback path. Stored as JSON snapshots; any diff is a reviewable behavior change | Testing infra | C11 extended from core cycle to whole-system; B-phase refactors must keep goldens byte-identical |
| A3 | **Determinism gate in CI**: scenario suite runs twice per PR, traces must be identical; quarantine protocol for CI-timing flakes (soak precedent) | Testing infra | Makes C27 enforceable, not aspirational |
| B1 | **One generic composite**: replace the four `Composite*` classes with a single `BagComposite<T>(items, weights, invoke: (T, ...args) => R)`; `CognitiveRegistry.compose()` switch collapses to a `Record<StrategyType, invoke-adapter>` map. Zero behavior delta (same PriorityBag, same weights) | Dedup | C13/C15: one definition; 4 classes → 1, −~70 LOC |
| B2 | **Premise registry consolidation**: merge the three scorer tiers into one `PREMISE_REGISTRY: Record<string, { make(memory): Scorer }>` (currying normalized); generalize filters the same way (`CURRIED_FILTER_DEFAULTS` special case dies). Named configs unchanged → parity anchor `default-formation` byte-identical | Dedup | TODO7 A-phase's taxonomy becomes actually uniform; N1's class of orphan shrinks to zero |
| B3 | **Explicit lifecycle hooks in CognitiveController**: `onAdapt(fn)`, `onDerivation(fn)` arrays; `#wireRuleGraphCallbacks` becomes `controller.onAdapt(...)` + `onDerivation(...)` registrations. Multiple subscribers compose in registration order | Architecture | Kills monkey-patching; RuleGraph wiring becomes one subscriber among many (e.g. telemetry can subscribe too) |
| B4 | **Typed task classification**: replace substring sniffing with a `classifyTask(term): TaskSignal[]` taxonomy (`test-passed`, `test-failed`, `contradiction`, `schema-promoted`, `capability-added`, …) driven by term kind/atom identity; NARExecution consumes signals | Correctness | C28: semantic decisions must not depend on substring luck (`'contradiction'` inside an unrelated atom currently fires the drive) |
| B5 | **Event bus taxonomy**: one `NarEventBus` with typed channels (`kernel:*`, `cognition:*`, `ui:*`); per-game buses and the BaseComponent bus become scoped emitters on the single bus; OTel subscribes rather than wraps ad hoc. Default-cycle emitters untouched until parity-verified | Architecture | C29; prerequisite for F5 (KernelEvent union) and clean D-tier tracing |
| B6 | **NAR facade split + NarAssembly**: constructor wiring moves to `nar/src/nar-assembly.ts` with ordered phases (memory → gates → system-one → execution → games → optional features); `NAR` retains orchestration + facade methods grouped behind 4 sub-facades (`systemOne`, `games`, `learning`, `io`). `reconfigure()` reconfigures `InferenceController` instead of rebuilding `NARExecution` | Architecture | C15: assembly is parameterized, testable, reusable by the harness (A1) and presets (E5) |
| B7 | **Legacy directory retirement**: audit consumers of `nar/src/cognition/*` and `nar/src/rl/*`; migrate stragglers to `game/`/`rlfp/`; delete both legacy dirs. Gate: `exports:audit` proves no external consumer; semver major if any exist | Dedup | C20 one-home rule at directory granularity; finishes the TODO6/7 rename debt |
| C1 | **Scorer lookup indexes**: `LinkManager.getLinkPriority(from, to)` (map lookup, O(1)); ConceptGraph adjacency snapshot per task (`getCoActivations` once, shared across scored concepts). `getLinkStrength`/`edgeWeight` rewritten on top. Parity bench: identical selections | Perf | Removes the O(n·m) premise-scoring quadratic; benefits every cycle |
| C2 | **InferenceController path unification**: `run()` consumes `samplingStrategy` (deleting the hardcoded `memory.sample(100)`); `step()`'s sample count from config. Golden anchor: default-config cycle byte-identical (currently `run()` is the divergent path — verify which is default and pin it) | Correctness | One reasoning path, not two silently different ones (C13) |
| C3 | **Measured hot-path audit + targeted fixes**: profile one golden scenario (flamegraph via `--cpu-prof`); adopt only fixes with ≥5% cycle-time win and golden parity. Candidates: BudgetSlice allocation churn, embedding-index incremental insert (15.3-adjacent), `rankDerivations` comparator allocation | Perf | C15: no speculative optimization; ADR records measurements |
| D1 | **Tier 2 — self-improvement loop scenario**: repeated derivation patterns → `ProofMettaProposer.learnFromDerivation` → `metta` tool rewrite → `GovernanceResolver` auto-apply → `CapabilityOntology` registers with provenance chain → learned rule fires in a later cycle and changes selection. The flagship end-to-end TODO7 §5.2 never ran | E2E | C24 at system scale; proves the north-star loop actually closes |
| D2 | **Tier 3 — parallel cognition scenario**: multi-root FocusTree + CognitiveThreads driving concurrent cycles with hard budget inheritance; invariant checks: Σ(child) ≤ parent, no derivation lost vs single-thread baseline (or documented delta), mailbox backpressure under load | E2E | TODO6 D1–D4 tested the components in isolation; this tests them *in the loop* |
| D3 | **Tier 4 — chaos scenarios**: (i) LM outage → circuit breaker → fallback model → degraded-but-alive; (ii) gate-rejection storm → backpressure, bounded queues, no unbounded accumulators; (iii) memory pressure → eviction/consolidation with ledger reconciliation (no silent task loss) | E2E | C12 verification at system level; falsifies "degradation ladder exists" claims |
| D4 | **Tier 5 — replay parity scenario**: run a golden scenario → checkpoint → `pnpm replay --from/--to --verify` against a fresh NAR → state hash (incl. memory, C25) matches; compacted-log variant included | E2E | C14/C25 verified against real sessions, not synthetic logs |
| D5 | **Property-based full-loop**: fast-check generators for task streams → run harness → bounded invariants hold (no crash, budget conservation, admission monotonicity, memory ≤ maxConcepts, determinism under reseed) | E2E | TODO5 A1 generators meet the full system |
| E1 | **`createCognitiveAgent()`**: high-level API in `core/src/agent` — `teach/ask/goal/act/observe` + event subscription; wraps NAR assembly (B6) with session scoping; typed `Answer { term, truth, derivation, reputation, calibration }` envelope | Usability | The single entry point real consumers use; NAR stays the power-user API |
| E2 | **Session lifecycle**: `session.checkpoint()/resume()/inspect()` over StatePersister + replay snapshots; resume hydrates memory, strategy stats (`AdaptiveStrategy` — TODO7 15.2), ontology, governance ledger | Usability | Long-running real-world use requires restart-with-memory; 15.2 gets its consumer |
| E3 | **MCP server** (`io/src/mcp/`): expose `query`, `teach`, `tools/list+call`, `status` via Model Context Protocol; stdio + streamable-http transports | Integration | External LLM clients (Claude, etc.) use SeNARS as a tool server — the cheapest real-world integration with existing ecosystem |
| E4 | **HTTP control plane** (`io/src/http/`): `/health`, `/ready` (subsystem readiness), `/metrics` (Prometheus from MetricsCollector), `/status --budget` equivalent, `/events` (SSE of `cognitive:*`) | Operations | Real deployments need liveness/readiness; SSE gives D4 streaming a standard consumer |
| E5 | **Presets + config validation**: named presets (`qa`, `chat`, `agent`, `researcher`) as `CognitiveParameters` deltas; combination validation at assembly with migration-hint errors; config version field with `v1→v2` migration table | Usability | C18 density: knobs exist but no safe starting points; presets are the curated defaults |
| E6 | **Streaming cognition subscription** (closes TODO4 H3): `StreamPipelineAdapter` wraps middleware → `AsyncGenerator<Derivation>`; `agent.stream()` subscribes with backpressure + unsubscribe; consumed by E4 SSE and E3 MCP progress notifications | Integration | H3 finally has its live consumers |
| F1 | **Planning surface**: goal decomposition via existing `decomposition` strategy + `prolog-resolution` plan validation; produces ordered subgoal tasks with derivation lineage; depth/breadth bounded (AIKR), executed via `toolGoalExecutor` | Capability | Real-world agents need multi-step goals; builds only on existing strategies — no new planner engine |
| F2 | **Contradiction resolution closure**: `contradicts()` detection + `contradiction` event exist; add resolution strategies (evidence-weighted via `SourceReputation`, revision, or externalize-as-question) wired to the SelfMetaGame consumer; drive stimulation consumes B4 signals | Capability | Closes the last open-loop contradiction path (C16) |
| F3 | **Answer provenance envelope**: unify `ask()/queryTerm()/explain()` outputs into `Answer { conclusion, truth, derivation, reputation, calibration }`; derivation + source reputation mandatory on every answer | Auditability | Trust surface: every answer is provable (north star) without new computation — reuses existing trace API |
| F4 | **LM-spend budgeting**: extend `BudgetSlice`/gates with cost dimension (tokens/USD estimate per call); admission consults spend budget like memory ops; per-judgment cost attribution in metrics | Bound | C30: LM spend is the least-bounded resource today; AIKR must govern it |
| F5 | **KernelEvent unification** (TODO7 15.1 + 15.6 + 15.10): single `KernelEvent` discriminated union; replay, OTel spans, and E4 SSE consume one type; thread messages carry trace context; `TickContext` records per-phase budget allocations | Architecture | B5's taxonomy made concrete; kills the `CognitiveEvent`/`GateEvent`/`DerivationRecord` overlap |
| F6 | **ConceptGraph persistence** (TODO7 15.3): Ledger-backed co-activation edges; RuleGraph hydrates on init (no cold start) | Durability | Learned attention survives restart — self-improvement that evaporates on reboot is not capability |
| F7 | **MeTTa rule validation** (TODO7 15.5): grammar validation at `ProofMettaProposer.addRule`; malformed patterns rejected + logged | Safety | Malformed learned rules crashing the `metta` tool is a self-improvement footgun |
| F8 | **API docs generation** (TODO7 15.12): `scripts/generate-api.ts` extracts JSDoc + signatures from the exports map → `docs/api/`; `exports:check` ↔ docs consistency assertion | DX | The exports map is the source of truth; docs stop drifting |

| # | HOLD | Reason |
|---|------|--------|
| H1 | MeTTa surface reduction | Re-evaluate after D1 proves the proposer loop at scale |
| H2 | `.kiro/legacy-code/` deletion | External confirmation still pending (carried TODO5 H2) |
| H3 | Interface extraction for cycle reduction | Carried TODO6 H4; re-triage after B-phase with fresh dpdm numbers |
| H4 | Governance policy-as-code (TODO7 15.4) | YAML policy adds a config surface before presets (E5) stabilize the knobs it would drive |
| H5 | Event-log compaction (TODO7 15.7) | Adopt when D4/soak shows disk pressure; replay parity (D4) must exist first |
| H6 | Dynamic knob discovery (TODO7 15.8) | Build-time codegen; revisit after E5 presets freeze the knob vocabulary |
| H7 | Memory pressure gradient (TODO7 15.9) | Speculative API; adopt only if C3 profiling shows consolidation timing matters |
| H8 | Derivation proof objects (TODO7 15.11) | Large; F3's provenance envelope delivers most of the trust value first |

| # | DEFER | Reason |
|---|-------|--------|
| X1 | Curriculum generator | Prerequisites now exist (ontology, focus tree, harness) but D-phase evidence should drive its design; revisit post-D1 |
| X2 | Distributed CognitiveThread (IPC/cluster) | After D2 proves in-process parallel cognition |
| X3 | Temporal reasoning operators in the Narsese dialect | Grammar + semantics change is a major undertaking; temporal queries via F3 envelope first |
| X4 | Multi-agent coordination | Single-agent coherence first (E-phase) |
| X5 | Memory-graph UI visualization | E4 SSE provides the data; UI after the surface stabilizes |

---

## 3. Baseline (from TODO7 completion — 2026-09-27)

- 2308 tests pass (unit + premise + rulegraph + capability + replay + bag-perf + governance + core); typecheck + lint clean
- `deps:gate` 25 cycles (baseline 25; dpdm `--transform` for type edges; 2 ConnectionBinder cycles removed via deep subpaths)
- `exports:check` + `exports:audit` pass; benches 1–117 green; PARITY: `default-formation` byte-identical
- Premise primitives complete (`concepts` source, `linear` scorer w/ embeddings); RuleGraph keyed on real terms (`LMRule.condition`)
- Replay hashes canonicalized Memory state; `--from-id/--to-id` identity ranges
- Provenance chains (`derivationChain`/`parentId`) validated on register; Metta↔NAL loop via `consolidateLearning()`; `applySchemaPatch` actuator
- TODO7 §15.1–15.12 recorded as future work (5 adopted here as F5–F8 + E2, 4 HOLD, 3 superseded)

---

## 4. Invariants (C11–C26 carried; C27–C31 new)

1. **C11 PARITY**: byte-identical single-thread core cycle (default config; omits STAMP)
2. **C12**: Everything bounded via factory + degradation ladder + recovery + defense layering
3. **C13**: One definition per concept
4. **C14**: Event-sourced replay reducer coverage — pure reducers reconstruct all state (incl. Memory)
5. **C15**: Every new abstraction earns its keep — debt-negative or capability-positive
6. **C16**: Open-loop → closed-loop; knowledge as E-signal; adaptive modulation
7. **C17**: No regressions — including silent degradation
8. **C18**: Config density 100% — a knob with no consumer is a defect
9. **C19**: Alternate implementations behind the existing seam; default switch requires bench evidence + ADR
10. **C20**: One home per strategy type — all under `strategies/` (and one directory per concept-home: B7)
11. **C21**: Cycle budget non-increasing — deps-gate baseline only decreases or is justified + recorded
12. **C22**: AIKR observability — every budget slice, pressure signal, backpressure decision measurable
13. **C23**: Governance-gated self-modification — no capability/schema/strategy change bypasses the resolver
14. **C24**: No orphan deliverables — every ADOPT item ships with ≥1 falsifying test **and** ≥1 wired consumer
15. **C25**: Replay verification covers Memory state
16. **C26**: RuleGraph co-activations key on real terms
17. **C27**: **Whole-system determinism** — scenarios under seeded rng + injected clocks are byte-identical across runs and machines (extends C11 from the core cycle to the full system)
18. **C28**: **No substring-sniffing of semantic state** — task/drive classification is typed taxonomy, not string matching
19. **C29**: **One bus taxonomy** — every emitted event has exactly one typed channel home; no ad-hoc parallel buses
20. **C30**: **LM spend is AIKR-accounted** — LM calls are bounded, admitted, and attributed like memory ops
21. **C31**: **Golden-scenario gate** — B/C-phase refactorings may not change golden scenario traces; any delta is a reviewed, explicitly-accepted behavior change

---

## 5. Budget: 32 ADOPT refactors / 6 benches

Metric — package count (baseline 7): **net zero** (harness, assembly, MCP/HTTP live in existing
homes: `tests/e2e/`, `nar/src/`, `io/src/`, `core/src/agent`). New benches continue from 117:
118 (scorer index perf), 119 (inference unification parity), 120 (self-improvement loop), 121
(parallel cognition), 122 (chaos), 123 (replay parity).

## 6. Out of scope

Manual WebStorm renames (B7 covers the *code* completion; remaining path renames stay manual);
temporal dialect operators (X3); policy-as-code (H4); event compaction (H5); knob manifest (H6);
pressure gradient (H7); proof objects (H8); curriculum generator (X1); distributed threads (X2);
multi-agent (X4); UI visualization (X5); README rewrite.

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| Golden traces flake on CI (timers, GC jitter) | A3 determinism gate + quarantine protocol (soak precedent); virtualize every clock (bags already accept `clock`; harness injects global `Clock`) |
| B5 bus unification changes event timing → C11 regression | Default-cycle emitters migrate last, behind parity bench; non-cycle emitters first |
| B6 facade split churns the public surface | Exports audit before/after; sub-facades are additive (minor semver); `NAR` methods retained as deprecated 2-minor aliases where renamed |
| B7 legacy-dir deletion breaks external consumers | `exports:audit` gate proves no external consumer; if one exists → semver major with deprecation window |
| C2 unification changes which path is default | Pin current default behavior first (golden trace), then unify toward it — not the reverse |
| D1 self-improvement loop is nondeterministic (LM-dependent) | Harness injects a deterministic LMService stub for the learning loop; real-LM variant marked `@load-sensitive` |
| D2 parallel tier: threading exposes real races | Budget invariants asserted per-cycle; races become falsifying tests, not flakes |
| D3 chaos tests destabilize CI | Chaos suites tagged `@chaos`, run nightly + pre-release, not per-PR |
| E3 MCP scope creep | Minimal surface first (`query/teach/tools/status`); streaming progress later via E6 |
| F1 planning explosion | Depth/breadth bounded via AIKR budget (prolog-resolution precedent); plan tasks carry lineage for audit |
| F4 cost estimation is provider-specific | Config-supplied cost table per provider; unknown → conservative estimate + warn |
| F5 KernelEvent union ripples across consumers | B5 taxonomy first, then union behind adapter; consumers migrate incrementally |

---

## 8. Phases (bench numbers continue from TODO7's 117)

| Phase | Scope | Key Files | Bench | Falsifies |
|-------|-------|-----------|-------|-----------|
| **A** | Harness + golden characterization + determinism gate | `tests/e2e/harness.ts`, `tests/e2e/scenarios/*.scenario.ts`, `nar/src/clock.ts`, `vitest.config.ts` | 118 | 5 golden traces byte-identical on double-run; harness reuses NAR assembly, no runtime code touched |
| **B** | Simplification: composite unification, premise registry, hooks, typed signals, bus taxonomy, assembly, legacy retirement | `cognitive/registry.ts`, `strategies/premise/primitives.ts`, `cognitive/controller.ts`, `nar-execution.ts`, `types/events.ts`, `nar-assembly.ts`, `nar/src/cognition` + `rl` (delete) | 119 | Goldens unchanged; monkey-patch gone (hooks testable independently); substring sniffing impossible (C28 lint-grep); legacy dirs gone with `exports:audit` green |
| **C** | Efficiency: scorer indexes, inference path unification, measured hot-path fixes | `strategies/premise/primitives.ts`, `memory/links/LinkManager.ts`, `reason/inference-controller.ts`, `tests/benchmark/scorer-perf.test.ts` | 119 | O(1) link lookup (bench), selection parity identical; one reasoning path; profiled fixes each ≥5% or rejected with ADR record |
| **D** | E2E tiers: self-improvement, parallel, chaos, replay parity, property loop | `tests/e2e/scenarios/self-improvement.ts`, `parallel.ts`, `chaos/*.ts`, `replay-parity.ts`, `property-loop.test.ts` | 120–123 | Tier 2–5 scenarios green under determinism gate; budget invariants asserted; replay hash matches incl. memory |
| **E** | Real-world surface: agent API, sessions, MCP, HTTP, presets, streaming | `core/src/agent/`, `io/src/mcp/`, `io/src/http/`, `config/presets.ts`, `stream/StreamPipelineAdapter.ts` | (consumed by D-tier scenarios as consumers) | Every preset runs its Tier-1 scenario; MCP client smoke test; `/ready` reflects real subsystem state; resume restores memory + stats + ontology |
| **F** | Capability + production: planning, contradiction closure, provenance envelope, LM spend, KernelEvent union, graph persistence, MeTTa validation, API docs | `strategies/planning/`, `cognitive/contradiction.ts`, `query/answer.ts`, `kernel/budget.ts`, `kernel/schemas.ts`, `strategies/lm-graph/*`, `meta/metta-proposer.ts`, `scripts/generate-api.ts` | 123 | Plan decomposes + executes via tools with lineage; contradiction resolves via reputation-weighted revision; every `Answer` carries derivation+reputation; LM over-spend admits 0; restart hydrates RuleGraph |

Order: **A → B → C** strict (goldens must exist before any refactor; B before C so perf fixes land
on simplified code). **D** interleaves after B (Tier 2–5 need harness + simplified assembly).
**E/F** after C. E and F interleave freely.

---

## 9. Progress

| # | Phase | Deliverable | Falsifier | Status |
|---|-------|-------------|-----------|--------|
| A1 | A | Scenario harness: `runScenario(spec)` with seeded rng, injected clocks, bus tap, normalized trace | Goldens byte-identical on double-run | ✅ |
| A2 | A | 5 golden characterization scenarios (Tier 1) | Snapshots stored; any diff reviewable | ✅ |
| A3 | A | Determinism gate in CI (double-run + quarantine) | CI green on identical traces | ✅ |
| B1 | B | Single `BagComposite<T>` replaces 4 `Composite*` classes | Registry.compose switch → adapter map; goldens green | ⬜ |
| B2 | B | Premise registry consolidation: 3 scorer tiers → 1 `PREMISE_REGISTRY` | Named configs byte-identical; `default-formation` parity | ⬜ |
| B7 | B | Legacy dirs `cognition/` + `rl/` deleted post `exports:audit` | No external consumers; dirs gone | ⬜ |
| B1 | B | Single `BagComposite<T>` replaces 4 `Composite*` classes | Registry.compose switch → adapter map; goldens green | ⬜ |
| B2 | B | Premise registry consolidation: 3 scorer tiers → 1 `PREMISE_REGISTRY` | Named configs byte-identical; `default-formation` parity | ⬜ |
| B3 | B | Explicit lifecycle hooks: `onAdapt`/`onDerivation` arrays in CognitiveController | Monkey-patch removed; RuleGraph wires via hooks | ⬜ |
| B4 | B | Typed `classifyTask(term): TaskSignal[]` replaces substring sniffing | C28 lint-grep clean; drive stimulation via signals | ⬜ |
| B5 | B | Event bus taxonomy: `NarEventBus` with `kernel:*`/`cognition:*`/`ui:*` channels | Single bus; per-game emitters become scoped | ⬜ |
| B6 | B | `NarAssembly` + 4 sub-facades (`systemOne`, `games`, `learning`, `io`) | `reconfigure()` reconfigures InferenceController only | ⬜ |
| B7 | B | Legacy dirs `cognition/` + `rl/` deleted post `exports:audit` | No external consumers; dirs gone | ⬜ |
| C1 | C | `LinkManager.getLinkPriority(from,to)` O(1); ConceptGraph adjacency snapshot per task | Bench: O(1) lookup; selection parity identical | ⬜ |
| C2 | C | InferenceController path unification: `run()` uses `samplingStrategy` | One reasoning path; default cycle parity | ⬜ |
| C3 | C | Measured hot-path fixes (BudgetSlice churn, embedding incremental, rankDerivations) | Flamegraph deltas ≥5% or ADR rejection | ⬜ |
| D1 | D | Tier 2: self-improvement loop end-to-end (derivation → MeTTa → governance → capability fires) | Learned rule changes selection in later cycle | ⬜ |
| D2 | D | Tier 3: multi-root FocusTree + CognitiveThreads in-loop | Σ(child)≤parent; no lost derivations vs baseline | ⬜ |
| D3 | D | Tier 4: chaos (LM outage, gate storm, memory pressure) | Degradation ladder verified; no silent loss | ⬜ |
| D4 | D | Tier 5: replay parity (checkpoint → verify hash incl. memory) | State hash matches; compacted-log variant | ⬜ |
| D5 | D | Property-based full-loop (fast-check task streams) | Invariants hold: budget, admission, memory, determinism | ⬜ |
| E1 | E | `createCognitiveAgent()` with `teach/ask/goal/act/observe` + `Answer` envelope | Tier-1 scenario per preset | ⬜ |
| E2 | E | Session `checkpoint/resume/inspect` hydrating memory + strategy stats + ontology | Resume restores AdaptiveStrategy preferences | ⬜ |
| E3 | E | MCP server (`query/teach/tools/status`) stdio + streamable-http | External client smoke test | ⬜ |
| E4 | E | HTTP control plane (`/health`, `/ready`, `/metrics`, `/events` SSE) | `/ready` reflects subsystem state | ⬜ |
| E5 | E | Presets (`qa`/`chat`/`agent`/`researcher`) as `CognitiveParameters` deltas + validation | Each preset runs Tier-1 scenario | ⬜ |
| E6 | E | `StreamPipelineAdapter` + `agent.stream()` with backpressure | Consumed by E4 SSE + E3 MCP | ⬜ |
| F1 | F | Planning surface via `decomposition` + `prolog-resolution` (no new engine) | Multi-step goal → ordered subgoals with lineage | ⬜ |
| F2 | F | Contradiction resolution via `SourceReputation` + revision + externalize | Contradiction event → resolution recorded | ⬜ |
| F3 | F | `Answer` envelope unifies `ask/query/explain` with derivation+reputation | Every answer carries proof | ⬜ |
| F4 | F | LM-spend budgeting in `BudgetSlice` + gates | Over-spend admits 0; per-judgment cost in metrics | ⬜ |
| F5 | F | `KernelEvent` discriminated union consumed by replay/OTel/SSE | `CognitiveEvent`/`GateEvent`/`DerivationRecord` removed | ⬜ |
| F6 | F | ConceptGraph ledger-backed persistence; RuleGraph hydrates on init | Restart → immediate co-activation use | ⬜ |
| F7 | F | MeTTa grammar validation at `ProofMettaProposer.addRule` | Malformed rejected + logged | ⬜ |
| F8 | F | `scripts/generate-api.ts` → `docs/api/`; `exports:check` ↔ docs consistency | Generated docs match actual exports | ⬜ |

---

## 10. Architecture Decision Records (planned)

| ADR | Trigger | Status |
|-----|---------|--------|
| ADR-017 | Golden-scenario characterization as the system parity gate (A) | Planned |
| ADR-018 | Event bus taxonomy + KernelEvent union (B5/F5) | Planned |
| ADR-019 | NAR assembly + facade split (B6) | Planned |
| ADR-020 | Cognitive agent surface + presets (E1/E5) | Planned |
| ADR-021 | LM-spend budgeting model (F4) | Planned |

---

## 11. Notes for remaining work

- **The harness is the deliverable that de-risks everything else.** Every later item is falsified
  against golden traces; refactor review becomes "goldens unchanged?" instead of manual reasoning.
- **B7 is the last of the TODO6 rename debt.** Both `cognition/` and `rl/` legacy copies must be
  proven consumer-free via `exports:audit` before deletion; if external consumers exist, apply the
  2-minor deprecation lifecycle, not immediate deletion.
- **C2 must pin-then-unify**: determine which of `step()`/`run()` the default cycle actually
  exercises, capture its golden trace, then make the other path match it. Never unify toward a
  new behavior silently (C31).
- **Presets (E5) are curated defaults, not new config axes.** Each preset must be expressible as
  a `CognitiveParameters` delta; a preset requiring new knobs is a design smell (C18).
- **MCP (E3) is the highest-leverage integration**: existing LLM clients gain SeNARS cognition
  with zero client-side code. Keep the tool surface minimal and typed.
- **F1 planning builds on `decomposition` + `prolog-resolution`** — no new planner engine. If
  those two strategies cannot express a plan, record the gap rather than growing a bespoke planner.
- **LM stub in D1**: the learning loop must be deterministic; real-LM runs are separate
  `@load-sensitive` variants, never the CI gate.
- **Strategy effectiveness persistence (TODO7 15.2 → E2)**: `AdaptiveStrategy` hydrates on session resume; `ParameterLedger` is the backing store.
- **Contradiction resolution (F2)** uses the `contradiction` event from `nar-execution.ts:277` and the `SourceReputation` ledger — both exist, just need the resolution strategy + SelfMetaGame wiring.
- **Cross-cutting 15.1–15.12 mapping**: 15.1+15.6+15.10→F5, 15.2→E2, 15.3→F6, 15.4→H4, 15.5→F7, 15.7→H5, 15.8→H6, 15.9→H7, 15.11→H8, 15.12→F8.

## 12. Progress Log (2026-09-27)

### Phase A Complete ✅
- **A1**: Created `tests/e2e/harness.ts` — `ScenarioHarness` class with:
  - Seeded LCG RNG (`SeededRNG` from `nar/src/game/SeededRNG.ts`)
  - Injected clock (`Clock` interface from `nar/src/clock.ts` with `fixedClock`/`SystemClock`)
  - Bus tap on `NarEventBus` recording all typed events with cycle timestamps
  - Normalized trace output: `{ tasks, derivations, budgetEvents, adaptations, events, stateHash, cycleCount }`
  - `runScenario(spec)` helper for one-liner scenario execution

- **A2**: Created 5 golden Tier-1 characterization scenarios in `tests/e2e/scenarios/`:
  1. `belief-derivation-ask.scenario.ts` — belief input → derivation → question answer
  2. `goal-tool-feedback.scenario.ts` — goal → tool execution → feedback
  3. `contradiction-drive-adaptation.scenario.ts` — contradiction → drive stimulation → adaptation
  4. `question-prolog-resolution.scenario.ts` — question → prolog-resolution proof
  5. `lm-rule-fallback.scenario.ts` — LM rule fire with fallback path (no LM service)
  All scenarios use valid NAL syntax, deterministic seeds, and minimal assertions.

- **A3**: Created `tests/e2e/determinism-gate.test.ts` with:
  - Double-run verification (2 runs per scenario, byte-identical `stateHash` required)
  - Quarantine protocol test for flake identification
  - Added `pnpm test:determinism` script for CI integration
  - All 5 scenarios pass determinism gate (10/10 tests green)

### Duplication Audit Complete (2026-09-27)
Confirmed plan's duplication targets are correct and complete:

| Target | Location | Pattern | Status |
|--------|----------|---------|--------|
| **B1** 4 bag-weighted composites | `registry.ts:71–148` | Identical `createCompositeBag` + `PriorityBag` + `sample()`; differ only in invoked method | Ready |
| **B2** 3 scorer tiers | `primitives.ts:55–116` | `PREMISE_SCORERS` / `_CURRIED` / `_EXTENDED`; `resolveFilters` special-cases `highConfidence` | Ready |
| **B7** Legacy dirs | `cognition/` vs `game/`, `rl/` vs `rlfp/` | Renames done as copies; `game/registry.ts` still imports from `cognition/` | Ready |

Other "Composite*" classes (`CompositeStrategy`, `CompositeAttention`, `CompositePremiseSource`, `CompositeLMRule`, `CompositeDerivation`) are **different patterns for different interfaces** — not the same bag-weighted duplication. Consolidating them would be a design change, not dedup.

Additional duplications confirmed (already in plan):
- `memory.sample(100)` hardcoded in 4+ sites → **C2**
- Multiple ad-hoc event buses → **B5**
- NAR god object (932 lines) → **B6**
- Monkey-patched hooks (`#wireRuleGraphCallbacks`) → **B3**
- String-sniffing drives (`includes('test_passed')`) → **B4**
- O(n) scorer lookups (`links.find`, per-concept `getCoActivations`) → **C1**