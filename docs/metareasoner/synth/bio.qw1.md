# Autopoietic Cognitive Substrate (ACS)

## Complete Specification v1.0

---

## §0 — Design Selection

### Prime Objectives (selected)

| ID | Objective | Role in this specification |
|---|---|---|
| **O1** | Maximum epistemic integrity | Belief/goal firewall, evidence-sensitive truth, paraconsistency, calibrated admission |
| **O2** | Auditable causal provenance | Every operation carries correlation/causal IDs; replayable by construction |
| **O3** | Control-plane fluidity | All control flow is declarative data (stage graphs, control words), never hard-coded |
| **O4** | Resource economics | Budgets are reservations, prices, and thermodynamic allocations, not static counters |
| **O6** | Governed reflexivity | All adaptation is proposal → shadow → verdict → commit; no self-approval |
| **O7** | Neuro-symbolic synergy | Neural/probabilistic systems propose; symbolic/evidential systems judge, veto, commit |
| **O8** | Unified commit ledger | Every state mutation passes through one typed, governed commit surface |

### Hard Constraints (all selected)

| ID | Constraint |
|---|---|
| **H1** | No reward/desire signal may mutate factual truth values |
| **H2** | No untrusted proposal may enter durable memory without judgment or provisional typing |
| **H3** | No state mutation may occur without an append-only event-log entry |
| **H4** | No self-modification may be self-approved; external or governed arbitration required |
| **H5** | No reasoning path may be unbounded in memory, time, derivations, or model calls |
| **H6** | No scheduler decision may be opaque; all control choices are inspectable |
| **H7** | No verifier may share unsafe engine dependencies when checking derivations |
| **H8** | No exact symbolic substrate may union nodes based solely on uncertain similarity |
| **H9** | No failure may be silently swallowed where it affects cognition, budget, or admission |
| **H10** | No irreversible action may bypass risk classification and authorization |

### Anti-Goals

| ID | Anti-Goal |
|---|---|
| **A2** | No scheduler opacity — learned/market schedulers must remain auditable |
| **A5** | No monolithic LM authority — language models remain proposers, never controllers |
| **A7** | No unbounded cognitive richness — drives, imagination, consolidation require budgets and governance |

### Architectural Character Bias

| Bias | Weight | Rationale |
|---|---|---|
| **D3** Elegance/Unification | Primary | One cell model, one ledger, one governance vocabulary, one resource calculus |
| **D6** Adaptivity | Primary | The controller itself adapts within hard constraints |
| **D4** Robustness | Primary | Cellular isolation provides fault tolerance by construction |
| **D5** Modularity | Secondary | Every component replaceable behind typed ports |
| **D1** Auditability | Secondary | Deterministic replay preferred; traded only for adaptivity with full correlation |
| **D2** Cognitive Power | Tertiary | Richness emerges from cell composition, not from a single monolithic loop |

---

## §1 — Foundational Principles

### P1. Epistemic Firewall

Truth and desire occupy disjoint type spaces. Reward signals may modulate attention priority and strategy weights. They may never mutate the factual components of a truth value. This is enforced at the type level, not by convention.

```
Belief  : (frequency : [0,1], confidence : [0,1])
Goal    : (desire    : [0,1], confidence : [0,1])
Reward  : → { attention.priority, strategy.weight }   // never → Belief.frequency
```

### P2. Bounded Cognition (AIKR)

Knowledge and resources are insufficient by design axiom. Every cognitive operation is bounded in time, memory, derivation depth, and external calls. Budgets, forgetting, decay, backpressure, and interruption are first-class architectural properties, not runtime afterthoughts.

### P3. Provenance by Construction

State is an append-only event fold. Every mutation is a typed event carrying a correlation ID, a producer ID, a budget reservation, and a parent pointer. The system is reconstructable from its event log by any independent verifier that shares only the truth algebra, not the engine.

### P4. Untrusted Proposers, Trusted Judgment

All generative mechanisms (neural, language-model, reflex, peer, stochastic) are untrusted proposers. Their outputs are candidates, not truths. Admission into durable state requires passing through a calibrated judgment boundary. The judgment boundary is the only write authority.

### P5. Single Commit Authority

All durable state mutation passes through one commit surface. Perception, inference, learning, action, self-modification, and consolidation are all instances of the same typed transaction. There is no separate "write path" for any cognitive operation.

### P6. Autopoietic Closure

The system is organizationally closed: every component it requires is produced, maintained, or recycled by a process within the system. The system's boundary is not a fixed shell but an actively maintained membrane. Perturbations from the environment trigger internal reorganization, not direct state injection.

### P7. Cellular Composition

The fundamental unit of cognition is the **Cell**: a bounded, self-governing, budgeted, event-sourced unit. The organism grows by cell division, specializes by differentiation, and recycles by apoptosis. No single loop, pipeline, or controller governs the whole system.

---

## §2 — Fundamental Ontology: The Cognitive Cell

### 2.1 Definition

A **Cell** is the irreducible unit of cognition. It is a bounded, self-contained, governable process that transforms inputs into outputs under explicit budgets and typed epistemic constraints.

```
Cell = ⟨ Membrane, Metabolism, Genome, Cytosol, Nucleus, Identity ⟩
```

| Component | Biological Analog | Function |
|---|---|---|
| **Membrane** | Cell membrane | Typed gate controlling what enters and exits |
| **Metabolism** | Mitochondria | Resource budget: energy, materials, time |
| **Genome** | DNA | Declarative control specification (stage graph) |
| **Cytosol** | Cytoplasm | Internal working state (memory, attention, beliefs) |
| **Nucleus** | Cell nucleus | Commit authority; the only write surface |
| **Identity** | Cell type marker | Cell type, lineage, specialization, fitness |

### 2.2 Cell Type

A **CellType** is a template from which cells are instantiated. It defines the genome, membrane permeability, metabolic profile, and differentiation potential.

```typescript
interface CellType {
  id:            CellTypeId;
  genome:        StageGraph;           // declarative control flow
  membrane:      MembraneSpec;         // gate configuration
  metabolism:    MetabolicProfile;     // budget dimensions and ceilings
  cytosol:       MemorySpec;           // memory architecture
  nucleus:       CommitSpec;           // commit authority and governance
  differentiation: DifferentiationPotential;  // what this cell can become
  fitness:       FitnessFunction;      // how this cell's performance is scored
  lifespan:      LifespanPolicy;       // when this cell should be recycled
}
```

### 2.3 Cell Identity and Lineage

Every cell carries a lineage record:

```typescript
interface CellIdentity {
  cellId:       CellId;
  typeId:       CellTypeId;
  parentId:     CellId | null;         // null for founding cells
  generation:   number;
  birthEvent:   EventId;               // the event that created this cell
  specialization: SpecializationState;  // current differentiation state
  fitness:      number;                // rolling performance score
  status:       'active' | 'dormant' | 'apoptotic' | 'dead';
}
```

### 2.4 The Organism

The **Organism** is the autopoietic whole: the system of cells, their connections, and the regulatory processes that maintain the system's organization.

```
Organism = ⟨ Cells, Tissues, Signaling, Homeostasis, Boundary, EventLog ⟩
```

| Component | Function |
|---|---|
| **Cells** | The set of active, dormant, and apoptotic cells |
| **Tissues** | Functional groupings of cells (e.g., Epistemic Tissue, Motor Tissue) |
| **Signaling** | Inter-cell communication pathways |
| **Homeostasis** | Regulatory processes maintaining organizational stability |
| **Boundary** | The autopoietic membrane separating self from environment |
| **EventLog** | The append-only record of all organism events |

---

## §3 — Cell Membrane: Typed Admission

### 3.1 Membrane Structure

The membrane is a typed gate lattice controlling what enters and exits the cell. It is not a single filter but a composition of oriented operators.

```
Membrane = ⟨ Ingress, Egress, Cycle, Orientation ⟩
```

| Gate | Direction | Default Polarity | Function |
|---|---|---|---|
| **Ingress** | Environment → Cell | Fail-closed | External stimuli must be judged before entry |
| **Egress** | Cell → Environment | Fail-open | Internal derivations may exit; veto is remove-only |
| **Cycle** | Internal circulation | Always-admit | Internal operations are stamped but not filtered |

### 3.2 Orientation Algebra

Each gate carries an orientation parameter:

```
Orientation ∈ { fail-closed, fail-open, calibrated, degrade }
```

The fail-closed/fail-open asymmetry is a **parameter**, not a hard-coded branch:

```typescript
interface GateSpec {
  domain:     'ingress' | 'egress' | 'cycle' | 'tool';
  judge:      JudgeFunction | null;
  timeout:    Duration;
  fallback:   'fail-open' | 'fail-closed' | 'degrade' | 'abstain';
  orientation: 'interior' | 'closure';  // contractive or extensive
  calibration: CalibrationLock | null;
}
```

### 3.3 Admission as Unified Functional

All admission is one functional parameterized by trust, budget, and epistemic policy:

```
Admit : Candidate × Context × TrustPolicy × BudgetState → { admit, veto, defer, abstain }
```

The four traditional gates (perception, action, reward, budget) are four configurations of this one primitive.

### 3.4 Membrane Composition

Membranes compose as a bounded lattice:

```
g₁ ∘ g₂     serial: admit only if both admit
g₁ ∥ g₂     parallel: admit if both admit (same as serial for decisions)
g₁ ⊕ g₂     voting: admit if weighted majority admits
g₁ ▹ g₂     fallback: try g₁; on fault, try g₂
¬g          complement: admit iff g refuses
```

---

## §4 — Cell Metabolism: Resource Economy

### 4.1 From Quotas to Thermodynamics

Budgets are not static integer counters. They are a thermodynamic resource economy governed by energy, temperature, and utility.

### 4.2 Budget Dimensions

Each cell carries a multi-dimensional budget:

```typescript
interface MetabolicProfile {
  dimensions: Map<Dimension, BudgetSpec>;
  // Dimensions: cycles, derivations, premises, memoryOps,
  //             modelCalls, tokens, latency, attention, risk, humanAttention
}

interface BudgetSpec {
  ceiling:       number | 'adaptive';
  resetPolicy:   'lifetime' | 'per-cycle' | 'per-run' | 'on-demand';
  exhaustion:    'halt' | 'degrade' | 'skip' | 'backpressure';
  reservation:   boolean;   // must resources be reserved before use?
  pricing:       PricingFunction | null;  // marginal utility pricing
}
```

### 4.3 Reservation and Settlement

Before executing a cognitive transaction, the scheduler **reserves** resources. After execution, unused resources are **settled** (returned).

```
B_available ← B_available − B_reserved
B_settled   = B_reserved − B_unused
```

This prevents silent starvation and provides typed backpressure.

### 4.4 Cognitive Thermodynamics

For adaptive allocation, each cognitive operation has an **activation energy** based on surprise (prediction error) and utility. The system has a global **temperature** parameter:

- **High T** (high curiosity, low competence): broad stochastic sampling, exploration
- **Low T** (high competence, high coherence): greedy deep derivation, exploitation

The probability of pursuing a derivation path follows a Boltzmann distribution:

```
P(pursue) ∝ exp(−ΔE / T)
```

where ΔE is the activation energy of the derivation. This replaces hard cutoffs with graceful, utility-weighted allocation.

### 4.5 Budget Lattice

Budgets form a bounded distributive lattice with transfer and inheritance:

```
B₁ ⊓ B₂     meet: grant only if both grant (tighter)
B₁ ⊔ B₂     join: grant if either grants (looser)
B₁ ⊗ B₂     product: independent dimensions
transfer(from, to, amount)  — surplus lends to starved scope
derive(child ⊑ parent)      — child inherits parent dimensions
```

Total budget is preserved under transfer. Every transfer is event-sourced.

---

## §5 — Cell Genome: Declarative Control

### 5.1 Control as Data

The cell's control flow is a **StageGraph**: a typed, conditional directed acyclic graph loaded as data, not hard-coded as a sequence.

```typescript
interface StageGraph {
  nodes: StageNode[];
  edges: StageEdge[];
  entry: StageId;
  exit:  StageId | null;   // null = cyclic
}

interface StageNode {
  id:            StageId;
  operation:     CognitiveOperation;
  precondition:  (ctx: CellContext) => boolean;
  postcondition: (ctx: CellContext) => boolean;
  budget:        BudgetScopeId;
  failure:       'skip' | 'abort' | 'degrade' | 'retry';
}

interface StageEdge {
  from:   StageId;
  to:     StageId;
  guard:  (ctx: CellContext) => boolean;
  budget: BudgetScopeId | null;
}
```

### 5.2 Kleene Algebra with Tests (KAT)

For maximal expressiveness, the genome can be expressed as a KAT control word:

```
κ = perceive · attend · (ready? · reason · authorize) ·
    (hasProducer? · propose + ¬hasProducer? · 1) ·
    (due? · learn)*
```

KAT operators: `·` (sequence), `+` (choice), `*` (iteration), `p?` (test/guard), `1` (skip).

The stage graph is the compiled form; the KAT expression is the inspectable, replayable, A/B-testable form.

### 5.3 Genome Registry

All genomes are stored in a versioned, revertable registry. Genomes are data, not code:

```typescript
interface GenomeRegistry {
  register(genome: StageGraph, metadata: GenomeMetadata): GenomeId;
  resolve(id: GenomeId): StageGraph;
  revert(id: GenomeId, toVersion: number): void;
  diff(a: GenomeId, b: GenomeId): GenomeDiff;
}
```

### 5.4 Genome Editing

Genome edits are proposals subject to governance. The meta-controller may propose a stage graph edit, but it cannot apply it directly. Edits pass through the same commit ledger as all other mutations.

---

## §6 — Cell Lifecycle

### 6.1 Lifecycle States

```
         ┌──────────┐
         │  Nascent  │  (instantiated from CellType)
         └─────┬────┘
               │ activate
         ┌─────▼────┐
    ┌────│  Active   │────┐
    │    └─────┬────┘    │
    │          │          │
    │    ┌─────▼────┐    │
    │    │ Dormant   │    │
    │    └─────┬────┘    │
    │          │          │
    │    ┌─────▼────┐    │
    └───►│ Apoptotic │◄───┘
         └─────┬────┘
               │ recycle
         ┌─────▼────┐
         │  Recycled │  (resources returned to organism)
         └──────────┘
```

### 6.2 Cell Division (Scaling)

The organism grows by cell division, not by adding stages to a loop.

```typescript
interface CellDivision {
  parentId:    CellId;
  childType:   CellTypeId;
  inheritance: InheritancePolicy;  // what state is copied
  budgetSplit: BudgetSplitPolicy; // how resources are divided
  trigger:     DivisionTrigger;    // what causes division
}
```

Division triggers:
- **Load-based**: A cell's budget utilization exceeds threshold for N cycles
- **Specialization**: A cell's fitness function indicates it should specialize
- **Differentiation**: A stem cell receives a differentiation signal
- **Repair**: A damaged cell is replaced

### 6.3 Apoptosis (Graceful Death)

Cells die gracefully:
1. Cell enters apoptotic state
2. Cell flushes pending transactions to the commit ledger
3. Cell exports its cytosol (memory) to a designated recipient or archive
4. Cell releases its budget reservation to the organism pool
5. Cell emits a `cell.apoptosis` event
6. Cell is removed from the organism

### 6.4 Differentiation

Generic cells (stem cells) can specialize into specific cell types:

```
StemCell → EpistemicCell     (specializes in belief management)
StemCell → MotorCell         (specializes in action planning)
StemCell → GovernanceCell    (specializes in trust and verification)
StemCell → ConsolidationCell (specializes in memory integration)
StemCell → ReflexCell        (specializes in fast, low-latency response)
```

Differentiation is governed: a cell cannot differentiate into a type that would violate feasibility constraints.

---

## §7 — Tissues and Organs

### 7.1 Tissue

A **Tissue** is a functional grouping of cells that cooperate on a shared cognitive task.

```typescript
interface Tissue {
  id:       TissueId;
  cells:    CellId[];
  function: CognitiveFunction;
  coordinator: CellId;       // the cell that coordinates the tissue
  budget:   BudgetScopeId;   // shared budget for the tissue
}
```

### 7.2 Organs

**Organs** are higher-order structures composed of multiple tissues.

| Organ | Tissues | Function |
|---|---|---|
| **Epistemic Organ** | Belief tissue, Revision tissue, Contradiction tissue | Manages factual truth |
| **Teleological Organ** | Goal tissue, Drive tissue, Planning tissue | Manages desires and intentions |
| **Motor Organ** | Action tissue, Simulation tissue, Execution tissue | Plans and executes actions |
| **Governance Organ** | Trust tissue, Verification tissue, Risk tissue | Manages admission and safety |
| **Metabolic Organ** | Budget tissue, Allocation tissue, Recycling tissue | Manages resources |
| **Reflexive Organ** | Self-observation tissue, Self-modification tissue, Meta-control tissue | Manages self-reference |

### 7.3 Organ Composition

Organs are not hard-coded. They are declared in the organism's constitution:

```typescript
interface OrganismConstitution {
  organs: OrganSpec[];
  tissues: TissueSpec[];
  cellTypes: CellType[];
  signaling: SignalingSpec;
  homeostasis: HomeostasisSpec;
  boundary: BoundarySpec;
}
```

---

## §8 — The Commit Ledger: Single Authority

### 8.1 Cognitive Transaction

Every unit of cognition is a typed transaction:

```typescript
interface CognitiveTransaction {
  id:            TransactionId;
  correlationId: CorrelationId;
  kind:          TransactionKind;
  cellId:        CellId;
  inputs:        CognitiveObject[];
  outputs:       Candidate[];
  effects:       EffectDeclaration[];
  budget:        BudgetReservation;
  trust:         TrustProfile;
  risk:          RiskProfile;
  reversibility: ReversibilityClass;
  fallback:      FailurePolicy;
  proofObligations: ProofObligation[];
}

type TransactionKind =
  | 'perception' | 'attention' | 'inference' | 'proposal'
  | 'judgment'   | 'commit'    | 'action'    | 'learning'
  | 'forgetting' | 'consolidation' | 'simulation'
  | 'cell-division' | 'cell-death' | 'differentiation'
  | 'genome-edit'   | 'budget-transfer';
```

### 8.2 The Ledger

The commit ledger is the single write surface. Every transaction passes through:

```
Candidate
  → Normalize
  → Type-Check
  → Evidence-Independence Check
  → Proof / Judge / Simulation
  → Rank
  → Budget Settlement
  → Risk Classification
  → Commit or Reject
```

### 8.3 Event Sourcing

Every commit is an append-only event:

```typescript
interface CognitiveEvent {
  eventId:       EventId;
  timestamp:     Timestamp;
  correlationId: CorrelationId;
  cellId:        CellId;
  transactionId: TransactionId;
  kind:          EventKind;
  payload:       TypedPayload;
  parentId:      EventId | null;
  budgetCharge:  BudgetCharge;
  producer:      ProducerId;
  judge:         JudgeId | null;
  proof:         ProofId | null;
}
```

The organism's state is a fold over the event log:

```
State(t) = fold(events[0..t], initialState)
```

### 8.4 Replay and Verification

Any independent verifier can reconstruct the organism's state from the event log, given only:
- The truth algebra (revision, deduction, induction, abduction)
- The event fold function
- The initial state

The verifier shares no engine code. It transcribes the truth table independently.

---

## §9 — Coordination: Signaling and Synchronization

### 9.1 Signaling Pathways

Cells communicate through typed signals:

```typescript
interface Signal {
  signalId:     SignalId;
  source:       CellId;
  target:       CellId | TissueId | 'broadcast';
  kind:         SignalKind;
  payload:      TypedPayload;
  priority:     number;
  ttl:          Duration;
  correlationId: CorrelationId;
}

type SignalKind =
  | 'request'      // ask another cell to perform an operation
  | 'response'     // reply to a request
  | 'notification' // inform without expecting response
  | 'interrupt'    // preempt current operation
  | 'drive'        // homeostatic regulation signal
  | 'differentiation' // signal a stem cell to specialize
  | 'apoptosis'    // signal a cell to begin death
  | 'budget-alert' // signal resource pressure
  | 'consistency-alert'; // signal contradiction detection
```

### 9.2 Signaling Topology

The signaling topology is a directed graph. It is not fixed; it can be reconfigured by the Governance Organ:

```typescript
interface SignalingTopology {
  edges: Map<CellId, Set<CellId>>;  // who can signal whom
  broadcastGroups: Map<GroupId, Set<CellId>>;
  priorityLanes: Map<Priority, Duration>;  // latency budgets per priority
}
```

### 9.3 Synchronization

Cells are asynchronous by default. Synchronization barriers are explicit and budgeted:

```typescript
interface SyncBarrier {
  id:        BarrierId;
  participants: CellId[];
  condition: (states: Map<CellId, CellState>) => boolean;
  timeout:   Duration;
  onTimeout: 'proceed' | 'abort' | 'degrade';
}
```

### 9.4 Multi-Rate Coordination

Different tissues operate at different clock rates. Coordination is through the event log and budget lattice, not through synchronous nesting:

| Rate | Tissue | Clock |
|---|---|---|
| **Fast** (sub-cycle) | Reflex tissue, safety veto | Event-driven, interrupt |
| **Medium** (per-cycle) | Inference tissue, attention tissue | Budget-cycle |
| **Slow** (every K cycles) | Consolidation tissue, episodic merge | Periodic |
| **Very slow** (every M cycles) | Schema induction, identity review | Scheduled |
| **Metabolic** (continuous) | Budget allocation, decay | Continuous |

---

## §10 — Autopoietic Maintenance

### 10.1 Self-Production

The organism produces its own components:

| Component | Produced by | Mechanism |
|---|---|---|
| New cells | Metabolic Organ | Cell division from stem cells |
| Membranes | Governance Organ | Gate lattice instantiation |
| Budgets | Metabolic Organ | Budget lattice allocation |
| Genomes | Reflexive Organ | Genome registry editing |
| Signaling pathways | Governance Organ | Topology reconfiguration |
| Event log | Every cell | Append-only emission |

### 10.2 Self-Maintenance (Homeostasis)

Homeostatic processes maintain the organism's organization:

```typescript
interface HomeostasisSpec {
  drives: DriveSpec[];
  setpoints: Map<DriveId, number>;
  decayRates: Map<DriveId, number>;
  replenishment: Map<DriveId, ReplenishmentFunction>;
  intervention: InterventionPolicy;
}

interface DriveSpec {
  id:        DriveId;
  name:      string;   // e.g., 'curiosity', 'competence', 'coherence', 'social'
  setpoint:  number;
  current:   number;
  decay:     number;
  threshold: number;   // below this, inject meta-goal
}
```

When a drive falls below threshold, the organism injects a meta-goal to restore it. This is a negative feedback loop.

### 10.3 Self-Boundary

The organism's boundary is the autopoietic membrane. It is not a fixed shell but an actively maintained filter:

```
Boundary = ⟨ IngressMembrane, EgressMembrane, IdentityMarker ⟩
```

The identity marker determines what is "self" and what is "environment." Signals that cross the boundary are typed as either:
- **Perturbations** (from environment): trigger internal reorganization
- **Emissions** (to environment): outputs of the organism

### 10.4 Self-Repair

When a cell is damaged (budget exhaustion, repeated failure, inconsistency), the organism can:
1. **Quarantine**: Isolate the cell; prevent it from signaling
2. **Repair**: Attempt to restore the cell's state from its event log
3. **Replace**: Spawn a new cell of the same type; transfer state
4. **Recycle**: Apoptose the cell; reclaim resources

All repair actions are event-sourced and governed.

### 10.5 Self-Observation

The organism observes its own organization through analyzer cells:

```typescript
interface AnalyzerCell extends Cell {
  observes:    CellId[] | TissueId[] | 'organism';
  metrics:     MetricSpec[];
  interval:    Duration;
  report:      (observations: Observation[]) => void;
}
```

Analyzer cells produce **state summaries** that feed the Reflexive Organ.

---

## §11 — Governed Evolution

### 11.1 Variation

Evolutionary variation is proposal generation:

| Variation Type | What Changes | Governance Level |
|---|---|---|
| **Parameter tuning** | Budget ceilings, thresholds, decay rates | Low risk; auto-apply with rollback |
| **Strategy adaptation** | Sampling strategy, attention model, scheduling policy | Medium risk; proposal + shadow test |
| **Rule induction** | New inference rules from derivation chains | Medium-high risk; proof + shadow validation |
| **Genome editing** | Stage graph structure, conditional edges | High risk; proposal + CI + approval |
| **Cell type creation** | New CellType with novel genome/metabolism | High risk; full governance pipeline |
| **Organism constitution** | Organ structure, signaling topology, boundary | Highest risk; external governance only |

### 11.2 Selection

Proposals are evaluated by fitness functions:

```typescript
interface FitnessFunction {
  (cell: Cell, history: EventHistory): number;
}

// Fitness criteria:
// - Epistemic gain: calibrated knowledge increase
// - Teleological gain: goal progress
// - Homeostatic gain: drive balance
// - Resource efficiency: utility per unit budget
// - Consistency: contradiction rate
// - Robustness: fault tolerance
```

### 11.3 Inheritance

Successful mutations are encoded in the genome registry and inherited by daughter cells:

```
CellType(v1) → mutation → CellType(v2) → cell division → children inherit v2
```

### 11.4 Retention

The event log preserves the full evolutionary history. Any prior state can be reconstructed by replaying events up to a given point.

### 11.5 Governance Ladder

Self-modification authority is a filtration:

```
L0: Frozen (no change)
L1: Knob tuning (parameters only)
L2: Strategy switching (pluggable strategies)
L3: Rule induction (new rules, governed)
L4: Genome editing (stage graph mutation, governed)
L5: Cell type creation (new cell types, external governance)
L6: Constitution change (organism structure, external governance only)
```

Each level requires progressively stronger governance. L4+ requires shadow execution in an isolated environment. L5+ requires external approval. L6 is never self-applied.

---

## §12 — Formal Type System

### 12.1 Epistemic Types

```typescript
type CognitiveAxis = 'epistemic' | 'teleological';

interface Belief {
  axis:       'epistemic';
  term:       Term;
  truth:      { frequency: number; confidence: number };
  evidence:   EvidenceLineage;
  source:     SourceAnnotation;
}

interface Goal {
  axis:       'teleological';
  term:       Term;
  desire:     { desire: number; confidence: number };
  progress:   ProgressAnnotation;
}

interface Question {
  axis:       'epistemic';
  term:       Term;
  priority:   number;
  expectedInfoGain: number;
}

interface Hypothesis {
  axis:       'epistemic';
  term:       Term;
  plausibility: number;
  evidenceRequirement: EvidenceSpec;
  status:     'provisional' | 'confirmed' | 'refuted';
}
```

### 12.2 Transaction Types

```typescript
interface TypedTransaction<T extends CognitiveObject> {
  id:            TransactionId;
  kind:          TransactionKind;
  inputs:        T[];
  outputs:       Candidate<T>[];
  budget:        BudgetReservation;
  trust:         TrustProfile;
  risk:          RiskProfile;
  reversibility: ReversibilityClass;
  proofObligations: ProofObligation[];
  governance:    GovernancePath;
}
```

### 12.3 Governance Types

```typescript
interface TrustProfile {
  source:       SourceId;
  quality:      number;        // 0..1
  reputation:   number;        // 0..1
  calibration:  CalibrationStatus;
  claimSpecificity: number;
  corroboration: number;
}

interface RiskProfile {
  risk:          number;       // 0..1
  reversibility: number;       // 0..1
  blastRadius:   number;       // scope of impact
  irreversibility: boolean;
}

interface GovernanceProfile {
  trust:         TrustProfile;
  risk:          RiskProfile;
  proofStatus:   'none' | 'pending' | 'verified' | 'failed';
  judgeStatus:   'none' | 'pending' | 'admitted' | 'rejected';
  simulationStatus: 'none' | 'pending' | 'passed' | 'failed';
  requiredPath:  GovernancePath;
}

type GovernancePath =
  | 'auto-commit'           // high trust, low risk, high reversibility
  | 'shadow-then-promote'   // high trust, medium risk
  | 'provisional-decay'     // medium trust, low risk
  | 'human-review'          // medium trust, medium risk
  | 'strong-proof-required' // any trust, high risk, low reversibility
  | 'reject';               // low trust, high risk, low reversibility
```

### 12.4 Cell Types

```typescript
interface Cell {
  identity:    CellIdentity;
  membrane:    Membrane;
  metabolism:  Metabolism;
  genome:      GenomeId;
  cytosol:     Cytosol;
  nucleus:     Nucleus;
  signals:     SignalHandler;
}

interface Cytosol {
  memory:      MemoryPort;
  attention:   AttentionPort;
  workingSet:  BoundedBag<CognitiveObject>;
}

interface Nucleus {
  commitAuthority: CommitLedger;
  governance:      GovernancePolicy;
  vetoRegistry:    VetoRegistry;
}
```

---

## §13 — Algebraic Laws and Invariants

### 13.1 Epistemic Laws

| Law | Formal Statement | Enforcement |
|---|---|---|
| **Firewall** | `Reward ∩ Belief.truth = ∅` | Type system; runtime check |
| **Evidence Independence** | `rev(e₁, e₂)` requires `e₁ ⊥ e₂` | Revision operator checks independence flag |
| **Paraconsistency** | `(A→B) ∧ ¬(A→B)` may coexist with distinct truth values | No explosion rule in truth algebra |
| **Non-Monotonicity** | Revision may retract prior conclusions | Truth values are defeasible |
| **Sub-additivity** | `c_rev < c₁ + c₂` | Confidence formula enforces |

### 13.2 Commit Laws

| Law | Formal Statement | Enforcement |
|---|---|---|
| **Single Write** | `∃! commit : Transaction → State` | One commit ledger; all writes route through it |
| **Admit Before Write** | `∀ mutation, ∃ preceding gate event` | Event log ordering |
| **Budget Closure** | `∀ charge, ∃ BudgetScopeId` | Typed budget charges |
| **No Silent Failure** | `∀ fault, ∃ typed event` | Failure policies emit events |

### 13.3 Autopoietic Laws

| Law | Formal Statement | Enforcement |
|---|---|---|
| **Organizational Closure** | `∀ component c, ∃ process p ∈ Organism : p produces/maintains c` | Constitution check |
| **Boundary Maintenance** | `∀ perturbation, ∃ membrane response` | Membrane gate lattice |
| **Recycling** | `∀ dead cell, resources returned to organism pool` | Apoptosis protocol |
| **Homeostatic Regulation** | `∀ drive d, ∃ replenishment function` | Homeostasis spec |

### 13.4 Evolution Laws

| Law | Formal Statement | Enforcement |
|---|---|---|
| **No Self-Approval** | `∀ self-mod m, approver(m) ≠ proposer(m)` | Governance ladder |
| **Governed Mutation** | `∀ mutation, ∃ governance path` | Governance profile |
| **Inheritance Fidelity** | `child.genome ∈ {parent.genome, approvedMutations}` | Genome registry |
| **Rollback** | `∀ mutation, ∃ rollback event` | Event log |

---

## §14 — Feasibility Constraints

These are inter-axis laws. Violation means the configuration is not a viable organism.

| # | Constraint | Rationale |
|---|---|---|
| **F1** | Epistemic firewall requires type-level belief/goal separation | Reward hacking, sycophancy |
| **F2** | Untrusted proposers require calibrated judgment gates | Evidence laundering |
| **F3** | Bounded cognition requires forgetting and backpressure | Memory exhaustion |
| **F4** | Event-sourced state requires deterministic replay | Audit trail non-reproducibility |
| **F5** | Self-modification at level ≥ L4 requires shadow validation + external governance | Self-approval is unsound |
| **F6** | Paraconsistent truth requires graded truth values | Explosion via monotonic chaining |
| **F7** | Standalone verifier must not share engine code | Co-adaptation hides bugs |
| **F8** | Exact substrate (e-graph) must not union on uncertain similarity | Equality contamination |
| **F9** | Anytime execution requires preemptive scheduler | FIFO cannot preempt |
| **F10** | Multi-rate coordination requires event-log synchronization | Synchronous nesting creates bottlenecks |
| **F11** | Cell division requires budget partition | Resource exhaustion |
| **F12** | Apoptosis requires state export or archive | Data loss |

---

## §15 — Minimal Kernel Specification

The smallest viable organism contains:

### 15.1 Required Components

| Component | Minimum |
|---|---|
| **Cell** | One founding cell with membrane, metabolism, genome, cytosol, nucleus |
| **Membrane** | Ingress (fail-closed) + Egress (fail-open) + Cycle (always-admit) |
| **Metabolism** | Multi-dimensional budget with reservation and settlement |
| **Genome** | One stage graph (loaded as data) |
| **Cytosol** | Bounded bag with priority sampling |
| **Nucleus** | One commit ledger |
| **Event Log** | Append-only, with correlation IDs |
| **Verifier** | Standalone, transcribed truth table |
| **Homeostasis** | At least one drive with setpoint and decay |

### 15.2 Kernel Interface

```typescript
interface ACSKernel {
  // Cell management
  instantiateCell(type: CellType, parent: CellId | null): CellId;
  activateCell(id: CellId): void;
  dorm Cell(id: CellId): void;
  apoptoseCell(id: CellId, recipient: CellId | null): void;
  divideCell(id: CellId, childType: CellType): CellId;

  // Transaction processing
  submitTransaction(tx: CognitiveTransaction): TransactionResult;
  commitTransaction(tx: CognitiveTransaction): CommitResult;

  // Budget management
  reserveBudget(scope: BudgetScopeId, amount: number): ReservationId;
  settleBudget(reservation: ReservationId, used: number): void;
  transferBudget(from: BudgetScopeId, to: BudgetScopeId, amount: number): TransferResult;

  // Signaling
  sendSignal(signal: Signal): void;
  broadcastSignal(signal: Signal, group: GroupId): void;

  // Event sourcing
  emitEvent(event: CognitiveEvent): EventId;
  replayEvents(upTo: EventId): OrganismState;
  verifyReplay(state: OrganismState, hash: StateHash): boolean;

  // Governance
  evaluateGovernance(profile: GovernanceProfile): GovernancePath;
  proposeSelfModification(proposal: SelfModProposal): ProposalId;
  approveSelfModification(id: ProposalId, approver: ApproverId): ApprovalResult;

  // Homeostasis
  getDriveLevel(id: DriveId): number;
  injectMetaGoal(drive: DriveId, goal: Goal): void;

  // Observability
  getStateSummary(): OrganismSummary;
  getCellMetrics(id: CellId): CellMetrics;
  getCausalTrace(correlationId: CorrelationId): CausalDAG;
}
```

### 15.3 Minimal Cell Type

```typescript
const FOUNDING_CELL_TYPE: CellType = {
  id: 'founding',
  genome: {
    nodes: [
      { id: 'perceive', operation: 'perceive', precondition: always, ... },
      { id: 'attend',   operation: 'attend',   precondition: hasWork, ... },
      { id: 'reason',   operation: 'infer',    precondition: always, ... },
      { id: 'authorize', operation: 'commit',  precondition: always, ... },
      { id: 'propose',  operation: 'propose',  precondition: hasProducer, ... },
      { id: 'learn',    operation: 'learn',    precondition: isDue, ... },
    ],
    edges: [
      { from: 'perceive', to: 'attend', guard: always },
      { from: 'attend',   to: 'reason', guard: hasWork },
      { from: 'attend',   to: 'triage', guard: budgetStarved },
      { from: 'reason',   to: 'authorize', guard: always },
      { from: 'authorize', to: 'propose', guard: hasProducer },
      { from: 'propose',  to: 'learn', guard: always },
      { from: 'learn',    to: 'perceive', guard: notAborted },
    ],
    entry: 'perceive',
  },
  membrane: {
    ingress: { orientation: 'fail-closed', judge: 'calibrated' },
    egress:  { orientation: 'fail-open', judge: 'veto' },
    cycle:   { orientation: 'always-admit' },
  },
  metabolism: {
    dimensions: {
      cycles:      { ceiling: 1000, reset: 'lifetime' },
      derivations: { ceiling: 100, reset: 'per-cycle' },
      memoryOps:   { ceiling: 10000, reset: 'lifetime' },
      modelCalls:  { ceiling: 50, reset: 'lifetime' },
    },
  },
  cytosol: { memory: 'bounded-bag', attention: 'composite' },
  nucleus: { commitAuthority: 'ledger', governance: 'ladder' },
  differentiation: { potential: ['epistemic', 'motor', 'governance', 'consolidation'] },
  fitness: defaultFitness,
  lifespan: { policy: 'immortal' },  // founding cell does not die
};
```

---

## §16 — Extension and Growth Protocol

### 16.1 Adding a New Cell Type

1. Define the CellType (genome, membrane, metabolism, cytosol, nucleus)
2. Verify feasibility constraints (F1–F12)
3. Register in the CellType registry
4. Instantiate from a stem cell or existing cell via division
5. Connect to signaling topology
6. Allocate budget from organism pool
7. Activate

### 16.2 Adding a New Organ

1. Define the OrganSpec (tissues, cells, coordinator)
2. Define the tissues and their cell compositions
3. Register in the OrganismConstitution
4. Instantiate tissues and cells
5. Connect to signaling topology
6. Allocate budget
7. Verify homeostatic integration

### 16.3 Scaling

The organism scales by:
- **Horizontal scaling**: Adding more cells of the same type (hyperplasia)
- **Vertical scaling**: Increasing the capacity of existing cells (hypertrophy)
- **Functional scaling**: Adding new cell types and organs (differentiation)
- **Temporal scaling**: Adding new clock rates (multi-rate coordination)

### 16.4 Migration Path

The architecture can be built incrementally:

| Phase | Scope | Deliverable |
|---|---|---|
| **Phase 1** | Minimal kernel | One founding cell, commit ledger, event log, verifier |
| **Phase 2** | Declarative control | Stage graph as data; replace hard-coded loop |
| **Phase 3** | Resource economy | Budget lattice with reservation, settlement, transfer |
| **Phase 4** | Multi-cell | Cell division, tissues, signaling |
| **Phase 5** | Autopoiesis | Homeostasis, self-repair, boundary maintenance |
| **Phase 6** | Governed evolution | Genome editing, cell type creation, governance ladder |
| **Phase 7** | Full organism | Organs, multi-rate coordination, constitutional governance |

Each phase preserves all hard constraints (H1–H10) and feasibility constraints (F1–F12).

---

## §17 — Degradation and Recovery

### 17.1 Degradation Modes

| Condition | Degradation | Recovery |
|---|---|---|
| Judgment unavailable | Degrade to symbolic baseline | Restore judgment when available |
| Budget exhausted | Skip low-priority operations; backpressure | Reallocate from surplus scopes |
| Memory pressure | Evict low-priority items; consolidate | Archive to secondary storage |
| Cell failure | Quarantine cell; route around | Repair or replace cell |
| Model unavailable | Use symbolic fallback | Restore model when available |
| Contradiction detected | Retain both with distinct truth values; flag for resolution | Resolve via revision or quarantine |
| Governance unavailable | Halt self-modification; continue cognition | Restore governance |

### 17.2 Failure Policy

Every operation carries an explicit failure policy:

```typescript
type FailurePolicy =
  | 'abort'          // halt the operation; emit fault event
  | 'retry'          // retry with backoff; emit retry events
  | 'degrade'        // fall back to weaker mode; emit degradation event
  | 'skip'           // skip the operation; emit skip event
  | 'fail-closed'    // reject; emit rejection event
  | 'fail-open'      // admit without judgment; emit admission event
  | 'abstain';       // produce no output; emit abstention event
```

No failure is silently swallowed. Every fault produces a typed event.

### 17.3 Recovery Protocol

1. Detect failure (via analyzer cells or budget alerts)
2. Classify failure (transient vs. permanent; cell-level vs. organism-level)
3. Isolate affected cells (quarantine)
4. Attempt repair (replay from event log; restore from snapshot)
5. If repair fails, replace (spawn new cell; transfer state)
6. If replacement fails, degrade (reduce capability; maintain core function)
7. Log all recovery actions as events

---

## §18 — Implementation Roadmap

### 18.1 Technology Choices

| Component | Technology | Rationale |
|---|---|---|
| Event log | Append-only JSONL + SQLite | Durable, queryable, replayable |
| Type system | TypeScript with branded types | Compile-time safety; runtime validation |
| Budget engine | Typed budget lattice with reservation | Prevents silent starvation |
| Stage graph | Declarative JSON/YAML loaded at runtime | Data, not code |
| Verifier | Standalone module; transcribed truth table | No shared engine code |
| Signaling | Typed message queue (in-process or distributed) | Async, priority-aware |
| Governance | Policy engine with risk classifier | Governed self-modification |
| Cell runtime | Isolated execution context per cell | Fault isolation |

### 18.2 Testing Strategy

| Test Type | What It Verifies |
|---|---|
| **Feasibility tests** | All F1–F12 constraints hold for every configuration |
| **Firewall tests** | Reward cannot mutate belief truth |
| **Replay tests** | Event log reconstructs state identically |
| **Verifier tests** | Standalone verifier checks derivations independently |
| **Budget tests** | No operation exceeds budget; reservation/settlement correct |
| **Apoptosis tests** | Cell death exports state and releases resources |
| **Division tests** | Cell division partitions budget and state correctly |
| **Degradation tests** | System degrades gracefully under resource pressure |
| **Governance tests** | Self-modification cannot be self-approved |
| **Paraconsistency tests** | Contradictions coexist without explosion |

### 18.3 Performance Targets

| Metric | Target |
|---|---|
| Commit latency | < 10ms for low-risk transactions |
| Judgment latency | < 2000ms for calibrated judgment |
| Replay speed | > 1000 events/second |
| Cell instantiation | < 1ms |
| Signal propagation | < 1ms in-process |
| Budget reservation | < 0.1ms |
| Event emission | < 0.1ms |

### 18.4 Observability

Every organism exposes:

```typescript
interface ObservabilitySurface {
  getStateSummary(): OrganismSummary;
  getCellMetrics(id: CellId): CellMetrics;
  getCausalTrace(correlationId: CorrelationId): CausalDAG;
  getBudgetUtilization(): BudgetReport;
  getFitnessReport(): FitnessReport;
  getGovernanceLog(): GovernanceEvent[];
  getEvolutionaryHistory(): EvolutionaryRecord[];
  getHomeostaticStatus(): DriveStatus[];
}
```

---

## §19 — Summary: The Autopoietic Cognitive Substrate

The ACS is a self-producing, cellular, evolving cognitive system. Its fundamental properties are:

| Property | Mechanism |
|---|---|
| **Cellular** | Cognition happens in bounded, self-governing cells |
| **Autopoietic** | The system produces and maintains its own components |
| **Growing** | The organism scales by cell division, not by adding stages |
| **Evolving** | The organism evolves through governed mutation and selection |
| **Epistemically safe** | Belief/goal firewall; untrusted proposers; calibrated judgment |
| **Bounded** | AIKR; budgets, forgetting, backpressure, interruption |
| **Auditable** | Event-sourced; replayable; independently verifiable |
| **Governed** | All self-modification is proposal → shadow → verdict → commit |
| **Resilient** | Cellular isolation; graceful degradation; self-repair |
| **Unified** | One commit ledger; one governance vocabulary; one resource calculus |

The organism is not a pipeline. It is not a loop. It is a living system of cells that produce, maintain, and reproduce the organization that makes cognition possible.

---

*End of Specification*
