# Θ — Thermodynamic Cognitive Architecture
## A Free-Energy Reasoner: Complete Specification v1.0

---

## §0 · Design Selection Statement

**Selected Prime Objectives:**
O1 (Epistemic Integrity) · O2 (Causal Provenance) · O3 (Control-Plane Fluidity) · O4 (Resource Economics) · O6 (Governed Reflexivity) · O8 (Unified Commit Ledger)

**Selected Hard Constraints (all adopted):**
H1 · H2 · H3 · H4 · H5 · H6 · H7 · H9 · H10

**Selected Anti-Goals:**
A2 (No scheduler opacity) · A4 (No audit bloat) · A5 (No monolithic LM authority)

**Architectural Character Bias:**
D3 (Maximum Elegance/Unification) primary · D4 (Maximum Robustness) secondary · D6 (Maximum Adaptivity) tertiary

**Governing Metaphor:**
All cognition is thermodynamic work performed against an energy landscape under finite free-energy budgets. The architecture minimizes expected free energy subject to hard resource, epistemic, and governance constraints.

---

## §1 · Foundational Thesis

### 1.1 The Free-Energy Postulate

A reasoner is a bounded, self-organizing system that persists by minimizing a variational free-energy functional:

$$\mathcal{F}[\mathbf{X}] = \underbrace{\mathbb{E}_{q}[-\ln p(\mathbf{X}, o)]}_{\text{surprise bound}} + \underbrace{D_{\mathrm{KL}}[q \| p]}_{\text{complexity cost}}$$

where $\mathbf{X}$ is the epistemic state, $o$ is the observation, $q$ is the system's variational (belief) distribution, and $p$ is the generative model. The system reduces $\mathcal{F}$ through two channels:

| Channel | Mechanism | Thermodynamic Analog |
|---|---|---|
| **Perceptual inference** | Update beliefs to better predict observations | Heat exchange (equilibration) |
| **Active inference** | Select actions/queries that reduce expected future surprise | Mechanical work |

### 1.2 Cognitive Temperature

A global scalar $T \in (0, T_{\max}]$ modulates the exploration–exploitation tradeoff:

$$P(\text{pursue } \delta_i) \propto \exp\!\left(-\frac{\Delta \mathcal{F}_i}{T}\right)$$

| Regime | $T$ | Behavior |
|---|---|---|
| Exploration | High | Broad, stochastic sampling; high proposal diversity |
| Exploitation | Low | Greedy, deep derivation; commitment to best path |
| Critical | $T^*$ | Phase-transition regime; maximal information sensitivity |

$T$ is modulated by homeostatic drives (§7.3) and governance state. It is **never** directly writable by reward signals (H1).

### 1.3 The Three Laws of Cognitive Thermodynamics

| Law | Statement | Architectural Consequence |
|---|---|---|
| **Zeroth** | All subsystems in equilibrium share a common temperature $T$ | One global thermal context per cognitive cycle; no isolated thermal islands |
| **First** | $\Delta U = Q - W$ (energy conservation) | Every unit of cognitive work draws from a bounded energy budget; judgment dissipates heat; nothing is free |
| **Second** | $\Delta S_{\text{total}} \geq 0$ | Irreversible operations (commits, forgetting, actions) produce entropy; governance bounds entropy production rate |

### 1.4 Architectural Unification Thesis

There is exactly **one** class of cognitive operation, **one** commit surface, **one** resource model, **one** governance vocabulary, and **one** observability fabric. All apparent diversity (perception, inference, learning, action, self-modification) is specialization within a single typed transaction framework operating on a single energy landscape.

---

## §2 · Formal Architecture

### 2.1 The Reasoner Tuple

$$\Theta = \langle \mathcal{L},\; \mathcal{E},\; \mathcal{G},\; \Pi,\; \mathcal{T},\; \mathcal{C},\; \mathcal{V},\; \mathcal{A},\; \Omega \rangle$$

| Symbol | Name | Role |
|---|---|---|
| $\mathcal{L}$ | Landscape | The energy landscape: epistemic state, beliefs, goals, tasks, their activation energies |
| $\mathcal{E}$ | Engine | The transition operator: rules, substrates, inference mechanisms |
| $\mathcal{G}$ | Governance | Admission, trust, risk, reversibility, authority |
| $\Pi$ | Policy | The meta-controller: selects cognitive programs, allocates energy |
| $\mathcal{T}$ | Thermodynamics | Resource model: energy budgets, temperature, entropy accounting |
| $\mathcal{C}$ | Commit Ledger | The single, typed, event-sourced state mutation surface |
| $\mathcal{V}$ | Verification | Proof, judgment, calibration, replay, independent checking |
| $\mathcal{A}$ | Adaptation | Learning, self-modification, schema induction, governed evolution |
| $\Omega$ | Observability | Causal correlation, provenance graph, replay, audit |

### 2.2 The Cognitive Transaction

Every unit of cognition is a **Cognitive Transaction** — the universal typed operation:

```typescript
interface CognitiveTransaction {
  // Identity & Causality
  id: TransactionId;
  correlationId: CorrelationId;        // threads stimulus → outcome
  parentId?: TransactionId;            // causal DAG
  cycleId: CycleId;
  timestamp: MonotonicClock;

  // Typing
  kind: TransactionKind;
  epistemicAxis: 'epistemic' | 'teleological' | 'procedural' | 'meta';
  substrate: SubstrateType;

  // Content
  inputs: CognitiveObject[];
  outputs: Candidate[];
  effects: EffectDeclaration[];

  // Thermodynamics
  energyCost: EnergyReservation;       // pre-declared work requirement
  entropyProduction: EntropyEstimate;  // irreversibility footprint
  temperature: ThermalContext;         // T at time of execution

  // Governance
  trust: TrustProfile;
  risk: RiskProfile;
  reversibility: ReversibilityClass;
  blastRadius: ImpactScope;
  capabilities: CapabilityToken[];

  // Lifecycle
  proofObligations: ProofObligation[];
  fallback: DegradationPolicy;
  timeout: Duration;
  status: TransactionStatus;
}

type TransactionKind =
  | 'perception' | 'attention' | 'inference' | 'proposal'
  | 'judgment' | 'commit' | 'action' | 'learning'
  | 'forgetting' | 'consolidation' | 'simulation'
  | 'meta-control' | 'self-modification' | 'query'
  | 'clarification' | 'negotiation';

type SubstrateType =
  | 'symbolic-nal' | 'exact-metta' | 'probabilistic'
  | 'neural-manifold' | 'reflex' | 'peer' | 'human';

type ReversibilityClass =
  | 'pure'              // no state change; fully reversible
  | 'reversible-local'  // can undo within system
  | 'reversible-external' // can undo with external action
  | 'hard-to-reverse'   // costly to undo
  | 'irreversible'      // cannot undo
  | 'forbidden';        // never authorized
```

### 2.3 Invariants (Hard Constraints as Type-Level Laws)

| ID | Law | Formal Statement | Enforcement |
|---|---|---|---|
| H1 | Reward ∤ Truth | $\forall r \in \text{Reward},\; t \in \text{Truth}: \text{mutate}(r, t.f) = \text{Error}$ | Type system + runtime gate |
| H2 | Judgment before commitment | $\forall p \in \text{Untrusted}: \text{commit}(p) \Rightarrow \text{judged}(p)$ | Commit ledger precondition |
| H3 | Every mutation logged | $\forall \Delta S: \exists e \in \text{EventLog}: \text{records}(e, \Delta S)$ | Ledger structure |
| H4 | No self-approval | $\forall m \in \text{SelfMod}: \text{approve}(m) \Rightarrow \text{external}(m)$ | Governance pipeline |
| H5 | Bounded paths | $\forall \text{path } p: \text{cost}(p) \leq \text{budget}(p)$ | Energy reservation |
| H6 | Scheduler transparency | $\forall \text{decision } d: \exists \text{trace}(d)$ | Observability fabric |
| H7 | Verifier independence | $\text{imports}(\text{Verifier}) \cap \text{imports}(\text{Engine}) = \emptyset$ | Build constraint |
| H9 | No silent failure | $\forall f \in \text{Fault}: \text{emit}(\text{FaultEvent}(f))$ | Transaction lifecycle |
| H10 | Risk before irreversible | $\text{irreversible}(a) \Rightarrow \text{classified}(a) \wedge \text{authorized}(a)$ | Action pipeline |

---

## §3 · The Energy Landscape $\mathcal{L}$

### 3.1 State Representation

The epistemic state $\mathbf{X}$ is a typed hypergraph with thermodynamic annotations:

$$\mathbf{X} = \langle \mathcal{N},\; \mathcal{E},\; \phi,\; \psi,\; \mu \rangle$$

where:
- $\mathcal{N}$: nodes (beliefs, goals, questions, tasks, concepts, plans)
- $\mathcal{E}$: edges (derivational links, temporal sequences, causal chains)
- $\phi: \mathcal{N} \to [0,1]^2$: epistemic valuation $(f, c)$ for beliefs; $(d, c)$ for goals
- $\psi: \mathcal{N} \to \mathbb{R}^+$: activation energy (priority, urgency, relevance)
- $\mu: \mathcal{N} \to \text{Metadata}$: provenance, source, trust, decay state

### 3.2 Activation Energy Function

Each node $n_i$ carries an activation energy:

$$\psi(n_i) = \underbrace{w_1 \cdot \text{surprise}(n_i)}_{\text{prediction error}} + \underbrace{w_2 \cdot \text{utility}(n_i)}_{\text{goal relevance}} + \underbrace{w_3 \cdot \text{drive}(n_i)}_{\text{homeostatic pressure}} - \underbrace{w_4 \cdot \text{age}(n_i)}_{\text{temporal decay}}$$

The weights $(w_1, w_2, w_3, w_4)$ are themselves governed parameters subject to adaptation (§8).

### 3.3 Epistemic Valuation

Beliefs carry $(f, c) \in [0,1]^2$:
- $f$ (frequency): proportion of positive evidence
- $c$ (confidence): amount of evidence (sub-additive under revision)

Goals carry $(d, c) \in [0,1]^2$:
- $d$ (desire): strength of preference
- $c$ (confidence): certainty of achievability

**Firewall (H1):** The mutation authority for $f$ is evidence alone. The mutation authority for $d$ is reward + evidence. No signal typed as reward, desire, or utility may alter $f$.

### 3.4 Paraconsistent Coexistence

Contradictions $(P)$ and $(\neg P)$ coexist as distinct nodes with distinct truth values. The system does not explode (H4 in the feasibility space). Resolution is a **process** (consolidation transactions), not an instantaneous constraint.

### 3.5 Substrate Isolation

| Substrate | Representation | Boundary Rule |
|---|---|---|
| Symbolic (NAL) | Typed term algebra $(f,c)$ | Native state |
| Exact (MeTTa/e-graph) | Dependent types, equality saturation | Gated oracle; never shares memory with uncertain substrate; never unions on similarity (H8) |
| Neural (Manifold) | Continuous embeddings, calibrated scores | Proposes only; scored by judge before admission |
| Probabilistic | Distributional beliefs | Proposes; calibrated against symbolic core |

**Arbiter Invariant:** Substrates communicate only through typed proposals submitted to the commit ledger. No substrate directly mutates another's state.

---

## §4 · The Engine $\mathcal{E}$

### 4.1 Transition Operator

The engine applies state transformations:

$$\mathbf{X}_{t+1} = \mathcal{T}_\theta(\mathbf{X}_t, \mathbf{u}_t)$$

where $\mathbf{u}_t$ is the continuous control vector from the meta-controller (§6) and $\theta$ parameterizes the rule/operator set.

### 4.2 Operator Library

Operators are typed, costed, data-loaded transformations:

```typescript
interface Operator {
  id: OperatorId;
  kind: OperatorKind;
  substrate: SubstrateType;
  inputs: TypeSignature[];
  outputs: TypeSignature[];
  energyCost: CostVector;          // multi-dimensional
  entropyProduction: EntropyClass;
  reversibility: ReversibilityClass;
  preconditions: Predicate[];
  postconditions: Predicate[];
  provenance: 'builtin' | 'data-loaded' | 'learned';
}

type CostVector = {
  cycles: number;
  derivations: number;
  memoryOps: number;
  lmCalls: number;
  tokens: number;
  latencyMs: number;
  riskUnits: number;
};
```

### 4.3 Dispatch

Operators are dispatched via a **conditional cognitive DAG** (not a fixed sequence):

```typescript
interface StageGraph {
  nodes: StageNode[];
  edges: StageEdge[];
  invariants: GraphPredicate[];   // statically checked
}

interface StageNode {
  id: StageId;
  operator: OperatorRef;
  precondition: (ctx: ThermalContext) => boolean;
  postcondition: (ctx: ThermalContext) => boolean;
  energyBudget: BudgetScopeId;
  onFailure: 'skip' | 'abort' | 'degrade' | 'retry';
  parallelizable: boolean;
}

interface StageEdge {
  from: StageId;
  to: StageId;
  guard: (ctx: ThermalContext) => boolean;
  energyCost?: BudgetScopeId;
}
```

The stage graph is **data**: loaded, versioned, revertable, and subject to governance. Different cognitive programs (§6) install different graphs.

### 4.4 Inference Substrates

| Substrate | Mechanism | Truth Algebra | Role |
|---|---|---|---|
| NAL | Uncertain syllogistic (deduction, induction, abduction, analogy, comparison, revision) | $(f, c)$ with independence-checked evidence combination | Core symbolic reasoning |
| MeTTa | Exact rewriting, equality saturation | Boolean (provability) | Exact computation, formal verification |
| Manifold | Calibrated neural heads | Continuous $[0,1]$ scores | Pattern recognition, judgment, calibration |
| Probabilistic | Bayesian updating, sampling | $p \in [0,1]$ or distributions | Uncertainty quantification, planning |
| Reflex | Tabular/policy RL | Scalar value | Fast reactive responses |

---

## §5 · The Commit Ledger $\mathcal{C}$

### 5.1 Single Commit Authority

All durable state mutation passes through exactly **one** typed commit surface:

```
Candidate
  → Normalize (canonical form)
  → Type-Check (epistemic axis, substrate compatibility)
  → Evidence-Independence Check (no laundering)
  → Proof / Judge / Simulation (verification portfolio)
  → Rank (utility-per-energy scoring)
  → Energy Settlement (budget deduction)
  → Risk Classification (reversibility, blast radius)
  → Commit or Reject
```

### 5.2 The Ledger Structure

```typescript
interface CommitLedger {
  append(entry: LedgerEntry): LedgerResult;
  fold(from: SequenceId, to: SequenceId): EpistemicState;
  verify(entryId: EntryId): ProofResult;
  replay(from: SequenceId): ReconstructedState;
}

interface LedgerEntry {
  sequenceId: MonotonicSequence;
  transactionId: TransactionId;
  correlationId: CorrelationId;
  timestamp: MonotonicClock;
  kind: TransactionKind;
  epistemicAxis: 'epistemic' | 'teleological' | 'procedural' | 'meta';
  payload: CognitiveObject[];
  evidence: EvidenceRecord;
  verdict: Verdict;
  energySettled: CostVector;
  entropyProduced: number;
  parentIds: TransactionId[];
  signature: IntegrityHash;
}

type Verdict =
  | { status: 'committed'; confidence: number; judge: JudgeId }
  | { status: 'rejected'; reason: RejectionReason }
  | { status: 'provisional'; decay: Duration; reviewAt: Timestamp }
  | { status: 'deferred'; condition: Predicate; timeout: Duration };
```

### 5.3 Event-Sourced State

The ledger **is** the state. Snapshots are caches:

$$\mathbf{X}_t = \text{fold}(\text{Ledger}[0..t])$$

Replay reconstructs any historical state. Verification re-derives conclusions from the event log independently of the engine.

### 5.4 Admission Modes

| Mode | Condition | Path |
|---|---|---|
| Auto-commit | High trust ∧ Low risk ∧ High reversibility ∧ Proof OK | Immediate commit |
| Shadow-commit | High trust ∧ Medium risk ∧ High reversibility | Commit to shadow; promote after verification |
| Provisional | Medium trust ∧ Low risk | Commit with decay; expires unless reinforced |
| Review | Medium trust ∧ Medium risk | Held for judgment cycle or human review |
| Reject | Low trust ∨ High risk ∧ Low reversibility | Refused; event logged |
| Escalate | Irreversible ∨ Governance-required | External approval required |

---

## §6 · The Meta-Controller $\Pi$

### 6.1 Cognitive Programs

The meta-controller selects or blends **cognitive programs** — parameterized control configurations:

```typescript
interface CognitiveProgram {
  id: ProgramId;
  name: string;
  stageGraph: StageGraph;
  energyAllocation: EnergyAllocation;
  temperature: ThermalSetting;
  proposerPortfolio: ProposerWeights;
  verificationPolicy: VerificationPolicy;
  autonomyPolicy: AutonomyPolicy;
  learningPolicy: LearningPolicy;
  degradationPolicy: DegradationPolicy;
}
```

### 6.2 Program Portfolio

| Program | Character | Temperature | Scheduler |
|---|---|---|---|
| **Deliberative** | Deep inference, high proof burden | Low | Priority queue, best-first |
| **Reactive** | Fast reflexes, low latency | Low | Priority preemption |
| **Curious** | High exploration, question generation | High | Novelty-weighted |
| **Conservative** | High rejection threshold, low risk | Low | Risk-adjusted |
| **Creative** | High proposal diversity, sandboxed | High | Diverse sampling |
| **Consolidating** | Memory decay, schema induction, integration | Low | Pressure-driven |
| **Repair** | Contradiction resolution, invariant restoration | Low | Urgency-first |
| **Social** | Clarification-seeking, human-in-loop | Medium | Dialogue-driven |

### 6.3 Meta-Controller as Reasoner

The meta-controller is itself a bounded reasoner operating on control-level beliefs and goals:

```
Control Beliefs:
  (current_throughput --> adequate) (f=0.7, c=0.8)
  (contradiction_rate --> rising) (f=0.9, c=0.6)
  (budget_pressure --> high) (f=0.85, c=0.9)

Control Goals:
  (reduce_contradiction_rate) (d=0.9, c=0.7)
  (maintain_throughput) (d=0.8, c=0.6)

Control Inference:
  IF contradiction_rate rising AND budget_pressure high
  THEN propose(program_switch → Repair + Conservative)
  AND propose(temperature_decrease)
  AND propose(energy_reallocation → consolidation)
```

The meta-controller **proposes** control changes. It does not directly apply them. All control mutations pass through the governance pipeline (§9) as `SelfImprovementProposal` transactions.

### 6.4 Scheduling as Energy Minimization

The scheduler selects the next transaction to execute by minimizing expected free energy per unit energy cost:

$$\text{score}(\tau_i) = \frac{\hat{\Delta}\mathcal{F}_{\text{epistemic}} + \hat{\Delta}\mathcal{F}_{\text{teleological}} + \hat{\Delta}\mathcal{F}_{\text{homeostatic}}}{\lambda_c \cdot \hat{C}_i + \lambda_r \cdot \hat{R}_i + \lambda_h \cdot \hat{H}_{\text{human}}}$$

where:
- $\hat{\Delta}\mathcal{F}$: expected free-energy reduction (epistemic gain, goal progress, drive satisfaction)
- $\hat{C}_i$: expected energy cost
- $\hat{R}_i$: expected risk
- $\hat{H}_{\text{human}}$: expected human attention cost
- $(\lambda_c, \lambda_r, \lambda_h)$: governance-tuned weighting parameters

The scheduler's decisions are **always logged** (H6) with full justification.

---

## §7 · Thermodynamic Resource Model $\mathcal{T}$

### 7.1 Energy Budget Algebra

Resources are modeled as a **thermodynamic system** with conserved total energy:

$$E_{\text{total}} = E_{\text{allocated}} + E_{\text{reserved}} + E_{\text{free}}$$

```typescript
interface EnergyBudget {
  dimensions: EnergyDimension[];
  totalCapacity: CostVector;
  allocated: Map<BudgetScopeId, Allocation>;
  temperature: number;
  entropyBudget: number;        // max irreversible operations per cycle
  pressure: number;             // current memory/compute pressure
}

type EnergyDimension =
  | 'cycles' | 'derivations' | 'memoryOps' | 'lmCalls'
  | 'tokens' | 'latencyMs' | 'riskUnits' | 'humanAttention'
  | 'entropy';
```

### 7.2 Reservation Protocol

Before executing any transaction:

1. **Reserve**: $E_{\text{free}} \leftarrow E_{\text{free}} - E_{\text{reserved}}(\tau)$
2. **Execute**: perform work, measure actual cost
3. **Settle**: $E_{\text{settled}} = E_{\text{reserved}} - E_{\text{unused}}$; refund unused
4. **Account**: if actual > reserved, emit `OverrunEvent`; if systemic, trigger backpressure

### 7.3 Cognitive Temperature Dynamics

Temperature evolves according to homeostatic drives:

$$T_{t+1} = T_t + \alpha \cdot \underbrace{(T_{\text{setpoint}} - T_t)}_{\text{homeostatic pull}} + \beta \cdot \underbrace{\Delta\mathcal{F}_{\text{curiosity}}}_{\text{novelty drive}} - \gamma \cdot \underbrace{\text{risk}(t)}_{\text{safety cooling}}$$

| Drive | Effect on $T$ | Mechanism |
|---|---|---|
| Curiosity (high) | $T \uparrow$ | Broaden sampling; increase proposal diversity |
| Competence (low) | $T \uparrow$ | Explore to find solutions |
| Coherence (low) | $T \downarrow$ | Focus on contradiction resolution |
| Safety (threat) | $T \downarrow$ | Conservative mode; reduce exploration |

### 7.4 Entropy Accounting

Irreversible operations produce entropy:

| Operation Class | Entropy Production |
|---|---|
| Perception (admit) | Low (reversible via provenance) |
| Inference (derive) | Low (derivation is re-checkable) |
| Commit (belief) | Medium (alters landscape; reversible via revision) |
| Action (external) | High (may be irreversible) |
| Forgetting | High (information destroyed) |
| Self-modification | Very High (alters the system itself) |

The system maintains an **entropy budget** per cycle. When entropy production approaches the budget, the system:
1. Reduces temperature (conservative mode)
2. Prioritizes consolidation (reduce accumulated disorder)
3. Seeks external validation (human approval for high-entropy operations)

### 7.5 Backpressure and Degradation

When $E_{\text{free}} < E_{\text{threshold}}$:

| Pressure Level | Response |
|---|---|
| Low | Normal operation |
| Medium | Reduce proposal diversity; skip optional stages |
| High | Degrade to symbolic-only (no LM calls); reduce parallelism |
| Critical | Consolidate; reject non-essential inputs; emit `StarvationEvent` |
| Terminal | Graceful halt; preserve state; emit `ShutdownEvent` |

All degradation transitions are **typed events** in the ledger (H9). No silent failure.

---

## §8 · Adaptation & Learning $\mathcal{A}$

### 8.1 Learning as Governed Proposals

All learning produces **proposals**, never direct mutations:

```typescript
interface LearningProposal {
  id: ProposalId;
  correlationId: CorrelationId;
  domain: LearningDomain;
  content: ProposedChange;
  evidence: EvidenceRecord;       // what triggered this
  expectedEffect: PredictedOutcome;
  riskAssessment: RiskProfile;
  reversibilityPlan: RollbackPlan;
  governancePath: GovernanceRoute;
}

type LearningDomain =
  | 'attention-weights'      // focus allocation
  | 'strategy-selection'     // inference behavior
  | 'parameter-tuning'       // budgets, thresholds
  | 'rule-induction'         // symbolic rules
  | 'schema-induction'       // structural patterns
  | 'code-patch'             // source modification
  | 'governance-change'      // gates, policies
  | 'reward-function';       // utility weights
```

### 8.2 Governance Routing by Domain

| Domain | Direct? | Governance Path |
|---|---|---|
| Attention weights | Sometimes auto | Low risk; logged |
| Strategy selection | Proposal or auto | Medium risk; shadow test |
| Parameter tuning | Proposal | Medium risk; shadow test |
| Rule induction | Proposal | Proof + shadow validation |
| Schema induction | Proposal | Shadow + review |
| Code patch | Proposal | CI + external approval |
| Governance change | **Never self-applied** | External governance only |
| Reward function | **Never direct** | Human/external approval |

### 8.3 Self-Modification Ladder

```
Observation
  → Lesson (distilled correction)
    → Hypothesis (provisional explanation)
      → Strategy Proposal (behavioral change)
        → Shadow Test (parallel execution)
          → Bounded Deployment (limited scope)
            → Trace Evaluation (outcome measurement)
              → Retention or Rollback
```

**Invariant (H4):** No self-modification is self-approved. The approving authority is always external to the modifying subsystem.

### 8.4 Thermal Annealing for Learning

Learning rate and exploration are governed by temperature:

$$\theta_{t+1} = \theta_t - \eta(T_t) \cdot \nabla_{\theta} \mathcal{L}_{\text{meta}}$$

where $\eta(T)$ is a temperature-dependent learning rate:
- High $T$: large $\eta$; aggressive exploration of parameter space
- Low $T$: small $\eta$; fine-tuning near local optima

The system can "anneal" — start hot (explore), cool down (commit to good solutions), reheat if stuck.

---

## §9 · Governance $\mathcal{G}$

### 9.1 Trust, Risk, and Reversibility Manifold

Every candidate receives a unified governance profile:

```typescript
interface GovernanceProfile {
  trust: number;              // calibrated source/proposal trust [0,1]
  confidence: number;         // epistemic confidence [0,1]
  risk: number;               // expected harm/irreversibility [0,1]
  reversibility: number;      // ease of rollback [0,1]
  blastRadius: number;        // scope of impact [0,1]
  entropyCost: number;        // thermodynamic irreversibility
  proofStatus: ProofStatus;
  judgeStatus: JudgeStatus;
  simulationStatus: SimulationStatus;
}
```

### 9.2 Authorization Surface

The commit path is determined by a **policy surface**:

$$\text{path} = f(\text{trust},\; \text{risk},\; \text{reversibility},\; \text{proof},\; \text{autonomy\_mode})$$

| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| High | Low | High | Auto-commit |
| High | Medium | High | Shadow-commit → promote |
| Medium | Low | High | Provisional commit with decay |
| Medium | Medium | Medium | Judgment cycle or human review |
| Low | High | Low | Reject |
| Any | High | Low | Strong proof + human approval |
| Any | Any | Forbidden | Reject unconditionally |

### 9.3 Autonomy Ladder

| Rung | Authority | Scope |
|---|---|---|
| 0: Observe | Read-only; no mutations | All |
| 1: Propose | Generate proposals; no execution | All |
| 2: Sandbox | Execute in isolated environment | Bounded |
| 3: Low-risk auto | Auto-commit low-risk, reversible changes | Scoped |
| 4: Human-approved production | Irreversible actions require explicit approval | Unbounded |

The system operates at a **declared rung**. Transitions between rungs require governance authorization.

### 9.4 Epistemic Firewall Enforcement

The firewall is enforced at multiple levels:

1. **Type level:** `BeliefTruth` and `DesireValue` are distinct types; no implicit conversion
2. **Mutation authority:** Only evidence-type signals may write to `Truth.frequency`
3. **Runtime gate:** `RewardGate` structurally refuses reward → truth mutations
4. **Ledger invariant:** Every commit records its epistemic axis; cross-axis mutations are type errors
5. **Verifier check:** Independent verifier confirms no reward-laundering in derivation chains

---

## §10 · Observability $\Omega$

### 10.1 Causal Correlation Fabric

Every cognitive object carries full causal provenance:

```typescript
interface Provenance {
  correlationId: CorrelationId;     // stimulus → outcome thread
  stimulusId: StimulusId;
  sessionId: SessionId;
  cycleId: CycleId;
  transactionId: TransactionId;
  proposerId: ProposerId;
  judgeId?: JudgeId;
  proofId?: ProofId;
  parentIds: ProvenanceId[];
  energySpent: CostVector;
  temperatureAtExecution: number;
  programActive: ProgramId;
}
```

### 10.2 Queryable Causal Graph

The provenance structure supports:

| Query | Answer |
|---|---|
| "Which stimulus caused this belief?" | Trace correlationId backward |
| "Which derivation led to this action?" | Follow parent chain |
| "Which judge accepted this candidate?" | Transaction verdict |
| "Which budget exhaustion caused degradation?" | Energy settlement events |
| "Which learning episode changed this strategy?" | Adaptation proposals |
| "What was the temperature when this was committed?" | Thermal context in entry |
| "What program was active?" | Program ID in entry |

### 10.3 Replay and Verification

```typescript
interface VerificationPortfolio {
  replayState(from: SequenceId): ReconstructedState;
  verifyDerivation(record: DerivationRecord): ProofResult;
  verifyReplay(reconstructed: State, expected: StateHash): boolean;
  checkInvariants(state: State, invariants: InvariantSpec[]): ViolationReport;
}
```

The verifier is **code-independent** of the engine (H7). It carries a transcribed copy of the truth table. Drift between engine and verifier is measured and pinned by test.

### 10.4 Observability Tiers (Anti-Bloat)

To avoid audit bloat (A4), observability operates at tiers:

| Tier | Content | Storage | Always On? |
|---|---|---|---|
| T0: Structural | Commit ledger entries, verdicts, energy settlements | Append-only log | Yes |
| T1: Derivational | Step-level derivation records, premise chains | Bounded records (capped) | Yes, bounded |
| T2: Control | Scheduler decisions, program selections, temperature changes | Event log | Yes |
| T3: Detailed | Full intermediate states, all proposals (including rejected) | Opt-in, bounded | Configurable |
| T4: Diagnostic | Cycle-level traces, per-operator timing, memory snapshots | Debug mode | Off by default |

---

## §11 · The Cognitive Cycle

### 11.1 Unified Tick

Each cognitive tick executes:

```
1. OBSERVE
   stimulus → mint CorrelationId → normalize → type-check

2. SELECT PROGRAM
   meta-controller evaluates state → selects/blends CognitiveProgram
   → installs StageGraph, EnergyAllocation, Temperature

3. RESERVE ENERGY
   budget office reserves resources for selected program
   → if insufficient: degrade or reject

4. EXECUTE GRAPH
   traverse StageGraph:
     for each node where guard(ctx) = true:
       execute operator
       emit events
       charge energy
       check postconditions
     conditional edges enable skipping, parallelism, iteration

5. VERIFY & JUDGE
   all candidates pass through verification portfolio
   → proof, calibrated judgment, simulation, shadow test

6. COMMIT
   judged candidates → commit ledger
   → single commit authority
   → risk classification
   → reversibility assessment
   → commit / reject / defer

7. SETTLE
   energy settlement (actual vs reserved)
   entropy accounting
   temperature update
   drive satisfaction

8. LEARN (if due)
   observe outcomes → generate learning proposals
   → route through governance

9. CONSOLIDATE (if due)
   decay, eviction, schema induction, memory compression

10. EMIT
    causal trace emission
    degradation events if any
    observability tier updates
```

### 11.2 Multi-Rate Temporal Tower

The architecture supports N heterochronous levels:

| Level | Rate | Content | Budget Slice |
|---|---|---|---|
| L0: Reflex | Sub-cycle, interruptible | Safety veto, fast judgment, game tick | Minimal |
| L1: Tick | Per cycle | Core inference, admission, commit | Primary |
| L2: Deliberation | Per turn/session | Multi-step planning, narration, action | Extended |
| L3: Consolidation | Every K cycles | Decay, eviction, episodic merge, retrospection | Periodic |
| L4: Identity | ≪ 1/cycle | Schema induction, capability scaffold, constitution review | Rare |

Lower levels can **interrupt** higher (reflex veto). Higher levels **configure** lower (program selection). All levels share one commit ledger and one energy budget.

---

## §12 · Feasibility Constraints

The design space is not free. These constraints carve the valid region:

| # | Constraint | Consequence of Violation |
|---|---|---|
| Φ1 | Epistemic firewall ⇒ belief/goal type separation at mutation authority level | Reward hacking, sycophancy |
| Φ2 | AIKR ⇒ bounded memory + forgetting + backpressure | Memory exhaustion, hang |
| Φ3 | Untrusted proposers ⇒ judgment gate before commit | Evidence laundering |
| Φ4 | Self-modification ⇒ external governance | Löbian self-approval |
| Φ5 | Event-sourced state ⇒ deterministic replay | Non-reproducible audit |
| Φ6 | Verifier independence ⇒ no shared engine imports | Co-adapted bugs |
| Φ7 | Paraconsistent retention ⇒ non-monotonic logic | Explosion |
| Φ8 | Exact substrate + uncertain substrate ⇒ memory isolation | Equality contamination |
| Φ9 | Anytime execution ⇒ preemptive scheduler + partial results | Lost work on interrupt |
| Φ10 | High learning depth ⇒ strong provenance | Unauditable adaptation |
| Φ11 | Entropy budget ⇒ bounded irreversible operations per cycle | Uncontrolled state drift |
| Φ12 | Temperature governance ⇒ reward ∤ T directly | Thermal manipulation by reward |

---

## §13 · Implementation Architecture

### 13.1 Module Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                    THERMODYNAMIC COGNITIVE ARCHITECTURE          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              META-CONTROLLER (Π)                          │   │
│  │  Program Selection · Temperature Control · Energy Alloc.  │   │
│  └────────────────────────────┬─────────────────────────────┘   │
│                               │ proposes                         │
│  ┌────────────────────────────▼─────────────────────────────┐   │
│  │              STAGE GRAPH ENGINE                            │   │
│  │  Conditional DAG traversal · Parallel execution · Guards   │   │
│  └────────────────────────────┬─────────────────────────────┘   │
│                               │ produces candidates              │
│  ┌────────────────────────────▼─────────────────────────────┐   │
│  │              VERIFICATION PORTFOLIO (V)                    │   │
│  │  Proof · Calibrated Judge · Simulation · Shadow Test       │   │
│  └────────────────────────────┬─────────────────────────────┘   │
│                               │ judged candidates                │
│  ┌────────────────────────────▼─────────────────────────────┐   │
│  │              COMMIT LEDGER (C)                             │   │
│  │  Single authority · Typed · Event-sourced · Governed       │   │
│  └────────────────────────────┬─────────────────────────────┘   │
│                               │                                  │
│  ┌────────────────────────────▼─────────────────────────────┐   │
│  │              ENERGY LANDSCAPE (L)                          │   │
│  │  Beliefs · Goals · Tasks · Activation energies · Decay     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐    │
│  │ THERMODYN.  │  │ GOVERNANCE  │  │ OBSERVABILITY (Ω)   │    │
│  │ Budgets     │  │ Trust/Risk  │  │ Causal graph        │    │
│  │ Temperature │  │ Autonomy    │  │ Replay              │    │
│  │ Entropy     │  │ Firewall    │  │ Independent verify  │    │
│  └─────────────┘  └─────────────┘  └─────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SUBSTRATE PORTS (typed, replaceable)          │   │
│  │  NAL · MeTTa · Manifold · Probabilistic · Reflex · Peer   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 13.2 Typed Port Interfaces

All components communicate through typed ports (D5: modularity):

```typescript
interface SubstratePort {
  propose(input: CognitiveObject[]): Candidate[];
  verify(candidate: Candidate): ProofResult;
  capabilities(): SubstrateCapabilities;
}

interface JudgePort {
  judge(candidates: Candidate[], context: ThermalContext): Judgment[];
  calibrate(samples: LabeledSample[]): CalibrationResult;
}

interface MemoryPort {
  read(query: MemoryQuery): CognitiveObject[];
  sample(budget: CostVector): CognitiveObject[];
  decay(lambda: number): void;
  evict(pressure: number): EvictionReport;
}

interface SchedulerPort {
  next(state: EpistemicState, budget: CostVector): TransactionSelection;
  justify(selection: TransactionSelection): SchedulerTrace;
}

interface GovernancePort {
  classify(candidate: Candidate): GovernanceProfile;
  authorize(profile: GovernanceProfile, autonomyMode: AutonomyRung): AuthorizationResult;
}
```

### 13.3 Configuration as Data

All architectural decisions are declarative:

```typescript
interface ArchitectureConfig {
  stageGraphs: Map<ProgramId, StageGraph>;
  energyBudget: EnergyBudget;
  thermalDynamics: ThermalParameters;
  governancePolicy: GovernancePolicy;
  substrateRegistry: SubstrateRegistration[];
  learningPolicy: LearningPolicy;
  observabilityTier: ObservabilityLevel;
  autonomyMode: AutonomyRung;
  invariants: InvariantSpec[];
}
```

The configuration is itself versioned, governed, and subject to the commit ledger.

---

## §14 · Operational Semantics

### 14.1 The Control Equation

At each tick $t$, the system evolves according to:

$$\dot{\mathbf{X}} = \mathcal{T}_{\mathbf{u}}(\mathbf{X}) - \gamma(T) \cdot \mathbf{X} + \mathcal{G}(\mathbf{I})$$

where:
- $\mathcal{T}_{\mathbf{u}}$: transition operator modulated by control vector $\mathbf{u}$ (from meta-controller)
- $\gamma(T)$: temperature-dependent decay (AIKR forgetting)
- $\mathcal{G}(\mathbf{I})$: gated influx from environment (filtered by governance)

### 14.2 Free-Energy Minimization Objective

The system maximizes constrained cognitive utility:

$$J = \mathbb{E}\left[\sum_t \gamma^t \left( \underbrace{\Delta\mathcal{F}_{\text{epistemic}}}_{\text{knowledge gain}} + \underbrace{\Delta\mathcal{F}_{\text{teleological}}}_{\text{goal progress}} + \underbrace{\Delta\mathcal{F}_{\text{homeostatic}}}_{\text{drive balance}} - \underbrace{\lambda_R \cdot R_t}_{\text{risk}} - \underbrace{\lambda_C \cdot C_t}_{\text{energy cost}} - \underbrace{\lambda_V \cdot V_t}_{\text{violations}} \right)\right]$$

Subject to:
- $C_t \leq B_t$ (energy budget)
- $G(\mathbf{X}_t, c_t, Z_t) = \text{true}$ (governance)
- $\text{Reward} \nrightarrow \text{BeliefTruth}$ (firewall)
- $\text{Untrusted}(p) \Rightarrow \text{Judged}(p)$ (admission)
- $S_t \leq S_{\max}$ (entropy budget)

### 14.3 Degradation Hierarchy

When resources or capabilities are unavailable:

| Failure | Degradation |
|---|---|
| LM unavailable | Symbolic fallback (all functions have symbolic paths) |
| Manifold unavailable | Heuristic scoring only |
| Budget exhausted | Skip optional stages; reduce parallelism |
| Memory pressure | Consolidate; evict; archive |
| Tool failure | Degrade to internal reasoning |
| Peer unavailable | Solo operation |
| Human unavailable | Defer irreversible actions; continue bounded cognition |
| Verifier mismatch | Halt affected pathway; emit FaultEvent |

All degradations are **typed events**, never silent (H9).

---

## §15 · Summary: The Architectural Identity

This architecture is defined by six unifications:

| Unification | Meaning |
|---|---|
| **One operation class** | All cognition is a typed, budgeted, governed CognitiveTransaction |
| **One commit surface** | All state mutation passes through the single commit ledger |
| **One resource model** | Thermodynamic energy budgets with temperature, entropy, and reservation |
| **One governance vocabulary** | Trust × Risk × Reversibility × Proof determines all authorization |
| **One observability fabric** | Causal correlation threads through every operation |
| **One adaptation path** | All learning is proposal → shadow → governance → bounded deployment |

And by three thermodynamic principles:

| Principle | Consequence |
|---|---|
| **Energy conservation** | No free computation; all work draws from bounded budgets |
| **Entropy production** | Irreversible operations are tracked, bounded, and governed |
| **Free-energy minimization** | The system's objective is to reduce expected surprise within thermodynamic constraints |

The result is a reasoner that is simultaneously:
- **Epistemically safe** (firewall, paraconsistent, evidence-sensitive)
- **Computationally bounded** (AIKR, anytime, energy budgets, entropy limits)
- **Fully auditable** (event-sourced, independently verifiable, causally correlated)
- **Adaptively powerful** (data-driven control, learned scheduling, governed self-modification)
- **Thermodynamically principled** (energy, temperature, entropy as first-class architectural concepts)
- **Elegantly unified** (one transaction model, one ledger, one governance surface, one resource algebra)

---

## §16 · Glossary

| Term | Definition |
|---|---|
| **Activation Energy** ($\psi$) | Priority/urgency score of a cognitive object; determines sampling probability |
| **Cognitive Temperature** ($T$) | Global exploration–exploitation parameter; modulates sampling breadth |
| **Cognitive Transaction** | The universal unit of cognitive work; typed, budgeted, governed |
| **Commit Ledger** | The single, append-only, event-sourced state mutation authority |
| **Energy Budget** | Multi-dimensional resource accounting with reservation and settlement |
| **Entropy Budget** | Bound on irreversible operations per cycle |
| **Epistemic Firewall** | Type-level separation preventing reward/desire from mutating factual truth |
| **Free Energy** ($\mathcal{F}$) | Variational bound on surprise; the system's minimization objective |
| **Governance Profile** | Trust × Risk × Reversibility × Proof tuple determining authorization |
| **Meta-Controller** | Bounded reasoner that selects cognitive programs and proposes control changes |
| **Provenance** | Causal correlation fabric threading stimulus → outcome |
| **Stage Graph** | Data-driven conditional DAG defining cognitive control flow |
| **Thermal Annealing** | Temperature modulation for learning: hot to explore, cool to commit |
| **Verification Portfolio** | Proof + calibrated judge + simulation + shadow test |

---

*End of Specification.*
