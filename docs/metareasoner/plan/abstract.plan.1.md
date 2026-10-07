# Abstracting SeNARS: Development Plan for Versatile Control Models

## Executive Summary

This plan extracts the **load-bearing control architecture** from the current SeNARS implementation and refactors it into a **pluggable control-model framework** that supports:
- The existing SeNARS control (hard-coded 6-stage micro-tick + 8-phase macro-cycle)
- All `synth/` flavors (AEGIS, Ω-Calculus, Θ, SeNARS⁺, coalgebraic, etc.)
- Future control models yet to be designed

The core insight: **control flow must become data**, not code. The current fixed loops are one point in a design space; the framework makes that space navigable while preserving all hard constraints (H1–H10).

---

## Phase 0: Foundational Extraction (Weeks 1–2)

### 0.1 Identify the Immutable Kernel
Extract the **five irreducible components** that every control model must have (per `synth/category.qw1.md` §2.2):
| Generator | Current SeNARS Location | Port Interface |
|-----------|------------------------|----------------|
| `obs` | `NARExecution.perceive` + `NARIO.input` | `PerceptionPort` |
| `step` | `InferenceController.step` | `InferencePort` |
| `emit` | `CycleTrace` + `EventLog` | `ProvenancePort` |
| `charge` | `ControlBudgets.charge` | `BudgetPort` |
| `gate` | `GateRegistry` (4 gates) | `GovernancePort` |

**Deliverable:** `ControlKernel` trait/interface with these 5 ports. Current SeNARS becomes `DefaultControlKernel`.

### 0.2 Define the Control Model Interface
```typescript
interface ControlModel {
  // The control word / stage graph (data, not code)
  readonly controlWord: ControlWord;          // KAT expression or ConditionalDAG
  
  // Port implementations (replaceable)
  readonly perception: PerceptionPort;
  readonly inference: InferencePort;
  readonly provenance: ProvenancePort;
  readonly budget: BudgetPort;
  readonly governance: GovernancePort;
  
  // Execution protocol
  initialize(kernel: ControlKernel): Promise<void>;
  executeCycle(ctx: CycleContext, signal: AbortSignal): Promise<CycleResult>;
  getControlWord(): ControlWord;
  setControlWord(word: ControlWord): Promise<void>;  // governed hot-swap
}
```

### 0.3 Extract the Transaction Model
Unify `CognitiveTransaction` from `synth/` specs as the **universal unit of work**:
- Current: tasks, derivations, proposals, tool goals, learning updates
- Target: single `CognitiveTransaction` type with `kind`, `axis`, `budget`, `trust`, `risk`, `proofObligations`, `fallback`

**Refactoring:** Replace `Task`, `Derivation`, `Proposal`, `ToolGoal` with `CognitiveTransaction` subtypes. The `CommitLedger` becomes the single write path.

---

## Phase 1: Control Abstraction Layer (Weeks 3–5)

### 1.1 Control Word as First-Class Data
Implement `ControlWord` with three equivalent representations (per `synth/meta.qw1.md` §3):
| Representation | Use Case | Compilation |
|----------------|----------|-------------|
| KAT Expression | Formal analysis, verification | → ConditionalDAG |
| Conditional DAG | Runtime execution | → StageGraphRunner |
| Stage Graph | Visualization, editing | ↔ KAT (bi-directional) |

**Stage Graph Structure:**
```typescript
interface StageNode {
  id: StageId;
  kind: StageKind;           // perceive | attend | retrieve | infer | propose | verify | rank | commit | plan | act | learn | consolidate | forget | simulate | metapropose
  run: Middleware<CycleContext>;  // stage handler
  budgetScope: BudgetScopeId;
  gates: GateId[];
  preconditions: Predicate[];
  postconditions: Predicate[];
  failurePolicy: FailurePolicy;
}

interface StageEdge {
  from: StageId;
  to: StageId;
  guard: (ctx: CycleContext) => boolean;
  costScope?: BudgetScopeId;
}
```

**Graph Invariants (compile-time checked):**
- No path `infer →* commit` without `verify`
- No path `infer →* propose` within single inference scope
- No untrusted commit without judge scoring
- No `teleological` stage → `belief`-writing stage
- Every node has budget scope; every `commit`/`act` node has gates

### 1.2 Stage Graph Runner
Replace `NARExecution.run()`'s hard-coded `for` loop with `StageGraphRunner`:
```typescript
class StageGraphRunner {
  async run(graph: StageGraph, ctx: CycleContext, signal: AbortSignal): Promise<CycleResult> {
    let node = graph.entry;
    while (node !== graph.exit && !signal.aborted) {
      await this.executeNode(node, ctx);
      node = this.selectNextEdge(graph, node, ctx);
    }
  }
}
```

**Migration:** Current 6-stage micro-tick becomes `DefaultControlWord` (a `ControlWord` instance). Zero behavior change.

### 1.3 Port Extraction & Typing
Create typed port interfaces in `core/ports/`:
| Port | Current Implementation | Interface Methods |
|------|------------------------|-------------------|
| `PerceptionPort` | `KernelPerceptionGate` + `NARIO` | `admit(input)`, `admitTask(term, type, truth, source, cid)`, `admitFormalization(batch)` |
| `InferencePort` | `InferenceController` | `step(timeout, maxResults, signal): AsyncIterable<CognitiveTransaction>` |
| `ProvenancePort` | `CycleTrace` + `EventLog` | `beginCycle(cid)`, `beginStage(sid)`, `endStage()`, `emit(event)`, `correlationId()` |
| `BudgetPort` | `ControlBudgets` | `beginCycle()`, `charge(scope, cost)`, `reserve(bid)`, `settle(reservation, actual)`, `getSummary()` |
| `GovernancePort` | `GateRegistry` (4 gates) | `perception.check()`, `action.check()`, `reward.check()`, `budget.check()` |

---

## Phase 2: Commit Ledger Unification (Weeks 6–7)

### 2.1 Single Commit Surface
Implement `CommitLedger` per `synth/flexible.qw1.md` §5 and `synth/meta.qw1.md` §4:
```typescript
interface CommitLedger {
  commit(tx: CognitiveTransaction, ctx: CommitContext): Promise<CommitResult>;
}

interface CommitContext {
  budget: BudgetState;
  riskPolicy: RiskPolicy;
  autonomyPolicy: AutonomyPolicy;
  verificationPolicy: VerificationPolicy;
}
```

**Commit Pipeline (all mutations):**
```
Candidate → Normalize → TypeCheck → AxisCheck(firewall) → EvidenceIndependence
  → Proof/Judge/Simulate → Rank → BudgetSettle → RiskClassify → GovernanceGate
  → Commit | Reject | Defer | ProvisionalCommit | ShadowCommit | Degrade
```

### 2.2 Migrate All Write Paths
| Current Write Path | Migration Target |
|--------------------|------------------|
| `memory.addTask()` (perceive/authorize) | `CommitLedger.commit(CT{kind:'perception'|'inference', ...})` |
| `RuleTableStore.admit()` (rule proposals) | `CommitLedger.commit(CT{kind:'self-modification', ...})` |
| `ToolManager.execute()` (tool goals) | `CommitLedger.commit(CT{kind:'action', ...})` |
| `driveManager.stimulate()` | `CommitLedger.commit(CT{kind:'learning', axis:'teleological', ...})` |
| `consolidateLearning()` | `CommitLedger.commit(CT{kind:'consolidation', ...})` |
| `cognitiveController.adapt()` (strategy change) | `CommitLedger.commit(CT{kind:'meta-control', ...})` |

### 2.3 Event-Sourced Fold
- `EventLog` becomes source of truth; `Memory` state is a cached fold
- `replay(events)` reconstructs state; hash verification confirms determinism
- Pure reducers guarantee `replay ∘ log ≅ id`

---

## Phase 3: Resource Economy (Weeks 8–9)

### 3.1 Budget Algebra Generalization
Replace fixed `BUDGET_SCOPES` with **Budget Lattice** (per `synth/meta.qw1.md` §5):
```typescript
interface BudgetScope {
  id: BudgetScopeId;
  dimensions: CostVector;        // cycles, derivations, premises, memoryOps, llmCalls, tokens, latency, attention, risk, humanAttention
  ceiling: CostVector;
  terminationReason: TerminationReason;
  parent?: BudgetScopeId;        // lattice structure
  transferRules: TransferRule[]; // surplus lending
}
```

### 3.2 Reservation Protocol
- `reserve(bid)` before execution → `available ← available − reserved`
- `settle(reservation, actual)` after → `available ← available + (reserved − used)`
- Denied reservation = typed `BudgetExhausted` event (not silent drop)

### 3.3 Utility-Based Scheduling (Optional Layer)
```typescript
score(tx) = (ΔK̂ + ΔĜ + ΔĤ) / (λc·Ĉ + λr·R̂ + λh·Ĥhuman)
```
- `ΔK̂`: expected epistemic gain (uncertainty reduction)
- `ΔĜ`: expected teleological gain (goal progress)  
- `ΔĤ`: expected homeostatic gain (drive balance)
- Enables economic allocation; falls back to priority queue when disabled

### 3.4 Thermodynamic Extension (Optional)
- Activation energy per task: `E = surprise + utility + drive - age`
- Global temperature `T` modulates `P(pursue) ∝ exp(−ΔE/T)`
- Configurable economy mode, not required

---

## Phase 4: Governance & Trust Manifold (Weeks 10–11)

### 4.1 Oriented Gate Lattice
Generalize 4 gates to **oriented morphisms** (per `synth/meta.qw1.md` §6.4):
```typescript
type GateOrientation = 'interior' | 'closure';  // fail-closed | fail-open

interface Gate {
  id: GateId;
  orientation: GateOrientation;
  check(candidate: CognitiveTransaction): Promise<GateResult>;
  compose(other: Gate): Gate;  // serial, parallel, voting, fallback
}
```

**Default:** `ingress=interior`, `egress=closure` (configurable per deployment).

### 4.2 Continuous Trust Field
Replace binary admit/reject with calibrated trust profile:
```typescript
interface TrustProfile {
  sourceQuality: number;       // PRIMARY=0.9, LLM_PRIOR=0.5, etc.
  sourceReputation: number;    // learned multiplier (floor 0.5)
  claimSpecificity: number;
  corroboration: number;
  calibratedScore?: number;    // manifold head output (isotonic)
  judgeStatus: JudgeStatus;
  proofStatus: ProofStatus;
  digestPinned: boolean;
}
```

**Admission Bands:**
- `Act`: `T ≥ θ_act` → direct commit
- `Review`: `θ_defer ≤ T < θ_act` → provisional commit + decay
- `Block`: `T < θ_defer` → reject/abstain → clarification question

### 4.3 Risk/Reversibility Manifold
```typescript
interface GovernanceProfile {
  trust: number;
  confidence: number;
  risk: number;
  reversibility: number;    // 0=irreversible ... 1=pure
  blastRadius: number;
  proofStatus: ProofStatus;
  judgeStatus: JudgeStatus;
  simulationStatus: SimulationStatus;
}
```

**Commit Path Policy Surface** (generalizes action autonomy to all mutations):
| Trust | Risk | Reversibility | Path |
|-------|------|---------------|------|
| High | Low | High | Auto-commit |
| High | Med | High | Shadow-commit → promote |
| Med | Low | High | Provisional + decay |
| Med | Med | Med | Human review |
| Low | High | Low | Reject |
| Any | High | Low | Strong proof OR human approval |

### 4.4 Autonomy Ladder (Generalized)
`observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production`
- Applies to **all** cognitive mutations, not just external actions
- Irreversible actions require risk classification + authorization (H10)

---

## Phase 5: Substrate Arbitration (Weeks 12–13)

### 5.1 Substrate Port Interface
```typescript
interface SubstratePort {
  readonly type: SubstrateType;  // 'symbolic-nal' | 'exact-metta' | 'probabilistic' | 'neural-manifold' | 'reflex' | 'peer'
  propose(state: CognitiveState, budget: BudgetReservation): Promise<CognitiveTransaction[]>;
  verify(proposal: CognitiveTransaction): Promise<JudgeResult>;
}
```

### 5.2 Arbitration Layer
```typescript
interface ArbitrationLayer {
  registerProposer(port: SubstratePort): void;
  arbitrate(proposals: CognitiveTransaction[]): Promise<ArbitrationResult>;
}
```

**Arbitration Algebra (per `synth/flexible.qw1.md` §10.2):**
- `veto` (symbolic core retains veto)
- `quorum` (k-of-n agreement)
- `weighting` (confidence-weighted merge)
- `demotion` (vetoed proposer's weight decays)

**Firewall Inside Algebra:** `teleological` proposal can never merge into `belief` slot regardless of quorum.

### 5.3 Isolation Invariants (Φ6, Φ8, H8)
- Exact substrate never unions nodes on uncertain similarity
- Substrates exchange proposals through boundary; no shared mutable memory
- Every neural function has symbolic fallback

---

## Phase 6: Reflexive Tower & Meta-Control (Weeks 14–15)

### 6.1 Governed Self-Modification Filtration
```typescript
type ReflexivityLevel = 'L0_frozen' | 'L1_knobs' | 'L2_strategies' | 'L3_rules' | 'L4_control_graph' | 'L5_code' | 'L6_constitution';

interface ReflexivityConfig {
  maxLevel: ReflexivityLevel;
  governance: GovernancePipeline;  // shadow CI + external approval at L5+
}
```

### 6.2 Meta-Controller as Ω Instance
Per `synth/meta.qw1.md` §14: `MetaController = Ω(control-state, control-operators, control-budget)`
- Observes through same perception ports
- Reasons through same inference substrate
- Proposes control-word edits through same proposal pipeline
- Judged by same governance pipeline
- Budgeted by dedicated `control-work` scope
- Every meta-decision = `CognitiveTransaction{kind:'meta-control'}`

### 6.3 Safe Self-Improvement Pipeline
```
Observation → Lesson → Hypothesis → Proposal (strategy/rule/code/graph)
  → Shadow Execution (worktree/sandbox/simulation)
  → Validation (CI, proof, benchmark, drift test)
  → Risk Classification
  → Governance Gate (autonomy level)
  → Bounded Deployment (cycle-boundary hot-swap)
  → Trace Evaluation → Retention | Rollback
```

---

## Phase 7: Provenance Fabric (Weeks 16–17)

### 7.1 Universal Correlation
Every transaction/event carries:
```typescript
interface Provenance {
  correlationId: CorrelationId;   // minted at stimulus
  stimulusId: StimulusId;
  sessionId: SessionId;
  cycleId: CycleId;
  transactionId: TransactionId;
  proposerId: ProposerId;
  judgeId?: JudgeId;
  proofId?: ProofId;
  parentId?: ProvenanceId;        // causal DAG
  budgetScopeId?: BudgetScopeId;
}
```

### 7.2 Causal Query Engine
Support queries:
- Which stimulus caused this belief?
- Which derivation led to this action?
- Which judge vetoed this candidate?
- Which budget exhaustion caused this degradation?
- Which learning episode changed this strategy?
- Which control-word edit changed this cycle's behavior?

### 7.3 Configurable Provenance Depth
| Level | Recorded |
|-------|----------|
| 0 | None (ephemeral) |
| 1 | Final answers only |
| 2 | Derivation conclusions |
| 3 | Step-level derivation traces |
| 4 | Full event log + independent verifier + hash replay |
| 5 | Level 4 + control-plane events (scheduler, budget, graph edits) |

### 7.4 Independent Verification
- Verifier imports **no engine code** (truth table transcribed)
- Drift measured by test, not assumed zero
- `verify-derivation` CLI works on any control model

---

## Phase 8: Configuration & Instantiation (Weeks 18–19)

### 8.1 Declarative Reasoner Spec
```typescript
interface ReasonerSpec {
  substrate: SubstrateConfig;
  control: ControlConfig;        // controlWord, scheduler, parallelFoci
  budget: BudgetConfig;          // dimensions, scopes, lattice, allocation
  governance: GovernanceConfig;  // gates, manifold, autonomy ladder
  valuation: ValuationConfig;    // truth algebra, firewall, ranking
  memory: MemoryConfig;          // bounded bags, decay, ports
  provenance: ProvenanceConfig;  // level, verifier, correlation
  reflexivity: ReflexivityConfig;// level, governance
  arbitration: ArbitrationConfig;// mode, isolation
}
```

### 8.2 Algebraic Composition Operations
| Operation | Symbol | Semantics |
|-----------|--------|-----------|
| Sequential | `c₁ ⊗ c₂` | Run c₁ then c₂ |
| Parallel | `c₁ ⊕ c₂` | Run concurrently, join |
| Restriction | `c \| P` | Project onto capability subset |
| Refinement | `c₁ ⊑ c₂` | Behavioral subset |
| Lifting | `lift(c, f)` | Apply functor to every component |
| Abstraction | `α(c)` | Behavioral equivalence class |

### 8.3 Config-Time Feasibility Validation
Validate `Φ(spec)` at load time (per `synth/meta.qw1.md` §12):
- Reject infeasible combinations before any cognition runs
- Hard constraints H1–H10 enforced as type-level laws where possible

### 8.4 Profiles & Presets
| Profile | Purpose |
|---------|---------|
| `device` | Tier 0: reflex only, no LM import |
| `conversation` | Tier 2: cortex + NAL |
| `tool-use` | Tier 2: + tools |
| `research` | Tier 2: + RLFP |
| `FAST` | Minimal provenance, symbolic only |
| `NEURAL_HEAVY` | Loosened adjunction, full manifold |
| `DEEP_AUDIT` | Full provenance, formal verification |

---

## Phase 9: Migration & Compatibility (Weeks 20–22)

### 9.1 Adapter Layer for Current SeNARS
Create `DefaultControlModel` implementing `ControlModel` that wraps existing code:
- `controlWord` = `DefaultControlWord` (6-stage micro-tick + 8-phase macro-cycle as DAG)
- Ports delegate to current `NARExecution`, `InferenceController`, `GateRegistry`, `ControlBudgets`, `EventLog`
- `CommitLedger` delegates to current `memory.addTask` + `RuleTableStore.admit` + `ToolManager.execute`
- **Zero behavior change**; all tests pass

### 9.2 Incremental Migration Path
| Phase | Delivers | Invariants Active |
|-------|----------|-------------------|
| 0. Kernel | substrate + control word + gate + budget + provenance fold | I1–I3, I5 |
| 1. Ledger | unified commit port; all mutation → transactions | I2, I4 |
| 2. Graph | control flow as data; conditional stages | I7, Φ10 |
| 3. Economy | reservations + prices; static → adaptive budgets | Φ9 |
| 4. Manifold | calibrated judgment; trust/risk/reversibility | Φ2, Φ11 |
| 5. Tower | heterochronous multi-rate loops | Φ7 |
| 6. Reflexivity | governed self-modification ladder | Φ3, Φ4 |
| 7. Ecology | multi-agent delegation & collective verification | Φ2 |

Each phase preserves all prior invariants.

### 9.3 Synth Flavor Implementations
Implement each `synth/` flavor as a `ControlModel` + `ReasonerSpec`:
| Flavor | Key Characteristics | Spec File |
|--------|---------------------|-----------|
| **AEGIS** (flexible) | Full neuro-symbolic, economic, governed | `flexible.qw1.md` |
| **Ω-Calculus** (universal) | Mathematical unification, terminal object | `universal.qw1.md` |
| **Θ** (thermodynamic) | Free-energy, temperature, Boltzmann allocation | `thermodynamic.qw1.md` |
| **SeNARS⁺** (ambitious) | SeNARS evolution path, pragmatic | `ambitious.qw1.md` |
| **Coalgebraic** (category) | Formal coalgebra, graded category | `category.qw1.md` |
| **Cybernetic** | Control-theoretic, feedback loops | `cybernetic.qw*.md` |
| **Bio** | Autopoietic, cellular | `bio.qw*.md` |
| **Math** | Pure algebraic | `math.qw*.md` |

### 9.4 Future-Proofing
- New control models = new `ControlModel` implementations + `ReasonerSpec`
- No framework changes needed for new schedulers, substrates, governance policies
- Port contracts are the stability boundary

---

## Cross-Cutting Refactoring (Parallel, Ongoing)

### R1: Eliminate Hard-Coded Stage Sequences
- **Target:** `NARExecution.run()` 6-stage `for` loop, `Agent` 8-phase pipeline
- **Replace with:** `StageGraphRunner` executing `ControlWord`
- **Verification:** `control1/flow.control.md` behavior identical under `DefaultControlWord`

### R2: Unify Budget System
- **Target:** `KernelBudgetGate` (main + 6 scopes) + `ControlBudgets`
- **Replace with:** Single `BudgetPort` with lattice scopes, reservations, optional pricing
- **Verification:** `pnpm control-budgets` gate passes

### R3: Consolidate Gate Registry
- **Target:** `GateRegistry` (4 gates) + `ActionGate` (separate) + `PolicyEngine` (separate)
- **Replace with:** `GovernancePort` with oriented gate lattice + risk manifold
- **Verification:** All gate decision events preserved; `gateDecisionsTotal` metrics unchanged

### R4: Extract Memory Ports
- **Target:** Direct `Memory` access throughout `nar/src/`
- **Replace with:** `MemoryPorts` (10 typed interfaces) — only `CommitLedger` gets `ConceptWriter`/`TaskAdmission`
- **Verification:** `pnpm memory:ports` gate passes

### R5: Make Provenance First-Class
- **Target:** `CycleTrace` + `EventLog` as separate systems
- **Replace with:** Single `ProvenancePort` with correlation threading, causal DAG, configurable depth
- **Verification:** `replay.ts` works identically; `pnpm persistence:replay` passes

### R6: Decouple LM from Cycle Path
- **Target:** `nar/src/lm/` imports on cycle path (currently blocked by `pnpm core:no-lm`)
- **Replace with:** `LMProposalProducer` behind `SubstratePort('neural-manifold')` — only reachable via `ArbitrationLayer`
- **Verification:** `pnpm core:no-lm` and `pnpm cycle:no-provider` still pass

---

## Testing Strategy

### T1: Contract Tests for Ports
Each port interface has a test suite that **all implementations must pass**:
- `PerceptionPort.contract.test.ts`
- `InferencePort.contract.test.ts`
- `BudgetPort.contract.test.ts`
- `GovernancePort.contract.test.ts`
- `ProvenancePort.contract.test.ts`
- `SubstratePort.contract.test.ts`

### T2: Feasibility Predicate Tests
- Generate random `ReasonerSpec` configurations
- Validate `Φ(spec)` rejects infeasible ones
- Validate feasible ones instantiate and run

### T3: Behavioral Equivalence
- `DefaultControlModel` must produce bit-for-bit identical event logs to current SeNARS for same inputs
- `replay.ts` with recorded sessions must verify

### T4: Synth Flavor Integration Tests
- Each flavor runs `benchmarks/cycle-bench`, `benchmarks/system-one-bench`, `benchmarks/arcade`
- Compare metrics: derivations/cycle, latency, Brier score, governance queue depth

### T5: Property Tests
- `replay ∘ log ≅ id` (deterministic replay)
- `commit` never mutates `Belief` from `Reward` (firewall)
- No unbounded accumulators (`pnpm complexity:budget`)
- Scheduler decisions always event-sourced (H6)

---

## Deliverables & Milestones

| Milestone | Target | Deliverable |
|-----------|--------|-------------|
| **M0** | Week 2 | `ControlKernel` trait + `DefaultControlKernel`; 5 ports extracted |
| **M1** | Week 5 | `ControlModel` interface + `StageGraphRunner` + `DefaultControlWord`; current SeNARS runs unchanged |
| **M2** | Week 7 | `CommitLedger` unified; all write paths migrated; event-sourced fold verified |
| **M3** | Week 9 | `BudgetPort` with lattice, reservations, optional utility pricing |
| **M4** | Week 11 | `GovernancePort` with oriented gates, trust manifold, risk/reversibility, autonomy ladder |
| **M5** | Week 13 | `ArbitrationLayer` + substrate ports; NAL + MeTTa + LM + Reflex coexisting |
| **M6** | Week 15 | `ReflexivityTower` + `MetaController` as Ω instance; governed self-mod working |
| **M7** | Week 17 | `ProvenancePort` with causal queries, configurable depth, independent verifier |
| **M8** | Week 19 | `ReasonerSpec` grammar + algebraic composition + `Φ` validation + profiles |
| **M9** | Week 22 | All `synth/` flavors implemented as `ControlModel` + `ReasonerSpec`; migration complete |
| **M10** | Week 24 | Documentation, examples, `createAgentFromSpec(spec)` factory, all gates pass |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| **Behavioral drift during migration** | `DefaultControlModel` adapter ensures bit-for-bit equivalence at each phase; `replay.ts` regression suite |
| **Abstraction overhead** | Zero-cost abstractions: `ControlWord` compiles to same hot path; ports are interface boundaries, not indirection in hot loops |
| **Over-engineering** | Kernel-first staging (Phase 0–2 deliver runnable minimal core); each phase independently deployable |
| **Synth flavor divergence** | Shared port contracts + `Φ` validation ensure all flavors inhabit same coherent space |
| **Performance regression** | `benchmarks/cycle-bench` at each milestone; `pnpm complexity:budget` enforces LOC/cycle bounds |

---

## Appendix: Mapping Current Code to Plan

| Current File | Phase | Becomes |
|--------------|-------|---------|
| `nar/src/nar-execution.ts` | 1, 2 | `StageGraphRunner` + `DefaultControlWord` + `CommitLedger` client |
| `nar/src/reason/inference-controller.ts` | 1 | `InferencePort` implementation |
| `nar/src/kernel/GateRegistry.ts` + `Kernel*Gate.ts` | 4 | `GovernancePort` implementation |
| `nar/src/kernel/budget-scopes.ts` + `ControlBudgets.ts` | 3 | `BudgetPort` implementation |
| `nar/src/nar.ts` (constructor) | 0, 8 | `ControlKernel` assembly + `ReasonerSpec` parser |
| `core/src/agent/phases.ts` | 1 | `ControlWord` for macro-cycle (separate graph) |
| `nar/src/proposal/lm-rule-producer.ts` | 5 | `SubstratePort('neural-manifold')` implementation |
| `nar/src/metta/` | 5 | `SubstratePort('exact-metta')` implementation |
| `nar/src/learning/` | 6 | `ReflexivityTower` clients (RLFP, SchemaInductor, etc.) |
| `core/src/EventLog.ts` + `nar/src/trace/` | 7 | `ProvenancePort` implementation |
| `core/src/Lifecycle.ts` | 0 | `ControlKernel` lifecycle methods |

---

## Appendix: Hard Constraints as Type-Level Laws

Where possible, encode H1–H10 as **type system invariants** (not runtime checks):

| Constraint | Type-Level Encoding |
|------------|---------------------|
| H1: Reward ∤ Truth | `type BeliefWriter = EvidenceOnly`; `Reward` lacks `EvidenceOnly` capability |
| H2: Untrusted ⇒ judged | `UntrustedProposal` requires `JudgeResult` to construct `CommitCandidate` |
| H3: Mutation ⇒ event | `CommitLedger.commit` returns `EventId`; no other write method exists |
| H4: No self-approval | `SelfModificationProposal` requires `ExternalApproval` token to commit |
| H5: Bounded paths | `CognitiveTransaction` requires `BudgetReservation`; `BudgetPort.reserve` fails if unbounded |
| H6: No opaque scheduling | `SchedulerDecision` is a `CognitiveTransaction{kind:'meta-control'}` |
| H7: Verifier independence | `Verifier` package has `deps:direction` forbidding `nar/` imports |
| H8: Equality isolation | `ExactSubstrate` port has no `unionOnSimilarity` method |
| H9: No silent failure | `FailurePolicy` is required field on `CognitiveTransaction`; `Result` type forces handling |
| H10: Irreversible ⇒ authorized | `IrreversibleAction` requires `RiskClassification + Authorization` to construct |

---

*This plan is a living document. Each phase should validate against `Φ` and the behavioral equivalence test suite before proceeding.*