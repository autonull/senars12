# Ω — The Universal Reasoner Framework

## A Complete, Self-Contained Specification for Bounded, Governed, Adaptive Cognition

---

## §0 — Design Charter

### 0.1 Selected Prime Objectives

| ID | Objective | Role in Ω |
|---|---|---|
| **O1** | Maximum epistemic integrity | Belief/goal firewall, evidence-sensitive truth, paraconsistent retention, calibrated admission |
| **O2** | Auditable causal provenance | Every operation carries correlation/causal IDs; full replay; independent verification |
| **O3** | Control-plane fluidity | Data-driven conditional stage graphs, KAT control words, cognitive DAGs |
| **O4** | Resource economics | Reservations, prices, utility-driven allocation, thermodynamic decay, backpressure |
| **O6** | Governed reflexivity | All adaptation passes through proposal → shadow → governance → bounded deployment |
| **O7** | Neuro-symbolic synergy | Neural/LM/reflex propose; symbolic/NAL/manifold judge, calibrate, veto, commit |
| **O8** | Unified commit ledger | All state mutation uses one governed transaction/commit path |
| **O9** | Compositional configurability | Stages, gates, budgets, strategies, memory, governance are declarative and pluggable |
| **O12** | Formal/mathematical rigor | Algebraic laws, feasibility predicates, typed invariants, verifiable composition |

### 0.2 Hard Constraints (inviolable)

| ID | Constraint |
|---|---|
| **H1** | No reward signal may directly alter belief truth values. |
| **H2** | No untrusted proposal may enter durable memory without judgment or explicit provisional typing. |
| **H3** | No state mutation may occur without an event-log entry. |
| **H4** | No self-modification may be self-approved without external or governed arbitration. |
| **H5** | No reasoning path may be unbounded in memory, time, derivations, or model calls. |
| **H6** | No scheduler decision may be completely opaque; control choices must be inspectable. |
| **H7** | No verifier may share unsafe engine dependencies when checking derivations. |
| **H8** | No exact symbolic/e-graph substrate may union nodes based solely on uncertain similarity. |
| **H9** | No failure may be silently swallowed where it affects cognition, budget, or admission. |
| **H10** | No irreversible action may bypass risk classification and authorization. |

### 0.3 Anti-Goals

| ID | Anti-Goal |
|---|---|
| **A1** | Avoid maximal abstraction before implementation — every layer must have a minimal runnable profile. |
| **A2** | Avoid scheduler opacity — learned/market schedulers must emit inspectable decision events. |
| **A4** | Avoid audit bloat — provenance depth is a configurable axis, not a fixed maximum. |
| **A5** | Avoid monolithic LM authority — language models remain proposers, never core controllers. |

### 0.4 Architectural Character

Ω is biased toward **D3 (Maximum Elegance/Unification)** and **D5 (Maximum Modularity)**, tempered by **D1 (Maximum Auditability)** and **D6 (Maximum Adaptivity)**. The governing principle:

> *One transaction model. One commit surface. One resource algebra. One governance vocabulary. One provenance fabric. Many substrates, many schedulers, many judges — all behind typed ports.*

---

## §1 — Core Ontology: The Seven Irreducible Sorts

Every reasoner, from a single-rule deductive engine to a fully reflexive neuro-symbolic agent, is a configuration drawn from seven sorts. Ω defines each sort as an algebraic structure with a spectrum of possible instantiations.

$$\mathcal{R} = \langle\; \mathcal{S},\; \mathcal{C},\; \mathcal{B},\; \mathcal{G},\; \mathcal{V},\; \mathcal{M},\; \mathcal{P} \;\rangle$$

| Sort | Name | Algebraic Structure | Question It Answers |
|---|---|---|---|
| $\mathcal{S}$ | **Substrate** | Term algebra × rule system × truth carrier | *What exists, and what consequence means* |
| $\mathcal{C}$ | **Control** | KAT expression space over stage generators | *What happens next, and in what order* |
| $\mathcal{B}$ | **Budget** | Ordered commutative monoid with reservation | *What limits change, and how scarcity is allocated* |
| $\mathcal{G}$ | **Governance** | Bounded lattice of oriented gate morphisms | *Who may veto, and under what authority* |
| $\mathcal{V}$ | **Valuation** | Graded evidence algebra with epistemic/teleological split | *How state is scored, and what reward may touch* |
| $\mathcal{M}$ | **Memory** | Bounded comonad with decay, eviction, and port abstraction | *How state persists, degrades, and is accessed* |
| $\mathcal{P}$ | **Provenance** | Free event monoid with causal fold | *What is recorded, correlated, and independently checkable* |

The design space is the constrained product:

$$\mathfrak{D}_\Omega = \mathcal{S} \times_{\Phi} \mathcal{C} \times_{\Phi} \mathcal{B} \times_{\Phi} \mathcal{G} \times_{\Phi} \mathcal{V} \times_{\Phi} \mathcal{M} \times_{\Phi} \mathcal{P}$$

where $\Phi$ is the feasibility predicate (§12). Not every point in the raw product is a coherent reasoner.

---

## §2 — The Cognitive Transaction: Universal Unit of Work

### 2.1 Principle

All cognition — perception, inference, proposal, judgment, learning, action, consolidation, forgetting, self-modification — is a **Cognitive Transaction**. There is no other unit of work. This is the single unifying abstraction of Ω.

### 2.2 Definition

```
CognitiveTransaction ::= {
  id            : TransactionId
  correlationId : CorrelationId          -- causal thread to stimulus
  parentId      : TransactionId?         -- parent in the transaction DAG
  kind          : TransactionKind
  proposer      : ProposerId             -- who generated this
  judge         : JudgeId?               -- who verified this (null = pending)
  inputs        : CognitiveObject[]
  outputs       : Candidate[]
  effects       : EffectDeclaration[]    -- what this transaction may write
  budget        : BudgetReservation
  trust         : TrustProfile
  risk          : RiskProfile
  reversibility : ReversibilityClass
  proofObligations : ProofObligation[]
  failurePolicy : FailurePolicy
  epistemicAxis : EpistemicAxis          -- 'epistemic' | 'teleological' | 'procedural'
  status        : TransactionStatus
}
```

### 2.3 Transaction Kinds

| Kind | Description | Typical Proposer | Typical Judge |
|---|---|---|---|
| `perception` | External stimulus enters the system | Sensor / ingress port | PerceptionGate + manifold |
| `attention` | Focus selection, priority adjustment | Scheduler | Budget gate |
| `inference` | Symbolic derivation (NAL, exact, probabilistic) | Rule engine | Schema verifier |
| `proposal` | Candidate generated by untrusted source | LM / reflex / peer | Judgment manifold + symbolic verifier |
| `judgment` | Scoring, calibration, veto decision | Manifold / verifier | Meta-gate |
| `commit` | Durable state mutation | Commit ledger | Governance predicate |
| `action` | External effect via tool or actuator | Planner | ActionGate + risk classifier |
| `learning` | Parameter update, rule induction, schema promotion | RLFP / schema inductor | Governance + shadow validation |
| `forgetting` | Decay, eviction, archival | Memory manager | Budget pressure signal |
| `consolidation` | Episodic merge, sleep-like integration | Consolidation scheduler | Budget + memory gate |
| `simulation` | Internal model run, imagination, planning | World model | Sandbox boundary |
| `self-modification` | Patch to strategy, rules, code, or architecture | Meta-controller | External governance pipeline |
| `meta-control` | Control-word edit, budget reallocation, graph reshape | Deliberative meta-controller | Governance + cycle-boundary hot-swap |

### 2.4 Transaction Lifecycle

Every transaction follows the same governed path:

```
Propose → Normalize → TypeCheck → EpistemicAxisCheck
  → BudgetReservation → ProofObligationCheck
  → Judge/Verify/Simulate → Rank
  → RiskClassify → GovernanceGate
  → Commit | Reject | Defer | Degrade
```

No transaction bypasses any stage. Stages may be configured to trivially pass (e.g., `TypeCheck` for a fully typed substrate), but they are never absent.

### 2.5 Epistemic Axis Enforcement

Every transaction carries an `epistemicAxis` tag. The commit ledger enforces:

$$\text{Reward} \nrightarrow \text{BeliefTruth}$$
$$\text{GoalFailure} \nrightarrow \text{FalseBelief}$$
$$\text{Desire} \nrightarrow \text{Fact}$$
$$\text{PlanUtility} \neq \text{EpistemicTruth}$$

A transaction tagged `teleological` can never write to a `belief` slot. A transaction tagged `epistemic` can never mutate a `goal`'s desire value. This is a type-level invariant, not a policy.

---

## §3 — The Control Algebra: KAT, Stage Graphs, and Control Words

### 3.1 Principle

Control flow is **data**, not code. The sequencing of cognitive operations is expressed as a **Kleene Algebra with Tests (KAT)** expression — a composable, inspectable, replayable, and governable control word $\kappa$.

### 3.2 KAT Primitives

| Operation | Symbol | Meaning |
|---|---|---|
| Sequence | $p \cdot q$ | Execute $p$ then $q$ |
| Choice | $p + q$ | Execute $p$ or $q$ (guard selects) |
| Iteration | $p^*$ | Repeat $p$ zero or more times |
| Test / Guard | $b?$ | Proceed only if predicate $b$ holds |
| Skip | $1$ | Identity (no-op) |
| Parallel | $p \parallel q$ | Execute concurrently, join at synchronization point |

### 3.3 Stage Generators

Each cognitive stage is a generator in the KAT algebra:

$$\Sigma_{\text{stages}} = \{ \mathsf{perceive},\; \mathsf{attend},\; \mathsf{retrieve},\; \mathsf{infer},\; \mathsf{propose},\; \mathsf{verify},\; \mathsf{rank},\; \mathsf{commit},\; \mathsf{plan},\; \mathsf{act},\; \mathsf{learn},\; \mathsf{consolidate},\; \mathsf{forget},\; \mathsf{simulate},\; \mathsf{metapropose} \}$$

This vocabulary is a **superset registry**. Any particular reasoner configuration selects a subset and composes them into a control word.

### 3.4 Control Word as Data

A control word $\kappa$ is a first-class value:

```
ControlWord ::= {
  expression  : KATExpression        -- the KAT term
  stageGraph  : ConditionalDAG       -- compiled graph representation
  budgetMap   : Map<StageId, BudgetScopeId>
  gateMap     : Map<StageId, GateId[]>
  invariants  : GraphPredicate[]     -- e.g., "no path infer →* act without verify"
  version     : VersionId
  provenance  : TransactionId        -- the meta-control transaction that produced this
}
```

### 3.5 Example Control Words

**Minimal deductive loop:**
$$\kappa_{\text{deduce}} = (\mathsf{retrieve} \cdot \mathsf{infer} \cdot \mathsf{commit})^*$$

**Full neuro-symbolic cycle:**
$$\kappa_{\text{full}} = \mathsf{perceive} \cdot \mathsf{attend} \cdot (\mathsf{hasWork}? \cdot \mathsf{infer} \cdot \mathsf{verify} \cdot \mathsf{rank} \cdot \mathsf{commit}) \cdot (\mathsf{hasProposer}? \cdot \mathsf{propose} + \neg\mathsf{hasProposer}? \cdot 1) \cdot (\mathsf{due}? \cdot \mathsf{learn})^*$$

**Parallel foci with synchronization:**
$$\kappa_{\text{parallel}} = \mathsf{attend} \cdot (\mathsf{infer}_{\text{belief}} \parallel \mathsf{infer}_{\text{goal}}) \cdot \mathsf{join} \cdot \mathsf{commit}$$

**Reflex arc (sub-cycle interrupt):**
$$\kappa_{\text{reflex}} = \mathsf{perceive} \cdot (\mathsf{danger}? \cdot \mathsf{act}_{\text{veto}} + 1) \cdot \mathsf{propose}_{\text{fast}}$$

### 3.6 Conditional Stage Graph

The KAT expression compiles to a **Conditional DAG**:

```
StageGraph ::= {
  nodes : StageNode[]
  edges : StageEdge[]
}

StageNode ::= {
  id            : StageId
  run           : Middleware<CycleContext>   -- the stage handler
  budget        : BudgetScopeId
  gates         : GateId[]
  preconditions : Predicate[]
  postconditions : Predicate[]
  failurePolicy : FailurePolicy
}

StageEdge ::= {
  from  : StageId
  to    : StageId
  guard : (ctx: CycleContext) => boolean   -- conditional traversal
  cost  : BudgetScopeId?                   -- edge may charge a scope
}
```

### 3.7 Graph Invariants as Static Predicates

The stage graph carries compile-time-checkable invariants:

| Invariant | Formal Statement |
|---|---|
| No unverified write | $\nexists$ path $s \to^* \mathsf{commit}$ without passing $\mathsf{verify}$ |
| No nested proposal in inference | $\nexists$ path $\mathsf{infer} \to^* \mathsf{propose}$ within a single inference scope |
| No untrusted commit | $\forall$ path to $\mathsf{commit}$: proposer is trusted OR judge has scored |
| No reward → truth | $\nexists$ edge from a `teleological` stage to a `belief`-writing stage |
| Budget coverage | $\forall$ node $n$: $\mathsf{budget}(n) \neq \bot$ |
| Gate coverage | $\forall$ node $n$ with $\mathsf{kind} \in \{\mathsf{commit}, \mathsf{act}\}$: $\mathsf{gates}(n) \neq \emptyset$ |

These replace ad-hoc CI checks with structural properties of the control word itself.

### 3.8 Control Word Governance

Control words are themselves **Cognitive Transactions** of kind `meta-control`. They are proposed, judged, and committed through the same ledger as any other mutation. A control-word edit:

1. Is proposed by the meta-controller (§14)
2. Carries a `BudgetReservation` for the graph edit
3. Passes `GraphInvariantCheck`
4. Is routed through the governance pipeline based on risk
5. Is installed at a **cycle boundary** (hot-swap, not rebuild)
6. Preserves in-flight state (counters, circular-detector, derivation context)
7. Is event-sourced with full correlation

---

## §4 — The Commit Ledger: Single Commit Authority

### 4.1 Principle

There is exactly **one commit surface**. Every durable state mutation — perception, derivation, proposal, learning, action, self-modification — passes through the same typed, governed, event-sourced commit ledger.

### 4.2 Commit Pipeline

```
Candidate
  → Normalize           -- canonical form, interning
  → TypeCheck           -- schema validation, epistemic axis
  → EvidenceCheck       -- independence, lineage, double-count prevention
  → ProofObligation     -- formal proof, judge score, simulation result
  → Rank                -- utility × confidence × priority
  → BudgetSettle        -- deduct reserved resources, release unused
  → RiskClassify        -- reversibility, blast radius, irreversibility
  → GovernanceGate      -- autonomy level, approval requirement
  → Commit | Reject | Defer | ProvisionalCommit
```

### 4.3 Commit Modes

| Mode | Condition | Behavior |
|---|---|---|
| **Commit** | All obligations satisfied, risk ≤ threshold | Durable write, event logged |
| **ProvisionalCommit** | Medium trust, low risk | Written with decay timer; promoted or expired |
| **ShadowCommit** | Self-modification, high risk | Applied to shadow copy; promoted after validation |
| **Defer** | Budget exhausted, judgment unavailable | Queued with expiry; retried when resources available |
| **Reject** | Proof failed, veto, firewall violation | Rejected with typed reason; event logged |
| **Degrade** | Judge unavailable, fallback active | Committed with reduced confidence; flagged for re-judgment |

### 4.4 The Single Write Invariant

$$\exists!\; \mathsf{commit} : \mathsf{Candidate} \to \mathsf{State}$$

No other path writes to durable memory. The commit ledger is the **only** mutation surface. This is enforced architecturally: memory ports expose read interfaces broadly but write interfaces only to the commit ledger.

### 4.5 Event-Sourced Fold

State is reconstructed by folding the event log:

$$\mathsf{State}(t) = \mathsf{fold}(\mathsf{events}_{0..t},\; \mathsf{State}_0)$$

where `fold` is a pure, deterministic reducer. Snapshots are caches; the event log is the source of truth.

---

## §5 — The Resource Economy

### 5.1 Principle

Computation is a **scarce, allocatable resource**. Ω replaces fixed counters with a layered resource economy: hard ceilings → reservations → utility-based pricing → thermodynamic decay.

### 5.2 Budget Algebra

The budget system is an ordered commutative monoid with reservation:

$$(\mathcal{B},\; +,\; 0,\; \leq,\; \mathsf{reserve},\; \mathsf{settle},\; \lceil \cdot \rceil)$$

| Operation | Semantics |
|---|---|
| $+$ | Consumption accumulation (commutative, associative) |
| $0$ | No consumption |
| $\leq$ | "Fits within" relation |
| $\lceil b \rceil$ | Ceiling function (maximum allowed) |
| $\mathsf{reserve}(b, r)$ | Deduct reservation $r$ from available $b$; fail if insufficient |
| $\mathsf{settle}(b, r, \text{used})$ | Release $r - \text{used}$ back to available |

### 5.3 Budget Dimensions

Each dimension is an independent axis of consumption:

| Dimension | Unit | Typical Ceiling |
|---|---|---|
| `cycles` | Control steps | Per-cycle + lifetime |
| `derivations` | Symbolic inference steps | Per-cycle |
| `premises` | Premise selections | Per-cycle |
| `memoryOps` | Memory reads/writes | Per-cycle + lifetime |
| `modelCalls` | Neural/LM invocations | Per-cycle + lifetime |
| `tokens` | LM token usage | Per-call + lifetime |
| `latency` | Wall-clock time | Per-transaction |
| `attention` | Focus slots | Per-cycle |
| `risk` | Safety/irreversibility quota | Per-session |
| `humanAttention` | Approval/clarification cost | Per-session |

### 5.4 Budget Scopes and Lattice

Scopes form a **bounded distributive lattice**:

$$\mathcal{B}_{\text{scopes}} = (\mathcal{B},\; \sqcap,\; \sqcup,\; \otimes,\; \neg)$$

| Operation | Semantics |
|---|---|
| $B_1 \sqcap B_2$ | Meet: grant only if both grant (tighter) |
| $B_1 \sqcup B_2$ | Join: grant if either grants (looser) |
| $B_1 \otimes B_2$ | Product: independent dimensions |
| $\mathsf{transfer}(B_i, B_j, \Delta)$ | Lend surplus from $B_i$ to $B_j$; total preserved |
| $\mathsf{derive}(B_{\text{child}} \sqsubseteq B_{\text{parent}})$ | Child inherits parent's dimensions except its own |

### 5.5 Reservation Protocol

Before executing a transaction, the scheduler **reserves** resources:

$$B_{\text{available}} \leftarrow B_{\text{available}} - B_{\text{reserved}}$$

After execution:

$$B_{\text{settled}} = B_{\text{reserved}} - B_{\text{unused}}$$

This prevents silent starvation and enables typed backpressure: a denied reservation is a **typed event**, not a silent drop.

### 5.6 Utility-Based Scheduling

The scheduler ranks enabled transactions by expected utility per scarce resource:

$$\mathsf{score}(\tau) = \frac{\hat{\Delta}K + \hat{\Delta}G + \hat{\Delta}H}{\lambda_c \hat{C} + \lambda_r \hat{R} + \lambda_h \hat{H}_{\text{human}}}$$

where:
- $\hat{\Delta}K$ = expected epistemic gain (uncertainty reduction, contradiction resolution)
- $\hat{\Delta}G$ = expected teleological gain (goal progress)
- $\hat{\Delta}H$ = expected homeostatic gain (drive balance, coherence)
- $\hat{C}$ = expected resource cost
- $\hat{R}$ = expected risk
- $\hat{H}_{\text{human}}$ = expected human attention cost
- $\lambda_c, \lambda_r, \lambda_h$ = tunable scarcity weights

### 5.7 Thermodynamic Extension (Optional Layer)

For configurations that prefer continuous allocation over discrete budgets, Ω supports a **thermodynamic model**:

- Every task has an **activation energy** $E$ based on surprise × utility
- The system has a global **cognitive temperature** $T$
- Probability of pursuing a derivation: $P \propto \exp(-\Delta E / T)$
- High $T$ → exploration; Low $T$ → exploitation
- Total energy pool is bounded (AIKR preserved)

This is an **optional refinement** of the budget algebra, not a replacement. The hard ceiling $\lceil \cdot \rceil$ remains; thermodynamics governs allocation within the ceiling.

### 5.8 Graceful Degradation Under Pressure

| Pressure Level | Behavior |
|---|---|
| Low | Explore, enrich, elaborate; all proposers active |
| Medium | Prioritize goals and proofs; reduce proposal diversity |
| High | Conserve; degrade to symbolic-only; defer non-critical learning |
| Critical | Halt all non-essential work; emit typed starvation events; request human help only when necessary |

---

## §6 — The Trust Manifold

### 6.1 Principle

Trust is not binary. It is a **continuous, multi-dimensional field** that determines the required judgment depth, commit path, and governance level for every transaction.

### 6.2 Trust Profile

```
TrustProfile ::= {
  sourceQuality    : Float          -- tiered source table (PRIMARY=0.9, LLM_PRIOR=0.5, ...)
  sourceReputation : Float          -- per-source learned multiplier (floor 0.5)
  claimSpecificity : Float          -- how specific/falsifiable the claim is
  corroboration    : Float          -- independent evidence supporting this claim
  calibratedScore  : Float?         -- manifold head output (isotonic calibrated)
  judgeStatus      : JudgeStatus    -- {pending, scored, vetoed, abstained}
  proofStatus      : ProofStatus    -- {none, schema, step-proof, formal}
  digestPinned     : Boolean        -- model weights hash-verified
}
```

### 6.3 Admission as Soft Gate

Admission is a function of the trust field, not a binary branch:

$$T(\text{source}, \text{content}, \text{context}, \text{history}) \in [0, 1]$$

Three admission bands:

| Band | Condition | Action |
|---|---|---|
| **Act** | $T \geq \theta_{\text{act}}$ | Commit directly |
| **Review** | $\theta_{\text{defer}} \leq T < \theta_{\text{act}}$ | Provisional commit with decay; flagged for re-judgment |
| **Block** | $T < \theta_{\text{defer}}$ | Reject or abstain → clarification question |

### 6.4 Gate Orientation

Every gate is an **oriented** morphism:

| Orientation | Semantics | Failure Behavior |
|---|---|---|
| **Interior** (fail-closed) | Contractive: $g(x) \leq x$. Only admits a subset. | On fault → refuse |
| **Closure** (fail-open) | Extensive: $x \leq g(x)$. Does not remove. | On fault → admit with degraded flag |

The ingress/egress asymmetry is a **parameterized default**, not hard-coded:

$$\alpha(\text{gate}) = (\text{ingress\_orientation},\; \text{egress\_orientation})$$

Default: $\alpha = (\text{interior},\; \text{closure})$ — strict in, permissive out. Configurable per deployment.

### 6.5 Gate Composition

Gates compose as a monoid:

| Operation | Semantics |
|---|---|
| $G_1 \circ G_2$ | Serial: admit only if both admit |
| $G_1 \parallel G_2$ | Parallel: admit if both admit (concurrent evaluation) |
| $G_1 \oplus G_2$ | Voting: admit if weighted majority admits |
| $G_1 \triangleright G_2$ | Fallback: try $G_1$; on fault, try $G_2$ |
| $\neg G$ | Complement: admit iff $G$ refuses |

### 6.6 Judgment Manifold

The judgment layer is a **calibrated ensemble**:

- Multiple heads (symbolic, manifold, reflex, peer) score each proposal
- Isotonic calibration maps raw scores to calibrated probabilities
- Model digests (SHA256 of weights) are pinned; mismatch → fail-closed
- Abstention → clarification question + curiosity drive spike
- Every judgment decision is a `CognitiveTransaction` of kind `judgment`

---

## §7 — The Epistemic Type System

### 7.1 Cognitive Attitudes

Ω defines a rich type system for cognitive attitudes:

| Type | Value Structure | Mutation Authority |
|---|---|---|
| **Belief** | $(f, c)$ — frequency × confidence | Evidence only |
| **Goal** | $(d, c)$ — desire × confidence | Reward + evidence |
| **Question** | priority × expected information gain | Scheduler + curiosity drive |
| **Hypothesis** | plausibility × evidence requirement | Inference + proposal |
| **Assumption** | scope × validity window | Local reasoning context |
| **Plan** | utility × feasibility × risk | Planner + simulator |
| **Obligation** | priority × deadline | Governance + commitment |
| **Permission** | scope × conditions | Governance only |
| **ActionIntent** | reversibility × authorization | ActionGate + risk classifier |
| **Lesson** | source × trust × applicability | Learning + distillation |

### 7.2 The Epistemic Firewall

The firewall is a **structural invariant of the type system**, not a policy:

$$\text{Reward} \nrightarrow \text{BeliefTruth}$$
$$\text{GoalFailure} \nrightarrow \text{FalseBelief}$$
$$\text{Desire} \nrightarrow \text{Fact}$$

Enforcement: the commit ledger checks the `epistemicAxis` tag of every transaction. A transaction tagged `teleological` attempting to write to a `belief` slot is **rejected at the type level**, before any judgment or scoring occurs.

### 7.3 Paraconsistent Retention

Contradictions are **retained with distinct truth values**:

$$(A \to B) \text{ and } \neg(A \to B) \text{ coexist with separate } (f, c) \text{ pairs}$$

No explosion. No forced resolution. Query results are **graded**, not collapsed. Resolution is a cognitive task, not a structural requirement.

### 7.4 Evidence Independence

Revision requires an **independence check**: two pieces of evidence may be combined only if they do not share a common ancestor in the evidence lineage DAG. Lineage depth is bounded (configurable cap). This prevents evidence laundering.

---

## §8 — The Provenance Fabric

### 8.1 Principle

Provenance is not logging. It is a **causal fabric** woven into every operation. Every cognitive event carries a correlation ID that threads it to its stimulus, its cycle, its transaction, its proposer, its judge, and its resource context.

### 8.2 Correlation Threading

```
Provenance ::= {
  correlationId  : CorrelationId    -- minted at stimulus entry
  stimulusId     : StimulusId       -- the originating input
  sessionId      : SessionId
  cycleId        : CycleId          -- which control cycle
  transactionId  : TransactionId    -- which cognitive transaction
  proposerId     : ProposerId       -- who generated this
  judgeId        : JudgeId?         -- who verified this
  proofId        : ProofId?         -- formal proof reference
  parentId       : ProvenanceId?   -- parent event in the causal DAG
  budgetScopeId  : BudgetScopeId?  -- which scope paid for this
}
```

### 8.3 Event Sourcing

All events are appended to an **append-only log**:

$$\mathsf{EventLog} : \mathbb{N} \to \mathsf{CognitiveEvent}$$

The log is the source of truth. Snapshots are caches. State is reconstructed by folding:

$$\mathsf{replay}(\mathsf{log}) \cong \mathsf{State}$$

### 8.4 Independent Verification

The verifier is **code-independent** of the engine:

- The truth table is **transcribed**, not imported
- The verifier imports no engine algebra
- Drift between engine and verifier is **measured by test**, not assumed zero
- The verifier can re-derive any conclusion from its derivation record without running the engine

### 8.5 Causal Queries

The provenance fabric supports:

| Query | Answer |
|---|---|
| Which stimulus caused this belief? | Trace `correlationId` back to `stimulusId` |
| Which derivation led to this action? | Trace `parentId` chain through transaction DAG |
| Which judge vetoed this candidate? | `judgeId` + `vetoEvent` |
| Which budget exhaustion caused this degradation? | `budgetScopeId` + `starvationEvent` |
| Which learning episode changed this strategy? | `transactionId` of kind `learning` + `parentId` |
| Which control-word edit changed this cycle's behavior? | `transactionId` of kind `meta-control` + `graphVersion` |

### 8.6 Provenance Depth as Configurable Axis

Provenance depth is not fixed at maximum. It is a configurable axis:

| Level | What Is Recorded |
|---|---|
| 0 | None (ephemeral) |
| 1 | Final answers only |
| 2 | Derivation conclusions |
| 3 | Step-level derivation traces |
| 4 | Full event-sourced log + independent verifier + hash-verified replay |
| 5 | Level 4 + control-plane events (scheduler decisions, budget transfers, graph edits) |

Higher levels cost more storage and throughput. The configuration selects the appropriate level.

---

## §9 — The Reflexive Tower

### 9.1 Principle

Self-modification is a **tower of increasing authority**, where each level governs the one below with strictly bounded, decreasing authority. The tower is governed at every rung.

### 9.2 Tower Levels

| Level | Scope | Authority | Governance |
|---|---|---|---|
| **L0** | Frozen | No self-modification | N/A |
| **L1** | Knobs | Parameter tuning (thresholds, weights) | Auto-applied within bounds |
| **L2** | Strategies | Strategy selection, sampling policy | Proposal → shadow → auto-apply if low-risk |
| **L3** | Rules | Rule induction, rule promotion, rule retirement | Proposal → proof → shadow → governance |
| **L4** | Control Graph | Stage graph edits, budget reallocation, scheduler changes | Proposal → invariant check → governance → cycle-boundary hot-swap |
| **L5** | Code | Source-code patches, architecture mutations | Proposal → shadow worktree → full CI → external approval → merge |
| **L6** | Constitution | Governance rules, firewall axioms, budget ceilings | **Never self-applied.** External immutable authority only. |

### 9.3 The Self-Modification Invariant

$$\text{Learning may propose changes to cognition, but it may not directly rewrite the laws of epistemic commitment.}$$

Specifically:
- The epistemic firewall (H1) is at L6 — never self-modifiable
- The commit ledger structure (H3) is at L6
- The budget ceiling existence (H5) is at L6
- The verifier independence requirement (H7) is at L6
- Everything else is modifiable at its appropriate level, subject to governance

### 9.4 Governed Self-Modification Pipeline

```
Observation
  → Lesson (distilled correction)
  → Hypothesis (explanatory candidate)
  → Strategy/Rules/Code Proposal
  → Shadow Execution (worktree, sandbox, simulation)
  → Validation (CI, proof, benchmark, drift test)
  → Risk Classification
  → Governance Gate (autonomy level)
  → Bounded Deployment
  → Trace Evaluation
  → Retention | Rollback
```

### 9.5 External Governance Requirement

At L5 and above, an **external, immutable authority** is required:

- The system cannot approve its own code patches
- The system cannot modify its own approval manager
- The system cannot edit its own reward function
- The system cannot disable its own safety gates

This is enforced architecturally: the approval manager, risk classifier, and guard-rail files are outside the system's write scope.

---

## §10 — The Substrate Arbitration Layer

### 10.1 Principle

Ω supports **multiple reasoning substrates** simultaneously: symbolic (NAL), exact (rewriting/e-graphs), probabilistic, neural, heuristic. These substrates coexist but are **arbitrated** through explicit boundaries that prevent semantic contamination.

### 10.2 Substrate Types

| Substrate | Truth Carrier | Inference Mechanism | Role in Ω |
|---|---|---|---|
| **Symbolic (NAL)** | $(f, c)$ pairs | 44+ rule declarations, non-axiomatic syllogistic | Core reasoning, belief/goal management |
| **Exact (Rewriting)** | Boolean / proof term | Equality saturation, e-graphs, dependent types | Precise computation, formal verification |
| **Probabilistic** | $P \in [0,1]$ | Bayesian update, marginalization | Uncertain inference under known models |
| **Neural / LM** | Implicit (embedding) | Generation, pattern completion | Proposal generation, narration, judgment heads |
| **Heuristic / Reflex** | Scalar reward | Tabular Q, ε-greedy, UCB | Fast reactions, game play, low-latency responses |

### 10.3 The Arbitration Invariant

**Substrates never share memory directly.** They exchange **proposals** through typed ports:

$$\text{Substrate}_i \xrightarrow{\text{proposal}} \text{Arbitration Layer} \xrightarrow{\text{judged}} \text{Commit Ledger}$$

Specifically:
- An e-graph **never** unions nodes based on uncertain similarity scores (H8)
- A neural head **never** writes directly to the belief store
- A probabilistic inference **never** overwrites a symbolic derivation without going through the commit ledger
- An LM output **never** enters the cycle path without judgment

### 10.4 Substrate Coupling Modes

| Mode | Description | Use Case |
|---|---|---|
| **Isolated** | Substrates run independently; no interaction | Maximum safety; formal verification |
| **Arbited** | Substrates exchange proposals through a boundary; no shared memory | Default mode; NAL + MeTTa |
| **Federated** | Substrates share a common event log but maintain separate state | Multi-agent; peer delegation |
| **Fused** | Substrates share state (forbidden for exact + uncertain) | Only for same-class substrates |

### 10.5 The Proposer/Judge Adjunction

The neuro-symbolic boundary is an **adjunction**:

$$\mathsf{propose} \dashv \mathsf{admit}$$

- **Propose** (System 1): LM, reflex, peer → generates candidates
- **Admit** (System 2): NAL, manifold, verifier → judges, calibrates, vetoes, commits

The **Judgment Manifold** is the (co)unit: it measures how much of a proposal survives judgment. Tightening the adjunction → pure symbolic. Loosening it → neural-heavy. This makes "how much do we trust System 1" a **continuous parameter**, not a wiring decision.

---

## §11 — The Memory Architecture

### 11.1 Principle

Memory is a **bounded comonad** with decay, eviction, and port abstraction. All memory access goes through typed ports; the commit ledger is the only write path.

### 11.2 Memory Structure

```
Memory ::= {
  store       : BoundedBag<Term, TruthValue, Metadata>
  concepts    : ConceptGraph          -- term → concept links
  episodic    : EpisodicStore         -- time-indexed experiences
  working     : WorkingMemory         -- active focus contents
  procedural  : ProceduralStore       -- learned skills, schemas
  ports       : MemoryPorts           -- typed access interfaces
}
```

### 11.3 Memory Ports

All cycle-path access goes through **named ports**, not direct memory references:

| Port | Interface |
|---|---|
| `ConceptReader` | Read concepts, links, truth values |
| `ConceptWriter` | Write concepts (commit ledger only) |
| `TaskAdmission` | Admit tasks into the cycle |
| `BeliefTable` | Query beliefs by term |
| `GoalEnumeration` | Enumerate active goals |
| `LinkPort` | Read/write concept links |
| `StatisticsView` | Read memory statistics |
| `SymbolIndex` | Term → symbol lookup |
| `MemoryClock` | Timestamps, decay scheduling |
| `AttentionOwner` | Attention model installation |

### 11.4 Decay and Forgetting

| Mechanism | Trigger | Effect |
|---|---|---|
| **Priority decay** | LRU / access pattern | Reduces attention priority; does not affect truth |
| **Truth decay** | Temporal invalidation / contradiction | Reduces confidence; only on evidence change |
| **Eviction** | Bag over capacity | Removes lowest-priority items |
| **Consolidation** | Memory pressure | Merges episodic → semantic; compresses |
| **Archival** | Long-term inactivity | Moves to cold storage; retrievable |
| **Forgetting** | Explicit policy or pressure | Permanent removal; event-logged |

**Critical invariant:** Truth decay and attention decay are **decoupled**. A belief's truth value changes only on evidence invalidation, never on access patterns. Attention priority changes on access, never on evidence.

### 11.5 Bounded Bags

All memory containers are **bounded priority bags**:

$$\text{Bag}(T) = \langle \text{items}: T^*,\; \text{capacity}: \mathbb{N},\; \text{priority}: T \to [0,1] \rangle$$

Operations: `add`, `sample` (probabilistic by priority), `decay`, `evict`. No unbounded accumulators exist.

---

## §12 — The Feasibility Predicate Φ

### 12.1 Principle

Not every combination of sort values produces a coherent reasoner. The feasibility predicate $\Phi$ defines the **legal region** of the design space. A configuration $r$ is valid iff $\Phi(r) = \text{true}$.

### 12.2 Hard Feasibility Laws

| # | Law | Formal Statement | Rationale |
|---|---|---|---|
| Φ1 | AIKR requires bounded memory | $\mathcal{B}.\text{postulate} = \text{AIKR} \Rightarrow \mathcal{M}.\text{capacity} < \infty$ | Unbounded growth under bounded resources is incoherent |
| Φ2 | Ampliative inference requires graded truth | $\mathcal{S}.\text{rules} \supseteq \{\text{induction, abduction}\} \Rightarrow \mathcal{V}.\text{carrier} \geq (f,c)$ | Binary truth cannot represent uncertain ampliative conclusions |
| Φ3 | Untrusted proposers require gates | $\mathcal{S}.\text{proposers} \supseteq \{\text{stochastic}\} \Rightarrow \mathcal{G}.\text{gates} \neq \emptyset$ | Unjudged untrusted input = evidence laundering |
| Φ4 | Reward learning requires firewall | $\mathcal{P}.\text{learning} \supseteq \{\text{reward}\} \Rightarrow \mathcal{V}.\text{firewall} = \text{structural}$ | Reward without firewall = belief corruption |
| Φ5 | Self-modification requires governance | $\mathcal{P}.\text{selfmod} \geq \text{rules} \Rightarrow \mathcal{G}.\text{governance} \geq \text{shadow+CI}$ | Ungoverned self-mod = uncontainable |
| Φ6 | Code self-mod requires external approval | $\mathcal{P}.\text{selfmod} = \text{code} \Rightarrow \mathcal{G}.\text{governance} \geq \text{external}$ | Self-approval is unsound (Löbian) |
| Φ7 | Event sourcing requires replay | $\mathcal{P}.\text{provenance} \geq \text{event-sourced} \Rightarrow \mathcal{P}.\text{replay} \geq \text{deterministic}$ | Log without replay is just noise |
| Φ8 | Independent verifier requires transcription | $\mathcal{P}.\text{verifier} = \text{standalone} \Rightarrow \text{truth table transcribed, not imported}$ | Shared code = shared bugs |
| Φ9 | Paraconsistency requires non-monotonic logic | $\mathcal{V}.\text{contradiction} = \text{retained} \Rightarrow \mathcal{S}.\text{monotonic} = \text{false}$ | Monotonic + contradiction = explosion |
| Φ10 | Exact substrate isolation | $\mathcal{S}.\text{exact} \neq \bot \;\wedge\; \mathcal{S}.\text{uncertain} \neq \bot \Rightarrow \text{memory isolation}$ | E-graph union on similarity = equality contamination |
| Φ11 | Anytime requires preemptive scheduler | $\mathcal{B}.\text{execution} = \text{anytime} \Rightarrow \mathcal{C}.\text{scheduler} \in \{\text{priority, economic, learned}\}$ | FIFO cannot preempt |
| Φ12 | Adaptive budgets require event-sourced decisions | $\mathcal{B}.\text{allocation} = \text{dynamic} \Rightarrow \mathcal{P}.\text{provenance} \geq \text{event-sourced}$ | Opaque dynamic allocation = unauditable |

### 12.3 Coupling Constraints

These are **inter-axis dependencies** that further restrict the legal region:

| Coupling | Constraint |
|---|---|
| $\mathcal{S}.\text{expressivity} \times \mathcal{S}.\text{rules}$ | Higher-order terms require rule fragments or bounded search |
| $\mathcal{B}.\text{postulate} \times \mathcal{M}.\text{forgetting}$ | AIKR requires forgetting; no AIKR without decay/eviction |
| $\mathcal{G}.\text{gates} \times \mathcal{P}.\text{provenance}$ | Every gate decision must be event-logged |
| $\mathcal{C}.\text{scheduler} \times \mathcal{P}.\text{provenance}$ | Learned schedulers must emit decision events |
| $\mathcal{V}.\text{firewall} \times \mathcal{P}.\text{learning}$ | Any learner touching attention/policy needs the firewall |

---

## §13 — Configuration and Instantiation Grammar

### 13.1 Reasoner Specification

A reasoner configuration is a **first-class value** expressed in a declarative grammar:

```
ReasonerSpec ::= {
  substrate   : SubstrateConfig
  control     : ControlConfig
  budget      : BudgetConfig
  governance  : GovernanceConfig
  valuation   : ValuationConfig
  memory      : MemoryConfig
  provenance  : ProvenanceConfig
  reflexivity : ReflexivityConfig
  arbitration : ArbitrationConfig
}
```

### 13.2 Composition Operations

Configurations compose algebraically:

| Operation | Symbol | Semantics |
|---|---|---|
| Sequential composition | $c_1 \otimes c_2$ | Run $c_1$ then $c_2$ |
| Parallel composition | $c_1 \oplus c_2$ | Run concurrently, join |
| Restriction | $c \mid P$ | Project onto subset of capabilities |
| Refinement | $c_1 \sqsubseteq c_2$ | $c_1$'s behaviors ⊆ $c_2$'s behaviors |
| Lifting | $\mathsf{lift}(c, f)$ | Apply functor $f$ to every component |
| Abstraction | $\alpha(c)$ | Map to behavioral equivalence class |

### 13.3 Semantic Function

The configuration maps to behavior via a compositional semantic function:

$$\llbracket \cdot \rrbracket : \mathcal{C} \to \mathsf{Coalgebra}$$

where:

$$\llbracket c_1 \otimes c_2 \rrbracket = \llbracket c_1 \rrbracket \circ \llbracket c_2 \rrbracket$$
$$\llbracket c_1 \oplus c_2 \rrbracket = \llbracket c_1 \rrbracket \times \llbracket c_2 \rrbracket$$
$$\llbracket c \mid P \rrbracket = \llbracket c \rrbracket \mid P$$

### 13.4 Example Configurations

**Minimal Deductive Reasoner:**
```
{
  substrate:   { terms: FOL, rules: [deduction], truth: boolean }
  control:     { κ: (retrieve · infer · commit)*, scheduler: depth-first }
  budget:      { dims: [derivations], ceilings: {derivations: 1000} }
  governance:  { gates: [], firewall: none }
  valuation:   { truth: boolean, goals: none }
  memory:      { store: flat-table, decay: none }
  provenance:  { level: 1, verifier: none }
  reflexivity: { level: L0 }
}
```

**Full Neuro-Symbolic Agent:**
```
{
  substrate:   { terms: Narsese+MeTTa, rules: NAL-44+exact, truth: (f,c)×(d,c),
                 proposers: [LM, reflex, peer], paraconsistent: true }
  control:     { κ: full-cycle-graph, scheduler: economic, parallelFoci: true }
  budget:      { dims: [cycles,derivations,premises,memoryOps,modelCalls,latency,risk],
                 scopes: lattice, allocation: utility-based, thermodynamic: true }
  governance:  { gates: [perception,action,reward,budget], orientation: (closed,open),
                 manifold: 19-head calibrated, autonomy: 5-rung ladder }
  valuation:   { truth: NAL, goals: (d,c), firewall: structural, ranking: EIG }
  memory:      { store: bounded-bags+graph, decay: decoupled, ports: 10,
                 episodic: true, procedural: true }
  provenance:  { level: 5, verifier: standalone-transcribed, correlation: full }
  reflexivity: { level: L5, governance: shadow+CI+external }
  arbitration: { mode: arbited, isolation: strict }
}
```

**Probabilistic Reasoner:**
```
{
  substrate:   { terms: graphical-model, rules: [marginalization, conditioning],
                 truth: probability }
  control:     { κ: fixed-graph-order, scheduler: topological }
  budget:      { dims: [compute], ceilings: {compute: bounded} }
  governance:  { gates: [input-validation], firewall: none }
  valuation:   { truth: P∈[0,1], goals: utility }
  memory:      { store: distribution, decay: none }
  provenance:  { level: 2, verifier: none }
  reflexivity: { level: L1 }
}
```

---

## §14 — Recursive Meta-Control

### 14.1 Principle

The meta-controller — the component that decides *how to reason* — is itself an instance of the Ω framework. This is the **recursive core** of the design.

### 14.2 The Recursive Equation

$$\text{MetaController} = \Omega(\text{control-state},\; \text{control-operators},\; \text{control-budget})$$

The meta-controller:
- **Observes** the cognitive state (through the same sensor/perception ports)
- **Reasons** about control (through the same inference substrate)
- **Proposes** control-word edits (through the same proposal pipeline)
- **Is judged** by the same governance pipeline
- **Is budgeted** by the same resource economy
- **Is event-sourced** by the same provenance fabric

### 14.3 Meta-Control as Bounded Reasoner

The meta-controller is a **bounded, governed reasoner** with its own:

| Component | Instantiation |
|---|---|
| State | Control-word version, budget allocation, trace grades, starvation events, contradiction rate, derivation yield |
| Operators | Graph edit, budget transfer, strategy switch, scheduler parameter adjustment |
| Budget | Dedicated `control-work` scope; cannot consume inference budget |
| Gates | Must pass graph invariant check + governance pipeline |
| Provenance | Every meta-decision is a `CognitiveTransaction` of kind `meta-control` |

### 14.4 The Meta-Controller Proposes; It Does Not Apply

The meta-controller **proposes** control changes. It **never applies** them directly. Its output is a `SelfImprovementProposal` routed through:

1. Graph invariant check
2. Budget feasibility check
3. Governance pipeline (autonomy level)
4. Cycle-boundary hot-swap (if approved)

This preserves H4 (no self-approved self-modification) and H6 (scheduler decisions are inspectable).

### 14.5 Deliberative Meta-Reasoning

The meta-controller reasons about control using the same NAL/evidential substrate:

```
meta-goal:  (current_control --> adequate)?
evidence:   control-work starvation events, contradiction rate,
            derivation yield, reflex-vs-NAL veto frequency,
            trace grades, budget utilization
action:     emit StageGraph edit proposal + budget-lattice transfer
```

This is **control-as-reasoning**: the system infers that its current loop shape is the bottleneck and proposes a new one, using the same inference rules it uses for any other reasoning.

---

## §15 — Implementation Topology and Ports

### 15.1 Module Structure

Ω is implemented as a set of **typed modules** behind **ports**. Every module is replaceable without changing the rest of the system.

```
Ω Runtime
├── Substrate Layer
│   ├── TermAlgebra          (port: CanonicalTerm)
│   ├── RuleEngine           (port: RuleDispatcher)
│   ├── TruthAlgebra         (port: ValuationOps)
│   └── ExactCoProcessor     (port: ExactOracle)
│
├── Control Layer
│   ├── ControlWordStore     (port: KATExpression)
│   ├── StageGraphCompiler   (port: ConditionalDAG)
│   ├── StageGraphRunner     (port: Middleware<CycleContext>)
│   └── Scheduler            (port: SchedulerAdapter)
│
├── Resource Layer
│   ├── BudgetLedger         (port: BudgetOps)
│   ├── ReservationManager   (port: ReserveSettle)
│   └── UtilityEstimator     (port: ScoreFunction)
│
├── Governance Layer
│   ├── GateRegistry         (port: GateOps)
│   ├── JudgmentManifold     (port: JudgeOps)
│   ├── RiskClassifier       (port: RiskOps)
│   ├── GovernancePipeline   (port: GovernanceOps)
│   └── AutonomyLadder       (port: AutonomyOps)
│
├── Memory Layer
│   ├── MemoryPorts          (10 typed ports)
│   ├── BoundedBag           (port: BagOps)
│   ├── DecayManager         (port: DecayOps)
│   └── ConsolidationEngine  (port: ConsolidationOps)
│
├── Provenance Layer
│   ├── EventLog             (port: AppendOnly)
│   ├── CorrelationThreader  (port: CorrelationOps)
│   ├── ReplayEngine         (port: ReplayOps)
│   └── StandaloneVerifier   (port: VerifyOps)
│
├── Commit Ledger
│   ├── CommitPipeline       (port: CommitOps)
│   ├── TypeChecker          (port: TypeOps)
│   └── EpistemicAxisGuard   (port: AxisOps)
│
├── Reflexive Tower
│   ├── MetaController       (port: MetaOps)
│   ├── ProposalRouter       (port: ProposalOps)
│   ├── ShadowValidator      (port: ShadowOps)
│   └── GovernanceGateway    (port: ExternalApproval)
│
└── Arbitration Layer
    ├── ProposerRegistry     (port: ProposerOps)
    ├── SubstrateIsolation   (port: IsolationOps)
    └── JudgmentAdjunction   (port: AdmitOps)
```

### 15.2 Port Contracts

Every port is a **typed interface** with:
- Input/output types
- Budget cost declaration
- Failure policy
- Provenance requirements
- Governance requirements

Modules behind ports are **replaceable**. The system's behavior is determined by the port contracts, not the implementations.

### 15.3 Minimal Runnable Profile

Ω must be runnable at minimal configuration:

```
MinimalΩ ::= {
  substrate:   { terms: flat-atoms, rules: [deduction], truth: boolean }
  control:     { κ: (infer · commit)*, scheduler: FIFO }
  budget:      { dims: [derivations], ceilings: {derivations: 100} }
  governance:  { gates: [], firewall: none }
  memory:      { store: flat-table, decay: none }
  provenance:  { level: 0 }
  reflexivity: { level: L0 }
}
```

This is a single-rule deductive engine with a budget. It satisfies all hard constraints trivially. From this seed, every axis can be extended independently.

### 15.4 Scalability Path

| Level | Configuration | Capability |
|---|---|---|
| **Ω₀** | Minimal deductive | Single rule, flat memory, no provenance |
| **Ω₁** | + NAL truth, priority bags | Uncertain reasoning, attention |
| **Ω₂** | + Event sourcing, replay | Auditable cognition |
| **Ω₃** | + Gates, firewall, judgment | Governed neuro-symbolic |
| **Ω₄** | + Conditional stage graph, correlation | Fluid control, causal tracing |
| **Ω₅** | + Budget lattice, utility scheduling | Economic resource allocation |
| **Ω₆** | + Meta-controller, governed self-mod | Recursive self-improvement |
| **Ω₇** | + Multi-agent, peer delegation, collective calibration | Ecological reasoning |

Each level adds capability without breaking the invariants of the previous level.

---

## §16 — Summary: The Ω Coordinate

$$\boxed{\Omega = \langle\; \mathcal{S},\; \mathcal{C},\; \mathcal{B},\; \mathcal{G},\; \mathcal{V},\; \mathcal{M},\; \mathcal{P} \;\rangle_{\Phi}}$$

Ω is the point in the reasoner design space where:

- **Substrate** is hybrid (symbolic + exact + neural + probabilistic), arbited, paraconsistent
- **Control** is a KAT control word over a conditional stage graph, data-driven, recursively self-editable
- **Budget** is a multi-dimensional lattice with reservations, utility pricing, and optional thermodynamic allocation
- **Governance** is an oriented gate lattice with calibrated trust fields, risk/reversibility manifolds, and a 7-level autonomy tower
- **Valuation** is NAL $(f,c)$ with epistemic/teleological/procedural firewall, evidence independence, and information-theoretic question valuation
- **Memory** is bounded comonad with decoupled decay, 10 typed ports, and single commit write path
- **Provenance** is a causal fabric with correlation threading, event-sourced fold, independent verification, and configurable depth
- **Reflexivity** is a 7-level governed tower where the meta-controller is itself an Ω instance

Every other reasoner design is a different point in this space. Ω provides the algebra to navigate between them, the feasibility predicate to stay coherent, and the governance pipeline to stay safe.

> *One transaction model. One commit surface. One resource algebra. One governance vocabulary. One provenance fabric. Many substrates, many schedulers, many judges — all behind typed ports. The control plane is itself a reasoner. The reasoner is itself a transaction. The transaction is itself an event. The event is itself a proof. The proof is itself a commitment. The commitment is itself governed.*

This is Ω.
