# CYTOS — The Cellular Autopoietic Cognitive Architecture

## A Complete, Self-Contained Design Specification

---

## §0 — Preamble & Selected Principles

### 0.1 Architectural Character

CYTOS is a **cellular, autopoietic cognitive architecture**. Its fundamental unit is not a stage, a loop, or a pipeline — it is the **cell**: a bounded, self-maintaining cognitive unit with a selective membrane, internal metabolism, a governable genome, and the capacity to divide, differentiate, signal, and die.

The system is:

| Property | Mechanism |
|---|---|
| **Cellular** | All cognition is performed by bounded cells with selective membranes. No global mutable state. No central pipeline. |
| **Evolving** | Cells carry genomes. Governed mutation of genomes produces structural change. Evolution is proposal → validation → governance → commit. |
| **Growing / Scalable** | New capacity is added by cell division and differentiation, not by enlarging existing components. Tissues and organs emerge from cellular composition. |
| **Autopoietic** | The system produces and maintains its own cells. Stem cells generate new cognitive units. Damaged cells are replaced. The organization sustains itself. |

### 0.2 Selected Design Bundle

**Prime Objectives** (from the menu):
- **O1** Maximum epistemic integrity
- **O2** Auditable causal provenance
- **O3** Control-plane fluidity (declarative, data-driven)
- **O4** Resource economics
- **O6** Governed reflexivity
- **O8** Unified commit ledger
- **O9** Compositional configurability

**Hard Constraints** (inviolable):
- **H1** No reward → belief-truth mutation
- **H2** No untrusted proposal enters memory without judgment or provisional typing
- **H3** No state mutation without an event-log entry
- **H4** No self-modification is self-approved
- **H5** No unbounded reasoning path
- **H6** No opaque scheduler decision
- **H9** No silently swallowed failure affecting cognition, budget, or admission

**Anti-Goals**:
- **A2** No scheduler opacity
- **A5** No monolithic LM authority
- **A7** No unbounded cognitive richness

**Architectural bias**: **D3** (Maximum Elegance / Unification) tempered by **D4** (Maximum Robustness) and **D6** (Maximum Adaptivity). One cell model, one signal model, one commit surface, one governance vocabulary, one resource model — applied uniformly at every scale.

---

## §1 — Formal Ontology

### 1.1 The Sort Signature

CYTOS is defined over **eight irreducible sorts**:

$$\mathcal{C}_{\text{YTOS}} = \langle\; \mathsf{Cell},\; \mathsf{Membrane},\; \mathsf{Cytoplasm},\; \mathsf{Organelle},\; \mathsf{Signal},\; \mathsf{Metabolism},\; \mathsf{Genome},\; \mathsf{Lineage}\; \rangle$$

| Sort | Role | Algebraic Structure |
|---|---|---|
| $\mathsf{Cell}$ | The bounded autopoietic unit | Comonad (extract state, duplicate for division) |
| $\mathsf{Membrane}$ | Selective permeability / trust boundary | Bounded lattice of channel-gates |
| $\mathsf{Cytoplasm}$ | Typed working state | Graded store: $\{B, G, Q, H, A, P\}$-typed compartments |
| $\mathsf{Organelle}$ | Specialized processor (substrate engine) | Operad of typed operators |
| $\mathsf{Signal}$ | Inter-cell communication | Typed, budgeted, correlation-carrying monoid |
| $\mathsf{Metabolism}$ | Resource economics | Ordered commutative monoid with reservation |
| $\mathsf{Genome}$ | Governance + self-modification authority | Filtration $\mathcal{F}_0 \subset \mathcal{F}_1 \subset \cdots \subset \mathcal{F}_4$ |
| $\mathsf{Lineage}$ | Provenance / ancestry | Append-only event comonad |

### 1.2 The Composition Law

A cell is the fiber product of all eight sorts:

$$\mathsf{Cell} = \mathsf{Membrane} \times_{\mathsf{Signal}} \mathsf{Cytoplasm} \times_{\mathsf{Metabolism}} \mathsf{Organelle}^* \times_{\mathsf{Genome}} \mathsf{Lineage}$$

Compatibility constraints (what makes a valid cell):

| Constraint | Meaning |
|---|---|
| $\mathsf{Membrane} \models \mathsf{Cytoplasm}$ | Every channel admits only signals typed for the target compartment |
| $\mathsf{Metabolism} \models \mathsf{Organelle}$ | Every organelle operation is budgeted |
| $\mathsf{Genome} \models \mathsf{Membrane}$ | Membrane topology changes require genomic authority |
| $\mathsf{Lineage} \models \mathsf{Signal}$ | Every membrane crossing emits a lineage event |
| $\mathsf{Cytoplasm} \models \mathsf{Lineage}$ | Every cytoplasmic mutation is event-sourced |

---

## §2 — The Cell

### 2.1 Cell Anatomy

```
┌──────────────────────────────────────────────────────────────────┐
│  MEMBRANE  (selective permeability · trust boundary)             │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│  │Ingress │ │Egress  │ │Commit  │ │Signal  │ │Division│       │
│  │Channel │ │Channel │ │Channel │ │Channel │ │Channel │       │
│  └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘       │
│      │          │          │          │          │              │
│  ════╪══════════╪══════════╪══════════╪══════════╪══════════   │
│      ▼          ▼          ▼          ▼          ▼              │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  CYTOPLASM  (typed, graded working state)                │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────────┐  │   │
│  │  │ Beliefs │ │ Goals   │ │ Questions│ │ Hypotheses  │  │   │
│  │  │ (f,c)   │ │ (d,c)   │ │ (p,EIG)  │ │ (plaus,req) │  │   │
│  │  └─────────┘ └─────────┘ └──────────┘ └─────────────┘  │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐                  │   │
│  │  │ Plans   │ │ Lessons │ │ Attention│                  │   │
│  │  │ (u,f,r) │ │ (s,t,a) │ │ (w,decay)│                  │   │
│  │  └─────────┘ └─────────┘ └──────────┘                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│      │          │          │          │                         │
│  ┌───┴────┐ ┌───┴────┐ ┌───┴────┐ ┌───┴────┐                  │
│  │ORGANELLE│ │ORGANELLE│ │ORGANELLE│ │ORGANELLE│  ...           │
│  │NAL Eng. │ │Exact   │ │Neural  │ │Tool    │                  │
│  │(44 rules)│ │(MeTTa) │ │Proposer│ │I/F     │                  │
│  └────────┘ └────────┘ └────────┘ └────────┘                  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  METABOLISM  (resource pool · enzymes · transporters)    │   │
│  │  Budget reservations · pricing · backpressure · decay    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  GENOME  (constitution · epigenetics · division rules)   │   │
│  │  Self-mod authority · governance level · identity        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  LINEAGE  (append-only event log · ancestry · corr-ID)   │   │
│  └──────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.2 Cell Identity

Every cell carries an immutable identity:

```typescript
interface CellIdentity {
  cellId:        CellId;           // globally unique, immutable
  cellType:      CellType;         // current differentiation state
  parentId:      CellId | null;    // null for genesis cells
  generation:    number;           // division depth
  createdAt:     Timestamp;
  constitution:  ConstitutionHash; // pinned governance fingerprint
}
```

### 2.3 Cell Types (Differentiation States)

Cells differentiate into specialized types. This is **data, not code** — the type registry is loaded, versioned, and governable.

| Cell Type | Primary Organelles | Function |
|---|---|---|
| `StemCell` | None (undifferentiated) | Produces new cells via division |
| `PerceptionCell` | Ingress parser, embedding encoder | Processes external stimuli |
| `InferenceCell` | NAL engine, exact engine | Derives conclusions from premises |
| `JudgmentCell` | Calibrated manifold, symbolic verifier | Evaluates proposals |
| `AttentionCell` | Priority sampler, focus manager | Allocates cognitive resources |
| `ConsolidationCell` | Decay engine, archive, schema inductor | Sleep-like integration |
| `ActionCell` | Tool interface, risk classifier | Plans and executes effects |
| `GovernanceCell` | Risk classifier, approval router | Oversees self-modification |
| `MetaCell` | Analyzers, self-model, strategy tuner | Reasons about control |
| `ImmuneCell` | Anomaly detector, veto registry | Detects and quarantines threats |

Differentiation is a **signal-driven process**: morphogen concentrations (see §9) bias stem cells toward specific fates. The genome constrains which differentiations are permitted.

---

## §3 — The Membrane

### 3.1 Channel Architecture

The membrane is a **bounded lattice of channels**. Each channel is a typed gate with a trust policy and a failure mode.

```typescript
interface MembraneChannel {
  channelId:     ChannelId;
  direction:     'ingress' | 'egress' | 'commit' | 'signal' | 'division';
  gate:          GateSpec;            // the admission predicate
  trustPolicy:   TrustPolicy;         // who may use this channel
  failurePolicy: 'fail-closed' | 'fail-open' | 'fail-degrade' | 'fail-abstain';
  budgetScope:   BudgetScopeId;       // which metabolic pool pays
  epistemicType: CognitiveAxis;       // 'epistemic' | 'teleological' | 'control'
  vetoRegistry:  VetoId[];            // who can block this channel
}
```

### 3.2 The Epistemic Firewall as Membrane Typing

The belief/goal firewall is enforced **at the membrane level**, not by convention:

| Channel Type | Permits | Blocks |
|---|---|---|
| `epistemic-ingress` | Belief-typed signals $(f,c)$ | Reward, desire, utility signals |
| `teleological-ingress` | Goal-typed signals $(d,c)$ | Factual evidence signals |
| `commit` | Judged, budgeted, typed proposals | Unjudged proposals, reward→truth mutations |
| `metabolic` | Resource tokens | Cognitive content |
| `governance` | Genome mutation proposals | Direct genome writes |

**Invariant (H1)**: No channel of type `teleological` or `metabolic` may write to a cytoplasmic compartment of type `Belief`. This is a **type-level law** enforced by the membrane's channel registry, not a runtime check.

**Invariant (H2)**: No signal from an untrusted source (neural, LM, peer, reflex) may cross the `commit` channel without passing through a `JudgmentCell` or being explicitly typed as `provisional`.

### 3.3 Gate Composition

Gates compose algebraically:

| Operation | Symbol | Semantics |
|---|---|---|
| Serial | $G_1 \circ G_2$ | Both must admit |
| Parallel | $G_1 \parallel G_2$ | Both admit (same decision, different checks) |
| Voting | $G_1 \oplus G_2 \oplus \cdots$ | Majority admits |
| Fallback | $G_1 \triangleright G_2$ | Try $G_1$; on fault, try $G_2$ |
| Complement | $\neg G$ | Admit iff $G$ refuses |

Each gate is either a **closure operator** (fail-open: $x \leq g(x)$) or an **interior operator** (fail-closed: $g(x) \leq x$). The membrane's orientation field assigns a polarity to each channel.

### 3.4 Failure Transparency

**Invariant (H9)**: No gate failure, budget exhaustion, or channel fault may be silently swallowed. Every failure emits a typed `MembraneFault` event into the cell's lineage. The event carries the channel ID, the failure reason, the fallback action taken, and the correlation ID.

---

## §4 — The Cytoplasm

### 4.1 Typed Compartments

The cytoplasm is a **graded, typed store**. Each compartment holds a specific cognitive attitude:

| Compartment | Type Tag | Value Structure | Mutation Authority |
|---|---|---|---|
| `Beliefs` | $B$ | $(f, c)$ frequency × confidence | Evidence only |
| `Goals` | $G$ | $(d, c)$ desire × confidence | Reward + evidence |
| `Questions` | $Q$ | $(\text{priority}, \text{EIG})$ | Attention + curiosity |
| `Hypotheses` | $H$ | $(\text{plausibility}, \text{evidence\_req})$ | Inference + evidence |
| `Plans` | $P$ | $(\text{utility}, \text{feasibility}, \text{risk})$ | Planning + judgment |
| `Lessons` | $L$ | $(\text{source}, \text{trust}, \text{applicability})$ | Learning + governance |
| `Attention` | $A$ | $(\text{weight}, \text{decay})$ | Reward (priority only) |

### 4.2 The Single Commit Surface

**Invariant (A2)**: All durable mutations to any cytoplasmic compartment pass through the **commit channel** of the membrane. There is exactly one write path per cell.

```typescript
interface CommitCandidate {
  candidateId:     CandidateId;
  correlationId:   CorrelationId;
  compartment:     CompartmentType;    // which cytoplasmic compartment
  cognitiveAxis:   'epistemic' | 'teleological' | 'control';
  content:         TypedCognitiveObject;
  proposer:        ProposerId;         // who generated this
  judge?:          JudgeId;            // who evaluated this (if judged)
  trust:           TrustProfile;
  risk:            RiskProfile;
  reversibility:   ReversibilityClass;
  budget:          BudgetReservation;
  proofObligations: ProofObligation[];
}
```

The commit pipeline is universal:

$$\text{Candidate} \xrightarrow{\text{normalize}} \text{type-check} \xrightarrow{\text{evidence-indep}} \text{proof/judge} \xrightarrow{\text{rank}} \text{budget-settle} \xrightarrow{\text{risk-classify}} \textbf{commit}$$

### 4.3 Paraconsistent Coexistence

The cytoplasm tolerates contradictions. Both $(A \to B)$ and $\neg(A \to B)$ may coexist in the `Beliefs` compartment with distinct truth values. The system does not explode. Contradictions are **flagged, graded, and queryable** — they become `ConflictSet` objects that `ConsolidationCell` or `JudgmentCell` may resolve, but resolution is never forced.

---

## §5 — Organelles & Substrates

### 5.1 The Organelle Operad

Organelles are **specialized processors** mounted in the cytoplasm. Each organelle is a typed operator:

$$\text{Organelle} : \text{Input}^n \rightharpoonup \text{Output} \times \text{Truth} \times \text{Cost}$$

Organelles compose via an operad: sequential, parallel, conditional, and fallback composition are all expressible.

### 5.2 Substrate Isolation (H8)

**Invariant**: No exact symbolic substrate (e-graph, equality saturation) may union nodes based on uncertain similarity scores from a neural or probabilistic substrate. Substrates are **islands** that exchange **proposals** through membrane channels, never shared memory.

| Substrate | Isolation Boundary | Exchange Protocol |
|---|---|---|
| NAL (uncertain, $(f,c)$) | Own memory space | Emits `DerivationProposal` |
| Exact (MeTTa, e-graphs) | Own memory space | Emits `ExactResultProposal` |
| Neural (LM, embeddings) | External, stateless | Emits `NeuralProposal` |
| Probabilistic | Own memory space | Emits `ProbabilisticProposal` |

All proposals enter the cytoplasm through the same `commit` channel. The substrate boundary is a **membrane within the membrane**.

### 5.3 Organelle Registry

The organelle registry is **data, not code**. New organelles can be registered, versioned, and governed:

```typescript
interface OrganelleSpec {
  organelleId:   OrganelleId;
  substrate:     'nal' | 'exact' | 'neural' | 'probabilistic' | 'heuristic';
  inputTypes:    CognitiveType[];
  outputTypes:   CognitiveType[];
  costProfile:   CostVector;         // metabolic dimensions consumed
  trustLevel:    'trusted-core' | 'untrusted-proposer';
  fallback?:     OrganelleId;        // degradation target
  governance:    GovernanceLevel;    // what authority is needed to modify
}
```

---

## §6 — Metabolism: Resource Economics

### 6.1 The Metabolic Model

Each cell maintains a **metabolism**: an ordered commutative monoid of resource dimensions with reservation, pricing, and backpressure.

$$\mathsf{Metabolism} = \langle \mathcal{R}, +, 0, \leq, \text{reserve}, \text{settle}, \text{price} \rangle$$

| Component | Role |
|---|---|
| $\mathcal{R}$ | Resource vector: $\langle \text{cycles}, \text{derivations}, \text{memoryOps}, \text{llmCalls}, \text{tokens}, \text{latency}, \text{attention}, \text{risk} \rangle$ |
| $\text{reserve}$ | Pre-allocate resources before execution |
| $\text{settle}$ | Reconcile reserved vs. consumed after execution |
| $\text{price}$ | Marginal utility pricing: $\text{score}(op) = \frac{\hat{\Delta}K + \hat{\Delta}G + \hat{\Delta}H}{\lambda_c \hat{C} + \lambda_r \hat{R}}$ |

### 6.2 Reservation Protocol

**Invariant (H5)**: No organelle may execute without a prior metabolic reservation. The protocol is:

1. Organelle requests resources → Metabolism checks availability
2. If available → `reserve()` deducts from pool, returns reservation token
3. Organelle executes with reservation token
4. On completion → `settle()` reconciles reserved vs. consumed
5. On interruption → unused reservation is refunded
6. On exhaustion → typed `MetabolicExhaustion` event is emitted (never silent)

### 6.3 Inter-Cellular Metabolism

Resources flow between cells through **metabolic signals**. A parent cell can allocate a metabolic budget to a daughter cell. A tissue can maintain a shared metabolic pool. The global organism maintains a **total metabolic budget** that is the sum of all cellular allocations (AIKR is preserved globally even as local allocations adapt).

### 6.4 Thermodynamic Degradation

Under resource pressure, cells degrade gracefully:

| Pressure Level | Response |
|---|---|
| Low | Normal operation |
| Medium | Reduce organelle diversity; prefer symbolic over neural |
| High | Consolidate: merge underutilized cells; shed low-priority compartments |
| Critical | Apoptosis of non-essential cells; preserve constitution and lineage |

---

## §7 — Signaling: Inter-Cell Communication

### 7.1 The Signal Type

All inter-cell communication uses a single typed signal:

```typescript
interface Signal {
  signalId:      SignalId;
  correlationId: CorrelationId;      // threaded from stimulus
  type:          SignalType;
  sender:        CellId;
  receiver:      CellId | 'broadcast' | 'tissue';
  payload:       TypedCognitiveObject;
  cognitiveAxis: 'epistemic' | 'teleological' | 'control' | 'metabolic' | 'governance';
  trust:         TrustProfile;
  budget:        BudgetToken;        // metabolic cost of processing
  timestamp:     LogicalClock;
  parentId?:     SignalId;           // causal chain
}
```

Signal types:

| Type | Payload | Direction |
|---|---|---|
| `Stimulus` | External perception | Ingress → PerceptionCell |
| `Proposal` | Candidate belief/goal/plan | Organelle → Commit channel |
| `Verdict` | Admit/reject/defer decision | JudgmentCell → Commit channel |
| `Metabolic` | Resource request/grant/deny | Cell ↔ Metabolism |
| `Morphogen` | Growth/differentiation signal | GovernanceCell → StemCell |
| `Apoptotic` | Programmed death signal | GovernanceCell → target Cell |
| `Division` | Mitosis request | Cell → GovernanceCell |
| `Lineage` | Event log entry | Any → Lineage |

### 7.2 Correlation Threading

**Invariant (C2)**: Every signal carries a `correlationId` minted at the originating stimulus. This ID threads through every cell, every membrane crossing, every organelle operation, every commit, and every lineage event. The result is a **causal DAG** from stimulus to outcome:

$$\text{stimulus} \xrightarrow{\text{corrId}} \text{perception} \xrightarrow{\text{corrId}} \text{inference} \xrightarrow{\text{corrId}} \text{judgment} \xrightarrow{\text{corrId}} \text{commit} \xrightarrow{\text{corrId}} \text{action}$$

### 7.3 The Signaling Graph

Cells form a **directed signaling graph** within a tissue. The graph topology is **data**: it can be reconfigured by `MetaCell` proposals (subject to governance). Edges carry channel specifications; nodes carry cell references.

---

## §8 — The Cell Cycle

### 8.1 Mitosis (Cell Division)

When a cell's metabolic load exceeds a threshold, or when differentiation requires specialization, the cell divides:

1. **Request**: Cell emits a `Division` signal to `GovernanceCell`
2. **Authorization**: Governance checks genome permissions, budget availability, and tissue need
3. **Genome Copy**: Parent genome is copied. Mutations (if any) are proposed and governed
4. **Cytoplasm Split**: Working state is partitioned. Beliefs/goals are distributed by relevance
5. **Lineage Fork**: Each daughter receives a copy of the parent's lineage plus a `division` event
6. **Metabolic Allocation**: Parent's metabolic budget is split between daughters
7. **Membrane Formation**: Each daughter receives its own membrane with appropriate channels

Division preserves all invariants: the epistemic firewall, the commit surface, provenance, and boundedness.

### 8.2 Differentiation

Stem cells differentiate in response to **morphogen gradients**:

| Morphogen | Effect |
|---|---|
| `NEED_INFERENCE` | Biases stem → InferenceCell |
| `NEED_JUDGMENT` | Biases stem → JudgmentCell |
| `NEED_CONSOLIDATION` | Biases stem → ConsolidationCell |
| `NEED_ACTION` | Biases stem → ActionCell |
| `NEED_GOVERNANCE` | Biases stem → GovernanceCell |

Morphogen concentrations are computed by `MetaCell` based on tissue-level signals: queue depths, metabolic pressure, error rates, and drive states.

### 8.3 Apoptosis (Programmed Cell Death)

Cells die when:

- They are metabolically unsustainable (budget exhausted, no prospect of recovery)
- They are corrupted (integrity check failure, immune signal)
- They are redundant (tissue consolidation)
- They receive a governed `Apoptotic` signal

Apoptosis protocol:
1. Cell's lineage is finalized and archived
2. Cytoplasmic contents are either transferred to a sibling cell or discarded (governed)
3. Metabolic resources are returned to the tissue pool
4. A `CellDeath` event is emitted with full provenance
5. The cell's membrane is dissolved

---

## §9 — Autopoiesis: Self-Production

### 9.1 The Autopoietic Loop

The system maintains itself through a closed loop of self-production:

```
  ┌─────────────────────────────────────────────────────────┐
  │                                                         │
  │   Stem Cell Pool                                        │
  │       │                                                 │
  │       ▼                                                 │
  │   Differentiation ──→ New Cells ──→ Tissue Function     │
  │       ▲                                    │            │
  │       │                                    ▼            │
  │   Morphogen Signals ◄── MetaCell ◄── Tissue Signals     │
  │       ▲                                    │            │
  │       │                                    ▼            │
  │   Governance ◄── Genome Integrity ◄── Constitution      │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

### 9.2 Self-Maintenance

The system continuously:

- **Monitors** cell health via metabolic telemetry and integrity checks
- **Replaces** damaged cells by activating stem cells with the same genome
- **Consolidates** redundant cells via governed merge operations
- **Repairs** membrane breaches by re-instantiating channel specifications
- **Preserves** the constitution: the set of invariants that define the system's identity

### 9.3 The Constitution

The constitution is the **identity of the organism**. It is the set of invariants that cannot be modified by any cell, any learning process, or any self-modification:

| Constitutional Invariant | Status |
|---|---|
| Belief/goal firewall (H1) | Immutable |
| Single commit surface per cell (A2) | Immutable |
| Provenance by construction (H3) | Immutable |
| Bounded cognition (H5) | Immutable |
| No self-approved self-modification (H4) | Immutable |
| No opaque scheduler decisions (H6) | Immutable |
| No silent failures (H9) | Immutable |
| Untrusted proposers require judgment (H2) | Immutable |
| Substrate isolation (H8) | Immutable |

The constitution is **not a genome**. Genomes can be mutated (under governance). The constitution cannot. It is the fixed point around which all evolution occurs.

---

## §10 — Tissues, Organs, and the Organism

### 10.1 Tissue Architecture

A **tissue** is a group of cooperating cells connected by a signaling graph:

```typescript
interface Tissue {
  tissueId:       TissueId;
  cells:          CellId[];
  signalingGraph: DirectedGraph<CellId, ChannelSpec>;
  sharedMetabolism: MetabolicPool;
  coordinationPolicy: CoordinationPolicy;
  governanceLevel: GovernanceLevel;
}
```

Tissues are **functional units**: an "inference tissue" might contain multiple `InferenceCell`s, a `JudgmentCell`, and an `AttentionCell`, all connected by a signaling graph.

### 10.2 Organ Architecture

An **organ** is a composition of tissues serving a higher function:

| Organ | Tissues | Function |
|---|---|---|
| **Cortex** | Perception tissue, Inference tissue, Judgment tissue | Epistemic processing |
| **Limbic System** | Drive tissue, Attention tissue, Consolidation tissue | Motivation and integration |
| **Motor System** | Action tissue, Tool tissue, Risk tissue | Effect production |
| **Immune System** | Immune tissue, Governance tissue | Integrity and security |
| **Meta-System** | Meta tissue, Stem tissue | Self-observation and growth |

### 10.3 The Organism

The **organism** is the complete system:

$$\text{Organism} = \langle \text{Organs}, \text{GlobalMetabolism}, \text{Constitution}, \text{StemCellPool}, \text{GlobalLineage} \rangle$$

The organism maintains:
- A **global metabolic budget** (the sum of all tissue allocations)
- A **global lineage** (the merge of all cellular lineages, correlated by `correlationId`)
- A **stem cell pool** (the source of new cells)
- The **constitution** (the immutable identity)

---

## §11 — Genome & Governed Evolution

### 11.1 The Genome

Each cell's genome encodes its governance rules:

```typescript
interface Genome {
  genomeId:          GenomeId;
  constitutionHash:  ConstitutionHash;   // pinned, immutable
  cellTypeSpec:      CellTypeSpec;       // differentiation constraints
  divisionRules:     DivisionPolicy;     // when and how the cell may divide
  mutationAuthority: GovernanceLevel;    // what level of change is permitted
  epigenetics:       EpigeneticState;    // current gene expression (adaptive)
  immuneMarkers:     ImmuneMarker[];     // self/non-self identification
}
```

### 11.2 Epigenetics (Adaptive Gene Expression)

Epigenetics is the cell's **adaptive layer**: parameters that modulate gene expression without changing the genome itself. This corresponds to strategy adaptation, parameter tuning, and learned scheduling.

| Epigenetic Modifier | Effect |
|---|---|
| `attentionWeight` | Modulates sampling priority |
| `judgmentThreshold` | Modulates admission stringency |
| `metabolicRate` | Modulates resource consumption |
| `differentiationBias` | Modulates stem cell fate |
| `consolidationFrequency` | Modulates sleep-like integration |

Epigenetic changes are **L1–L2 adaptations**: they do not require governance approval but are logged in the lineage.

### 11.3 Governed Mutation (Self-Modification)

Genome mutations are **L3–L4 adaptations** and require governance:

| Mutation Type | Authority Required | Governance Path |
|---|---|---|
| Epigenetic parameter | None (logged) | Lineage event |
| Strategy selection | Cell-local | MetaCell proposal |
| Organelle addition/removal | Tissue governance | Proposal → shadow → approve |
| Membrane topology change | Organ governance | Proposal → shadow → CI → approve |
| Genome structural change | External governance | Proposal → shadow → CI → external approve |
| Constitution change | **Forbidden** | No authority exists |

**Invariant (H4)**: No cell may approve its own genome mutation. Mutations are proposed by the cell, validated in shadow execution, and approved by an external governance authority.

### 11.4 The Governance Ladder

| Rung | Authority | Scope |
|---|---|---|
| 0 | Observe only | Read lineage, no mutation |
| 1 | Propose only | Emit proposals, no commit |
| 2 | Sandbox execute | Execute in isolated environment |
| 3 | Low-risk auto-commit | Auto-commit with rollback capability |
| 4 | Human-approved production | External approval required |

---

## §12 — Provenance: The Lineage

### 12.1 Event-Sourced Lineage

**Invariant (H3)**: Every meaningful operation emits a typed event into the cell's lineage. The lineage is append-only, deterministic, and independently verifiable.

```typescript
interface LineageEvent {
  eventId:        EventId;
  cellId:         CellId;
  correlationId:  CorrelationId;
  parentEventId?: EventId;
  type:           LineageEventType;
  timestamp:      LogicalClock;
  payload:        TypedPayload;
  metabolicCost:  CostVector;
  trustContext:   TrustProfile;
}
```

Event types include: `stimulus.received`, `signal.transmitted`, `membrane.crossed`, `organelle.executed`, `candidate.proposed`, `judgment.rendered`, `commit.applied`, `budget.charged`, `budget.exhausted`, `gate.admitted`, `gate.rejected`, `fault.detected`, `cell.divided`, `cell.died`, `genome.mutated`, `epigenetic.adjusted`.

### 12.2 Replay

The lineage supports deterministic replay:

$$\text{replay}(\text{lineage}) \cong \text{original cytoplasmic state}$$

Replay is verified by state-hash comparison. The verifier is **code-independent** of the cell's organelles: it imports no engine code, no substrate algebra, no neural weights.

### 12.3 Causal Observability

The global lineage (merged across all cells) supports causal queries:

- "Which stimulus caused this belief?"
- "Which cell committed this goal?"
- "Which organelle produced this derivation?"
- "Which judgment admitted this proposal?"
- "Which metabolic exhaustion caused this degradation?"
- "Which genome mutation changed this cell's behavior?"

---

## §13 — The Control Plane: Declarative Cell Coordination

### 13.1 No Central Pipeline

CYTOS has **no fixed stage sequence**. Control is emergent from:

1. **Signaling graph topology** (which cells are connected)
2. **Metabolic pressure** (which cells have resources)
3. **Morphogen gradients** (which cell types are needed)
4. **Epigenetic state** (how cells are currently tuned)

### 13.2 The Meta-Controller

The `MetaCell` is a specialized cell that reasons about control. It:

- Observes tissue-level signals (queue depths, error rates, metabolic pressure)
- Proposes morphogen adjustments (bias stem cell differentiation)
- Proposes epigenetic modifications (tune cell parameters)
- Proposes signaling graph reconfigurations (rewire tissues)
- Proposes cell divisions or mergers

**All MetaCell outputs are proposals.** They enter the governance pipeline. The MetaCell cannot directly modify any other cell.

### 13.3 Scheduler Transparency

**Invariant (H6)**: Every scheduling decision is logged as a typed `SchedulingDecision` event in the lineage. The event carries: the decision, the alternatives considered, the metabolic context, the epigenetic state, and the correlation ID.

If the scheduler is learned, the learned model is versioned, and its decisions are explainable through the lineage. There is no opaque scheduling.

---

## §14 — Feasibility Constraints

The design space is not a free product. The following constraints define the valid region:

| # | Constraint | Rationale |
|---|---|---|
| $\Phi_1$ | Epistemic firewall ⇒ belief and goal compartments are type-disjoint | Reward hacking, sycophancy |
| $\Phi_2$ | Untrusted proposer ⇒ judgment before commit | Evidence laundering |
| $\Phi_3$ | Self-modification ⇒ external governance | Self-approval is unsound (Löbian) |
| $\Phi_4$ | Event-sourced lineage ⇒ deterministic replay | Audit integrity |
| $\Phi_5$ | Exact substrate + uncertain substrate ⇒ memory isolation | Equality contamination |
| $\Phi_6$ | Bounded cognition ⇒ forgetting + backpressure | Memory exhaustion |
| $\Phi_7$ | Cell division ⇒ lineage fork + metabolic split | Provenance continuity |
| $\Phi_8$ | Apoptosis ⇒ lineage archival | Provenance completeness |
| $\Phi_9$ | Verifier ⇒ code-independent of engine | Co-adaptation bug hiding |
| $\Phi_{10}$ | Anytime execution ⇒ preemptive scheduler + partial results | Lost work on interrupt |
| $\Phi_{11}$ | Paraconsistency ⇒ graded truth carrier | Explosion under monotonic logic |
| $\Phi_{12}$ | Adaptive scheduling ⇒ control-plane event sourcing | Scheduler opacity |

---

## §15 — Implementation: The Minimal Viable Cell

### 15.1 Phase 0: The Kernel Cell

The smallest implementable unit:

```
KernelCell = {
  membrane:   { ingress: fail-closed, commit: single-channel, egress: fail-open }
  cytoplasm:  { beliefs: Bag<(f,c)>, goals: Bag<(d,c)> }
  organelle:  { NAL: 44 rules, loaded data }
  metabolism: { 4 dimensions, reservation protocol }
  genome:     { constitution: pinned, mutation: none }
  lineage:    { append-only event log }
}
```

This is a single cell that can perceive, infer, judge, commit, and log. It is the **seed** from which the organism grows.

### 15.2 Phase 1: Cell Division & Tissues

- Implement mitosis (genome copy, cytoplasm split, lineage fork)
- Implement the signaling graph
- Form the first tissue: `{InferenceCell, JudgmentCell, AttentionCell}`
- Implement morphogen-based differentiation

### 15.3 Phase 2: Organelle Diversity

- Add exact organelle (MeTTa) with substrate isolation
- Add neural proposer organelle with judgment pipeline
- Add tool interface organelle with risk classification
- Implement the organelle registry as data

### 15.4 Phase 3: Autopoiesis

- Implement stem cell pool
- Implement MetaCell (self-observation, morphogen control)
- Implement governed genome mutation
- Implement apoptosis and cell replacement

### 15.5 Phase 4: Organism

- Compose organs from tissues
- Implement global metabolism and global lineage
- Implement the constitution as an immutable invariant set
- Implement multi-organism communication (peer signaling)

---

## §16 — Algebraic Summary

The complete architecture in one expression:

$$\boxed{
\text{CYTOS} = \underbrace{\text{Cell}^*}_{\text{cellular}} \;\underset{\text{Signal}}{\otimes}\; \underbrace{\text{Membrane}}_{\text{gated}} \;\underset{\text{Metabolism}}{\otimes}\; \underbrace{\text{Genome}}_{\text{governed}} \;\underset{\text{Lineage}}{\otimes}\; \underbrace{\text{Autopoiesis}}_{\text{self-producing}}
}$$

Subject to:

$$\Phi = \bigwedge_{i=1}^{12} \Phi_i \quad \text{(feasibility constraints)}$$

$$\mathcal{K} = \bigwedge_{j=1}^{9} H_j \quad \text{(constitutional invariants)}$$

And the design principle:

> **Every cognitive operation is a cell. Every cell is bounded, gated, budgeted, event-sourced, and governable. The system grows by adding cells, evolves by mutating genomes, and sustains itself by producing and replacing its own cells. The constitution is the fixed point. Everything else is adaptation.**

---

## §17 — The Design Thesis

CYTOS replaces the pipeline with the **cell**, the loop with the **signaling graph**, the stage with the **organelle**, the global budget with the **metabolism**, the hardcoded sequence with the **morphogen gradient**, and the monolithic controller with the **autopoietic loop**.

The result is an architecture that is:

- **Cellular**: every cognitive unit is bounded, typed, and self-contained
- **Evolving**: governed genome mutation produces structural change
- **Growing**: cell division and differentiation produce new capacity
- **Autopoietic**: the system produces, maintains, and replaces its own cells
- **Auditable**: every operation is event-sourced, correlated, and independently verifiable
- **Bounded**: every cell, every organelle, every signal is metabolically constrained
- **Governed**: every mutation is proposed, validated, and approved by external authority
- **Epistemically safe**: the belief/goal firewall is a membrane-level type law, not a convention

The architecture does not freeze the scheduler to guarantee the epistemology. It **distributes the scheduler into the cells** and **guarantees the epistemology through the membrane**. Control is emergent; safety is constitutional.
