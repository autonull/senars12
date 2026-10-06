# Ω — The Cognitive Control Plane

## A Self-Contained Cybernetic Specification for Bounded, Governed, Adaptive Reasoning

---

## §0 — System Identity

**Ω** is a resource-bounded, epistemically-typed, heterochronous adaptive controller whose plant is its own knowledge state. It transforms observation streams into justified commitments under scarcity, where every mutation is a governed transaction, every resource unit is economically allocated, every decision is causally traceable, and the controller itself is subject to governed self-modification.

The system is not an inference engine with control bolted on. It is a **control system whose controlled variable is knowledge itself**.

---

## §1 — Cybernetic Formulation

### 1.1 The Closed Loop

At the highest level, Ω is a negative-feedback control system:

```
Reference r(t)          Error e(t)           Control u(t)         Plant Output y(t)
  ┌──────────┐      ┌──────────────┐     ┌──────────────┐     ┌──────────────────┐
  │ Goals    │      │ e = r − ŷ    │     │ π(e, X, β)   │     │ X′ = T(X, u)     │
  │ Drives   │─────▶│ Contradict.  │────▶│ Schedule     │────▶│ Memory state     │
  │ Ideals   │      │ Budget press │     │ Admit        │     │ Beliefs, goals   │
  │ Curiosity│      │ Quality gap  │     │ Allocate     │     │ Links, priority  │
  └──────────┘      └──────────────┘     └──────────────┘     └────────┬─────────┘
       ▲                                                                 │
       │                    ┌──────────────┐                            │
       └────────────────────│ Sensors H    │◀───────────────────────────┘
                            │ Perception   │
                            │ Budget gauge │
                            │ Self-monitor │
                            │ Drive levels  │
                            └──────────────┘
```

### 1.2 The Formal Tuple

A reasoner in this specification is an **11-tuple**:

$$\mathcal{R} = \langle X,\; O,\; U,\; \Pi,\; G,\; B,\; V,\; L,\; F,\; \Omega,\; \mu \rangle$$

| Symbol | Name | Role in Control Theory |
|--------|------|----------------------|
| $X$ | Cognitive State | The plant state vector |
| $O$ | Observations | Sensor measurements |
| $U$ | Operations | Actuator commands |
| $\Pi$ | Controller / Scheduler | The control law |
| $G$ | Governance Predicates | Constraint surfaces |
| $B$ | Budget Algebra | Actuator saturation limits |
| $V$ | Verification Portfolio | Observer / estimator |
| $L$ | Learning Operators | Adaptive law |
| $F$ | Failure Policy Map | Disturbance rejection |
| $\Omega$ | Observability Graph | State reconstruction |
| $\mu$ | Meta-Controller | Adaptive control of $\Pi$ itself |

### 1.3 The Control Step

At each discrete control instant $t$:

$$o_t = \text{observe}(X_t, \text{env}_t)$$
$$c_t = \Pi(X_t,\; o_t,\; B_t,\; G) \quad \text{[control law]}$$
$$Y_t = \text{execute}(c_t,\; X_t) \quad \text{[plant response]}$$
$$Z_t = V(Y_t,\; X_t) \quad \text{[verification]}$$
$$X_{t+1} = \begin{cases} \text{commit}(Z_t) & \text{if } G(Z_t, B_t) = \top \\ \text{degrade}(X_t, Y_t, F) & \text{otherwise} \end{cases}$$
$$\Pi_{t+1}, B_{t+1} = \mu(\Pi_t, B_t, o_t, c_t, X_t) \quad \text{[meta-adaptation]}$$

### 1.4 The Objective Functional

The system maximizes a constrained cognitive utility:

$$J = \mathbb{E}\left[\sum_t \gamma^t \left( \alpha\,\Delta K_t + \beta\,\Delta G_t + \delta\,\Delta H_t - \lambda_R\,R_t - \lambda_C\,C_t - \lambda_V\,V_t \right)\right]$$

| Term | Meaning |
|------|---------|
| $\Delta K_t$ | Epistemic gain: calibrated knowledge increase, uncertainty reduction |
| $\Delta G_t$ | Teleological gain: goal progress, plan advancement |
| $\Delta H_t$ | Homeostatic gain: drive balance, coherence, curiosity satisfaction |
| $R_t$ | Risk: irreversibility, blast radius, safety violation |
| $C_t$ | Cost: CPU, memory, latency, tokens, human attention |
| $V_t$ | Violation penalty: broken invariants, failed proofs |

**Subject to hard constraints:**

$$B_t \geq \text{cost}(c_t) \quad \text{[budget feasibility]}$$
$$G(X_t, c_t, Z_t) = \top \quad \text{[governance satisfaction]}$$
$$\text{Reward} \nrightarrow \text{BeliefTruth} \quad \text{[epistemic firewall]}$$
$$\text{UntrustedProposal} \Rightarrow \text{JudgedBeforeCommit} \quad \text{[admission law]}$$

---

## §2 — Architectural Layers

The system is organized as a **heterochronous tower** of five control levels, each an instance of the same stage-graph runner operating at different clock rates:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  L4 · CONSTITUTIONAL (≪ 1/cycle)                                           │
│  Identity review · architectural constraints · governance policy evolution  │
│  Budget: constitutional slice · Trust: external arbiter required            │
├─────────────────────────────────────────────────────────────────────────────┤
│  L3 · CONSOLIDATION (every K cycles)                                       │
│  Decay · eviction · episodic merge · schema induction · retrospection       │
│  Budget: consolidation slice · Trust: governed proposals                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  L2 · DELIBERATION (macro turn)                                            │
│  Perceive → Recall → Reason → Narrate → Consolidate → Act → Record         │
│  Budget: deliberation slice · Trust: calibrated judgment                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  L1 · TICK (micro cycle)                                                   │
│  Conditional stage graph: attend → infer → propose → verify → commit        │
│  Budget: cycle slice · Trust: full gate pipeline                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  L0 · REFLEX ARC (sub-cycle, interrupt-driven)                             │
│  Safety veto · manifold fast-judge · game tick · urgency preemption         │
│  Budget: reflex slice · Trust: fail-closed                                  │
└─────────────────────────────────────────────────────────────────────────────┘
         ▲                                          │
         │  higher levels configure lower levels     │ lower levels can
         │  (stage graph edits, budget allocation)   │ interrupt higher ones
         └──────────────────────────────────────────┘  (reflex veto)
```

**Coupling rules:**
- Each level is an instance of the same `StageGraphRunner`
- Each level has its own budget slice, summing to the global budget
- Lower levels may interrupt higher ones (preemption)
- Higher levels configure lower ones (stage graph edits, parameter updates)
- All levels write through the same commit ledger
- All levels emit events to the same provenance log

---

## §3 — Core Abstractions

### 3.1 Cognitive Transaction (The Universal Unit)

Every unit of cognition — perception, inference, proposal, judgment, action, learning, forgetting, consolidation, self-modification — is a **typed transaction**:

```typescript
interface CognitiveTransaction {
  // Identity
  id: TransactionId;
  correlationId: CorrelationId;      // threaded from stimulus
  parentId?: TransactionId;          // causal parent
  
  // Classification
  kind: TransactionKind;
  epistemicAxis: 'epistemic' | 'teleological' | 'procedural' | 'metacognitive';
  
  // Content
  inputs: CognitiveObject[];
  outputs: Candidate[];
  effects: EffectDeclaration[];
  
  // Resource
  budget: BudgetReservation;
  priority: number;                  // computed from utility function
  
  // Trust & Governance
  trust: TrustProfile;
  risk: RiskProfile;
  reversibility: ReversibilityClass;
  capabilities: CapabilityToken[];
  
  // Verification
  proofObligations: ProofObligation[];
  verificationPolicy: VerificationPolicy;
  
  // Failure
  fallback: FailurePolicy;
  timeout: Duration;
  
  // Lifecycle
  status: 'proposed' | 'reserved' | 'executing' | 'verifying' | 'committed' | 'rejected' | 'degraded';
}

type TransactionKind =
  | 'perception' | 'attention' | 'retrieval' | 'inference'
  | 'proposal' | 'judgment' | 'commit' | 'action'
  | 'learning' | 'forgetting' | 'consolidation'
  | 'simulation' | 'self-observation' | 'self-modification'
  | 'communication' | 'reflection';
```

### 3.2 Cognitive Object (The Typed Content)

```typescript
type CognitiveObject =
  | Belief          // { term, frequency, confidence, lineage }
  | Goal            // { term, desire, confidence, deadline }
  | Question        // { term, priority, expectedInfoGain }
  | Hypothesis      // { term, plausibility, evidenceRequirement }
  | Assumption      // { term, scope, validity }
  | Plan            // { steps, utility, feasibility, risk }
  | Obligation      // { commitment, priority, deadline }
  | Permission      // { actionClass, scope, conditions }
  | ActionIntent    // { effect, reversibility, authorization }
  | Lesson          // { correction, source, trust, applicability }
  | Event           // { type, payload, timestamp, correlationId }
  | ControlSignal;  // { target, parameter, value, authority }
```

### 3.3 Candidate (The Pre-Commit Unit)

```typescript
interface Candidate {
  content: CognitiveObject;
  proposer: ProposerId;
  trustScore: number;              // calibrated [0,1]
  judgmentStatus: 'pending' | 'admitted' | 'vetoed' | 'deferred' | 'abstained';
  evidenceLineage: LineageDAG;
  independenceVerified: boolean;
  provisional: boolean;            // if admitted without full verification
  decaySchedule?: DecayPolicy;     // for provisional admissions
}
```

---

## §4 — The Control Plane

### 4.1 Stage Graph (Declarative Control Flow)

The control flow at every level is a **conditional directed acyclic graph** (or cyclic graph with guarded back-edges), specified as data:

```typescript
interface StageGraph {
  id: GraphId;
  level: ControlLevel;             // L0..L4
  nodes: StageNode[];
  edges: StageEdge[];
  invariants: GraphInvariant[];    // statically checkable
  budgetSlice: BudgetSliceId;
}

interface StageNode {
  id: StageId;
  run: Middleware<CycleContext>;   // the executable
  preconditions: Predicate<CycleContext>[];
  postconditions: Predicate<CycleContext>[];
  budgetCost: BudgetScopeId;
  failurePolicy: 'skip' | 'abort' | 'degrade' | 'retry';
  optional: boolean;
  parallelizable: boolean;
}

interface StageEdge {
  from: StageId;
  to: StageId;
  guard: Predicate<CycleContext>;  // condition for traversal
  priority?: number;               // for choosing among enabled edges
  budget?: BudgetScopeId;          // edge traversal may cost
}
```

**The tick execution is graph traversal:**

```typescript
async function executeGraph(graph: StageGraph, ctx: CycleContext): Promise<CycleResult> {
  let current = graph.entryNode;
  const visited: StageId[] = [];
  
  while (current && !ctx.aborted) {
    // Check preconditions
    if (!current.preconditions.every(p => p(ctx))) {
      current = handlePreconditionFailure(current, ctx);
      continue;
    }
    
    // Execute stage
    await current.run(ctx);
    visited.push(current.id);
    
    // Find enabled outgoing edges
    const enabled = graph.edges
      .filter(e => e.from === current.id && e.guard(ctx))
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
    
    if (enabled.length === 0) break;
    
    // Budget check for edge traversal
    if (enabled[0].budget && !ctx.budget.canAfford(enabled[0].budget)) {
      ctx.emitEvent({ type: 'edge.starved', edge: enabled[0] });
      break;
    }
    
    current = graph.getNode(enabled[0].to);
  }
  
  return { visited, ctx };
}
```

### 4.2 The Default L1 Graph (Micro-Tick)

```
perceive ──▶ attend ──▶ [hasWork?] ──▶ infer ──▶ propose ──▶ verify ──▶ rank ──▶ commit
                │              │no                                              │
                │              ▼                                                ▼
                │           triage ──────────────────────────────────────▶ learn
                │
                └──▶ [budget.starved?] ──▶ yield ──▶ (loop edge to perceive)
```

Edges with guards:
- `attend → infer`: guard = `ctx.signals.hasWork`
- `attend → triage`: guard = `ctx.budget.starved('control-work')`
- `infer → propose`: guard = `ctx.derivations.length > 0`
- `infer → learn`: guard = `ctx.derivations.length === 0`
- `propose → verify`: guard = `ctx.proposals.bound`
- `commit → learn`: guard = `!ctx.signal.aborted`
- `learn → perceive`: guard = `!ctx.signal.aborted` (loop edge)

### 4.3 Scheduler (Adaptive, Bounded)

The scheduler selects the next transaction from an enabled set:

```typescript
interface Scheduler {
  select(state: CognitiveState, enabled: CognitiveTransaction[], budget: BudgetState): CognitiveTransaction | null;
  adapt(history: ScheduleHistory, feedback: ControlFeedback): SchedulerUpdate;
}
```

**Scheduler hierarchy (progressive fluidity):**

| Mode | Mechanism | Auditability |
|------|-----------|-------------|
| Fixed sequence | Hard-coded order | Trivially inspectable |
| Priority queue | Score-ranked enabled set | Score function inspectable |
| Claim queue | Blackboard: all operations post claims | Priority computation logged |
| Economic auction | Marginal-utility bidding | Bid/ask spread logged |
| Learned policy | RL-trained selection | Policy weights versioned, decisions logged |

**The scheduler operates under hard constraints:**
- Every scheduling decision is a `CognitiveEvent` (H6)
- The scheduler cannot bypass gates, budgets, or the epistemic firewall
- Learned scheduling changes are proposals subject to governance (C1)
- A `correlationId` threads every scheduling decision to its stimulus (C2)

### 4.4 Meta-Controller (Adaptive Control of the Control Law)

The meta-controller is itself a bounded reasoner that reasons about control:

```typescript
interface MetaController {
  observe(): ControlObservation;   // starvation, contradiction rate, yield, trace grades
  deliberate(obs: ControlObservation, budget: BudgetSlice): ControlProposal[];
  propose(changes: ControlProposal[]): SelfImprovementProposal;
  // Output is ALWAYS a proposal, never a direct mutation
}
```

**What the meta-controller may propose:**
- Stage graph edits (add/remove/reorder nodes and edges)
- Budget reallocation (transfer between scopes)
- Strategy parameter changes (sampling weights, attention models)
- Scheduler mode changes (priority → economic)
- Clock rate adjustments (heterochronous tower rebalancing)

**What the meta-controller may NOT do:**
- Directly apply any change (propose-only)
- Modify the epistemic firewall
- Alter the commit ledger's admission logic
- Bypass governance for any proposal
- Modify its own governance constraints

---

## §5 — The Epistemic Plane

### 5.1 Truth Algebra

Beliefs carry two-dimensional evidence-sensitive truth values:

$$\text{Belief} = (\text{term},\; f,\; c) \quad \text{where } f \in [0,1] \text{ (frequency)}, \; c \in [0,1] \text{ (confidence)}$$

Goals carry desire values:

$$\text{Goal} = (\text{term},\; d,\; c) \quad \text{where } d \in [0,1] \text{ (desire)}, \; c \in [0,1] \text{ (confidence)}$$

**Revision operator** (evidence combination):

$$\text{rev}((f_1, c_1), (f_2, c_2)) = \left(\frac{f_1 c_1 (1-c_2) + f_2 c_2 (1-c_1)}{c_1(1-c_2) + c_2(1-c_1)},\; c_1(1-c_2) + c_2(1-c_1)\right)$$

**Key properties:**
- Non-idempotent: evidence accumulates
- Commutative but not associative
- Confidence is sub-additive
- Requires evidence-independence check before revision

### 5.2 The Epistemic Firewall (Type-Level Invariant)

```typescript
// This is a COMPILE-TIME and RUNTIME invariant:
type CognitiveAxis = 'epistemic' | 'teleological' | 'procedural';

// The type system enforces:
// Reward → AttentionPolicy:     ALLOWED
// Reward → Truth.frequency:     FORBIDDEN (EpistemicFirewallViolation)
// Reward → Truth.confidence:    FORBIDDEN (EpistemicFirewallViolation)
// GoalFailure → FalseBelief:    FORBIDDEN
// Desire → Fact:                FORBIDDEN

interface RewardGate {
  validate(mutation: StateMutation): Verdict;
  // Returns REJECT with EpistemicFirewallViolation if mutation targets
  // Truth.frequency or Truth.confidence from a reward/desire signal
}
```

### 5.3 Paraconsistent Retention

Contradictions do not explode. Both $P$ and $\neg P$ may coexist with distinct truth values:

```typescript
// On contradiction detection:
// 1. Both statements retained with their respective (f, c) values
// 2. A ContradictionEvent is emitted
// 3. The contradiction is available for resolution (not forced)
// 4. Query responses grade over contradictions rather than collapsing
```

### 5.4 Substrate Arbitration (Hybrid Synergy)

Multiple inference substrates coexist under explicit arbitration:

| Substrate | Role | Trust Status | Integration |
|-----------|------|-------------|-------------|
| Non-axiomatic logic (NAL) | Core uncertain inference | Trusted kernel | Native |
| Exact rewriting (e-graph) | Deterministic computation | Trusted tool | Gated oracle, memory-isolated |
| Neural/LM proposers | Hypothesis generation | Untrusted proposer | Judged before admission |
| Probabilistic estimators | Calibration, uncertainty | Calibrated instrument | Scored, digest-pinned |
| Reflex/fast-path | Urgent response | Untrusted proposer | Judged, can be vetoed |

**Arbitration invariant:** Exact substrates never union nodes based on uncertain similarity. Neural outputs never directly mutate symbolic state. All cross-substrate communication is via typed proposals through the commit ledger.

---

## §6 — The Resource Plane

### 6.1 Budget Algebra

Resources form a **bounded distributive lattice** with economic operations:

```typescript
interface BudgetAlgebra {
  dimensions: BudgetDimension[];    // cycles, derivations, memoryOps, llmCalls, tokens, latency, risk
  
  // Core operations
  reserve(scope: ScopeId, amount: BudgetVector): Reservation | Refusal;
  settle(reservation: Reservation, actual: BudgetVector): Settlement;
  charge(scope: ScopeId, cost: BudgetVector): ChargeResult;
  
  // Economic operations
  transfer(from: ScopeId, to: ScopeId, amount: number): TransferResult;
  bid(scope: ScopeId, utility: number): Bid;
  clear(bids: Bid[]): Allocation;
  
  // Lifecycle
  openCycle(): void;                // reset per-cycle scopes (open-once)
  remaining(scope: ScopeId): BudgetVector;
  exhausted(scope: ScopeId): boolean;
}
```

### 6.2 Resource Dimensions

| Dimension | Unit | Reset Policy |
|-----------|------|-------------|
| cycles | count | per-cycle |
| derivations | count | per-cycle |
| premises | count | per-cycle |
| memoryOps | count | per-cycle |
| llmCalls | count | per-cycle |
| tokens | count | per-cycle |
| latency | milliseconds | per-cycle |
| attention | focus-slots | per-cycle |
| risk | irreversibility-quota | lifetime |
| humanAttention | approval-units | lifetime |
| depth | nesting-level | per-transaction |

### 6.3 Economic Scheduling

Under pressure, the system allocates by **marginal utility per scarce resource**:

$$\text{score}(\text{op}) = \frac{\hat{\Delta K} + \hat{\Delta G} + \hat{\Delta H}}{\lambda_c\,\hat{C} + \lambda_r\,\hat{R} + \lambda_h\,\hat{H}_{\text{human}}}$$

**Degradation ladder under increasing pressure:**

| Pressure Level | Behavior |
|---------------|----------|
| Low | Explore, enrich, elaborate |
| Medium | Prioritize goals and proofs |
| High | Conserve, degrade to symbolic-only |
| Critical | Minimal cognition, seek human help only when necessary |
| Exhausted | Graceful halt with state preservation |

### 6.4 Reservation Protocol

Before executing any transaction:

```
1. Scheduler selects transaction T
2. T.budget is computed from cost model
3. BudgetOffice.reserve(T.budget) → Reservation | Refusal
4. If Refusal: emit BudgetStarvationEvent, skip T
5. If Reservation: execute T
6. After execution: BudgetOffice.settle(reservation, actualCost)
7. Unused reservation is returned to the pool
```

This prevents silent starvation and provides typed backpressure.

---

## §7 — The Trust & Governance Plane

### 7.1 Gate Architecture

All state mutations pass through a **unified admission functional**:

```typescript
interface AdmissionFunctional {
  admit(candidate: Candidate, context: AdmissionContext): AdmissionVerdict;
}

type AdmissionVerdict =
  | { result: 'admitted'; confidence: number; conditions?: Condition[] }
  | { result: 'vetoed'; reason: VetoReason; vetoSource: VetoId }
  | { result: 'deferred'; reviewAt: Timestamp; conditions: Condition[] }
  | { result: 'abstained'; clarification: Question };

interface AdmissionContext {
  trustPolicy: TrustPolicy;
  budgetPolicy: BudgetPolicy;
  epistemicPolicy: EpistemicPolicy;
  riskPolicy: RiskPolicy;
  autonomyLevel: AutonomyRung;
}
```

### 7.2 Trust Field (Continuous, Calibrated)

Trust is not binary. It is a continuous field:

$$T(\text{source}, \text{content}, \text{context}, \text{history}) \in [0, 1]$$

Built from:
- Source quality ceiling (per-source prior)
- Source reputation multiplier (learned, floor-bounded)
- Calibrated judgment scores (isotonic calibration, digest-pinned)
- Corroboration factor (independent evidence)
- Claim specificity (vague claims get lower trust)

**Admission bands:**

| Trust Range | Action |
|------------|--------|
| $T > \theta_{\text{high}}$ | Auto-admit |
| $\theta_{\text{mid}} < T \leq \theta_{\text{high}}$ | Provisional admit with decay schedule |
| $\theta_{\text{low}} < T \leq \theta_{\text{mid}}$ | Defer for review / shadow-validate |
| $T \leq \theta_{\text{low}}$ | Reject (fail-closed at ingress) |

### 7.3 Risk / Reversibility / Authorization Manifold

Every mutation is classified on a governance surface:

```typescript
interface GovernanceProfile {
  trust: number;              // calibrated source/proposal trust
  confidence: number;         // epistemic confidence
  risk: number;               // expected harm / irreversibility
  reversibility: number;      // ease of rollback [0,1]
  blastRadius: number;        // scope of impact [0,1]
  proofStatus: ProofStatus;
  judgeStatus: JudgeStatus;
  simulationStatus: SimulationStatus;
}
```

**Commit path determination:**

| Trust | Risk | Reversibility | Path |
|-------|------|---------------|------|
| High | Low | High | Auto-commit |
| High | Medium | High | Shadow-commit then promote |
| Medium | Low | High | Provisional commit with decay |
| Medium | Medium | Medium | Human review |
| Low | High | Low | Reject |
| Any | High | Low | Strong proof or human approval required |
| Any | Any | Irreversible | Full authorization pipeline mandatory |

### 7.4 Autonomy Ladder

Five rungs of increasing authority:

| Rung | Authority | Requirement |
|------|-----------|-------------|
| 0 | Observe-only | No mutations permitted |
| 1 | Propose-only | All changes are proposals, nothing applied |
| 2 | Sandbox-execute | Changes run in isolated sandbox, no external effects |
| 3 | Low-risk auto-merge | Low-risk changes auto-applied; high-risk still gated |
| 4 | Human-approved production | All changes require explicit human approval |

### 7.5 Verification Portfolio

Candidates are checked by a portfolio of verification mechanisms:

| Mechanism | What it checks | Independence |
|-----------|---------------|-------------|
| Schema validation | Structural well-formedness | Engine-independent |
| Formal proof | Logical derivation correctness | Standalone verifier, transcribed truth table |
| Calibrated judge | Statistical quality (Brier-scored) | Digest-pinned weights |
| Shadow execution | Behavioral equivalence | Separate runtime |
| Simulation | Consequence prediction | Sandboxed |
| Human approval | Value alignment | External |

**Verifier independence law:** The verification module must not share unsafe dependencies with the engine it verifies. Truth tables are transcribed. Drift between engine and verifier is measured and pinned by test.

---

## §8 — The Provenance Plane

### 8.1 Event Sourcing (State = Fold of Events)

The cognitive state is **entirely reconstructable** from an append-only event log:

$$X_t = \text{fold}(e_0, e_1, \ldots, e_t)$$

```typescript
interface CognitiveEvent {
  id: EventId;
  type: EventType;
  timestamp: Timestamp;
  correlationId: CorrelationId;
  cycleId: CycleId;
  transactionId: TransactionId;
  level: ControlLevel;
  payload: EventPayload;
  causalParent?: EventId;
}

type EventType =
  | 'stimulus.received' | 'cycle.began' | 'stage.entered' | 'stage.exited'
  | 'task.admitted' | 'derivation.produced' | 'derivation.recorded'
  | 'budget.charged' | 'budget.exhausted' | 'budget.transferred'
  | 'gate.admitted' | 'gate.vetoed' | 'gate.deferred'
  | 'proposal.generated' | 'proposal.judged' | 'proposal.committed'
  | 'action.executed' | 'action.rolled_back'
  | 'learning.observed' | 'learning.proposed' | 'learning.applied'
  | 'control.graph_edited' | 'control.strategy_changed'
  | 'engine.fault' | 'engine.degraded'
  | 'meta.proposed' | 'meta.applied';
```

### 8.2 Correlation Threading (Causal Observability)

A single `CorrelationId` is minted at stimulus entry and threaded through every subsequent operation:

```
stimulus ──▶ macro-cycle ──▶ micro-cycle N ──▶ derivation d ──▶ commit ──▶ action
   │              │               │                 │              │           │
   └──────────────┴───────────────┴─────────────────┴──────────────┴───────────┘
                              same CorrelationId
```

This enables queries:
- "Which user message caused this belief?"
- "Which derivation led to this action?"
- "Which judge vetoed this candidate?"
- "Which budget exhaustion caused this degradation?"
- "Which learning episode changed this strategy?"

### 8.3 Replay and Verification

```typescript
// State reconstruction
function replayCognitiveState(events: CognitiveEvent[]): CognitiveState;

// Control reconstruction (WHY it reasoned that way)
function replayControlState(events: CognitiveEvent[]): ControlHistory;

// Independent verification
function verifyDerivation(record: DerivationRecord): VerificationResult;
// Uses transcribed truth table, zero engine dependencies

// Determinism check
function verifyReplayHash(replayState: CognitiveState, expectedHash: Hash): boolean;
```

### 8.4 Provenance Invariants

- **Admit-before-write:** No state write occurs without a preceding gate event
- **Every mutation is logged:** No silent state changes
- **Every fault is logged:** No silent `catch {}` — all failures are typed events
- **Control decisions are logged:** Scheduler choices, edge selections, budget refusals
- **Replay is deterministic:** Pure reducers, seeded randomness, hash-verified

---

## §9 — The Adaptation Plane

### 9.1 Learning as Governed Proposals

All learning produces **proposals**, never direct mutations:

| Learning Domain | Mutates | Direct? | Governance |
|----------------|---------|---------|-----------|
| Attention weights | Focus allocation | Sometimes auto (low-risk) | Logged |
| Strategy selection | Inference behavior | Proposal or auto | Medium risk |
| Parameter tuning | Budgets/thresholds | Proposal | Medium risk |
| Rule induction | Symbolic rules | Proposal | Proof + shadow validation |
| Schema promotion | Rule table | Proposal | Shadow CI + approval |
| Code generation | Own source | Proposal | Full CI + external approval |
| Governance change | Gates/policies | Never self-applied | External governance only |
| Reward function | Utility weights | Never direct | Human/external approval |

### 9.2 Self-Modification Pipeline

```
observation
  → lesson (distilled correction)
  → hypothesis (explanatory candidate)
  → strategy proposal (control change)
  → shadow test (isolated execution)
  → bounded deployment (sandbox or low-risk auto)
  → trace evaluation (did it help?)
  → retention or rollback
```

**Hard constraint:** Learning may propose changes to cognition, but it may not directly rewrite the laws of epistemic commitment, the commit ledger's admission logic, or its own governance constraints.

### 9.3 Governed Reflexivity (Meta-Modification)

The system can modify its own control structure (stage graphs, budget policies, scheduler parameters) through the following pipeline:

1. **Meta-controller observes** control-plane telemetry (starvation, contradiction rate, yield)
2. **Meta-controller deliberates** under its own budget slice
3. **Meta-controller proposes** a `ControlChangeProposal`
4. **Proposal is routed** through governance (risk classification → shadow validation → approval)
5. **If approved:** hot-swap at cycle boundary (not mid-cycle rebuild)
6. **State is preserved:** derivation counters, circular detectors, in-flight context carried across

---

## §10 — The Unified Commit Ledger

### 10.1 Single Commit Authority

All durable state mutation passes through **one commit port**:

```typescript
interface CommitLedger {
  commit(candidate: Candidate, context: CommitContext): CommitResult;
  rollback(transactionId: TransactionId): RollbackResult;
  fold(events: CognitiveEvent[]): CognitiveState;
}

interface CommitContext {
  budget: BudgetState;
  governance: GovernanceProfile;
  epistemicCheck: EpistemicFirewallCheck;
  independenceCheck: EvidenceIndependenceCheck;
}
```

**The commit pipeline:**

```
Candidate
  → Normalize (canonical form)
  → Type-Check (epistemic axis, structural validity)
  → Evidence-Independence Check (no double-counting)
  → Proof / Judge / Simulation (verification portfolio)
  → Rank (score by calibrated confidence × decisiveness)
  → Budget Settlement (charge the appropriate scope)
  → Risk Classification (blast radius, reversibility)
  → Governance Check (autonomy level, approval requirements)
  → Commit or Reject (with typed event either way)
```

### 10.2 What Flows Through the Ledger

Everything:
- Perceived observations
- Derived beliefs
- Generated goals
- Neural/LM formalizations
- Reflex proposals
- Tool results
- Schema inductions
- Strategy changes
- Parameter tunings
- Code patches
- Action intentions
- Human corrections
- Consolidation merges
- Forgetting operations

---

## §11 — Failure and Degradation

### 11.1 Failure Policy Algebra

Every component has an explicit failure policy:

```typescript
type FailurePolicy =
  | { kind: 'fail-closed'; message: string }      // reject on fault
  | { kind: 'fail-open'; log: boolean }           // continue on fault
  | { kind: 'degrade'; to: DegradationMode }      // switch to weaker mode
  | { kind: 'retry'; max: number; backoff: Duration }
  | { kind: 'abstain'; clarification: Question }  // admit ignorance
  | { kind: 'escalate'; to: EscalationTarget };   // request help
```

### 11.2 Asymmetric Failure (The Core Polarity)

| Boundary | Policy | Rationale |
|----------|--------|-----------|
| Ingress (untrusted → memory) | **Fail-closed** | An unjudged stimulus must not enter |
| Internal cognition | **Fail-open** | A provider fault must not halt thinking |
| Egress (derived → action) | **Fail-open with veto** | Cognition continues; actions can be blocked |
| Self-modification | **Fail-closed** | An unverified patch must not apply |
| Budget exhaustion | **Degrade** | Reduce capability, don't halt |
| Verifier unavailable | **Degrade to symbolic** | Lose judgment, keep inference |

### 11.3 Degradation Modes

| Mode | What's lost | What's preserved |
|------|------------|-----------------|
| Full operation | Nothing | Everything |
| No neural judgment | Calibrated scoring | Symbolic inference, gates, budgets |
| No LM proposals | Hypothesis generation | NAL rules, exact computation |
| No tools | External computation | Internal reasoning |
| Minimal cognition | All enrichment | Core NAL + event log + gates |
| Emergency halt | All processing | State preservation, event log |

### 11.4 The No-Silent-Failure Law

**Every failure is a typed event.** There are no empty `catch {}` blocks. Every fault produces:

```typescript
interface FaultEvent {
  type: 'engine.fault' | 'gate.fault' | 'budget.fault' | 'scheduler.fault' | 'verifier.fault';
  component: ComponentId;
  error: ErrorClass;
  policy: FailurePolicy;       // what was done
  impact: ImpactAssessment;    // what was affected
  correlationId: CorrelationId;
}
```

---

## §12 — Invariants and Equational Laws

### 12.1 Hard Invariants (Never Violated)

| # | Law | Formal Statement |
|---|-----|-----------------|
| I1 | Epistemic Firewall | $\forall m: \text{Mutation}. \; \text{source}(m) = \text{reward} \Rightarrow \text{target}(m) \notin \{\text{Truth}.f, \text{Truth}.c\}$ |
| I2 | Single Write Path | $\exists! \; \text{commit} : \text{Candidate} \to \text{State}$ |
| I3 | Admission Uniqueness | Every state mutation passes through exactly one admission gate |
| I4 | Budget Closure | $\forall \text{charge}. \; \exists \text{ScopeId}. \; \text{charge} \in \text{Budget}(\text{ScopeId})$ |
| I5 | Event Completeness | $\forall \text{mutation}. \; \exists \text{event}. \; \text{event.type} = \text{mutation.type}$ |
| I6 | Verifier Independence | $\text{imports}(\text{verifier}) \cap \text{imports}(\text{engine}) = \emptyset$ |
| I7 | No Self-Approval | $\text{approver}(\text{self-mod}) \neq \text{self}$ |
| I8 | Bounded Cognition | $\forall \text{path}. \; \text{cost}(\text{path}) < \infty$ |
| I9 | Substrate Isolation | $\text{e-graph.union}(a, b) \Rightarrow \text{evidence}(a \equiv b) = \text{exact}$ |
| I10 | Replay Determinism | $\text{fold}(\text{log}) = \text{fold}(\text{log}') \iff \text{log} = \text{log}'$ |

### 12.2 Feasibility Constraints (Coupling Laws)

| # | Constraint | Meaning |
|---|-----------|---------|
| F1 | Ampliative inference $\Rightarrow$ graded truth | Binary truth insufficient for induction/abduction |
| F2 | AIKR $\Rightarrow$ bounded memory + forgetting | Unbounded growth contradicts bounded postulate |
| F3 | Untrusted proposers $\Rightarrow$ judgment gates | No ungated adoption |
| F4 | Self-modification $\Rightarrow$ external governance | Self-approval is unsound |
| F5 | Event-sourced $\Rightarrow$ deterministic replay | Log must be sufficient for reconstruction |
| F6 | Paraconsistency $\Rightarrow$ non-monotonic logic | Explosion trivializes contradictions |
| F7 | Anytime $\Rightarrow$ cooperative yield + partial results | Interruptibility requires contract |
| F8 | Calibrated judgment $\Rightarrow$ digest-pinned weights | Drift invalidates calibration |
| F9 | Learned scheduling $\Rightarrow$ logged decisions | Opacity violates auditability |
| F10 | Code self-mod $\Rightarrow$ shadow CI + external merger | Containment requires separation |

---

## §13 — Operational Semantics

### 13.1 The Tick (L1 Execution)

```
function tick(ctx: CycleContext):
  1. ctx.budget.openCycle()                    // reset per-cycle scopes
  2. ctx.correlationId = mint(ctx.stimulus)    // thread from stimulus
  3. graph = ctx.stageGraph                    // loaded as data
  4. result = executeGraph(graph, ctx)         // §4.1
  5. for each candidate in result.outputs:
       verdict = admissionFunctional.admit(candidate, ctx)
       if verdict == 'admitted':
         commitLedger.commit(candidate, ctx)
       else:
         emitEvent(verdict.toEvent())
  6. ctx.metaController.observe()              // feed meta-loop
  7. emitEvent('cycle.completed', result)
```

### 13.2 The Meta-Tick (L4 Execution, every K cycles)

```
function metaTick(ctx: MetaContext):
  1. observation = metaController.observe()
     // starvation events, contradiction rate, derivation yield,
     // reflex-vs-symbolic veto frequency, trace grades
  2. proposals = metaController.deliberate(observation, ctx.budget)
     // may propose: graph edits, budget transfers, strategy changes
  3. for each proposal in proposals:
       governed = governancePipeline.route(proposal)
       // risk classify → shadow validate → approve/reject
       if governed.approved:
         scheduleHotSwap(proposal, atCycleBoundary=true)
       else:
         emitEvent('meta.rejected', governed.reason)
```

### 13.3 The Reflex Arc (L0, Interrupt-Driven)

```
function reflexArc(signal: UrgentSignal):
  1. if signal.type == 'safety_veto':
       activeCycle.abort()
       emitEvent('reflex.veto', signal)
  2. if signal.type == 'manifold_fast_judge':
       verdict = fastJudge(signal.candidate)
       if verdict == 'reject':
         blockAdmission(signal.candidate)
  3. if signal.type == 'urgency_preempt':
       scheduler.preempt(signal.priority)
```

---

## §14 — Configuration and Composition

### 14.1 The Configuration Object

The entire system is specified by a single configuration:

```typescript
interface ReasonerConfiguration {
  // Control
  stageGraphs: Map<ControlLevel, StageGraph>;
  scheduler: SchedulerConfig;
  metaController: MetaControllerConfig;
  
  // Epistemic
  truthAlgebra: TruthAlgebraSpec;
  firewall: EpistemicFirewallSpec;
  substrates: SubstrateSpec[];
  arbitration: ArbitrationSpec;
  
  // Resources
  budgetDimensions: BudgetDimension[];
  scopes: BudgetScopeSpec[];
  economicPolicy: EconomicPolicySpec;
  
  // Trust & Governance
  gates: GateSpec[];
  trustField: TrustFieldSpec;
  autonomyLadder: AutonomySpec;
  verificationPortfolio: VerificationSpec[];
  
  // Provenance
  eventLog: EventLogSpec;
  correlationPolicy: CorrelationSpec;
  replayConfig: ReplaySpec;
  
  // Adaptation
  learningOperators: LearningOperatorSpec[];
  selfModPipeline: SelfModSpec;
  governancePipeline: GovernanceSpec;
  
  // Failure
  failurePolicies: Map<ComponentId, FailurePolicy>;
  degradationModes: DegradationMode[];
}
```

### 14.2 Composition Operations

Configurations support algebraic operations:

| Operation | Symbol | Meaning |
|-----------|--------|---------|
| Sequential composition | $c_1 \otimes c_2$ | Run $c_1$ then $c_2$ |
| Parallel composition | $c_1 \oplus c_2$ | Run concurrently, join |
| Restriction | $c \mid P$ | Project onto subset of capabilities |
| Refinement | $c_1 \sqsubseteq c_2$ | $c_1$'s behaviors ⊆ $c_2$'s behaviors |
| Lifting | $\text{lift}(c, f)$ | Apply functor $f$ to every component |
| Abstraction | $\alpha(c)$ | Map to behavioral equivalence class |

---

## §15 — Implementation Topology

### 15.1 Module Structure

```
Ω/
├── kernel/                    # The minimal load-bearing core
│   ├── state/                 # Cognitive state (bags, concepts, links)
│   ├── truth/                 # NAL truth algebra, revision
│   ├── budget/                # Budget algebra, scopes, reservations
│   ├── gates/                 # Admission functional, gate lattice
│   ├── commit/                # The single commit ledger
│   └── events/                # Event log, fold, replay
│
├── control/                   # The control plane
│   ├── graph/                 # Stage graph definition and execution
│   ├── scheduler/             # Priority queue, claim queue, economic
│   ├── meta/                  # Meta-controller, deliberation
│   ├── tower/                 # Heterochronous level management
│   └── reflex/                # L0 interrupt handling
│
├── epistemic/                 # The epistemic plane
│   ├── nal/                   # Non-axiomatic logic rules
│   ├── firewall/              # Belief/goal separation, RewardGate
│   ├── substrates/            # MeTTa, embeddings, neural heads
│   └── arbitration/           # Cross-substrate proposal routing
│
├── trust/                     # The trust plane
│   ├── judgment/              # Calibrated manifold, digest-pinned
│   ├── risk/                  # Risk classification, reversibility
│   ├── autonomy/              # Ladder state machine
│   └── verification/          # Standalone verifier, shadow execution
│
├── adaptation/                # The adaptation plane
│   ├── learning/              # RLFP, schema induction, distillation
│   ├── self-mod/              # Shadow worktree, CI pipeline
│   └── governance/            # Proposal routing, approval
│
├── provenance/                # The provenance plane
│   ├── log/                   # Append-only event store
│   ├── correlation/           # CorrelationId threading
│   ├── replay/                # State reconstruction
│   └── verifier/              # Independent derivation checker
│
├── resources/                 # The resource plane
│   ├── economy/               # Bidding, pricing, market clearing
│   ├── degradation/           # Graceful degradation modes
│   └── backpressure/          # Throttling, yielding, interruption
│
└── ports/                     # Typed interfaces (replaceable)
    ├── memory/                # 9+ memory ports
    ├── scheduler/             # Scheduler interface
    ├── judgment/              # Judge interface
    ├── substrate/             # Inference substrate interface
    ├── governance/            # Approval interface
    └── observation/           # Sensor/telemetry interface
```

### 15.2 The Minimal Kernel (What Cannot Be Removed)

Five components are **load-bearing** — removing any one destroys the system's character:

1. **A substrate** — something to reason with (truth algebra + rules)
2. **A control graph** — something to sequence the reasoning
3. **An admission gate** — a boundary between outside and state
4. **A resource monoid** — the fact that cognition is finite
5. **A provenance fold** — the auditability that makes the rest trustworthy

Everything else — drives, neural proposers, meta-control, multi-agent, economic scheduling — is **enrichment**: coordinates that can be dialed from "present" to "absent" without leaving the design space.

---

## §16 — Summary: The Design Thesis

Ω is the point in reasoner design space that:

- **Freezes nothing** except the epistemic firewall and the single commit path
- **Makes everything else data**: stages, edges, budgets, strategies, trust policies, failure modes
- **Pays for adaptivity with provenance**: every scheduling decision, budget transfer, graph edit, and strategy change is event-sourced and replayable
- **Bounds everything**: no path is unbounded, no scope is inexhaustible, no loop is infinite without abort
- **Trusts nothing by default**: all proposers are untrusted; all admission requires judgment; all self-modification requires external governance
- **Degrades gracefully**: every fault has a typed response; every exhaustion has a fallback; every absence has a symbolic path
- **Evolves under governance**: the system can propose changes to its own control structure, but never apply them without passing through the same gates, budgets, and approval pipelines that govern all other cognition

The governing principle: **move the control plane toward expressiveness and learning, while keeping the epistemic plane rigid.** The system's power is bounded by the expressiveness of its control graph and the depth of its reflexivity. Its safety is bounded by how much of that control is event-sourced, replayable, and governed.

---

## Appendix A: Notation

| Symbol | Meaning |
|--------|---------|
| $X$ | Cognitive state |
| $\Pi$ | Controller / scheduler |
| $\mu$ | Meta-controller |
| $\beta$ | Budget algebra |
| $\varepsilon$ | Trust / gate structure |
| $\kappa$ | Control word / stage graph |
| $\mathcal{T}$ | Transaction type |
| $\mathcal{G}$ | Gate lattice |
| $\mathcal{V}$ | Verification portfolio |
| $\Omega$ | Observability / correlation graph |
| $\Phi$ | Feasibility predicate |
| $\Psi$ | Coupling constraints |
| $\delta$ | Movement operator (design space navigation) |
| $\text{fold}$ | Event log → state reconstruction |
| $\text{commit}$ | The single admission/write operation |

## Appendix B: Hard Constraint Checklist

| # | Constraint | Enforcement |
|---|-----------|-------------|
| H1 | No reward → belief truth | Type system + RewardGate runtime check |
| H2 | No untrusted proposal enters memory without judgment | Admission functional, fail-closed ingress |
| H3 | No state mutation without event-log entry | Commit ledger emits event atomically |
| H4 | No self-modification self-approved | External governance pipeline, shadow CI |
| H5 | No unbounded reasoning path | Budget algebra, deadlines, AbortSignal |
| H6 | No opaque scheduler decision | All scheduling decisions are CognitiveEvents |
| H7 | No verifier sharing unsafe engine dependencies | Transcribed truth table, import isolation |
| H8 | No e-graph union on uncertain similarity | Substrate isolation, arbiter pattern |
| H9 | No silent failure | Typed FaultEvent for every error |
| H10 | No irreversible action without risk classification | Governance manifold, reversibility typing |
