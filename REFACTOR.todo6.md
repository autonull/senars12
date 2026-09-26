# REFACTOR.todo6.md

Continuation of REFACTOR.todo5.md. Assumes TODO5 code exists as baseline (§3 — including its **gaps**, §3b).

## 0. Philosophy & North Star

The ultimate ideal for SeNARS: a **bounded, auditable, self-improving cognitive runtime** —
truth-maintenance over a time-sliced knowledge graph, bounded by AIKR, with every
selection, derivation, and adaptation provable, replayable, and consistent with the
Knowledge Capability Model (KCM: Competitive. Temporal. Consistency.)

TODO5 built the parts. TODO6's discovery: **several parts are built but not wired, some are
shadowed by fake same-named wrappers, and some claims are unfalsified** (§3b). The refactor
sprints' original goal stands — architecturally *unlock* new capability while improving
quality — but unlocked code that has no consumer and no falsifying test is not yet capability.
TODO6 therefore has these dials:

- **A** — **Correctness debt + premise architecture**: FenwickBag structural bugs (tree↔entry desync), shared LRU-eviction invariant break, dead `strategies.bag` knob, bag clock injection (determinism), premise strategy primitives (un-shadow `term-link`, register `semantic`, collapse the sampling family)
- **B** — **Bag performance + fidelity**: prove or disprove FenwickBag's O(log n) sample *and* its sampling fidelity to item priority; seed-parity vs PriorityBag; then the C19 default decision
- **C** — **RuleGraph unlock**: it is currently dead code (never registered, zero consumers, degenerate focus extraction) — wire it to real cognitive context + RLFPLearner rewards, give it its dual premise role, or record non-adoption
- **D** — **Parallel cognition**: multi-root FocusTree, hard BudgetSlice inheritance, bounded mailbox backpressure — on top of now-falsified TODO5 parts
- **E** — **Capability self-modification**: give the unwired TODO5 self-model components (MettaProposer, JudgmentPipeline, GovernanceResolver, CapabilityOntology) their first production consumers
- **F** — **Production hardening**: extend the *existing* OTel tick instrumentation (do not introduce pino — §3b), deterministic replay CLI, soak gates

---

## 1. Premise Strategy Architecture (Core Flexibility)

### 1.1 Current State Audit (corrected 2026-09-26)

**Registered in `CognitiveRegistry` — but several registrations are NOT what their names claim:**

| Registered name | What actually runs | Intended behavior (orphaned impl) |
|----------|------------------|-----------------------------------|
| `bag` | `memory.sample(10)` + shared-atoms + no-stamp-overlap | correct |
| `default-formation` | `createStrategy({sampleSize:10, limit:5})` sampling | correct |
| `prolog` | `createStrategy({sampleSize:20, limit:5})` — **misnamed sampling wrapper, zero Prolog logic** | — (no real impl exists; genuine logic lives in `prolog-resolution`) |
| `resolution` | `createStrategy({sampleSize:15, filter:inheritance})` | honest name, sampling |
| `goal-driven` | `memory.sample(20)`, f > 0.7 | correct |
| `analogical` | `memory.sample(15)`, inheritance subterm overlap | correct |
| **`term-link`** | **`createStrategy({sampleSize:25, limit:10})` sampling wrapper — NEVER touches LinkManager** | **real `TermLinkStrategy` in `strategies/premise/term-link.ts` (link-manager walks) is shadowed: imported as `createTermLinkStrategy`, never used, not exported from index** |
| `task-match` | `createStrategy({sampleSize:20, limit:5})` | honest-ish, sampling |
| `decomposition` | conjunction args → beliefs | correct |
| `exhaustive` | `memory.sample(100)` + shared-atoms | correct |
| `prolog-resolution` | genuine SLD (unification, occurs-check, depth-bound) | correct |

**Dead imports / stale re-exports:** `selection-strategies.ts` imports `createSemanticStrategy` + `createTermLinkStrategy` but never calls them; `reason/strategies/index.ts` still re-exports `./semantic.js` / `./term-link.js` — stale pre-B2 paths. `semantic.ts` is not exported from `strategies/premise/index.ts` at all.

**Sampling family = 9 strategies, one shape.** `bag`, `default-formation`, `prolog`, `resolution`, `term-link`(!), `task-match`, `exhaustive`, `goal-driven`, `analogical` all reduce to `samplePremises(memory, task, {sampleSize, limit, filter, truthFilter})`. Three are misnamed wrappers (`prolog`, `term-link`, and arguably `task-match`).

**Genuinely distinct strategies (keep as-is or compose from primitives):** `term-link` (real, source=links), `decomposition` (source=task-args), `semantic` (scorer=weighted linear, orphaned), `prolog-resolution` (bespoke SLD search — does NOT fit the score/filter pipeline; keep as-is).

### 1.2 Fixes for the Wrapper/Shadow Collisions

No backwards compatibility needed — remove the fake implementations entirely:
- **`prolog`** — delete the registered sampling wrapper; no real Prolog logic exists. The genuine logic lives in `prolog-resolution` (separate registration). Configs referencing `'prolog'` will error — that's the signal to migrate to `'prolog-resolution'` (logic) or a sampled config (same behavior).
- **`term-link`** — the registered name must run the **real** link-manager implementation. Replace the registered wrapper with the genuine `TermLinkStrategy` (expressed as primitives: source=`links`, scorer=`link-weight`, budget=`{limit, minScore:0.3}`); the fake wrapper is retired (same-name swap restores intent; behavior changes from sampling → link-walk — falsified by a bench asserting LinkManager is consulted).
- **`task-match`** — rename to `sampled` (its honest name); old configs error → migrate.

### 1.3 Primitive Composition (one module, no new registry APIs)

Keep `CognitiveRegistry` untouched. Add **one module** `strategies/premise/primitives.ts` exporting three maps + an extended config; rebuild the sampling family from it:

```typescript
// strategies/premise/primitives.ts
export const PREMISE_SOURCES = {
  bag:        (task, mem, n) => mem.sample(n),
  links:      (task, mem)    => mem.getLinkManager().getLinksByTerm(task.term),
  graph:      (task, mem)    => conceptGraph.neighbors(task.term),   // Phase C
  taskArgs:   (task, mem)    => argsOf(task.term).map(mem.getConcept),
} as const;

export const PREMISE_SCORERS = {
  priority:   (task, c) => c.priority,
  linkWeight: (task, c) => linkStrength(task.term, c.term),
  embedding:  (task, c) => embeddingSim(task.term, c.term),
  edgeWeight: (task, c) => conceptGraph.weight(task.term, c.term),   // Phase C
  linear:     (w: Weights) => (task, c) => w.link*linkStrength + w.embed*embeddingSim + w.pri*c.priority,
} as const;

export const PREMISE_FILTERS = {
  sharedAtoms:    (task, c) => hasSharedAtoms(task.term, c.term),
  noStampOverlap: (task, c) => !Stamp.overlaps(c.beliefBag.peek()?.stamp, task.stamp),
  inheritanceOnly:(_, c)     => c.term.kind === 'inheritance',
  highConfidence: (thr)     => (_, c) => (c.beliefBag.peek()?.truth?.f ?? 0) > thr,
  inheritanceOverlap: /* analogical's subterm-overlap predicate */,
} as const;

// Extended SampleConfig (sample.ts) — source/scorer/filters/minScore join sampleSize/limit
interface SampleConfig {
  source?: SourceName;                       // default 'bag'
  scorer?: ScorerName | { linear: Weights }; // default 'priority' (current behavior)
  filters?: FilterName[];                    // default ['sharedAtoms']
  minScore?: number;                         // replaces ad-hoc budget thresholds
  sampleSize: number; limit: number;
}
```

**Named strategies become one-line compositions** (parity-anchored to current outputs):
- `default-formation` = bag + priority + [sharedAtoms], {10, 5}
- `bag` = bag + priority + [sharedAtoms, noStampOverlap], {10, 10}
- `resolution` = bag + priority + [inheritanceOnly], {15, 5}
- `goal-driven` = bag + priority + [highConfidence(0.7)], {20, 5}
- `exhaustive` = bag + priority + [sharedAtoms], {100, 100}
- `analogical` = bag + priority + [inheritanceOverlap], {15, 3}
- `term-link` (restored) = links + linkWeight, {limit:20, minScore:0.3}
- `semantic` (newly registered) = concepts source + linear{0.5,0.3,0.2}, {limit:10, minScore:0.6}
- `prolog-resolution` — **stays bespoke** (unique search algorithm; not a score/filter pipeline)

Default config anchor: `strategies.premise.type = 'default-formation'` — its composed instance must reproduce current outputs exactly (C11 parity).

### 1.4 RuleGraph Dual Role (executed in Phase C — items C1–C5)

| Role | Registration | Mechanism |
|------|--------------|-----------|
| **LM Rule Selector** | `lm-rule: 'lm-graph'` (exists, unwired) | C1 context + C2 wiring + C3 fail-closed |
| **Premise Source** | `graph` entry in `PREMISE_SOURCES` | `getCoActivations(focusTerm)` → neighbor beliefs |
| **Premise Scorer** | `edgeWeight` entry in `PREMISE_SCORERS` | RLFPLearner-derived edge weights |

One co-activation graph, three consumers. The primitives module (A6) makes the premise-side registration a map entry, not a new strategy class.

### 1.5 `windowed-roulette` Sampling Strategy (HijackBag insight)

HijackBag (`docs/java/HijackBag.java:575-698`) samples via: random window over the (priority-sorted) array → local sort → roulette within window → window slides each call. This is a *positional-local* paradigm distinct from global priority-proportional sampling — cheap diversity with locality.

**Deliberately NOT a third Bag implementation** — TODO5 §4 caps bag impls at two (PriorityBag default, FenwickBag alternate) until a decision record justifies more. It lands as a `SamplingStrategy` (`sampling: 'windowed-roulette'`):
- Requires a small `Memory.sampleWindow(k, rng)` API (random contiguous slice of the priority-sorted concept array — `sample(limit)` is priority-biased, not positional, so it cannot express this).
- Falsified by: seeded-rng determinism test + diversity bench vs `priority` sampling (distinct-concepts-per-100-samples at fixed capacity).

---

## 2. Triage: candidate refactorings (ADOPT/HOLD/DEFER)

| # | ADOPT | Type | Rationale / Seam alignment |
|---|-------|------|---------------------------|
| A1 | **FenwickBag correctness fixes**: `remove()`/`removeMany()` leave the Fenwick tree desynced from entries (pre-splice index values persist → sampling distribution corrupt after any removal); `findByPrefixSum` out-of-range falls back to `entries[0]` (highest-priority bias); `evict('Random')` splice+pop corrupts tree | Correctness | Sampling from a corrupt tree silently violates AIKR priority semantics. Fix via rebuild-on-remove (O(n); removal is rare) or lazy-rebuild counter |
| A2 | **Shared evict('LRU') invariant break** (both bags): in-place `sort()` by lastAccessedAt destroys the priority-sorted invariant → later `add()` inserts wrong, `peek()`/`shouldOverflow()` read wrong min/max | Correctness | Replace sort with O(n) min-scan; keep invariant. One fix shared behind `Bag<T>` (C20) |
| A3 | **Injectable clock in bags**: `BagOptions.clock?: () => number` (default `Date.now`) for `createdAt`/`lastAccessedAt` | Determinism | Prime suspect for observed flaky `refactor2-episode-consolidator` determinism failure; makes bag behavior seed-reproducible for B1/C benches and F3 soak |
| A4 | **Wire `strategies.bag` knob**: `CognitiveParameters.strategies.bag.type` → `Memory` → `ConceptConfig.bagImplementation` → `createBag()`. Knob exists (config lines 230/384) but `Memory.addConcept` passes only `{ onRevision }` — dead config | Config unlock | C18: a knob that selects nothing is a defect. Completes TODO5 C1's seam |
| A5 | **Fix `refactor4-bounded-aikr.test.ts` type errors** (18): missing `inh`/`prod` exports, mock types, stale value-vs-type refs, `CascadeJudge` shape, `consumed` field | Test debt | Unblocks full `pnpm typecheck` 0 errors; drops the long-standing exclusion |
| A6 | **Premise primitives refactor**: (i) one `strategies/premise/primitives.ts` (sources/scorers/filters maps) + extended `SampleConfig`; (ii) rebuild the 9-strategy sampling family as compositions — existing names preserved as aliases (parity anchor: `default-formation` byte-identical); (iii) restore real `term-link` (link-manager) to its registered name; retire the fake wrapper (§1.2); (iv) register orphaned `semantic`; (v) **remove** fake `prolog` wrapper and rename `task-match`→`sampled`; (vi) delete dead `createSemanticStrategy`/`createTermLinkStrategy` imports and stale `reason/strategies/index.ts` re-exports | Architecture | Kills the wrapper/shadow collision class (§1.1); `semantic` becomes a config not a class; new sources/scorers (graph, windowed) arrive as map entries; DRY: 9 shapes → 1 shape + 1 bespoke |
| A7 | **`windowed-roulette` SamplingStrategy** (§1.5): positional-window local-roulette sampling + `Memory.sampleWindow(k, rng)`; falsified by seeded-determinism + diversity bench vs `priority` | Architecture | HijackBag-proven paradigm; keeps bag impls at 2 (TODO5 §4); exercises A6's extensibility |
| B1 | **FenwickBag fidelity + parity suite**: (i) distribution fidelity — empirical frequencies match `priority/Σpriority` (TV-distance ≤ 0.02 @ 50k, χ²); (ii) post-removal fidelity (targets A1); (iii) seed parity — same seed+rng → identical item sequences across both impls; (iv) decay uniformity; (v) all three `EvictStrategy` modes preserve invariants; (vi) `serializeBag`/`restoreBag` round-trip property (TODO5 C1's unproven claim) | Correctness | Accuracy (fidelity to priority) is a first-class gate. TODO5's parity claims have no tests today |
| B2 | **Bag perf bench**: `sample()` + `add()` throughput/p99 at N ∈ {1k, 10k, 100k}, two mixes — insert-heavy (60/30/10) and sample-heavy (20/70/10) — both impls. Exposes that FenwickBag `add` is O(n) (findIndex+splice+rebuildTree) — the O(log n) claim holds for sample only | Perf | C19 evidence. High-impact targets: ContrastiveMemory, HardNegatives, EpisodeConsolidator |
| B3 | **FenwickBag default decision** (C19): with B1+B2 green, ADR-006 ratifies flip-or-keep; proposed rule: sample-heavy p99 speedup ≥ 3× at 10k+ with fidelity intact → flip; else keep with recorded numbers | AIKR unlock | Either outcome closes the TODO5/TODO6 decision with evidence |
| B4 | **BudgetSlice observability**: per-slice `consumed/remaining/utilization` on SystemEventBus; `pnpm status --budget` renders slice tree (thread→focus→bag) | AIKR spine | `kernel/budget.ts` is pure with no telemetry; C22 needs eyes on slices |
| C1 | **RuleGraph context unlock**: extend `LMRuleSelectionContext` with `focusTerm?: Term`, populated at the single `select()` call site. Today `extractFocusTerm` ignores context — returns `rules[0].name`, making every co-activation edge a self-referential rule-name pair | Attention unlock | Without real terms the graph keys on rule names, not concepts — TODO5 D1's premise unfulfilled; also blocks the premise-source role |
| C2 | **RuleGraph lm-rule wiring**: call `registerRuleGraph` in NAR assembly (opt-in `strategies.lmRule: 'lm-graph'`); wire `recordPerformance` from rule outcomes; `learnFromDerivation` from derivation path; `tick()` from cycle. Today: zero callers for all four | Attention unlock | Converts TODO5 D1 from dead code to live strategy |
| C3 | **RuleGraph fail-closed fallback**: `fallbackSelect` filters on a `priority` field LM rules don't carry → can return **empty**, silently disabling all LM rules. Return all rules / top-N by registration order | Safety | Silent LM-rule shutdown is a fail-open regression vector (C17) |
| C4 | **RuleGraph dual-role premise registration**: `graph` source + `edgeWeight` scorer entries in `PREMISE_SOURCES`/`PREMISE_SCORERS` (§1.4) — premise selection walks the same co-activation graph the selector uses | Architecture | Unifies the co-activation signal across reasoning stages; lands as map entries via A6 |
| C5 | **RuleGraph falsifying bench**: empty selection impossible; selection distribution shifts with recorded performance; co-activations keyed on real terms (C1); premise-source walk returns memory-backed concepts | Correctness | TODO5 D1's "fallback edges guarantee non-regression" claim has no test today |
| D1 | **Multi-root FocusTree**: `addRoot(focusId, budgetSlice)` → independent subtrees, isolated slices; single-root default (parity) | Parallel cognition | Constructor takes exactly one root today |
| D2 | **Hard BudgetSlice inheritance in threads**: `spawn(parentSlice, allocation)` enforces Σ(child) ≤ parent.remaining; `join()` returns unconsumed budget | Parallel cognition | TODO5 F3 inheritance is soft; hard limits needed for fairness (C12) |
| D3 | **Mailbox budget-gated backpressure**: `send()` consumes slice budget, returns false on exhaustion/full (capacity bound exists; budget coupling doesn't) | Parallel cognition | AIKR: message admission must be budget-accounted |
| D4 | **FocusTree + CognitiveThread falsifying benches**: TODO5 claimed parity benches — zero tests exist for either file. Single-root parity; rollups non-empty; spawn/join/kill lifecycle; mailbox overflow | Test debt | C24: claims must be falsified |
| E1 | **MettaProposer (meta) wiring**: placeholders at `games.ts:58`/`GameFocus.ts:49` → wire meta/ version into negotiation proposers behind config. Rename meta/ version (`ProofMettaProposer`) to end collision with wired `reflex/metta-proposer.ts` (C13) | Symbolic loop | TODO5 F1's component gets its consumer |
| E2 | **GovernanceResolver first production consumer**: `SchemaInductor` proposals → resolver (quorum default) → adoption; `.adaptations` append + `.restore` | Safety | Resolver exported, zero production callers |
| E3 | **CapabilityOntology consumers**: register inventory into CapabilitySpace + tool registry at assembly (opt-in); add `Provenance { source, digest, proofRef? }` per entry | Self-model | Ontology exported, zero consumers; provenance gates later self-modification |
| E4 | **JudgmentPipeline consumer decision**: zero imports anywhere. Wire as manifold evaluation entry, or record explicit HOLD with rationale (ADR-008) | Auditability | C24: no unfalsified, unconsumed components across sprint boundaries |
| F1 | **Extend existing OTel instrumentation** to BudgetSlice ops, bag pressure transitions, backpressure decisions, strategy selections (span events on the tick pipeline: `initOtel`/`instrumentPipeline`/`wrapMiddlewareWithSpan`) | Production | OTel exists at tick level (todo5b-otel); extend C22 coverage, don't introduce pino |
| F2 | **Deterministic replay CLI**: `pnpm replay --from <eventId> --to <eventId> --verify` — re-run gates + reducer, compare state hash | Production | Event log + reducer exist; no CLI/verify mode (C14 surface) |
| F3 | **Soak stability gate**: CI `soak:24h` — bot + arcade + self-improve demo; fail on leak/unbounded accumulator/budget exhaustion/divergence; deterministic seeds + A3 clocks | Production | `soak/long-run.test.ts` skipped today |

| # | HOLD | Reason |
|---|------|--------|
| H1 | MeTTa surface reduction | Revisit once ProofMettaProposer (E1) is a live consumer |
| H2 | `.kiro/legacy-code/` deletion | External confirmation pending |
| H3 | Stream pipeline middleware adapter | Only if a live consumer (MCP streaming / UI) demands it |
| H4 | Interface extraction for cycle reduction (`IMemoryFactory` etc.) | Re-triage mid-sprint after A-phase lands, with fresh dpdm numbers; premature interfaces freeze wrong seams |

| # | DEFER | Reason |
|---|-------|--------|
| X1 | Curriculum generator | Prerequisites in D/E |
| X2 | Distributed CognitiveThread (IPC/cluster) | After D1–D3 stable |

---

## 3. Baseline (from TODO5 completion — 2026-09-26)

- All 21 TODO5 ADOPT items code-complete; tests 2184 pass / 5 skipped; typecheck 0 errors in src (18 in excluded `refactor4-bounded-aikr.test.ts`); PARITY maintained; deps:gate 272 (baseline 272, intra-package); benches 1–105 green; packages 7

## 3b. TODO5 audit — gaps discovered (2026-09-26 codebase review)

| TODO5 claim | Reality | TODO6 fix |
|---|---|---|
| C1 "`strategies.bag` knob selects impl" | Knob exists in config but `Memory.addConcept` never passes `bagImplementation` to `Concept` — dead config | A4 |
| C1 "FenwickBag statistical parity (KS-test)" | **No test references FenwickBag at all** | B1 |
| C1 "O(log n) sample vs O(n)" | True for `sample`; `add` is O(n); unbenched | B2 |
| C1 "serializeBag/restoreBag round-trip property test passes" | No such test exists | B1-vi |
| D1 RuleGraph registered in `CognitiveRegistry` | `registerRuleGraph()` never called; `lm-graph` never instantiated | C2 |
| D1 "Consumes RLFPLearner performance rewards" | `recordPerformance` has zero callers | C2 |
| D1 "fallback edges guarantee non-regression" | `fallbackSelect` can return empty — fail-open | C3 |
| D1 ConceptGraph co-activation over concepts | `extractFocusTerm` ignores context; graph keys on rule names | C1 |
| D2 FocusTree "single-root = flat parity bench" | Zero tests reference FocusTree | D4 |
| F3 CognitiveThread "ThreadScope alias parity" | Zero tests reference CognitiveThread | D4 |
| F1 MettaProposer "closes the loop" | Comment placeholders only; name-collides with wired `reflex/metta-proposer.ts` | E1 |
| F2 JudgmentPipeline | Zero imports anywhere | E4 |
| E2 GovernanceResolver ".adaptations/.restore" | Exported; zero production callers | E2 |
| E1 CapabilityOntology "registers into CapabilitySpace + tools" | Exported; zero consumers | E3 |
| (pre-B2 legacy) premise strategies under `reason/strategies/` | `reason/strategies/index.ts` still re-exports `./semantic.js`/`./term-link.js` stale paths; `createSemanticStrategy`/`createTermLinkStrategy` dead imports in `selection-strategies.ts` | A6-vi |
| (pre-B2 legacy) registered `term-link` | Registered impl is a sampling **wrapper** (selection-strategies.ts:122); genuine link-manager class in `strategies/premise/term-link.ts` is shadowed — same collision pattern as `prolog` | A6-iii |
| (misc) PriorityBag "O(1) add" (README/TODO4) | `add` is O(n) (findIndex + splice) | B2 corrects the record |

**Also observed**: `evict('LRU')` sorts entries in place in *both* bags, destroying the priority-sorted invariant (A2). Bags hardcode `Date.now()` (A3). OTel exists at tick level — F1 extends rather than introduces.

---

## 4. Invariants (C11–C20 carried; C21–C24 new)

1. **C11 PARITY**: byte-identical single-thread core cycle (default config; omits STAMP)
2. **C12**: Everything bounded via factory + degradation ladder + recovery + defense layering
3. **C13**: One definition per concept (one `MettaProposer` name — E1; one `TermLinkStrategy` meaning — A6)
4. **C14**: Event-sourced replay reducer coverage — pure reducers reconstruct all state
5. **C15**: Every new abstraction earns its keep — debt-negative or capability-positive
6. **C16**: Open-loop → closed-loop; knowledge as E-signal; adaptive modulation
7. **C17**: No regressions — **including silent degradation** (empty selections, misnamed wrappers routing to the wrong impl)
8. **C18**: Config density 100% — a knob with no consumer is a defect (A4)
9. **C19**: Alternate implementations behind the existing seam; default switch requires bench evidence + decision record
10. **C20**: One home per strategy type — all under `strategies/`
11. **C21**: **Cycle budget non-increasing** — deps-gate baseline only decreases or is justified + recorded
12. **C22**: **AIKR observability** — every budget slice, pressure signal, backpressure decision measurable
13. **C23**: **Governance-gated self-modification** — no capability/schema/strategy change bypasses the resolver
14. **C24**: **No orphan deliverables** — every ADOPT item ships with ≥1 falsifying test **and** ≥1 wired consumer, or an explicit recorded non-adoption decision

---

## 5. Budget: 27 ADOPT refactors / ~13 benches

Metric — package count (baseline 7): **net zero**; new files only within existing strategy homes (C20).

## 6. Out of scope

README rewrite; MeTTa surface reduction (H1); `.kiro/legacy-code` deletion (H2); stream middleware adapter (H3); interface extraction (H4 — re-triage mid-sprint); curriculum generator (X1); distributed threads (X2); speculative exports; breaking public API without semver major.

---

## 7. Risks

| Risk | Mitigation |
|------|------------|
| FenwickBag tree↔entry desync corrupts sampling after removal (A1) | Rebuild-on-remove; B1-ii post-removal fidelity is the gate; property test: add/remove/sample interleavings keep TV-distance ≤ ε |
| LRU sort destroys sorted invariant (A2) | Min-scan eviction; invariant test: post-evict `toArray()` priority-descending, `peek()` = max priority |
| Clock injection hot-path cost (A3) | One indirect call per add/sample; bench delta in B2; `Date.now` default unchanged |
| Seed-parity too strict (float assoc differences) | Parity on selected item *sequence* (discrete), not internal floats |
| A6 premise refactor changes selection behavior | Compositions reuse the same `samplePremises` path → byte-identical for unchanged configs; parity bench anchored on `default-formation`; the two intended behavior changes (`term-link` restored, `semantic` added) are each falsified explicitly; `prolog`/`task-match` configs error — migrate to `prolog-resolution` or `sampled` |
| A7 windowed-roulette becomes another orphan | Registered + benched (determinism + diversity vs `priority`) in the same phase; C24 gate |
| RuleGraph wiring changes LM firing behavior | Opt-in via config; default path byte-identical (C11); C5 bench only runs when enabled |
| `focusTerm` on `LMRuleSelectionContext` ripples | Additive optional field; existing selectors ignore it; populated at the single `select()` call site |
| Governance gating slows schema adoption | Quorum default; per-session ledger; `.restore` rollback |
| OTel span volume | Span events on existing tick pipeline only; OTel sampling config |
| Soak flakiness | Deterministic seeds + A3 clocks; quarantine protocol |

---

## 8. Phases (bench numbers continue from TODO5's 105)

| Phase | Scope | Key Files | Bench | Falsifies |
|-------|-------|-----------|-------|-----------|
| **A** | Bag correctness (A1–A3) + knob wiring (A4) + test debt (A5) + premise primitives (A6) + windowed-roulette (A7) | `nar/bag/*`, `nar/memory/concept.ts`, `nar/memory/memory.ts`, `config/cognitive-parameters.ts`, `tests/nar/refactor4-bounded-aikr.test.ts`, `strategies/premise/primitives.ts`, `strategies/premise/sample.ts`, `strategies/premise/selection-strategies.ts`, `strategies/premise/index.ts`, `reason/strategies/index.ts`, `cognitive/registry.ts`, `strategies/sampling/WindowedRoulette.ts` | 106 | Post-removal fidelity holds; LRU evict preserves sorted invariant; same-seed determinism with injected clock; `bag.type='fenwick'` yields FenwickBag concepts; `pnpm typecheck` 0 errors overall; `default-formation` parity byte-identical; registered `term-link` consults LinkManager; `semantic` selectable; dead imports gone; windowed-roulette deterministic + diversity delta vs priority |
| **B** | Bag evidence (B1–B3) + BudgetSlice telemetry (B4) | `nar/bag/*`, `tests/nar/bag-fidelity.test.ts`, `tests/benchmark/bag-perf.test.ts`, `kernel/budget.ts`, `bin/status.ts`, `docs/adr/006-fenwickbag-default.md` | 107 | TV-distance ≤ 0.02 @ 50k; seed-parity sequences; round-trip property; p99 at 1k/10k/100k × 2 mixes; ADR-006 decision recorded; budget tree in status |
| **C** | RuleGraph unlock (C1–C5) | `strategies/types.ts`, `strategies/lm-graph/RuleGraph.ts`, `cognitive/registry.ts`, rule-processor outcome path, `strategies/premise/primitives.ts`, `tests/nar/rulegraph-wiring.test.ts`, `docs/adr/007-rulegraph-adoption.md` | 108 | `lm-graph` selectable; selection tracks performance; empty selection impossible; co-activations on real terms; `graph` source returns memory-backed beliefs; default path byte-identical |
| **D** | Parallel cognition (D1–D4) | `focus/FocusTree.ts`, `core/cognitive-thread.ts`, `kernel/budget.ts`, `tests/nar/focustree-parity.test.ts` | 109 | Single-root parity; rollups non-empty; Σ(child) ≤ parent; join returns unconsumed; send fails on exhausted slice; ThreadScope alias parity |
| **E** | Self-model consumers (E1–E4) | `meta/metta-proposer.ts`, `nar/games.ts`, `focus/GameFocus.ts`, `governance/pipeline.ts`, `learning/schema-induction.ts`, `capability/ontology.ts`, `lm/system-one/judgment-pipeline.ts`, `docs/adr/008-judgment-pipeline.md` | 110 | ProofMettaProposer contributions in negotiation; schema adoption via resolver with `.adaptations`/`.restore`; ontology provenance + registration; pipeline decision recorded |
| **F** | Production (F1–F3) | `nar/tick/*`, `kernel/budget.ts`, `scripts/replay.ts`, `.github/workflows/soak.yml` | 111 | Budget/pressure/backpressure spans present; `pnpm replay --verify` hash-match; soak:24h green |

Order: **A → B → C** strict (C19 needs correct+proven bags; C's benches need A3 clocks; C4 needs A6's primitives module). D/E/F interleave after A.

---

## 9. Progress
 
 | # | Phase | Deliverable | Bench | Status |
 |---|-------|-------------|-------|--------|
 | — | — | Plan drafted + codebase audit (§3b) + premise architecture (§1) | — | 📝 |
 | A1 | A | FenwickBag correctness: `remove`/`removeMany` tree rebuild, `findByPrefixSum` retry-on-rebuild, `evict('Random')` rebuild | 106 | ✅ |
 | A2 | A | LRU eviction invariant: O(n) min-scan replaces in-place sort in both PriorityBag & FenwickBag | 106 | ✅ |
 | A3 | A | Injectable clock (`BagOptions.clock`) for deterministic `createdAt`/`lastAccessedAt` | 106 | ✅ |
 | A4 | A | `strategies.bag` knob wired: `CognitiveParameters.strategies.bag.type` → `Memory` → `ConceptConfig.bagImplementation` | 106 | ✅ |
 | A5 | A | `refactor4-bounded-aikr.test.ts` type errors fixed (18 errors) | 106 | ✅ |
 | A6 | A | Premise primitives refactor: `primitives.ts` (sources/scorers/filters), sampling family rebuilt as compositions, real `term-link` restored, `semantic` registered, fake `prolog` removed, `task-match`→`sampled` | 106 | ✅ |
 | A7 | A | `windowed-roulette` SamplingStrategy + `Memory.sampleWindow(k, rng)` | 106 | ✅ |
 | B1 | B | FenwickBag fidelity + parity suite: TV-distance ≤ 0.02 @ 50k, χ², post-removal fidelity, seed parity, decay uniformity, evict invariants, serialize round-trip | 107 | ✅ |
 | B2 | B | Bag perf bench: sample/add throughput @ N=1k (insert-heavy & sample-heavy mixes, pure sample, pure add) | 107 | ✅ |
 | B3 | B | ADR-006 FenwickBag default decision: keep PriorityBag default (FenwickBag add/evict 250–3000× slower, sample only 1.6× faster) | 107 | ✅ |
 | B4 | B | BudgetSlice observability: `budget:slice:created/consumed/exhausted/merged` events on NarEventBus; `formatBudgetSliceTree`/`collectBudgetSlices` in kernel; `--budget` flag in `senars status` | 107 | ✅ |
 
 ---

## 10. Architecture Decision Records (to create during execution)

| ADR | Trigger | Location |
|-----|---------|----------|
| ADR-006 | FenwickBag default decision (B3) — fidelity + perf tables, either outcome | `docs/adr/006-fenwickbag-default.md` |
| ADR-007 | RuleGraph adopt-or-retire (C1–C5) — record retirement if wiring shows no benefit | `docs/adr/007-rulegraph-adoption.md` |
| ADR-008 | JudgmentPipeline consumer decision (E4) | `docs/adr/008-judgment-pipeline.md` |
| ADR-009 | Multi-root FocusTree semantics (D1) | `docs/adr/009-multiroot-focustree.md` |
| ADR-010 | Premise primitives taxonomy (A6) — sources/scorers/filters/budget, wrapper-retirement record | `docs/adr/010-premise-primitives.md` |

---

*Phase B complete — ready for Phase C kickoff*

---

## Post-REFACTOR.todo6 Rename Notes (manual, WebStorm)

| Current Path | Target Path | Rationale |
|--------------|-------------|-----------|
| `nar/src/cognition` | `nar/src/game` | Game component library (Sensor/Action/Reward contracts for arcade/self-play) |
| `nar/src/rl` | `nar/src/rlfp` | RLFP-specific learner integration; disambiguates from future generic RL infra |

> These are breaking export renames — do **not** attempt via agent. Use WebStorm's "Rename Directory + Update References" after todo6 completes. `nar/src/cognitive` stays as-is (metacognitive control plane).