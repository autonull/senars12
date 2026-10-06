# AEGIS — Architecture for an Epistemically-Governed Intelligent System
## A Complete Cybernetic Control-Theoretic Specification

---

## §0 — Design Charter

### 0.1 Selected Governing Principles

This specification is governed by the following selections from the design-objective space. All subsequent architectural decisions resolve conflicts in favor of these commitments.

**Prime Objectives** (in order of precedence when conflicts arise):

| Rank | ID | Objective |
|---|---|---|
| 1 | O1 | Maximum epistemic integrity |
| 2 | O8 | Unified commit ledger |
| 3 | O2 | Auditable causal provenance |
| 4 | O3 | Control-plane fluidity (declarative control flow) |
| 5 | O6 | Governed reflexivity |
| 6 | O4 | Resource economics |
| 7 | O7 | Neuro-symbolic synergy |

**Hard Constraints** (invariant under all circumstances):

| ID | Constraint |
|---|---|
| H1 | No reward signal may directly alter belief truth values. |
| H2 | No untrusted proposal may enter durable memory without judgment or explicit provisional typing. |
| H3 | No state mutation may occur without an event-log entry. |
| H4 | No self-modification may be self-approved without external or governed arbitration. |
| H5 | No reasoning path may be unbounded in memory, time, derivations, or model calls. |
| H6 | No scheduler decision may be completely opaque; control choices must be inspectable. |
| H7 | No verifier may share unsafe engine dependencies when checking derivations. |
| H8 | No exact symbolic substrate may union nodes based solely on uncertain similarity. |
| H9 | No failure may be silently swallowed where it affects cognition, budget, or admission. |
| H10 | No irreversible action may bypass risk classification and authorization. |

**Anti-Goals** (explicitly deprioritized):

| ID | Anti-Goal |
|---|---|
| A2 | Avoid scheduler opacity. |
| A5 | Avoid monolithic LM authority. |
| A7 | Avoid unbounded cognitive richness. |

**Architectural Bias** (D-selections):

D1 (Auditability) ∧ D3 (Elegance/Unification) ∧ D4 (Robustness) ∧ D5 (Modularity) ∧ D6 (Adaptivity)

The system is biased toward **auditable adaptive elegance**: one unified control model, one transaction type, one commit surface, one governance vocabulary, one resource algebra — all inspectable, all governed, all degradable.

### 0.2 The One-Sentence Thesis

> A reasoner is a **governed cybernetic controller** that transforms observations and internal states into **justified, budgeted, typed commitments** under scarce resources, where every commitment is proposal-generated, verification-gated, event-sourced, causally-correlated, and independently replayable.

---

## §1 — The Cybernetic Premise

### 1.1 State-Space Representation

A reasoner is modeled as a **resource-bounded, epistemically-typed, partially-observable, reflexive control system**:

$$
\mathcal{R} = \langle X,\; \Omega,\; U,\; \Pi,\; G,\; \mathcal{B},\; \mathcal{V},\; \mathcal{L},\; F,\; \Sigma_{\Omega} \rangle
$$

| Symbol | Name | Cybernetic Role |
|---|---|---|
| $X$ | Cognitive state manifold | **Plant** — the knowledge state being controlled |
| $\Omega$ | Observation space | **Sensor input** — external stimuli, telemetry, feedback |
| $U$ | Cognitive operator library | **Actuator set** — inference, tools, learning, forgetting |
| $\Pi$ | Meta-controller / scheduler | **Controller** — selects and sequences operations |
| $G$ | Governance predicate ensemble | **Constraint surface** — gates, invariants, firewalls |
| $\mathcal{B}$ | Resource economy algebra | **Bandwidth / power constraint** |
| $\mathcal{V}$ | Verification portfolio | **Observer / estimator** — judges, proofs, simulators |
| $\mathcal{L}$ | Learning / self-modification operators | **Adaptive law** — how $\Pi$, $U$, $G$ themselves change |
| $F$ | Failure policy map | **Fault-tolerance policy** — degrade, abstain, fallback |
| $\Sigma_{\Omega}$ | Observability / correlation graph | **State estimator** — event log, causal IDs, replay |

### 1.2 The Control Loop

At each control instant $t$:

```
┌─────────────────────────────────────────────────────────────┐
│                    CYBERNETIC CONTROL LOOP                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. SENSE:     ω(t) = Sense(Ω, X)                            │
│                Extract observations from environment          │
│                and internal telemetry.                         │
│                                                               │
│  2. ESTIMATE:  x̂(t) = Estimate(Σ_Ω, ω, history)              │
│                Fold event log into current                    │
│                cognitive state estimate.                       │
│                                                               │
│  3. EVALUATE:  e(t) = Reference(t) − x̂(t)                   │
│                Compute error: drive gaps,                     │
│                contradictions, budget pressure,               │
│                quality deficits, curiosity.                    │
│                                                               │
│  4. DECIDE:    u(t) = Π(x̂, e, B_avail, G)                   │
│                Select cognitive program:                      │
│                which operators, in what order,                │
│                with what budget reservation.                  │
│                                                               │
│  5. RESERVE:   B_avail ← B_avail − B_reserved(u)             │
│                Pre-commit resources.                          │
│                                                               │
│  6. EXECUTE:   Y(t) = Execute(u, X, B_reserved)              │
│                Run cognitive operations,                      │
│                producing candidate outputs.                    │
│                                                               │
│  7. VERIFY:    Z(t) = V(Y, X, G)                             │
│                Judge, prove, simulate, calibrate.             │
│                                                               │
│  8. COMMIT:    X(t+1) = Commit(Z, G, B)                      │
│                If governance passes:                          │
│                  commit via single ledger.                    │
│                Else:                                           │
│                  X(t+1) = Degrade(X, Y, F)                   │
│                                                               │
│  9. SETTLE:    B_settled = B_reserved − B_unused             │
│                Reconcile reserved vs. actual.                 │
│                                                               │
│  10. RECORD:   Σ_Ω ← Σ_Ω ⊕ Event(t, ω, u, Y, Z, X')         │
│                Append all to causal event log.                │
│                                                               │
│  11. META:     Π', B', G' = L(Π, B, G, x̂, e, u, Y, Z)       │
│                Adapt controller, budgets, governance          │
│                (as governed proposals, not direct writes).    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 The Control Objective

The system maximizes a **constrained cognitive utility functional**:

$$
J = \mathbb{E}\!\left[\sum_{t} \gamma^{t} \Big( \underbrace{\Delta K_t}_{\text{epistemic gain}} + \underbrace{\Delta \Gamma_t}_{\text{goal progress}} + \underbrace{\Delta H_t}_{\text{homeostatic balance}} - \underbrace{\alpha\, R_t}_{\text{risk}} - \underbrace{\beta\, C_t}_{\text{resource cost}} - \underbrace{\lambda\, \Phi_t}_{\text{violation penalty}} \Big)\right]
$$

Subject to **hard constraints** at every step:

$$
\mathcal{B}_t \;\geq\; \text{cost}(u_t) \qquad \text{(budget feasibility)}
$$
$$
G(X_t,\, u_t,\, Z_t) = \texttt{true} \qquad \text{(governance satisfaction)}
$$
$$
\text{Reward} \;\nrightarrow\; \text{BeliefTruth} \qquad \text{(epistemic firewall, H1)}
$$
$$
\text{UntrustedProposal} \;\Rightarrow\; \text{JudgedBeforeCommit} \qquad \text{(H2)}
$$

### 1.4 Stability Definition

The system is **stable** when:

1. **Epistemic coherence**: Contradictions do not explode; paraconsistent retention bounds the contradiction set.
2. **Bounded operation**: No resource dimension grows without bound; budgets enforce global ceilings.
3. **Convergence under pressure**: Under resource exhaustion, the system degrades to a known weaker mode rather than diverging or halting.
4. **No reward-driven belief drift**: The Lyapunov function for belief truth is independent of the reward channel.
5. **Governed self-modification**: The meta-controller's authority is bounded; no self-modification escapes the governance ladder.

---

## §2 — The Plant: Cognitive State Manifold

### 2.1 State Structure

The cognitive state $X$ is a **typed, event-sourced, multi-substrate knowledge manifold**:

$$
X = \langle X_{\text{bel}},\; X_{\text{goal}},\; X_{\text{quest}},\; X_{\text{proc}},\; X_{\text{atten}},\; X_{\text{drive}},\; X_{\text{epis}},\; X_{\text{meta}} \rangle
$$

| Component | Content | Value Structure |
|---|---|---|
| $X_{\text{bel}}$ | Beliefs (what is taken as true) | $(f, c)$ — frequency × confidence |
| $X_{\text{goal}}$ | Goals / desires (what is wanted) | $(d, c)$ — desire × confidence |
| $X_{\text{quest}}$ | Open questions (what is sought) | priority × expected information gain |
| $X_{\text{proc}}$ | Procedural schemas (how-to knowledge) | utility × feasibility × risk |
| $X_{\text{atten}}$ | Attention distribution | priority scalar per concept |
| $X_{\text{drive}}$ | Homeostatic drives | setpoint × current level × decay rate |
| $X_{\text{epis}}$ | Episodic memory (experiences) | temporal sequence with retrieval cues |
| $X_{\text{meta}}$ | Self-model / metacognitive state | analyzer outputs, strategy history |

### 2.2 Memory Architecture

Memory is a **bounded, multi-tier, port-abstracted** structure:

```
┌───────────────────────────────────────────────────────────────┐
│                    MEMORY FABRIC                                │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │   Working    │  │   Episodic    │  │     Semantic      │     │
│  │   (focus     │  │   (temporal   │  │     (long-term    │     │
│  │    bags)     │  │    traces)    │  │      concepts)    │     │
│  └──────┬──────┘  └──────┬───────┘  └────────┬─────────┘     │
│         │                │                     │               │
│         └────────────────┼─────────────────────┘               │
│                          │                                     │
│              ┌───────────┴───────────┐                         │
│              │    NINE TYPED PORTS   │                         │
│              │  ConceptReader        │                         │
│              │  ConceptWriter        │                         │
│              │  TaskAdmission        │                         │
│              │  BeliefTable          │                         │
│              │  GoalEnumeration      │                         │
│              │  LinkPort             │                         │
│              │  StatisticsView       │                         │
│              │  SymbolIndex          │                         │
│              │  MemoryClock          │                         │
│              └───────────────────────┘                         │
│                                                                 │
│  Properties:                                                    │
│  • All bags are bounded (capacity ∈ ℕ)                         │
│  • Decay is decoupled: truth-decay ⊥ attention-decay           │
│  • Eviction: LRU + pressure-driven consolidation               │
│  • Persistence: event log = source of truth; snapshots = cache │
│  • Backends are replaceable behind the port interface           │
└───────────────────────────────────────────────────────────────┘
```

### 2.3 Substrate Isolation

Multiple reasoning substrates coexist under **strict arbitration boundaries**:

| Substrate | Role | Isolation Rule |
|---|---|---|
| Uncertain symbolic (NAL-style) | Core inference: revision, deduction, induction, abduction, analogy | Truth values $(f,c)$; evidence independence enforced |
| Exact computation (equality saturation, rewriting) | Deterministic calculation, type-checked transformation | Never unions nodes on uncertain similarity (H8); results enter as proposals |
| Neural / learned heads | Proposal generation, embedding, calibration | Outputs are untrusted proposals; calibrated before admission |
| Language models | Proposal generation, narration, formalization | Never in the core inference path; always gated; symbolic fallback exists for every function |

**Arbitration invariant**: Substrates exchange **proposals through typed boundaries**, never raw internal state. An exact-computation result enters the uncertain-symbolic substrate as a proposal with source-quality annotation, not as a trusted axiom.

---

## §3 — The Actuator Set: Cognitive Operator Library

### 3.1 Operator Typing

Every cognitive operation is a **typed partial function** with an associated cost vector and provenance stamp:

$$
o \in \mathcal{U} : X \rightharpoonup X \times \mathcal{E}^{*}
$$
$$
\text{cost}(o) \in \mathbb{R}^{+d} \quad \text{(resource cost vector)}
$$
$$
\text{prov}(o) \in \mathcal{E} \quad \text{(provenance stamp)}
$$

### 3.2 Operator Categories

| Category | Examples | Trust Level |
|---|---|---|
| **Perception** | parse, formalize, ground, admit stimulus | Gated at ingress |
| **Attention** | sample, focus, spread activation, prioritize | Internal, budgeted |
| **Retrieval** | recall, associate, search, analogize | Internal, budgeted |
| **Inference** | deduce, induce, abduct, revise, compare, analogize | Core symbolic; trusted |
| **Proposal** | LM generation, reflex suggestion, schema hypothesis | Untrusted; must be judged |
| **Judgment** | calibrate, score, veto, rank, verify | Trusted kernel |
| **Commit** | admit, write, consolidate, persist | Single ledger authority |
| **Action** | tool invocation, environment effect, communication | Risk-classified; authorized |
| **Learning** | parameter update, rule induction, schema promotion | Governed proposals |
| **Forgetting** | decay, evict, consolidate, archive | Internal, budgeted |
| **Meta-control** | strategy select, budget reallocate, graph edit | Governed; hot-swap at boundaries |

### 3.3 Operator Properties

Each operator declaration carries:

```
OperatorSpec {
    id:           OperatorId
    kind:         OperatorKind          // which category
    input_types:  CognitiveType[]       // typed inputs
    output_types: CognitiveType[]       // typed outputs
    cost_vector:  BudgetDimension[]     // resource dimensions consumed
    trust_level:  Trusted | Untrusted   // proposer or kernel
    reversibility: Reversible | Irreversible | Informational
    failure_policy: FailPolicy          // what to do on fault
    budget_scope: BudgetScopeId         // which budget pays
    proof_obligation: ProofObligation?  // what must be verified
}
```

---

## §4 — The Controller: Cognitive Program & Meta-Controller

### 4.1 Control Flow as Data

The control flow is **not a hard-coded sequence**. It is a **conditional directed acyclic graph (DAG)** loaded as data, versioned, revertable, and governable:

```
StageGraph {
    nodes:  StageNode[]
    edges:  StageEdge[]
    entry:  StageId
    exit:   StageId[]
}

StageNode {
    id:            StageId
    operator:      OperatorId           // what runs at this node
    preconditions: Predicate[]          // guards that must hold
    postconditions: Predicate[]         // assertions after execution
    budget_scope:  BudgetScopeId        // which budget pays
    on_failure:    Skip | Abort | Degrade | Fallback
    trace_region:  TraceRegionId        // observability hook
}

StageEdge {
    from:   StageId
    to:     StageId
    when:   Predicate                   // conditional guard
    cost:   BudgetScopeId?              // edge traversal cost
    priority: number                    // for parallel fan-out ordering
}
```

**Key properties of the stage graph**:

- Edges are **conditional**: a transition fires only when its guard predicate holds.
- Nodes are **optional**: stages can be skipped when preconditions fail.
- The graph supports **parallel fan-out** and **synchronization joins**.
- The graph is **inspectable**: every node has a trace region; every edge traversal is logged.
- The graph is **governable**: edits to the graph are meta-control proposals subject to the governance ladder.
- Invariants are **statically checkable**: "no write outside Commit", "no untrusted proposal outside Verify" become graph predicates.

### 4.2 The Cognitive Program

The meta-controller does not select individual operators. It selects a **cognitive program** — a complete control configuration:

```
CognitiveProgram {
    stageGraph:        StageGraph           // the control DAG
    budgetAllocation:  BudgetAllocation      // resource distribution
    proposerPortfolio: Map<ProposerKind, Weight>  // who generates candidates
    verificationPolicy: VerificationPolicy   // how candidates are checked
    autonomyPolicy:    AutonomyPolicy        // action authorization level
    learningPolicy:    LearningPolicy        // what may be learned
    attentionPolicy:   AttentionPolicy       // focus and sampling strategy
}
```

### 4.3 Cognitive Program Portfolio

The system maintains a **portfolio of named cognitive programs**, each suited to different operational contexts:

| Program | Character | When Selected |
|---|---|---|
| **Deliberative** | Deep inference, high proof burden, sequential | Complex questions, high-stakes decisions |
| **Reactive** | Fast reflexes, low latency, minimal judgment | Urgent stimuli, game ticks, safety veto |
| **Curious** | High exploration, question generation, diverse sampling | Low drive satisfaction, novel environments |
| **Conservative** | High rejection threshold, low risk, symbolic-only | Degraded resources, high uncertainty |
| **Creative** | High proposal diversity, sandboxed experimentation | Explicit exploration goals |
| **Social** | Clarification-seeking, human-in-the-loop | Ambiguous input, low confidence |
| **Repair** | Contradiction resolution, test fixing, consistency | Detected incoherence |
| **Consolidating** | Memory decay, schema induction, integration | Low external stimulus, maintenance cycles |

### 4.4 The Meta-Controller

The meta-controller is itself a **bounded reasoner** operating on control-level beliefs and goals:

$$
\Pi_{\text{meta}} : (X,\; e,\; \mathcal{B},\; \text{history}) \;\to\; \text{CognitiveProgram}
$$

**Meta-control beliefs**: "The current control program is producing contradiction rate $r$." "Budget dimension $d$ is at 90% utilization." "Reflex veto frequency exceeds threshold."

**Meta-control goals**: "Reduce contradiction rate below $\theta$." "Rebalance budget toward high-yield derivations." "Switch to consolidation mode."

**Meta-control actions**: Emit a `StageGraphEditProposal` or `BudgetReallocationProposal` — routed through governance, never applied directly.

**Hard constraints on the meta-controller**:

1. **Propose, do not apply**: The meta-controller outputs proposals; the governance pipeline decides.
2. **Hot-swap at boundaries**: Graph edits take effect at cycle boundaries, preserving in-flight counters and detector state.
3. **Bounded authority**: The meta-controller cannot modify the epistemic firewall, the commit ledger interface, or the governance ladder itself.

---

## §5 — Cognitive Transactions: The Unified Commit Authority

### 5.1 The Single Commit Principle

**All durable cognitive mutation passes through one explicit, typed, governable commit surface.** This is the architectural unification that eliminates special-case write paths.

Perception, inference, proposals, learning, actions, consolidation, and self-modification are all instances of the same general class: the **Cognitive Transaction**.

### 5.2 Transaction Type

```
CognitiveTransaction {
    id:              TransactionId
    correlationId:   CorrelationId          // causal threading (§10)
    kind:            TransactionKind        // perception | inference | proposal
                                           // judgment | commit | action | learning
                                           // forgetting | consolidation | simulation
                                           // meta-control | self-modification
    inputs:          CognitiveObject[]      // what is read
    outputs:         Candidate[]            // what is proposed
    effects:         EffectDeclaration[]    // what may be written
    budget:          BudgetReservation      // reserved resources
    capabilities:    CapabilityToken[]      // required permissions
    trust:           TrustProfile           // source quality, calibration
    risk:            RiskProfile            // harm, irreversibility, blast radius
    reversibility:   ReversibilityClass     // informational | reversible | irreversible
    fallback:        FailurePolicy          // degrade | abstain | fallback | abort
    proofObligations: ProofObligation[]     // what must be verified before commit
    epistemicAxis:   Epistemic | Teleological | Procedural  // firewall typing
}
```

### 5.3 The Commit Pipeline

Every transaction traverses the **same pipeline**:

```
Candidate
  → Normalize          (canonical form)
  → Type-Check         (epistemic axis, value structure)
  → Evidence-Independence Check  (no double-counting)
  → Verify             (proof / judge / simulation per policy)
  → Rank               (utility, confidence, priority)
  → Budget Settlement  (deduct actual cost)
  → Risk Classification (trust, reversibility, blast radius)
  → Governance Check   (autonomy ladder, capability tokens)
  → Commit             (append to event log; update state)
    or Reject          (typed rejection event; no silent drop)
```

### 5.4 Commit Invariants

| Invariant | Enforcement |
|---|---|
| Exactly one commit port exists | Architectural; no other write path |
| Every commit produces an event | H3; event log is source of truth |
| Untrusted proposals are verified before commit | H2; verification portfolio |
| Reward signals cannot target belief truth | H1; epistemic axis typing |
| Irreversible actions require authorization | H10; risk classification |
| Budget is settled before commit completes | Resource accounting integrity |
| Rejected candidates produce typed rejection events | H9; no silent drops |

---

## §6 — Epistemic Type System & Firewall

### 6.1 Cognitive Types

| Type | Value Structure | Mutation Authority |
|---|---|---|
| **Belief** | $(f, c)$: frequency × confidence | Evidence only |
| **Goal** | $(d, c)$: desire × confidence | Reward + evidence |
| **Question** | priority × expected information gain | Curiosity drive + evidence |
| **Hypothesis** | plausibility × evidence requirement | Proposal + verification |
| **Assumption** | scope × validity window | Local reasoning context |
| **Plan** | utility × feasibility × risk | Goal progress + simulation |
| **Obligation** | priority × deadline | Normative commitment |
| **Permission** | scope × conditions | Governance policy |
| **ActionIntent** | reversibility × authorization | Risk classification |
| **Lesson** | source × trust × applicability | Learning pipeline |

### 6.2 The Epistemic Firewall

The firewall is a **structural type-system invariant**, not a policy convention:

$$
\text{Reward} \;\nrightarrow\; \text{BeliefTruth}(f, c)
$$
$$
\text{GoalFailure} \;\nrightarrow\; \text{FalseBelief}
$$
$$
\text{Desire} \;\nrightarrow\; \text{Fact}
$$
$$
\text{PlanUtility} \;\neq\; \text{EpistemicTruth}
$$

**Enforcement mechanism**: Every cognitive object carries an `epistemicAxis` tag: `Epistemic | Teleological | Procedural`. The commit pipeline **refuses** any transaction that would write a teleological signal (reward, desire, utility) into an epistemic slot (belief truth values). This refusal is a **runtime type error**, not a policy check.

### 6.3 Truth Algebra

Belief truth values follow an **evidence-sensitive, non-idempotent revision algebra**:

- **Revision** is commutative but not associative (order matters for chains).
- **Confidence** is sub-additive: combining evidence increases confidence by less than the sum.
- **Frequency** is a weighted average pulled toward the more confident source.
- **Contradictions coexist**: $(A \to B)$ and $\neg(A \to B)$ may both reside in memory with distinct truth values. No explosion.
- **Evidence independence** is checked at revision: the same evidence cannot be counted twice through different derivation paths.

---

## §7 — Resource Economics: The Budget Algebra

### 7.1 Budget Dimensions

Resource accounting operates over a **multi-dimensional budget space**:

| Dimension | Unit | Meaning |
|---|---|---|
| `cycles` | count | Control steps |
| `derivations` | count | Symbolic inference steps |
| `premises` | count | Premise selections |
| `memoryOps` | count | Memory reads/writes |
| `modelCalls` | count | Neural/LM invocations |
| `tokens` | count | LM token usage |
| `latency` | ms | Wall-clock time |
| `attention` | slots | Focus allocation |
| `risk` | quota | Safety / irreversibility budget |
| `humanAttention` | count | Approval or clarification cost |

### 7.2 Budget Algebra

Budgets form a **bounded distributive lattice** with economic operations:

| Operation | Symbol | Semantics |
|---|---|---|
| Meet (tighter) | $B_1 \sqcap B_2$ | Grant only if both grant |
| Join (looser) | $B_1 \sqcup B_2$ | Grant if either grants |
| Product (independent) | $B_1 \otimes B_2$ | Independent dimensions |
| Transfer | $\text{transfer}(B_i, B_j, \Delta)$ | Lend surplus from scope $i$ to scope $j$ |
| Reservation | $\text{reserve}(B, \text{cost})$ | Pre-commit resources before execution |
| Settlement | $\text{settle}(B, \text{actual})$ | Reconcile reserved vs. consumed |

### 7.3 Resource Lifecycle

```
1. RESERVE:   Before executing a transaction, the scheduler
              reserves the required budget:
                B_available ← B_available − B_reserved

2. EXECUTE:   The transaction runs within its reservation.

3. SETTLE:    After execution:
                B_settled = B_reserved − B_unused
                B_available ← B_available + B_unused
              (Unused resources are returned.)

4. EXHAUSTION: If reservation fails:
                → Typed exhaustion event (never silent)
                → Backpressure signal to scheduler
                → Degradation or skip per failure policy
```

### 7.4 Pricing and Utility

Operations are priced by **expected marginal utility per scarce resource**:

$$
\text{score}(op) = \frac{\hat{\Delta K} + \hat{\Delta \Gamma} + \hat{\Delta H}}{\lambda_c\, \hat{C} + \lambda_r\, \hat{R} + \lambda_h\, \hat{H}_{\text{human}}}
$$

Where:
- $\hat{\Delta K}$: expected epistemic gain
- $\hat{\Delta \Gamma}$: expected goal progress
- $\hat{\Delta H}$: expected homeostatic improvement
- $\hat{C}$: expected resource cost
- $\hat{R}$: expected risk
- $\hat{H}_{\text{human}}$: expected human attention cost
- $\lambda_c, \lambda_r, \lambda_h$: weighting coefficients

The scheduler selects operations with highest utility-per-resource. Under pressure:

| Pressure Level | Behavior |
|---|---|
| Low | Explore, enrich, elaborate |
| Medium | Prioritize goals and proofs; reduce exploration |
| High | Conserve; degrade to symbolic-only; defer LM calls |
| Critical | Minimal operation; ask for human help only when necessary |

### 7.5 Adaptive Budget Ceilings

Budget ceilings are **not fixed constants**. They adapt as a function of observed throughput and marginal value:

$$
\text{ceiling}(d, t) = f(\text{throughput}(d, t\!-\!1),\; \text{marginal\_value}(d, t\!-\!1),\; \text{global\_pressure}(t))
$$

**Constraint**: Total budget across all scopes is globally bounded (AIKR). Individual scopes may borrow from surplus siblings, but the global ceiling is invariant. Every transfer is event-sourced.

---

## §8 — Governance & Trust Manifold

### 8.1 The Trust/Risk/Reversibility Manifold

Every candidate receives a **governance profile**:

```
GovernanceProfile {
    trust:          [0, 1]     // calibrated source/proposal trust
    confidence:     [0, 1]     // epistemic confidence
    risk:           [0, 1]     // expected harm / irreversibility
    reversibility:  [0, 1]     // ease of rollback
    blastRadius:    [0, 1]     // scope of impact
    proofStatus:    ProofStatus
    judgeStatus:    JudgeStatus
    simulationStatus: SimulationStatus
    autonomyLevel:  AutonomyLevel
}
```

### 8.2 Authorization Policy Surface

The commit path is determined by a **policy surface** over the governance profile:

| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| High | Low | High | Auto-commit |
| High | Medium | High | Shadow-commit, then promote |
| Medium | Low | High | Provisional commit with decay |
| Medium | Medium | Medium | Human review |
| Low | High | Low | Reject |
| Any | High | Low | Strong proof or human approval required |
| Any | Any | Informational | Auto-commit (no state change) |

### 8.3 Autonomy Ladder

| Rung | Authority | Human Role |
|---|---|---|
| 0 — Observe-only | System watches; no mutations | Passive monitoring |
| 1 — Propose-only | System proposes; human decides | Active approval |
| 2 — Sandbox-execute | System executes in isolated sandbox | Post-hoc review |
| 3 — Low-risk auto | System auto-applies low-risk changes | Exception review |
| 4 — Human-approved production | System operates; irreversible changes need approval | Governance board |

### 8.4 Verification Portfolio

Candidates may be verified by multiple independent mechanisms:

| Verifier | What It Checks | Independence |
|---|---|---|
| **Symbolic verifier** | Derivation validity, truth-table agreement | Engine-independent; transcribed rules |
| **Calibrated judge** | Proposal quality, grounding, coherence | Digest-pinned weights; isotonic calibration |
| **Simulator** | Action consequences, plan feasibility | Isolated execution |
| **Shadow executor** | Self-modification patches, config changes | Full CI in isolated worktree |
| **Proof checker** | Formal invariant preservation | Zero engine dependencies |
| **Human approver** | High-risk, irreversible, novel changes | External authority |

**Verifier independence constraint** (H7): The symbolic verifier must not share code with the inference engine. Truth tables are transcribed; drift between engine and verifier is measured and pinned by test.

---

## §9 — Sensory Apparatus: Gates & Admission

### 9.1 Gate Algebra

Gates form an **oriented lattice** of admission morphisms:

$$
g : \text{Candidate} \rightharpoonup \text{Admitted} \cup \text{Rejected} \cup \text{Deferred}
$$

Each gate is either:
- **Interior operator** (contractive, fail-closed): $g(x) \leq x$. Used at **ingress** (untrusted → memory).
- **Closure operator** (extensive, fail-open): $x \leq g(x)$. Used at **egress** (derived → output).

### 9.2 Gate Parameters

```
GateSpec {
    domain:     Ingress | Egress | Cycle | Tool | SelfMod
    judge:      Candidate → Verdict      // symbolic | manifold | human | none
    timeout:    Duration
    fallback:   FailOpen | FailClosed | Degrade(δ)
    vetoSet:    RemoveOnly | AddOnly | Both
    trustBand:  ContinuousTrustField     // soft gating (§9.3)
}
```

### 9.3 Continuous Trust Field

Admission is not binary. A **trust field** computes a continuous score:

$$
T(\text{source},\; \text{content},\; \text{context},\; \text{history}) \;\in\; [0, 1]
$$

Built from: source-quality ceilings, source-reputation multipliers, calibrated judge scores, and isotonic calibration outputs.

Admission bands:

| Band | Action |
|---|---|
| $T > \theta_{\text{act}}$ | Admit and commit |
| $\theta_{\text{review}} < T \leq \theta_{\text{act}}$ | Admit provisionally; flag for review |
| $T \leq \theta_{\text{review}}$ | Reject (ingress) or veto (egress) |
| Ambiguous / abstain | Inject clarification question + curiosity spike |

**Asymmetry preserved**: Ingress defaults to fail-closed (untrusted must not enter unjudged). Egress defaults to fail-open (provider fault must not halt cognition). The asymmetry is a **parameterized default**, not hard-coded branching.

### 9.4 The Proposer/Judge Architecture

All untrusted sources (LMs, reflexes, peers, neural heads) are **proposers**. The trusted kernel is the **judge**.

```
System 1 (Proposers)          System 2 (Judge)
┌─────────────────────┐      ┌─────────────────────┐
│ LM rules            │      │ NAL inference        │
│ Reflex suggestions  │──⊣──│ Judgment manifold    │
│ Peer proposals      │      │ Calibrated scoring   │
│ Schema hypotheses   │      │ Evidence independence│
│ Embedding matches   │      │ NAL veto             │
└─────────────────────┘      └─────────────────────┘
       propose : M → Prop        admit : Prop → M
```

The proposer/judge boundary is an **adjunction**: the judgment manifold measures how much of a proposal survives judgment. Tightening the adjunction → pure symbolic. Loosening → proposer-heavy. This makes "how much do we trust System 1" a **continuous parameter**, not a wiring decision.

---

## §10 — Provenance & Causal Observability

### 10.1 The Correlation Manifold

Every cognitive object carries a **provenance record**:

```
Provenance {
    correlationId:   CorrelationId    // threads stimulus → outcome
    stimulusId:      StimulusId       // originating external input
    sessionId:       SessionId
    cycleId:         CycleId
    transactionId:   TransactionId
    proposerId:      ProposerId       // who generated this
    judgeId:         JudgeId?         // who verified this
    proofId:         ProofId?         // formal proof, if any
    parentId:        ProvenanceId?    // parent in derivation DAG
    budgetScope:     BudgetScopeId    // which budget paid
    failureContext:  FailureContext?  // if degraded or rejected
}
```

### 10.2 Causal DAG

Events form a **causal DAG**, not a flat log:

```
stimulus ──▶ macro-cycle ──▶ micro-cycle N ──▶ transaction T
   │              │               │                 │
   │              │               │           ┌─────┴─────┐
   │              │               │           │           │
   │              │               │      derivation   proposal
   │              │               │           │           │
   │              │               │       judgment    judgment
   │              │               │           │           │
   └──────────────┴───────────────┴───────────┴───────────┘
                        same CorrelationId
```

This enables queries:
- "Which user message caused this belief?"
- "Which derivation led to this action?"
- "Which judge vetoed this candidate?"
- "Which budget exhaustion caused this degradation?"
- "Which learning episode changed this strategy?"

### 10.3 Event Sourcing

The **event log is the source of truth**. Snapshots are caches.

| Property | Specification |
|---|---|
| Log structure | Append-only; ordered; immutable |
| Event types | Typed: perception, inference, proposal, judgment, commit, budget, gate, failure, meta-control, learning |
| Reducers | Pure functions: $\text{fold}(\text{events}) \to X$ |
| Replay | Deterministic: $\text{replay}(\text{log}) \cong X_{\text{current}}$ |
| Verification | State hash after replay must match live state hash |
| Control events | Scheduling, admission, budget, graph-edit decisions are **first-class events** (not hidden in trace shadows) |

### 10.4 Independent Verification

Derivation records carry **step-level premise truths and lineage DAGs**, re-checkable by a standalone verifier with **zero engine dependencies**:

```
DerivationRecord {
    conclusion:    Term
    truthValue:    (f, c)
    premises:      [{term, truthValue}]
    rule:          RuleId
    lineage:       LineageDAG          // capped at depth 16
    stepProof:     StepProof[]         // per-step justification
}
```

The verifier:
- Imports **no engine code** (H7).
- Uses a **transcribed truth table** (pinned by drift test).
- Checks: revision algebra, evidence independence, rule applicability, truth-value bounds.

---

## §11 — The Reflexive Tower: Meta-Control & Governed Adaptation

### 11.1 Levels of Self-Modification

| Level | What Changes | Authority | Governance |
|---|---|---|---|
| L0 | Frozen | None | N/A |
| L1 | Knobs (thresholds, weights) | Auto or proposal | Low risk |
| L2 | Strategy selection (which sampler, which attention model) | Proposal or auto | Medium risk; logged |
| L3 | Rules (symbolic rule induction, schema promotion) | Proposal + proof + shadow | High risk; CI validation |
| L4 | Topology (stage graph edits, budget lattice changes) | Meta-controller proposal + governance | Highest risk; hot-swap at boundary |
| L5 | Constitution (epistemic firewall, commit interface, governance ladder) | **Never self-modifiable** | External only |

### 11.2 Learning as Governed Proposals

All learning operators produce **proposals**, never direct mutations:

| Learning Domain | Mutates | Direct? | Governance |
|---|---|---|---|
| Attention weights | Focus allocation | Sometimes auto | Low risk |
| Strategy selection | Inference behavior | Proposal or auto | Medium risk |
| Parameter tuning | Budgets, thresholds | Proposal | Medium risk |
| Rule induction | Symbolic rules | Proposal | Proof + shadow validation |
| Schema promotion | Procedural → declarative | Proposal | Proof + shadow |
| Patch generation | Code / config | Proposal | CI + approval |
| Governance change | Gates, policies | **Never self-applied** | External governance |
| Reward function | Utility weights | **Never direct** | Human / external approval |

### 11.3 The Governance Pipeline

```
Observation
  → Lesson (distilled correction)
  → Hypothesis (provisional explanation)
  → Strategy Proposal (typed, budgeted, scoped)
  → Shadow Test (isolated execution; full CI)
  → Risk Classification (PatchRiskClassifier)
  → Bounded Deployment (sandbox or low-risk auto)
  → Trace Evaluation (post-deployment monitoring)
  → Retention or Rollback
```

**Invariant**: Learning may propose changes to cognition, but it may not directly rewrite the laws of epistemic commitment (L5).

---

## §12 — Stability, Degradation & Failure Semantics

### 12.1 Homeostatic Drives

The system maintains **homeostatic drives** as reference signals for the control loop:

| Drive | Setpoint | Function |
|---|---|---|
| **Curiosity** | High when novel | Drives exploration, question generation |
| **Competence** | High when capable | Drives skill acquisition, strategy refinement |
| **Coherence** | High when consistent | Drives contradiction resolution, consolidation |
| **Social** | High when connected | Drives clarification, delegation, communication |

Drives decay over time and are replenished by satisfying activities. Drive gaps generate **error signals** that the meta-controller uses to select cognitive programs.

### 12.2 Degradation Ladder

When resources, models, or tools are unavailable, the system degrades **gracefully through known states**:

| Level | Condition | Behavior |
|---|---|---|
| 0 | Full operation | All substrates, all proposers, full judgment |
| 1 | Model unavailable | Symbolic fallback for all LM functions |
| 2 | Budget pressure | Reduce derivation depth; skip low-utility operations |
| 3 | Memory pressure | Aggressive eviction; consolidation; archive |
| 4 | Judgment unavailable | Symbolic-only admission; no manifold scoring |
| 5 | Tool unavailable | Skip tool-dependent stages; continue reasoning |
| 6 | Critical resource exhaustion | Minimal operation; preserve state; alert |
| 7 | Unrecoverable fault | Persist state; emit fault event; halt gracefully |

**Invariant**: Degradation is always **typed and logged**. No silent failure (H9). Every degradation produces a `CognitiveEvent` with the degradation reason.

### 12.3 Failure Policy Map

Every operator and gate carries an explicit failure policy:

| Policy | Semantics | Use Case |
|---|---|---|
| `FailClosed` | On fault, reject / refuse | Ingress gates (safety) |
| `FailOpen` | On fault, admit / continue | Egress, internal cognition (liveness) |
| `Degrade(δ)` | On fault, apply degradation function δ | Judgment → symbolic fallback |
| `Abstain` | On fault, produce no output; inject question | Ambiguous input |
| `Retry(n)` | On fault, retry up to $n$ times | Transient network faults |
| `Escalate` | On fault, escalate to higher authority | Human review trigger |

---

## §13 — Feasibility Constraints: The Laws of the Space

The following constraints define the **valid region** of the design space. Any implementation must satisfy all of them.

| # | Constraint | Rationale |
|---|---|---|
| $\Phi_1$ | Epistemic firewall: Reward $\nrightarrow$ BeliefTruth | Prevents sycophancy, reward hacking (H1) |
| $\Phi_2$ | Untrusted proposal $\Rightarrow$ Judged before commit | Prevents evidence laundering (H2) |
| $\Phi_3$ | State mutation $\Rightarrow$ Event log entry | Auditability by construction (H3) |
| $\Phi_4$ | Self-modification $\Rightarrow$ External or governed arbitration | Prevents Löbian self-approval (H4) |
| $\Phi_5$ | All reasoning paths bounded in time, memory, derivations, model calls | AIKR; prevents runaway (H5) |
| $\Phi_6$ | Scheduler decisions $\Rightarrow$ Inspectable event | Control-plane transparency (H6) |
| $\Phi_7$ | Verifier $\perp$ engine code | Prevents co-adapted bugs (H7) |
| $\Phi_8$ | Exact substrate $\nrightarrow$ union on uncertain similarity | Prevents equality contamination (H8) |
| $\Phi_9$ | Failure $\Rightarrow$ Typed event (never silent) | Observability of faults (H9) |
| $\Phi_{10}$ | Irreversible action $\Rightarrow$ Risk classification + authorization | Safety (H10) |
| $\Phi_{11}$ | AIKR $\Rightarrow$ bounded memory + anytime + forgetting | Resource postulate decomposition |
| $\Phi_{12}$ | Paraconsistent retention $\Rightarrow$ graded truth | Explosion prevention |
| $\Phi_{13}$ | Event-sourced $\Rightarrow$ deterministic replay | Audit reproducibility |
| $\Phi_{14}$ | Anytime $\Rightarrow$ cooperative yield + partial-result contract | Interruptibility guarantee |
| $\Phi_{15}$ | Pressure consolidation $\Rightarrow$ bounded bags everywhere | Memory exhaustion prevention |
| $\Phi_{16}$ | Ampliative inference $\Rightarrow$ graded truth $(f,c)$ or richer | Binary monotonic logic insufficient |
| $\Phi_{17}$ | Meta-controller edits $\Rightarrow$ hot-swap at cycle boundary | In-flight state preservation |
| $\Phi_{18}$ | Budget transfer $\Rightarrow$ total-budget preservation + event-sourced | Resource laundering prevention |

---

## §14 — Instantiation Grammar

### 14.1 Reasoner Specification Schema

A concrete reasoner is instantiated by filling this schema:

```
ReasonerSpec {
    // §2: Plant
    state: {
        substrates:     SubstrateConfig[]
        memoryTiers:    MemoryTierConfig[]
        portBindings:   PortBinding[]
    }

    // §3: Actuators
    operators: {
        symbolic:       RuleTableConfig        // loaded data, versioned
        exact:          ExactEngineConfig       // tool-gated
        neural:         NeuralHeadConfig[]      // digest-pinned
        languageModel:  LMConfig               // proposer-only
    }

    // §4: Controller
    control: {
        stageGraph:     StageGraph              // data-driven DAG
        programPortfolio: CognitiveProgram[]
        metaController: MetaControllerConfig
    }

    // §5: Transactions
    commit: {
        pipeline:       CommitPipelineConfig
        ledger:         EventLogConfig
    }

    // §6: Epistemics
    types: {
        truthAlgebra:   TruthAlgebraConfig      // (f,c) revision
        firewall:       EpistemicFirewallConfig
        beliefGoalSplit: TypeSplitConfig
    }

    // §7: Resources
    budget: {
        dimensions:     BudgetDimension[]
        scopes:         BudgetScopeConfig[]
        pricing:        PricingConfig
        adaptation:     CeilingAdaptationConfig
    }

    // §8: Governance
    governance: {
        trustManifold:  TrustFieldConfig
        riskClassifier: RiskClassifierConfig
        autonomyLadder: AutonomyLadderConfig
        verifiers:      VerifierConfig[]
    }

    // §9: Gates
    gates: {
        ingress:        GateConfig              // fail-closed default
        egress:         GateConfig              // fail-open default
        internal:       GateConfig[]
    }

    // §10: Provenance
    observability: {
        eventLog:       EventLogConfig
        correlation:    CorrelationConfig
        replay:         ReplayConfig
        verifier:       StandaloneVerifierConfig
    }

    // §11: Reflexivity
    adaptation: {
        learningModes:  LearningMode[]
        selfModScope:   SelfModScopeConfig
        governancePipeline: GovernancePipelineConfig
    }

    // §12: Stability
    stability: {
        drives:         DriveConfig[]
        degradation:    DegradationLadderConfig
        failurePolicies: FailurePolicyMap
    }
}
```

### 14.2 Minimal Viable Kernel

The **smallest load-bearing core** that satisfies all feasibility constraints:

| Component | Minimal Form |
|---|---|
| Substrate | One symbolic truth algebra with $(f,c)$ revision |
| Control | One stage graph with $\geq 3$ nodes: perceive → reason → commit |
| Gate | One ingress gate (fail-closed) |
| Budget | One budget dimension with a ceiling |
| Commit | One commit port appending to an event log |
| Firewall | Epistemic axis typing on all objects |
| Verification | One symbolic verifier, engine-independent |

Everything else — drives, multiple substrates, LM proposers, meta-controller, multi-tier memory, economic pricing, autonomy ladder — is **enrichment**: coordinates that can be dialed from "present" to "absent" without leaving the valid region.

### 14.3 Extension Path

The architecture supports **monotone extension** along these axes, each preserving all feasibility constraints:

```
Minimal Kernel
  │
  ├─ Add conditional stage graph edges        [B1: declarative control]
  ├─ Add budget lattice with transfers         [B5: resource economy]
  ├─ Add proposer/judge split                  [B4: hybrid synergy]
  ├─ Add correlation ID threading              [C2: causal observability]
  ├─ Add continuous trust field                [B6: context-sensitive governance]
  ├─ Add cognitive program portfolio           [B2: adaptive scheduling]
  ├─ Add meta-controller (governed)            [C1: governed adaptation]
  ├─ Add multi-tier memory + consolidation     [Cognitive richness]
  ├─ Add homeostatic drives                    [Cognitive richness]
  ├─ Add autonomy ladder + risk manifold       [B6: governance depth]
  ├─ Add learning pipeline (governed)          [C1: governed adaptation]
  └─ Add multi-agent delegation               [Ecological reasoning]
```

Each extension is a **movement through the design space** that preserves $\Phi_1$–$\Phi_{18}$.

---

## §15 — Summary: The Architectural Identity

This specification defines a reasoner as:

> A **bounded, gated, event-sourced, cybernetic controller** whose plant is a typed knowledge manifold, whose actuators are budgeted cognitive operators, whose control flow is a data-driven conditional graph, whose scheduler is a governed meta-controller selecting from a portfolio of cognitive programs, whose every mutation is a typed transaction committed through a single governed ledger, whose resources form an adaptive economic lattice, whose trust is a continuous calibrated field, whose provenance is a causal DAG with independent verification, and whose self-modification is a governed tower of proposals — all bounded, all inspectable, all replayable, all governed.

The architecture is simultaneously:

- **Epistemically safe**: Reward cannot corrupt truth; untrusted proposals cannot enter unjudged.
- **Resource-bounded**: No path is unbounded; budgets adapt but global ceilings hold.
- **Auditably complete**: Every operation is event-sourced, correlated, and independently verifiable.
- **Control-fluid**: Stages, transitions, and scheduling are data, not code.
- **Governed**: All self-modification passes through proposal, shadow, and external arbitration.
- **Degradable**: Every failure has a known, typed, logged degradation path.
- **Modular**: Substrates, schedulers, judges, memory, and governance are replaceable behind typed ports.
- **Elegant**: One transaction type, one commit surface, one governance vocabulary, one resource algebra.

This is the design space not as a taxonomy, but as a **navigable manifold** — and this specification is one deliberately chosen, fully coherent point within it.

---

*End of specification.*
