# SeNARS MetaReasoner — Abstraction Development Plan

## Executive Summary

**Goal**: Transform SeNARS from a single hard-coded control architecture into a **universal, modular control model framework** where the current SeNARS is one evaluation point, and the `synth/` flavors (ambitious, flexible, universal, meta, bio, math, thermodynamic, category, topological, cybernetic) are alternative evaluations — all sharing a common algebraic foundation.

**Approach**: Implement the **Cognitive Control Algebra** (`space.a.1–3`) as a first-class, programmable configuration space. The existing dual-loop pipeline becomes a *default configuration* (`SeNARS₀`), not the architecture itself.

---

## Phase 0 — Foundation: The Minimal Kernel (Ω₀)

**Duration**: 2–3 weeks  
**Deliverable**: A runnable reasoner kernel with **five load-bearing primitives** — substrate, control word, admission gate, resource monoid, provenance fold — satisfying all hard constraints H1–H10.

### 0.1 Define the Configuration Algebra (`core/control-algebra/`)

| Primitive | Type | Key Operations |
|-----------|------|----------------|
| **Topology** `𝒯` | Directed hypergraph of loops/stages | `compose`, `parallel`, `nest`, `lift` |
| **StageGraph** `𝒮` | Guarded DAG of stage nodes | `addNode`, `addEdge(guard)`, `restrict` |
| **GateExpr** `𝒢` | Oriented lattice (interior/closure) | `meet`, `join`, `fallback`, `vote` |
| **BudgetLattice** `ℬ` | Module over semiring with scopes | `reserve`, `settle`, `borrow`, `price` |
| **StrategyProfile** `Θ` | Fiber bundle over slots | `compose`, `parameterize`, `adapt` |
| **MemoryModel** `𝓜` | Port-based bounded comonad | `read`, `write`, `decay`, `snapshot` |
| **TrustModel** `𝒯ᵣ` | Monad with propagation | `return`, `bind`, `aggregate` |
| **FailurePolicy** `𝒫` | Natural transformation Id→Error | `degrade`, `retry`, `escalate` |

**Invariant**: Every configuration `c : ReasonerConfig` must satisfy `Φ(c)` (H1–H10) at load time. Infeasible configs are rejected before instantiation.

### 0.2 Extract SeNARS₀ as a Constant Configuration

```typescript
// core/control-algebra/SeNARS.ts
export const SeNARS: ReasonerConfig = {
  topology:    dualNestedLoops(),      // macro → micro → inference
  stageGraph:  fixedChain(6),          // perceive→attend→reason→authorize→propose→learn
  gates:       series(perception, budget, action, reward),
  budgets:     lifetimeMain ⊗ perCycleScopes(6),
  strategies:  namedSlots(5, implementations),
  memory:      boundedBags(9 ports),
  trust:       scalarSourceQuality(),
  failure:     mixedFailOpenClosed(),
};
```

### 0.3 Kernel Evaluator

```typescript
// core/control-algebra/evaluate.ts
export function evaluate(c: ReasonerConfig): Reasoner {
  // 1. Validate Φ(c)
  // 2. Build substrate from c.topology, c.stageGraph
  // 3. Wire gates from c.gates
  // 4. Install budget office from c.budgets
  // 5. Resolve strategy slots from c.strategies
  // 6. Compose memory from c.memory
  // 7. Return runnable Reasoner with single commit ledger
}
```

**Exit Criteria**: `evaluate(SeNARS)` produces behaviorally identical agent to current `createAgentFromEnv()` (verified by `pnpm e2e:pipeline`).

---

## Phase 1 — Unify the Commit Ledger (Single Write Authority)

**Duration**: 3–4 weeks  
**Deliverable**: All mutation paths (`authorize`, `processPending`, `admit`, tool results, learning, self-mod) route through one `CommitLedger` interface.

### 1.1 CognitiveTransaction Interface

```typescript
// core/control-algebra/transactions.ts
interface CognitiveTransaction {
  id: TransactionId;
  correlationId: CorrelationId;
  kind: TransactionKind;           // perception | inference | proposal | judgment | commit | action | learning | forgetting | consolidation | simulation | self-modification
  axis: CognitiveAxis;             // epistemic | teleological | governance | learning
  inputs: CognitiveObject[];
  outputs: Candidate[];
  effects: EffectDeclaration[];
  budget: BudgetReservation;
  proposer: ProposerProfile;       // LM | reflex | NAL | peer | self-mod
  trust: TrustProfile;
  risk: RiskProfile;
  reversibility: ReversibilityClass;
  proofObligations: ProofObligation[];
  fallback: FailurePolicy;
}
```

### 1.2 CommitLedger Implementation

```typescript
// core/control-algebra/ledger.ts
interface CommitLedger {
  commit(ct: CognitiveTransaction, ctx: CommitContext): Promise<CommitResult>;
}

interface CommitContext {
  budget: BudgetState;
  risk: RiskPolicy;
  autonomy: AutonomyPolicy;
  verification: VerificationPolicy;
}

// Pipeline: Normalize → TypeCheck → AxisCheck(firewall) → EvidenceIndependence
// → Prove/Judge/Simulate → Rank → BudgetSettle → RiskClassify → Commit|Reject
```

### 1.3 Migration Steps

1. Wrap `NARExecution.authorize` → `ledger.commit(ct, ctx)`
2. Wrap `TaskManager.processPending` → same ledger
3. Wrap `NARIO.input` (ingress) → same ledger (with `fail-closed` orientation)
4. Wrap tool results, learning proposals, self-mod patches → same ledger
5. Add `correlationId` threading through all stages (stimulus → cycle → derivation → action)

**Preserves**: All invariants, all behavior.  
**Gains**: One write path, causal observability, `replayControlState(events)` works.

---

## Phase 2 — Data-Driven Control Graph (Conditional DAG)

**Duration**: 4–5 weeks  
**Deliverable**: Replace hard-coded 6-stage `for`-loop with `ControlGraph` — stages as nodes, transitions as guarded edges.

### 2.1 ControlGraph Interface

```typescript
// core/control-algebra/graph.ts
interface StageNode {
  id: StageId;
  kind: StageKind;
  run: (ctx: CycleContext) => Promise<CognitiveTransaction[]>;
  budgetScope: BudgetScopeId;
  failure: FailurePolicy;
}

interface StageEdge {
  from: StageId;
  to: StageId;
  when: (ctx: CycleContext) => boolean;   // conditional
  budget?: BudgetScopeId;                  // edge traversal cost
  parallel?: boolean;                      // fan-out/join
}

interface ControlGraph {
  nodes: Map<StageId, StageNode>;
  edges: StageEdge[];
  entry: StageId;
  exit: StageId;
}
```

### 2.2 SeNARS₀ as a Graph

```typescript
// Current linear chain (all guards = true)
perceive → attend → reason → authorize → propose → learn
  ↘ [starved?] → triage ↗
  ↘ [aborted?] → exit
```

### 2.3 Conditional Edges (First Flexibility Wins)

| Edge | Guard | Effect |
|------|-------|--------|
| `reason → authorize` | `derivations.length > 0` | Skip admit when nothing derived |
| `reason → learn` | `derivations.length === 0` | Fast-path to learning |
| `propose → authorize` | `proposals.length > 0` | Skip when no producer |
| `propose → learn` | `proposals.length === 0` | Fast-path |
| `learn → perceive` | `dueForConsolidation()` | Heterochronous loop |

### 2.4 Graph Runner

```typescript
// core/control-algebra/runner.ts
async function runGraph(graph: ControlGraph, ctx: CycleContext): Promise<CycleResult> {
  let node = graph.entry;
  while (node !== graph.exit) {
    const stage = graph.nodes.get(node);
    const txns = await stage.run(ctx);
    // Evaluate outgoing edges
    for (const edge of graph.edges.filter(e => e.from === node)) {
      if (await edge.when(ctx)) {
        // Charge edge budget, push next node
        node = edge.to;
        break;
      }
    }
  }
}
```

**Preserves**: `CycleTrace` sees every stage; all invariants hold.  
**Gains**: Stage skipping, conditional ordering, parallel fan-out, A/B-testable graphs.

---

## Phase 3 — Resource Economy (Reservations + Prices)

**Duration**: 5–6 weeks  
**Deliverable**: Replace static integer scopes with `ResourceEconomy` — reservations, marginal utility pricing, optional thermodynamic mode.

### 3.1 Budget Dimensions (Extended)

```
cycles · derivations · premises · memoryOps · llmCalls · tokens
latency · attention · risk · humanAttention
```

### 3.2 ResourceEconomy Interface

```typescript
// core/control-algebra/economy.ts
interface ResourceEconomy {
  reserve(bid: BudgetBid): Promise<BudgetReservation>;
  settle(reservation: BudgetReservation, actual: CostVector): void;
  price(op: CognitiveOperation): PriceEstimate;
  allocate(bids: BudgetBid[]): Allocation;
}

interface BudgetBid {
  transactionId: TransactionId;
  dimensions: CostVector;
  priority: number;              // expected utility per unit cost
  deadline?: Timestamp;
}
```

### 3.3 Pricing Model

```
score(op) = (ΔK + ΔG + ΔH) / (λ_c·C + λ_r·R + λ_h·H_human)

ΔK = expected epistemic gain (information gain)
ΔG = expected teleological gain (goal progress)
ΔH = expected homeostatic gain (drive balance)
C  = compute cost (cycles, derivations, memoryOps)
R  = risk cost (irreversibility, blast radius)
H  = human attention cost (approval, clarification)
```

### 3.4 Graceful Degradation Under Pressure

| Pressure | Behavior |
|----------|----------|
| Low | Explore, enrich, elaborate |
| Medium | Prioritize goals and proofs |
| High | Conserve, degrade to symbolic, ask for help |

### 3.5 Thermodynamic Option (Configurable)

Replace hard cutoffs with Boltzmann allocation:
```
P(pursue) ∝ exp(−ΔE / T)
```
where `T` (cognitive temperature) interpolates exploration ↔ exploitation.

**Preserves**: AIKR boundedness; total budget fixed.  
**Gains**: Adaptive allocation, economic reasoning, no silent truncation.

---

## Phase 4 — Governed Reflexivity (Meta-Controller as Learned Object)

**Duration**: 6–8 weeks  
**Deliverable**: The scheduler/controller becomes a **governed, learnable proposal** — hot-swapped at cycle boundaries with state preservation.

### 4.1 Controller Portfolio

| Controller | Behavior |
|------------|----------|
| **Deliberative** | Deep inference, high proof burden |
| **Reactive** | Fast reflexes, low latency |
| **Curious** | Exploration, question generation |
| **Conservative** | High rejection threshold, low risk |
| **Creative** | High proposal diversity, sandboxed |
| **Social** | Clarification-seeking, human-in-loop |
| **Repair** | Contradiction resolution, test fixing |
| **Consolidating** | Decay, schema induction, integration |

### 4.2 CognitiveProgram Output

```typescript
interface CognitiveProgram {
  stageGraph: StageGraph;
  budgetAllocation: BudgetAllocation;
  proposerPortfolio: ProposerWeights;
  verificationPolicy: VerificationPolicy;
  autonomyPolicy: AutonomyPolicy;
  learningPolicy: LearningPolicy;
}
```

### 4.3 Inspectable Adaptation (Φ10)

Every scheduling decision is a typed `CognitiveEvent`:
- `control.decision {program, rationale, expectedUtility, correlationId}`
- `control.hotSwap {from, to, preservedState, cycleBoundary}`

**No opaque scheduler** — control state is replayable via `replayControlState(events)`.

### 4.4 Self-Modification Filtration (Φ3, Φ4)

| Level | Mutates | Authority |
|-------|---------|-----------|
| F₀ | Knobs/parameters | Auto or low-risk |
| F₁ | Strategy selection | Proposal or auto |
| F₂ | Rules (schema induction) | Proof + shadow validation |
| F₃ | Code/config patches | Shadow CI + **external immutable arbiter** |
| F₄ | Constitution/governance | Human + external audit |

**Invariant**: Truth (`𝒱`) sits **outside the tower entirely**. No level is self-approved.

---

## Phase 5 — Synth Flavor Configurations (Evaluation Points)

**Duration**: 4–6 weeks (parallelizable)  
**Deliverable**: Each `synth/` flavor becomes a `ReasonerConfig` constant evaluating to a distinct reasoner behavior.

### 5.1 Configuration Constants

```typescript
// core/control-algebra/flavors/
export const Ambitious: ReasonerConfig = { ... };    // maximal enrichment
export const Flexible: ReasonerConfig = { ... };     // AEGIS — composable, configurable
export const Universal: ReasonerConfig = { ... };    // Ω-Calculus — terminal object
export const Meta: ReasonerConfig = { ... };         // Metaprogrammatic, recursive
export const Bio: ReasonerConfig = { ... };          // Cellular, autopoietic
export const Math: ReasonerConfig = { ... };         // Pure algebraic, coalgebraic
export const Thermodynamic: ReasonerConfig = { ... }; // Free-energy, Boltzmann
export const Category: ReasonerConfig = { ... };     // Categorical, coalgebraic
export const Topological: ReasonerConfig = { ... };  // Geometric, fiber bundles
export const Cybernetic: ReasonerConfig = { ... };   // Control-theoretic, PID loops
```

### 5.2 Flavor Characteristics

| Flavor | Control Graph | Economy | Governance | Substrate Bias |
|--------|---------------|---------|------------|----------------|
| **Ambitious** | Conditional DAG + heterochronous tower | Full pricing + markets | Full filtration F₀–F₄ | Hybrid NAL+MeTTa+LM |
| **Flexible (AEGIS)** | Declarative DAG + portfolio controllers | Reservations + utility pricing | Trust-risk-reversibility manifold | Multi-substrate arbitration |
| **Universal (Ω)** | KAT control word + claim queue | Module over semiring + thermodynamic | Oriented gate lattice + risk manifold | Multi-sorted algebra |
| **Meta** | Recursive meta-controller | Self-pricing | Meta-governance | Reflective tower |
| **Bio** | Cellular automata topology | Metabolic budgets | Homeostatic gates | Growing/evolving |
| **Math** | Coalgebraic fixpoints | Graded resource monoid | Formal verification | Pure algebra |
| **Thermodynamic** | Free-energy minimization | Temperature + Boltzmann | Variational bounds | Statistical physics |
| **Category** | Functorial semantics | Enriched categories | Topos logic | Categorical |
| **Topological** | Sheaf-theoretic stages | Persistent homology budgets | Stratified governance | Geometric |
| **Cybernetic** | PID/loop control | Control-theoretic costs | Servo governance | Classical control |

### 5.3 Profiles, Presets, Tiers

```typescript
// Config-time feasibility: all flavors satisfy Φ at load time
type Tier = 'Ω₀' | 'Ω₁' | 'Ω₂' | 'Ω₃' | 'Ω₄';  // Kernel → Reasoner → Agent → Cognitive → Ecological

const profiles = {
  device:       { tier: 'Ω₁', substrate: 'NAL', neural: false },
  conversation: { tier: 'Ω₂', substrate: 'NAL', neural: true },
  research:     { tier: 'Ω₃', substrate: 'hybrid', neural: true, rlfp: true },
  arcade:       { tier: 'Ω₁', substrate: 'NAL', neural: false, games: true },
};
```

---

## Phase 6 — Shared Component Library (Refactoring for Shareability)

**Duration**: 3–4 weeks (parallel with Phases 1–5)  
**Deliverable**: Extracted, reusable packages with typed ports — zero circular dependencies.

### 6.1 Package Extraction

| Package | Contents | Port Contract |
|---------|----------|---------------|
| `@senars/substrate` | NAL rules, truth algebra, term ops | `TermAlgebra`, `TruthMonoid`, `RevisionOp` |
| `@senars/memory` | Bags, concepts, links, episodic, ports | `MemoryPorts` (9 contracts) |
| `@senars/budget` | BudgetLattice, ResourceEconomy, scopes | `BudgetPort`, `EconomyPort` |
| `@senars/gates` | GateExpr, Perception/Action/Reward/Budget | `GatePort`, `Orientation` |
| `@senars/strategies` | 5 slots + implementations + composition | `StrategyPort`, `SlotSignature` |
| `@senars/provenance` | EventLog, CorrelationId, replay, verify | `EventPort`, `ReplayPort` |
| `@senars/governance` | RiskProfile, AutonomyLadder, ProposalRouter | `GovernancePort`, `RiskClassifier` |
| `@senars/learning` | RLFP, SchemaInduction, DistillationFlywheel | `LearningPort`, `ProposalPort` |
| `@senars/control` | ControlGraph, Runner, CognitiveProgram | `ControllerPort`, `SchedulerPort` |

### 6.2 Dependency Direction (Enforced by CI)

```
util → substrate → memory → budget → gates → strategies → governance → learning → control
                      ↘ metta (tool only)           ↗
                              ↗ ui, io (edge only)
```

**Rule**: Cycle path never imports `nar/src/lm`, `nar/src/governance`, `ui`, `io`.

---

## Phase 7 — System Overview (README.md)

**Duration**: 1 week  
**Deliverable**: `docs/metareasoner/README.md` — system overview and purpose.

### 7.1 Structure

```markdown
# SeNARS MetaReasoner

## What Is This?
A universal control model framework for bounded, governed reasoners.

## The Core Idea
Every reasoner is a point in a **Cognitive Control Algebra** — a structured design space where:
- Control flow is **data** (conditional DAGs, not hard-coded loops)
- Resources are an **economy** (reservations + prices, not static quotas)
- All cognition is **transactional** (perception, inference, learning, action, self-mod — all CTs)
- All mutation is **governed** (single commit ledger, one governance vocabulary)
- All state is **event-sourced** (append-only log, replayable, independently verifiable)

## Architecture Layers
1. **Ω₀ Kernel** — 5 primitives (substrate, control word, gate, budget, provenance)
2. **Ω₁ Reasoner** — Inference substrate, truth algebra, revision
3. **Ω₂ Agent** — Full gate lattice, trust field, economy pricing, risk manifold
4. **Ω₃ Cognitive** — Drives, multi-rate loops, consolidation, imagination, reflexivity
5. **Ω₄ Ecological** — Peer delegation, collective calibration, provenance fusion

## Control Model Flavors
| Flavor | Character | Best For |
|--------|-----------|----------|
| `SeNARS` (default) | Dual-loop, priority bags, NAL | Production neuro-symbolic agent |
| `Ambitious` | Max enrichment, heterochronous tower | Research, maximum expressiveness |
| `Flexible` (AEGIS) | Composable, configurable, safe | General deployment, customization |
| `Universal` (Ω) | Terminal object, formal rigor | Analysis, verification, taxonomy |
| `Meta` | Recursive, metaprogrammatic | Self-improving systems |
| `Bio` | Cellular, autopoietic | Evolving, growing systems |
| `Math` | Pure algebraic, coalgebraic | Formal verification, proofs |
| `Thermodynamic` | Free-energy, Boltzmann | Continuous adaptation |
| `Category` | Categorical, coalgebraic | Structural reasoning |
| `Topological` | Geometric, fiber bundles | Spatial/temporal reasoning |
| `Cybernetic` | PID, control loops | Real-time, embedded |

## Quick Start
```bash
pnpm evaluate SeNARS        # Current SeNARS
pnpm evaluate Flexible      # AEGIS
pnpm evaluate Universal     # Ω-Calculus
pnpm evaluate --tier=Ω₀     # Minimal kernel
```

## Configuration
Every deployment is a declarative literal validated against Φ (H1–H10) at load time.
```

---

## Cross-Cutting Concerns (Ongoing)

### Testing Strategy
- **Unit**: Each algebraic operation (`compose`, `restrict`, `refine`, `lift`) has equational tests
- **Integration**: `evaluate(c)` for each flavor produces runnable reasoner
- **Property**: `⟦c₁ ⊗ c₂⟧ = ⟦c₁⟧ ∘ ⟦c₂⟧` (compositionality)
- **Invariant**: All flavors pass `Φ` validation at load time
- **Regression**: `evaluate(SeNARS)` ≡ current behavior (E2E gate)

### Observability
- `CycleTrace` → `ControlTrace` (graph traversal events)
- `BudgetTrace` → `EconomyTrace` (reservations, settlements, prices)
- `GovernanceTrace` (risk classifications, autonomy transitions)
- All events carry `correlationId` for causal navigation

### Migration Safety
- Each phase preserves all prior invariants
- `SeNARS` constant never diverges from production behavior
- Feature flags gate new control paths (gradual rollout)
- Shadow evaluation: run new graph alongside old, compare outputs

---

## Timeline Summary

| Phase | Weeks | Key Deliverable |
|-------|-------|-----------------|
| 0. Foundation | 2–3 | Minimal kernel Ω₀, SeNARS₀ config |
| 1. Commit Ledger | 3–4 | Single write authority |
| 2. Control Graph | 4–5 | Data-driven conditional DAG |
| 3. Resource Economy | 5–6 | Reservations + pricing + thermodynamic |
| 4. Governed Reflexivity | 6–8 | Learned meta-controller, self-mod filtration |
| 5. Synth Flavors | 4–6 | 10 flavor configs evaluating from algebra |
| 6. Shared Components | 3–4 | Extracted packages with typed ports |
| 7. README | 1 | System overview |

**Total**: ~28–37 weeks (incremental, each phase shippable)

---

## Success Criteria

1. **SeNARS₀ ≡ Current**: `evaluate(SeNARS)` passes all existing E2E gates
2. **Flavor Diversity**: Each `synth/` flavor evaluates to distinct, runnable behavior
3. **Invariant Preservation**: All 10 hard constraints (H1–H10) hold for every flavor
4. **Modularity**: Packages publish independently; `control-algebra` has zero workspace deps
5. **Configurability**: Tier Ω₀ through Ω₄ each independently deployable
6. **Extensibility**: New control model = new `ReasonerConfig` constant (no framework changes)
7. **Documentation**: `README.md` enables new user to understand and customize in <30 min

---

## Appendix: Design Space Coordinates (Reference)

The abstraction exposes these **independent axes** for customization:

| Axis | Range | SeNARS | AEGIS | Ω |
|------|-------|--------|-------|---|
| Nesting depth | 0, 1, 2, 3… | 3 | configurable | configurable |
| Gate asymmetry | (O,O), (O,C), (C,O), (C,C) | (C,O) | configurable | configurable |
| Budget reset | lifetime, per-cycle, per-call, adaptive | mixed | adaptive | module |
| Control word | linear, KAT, event-driven, claim-queue | linear | KAT + portfolio | KAT + claim-queue + learned |
| Strategy slots | 0, 1, 2… | 5 | fiber bundle | fiber bundle |
| Truth algebra | boolean, prob, NAL, D-S, fuzzy, paraconsistent | NAL | NAL | multi-sorted |
| Memory structure | flat, bag, graph, tensor, reversible | bag | layered bags | graded |
| Failure policy | abort, fail-closed, degrade, fail-open | mixed | per-transaction | natural transformation |
| LM integration | none, proposer, judge, both | proposer+judge | proposer+judge | proposer+judge |
| Provenance | none, trace, event-sourced, causal | event-sourced | causal | causal |
| Self-modification | none, governed, ungoverned | governed | filtration F₀–F₄ | filtration F₀–F₄ |

**Every coordinate is a declarative field in `ReasonerConfig`. The algebra handles the rest.**