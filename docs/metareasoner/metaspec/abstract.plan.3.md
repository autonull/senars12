# MetaReasoner Abstraction — Development Plan

## 0. Executive Summary

**Goal:** Abstract SeNARS into a universal control-model substrate where the existing "default" control model, all `synth/` flavors, and future models are **configurable projections** of a single elegant architecture — sharing foundations, composable, scalable from minimal kernel to full cognitive engine.

**Approach:** Extract the 7 sorts from `space.a.1` (Topology, Gates, Budgets, Strategies, Valuation, Memory, Policy) into **typed ports** with algebraic composition laws. Implement the Ω-Calculus (`universal.qw1.md`) as the target architecture, staged across 5 tiers (Ω₀–Ω₄). The current SeNARS control flow becomes one configuration: `ControlModel.Default`.

**Deliverable:** A new package `@senars/metareasoner` (or internal module) exporting:
- `ControlModel` interface + `ControlModelRegistry`
- `ControlTopology` (stage DAG + KAT control words)
- `GateLattice` (oriented, composable gates)
- `BudgetEconomy` (scoped, reservable, priced)
- `StrategyOperad` (5 slots + composition law)
- `ValuationAlgebra` (epistemic/teleological split)
- `MemoryPorts` (9 contracts, single write path)
- `PolicyAlgebra` (failure/degradation lattice)

All wired through a **Unified Commit Ledger** (cognitive transactions).

---

## 1. Architecture — The 7 Sorts as Typed Ports

### 1.1 Sort Signatures (from `space.a.1` + `synthesize.md` objectives)

| Sort | Port Interface | Key Abstraction | Synth Coverage |
|------|----------------|-----------------|----------------|
| **𝒯 Topology** | `ControlTopology` | Stage DAG, KAT control words, nesting depth, heterochronous tower | Universal, AEGIS, Ambitious, ACS, Ω-Calculus, Θ |
| **𝒢 Gates** | `GateLattice` | Oriented lattice (closure/interior), trust field, risk manifold, unified admission functional | Universal, AEGIS, Ambitious, ACS, Ω, Θ |
| **ℬ Budgets** | `BudgetEconomy` | Commutative monoid + reservations + price semiring, thermodynamic energy, entropy accounting | Universal, AEGIS, Ambitious, ACS, Ω, Θ |
| **𝒮 Strategies** | `StrategyOperad` | 5 typed slots, composition law γ, resolution ρ, continuous manifold option | Universal, AEGIS, Ambitious, ACS, Ω |
| **𝒱 Valuation** | `ValuationAlgebra` | Evidence monoid, revision, epistemic/teleological/procedural/meta axes, paraconsistent | Universal, AEGIS, Ambitious, ACS, Ω, Θ |
| **ℳ Memory** | `MemoryPorts` | 9 contracts, Bag comonad, single `CommitLedger` write, cellular cytosol/nucleus | Universal, AEGIS, Ambitious, ACS, Ω |
| **𝒫 Policy** | `PolicyAlgebra` | Failure→Response lattice, degradation maps, autonomy ladder, governance profile | Universal, AEGIS, Ambitious, ACS, Ω, Θ |

**Constitution Φ (H1–H10 from `synthesize.md` + L1–L12 from Ω-Calculus)** — enforced as **type-level invariants** and **CI gates**:

| ID | Law | Formal Statement | Source |
|----|-----|------------------|--------|
| **H1** / **L1** | Epistemic firewall | No generator `Reward → Belief.(f)`; grade-respecting Δ | All synth |
| **H2** / **Φ3** | Untrusted ⇒ judged | `propose ⇒ judged-before-commit ∨ provisional-typing` | All synth |
| **H3** / **L3** | Mutation ⇒ event | ∀ write, ∃ ledger entry; admit-before-write | All synth |
| **H4** / **L10** | No self-approval | Self-mod ⇒ external ∨ governed arbitration; authority filtration | All synth |
| **H5** / **Φ2** / **L6** | Boundedness | Every reasoning path bounded in time/memory/derivations/LM; well-foundedness | All synth |
| **H6** / **Φ10** / **L12** | No opaque scheduling | Control choices ∈ event log; control-plane provenance | All synth |
| **H7** / **Φ8** / **L7** | Verifier independence | `imports(verifier) ∩ imports(engine) = ∅`; drift pinned | All synth |
| **H8** / **Φ7** / **L8** | Equality isolation | Exact substrate never unions on uncertain similarity; arbiter pattern | All synth |
| **H9** / **Φ9** / **L9** | No silent cognitive faults | Faults affecting cognition/budget/admission are typed events | All synth |
| **H10** / **Φ11** / **L4** | Irreversibility ⇒ authorization | Irreversible actions pass risk classification + authorization | All synth |
| **L2** | Single commit authority | ∃! `commit : Candidate → State` | Ω, Universal, AEGIS, Ambitious, ACS, Θ |
| **L5** | Gate monotonicity | Adding judgment never widens admission | Ω |
| **L11** | Evidence independence | Revision only across disjoint lineages; dependence ⇒ typed refusal | Ω |

---

## 2. Control Model Interface

```typescript
// Core abstraction: a control model IS a configuration of the 7 sorts
interface ControlModel {
  readonly id: string;
  readonly topology: ControlTopology;
  readonly gates: GateLattice;
  readonly economy: BudgetEconomy;
  readonly strategies: StrategyOperad;
  readonly valuation: ValuationAlgebra;
  readonly memory: MemoryPorts;
  readonly policy: PolicyAlgebra;

  // Compose with another model (restriction/refinement/lifting)
  compose(other: ControlModel): ControlModel;
  restrict(predicate: (sort: Sort) => boolean): ControlModel;
  lift<T>(functor: Functor<T>): ControlModel<T>;
}

// Registry for discoverable models
interface ControlModelRegistry {
  register(model: ControlModel): void;
  resolve(id: string): ControlModel;
  list(): ControlModel[];
}
```

**Built-in models (mapping to all synth flavors + design space):**

| Model ID | Source Spec | Key Sort Variations | Tier |
|----------|-------------|---------------------|------|
| `ControlModel.Default` | Current SeNARS (control1/2, flow.*.md) | 3 nested loops, 4 gates, 6 scopes, 5 slots, NAL valuation, Bag memory, fail-closed-ingress/fail-open-egress | Ω₂ |
| `ControlModel.SG` | `space.b.2` SeNARS-SG | Conditional Stage Graph (DAG), guards on edges | Ω₂ |
| `ControlModel.JC` | `space.b.2` SeNARS-JC | Judgment Continuum (continuous trust field), calibrated admission | Ω₂ |
| `ControlModel.BB` | `space.b.2` SeNARS-BB | Claim Queue / Blackboard (priority bag of Claims) | Ω₃ |
| `ControlModel.MC` | `space.b.2` SeNARS-MC | Learned Meta-Controller (policy over programs) | Ω₃ |
| `ControlModel.Universal` | `synth/universal.qw1.md` · `synth/universal.qw2.md` | Full Ω-Calculus: 7 planes, KAT control, thermodynamic economy, heterochronous tower, full reflexivity | Ω₃ |
| `ControlModel.AEGIS` | `synth/flexible.qw1.md` (AEGIS) | 9-tuple reasoner, cognitive transactions, conditional DAG, market economy, governance manifold, heterochronous tower | Ω₃ |
| `ControlModel.Ambitious` | `synth/ambitious.qw1.md` · `synth/ambitious.oc1.md` | 12-tuple, CognitiveTransaction + ControlGraph + CommitLedger + ResourceEconomy, 4-phase migration | Ω₃ |
| `ControlModel.ACS` | `synth/bio.qw1.md` · `synth/bio.qw2.md` · `synth/bio.qw3.md` | Autopoietic Cognitive Substrate: cellular composition, cell division/apoptosis, tissues/organs, multi-rate coordination | Ω₄ |
| `ControlModel.Math` | `synth/math.qw1.md` · `synth/math.qw2.md` · `synth/math.qw3.md` | Ω-Calculus algebraic: 4 planes (epistemic, control, governance, provenance), 12 laws L1–L12, feasibility predicate Φ, 5-stratum construction | Ω₃ |
| `ControlModel.Thermodynamic` | `synth/thermodynamic.qw1.md` · `synth/thermodynamic.qw2.md` · `synth/thermodynamic.qw3.md` | Θ: free-energy minimization, cognitive temperature T, entropy accounting, energy landscape, 6 unifications | Ω₃ |
| `ControlModel.Category` | `synth/category.qw1.md` · `synth/category.qw2.md` · `synth/category.qw3.md` | Category-theoretic: coalgebras, fibrations, natural transformations, typed ports as morphisms | Ω₃ |
| `ControlModel.Topological` | `synth/topological.qw1.md` · `synth/topological.qw2.md` · `synth/topological.qw3.md` | Topological: sheaf semantics, nerve complexes, persistent homology, geometric control | Ω₃ |
| `ControlModel.Cybernetic` | `synth/cybernetic.qw1.md` · `synth/cybernetic.qw2.md` · `synth/cybernetic.qw3.md` | Cybernetic: homeostatic control, requisite variety, viability, autonomy ladder as feedback | Ω₃ |
| `ControlModel.Meta` | `synth/meta.qw1.md` · `synth/meta.qw2.md` · `synth/meta.qw3.md` | Meta-reasoning: reflective tower, recursive governance, self-observation cells | Ω₄ |

All models register in `ControlModelRegistry` and satisfy Φ (Constitution).

---

## 3. Phased Implementation Plan

### Phase 0: Foundation — Port Extraction & Type Definitions (Week 1–2)

**Objective:** Define all 7 sort interfaces in `@senars/metareasoner/src/ports/` with zero implementation dependencies.

| Task | File | Description |
|------|------|-------------|
| 0.1 | `ports/topology.ts` | `ControlTopology`, `StageNode`, `StageEdge`, `ControlWord` (KAT: seq `·`, choice `+`, iter `*`, guard `p?`, skip `1`), `NestingDepth` |
| 0.2 | `ports/gates.ts` | `GateLattice`, `Gate`, `GatePolicy`, `TrustField`, `RiskManifold`, `AutonomyLadder`, `Orientation` (ingress/egress) |
| 0.3 | `ports/budget.ts` | `BudgetEconomy`, `BudgetScope`, `BudgetDimension`, `Reservation`, `PriceSemiring`, `TerminationReason` |
| 0.4 | `ports/strategies.ts` | `StrategyOperad`, `StrategySlot`, `StrategyImpl`, `CompositionLaw`, `ResolutionFn`, 5 standard slots |
| 0.5 | `ports/valuation.ts` | `ValuationAlgebra`, `EvidenceMonoid`, `RevisionOp`, `EpistemicValue`, `TeleologicalValue`, `RankFn` |
| 0.6 | `ports/memory.ts` | `MemoryPorts` (9 contracts), `Bag`, `CommitLedger`, `CognitiveTransaction` |
| 0.7 | `ports/policy.ts` | `PolicyAlgebra`, `FailurePolicy`, `DegradationMap`, `Fault`, `Response` |
| 0.8 | `ports/constitution.ts` | `Constitution` (Φ as type predicates), `HardConstraint` (H1–H10) |
| 0.9 | `control-model.ts` | `ControlModel`, `ControlModelRegistry`, `Sort` enum |
| 0.10 | `index.ts` | Barrel export, re-export from `@senars/core`, `@senars/nar` where compatible |

**Verification:** `pnpm typecheck` passes; no circular deps; all interfaces are pure TypeScript (no runtime deps).

---

### Phase 1: Default Model — Current SeNARS as Configuration (Week 2–3)

**Objective:** Implement `ControlModel.Default` by **wrapping existing SeNARS components** — no behavior change, only factorization.

| Task | File | Description |
|------|------|-------------|
| 1.1 | `models/default/topology.ts` | Extract current 3-loop topology: Loop A (8 phases), Loop B (6 stages), Loop C (inference generator). Map to `ControlTopology` DAG with nesting depths 0,1,2. |
| 1.2 | `models/default/gates.ts` | Wrap `GateRegistry` → `GateLattice`. PerceptionGate (ingress fail-closed, cycle fail-open), BudgetGate, ActionGate, RewardGate. Implement `TrustField` from `SourceReputation` + calibrated heads. |
| 1.3 | `models/default/budget.ts` | Wrap `ControlBudgets` + `KernelBudgetGate` → `BudgetEconomy`. 4 dimensions, 6 scopes, open-once reset. Add `Reservation` layer (pre-charge before execute). |
| 1.4 | `models/default/strategies.ts` | Wrap `CognitiveRegistry` + 5 slots → `StrategyOperad`. Preserve 5760-profile space. `γ` = `buildInferenceController`, `ρ` = config resolution. |
| 1.5 | `models/default/valuation.ts` | Wrap NAL `(f,c)` truth + desire `(d,c)` → `ValuationAlgebra`. Evidence monoid, revision, epistemic/teleological split, ranking fn. |
| 1.6 | `models/default/memory.ts` | Wrap `Memory` + 9 ports → `MemoryPorts`. **Critical:** Route all writes through `CommitLedger` (new). `authorize` stage becomes single commit point. |
| 1.7 | `models/default/policy.ts` | Wrap current failure policies → `PolicyAlgebra`. Map: ingress=fail-closed, egress=fail-open, engine=silent-fail-open, propose=logged-fail-open. |
| 1.8 | `models/default/index.ts` | Assemble `ControlModel.Default` with all 7 sorts. Register in `ControlModelRegistry`. |
| 1.9 | `migration/default-adapter.ts` | Adapter: `NARConfig` → `ControlModel.Default` + `NARExecution` compatibility shim. |

**Verification:** All existing tests pass (`pnpm test`). `NARBuilder.fromProfile('tool-use').build()` produces behaviorally identical agent.

---

### Phase 2: Unified Commit Ledger — Single Write Path (Week 3–4)

**Objective:** Implement `CommitLedger` as the **single admission surface** (Objective B3, O8). All durable mutations → transaction → ledger → fold.

| Task | File | Description |
|------|------|-------------|
| 2.1 | `ledger/transaction.ts` | `CognitiveTransaction` type (id, correlationId, kind, inputs, outputs, effects[], budget, capabilities[], trust, risk, reversibility, fallback, proofObligations[], grade). |
| 2.2 | `ledger/ledger.ts` | `CommitLedger` class: `propose(tx) → Candidate`, `judge(candidate) → Judged`, `commit(judged) → Committed`, `reject(candidate, reason)`. Append-only `CognitiveEvent` log. |
| 2.3 | `ledger/normalize.ts` | Normalize: type-check, grade-check (firewall H1), evidence-independence-check. |
| 2.4 | `ledger/prove.ts` | Prove/Judge/Simulate pipeline. `DecisionPort.ask()` for classification/evaluation. `verifyRecord` for derivations. Simulation for actions. |
| 2.5 | `ledger/rank.ts` | Rank by utility/cost (Economy pricing). `budgetSettlement` → charge reservations. |
| 2.6 | `ledger/risk.ts` | Risk classification: `(trust, risk, reversibility)` → commit path (auto / sandbox / human / reject). |
| 2.7 | `ledger/integrate.ts` | Wire into `NARExecution.authorize` stage. Replace direct `memory.addTask` with `ledger.commit()`. Preserve `cycleSignals` emission. |
| 2.8 | `ledger/replay.ts` | `replay(events) → State` fold. `verifyReplayHash()`. Tiered audit: full proof for high-risk, sampled for routine. |

**Verification:** `pnpm test` + `pnpm e2e:pipeline`. Derivation verification (`pnpm derivation:verifiable`) passes. Event log replay produces identical state hash.

---

### Phase 3: Stage Graph & KAT Control Calculus (Week 4–5)

**Objective:** Replace hard-coded stage sequence with **data-driven ControlTopology** (Objective B1, O3). Enable `ControlModel.SG` (Stage Graph).

| Task | File | Description |
|------|------|-------------|
| 3.1 | `topology/stage-graph.ts` | `StageGraph` (DAG): nodes = stages, edges = guarded transitions. `guard: (state, signals, economy) => boolean`. Support: linear, conditional, parallel, loop, back-edge. |
| 3.2 | `topology/control-word.ts` | `ControlWord` algebra: `seq`, `choice`, `iter`, `guard`, `skip`. `evaluate(word, state) → Stage[]` (execution plan). |
| 3.3 | `topology/runner.ts` | `StageGraphRunner`: executes plan, emits `CognitiveEvent` per stage (for H6). Handles `AbortSignal`, budget checks per stage. |
| 3.4 | `models/sg/topology.ts` | `ControlModel.SG.topology` = conditional stage graph (perceive → attend → reason → [authorize | skip] → propose → learn). Guards: `budget.affords('derivations')`, `cycleSignals.contradiction`, `driveManager.hasActive()`. |
| 3.5 | `models/sg/index.ts` | Assemble `ControlModel.SG` (inherits other 6 sorts from Default, overrides Topology). |
| 3.6 | `runner/adapters.ts` | Adapter: `ControlModel` → `StageGraphRunner` → `NARExecution`-compatible `run(steps, signal)`. |

**Verification:** `ControlModel.SG` runs all existing tests. New test: conditional skip of `propose` when `control-work` budget exhausted. Stage events logged with correlationId.

---

### Phase 4: Claim Queue / Blackboard (Week 5–6)

**Objective:** Implement `ControlModel.BB` — unified claim queue (Objective B3, O4). Cognitive operations as typed claims on a bounded priority bag.

| Task | File | Description |
|------|------|-------------|
| 4.1 | `blackboard/claim.ts` | `Claim` type: `{ operator, priority, costVector, judgmentScore, expiry, grade, provenance }`. |
| 4.2 | `blackboard/queue.ts` | `ClaimQueue` (bounded `Bag<Claim>`): `post(claim)`, `popBest(budget) → Claim`, `requeue(claim)`, `expire()`. |
| 4.3 | `blackboard/scheduler.ts` | `ClaimScheduler`: utility-per-cost scoring (Eq 126 from Ω), marginal utility, thermodynamic allocation (Boltzmann factor). |
| 4.4 | `models/bb/topology.ts` | `ControlModel.BB.topology` = single `claim-loop` stage: `while (budget.affords) { claim = popBest(); execute(claim); }`. |
| 4.5 | `models/bb/operators.ts` | Register all current operators (NAL rules, LM proposals, tool goals, meta-goals, drives, consolidation) as `Claim` producers. |
| 4.6 | `models/bb/index.ts` | Assemble `ControlModel.BB`. |

**Verification:** `ControlModel.BB` produces equivalent throughput on benchmarks (`pnpm cycle-bench`). Priority inversion test: high-priority claim preempts low-priority.

---

### Phase 5: Meta-Controller & Learned Scheduling (Week 6–7)

**Objective:** Implement `ControlModel.MC` — meta-controller selects/blends controllers (Objective B2, O6, D6). Constitution H6: scheduler decisions are events.

| Task | File | Description |
|------|------|-------------|
| 5.1 | `meta/controller.ts` | `MetaController` portfolio: `{ deliberative, reactive, curious, conservative, creative, social, repair, consolidating }`. Each = `CognitiveProgram` (stageGraph, budgetAllocation, proposerPortfolio, verificationPolicy, autonomyPolicy, learningPolicy). |
| 5.2 | `meta/selection.ts` | `selectProgram(state, history, economy, gates) → CognitiveProgram`. Uses `RLFPLearner` + `PolicyOptimizer` (existing). Logs selection as `CognitiveEvent`. |
| 5.3 | `meta/blend.ts` | Blend multiple programs: weighted union of stage graphs, budget interpolation. |
| 5.4 | `models/mc/topology.ts` | `ControlModel.MC.topology` = `meta.select → runProgram → meta.update`. |
| 5.5 | `models/mc/index.ts` | Assemble `ControlModel.MC`. |

**Verification:** Meta-controller learns to prefer `conservative` under budget pressure, `curious` when `curiosity` drive high. Selection events replayable.

---

### Phase 6: Synth Flavors — Port All Flavors (Week 7–9)

**Objective:** Implement each `synth/` flavor as a `ControlModel` variant by composing the 7 sorts differently. Each flavor emphasizes different axes while satisfying the same Constitution Φ.

| Flavor | Source Files | Key Sort Variations | Distinguishing Features |
|--------|--------------|---------------------|-------------------------|
| `Universal` | `universal.qw1/2.md` | **All 7 sorts at max enrichment**: KAT control, thermodynamic economy, heterochronous tower, full reflexivity filtration F₀–F₄ | Ω-Calculus terminal object; 12 laws L1–L12; 5-stratum construction |
| `AEGIS` | `flexible.qw1.md` (AEGIS) | **Topology**: conditional DAG + heterochronous tower; **Economy**: market clearing + utility pricing; **Governance**: risk/reversibility manifold | 9-tuple (Σ,κ,β,ε,Γ,V,μ,Ω,F); guarantee conservation; precedence Safety > Audit > Unification > Modularity > Adaptivity > Power > Robustness |
| `Ambitious` | `ambitious.qw1.md` · `ambitious.oc1.md` | **Transaction**: CognitiveTransaction (unified); **Control**: ControlGraph (conditional DAG); **Ledger**: CommitLedger (single port); **Economy**: reservations + pricing | 12-tuple; 4-phase migration (Unify Ledger → Data-Driven Graph → Economics → Governed Reflexivity); behavioral coordinates table |
| `ACS` (Bio) | `bio.qw1/2/3.md` | **Topology**: Cellular (Cell = membrane+metabolism+genome+cytosol+nucleus+identity); **Memory**: cytosol/nucleus; **Control**: cell division/apoptosis; **Governance**: organism-level homeostasis | Autopoietic closure; cellular composition; tissues/organs; multi-rate coordination; cell lifecycle (nascent→active→dormant→apoptotic→recycled) |
| `Math` | `math.qw1/2/3.md` | **Algebraic**: 4 planes (I epistemic, II control, III governance, IV provenance); **Laws**: L1–L12; **Φ**: 12 feasibility constraints | Graded term algebra ⊕ KAT ⊕ Budget module ⊕ Transaction category ⊕ Gate lattice ⊕ Ledger monoid; compositionality theorems |
| `Thermodynamic` | `thermodynamic.qw1/2/3.md` | **Economy**: Free-energy minimization, temperature T, entropy budget; **Control**: energy landscape + meta-controller; **Topology**: heterochronous tower L0–L4 | 9-tuple (ℒ,ℰ,𝒢,Π,𝒯,𝒞,𝒱,𝒜,Ω); 6 unifications; Boltzmann scheduling; thermal annealing for learning |
| `Category` | `category.qw1/2/3.md` | **Formal**: Coalgebras, fibrations, natural transformations; ports as morphisms; composition as pullback | Category-theoretic semantics; universal properties; typed ports as interfaces |
| `Topological` | `topological.qw1/2/3.md` | **Geometric**: Sheaf semantics, nerve complexes, persistent homology; control as continuous deformation | Topological data analysis of cognitive state; geometric control theory |
| `Cybernetic` | `cybernetic.qw1/2/3.md` | **Control**: Homeostatic loops, requisite variety, viability theory; **Policy**: Autonomy ladder as feedback | Cybernetic control theory; Ashby's law; organizational invariants |
| `Meta` | `meta.qw1/2/3.md` | **Reflexivity**: Recursive governance, self-observation cells, meta-meta-control | Recursive tower; reflective equilibrium; governance of governance |

**Implementation pattern per flavor:**
1. Create `models/<flavor>/` with only the sorts that differ from `Default`/`Universal`
2. Use `compose()` / `restrict()` / `lift()` to derive from base models
3. Each flavor declares its **design selection bundle** (prime objectives, hard constraints, anti-goals, character bias) from `synthesize.md` format
4. Register in `ControlModelRegistry` with metadata: `{ source, objectives, constraints, tier }`
5. Add profile preset in `nar/src/agent/profiles.ts` (e.g., `meta-reasoner-universal`, `meta-reasoner-aegis`, `meta-reasoner-acs`, etc.)
6. Add feasibility test: `pnpm metareasoner:feasibility <flavor>` validates Φ

**Verification:** Each flavor passes `pnpm test` + at least one `pnpm imagine` scenario. `pnpm metareasoner:constitution` validates all H1–H10 + L1–L12 for each.

---

### Phase 7: Configurable Kernel — Ω₀ through Ω₄ Tiers (Week 9–10)

**Objective:** Expose **instantiation tiers** (from Ω-Calculus §15.3 / AEGIS §17 / ACS §15 / Θ §15) so users choose minimal → full. Each tier is a conservative extension preserving all prior laws.

| Tier | Package | Includes | Source | Use Case |
|------|---------|----------|--------|----------|
| **Ω₀ Kernel** | `@senars/metareasoner/kernel` | Substrate + ControlWord + 1 Gate + BudgetMonoid + ProvenanceFold | Ω-Calculus S0, AEGIS Phase 0, ACS Phase 1 | Embedded, edge, minimal |
| **Ω₁ Reasoner** | `@senars/metareasoner/reasoner` | + Inference substrate, NAL valuation, revision, linear κ | Ω-Calculus S0, AEGIS Phase 0 | Symbolic reasoning core |
| **Ω₂ Agent** | `@senars/metareasoner/agent` | + Full GateLattice, TrustField, Economy pricing, RiskManifold, Conditional ControlGraph | Ω-Calculus S1–S2, AEGIS Phase 1–2, Ambitious Phase 1–2 | Governed interaction |
| **Ω₃ Cognitive** | `@senars/metareasoner/cognitive` | + Heterochronous tower, market economy, meta-controller, drives, consolidation, imagination, reflexivity | Ω-Calculus S3, AEGIS Phase 3–5, Ambitious Phase 3, Θ | Rich agency (budgeted) |
| **Ω₄ Ecological** | `@senars/metareasoner/ecological` | + Cellular composition (ACS), peer delegation, collective calibration, provenance fusion, recursive governance (Meta) | Ω-Calculus S4, ACS Phase 4–7, AEGIS Phase 6–7 | Multi-agent (after single-agent stability) |

**Implementation:** Each tier = `ControlModel` composition. Entry points: `createKernel()`, `createReasoner()`, `createAgent()`, `createCognitive()`, `createEcological()`.

**Conservative extension guarantee:** Each tier adds coordinates; no invariant moves. `Ω₀ ⊑ Ω₁ ⊑ Ω₂ ⊑ Ω₃ ⊑ Ω₄` (refinement).

---

### Phase 8: README & Documentation (Week 10)

**Objective:** Generate `README.md` for system overview and purpose (per `abstract.md` requirement).

| Task | File | Description |
|------|------|-------------|
| 8.1 | `docs/readme/metareasoner.md` | System overview: purpose, architecture (7 sorts), control models, tiers, quick start |
| 8.2 | `docs/readme/control-models.md` | Catalog of built-in models, how to compose custom models |
| 8.3 | `docs/readme/migration.md` | Migration guide from `NARBuilder` → `ControlModel` |
| 8.4 | `pnpm readme` | Generate root `README.md` |

---

## 4. Shared Components & Refactoring for Shareability

### 4.1 Components to Extract/Share (Union of All Flavors)

| Component | Current Location | New Location | Shared By | Flavor-Specific Notes |
|-----------|------------------|--------------|-----------|----------------------|
| `CognitiveRegistry` + 5 strategy slots | `nar/src/cognitive/` | `metareasoner/src/strategies/` | All models | Math: category-theoretic strategies; Thermodynamic: temperature-modulated |
| `GateRegistry` + 4 gates | `nar/src/kernel/` | `metareasoner/src/gates/` | All models | AEGIS: unified admission functional; ACS: membrane per cell; Θ: trust field |
| `ControlBudgets` + `KernelBudgetGate` | `nar/src/kernel/` | `metareasoner/src/budget/` | All models | AEGIS: market clearing; ACS: budget lattice with transfer; Θ: thermodynamic energy + entropy |
| `Memory` + 9 ports | `nar/src/memory/` | `metareasoner/src/memory/` | All models | ACS: cellular cytosol/nucleus; Θ: energy landscape |
| `TaskManager` + `Task` lifecycle | `nar/src/task/` | `metareasoner/src/task/` | All models | Universal: CognitiveTransaction replaces Task; ACS: per-cell |
| `RuleProcessor` + `RuleTableStore` | `nar/src/rules/` | `metareasoner/src/rules/` | NAL-based models | Math: exact co-substrate (MeTTa) as separate port; ACS: genome as rules |
| `DriveManager` + drives | `nar/src/drives/` | `metareasoner/src/drives/` | Cognitive/Ecological tiers | AEGIS: homeostatic drives; ACS: drive specs with setpoints; Θ: temperature dynamics |
| `RLFPLearner` + `PolicyOptimizer` | `nar/src/rlfp/` | `metareasoner/src/learning/` | Models with adaptation | Universal: meta-controller; AEGIS: learning ladder; Ambitious: governed proposals |
| `EventLog` + `CognitiveEvent` | `core/src/eventlog/` | `metareasoner/src/events/` | All models (provenance) | Universal: causal DAG; Ω: control-plane provenance; ACS: organism event log |
| `NARExecution` → `StageGraphRunner` | `nar/src/nar-execution.ts` | `metareasoner/src/runner/` | All models | Universal: KAT runner; AEGIS: heterochronous tower; ACS: per-cell runner |
| `CognitiveController` | `nar/src/cognitive/` | `metareasoner/src/control/` | All models | Universal: meta-controller; Θ: meta-controller as reasoner |
| `SchemaInductor` | `nar/src/learning/` | `metareasoner/src/learning/` | Models with learning | AEGIS: schema induction as F₃ proposal; ACS: cell-type creation |
| `GovernanceResolver` | `nar/src/governance/` | `metareasoner/src/governance/` | All models with self-mod | Universal: filtration F₀–F₄; Ambitious: governance pipeline; ACS: L0–L6 ladder |
| **New: CommitLedger** | — | `metareasoner/src/ledger/` | **All models** | Universal: single commit authority; AEGIS: one port; Ambitious: unified; ACS: nucleus; Θ: single surface |
| **New: ControlGraph** | — | `metareasoner/src/topology/` | **All models** | Universal: KAT; AEGIS: conditional DAG; Ambitious: graph; ACS: genome; Θ: stage graph |
| **New: ResourceEconomy** | — | `metareasoner/src/economy/` | **All models** | Universal: module over semiring; AEGIS: market; Ambitious: reservations+pricing; ACS: metabolic; Θ: thermodynamic |
| **New: MetaController** | — | `metareasoner/src/meta/` | Ω₃+ tiers | Universal: governed proposer; AEGIS: portfolio; Ambitious: learned; Θ: free-energy minimizer |
| **New: CellRuntime** | — | `metareasoner/src/cellular/` | ACS (Ω₄) | ACS: isolated execution context per cell; division/apoptosis |

### 4.2 Refactoring Principles (per AGENTS.md + all synth)

- **DRY:** Single implementation per sort, parameterized by config (not duplicated per flavor)
- **Composition over inheritance:** Models compose sorts, don't extend base class
- **Typed ports:** All cross-sort deps via interfaces (e.g., `BudgetEconomy` not `ControlBudgets`)
- **No circular deps:** Ports → Models → Runner (one direction)
- **Test objects directly:** No mocks; test `StageGraphRunner` with real `ControlTopology`
- **Conservative extensions:** Each tier/flavor adds coordinates; no invariant moves (Ω-Calculus §15, AEGIS §17)
- **Feasibility validation:** Every configuration validated against Φ at load time (Ω-Calculus §14, Math §15)

---

## 5. Configuration & Scalability

### 5.1 Design Selection Bundle (from `synthesize.md`)

Every `ControlModel` declares its **design selection bundle** — the synthesis bias that produced it:

```typescript
interface DesignSelection {
  primeObjectives: PrimeObjective[];      // O1–O14 from synthesize.md
  hardConstraints: HardConstraint[];      // H1–H10 (all required)
  antiGoals: AntiGoal[];                  // A1–A7 (which are rejected/resolved)
  characterBias: CharacterBias[];         // D1–D6 with precedence order
  feasibilityPredicate: Φ;                // Inter-plane constraints
}
```

Examples:
- `Universal`: Full Synergistic Target (all O1–O14, all H1–H10, reject A1,A2,A4,A5,A7, D3>D1>D5>D6>D2>D4)
- `AEGIS`: Ambitious set + O14 ecological; precedence Safety > Audit > Unification > Modularity > Adaptivity > Power > Robustness
- `Ambitious`: Full Synergistic Target; 4-phase migration
- `ACS`: O1,O2,O3,O4,O6,O7,O8 primary; D3/D6/D4 primary; autopoietic closure P6
- `Math`: O1,O2,O3,O4,O6,O7,O8,O12; D3 unification primary; 12 laws L1–L12
- `Thermodynamic`: O1,O2,O3,O4,O6,O8; D3 primary, D4 secondary, D6 tertiary; 6 unifications

### 5.2 Configuration Schema

```typescript
// metareasoner.config.ts
interface MetaReasonerConfig {
  controlModel: string | ControlModel;  
  // 'default' | 'sg' | 'jc' | 'bb' | 'mc' | 'universal' | 'aegis' | 'ambitious' 
  // | 'acs' | 'math' | 'thermodynamic' | 'category' | 'topological' | 'cybernetic' | 'meta' | custom
  tier: 'kernel' | 'reasoner' | 'agent' | 'cognitive' | 'ecological';
  topology?: Partial<ControlTopology>;
  gates?: Partial<GateLattice>;
  economy?: Partial<BudgetEconomy>;
  strategies?: Partial<StrategyOperad>;
  valuation?: Partial<ValuationAlgebra>;
  memory?: Partial<MemoryPorts>;
  policy?: Partial<PolicyAlgebra>;
  // Design selection override (validated against Φ)
  designSelection?: Partial<DesignSelection>;
}
```

### 5.3 Builder Integration

```typescript
// NARBuilder extension
withControlModel(model: string | ControlModel): this;
withTier(tier: MetaReasonerConfig['tier']): this;
withTopology(partial: Partial<ControlTopology>): this;
withGates(partial: Partial<GateLattice>): this;
withEconomy(partial: Partial<BudgetEconomy>): this;
withStrategies(partial: Partial<StrategyOperad>): this;
withValuation(partial: Partial<ValuationAlgebra>): this;
withMemory(partial: Partial<MemoryPorts>): this;
withPolicy(partial: Partial<PolicyAlgebra>): this;
withDesignSelection(partial: Partial<DesignSelection>): this;
```

### 5.4 Profiles as Data (existing pattern)

```typescript
// nar/src/agent/profiles.ts additions
export const METAREASONER_PROFILES = {
  // Ω₀–Ω₄ base tiers
  'minimal':         { controlModel: 'default',   tier: 'kernel' },
  'standard':        { controlModel: 'default',   tier: 'agent' },
  
  // Evolution roadmap (space.b.2)
  'adaptive':        { controlModel: 'sg',        tier: 'cognitive' },
  'judgment-continuum': { controlModel: 'jc',    tier: 'cognitive' },
  'economic':        { controlModel: 'bb',        tier: 'cognitive' },
  'learned':         { controlModel: 'mc',        tier: 'cognitive' },
  
  // Synth flavors (all mapped to tiers)
  'universal':       { controlModel: 'universal', tier: 'cognitive' },
  'aegis':           { controlModel: 'aegis',     tier: 'cognitive' },
  'ambitious':       { controlModel: 'ambitious', tier: 'cognitive' },
  'thermodynamic':   { controlModel: 'thermodynamic', tier: 'cognitive' },
  'math':            { controlModel: 'math',      tier: 'cognitive' },
  'category':        { controlModel: 'category',  tier: 'cognitive' },
  'topological':     { controlModel: 'topological', tier: 'cognitive' },
  'cybernetic':      { controlModel: 'cybernetic', tier: 'cognitive' },
  'meta':            { controlModel: 'meta',      tier: 'ecological' },
  'acs':             { controlModel: 'acs',       tier: 'ecological' },
  
  // Behavioral coordinates (from ambitious.qw1 §6)
  'reflexive':       { controlModel: 'custom', tier: 'agent', 
    topology: { scheduler: 'priority-queue' }, economy: { policy: 'latency-first' } },
  'theorem-prover':  { controlModel: 'custom', tier: 'reasoner',
    topology: { scheduler: 'proof-progress' }, gates: { admission: 'proof-gated' } },
  'creative':        { controlModel: 'custom', tier: 'cognitive',
    topology: { scheduler: 'novelty-weighted' }, economy: { policy: 'high-diversity' } },
  'safe-production': { controlModel: 'custom', tier: 'cognitive',
    gates: { admission: 'calibrated+proof+human' }, policy: { autonomy: 'human-approved' } },
} as const;
```

---

## 6. Testing Strategy

### 6.1 Unit Tests (per sort)

| Sort | Test File | Key Properties |
|------|-----------|----------------|
| Topology | `topology.test.ts` | DAG validity, KAT laws, nesting depth, guard evaluation, heterochronous tower |
| Gates | `gates.test.ts` | Lattice laws, orientation, trust field calibration, risk classification, unified admission |
| Budget | `budget.test.ts` | Monoid laws, open-once, reservations, pricing, thermodynamic allocation, entropy accounting |
| Strategies | `strategies.test.ts` | Slot typing, composition law γ, resolution ρ, 5760 profiles, continuous manifold |
| Valuation | `valuation.test.ts` | Evidence monoid, revision commutativity, epistemic/teleological/procedural/meta firewall, paraconsistency |
| Memory | `memory.test.ts` | 9 ports, Bag ops, CommitLedger fold = state, single write path, cellular cytosol/nucleus |
| Policy | `policy.test.ts` | Degradation lattice, fault→response, H9 no silent faults, autonomy ladder |

### 6.2 Integration Tests (All Flavors)

| Test | Command | Verifies |
|------|---------|----------|
| Default parity | `pnpm test:default-parity` | `ControlModel.Default` ≡ current SeNARS behavior |
| SG conditional skip | `pnpm test:sg-skip` | Stage graph guards work |
| JC judgment continuum | `pnpm test:jc-trust` | Continuous trust field, calibrated admission |
| BB priority preempt | `pnpm test:bb-preempt` | High-priority claim preempts low |
| MC learning | `pnpm test:mc-learn` | Meta-controller adapts to budget pressure |
| Universal Ω-Calculus | `pnpm test:universal` | All 12 laws L1–L12, 5 strata, heterochronous tower |
| AEGIS | `pnpm test:aegis` | 9-tuple, market economy, governance manifold, precedence order |
| Ambitious | `pnpm test:ambitious` | 12-tuple, 4-phase migration, behavioral coordinates |
| ACS (Bio) | `pnpm test:acs` | Cellular lifecycle, division/apoptosis, tissues/organs, multi-rate |
| Math | `pnpm test:math` | 4 planes, L1–L12, Φ constraints, compositionality theorems |
| Thermodynamic | `pnpm test:thermodynamic` | Free-energy minimization, temperature T, entropy budget, 6 unifications |
| Constitution gates | `pnpm test:constitution` | All H1–H10 + L1–L12 enforced (type + runtime) |
| Replay determinism | `pnpm test:replay` | `replay(events) ≅ id` for all flavors |
| Tier isolation | `pnpm test:tiers` | Ω₀ ⊑ Ω₁ ⊑ Ω₂ ⊑ Ω₃ ⊑ Ω₄ |
| Feasibility | `pnpm metareasoner:feasibility <flavor>` | Φ constraints hold for each flavor |

### 6.3 Benchmarks

| Benchmark | Command | Target |
|-----------|---------|--------|
| Cycle throughput | `pnpm cycle-bench` | ≥ current SeNARS |
| Memory overhead | `pnpm bench:memory` | ≤ 10% increase |
| Ledger latency | `pnpm bench:ledger` | < 1ms per commit |
| Stage graph dispatch | `pnpm bench:dispatch` | < 50µs per stage |
| Meta-controller selection | `pnpm bench:meta` | < 5ms per program selection |
| Cell instantiation (ACS) | `pnpm bench:cell` | < 1ms per cell |

---

## 7. Migration Path (Incremental Implementability — Objective C4 / Anti-goal A1)

| Step | Action | Risk | Rollback |
|------|--------|------|----------|
| 1 | Add `metareasoner/` package with ports (Phase 0) | None | Delete package |
| 2 | Implement `ControlModel.Default` wrapping existing (Phase 1) | Low | Feature flag `useMetareasoner=false` |
| 3 | Add `CommitLedger` behind flag (Phase 2) | Medium | Flag off → old `authorize` path |
| 4 | Add `StageGraphRunner` behind flag (Phase 3) | Medium | Flag off → `NARExecution` |
| 5 | Enable `ControlModel.Default` via flag in `NARBuilder` | Low | Flag off |
| 6 | Add `SG`, `JC`, `BB`, `MC` models (Phases 3–5) | Low | Don't register |
| 7 | Port `Universal`, `AEGIS`, `Ambitious` (Phase 6a) | Low | Don't register |
| 8 | Port `ACS`, `Math`, `Thermodynamic`, `Category`, `Topological`, `Cybernetic`, `Meta` (Phase 6b) | Low | Don't register |
| 9 | Expose tiers Ω₀–Ω₄ (Phase 7) | Low | Don't export |
| 10 | Default to `ControlModel.Default` + `CommitLedger` | Medium | Can revert to `NARExecution` |
| 11 | Deprecate `NARExecution` direct use | Low | Keep for 1 major version |

**Feature flag:** `SENARS_METAREASONER=1` (env) or `metareasoner: true` (config).

**Conservative extension guarantee (from Ω-Calculus §15.3, AEGIS §17, ACS §15.4):**
- Each phase preserves all hard constraints (H1–H10) and feasibility constraints (Φ1–Φ12, L1–L12)
- Later strata never invalidate earlier ones
- The elegance never depends on replacing the whole runtime at once
- Minimal runnable kernel exists at every stage (Ω₀)

---

## 8. CI Gates (New + Extended)

| Gate | Command | Enforces |
|------|---------|----------|
| `metareasoner:ports` | `pnpm metareasoner:ports` | All 7 sort interfaces compile, no circular deps |
| `metareasoner:constitution` | `pnpm metareasoner:constitution` | Φ (H1–H10 + L1–L12) type-check + runtime assertions |
| `metareasoner:default-parity` | `pnpm test:default-parity` | Default model ≡ current behavior |
| `metareasoner:replay` | `pnpm test:replay` | Event log replay = state for all flavors |
| `metareasoner:tiers` | `pnpm test:tiers` | Tier inclusions valid (Ω₀ ⊑ Ω₁ ⊑ Ω₂ ⊑ Ω₃ ⊑ Ω₄) |
| `metareasoner:complexity` | `pnpm complexity:budget` | Complexity budget maintained |
| `metareasoner:feasibility` | `pnpm metareasoner:feasibility <flavor>` | Φ constraints hold per flavor |
| `metareasoner:design-selection` | `pnpm metareasoner:design-selection <flavor>` | Design selection bundle documented and consistent |

---

## 9. File Structure (New)

```
metareasoner/
├── src/
│   ├── ports/
│   │   ├── topology.ts
│   │   ├── gates.ts
│   │   ├── budget.ts
│   │   ├── strategies.ts
│   │   ├── valuation.ts
│   │   ├── memory.ts
│   │   ├── policy.ts
│   │   ├── constitution.ts
│   │   ├── design-selection.ts
│   │   └── index.ts
│   ├── ledger/
│   │   ├── transaction.ts
│   │   ├── ledger.ts
│   │   ├── normalize.ts
│   │   ├── prove.ts
│   │   ├── rank.ts
│   │   ├── risk.ts
│   │   ├── integrate.ts
│   │   ├── replay.ts
│   │   └── index.ts
│   ├── topology/
│   │   ├── stage-graph.ts
│   │   ├── control-word.ts
│   │   ├── runner.ts
│   │   ├── heterochronous-tower.ts
│   │   └── index.ts
│   ├── economy/
│   │   ├── budget-algebra.ts
│   │   ├── reservations.ts
│   │   ├── pricing.ts
│   │   ├── market.ts
│   │   ├── thermodynamic.ts
│   │   └── index.ts
│   ├── cellular/
│   │   ├── cell.ts
│   │   ├── membrane.ts
│   │   ├── metabolism.ts
│   │   ├── genome.ts
│   │   ├── organism.ts
│   │   ├── tissues.ts
│   │   ├── signaling.ts
│   │   ├── homeostasis.ts
│   │   ├── lifecycle.ts
│   │   └── index.ts
│   ├── meta/
│   │   ├── controller.ts
│   │   ├── selection.ts
│   │   ├── blend.ts
│   │   ├── reflexivity.ts
│   │   └── index.ts
│   ├── models/
│   │   ├── default/
│   │   ├── sg/
│   │   ├── jc/
│   │   ├── bb/
│   │   ├── mc/
│   │   ├── universal/
│   │   ├── aegis/
│   │   ├── ambitious/
│   │   ├── acs/
│   │   ├── math/
│   │   ├── thermodynamic/
│   │   ├── category/
│   │   ├── topological/
│   │   ├── cybernetic/
│   │   ├── meta/
│   │   └── index.ts
│   ├── control-model.ts
│   ├── config.ts
│   └── index.ts
├── tests/
│   ├── ports/
│   ├── ledger/
│   ├── topology/
│   ├── economy/
│   ├── cellular/
│   ├── meta/
│   ├── models/
│   └── integration/
├── docs/
│   └── readme/
│       ├── metareasoner.md
│       ├── control-models.md
│       ├── migration.md
│       ├── design-selection.md
│       └── flavors/
│           ├── universal.md
│           ├── aegis.md
│           ├── ambitious.md
│           ├── acs.md
│           ├── math.md
│           ├── thermodynamic.md
│           ├── category.md
│           ├── topological.md
│           ├── cybernetic.md
│           └── meta.md
└── package.json
```

---

## 10. Success Criteria

| Criterion | Measure | Target |
|-----------|---------|--------|
| **Parity** | `pnpm test:default-parity` | 100% pass, identical event logs |
| **Modularity** | `ControlModel` composition | Any 2 models compose without conflict |
| **Scalability** | Tier Ω₀ bundle size | < 50KB gzipped |
| **Expressivity** | `synth/` flavors ported | All 14 flavors runnable (Universal, AEGIS, Ambitious, ACS, Math, Thermodynamic, Category, Topological, Cybernetic, Meta, SG, JC, BB, MC) |
| **Auditability** | `pnpm test:replay` | Deterministic replay for all models |
| **Safety** | `pnpm metareasoner:constitution` | All H1–H10 + L1–L12 enforced |
| **Feasibility** | `pnpm metareasoner:feasibility <flavor>` | All Φ constraints hold per flavor |
| **Performance** | `pnpm cycle-bench` | ≤ 5% overhead vs current |
| **Documentation** | `pnpm readme` | Generated README covers all models, design selections, flavors |

---

## 11. Timeline Summary

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1–2 | 0 | 7 sort port interfaces + design selection + constitution |
| 2–3 | 1 | `ControlModel.Default` (parity) |
| 3–4 | 2 | `CommitLedger` (single write path) |
| 4–5 | 3 | `StageGraph` + KAT (`ControlModel.SG`, `JC`) |
| 5–6 | 4 | `ClaimQueue` (`ControlModel.BB`) |
| 6–7 | 5 | `MetaController` (`ControlModel.MC`) |
| 7–8 | 6a | `Universal`, `AEGIS`, `Ambitious` flavors |
| 8–9 | 6b | `ACS`, `Math`, `Thermodynamic`, `Category`, `Topological`, `Cybernetic`, `Meta` flavors |
| 9–10 | 7 | Ω₀–Ω₄ tiers exposed |
| 10 | 8 | README + migration docs + flavor docs |

**Total: ~10 weeks** (can parallelize Phases 3–6 after Phase 2 lands).

---

## 12. Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Performance regression | Benchmark at each phase; feature flag to disable |
| Over-abstraction | Kernel-first (Ω₀ runnable at Phase 0); reject Anti-goal A1 |
| Constitution violations | Type-level H1–H10 + CI gate `metareasoner:constitution` |
| Migration breakage | Incremental flags; `Default` model wraps existing code |
| Synth flavor divergence | All flavors compose from same 7 sorts; registry enforces Φ |
| Governance paralysis | Risk manifold auto-routes low-risk; only high-risk needs human |

---

## 13. Appendix: Mapping to Design Documents

| Document | Contribution to Plan |
|----------|---------------------|
| `abstract.md` | Requirements: versatile control models, shared components, configurable, README |
| `space.a.1` | 7 sorts → port interfaces; algebraic laws → CI gates |
| `space.a.2` | KAT control words → `ControlTopology`; Proposer/Judge adjunction → `GateLattice` |
| `space.a.3` | Compositionality → `ControlModel.compose/restrict/lift` |
| `space.a.4` | 7-tuple → `ControlModel`; scheduling as bottleneck → `ControlTopology` |
| `space.a.5` | 8 axes + moves M1–M8 → `ControlModel` variations |
| `space.b.1` | Guarantee conservation → Constitution Φ; control policy π as central |
| `space.b.2` | Evolution roadmap SG→JC→BB→MC → Phases 3–5 |
| `space.b.3` | Thermodynamic budget → `BudgetEconomy` pricing + Boltzmann |
| `space.c.1` | Cognitive transactions + unified commit ledger → Phase 2 |
| `control.space.a` | 12D genome → compact model comparison |
| `control.space.b` | 37D + declared/realized/wiring mask → Phase 0 port realism |
| `control.space.c` | Feasibility constraints Φ → Constitution enforcement |
| `information.space.a` | Coupling constraints Ψ → H1, H2, H4, H8, H10 |
| `information.space.b` | 29-axis inventory → port completeness check |
| `information.space.c` | DSR 20-axis + feasibility → Constitution + tier gates |
| `synthesize.md` | Objectives O1–O14, Constraints H1–H10, Anti-goals A1–A7, Character D1–D6 → Plan biases; Design Selection Bundle per flavor |
| `universal.qw1.md` + `universal.qw2.md` | Ω-Calculus full spec → Target architecture (Phases 2–7); 12 laws L1–L12; 5 strata |
| `flexible.qw1.md` (AEGIS) | 9-tuple reasoner; cognitive transactions; market economy; governance manifold; heterochronous tower; precedence order |
| `ambitious.qw1.md` + `ambitious.oc1.md` | 12-tuple (Σ,Ω,Π,Τ,Κ,Φ,Λ,Β,Γ,Ψ,Θ,Ε); CognitiveTransaction + ControlGraph + CommitLedger + ResourceEconomy; 4-phase migration; behavioral coordinates |
| `bio.qw1/2/3.md` (ACS) | Autopoietic Cognitive Substrate: cellular composition (Cell = membrane+metabolism+genome+cytosol+nucleus+identity); cell division/apoptosis; tissues/organs; multi-rate coordination; organism constitution |
| `math.qw1/2/3.md` (Ω-Calculus algebraic) | 4 planes (I epistemic, II control, III governance, IV provenance); 12 laws L1–L12; feasibility predicate Φ (12 constraints); 5-stratum construction; compositionality theorems |
| `thermodynamic.qw1/2/3.md` (Θ) | Free-energy minimization; cognitive temperature T; entropy budget; energy landscape; 6 unifications; thermal annealing; 12 Φ constraints |
| `category.qw1/2/3.md` | Category-theoretic: coalgebras, fibrations, natural transformations; typed ports as morphisms |
| `topological.qw1/2/3.md` | Topological: sheaf semantics, nerve complexes, persistent homology; geometric control |
| `cybernetic.qw1/2/3.md` | Cybernetic: homeostatic control, requisite variety, viability; autonomy ladder as feedback |
| `meta.qw1/2/3.md` | Meta-reasoning: reflective tower, recursive governance, self-observation cells |
| `compare.md` | Spec families → Phase 6 flavor mapping |
| `flow.*.md` (control1/2, information1) | Current implementation → Phase 1 extraction targets |
| `AGENTS.md` | Code guidelines → Implementation standards |

---

*End of plan. Ready for implementation.*

---

*End of plan. Ready for implementation.*