The synthesis below treats the supplied design documents and objective menu as the normative source material, then resolves their overlaps into one architecture rather than preserving parallel formulations. The selected bias is the strongest combination of epistemic integrity, causal auditability, declarative control, adaptive resource economics, governed reflexivity, neuro-symbolic cooperation, unified commits, modularity, robustness, and high cognitive power. The foundational constraints are the epistemic firewall, single commit authority, provenance-by-construction, and bounded/anytime cognition.  

# SeNARS⁺

## Unified Cognitive Control Plane

### Complete Architecture Specification

**Status:** Normative target architecture
**Design posture:** ambitious, flexible, scalable, modular, adaptive, auditable, bounded, self-governing
**Primary abstraction:** a governed resource-bounded cognitive controller
**Canonical execution model:** typed cognitive transactions over a declarative cognitive graph

---

# 1. Purpose

SeNARS⁺ is a general-purpose cognitive runtime for systems that must:

* represent uncertain and contradictory knowledge,
* combine symbolic, exact, probabilistic, neural, heuristic, and external reasoning,
* operate under finite computation and memory,
* dynamically select what to think about,
* distinguish epistemic belief from teleological desire,
* generate and evaluate hypotheses,
* interact with tools and environments,
* learn from experience,
* adapt its own strategies,
* perform governed self-modification,
* remain inspectable and replayable,
* degrade safely under partial failure,
* scale from a single embedded runtime to a distributed cognitive fabric.

The architecture is deliberately **not a fixed pipeline**.

It is a **parameterized control system** in which topology, scheduling, resource allocation, memory, verification, trust, learning, governance, and failure behavior are explicit data.

The central architectural principle is:

> **All cognition is bounded proposal generation, verification, and governed state transition.**

This generalizes the source documents' central ideas of declarative control, typed transactions, unified commit, economic budgeting, per-claim trust, causal provenance, and governed self-improvement.  

---

# 2. Design Principles

## 2.1 Non-negotiable invariants

### P1 — Epistemic integrity

The system MUST maintain:

* belief/goal separation,
* evidence-sensitive truth,
* contradiction tolerance,
* evidence independence,
* prevention of reward/desire → factual-truth mutation.

Reward may influence goals, attention, learning, utility, and strategy selection.

Reward MUST NOT directly modify factual truth.

Formally:

$$
\mathrm{Reward}\not\rightarrow\mathrm{BeliefTruth}
$$

The source objective document explicitly establishes this as foundational. 

### P2 — Single commit authority

All durable cognitive mutation MUST pass through one explicit commit surface.

This includes:

* observations,
* beliefs,
* goals,
* hypotheses,
* derived tasks,
* learned rules,
* schemas,
* strategy changes,
* parameter changes,
* memory consolidation,
* forgetting,
* action intents,
* human corrections,
* self-modification proposals.

The implementation may have many producers, workers, verifiers, or storage shards, but there is only **one logical mutation authority**.

### P3 — Provenance by construction

Every meaningful operation MUST be:

* observable,
* correlated,
* attributable,
* replayable,
* causally linked,
* independently verifiable where applicable.

Provenance is not a post-hoc logging subsystem. It is part of the transaction type and execution semantics. 

### P4 — Bounded / anytime cognition

Every execution path MUST have finite resource envelopes.

No operation may depend on:

* unbounded derivation,
* unbounded memory growth,
* indefinite waiting,
* unlimited model calls,
* unlimited recursion,
* unbounded external effects.

The system MUST support interruption, yielding, partial results, graceful degradation, and bounded forgetting. 

---

# 3. Formal Architecture

Define a reasoner as:

$$
\boxed{
\mathcal R =
\langle
X,\; O,\; U,\; \kappa,\; G,\; B,\; V,\; M,\; \Pi,\; L,\; A,\; F,\; \Omega
\rangle
}
$$

where:

| Symbol     | Component                                |
| ---------- | ---------------------------------------- |
| \(X\)      | Cognitive state                          |
| \(O\)      | Observation system                       |
| \(U\)      | Operation universe                       |
| \(\kappa\) | Declarative cognitive program            |
| \(G\)      | Governance and gate algebra              |
| \(B\)      | Resource/budget algebra                  |
| \(V\)      | Verification portfolio                   |
| \(M\)      | Memory fabric                            |
| \(\Pi\)    | Scheduler / meta-controller              |
| \(L\)      | Learning and self-modification subsystem |
| \(A\)      | Action/effect system                     |
| \(F\)      | Failure/degradation policy               |
| \(\Omega\) | Provenance and observability graph       |

A control step is:

$$
o_t = O(X_t,E_t)
$$

$$
p_t = \Pi(X_t,o_t,B_t,G_t,\Omega_t)
$$

$$
r_t = \mathrm{reserve}(p_t,B_t)
$$

$$
y_t = \llbracket \kappa_t \rrbracket(X_t,p_t,r_t)
$$

$$
z_t = V(y_t,X_t)
$$

$$
d_t = G(z_t,r_t,X_t)
$$

$$
X_{t+1} =
\begin{cases}
\mathrm{commit}(z_t) & d_t=\mathrm{admit}\\
\mathrm{degrade}(y_t,F) & d_t\neq\mathrm{admit}
\end{cases}
$$

The architecture therefore has a strict conceptual ordering:

**observe → select → reserve → execute → verify → govern → settle → commit → learn → observe again**

---

# 4. Cognitive State

The canonical state is a typed, event-sourced cognitive state.

```ts
interface CognitiveState {
  beliefs: BeliefStore;
  goals: GoalStore;
  hypotheses: HypothesisStore;

  questions: QuestionStore;
  observations: ObservationStore;
  evidence: EvidenceStore;

  procedures: ProcedureStore;
  schemas: SchemaStore;

  attention: AttentionState;
  drives: DriveState;

  worldModel: WorldModel;
  selfModel: SelfModel;

  resources: ResourceState;
  governance: GovernanceState;

  programs: ProgramRegistry;
  learning: LearningState;

  provenance: ProvenanceIndex;
  checkpoints: CheckpointIndex;
}
```

The state is logically unified while remaining physically partitionable.

Each representation has typed views:

```text
Semantic View
Epistemic View
Teleological View
Procedural View
Episodic View
Counterfactual View
Attention View
Provenance View
Operational View
```

A view is not a second source of truth.

The event stream is authoritative; snapshots, indexes, embeddings, caches, graph projections, and vector stores are derived representations.

---

# 5. Cognitive Object Type System

The type system is central to safety.

## 5.1 Core cognitive types

```ts
type CognitiveObject =
  | Observation
  | Evidence
  | Belief
  | Goal
  | Hypothesis
  | Question
  | Procedure
  | Schema
  | Preference
  | Policy
  | Capability
  | ActionIntent
  | SimulationResult
  | LearningProposal
  | ArchitectureProposal;
```

Every object MUST declare its cognitive axis.

```ts
type CognitiveAxis =
  | "epistemic"
  | "teleological"
  | "procedural"
  | "operational"
  | "governance"
  | "provenance";
```

## 5.2 Beliefs

A belief is epistemic.

```ts
interface Belief {
  statement: Statement;
  truth: TruthValue;
  evidence: EvidenceRef[];
  independence: EvidenceIndependence;
  provenance: Provenance;
}
```

## 5.3 Goals

A goal is teleological.

```ts
interface Goal {
  statement: Statement;
  desire: DesireValue;
  utility: UtilityEstimate;
  provenance: Provenance;
}
```

A `Goal` may influence search priority.

A `Goal` MUST NOT alter `Belief.truth`.

## 5.4 Questions

Questions are first-class cognitive objects.

They carry:

* expected information gain,
* urgency,
* uncertainty reduction estimate,
* human-attention cost,
* external-query cost,
* strategic relevance.

Question selection is therefore itself a scheduled cognitive operation.

---

# 6. Epistemic Substrate

SeNARS⁺ supports a **portfolio of semantic substrates**, not a single universal logic.

## 6.1 Symbolic substrate

The primary symbolic layer supports:

* structured terms,
* canonicalization,
* typed operations,
* NAL-style evidence-sensitive inference,
* contradiction coexistence,
* non-monotonic revision,
* rule-based inference,
* schema induction.

## 6.2 Exact substrate

Exact computation may include:

* rewriting,
* e-graphs,
* formal terms,
* proof-producing transformations,
* exact arithmetic,
* constraint solving.

Exact equality MUST remain distinct from uncertain similarity.

Therefore:

$$
\mathrm{ExactEqual}(x,y)
\not\equiv
\mathrm{Similar}(x,y)
$$

An approximate embedding match MUST NEVER silently create an exact symbolic union.

## 6.3 Probabilistic / statistical substrate

Supported mechanisms MAY include:

* probabilities,
* distributions,
* classifiers,
* learned estimators,
* calibrated confidence models.

They produce evidence or proposals unless explicitly registered as trusted symbolic operators.

## 6.4 Neural substrate

Neural systems are first-class **proposers and estimators**, not implicit authorities.

They may:

* generate candidate beliefs,
* formalize language,
* suggest premises,
* rank possibilities,
* estimate utility,
* predict outcomes,
* propose questions,
* generate code,
* synthesize schemas.

They do not directly mutate epistemic state.

## 6.5 Hybrid arbitration

Every substrate communicates through typed ports.

```text
Neural proposer
     ↓
Normalization
     ↓
Typed candidate
     ↓
Evidence / provenance binding
     ↓
Symbolic + statistical + simulation judgment
     ↓
Governance
     ↓
Commit
```

The source material explicitly favors the proposer/judge architecture and an arbiter boundary between heterogeneous substrates.

---

# 7. Truth and Evidence Algebra

The default belief valuation is:

$$
T=(f,c)
$$

where:

* \(f\) represents evidential frequency,
* \(c\) represents evidential confidence.

The architecture additionally supports:

$$
T' =
\langle
T,\;
E,\;
I,\;
P
\rangle
$$

where:

* \(T\) = truth value,
* \(E\) = evidence lineage,
* \(I\) = independence structure,
* \(P\) = provenance.

Revision MUST consider evidence independence.

Repeated derivation of the same evidence through multiple paths MUST NOT create unlimited confidence.

Contradictions remain queryable as coexisting states.

No contradiction may trigger logical explosion by default.

---

# 8. Declarative Cognitive Control Graph

The fixed pipeline is replaced by a **Typed Cognitive Graph (TCG)**.

The graph is a versioned data structure.

```ts
interface CognitiveGraph {
  nodes: StageNode[];
  edges: StageEdge[];
  guards: GuardExpression[];
  loops: LoopSpec[];
  parallelGroups: ParallelGroup[];
  barriers: BarrierSpec[];
  invariants: GraphInvariant[];
  version: GraphVersion;
}
```

## 8.1 Stage node

```ts
interface StageNode {
  id: StageId;
  kind: StageKind;
  reads: Port[];
  writes: Port[];
  capabilities: CapabilityToken[];
  budgetModel: BudgetModel;
  failurePolicy: FailurePolicy;
  governancePolicy: GovernancePolicy;
}
```

## 8.2 Supported control constructs

The control language supports:

* sequence,
* choice,
* guarded execution,
* parallel execution,
* bounded loops,
* event-triggered activation,
* retries,
* fallbacks,
* barriers,
* speculative branches,
* cancellation,
* compensation,
* subprogram calls.

Conceptually:

$$
\kappa ::= 
1
\mid a
\mid \kappa_1\cdot\kappa_2
\mid \kappa_1+\kappa_2
\mid p?\kappa
\mid \kappa^*
\mid \kappa_1\parallel\kappa_2
$$

This incorporates the KAT/control-word approach while retaining a practical graph representation. The source documents specifically propose data-driven conditional graphs, parallelism, and first-class control words. 

## 8.3 Graph safety

The graph compiler MUST reject programs containing:

* unbudgeted cycles,
* writes outside commit-capable stages,
* unverified untrusted inputs entering trusted state,
* reward → belief-truth paths,
* irreversible actions without authorization,
* bypasses around governance,
* unverifiable self-modification,
* undeclared external effects.

---

# 9. Cognitive Transaction Model

Every meaningful operation is a `CognitiveTransaction`.

```ts
interface CognitiveTransaction {
  id: TransactionId;
  correlationId: CorrelationId;

  kind:
    | "perception"
    | "attention"
    | "retrieval"
    | "inference"
    | "proposal"
    | "judgment"
    | "simulation"
    | "commit"
    | "action"
    | "learning"
    | "forgetting"
    | "consolidation"
    | "selfModification";

  inputs: CognitiveObjectRef[];
  outputs: CandidateRef[];

  reads: StateSelector[];
  effects: EffectDeclaration[];

  budget: BudgetReservation;
  capabilities: CapabilityToken[];

  trust: TrustProfile;
  risk: RiskProfile;
  reversibility: ReversibilityClass;

  verification: VerificationRequirement[];
  failure: FailurePolicy;

  proofObligations: ProofObligation[];

  provenance: Provenance;
}
```

The transaction declares its authority **before execution**.

---

# 10. Transaction Lifecycle

Every transaction passes through:

```text
CREATE
  ↓
NORMALIZE
  ↓
TYPE-CHECK
  ↓
CAPABILITY CHECK
  ↓
BUDGET RESERVATION
  ↓
EXECUTE / SPECULATE
  ↓
VERIFY
  ↓
RISK ASSESS
  ↓
RANK / ARBITRATE
  ↓
BUDGET SETTLEMENT
  ↓
COMMIT
  ↓
POST-COMMIT VALIDATION
  ↓
PROVENANCE FINALIZATION
```

Rejected transactions are also recorded.

Nothing disappears merely because it was rejected.

---

# 11. Unified Commit Ledger

The commit ledger is the sole durable cognitive mutation authority.

Conceptually:

```text
                ┌───────────────┐
Candidate ─────►│ Normalize     │
                └──────┬────────┘
                       ▼
                ┌───────────────┐
                │ Type Check    │
                └──────┬────────┘
                       ▼
                ┌───────────────┐
                │ Independence  │
                └──────┬────────┘
                       ▼
          ┌────────────────────────────┐
          │ Proof / Judge / Simulation │
          └──────────────┬─────────────┘
                         ▼
                 ┌──────────────┐
                 │ Governance   │
                 └──────┬───────┘
                        ▼
                 ┌──────────────┐
                 │ Commit      │
                 └──────┬───────┘
                        ▼
                 Event + State Fold
```

The commit ledger MUST support:

* atomic commit,
* rejection,
* provisional commit,
* expiration,
* supersession,
* rollback,
* compensation,
* conflict resolution,
* deterministic ordering,
* audit queries.

The source synthesis explicitly makes every mutation a proposal and funnels it through normalize → type-check → evidence-independence → proof/judge/simulation → rank → budget settlement → risk → commit. 

---

# 12. Provisional Knowledge

Not every useful result warrants permanent admission.

The system therefore supports:

```text
REJECTED
PROVISIONAL
ADMITTED
PROMOTED
ARCHIVED
RETRACTED
SUPERSEDED
```

A provisional belief:

* is explicitly marked,
* has limited downstream authority,
* may decay,
* may be corroborated,
* may be promoted,
* cannot silently masquerade as fully trusted knowledge.

This allows high exploratory power without relaxing epistemic discipline.

---

# 13. Trust Model

Trust is represented per proposal and per claim.

```ts
interface TrustProfile {
  sourceTrust: number;
  claimTrust: number;
  calibration: number;
  corroboration: number;
  independence: number;
  provenanceCompleteness: number;
}
```

A conceptual formulation is:

$$
\tau_c =
F(
\tau_s,
\mathrm{specificity},
\mathrm{corroboration},
\mathrm{independence},
\mathrm{calibration}
)
$$

Source reputation is a prior, not a permanent ceiling.

A highly trusted source may still produce a poorly supported claim.

A lower-trust source may produce a well-corroborated claim.

This realizes the source proposal for per-claim trust rather than coarse source-level trust. 

---

# 14. Governance Manifold

Every candidate receives:

```ts
interface GovernanceProfile {
  trust: number;
  confidence: number;

  risk: number;
  reversibility: ReversibilityClass;
  blastRadius: number;

  proofStatus: ProofStatus;
  judgeStatus: JudgeStatus;
  simulationStatus: SimulationStatus;

  autonomyLevel: AutonomyLevel;
  requiredApprovals: ApprovalRequirement[];
}
```

Authorization is a function of:

$$
\mathrm{Authorize}
=
f(
\mathrm{trust},
\mathrm{risk},
\mathrm{reversibility},
\mathrm{proof},
\mathrm{blastRadius},
\mathrm{autonomy}
)
$$

Typical policy regions:

| Condition                          | Result                        |
| ---------------------------------- | ----------------------------- |
| High trust + low risk + reversible | automatic commit              |
| High trust + medium risk           | shadow validation then commit |
| Medium trust + low risk            | provisional commit            |
| Medium trust + medium risk         | review                        |
| Low trust + high risk              | reject                        |
| Irreversible effect                | proof and/or human approval   |
| Safety-policy modification         | external governance only      |

This extends action governance to **all cognitive mutation**, not merely external actions. 

---

# 15. Gate Algebra

Gates are composable policy objects rather than fixed components.

A gate may be:

* fail-closed,
* fail-open,
* abstaining,
* degrading,
* proof-gated,
* quorum-gated,
* capability-gated,
* calibrated.

The fundamental orientation remains:

$$
\text{untrusted ingress} \rightarrow \text{strict admission}
$$

while safe internal cognition may degrade rather than halt.

Gates MUST be:

* idempotent where appropriate,
* explicitly typed,
* budget-aware,
* provenance-producing,
* composable,
* inspectable.

The architecture preserves the oriented-gate idea from the control algebra. 

---

# 16. Resource Economy

The resource model is a **multi-dimensional bounded economy**.

Default dimensions:

| Resource         | Meaning                     |
| ---------------- | --------------------------- |
| `cycles`         | control operations          |
| `derivations`    | symbolic inference          |
| `premises`       | premise selection           |
| `memoryOps`      | memory activity             |
| `llmCalls`       | model invocations           |
| `tokens`         | generated/consumed tokens   |
| `latency`        | wall-clock budget           |
| `attention`      | cognitive focus capacity    |
| `risk`           | risk expenditure            |
| `humanAttention` | review/interaction capacity |

This generalizes the source documents' fixed budgets into reservation, settlement, pricing, and backpressure. 

## 16.1 Reservation

Before execution:

$$
B_{available}
\leftarrow
B_{available}-B_{reserved}
$$

After execution:

$$
B_{settled}
=
B_{reserved}-B_{unused}
$$

Unused budget returns according to policy.

## 16.2 Prices

Each operation has an estimated marginal utility:

$$
U(op)
=
\frac{
\widehat{\Delta K}
+
\widehat{\Delta G}
+
\widehat{\Delta H}
+
\widehat{\Delta Q}
}{
C(op)
}
$$

where:

* \(\Delta K\) = expected knowledge gain,
* \(\Delta G\) = expected goal progress,
* \(\Delta H\) = expected information/human-value gain,
* \(\Delta Q\) = expected quality/robustness gain.

The denominator is a weighted resource vector.

## 16.3 Resource markets

A scheduler MAY use:

* static quotas,
* dynamic reservation,
* internal prices,
* auctions,
* marginal utility,
* fairness credits,
* deadline pressure,
* learned utility models.

The economic mechanism may adapt.

The global hard constraints may not.

---

# 17. Anti-Starvation and Fairness

A utility-maximizing scheduler without fairness can repeatedly select attractive operations and starve necessary maintenance.

Therefore every scheduler MUST include:

* aging,
* minimum service guarantees,
* deadline handling,
* starvation detection,
* reserve pools,
* repair/consolidation quotas,
* governance-service quotas.

A transaction that is continuously postponed becomes an observable system condition:

```text
Starved
Escalated
Deferred
Expired
```

Starvation is never interpreted as success merely because no failure occurred.

---

# 18. Scheduler Architecture

The scheduler is hierarchical.

```text
Level 0 — Hard Safety Filter
    ↓
Level 1 — Capability / Dependency Filter
    ↓
Level 2 — Budget Reservation
    ↓
Level 3 — Utility / Priority Ranking
    ↓
Level 4 — Learned Ranking
    ↓
Level 5 — Fairness / Deadline Adjustment
    ↓
Level 6 — Deterministic Arbitration
```

The learned component may:

* reorder,
* prioritize,
* predict utility,
* suggest exploration.

It may NOT:

* admit prohibited operations,
* change truth,
* bypass governance,
* increase hard budgets,
* disable verification,
* directly alter safety policy.

This captures the frontier architecture's idea that learned scheduling should arrive only after the transaction/blackboard provenance envelope is mature. 

---

# 19. Cognitive Blackboard

The scheduler operates over a unified **Claim and Work Blackboard**.

Items posted to the blackboard may include:

* candidate beliefs,
* candidate goals,
* questions,
* derived tasks,
* contradictions,
* unresolved proofs,
* tool opportunities,
* learning opportunities,
* repairs,
* consolidation jobs,
* architecture proposals.

Each item includes:

```ts
interface WorkItem {
  id: WorkItemId;
  kind: WorkKind;

  expectedValue: UtilityEstimate;
  uncertainty: number;
  urgency: number;

  requiredCapabilities: CapabilityToken[];
  estimatedBudget: BudgetVector;

  governanceProfile: GovernanceProfile;
  provenance: Provenance;

  state:
    | "ready"
    | "reserved"
    | "running"
    | "waiting"
    | "verified"
    | "committed"
    | "rejected"
    | "expired";
}
```

The blackboard can therefore serve as:

* task queue,
* claim queue,
* contradiction queue,
* proof queue,
* curiosity queue,
* repair queue,
* learning queue.

---

# 20. Attention

Attention is independent from truth.

The architecture supports:

* priority,
* recency,
* novelty,
* goal relevance,
* spreading activation,
* contradiction pressure,
* uncertainty,
* expected information gain,
* learned saliency,
* fairness.

Truth decay and attention decay MUST be distinct mechanisms.

A claim may become less salient without becoming less true.

A claim may also remain highly salient despite low confidence because it is important to resolve.

---

# 21. Drives and Homeostasis

Default drives:

* curiosity,
* competence,
* coherence,
* social relevance.

Additional drives MAY be configured.

Each drive has:

```ts
interface Drive {
  id: DriveId;
  setpoint: number;
  intensity: number;
  decayRate: number;
  replenishPolicy: ReplenishPolicy;
  goalGenerator: GoalGenerator;
}
```

Drives influence teleological control.

They do not write factual truth.

---

# 22. Memory Fabric

The memory subsystem is one logical fabric with multiple specialized views.

## 22.1 Memory classes

```text
Working Memory
Episodic Memory
Semantic Memory
Procedural Memory
Schema Memory
Counterfactual Memory
Interaction Memory
Provenance Memory
```

## 22.2 Physical implementation

Each class MAY use:

* bounded priority bags,
* graphs,
* indexes,
* column stores,
* vector indexes,
* append-only logs,
* snapshots,
* object stores,
* distributed shards.

The implementation is replaceable behind typed ports.

## 22.3 Memory contract

Every memory mutation MUST have:

* transaction ID,
* provenance,
* budget charge,
* version,
* admission status,
* retention class.

## 22.4 Forgetting

Forgetting is a governed cognitive operation.

Policies include:

* LRU,
* decay,
* pressure eviction,
* archival,
* consolidation,
* schema extraction,
* compression,
* deduplication.

A forgotten object remains recoverable from history where retention policy permits.

---

# 23. Consolidation

Consolidation transforms transient cognition into durable structure.

Typical process:

```text
Episodes
  ↓
Cluster / Compare
  ↓
Extract regularities
  ↓
Generate schema
  ↓
Validate
  ↓
Promote
  ↓
Archive source episodes according to policy
```

Promotion requires evidence sufficient for the target schema class.

Consolidation MUST NOT manufacture confidence merely because information was repeated.

---

# 24. Inference Engine

The inference engine is a portfolio, not a single strategy.

## 24.1 Rule families

Supported operators include:

* deduction,
* induction,
* abduction,
* analogy/resemblance,
* decomposition,
* resolution,
* schema induction,
* exact rewrite,
* retrieval,
* contradiction analysis.

## 24.2 Strategy slots

The strategy registry supports replaceable slots for:

```text
Sampling
Premise Formation
Derivation
Neural/LM Selection
Attention
Contradiction Handling
Revision
Question Generation
Consolidation
Planning
```

Profiles can be mixed and versioned.

Changing a profile does not require rebuilding the cognitive state.

---

# 25. Verification Portfolio

Verification is multi-modal.

```text
VerificationPortfolio
 ├── Type Checker
 ├── Symbolic Validator
 ├── Proof Checker
 ├── Evidence Independence Checker
 ├── Groundedness Checker
 ├── Calibrated Neural Judge
 ├── Simulation Engine
 ├── Shadow Executor
 ├── Differential Checker
 └── Human Review
```

No one verifier must be trusted universally.

## 25.1 Independence

The strongest verification mode uses a standalone checker whose core semantic table is independently specified or transcribed.

The verifier MUST NOT depend on the same mutable engine assumptions it is supposed to validate.

This follows the source requirement that maximal auditability requires verifier independence and explicit drift measurement. 

---

# 26. Model and Judge Governance

Neural models and judgment heads are versioned.

Each model invocation carries:

```ts
interface ModelIdentity {
  modelId: string;
  version: string;
  digest: string;
  configurationDigest: string;
}
```

A model digest mismatch is a governance event.

Pinned model identities can be required for:

* reproducibility,
* regulated deployment,
* proof generation,
* patch validation,
* benchmark comparison.

---

# 27. Causal Provenance

Every cognitive object carries a provenance chain.

```ts
interface Provenance {
  correlationId: CorrelationId;
  stimulusId: StimulusId;
  sessionId: SessionId;
  cycleId: CycleId;
  transactionId: TransactionId;

  proposerId?: ProposerId;
  judgeId?: JudgeId;
  proofId?: ProofId;

  parentId?: ProvenanceId;
  sourceRefs: SourceRef[];

  budgetContext: BudgetContext;
  failureContext?: FailureContext;
  modelContext?: ModelIdentity;
}
```

The causal graph MUST support questions such as:

* What stimulus caused this belief?
* Which evidence supported it?
* Which derivation produced it?
* Which proposer generated the candidate?
* Which judge accepted or rejected it?
* Which budget shortage changed behavior?
* Which learning event changed the strategy?
* What action resulted from this belief?

The source material explicitly proposes a causally navigable event graph with universal correlation IDs. 

---

# 28. Event Sourcing

The event log is authoritative.

Events include:

```text
StimulusReceived
ObservationNormalized
TransactionCreated
BudgetReserved
OperationStarted
ProposalGenerated
JudgmentCompleted
GateEvaluated
SimulationCompleted
CommitAccepted
CommitRejected
RollbackExecuted
BudgetSettled
MemoryEvicted
SchemaPromoted
StrategyChanged
LearningObserved
LearningProposed
PatchProposed
PatchVerified
PatchRejected
ActionPrepared
ActionExecuted
ActionConfirmed
ActionCompensated
FailureObserved
DegradationEntered
```

Snapshots are caches.

Replay reconstructs state from the event stream.

---

# 29. Replay Semantics

The architecture supports:

### Deterministic replay

Given:

* same event stream,
* same model digests,
* same program version,
* same nondeterminism seeds,
* same external-response fixtures,

the system SHOULD reproduce the same logical trace.

### Verified replay

Replay additionally checks:

* invariant preservation,
* event completeness,
* state hashes,
* transaction ordering,
* budget conservation,
* provenance continuity.

---

# 30. Failure Algebra

Every operation declares its failure policy.

Supported responses:

```text
ABORT
RETRY
BACKOFF
DEGRADE
SKIP
ABSTAIN
FALLBACK
ROLLBACK
COMPENSATE
ESCALATE
```

Failure policy is contextual.

A safe internal inference may degrade to a cheaper symbolic approximation.

A trust-boundary violation must fail closed.

A missing optional model may trigger symbolic fallback.

A missing safety verifier may block the affected operation.

No cognition-affecting failure may be silently swallowed.

---

# 31. Graceful Degradation

The system has explicit degradation modes.

```text
FULL
  ↓
REDUCED_PARALLELISM
  ↓
REDUCED_MODEL_SET
  ↓
SYMBOLIC_PRIORITY
  ↓
LOW_BUDGET_ANYTIME
  ↓
SAFE_ABSTENTION
```

Degradation is itself:

* budgeted,
* observable,
* causally recorded,
* policy-driven.

---

# 32. Action System

Actions use the same cognitive transaction discipline.

Canonical path:

```text
Goal
  ↓
Plan
  ↓
Simulation
  ↓
Risk Assessment
  ↓
Authorization
  ↓
Sandbox / Prepare
  ↓
Execute
  ↓
Confirm
  ↓
Commit outcome
  ↓
Compensate / Rollback if required
```

Actions are classified by reversibility:

| Class               | Default treatment           |
| ------------------- | --------------------------- |
| Informational       | automatic                   |
| Reversible local    | sandbox                     |
| Reversible external | capability-controlled       |
| Hard-to-reverse     | strong authorization        |
| Irreversible        | proof and/or human approval |
| Forbidden           | reject                      |

The source design explicitly proposes this simulation-before-commit pipeline and reversibility taxonomy. 

---

# 33. External Effects

The system distinguishes:

```text
Cognitive State
External World State
```

External effects cannot be made atomic with arbitrary external systems.

Therefore, the runtime uses a compensation protocol:

```text
Prepare
  ↓
Authorize
  ↓
Execute
  ↓
Observe result
  ↓
Commit cognitive representation
  or
Compensate / mark uncertain
```

An action whose external outcome cannot be confirmed MUST be represented explicitly as uncertain.

The system MUST NOT silently record an intended action as a completed action.

---

# 34. Capability System

Operations require explicit capability tokens.

Examples:

```text
read:memory
write:memory
invoke:llm
invoke:tool
write:file
network:outbound
execute:sandbox
modify:strategy
modify:rule
modify:code
modify:governance
approve:external
```

Capabilities can be:

* scoped,
* time-limited,
* transaction-specific,
* environment-specific,
* revocable.

The highest-risk capabilities require stronger governance.

---

# 35. Learning System

Learning is not a privileged alternate write path.

All learning produces proposals.

```text
Experience
  ↓
Observation
  ↓
Lesson
  ↓
Hypothesis
  ↓
Learning Proposal
  ↓
Validation
  ↓
Shadow Execution
  ↓
Bounded Deployment
  ↓
Evaluation
  ↓
Promotion / Rollback
```

Supported learning domains include:

* attention weights,
* strategy selection,
* threshold tuning,
* model routing,
* schema induction,
* rule promotion,
* preference learning,
* distillation,
* dialogue adaptation,
* code/configuration proposals,
* architecture search.

---

# 36. Reward Domains

Reward is partitioned.

```text
REWARD_ATTENTION
REWARD_GOAL
REWARD_STRATEGY
REWARD_LEARNING
REWARD_EXTERNAL
```

Cross-domain reward transfer is forbidden unless a declared governance rule explicitly authorizes it.

There is no direct path:

```text
Reward → Belief.Truth
```

A violating transaction MUST fail closed.

---

# 37. Governed Self-Modification

Self-modification follows a governance tower.

```text
L0 Observe
  ↓
L1 Analyze
  ↓
L2 Propose
  ↓
L3 Shadow Validate
  ↓
L4 Bounded Deployment
  ↓
L5 Independent Verification
  ↓
L6 External / Immutable Approval
  ↓
Production Promotion
```

The system itself MUST NOT be the sole final approver of changes to:

* safety gates,
* epistemic type rules,
* verifier independence,
* governance policy,
* reward-firewall semantics,
* capability root authority.

The learning system may propose such changes.

It may not unilaterally authorize them.

---

# 38. Proof-Carrying Modification

A sufficiently capable implementation MAY generate:

```ts
interface VerifiedPatch {
  patch: CodePatch;
  proof: DerivationRecord;
  verifier: VerifierIdentity;
  invariants: InvariantSpec[];
  shadowTrace: TraceRef;
}
```

A formally verified patch may qualify for automated promotion according to governance policy.

Otherwise it enters:

```text
Shadow Execution
→ CI
→ Differential Test
→ Independent Verification
→ Approval
```

This incorporates the source proposal for proof-carrying patches while retaining governed fallback. 

---

# 39. Meta-Controller

The meta-controller does not output arbitrary actions.

It produces **Cognitive Programs**.

```ts
interface CognitiveProgram {
  graph: CognitiveGraph;

  resourcePolicy: ResourcePolicy;
  proposerPortfolio: ProposerPortfolio;

  attentionPolicy: AttentionPolicy;
  verificationPolicy: VerificationPolicy;
  governancePolicy: GovernancePolicy;

  autonomyPolicy: AutonomyPolicy;
  learningPolicy: LearningPolicy;

  failurePolicy: FailurePolicy;
}
```

Program selection depends on:

* current state,
* drives,
* uncertainty,
* contradiction load,
* resource pressure,
* environment volatility,
* historical performance,
* governance constraints,
* user/environment objectives.

The source architecture explicitly recommends this separation: the meta-controller selects a cognitive program rather than directly choosing an external action. 

---

# 40. Scheduler Learning

The scheduler may eventually become learned.

However, learning operates only on the **ordering layer**.

The learned scheduler MAY choose:

```text
what is likely valuable?
which operation first?
which proposer to invoke?
which branch to explore?
how much budget to reserve?
```

It MAY NOT decide:

```text
whether an operation is forbidden
whether reward may rewrite truth
whether a safety invariant exists
whether a verifier can be skipped when required
whether a protected capability may be granted
```

Thus:

> **The controller becomes increasingly intelligent without becoming the source of its own authority.**

---

# 41. Concurrency Model

The runtime supports:

* serial execution,
* speculative parallelism,
* worker pools,
* asynchronous event streams,
* actor-like components,
* distributed transactions.

Parallel work operates on snapshots or immutable views.

Durable mutation is serialized through the logical commit authority.

Conceptually:

```text
                 ┌─ Worker A ─┐
State Snapshot ──┼─ Worker B ─┼──► Verify ─► Commit
                 ├─ Worker C ─┤
                 └─ Worker D ─┘
```

Conflicts are resolved at commit.

The commit ledger provides the architectural synchronization boundary.

---

# 42. Distributed Scaling

SeNARS⁺ scales in layers.

## Level 1 — Embedded

Single-process runtime.

## Level 2 — Multicore

Independent reasoning workers sharing a commit authority.

## Level 3 — Distributed

Partition:

* memory,
* inference work,
* proposer pools,
* verification pools,
* simulation,
* embedding indexes.

## Level 4 — Federated

Multiple reasoner instances exchange:

* proposals,
* evidence,
* calibration information,
* capability-scoped tasks,
* verified derivations.

## Level 5 — Cognitive ecology

Multi-agent coordination supports:

* delegation,
* specialization,
* shared blackboards,
* consensus,
* reputation,
* capability tokens,
* distributed verification.

No remote agent is implicitly trusted.

---

# 43. Multi-Agent Protocol

Peer contributions have the same lifecycle as internal proposals:

```text
Peer Proposal
  ↓
Identity / Capability Check
  ↓
Provenance Binding
  ↓
Claim Validation
  ↓
Evidence Independence
  ↓
Governance
  ↓
Local Commit
```

Remote consensus cannot override local epistemic safety rules.

---

# 44. Configuration as Data

The entire architecture is declarative.

A complete system configuration is conceptually:

```yaml
reasoner:
  semantics:
    truth: fc
    contradiction: coexist
    exactEquality: isolated

  topology:
    program: adaptive_transaction_graph
    concurrency: speculative_parallel
    controlLanguage: kat_plus_graph

  scheduler:
    policy: risk_adjusted_utility
    learnedRanker: enabled
    fairness: aging
    deterministicTieBreak: true

  resources:
    cycles: bounded
    derivations: bounded
    premises: bounded
    memoryOps: bounded
    llmCalls: bounded
    tokens: bounded
    latency: bounded
    attention: bounded
    risk: bounded
    humanAttention: bounded

  memory:
    working: priority_bag
    semantic: graph
    episodic: event_log
    procedural: schema_store
    counterfactual: branch_store

  proposers:
    symbolic: enabled
    neural: enabled
    reflex: enabled
    peer: enabled

  verification:
    symbolic: enabled
    proof: enabled
    calibration: enabled
    simulation: enabled
    shadow: enabled
    independentVerifier: enabled

  governance:
    perClaimTrust: enabled
    riskClassifier: enabled
    autonomy: adaptive
    selfModification: shadow_ci_external
    protectedPolicies: immutable

  learning:
    attention: enabled
    strategies: enabled
    schemas: enabled
    rules: governed
    code: governed
    architectureSearch: governed

  observability:
    eventSourcing: enabled
    causalGraph: enabled
    deterministicReplay: enabled
    stateHashes: enabled
```

---

# 45. Configuration Composition

Configurations support:

```text
compose
restrict
refine
override
specialize
clone
branch
compare
validate
compile
evaluate
```

A configuration is itself versioned and governed.

Architecture experimentation becomes:

```text
Base Program
   ↓
Clone
   ↓
Modify Graph / Policy / Budget / Strategy
   ↓
Static Validation
   ↓
Simulation
   ↓
Benchmark
   ↓
Shadow Runtime
   ↓
Promotion
```

This realizes the source documents' concept of the architecture as a programmable design space rather than a fixed implementation. 

---

# 46. Presets

The architecture supports named operating profiles.

## Generalist

Balanced reasoning, moderate exploration, broad proposer portfolio.

## High-Assurance

Strong proof and verification, conservative autonomy, strict trust thresholds.

## Creative

High proposal diversity, novelty-weighted scheduling, sandbox-first behavior.

## Research

Large exploratory budget, simulation-heavy, aggressive hypothesis generation.

## Real-Time

Latency-first scheduling, limited verification depth, symbolic fallback.

## Autonomous Engineering

Strong procedural memory, code proposals, shadow CI, proof-carrying modification.

## Distributed Collective

Peer proposals, reputation, delegation, cross-agent verification.

All presets are configurations of the same architecture.

---

# 47. Safety Invariants

The implementation MUST continuously enforce the following.

### I1 — Admission before mutation

$$
\mathrm{write}
\Rightarrow
\mathrm{admitted}
$$

### I2 — Provenance before admission

$$
\mathrm{admit}
\Rightarrow
\mathrm{provenance\ complete}
$$

### I3 — Reward firewall

$$
\mathrm{Reward}
\nrightarrow
\mathrm{BeliefTruth}
$$

### I4 — Boundedness

Every executable path has a finite budget envelope.

### I5 — Budget conservation

$$
B_{start}
=
B_{reserved}
+
B_{available}
$$

modulo explicitly declared issuance/transfer mechanisms.

### I6 — No untrusted direct write

$$
\mathrm{UntrustedProposal}
\Rightarrow
\mathrm{JudgedBeforeCommit}
$$

### I7 — Verifier independence

Required independent verification may not invoke the same mutable semantic authority it is validating.

### I8 — Equality isolation

Exact symbolic equality may not be induced from uncertain similarity.

### I9 — External effects are governed

$$
\mathrm{ExternalEffect}
\Rightarrow
\mathrm{RiskClassified}
\land
\mathrm{Authorized}
$$

### I10 — Self-modification is proposal-only

$$
\mathrm{SelfModification}
\Rightarrow
\mathrm{GovernedProposal}
$$

### I11 — Protected governance is externally controlled

The system may not unilaterally change the rules that determine its own authority.

### I12 — No silent failure

Cognition-affecting failures MUST emit events.

### I13 — Replayability

Reachable committed state MUST be reconstructable from authoritative provenance.

### I14 — Contradiction tolerance

Contradictory evidence MUST remain representable without automatic explosion.

### I15 — No unbounded waiting

Every wait has a timeout, cancellation path, or bounded continuation policy.

### I16 — Starvation visibility

Repeated failure to obtain execution opportunity MUST be measurable and diagnosable.

### I17 — Deterministic arbitration

Equal-priority conflicts MUST resolve through deterministic or explicitly seeded policy.

### I18 — Graph safety

The compiled cognitive graph MUST itself satisfy the invariant set.

---

# 48. Static Validation

Before activation of any program, the compiler checks:

```text
Type Safety
Capability Safety
Budget Coverage
Gate Coverage
Commit Reachability
Provenance Coverage
Failure Coverage
Cycle Boundedness
Action Safety
Reward Firewall
Verifier Dependencies
Protected-Surface Access
```

A program failing validation cannot enter execution.

This moves architectural invariants from comments and CI conventions into the executable control calculus, as proposed in the source material. 

---

# 49. Runtime Monitoring

Runtime monitors measure:

* budget utilization,
* gate rejection rate,
* verifier failures,
* calibration drift,
* starvation,
* contradiction rate,
* rollback rate,
* degradation rate,
* proposer quality,
* scheduler regret,
* evidence duplication,
* memory pressure,
* action uncertainty,
* learning side effects.

An anomaly becomes a first-class cognitive event.

---

# 50. Calibration

Judgment models must be periodically calibrated.

Calibration tracks:

$$
\mathrm{prediction}
\rightarrow
\mathrm{outcome}
$$

across:

* source,
* model,
* claim class,
* domain,
* proposer type,
* environment.

Trust is updated from evidence.

The trust system MUST NOT reinterpret calibration failure as evidence about factual truth itself.

---

# 51. Information-Gain Driven Cognition

Questions are selected according to expected value.

A conceptual metric is:

$$
Q(q)
=
\frac{
\widehat{\mathrm{InformationGain}}(q)
+
\widehat{\mathrm{GoalProgress}}(q)
}{
\widehat{\mathrm{Cost}}(q)
}
$$

subject to:

* budget,
* risk,
* capability,
* attention,
* human-cost,
* governance.

The system can therefore decide that **asking is better than deriving**.

---

# 52. Contradiction Handling

Contradiction is not automatically a fault.

The contradiction manager determines whether to:

* preserve both claims,
* seek corroboration,
* seek new evidence,
* branch hypotheses,
* lower confidence,
* revise beliefs,
* identify source dependence,
* trigger a repair loop,
* escalate to a human.

A contradiction becomes an information-bearing work item.

---

# 53. Counterfactual Reasoning

Counterfactual branches are isolated state projections.

```text
Current State
   ├── Branch A
   ├── Branch B
   └── Branch C
```

Each branch has:

* separate budget,
* separate provenance,
* explicit parent state,
* explicit termination,
* bounded memory.

Only verified outcomes can affect the main state.

---

# 54. Simulation

Simulation is a first-class operation.

It can run:

* hypothetical plans,
* policy alternatives,
* actions,
* new cognitive programs,
* parameter settings,
* architecture proposals.

Simulation results are evidence.

They are not reality.

A simulated observation MUST carry a simulation provenance type and cannot be confused with an external observation.

---

# 55. Introspection and Self-Model

The system maintains a self-model containing:

```text
Current Program
Current Resources
Known Limitations
Calibration State
Known Failures
Current Capabilities
Model Digests
Recent Adaptations
Pending Proposals
Governance Status
```

Introspection may inspect policy state.

It cannot use introspection to bypass policy.

---

# 56. Architecture Search

The meta-system may search configuration space.

Candidate architectures are evaluated against:

$$
\Phi(r)=
\bigwedge_i K_i(r)
$$

where each \(K_i\) is a hard architectural constraint.

Search objective:

$$
\max_r
\;
\mathrm{Utility}(r)
-
\lambda_1\mathrm{Risk}(r)
-
\lambda_2\mathrm{Complexity}(r)
-
\lambda_3\mathrm{VerificationCost}(r)
$$

subject to:

$$
\Phi(r)=\mathrm{true}
$$

Architecture search therefore optimizes **inside a constrained feasible region**, not over unconstrained self-modification.

---

# 57. Architecture Versioning

Every deployed cognitive program has:

```text
Program ID
Program Version
Schema Version
Rule Version
Model Digests
Policy Version
Budget Policy Version
Verifier Version
```

A transaction records all relevant versions.

No architecture change is anonymous.

---

# 58. Migration and Compatibility

The architecture supports adapters for:

* legacy stage pipelines,
* legacy strategy slots,
* legacy memory stores,
* legacy event streams,
* existing rule sets,
* external model providers.

A legacy subsystem becomes a typed proposer, operator, memory port, or verifier.

This allows incremental migration without weakening the target architecture.

---

# 59. Minimal Kernel

Despite the richness of the full system, the load-bearing kernel remains small:

```text
1. Typed cognitive state
2. Cognitive transaction
3. Declarative control graph
4. Governance/gate engine
5. Resource accountant
6. Verification interface
7. Commit ledger
8. Event/provenance system
```

Everything else is an extension.

This preserves the source algebra's conclusion that substrate, control word, admission gate, resource monoid, and provenance fold are the irreducible core. 

---

# 60. Reference Runtime Loop

```ts
while (runtime.isAlive()) {
  const observation = observer.observe();

  const correlationId =
    provenance.beginCorrelation(observation);

  const state =
    ledger.fold();

  const program =
    metaController.selectProgram({
      state,
      observation,
      drives: state.drives,
      budgets: state.resources,
      governance: state.governance,
      history: state.provenance,
    });

  graphCompiler.assertValid(program.graph);

  const work =
    planner.instantiate(program, observation);

  const ranked =
    scheduler.rank(work);

  const reservations =
    budgetOffice.reserve(ranked);

  const results =
    executor.runSpeculatively({
      program,
      reservations,
      correlationId,
    });

  const verified =
    verificationPortfolio.evaluate(results);

  const governed =
    governance.evaluate(verified);

  const settled =
    budgetOffice.settle(governed);

  const committed =
    ledger.commit(settled);

  const actions =
    actionController.plan(committed);

  for (const action of actions) {
    actionController.executeGoverned(action);
  }

  learner.observe({
    observation,
    committed,
    actions,
  });

  learner.proposeAdaptations();

  consolidator.run();

  provenance.closeCorrelation(correlationId);
}
```

This loop is conceptual; the graph may execute multiple branches, asynchronously and speculatively.

---

# 61. Extension API

Every major subsystem is accessed through typed ports.

```ts
interface ReasonerPort<TIn, TOut> {
  capabilities(): CapabilityDescriptor[];
  estimate(input: TIn): CostEstimate;
  propose(input: TIn): Proposal<TOut>;
  execute(
    proposal: Proposal<TOut>,
    context: ExecutionContext
  ): ExecutionResult<TOut>;
}
```

Implementations can therefore be swapped without changing the control plane.

Examples:

```text
NALInferencePort
NeuralProposalPort
MeTTaExactPort
VectorRetrievalPort
SimulationPort
HumanJudgmentPort
PeerReasonerPort
FilesystemPort
WebPort
ToolPort
```

---

# 62. Observability API

A standard query layer supports:

```text
trace(transactionId)
causes(objectId)
ancestors(objectId)
descendants(objectId)
whyCommitted(objectId)
whyRejected(transactionId)
budgetImpact(transactionId)
modelContext(transactionId)
judgmentContext(transactionId)
learningImpact(strategyId)
rollbackHistory(objectId)
```

Causal provenance is queryable rather than merely archived.

---

# 63. Governance API

Governance exposes:

```text
classifyRisk(candidate)
evaluateTrust(candidate)
requiredVerification(candidate)
requiredApproval(candidate)
authorized(candidate, capabilities)
checkInvariant(candidate)
admissionDecision(candidate)
```

The governance service itself is versioned and observable.

---

# 64. Resource API

Resources are generalized beyond fixed counters.

```ts
interface BudgetOffice {
  estimate(op: Operation): BudgetVector;
  reserve(req: ReservationRequest): Reservation;
  transfer(req: TransferRequest): TransferResult;
  settle(id: ReservationId, usage: BudgetVector): Settlement;
  remaining(): BudgetVector;
  starvationReport(): StarvationReport;
}
```

Any transfer MUST preserve conservation rules and produce a provenance event.

---

# 65. Security Boundary

The cognitive architecture is also a capability-security architecture.

Protected surfaces include:

```text
Epistemic Type Rules
Reward Firewall
Verifier Identity
Governance Root
Capability Root
Audit Log
Commit Authority
Model Integrity Metadata
Program Compiler
External Approval Configuration
```

These surfaces have stronger access controls than ordinary reasoning components.

---

# 66. Data Integrity

The event stream SHOULD support:

* content addressing,
* cryptographic hashes,
* tamper evidence,
* signed checkpoints,
* model digests,
* provenance signatures,
* retention classes.

For high-assurance deployments, a trust chain may be:

```text
Event
 → Hash
 → Checkpoint
 → Signed Checkpoint
 → External Attestation
```

---

# 67. Performance Architecture

The system must separate:

### Critical path

* budget validation,
* capability validation,
* type checks,
* required safety gates,
* commit ordering.

### Elastic path

* deep inference,
* model generation,
* simulation,
* exploration,
* consolidation,
* calibration.

Elastic work can expand or contract without violating critical safety semantics.

---

# 68. Scalability Strategy

Scaling principles:

1. **Parallelize speculation, not authority.**
2. **Shard storage, not semantics.**
3. **Replicate verifiers when useful, but maintain independence where required.**
4. **Localize scheduling, but retain global budget constraints.**
5. **Use snapshots as acceleration, never as untracked truth.**
6. **Make expensive judgments selectively deeper according to risk.**

---

# 69. Complexity Management

The architecture deliberately avoids making every operation maximally rigorous.

Governance determines required depth.

Example:

```text
Low-risk recall
→ lightweight verification

Ordinary inference
→ typed + provenance validation

Neural hypothesis
→ calibration + evidence checks

External action
→ risk + simulation + authorization

Code patch
→ shadow + CI + independent verification

Governance modification
→ external authority
```

This prevents governance paralysis while maintaining strict treatment of dangerous mutations. The objective set explicitly identifies governance paralysis and audit bloat as anti-goals. 

---

# 70. Failure-Mode Design

The architecture is intended to tolerate:

* unavailable models,
* broken tools,
* malformed input,
* invalid derivations,
* contradictory evidence,
* stale memory,
* resource exhaustion,
* scheduler starvation,
* verifier disagreement,
* calibration drift,
* partial network failure,
* interrupted execution,
* failed action confirmation,
* rejected self-modification.

Every case follows explicit policy.

---

# 71. Cognitive Quality Metrics

The runtime SHOULD expose:

### Epistemic

* calibration error,
* contradiction rate,
* evidence duplication rate,
* unsupported admission rate,
* provisional-to-confirmed ratio.

### Control

* scheduling efficiency,
* starvation rate,
* branch productivity,
* graph utilization,
* adaptation frequency.

### Resource

* utilization,
* reservation efficiency,
* budget waste,
* cost per committed result,
* latency distribution.

### Governance

* verification coverage,
* rejection rate,
* escalation rate,
* rollback rate,
* policy violations.

### Learning

* improvement after adaptation,
* regression rate,
* shadow/live divergence,
* patch acceptance rate.

### Provenance

* replay success,
* causal coverage,
* missing-lineage rate,
* verifier drift.

---

# 72. Conformance Levels

## Level A — Core

Must provide:

* typed cognitive objects,
* bounded execution,
* governance gates,
* single commit authority,
* event sourcing,
* reward firewall.

## Level B — Adaptive

Adds:

* declarative cognitive graphs,
* resource reservations,
* adaptive scheduling,
* per-claim trust,
* parallel speculation,
* learning proposals.

## Level C — Reflexive

Adds:

* governed self-modification,
* proof-carrying patches,
* architecture search,
* learned scheduling,
* distributed reasoning,
* external governance integration.

The target specification is **Level C**.

---

# 73. Reference Invariant Set

The canonical build MUST fail if any of these are violated:

```text
INV-001  No unbounded executable path
INV-002  No write outside commit authority
INV-003  No reward → belief truth
INV-004  No unjudged untrusted proposal admission
INV-005  No unproven irreversible operation when proof is required
INV-006  No governance self-approval for protected surfaces
INV-007  No exact equality from uncertain similarity
INV-008  Every cognition-affecting operation is provenance-linked
INV-009  Every budget charge has a declared scope
INV-010  Every failure affecting cognition is observable
INV-011  Required verifier independence is preserved
INV-012  Simulation is not confused with observation
INV-013  External action outcome is not assumed without confirmation
INV-014  Contradiction does not imply automatic state corruption
INV-015  Configuration changes are versioned
INV-016  Learned scheduling cannot bypass hard constraints
INV-017  Starvation is detectable
INV-018  Protected policy surfaces are capability-restricted
INV-019  Replay can reconstruct committed logical state
INV-020  Rollback/compensation semantics are explicit
```

---

# 74. Canonical Architecture Diagram

```text
┌────────────────────────────────────────────────────────────────────────┐
│                         REFLEXIVE GOVERNANCE                           │
│ architecture search │ learning │ shadow CI │ proof-carrying changes   │
│ external approval │ capability root │ protected policy surfaces       │
├────────────────────────────────────────────────────────────────────────┤
│                         META-CONTROLLER                                │
│ context │ objectives │ drives │ history │ utility │ adaptation policy  │
│          → selects a Cognitive Program                                 │
├────────────────────────────────────────────────────────────────────────┤
│                    DECLARATIVE COGNITIVE GRAPH                         │
│ conditional │ parallel │ iterative │ event-driven │ speculative        │
│ retrieve │ infer │ propose │ question │ simulate │ plan │ consolidate  │
├────────────────────────────────────────────────────────────────────────┤
│                         SCHEDULER / MARKET                              │
│ hard filters │ capabilities │ reservations │ utility │ learned ranking │
│ fairness │ deadlines │ deterministic arbitration                       │
├────────────────────────────────────────────────────────────────────────┤
│                       GOVERNANCE / VERIFICATION                         │
│ type │ provenance │ trust │ proof │ judge │ simulation │ risk │ policy │
├────────────────────────────────────────────────────────────────────────┤
│                         UNIFIED COMMIT LEDGER                           │
│          every durable cognitive mutation passes here                 │
├────────────────────────────────────────────────────────────────────────┤
│                        UNIFIED MEMORY FABRIC                            │
│ working │ semantic │ episodic │ procedural │ schema │ counterfactual  │
│ attention │ provenance │ bounded caches / indexes / graph views       │
├────────────────────────────────────────────────────────────────────────┤
│                         COGNITIVE SUBSTRATES                            │
│ NAL/symbolic │ exact │ probabilistic │ neural │ heuristic │ peer       │
│                     all connected through typed ports                  │
├────────────────────────────────────────────────────────────────────────┤
│                          EFFECT SYSTEM                                  │
│ simulation → authorization → sandbox → execute → confirm → compensate │
├────────────────────────────────────────────────────────────────────────┤
│                  EVENT / CAUSAL PROVENANCE FABRIC                      │
│ append-only log │ correlation IDs │ state hashes │ replay │ audit      │
└────────────────────────────────────────────────────────────────────────┘
```

---

# 75. Canonical Cognitive Flow

```text
STIMULUS
   ↓
OBSERVATION
   ↓
NORMALIZATION
   ↓
CORRELATION ID
   ↓
WORK GENERATION
   ↓
META-CONTROLLER SELECTS PROGRAM
   ↓
HARD GOVERNANCE FILTER
   ↓
RESOURCE RESERVATION
   ↓
PARALLEL / SPECULATIVE COGNITION
   ├── retrieval
   ├── symbolic inference
   ├── exact computation
   ├── neural proposal
   ├── question generation
   ├── simulation
   └── planning
   ↓
VERIFICATION PORTFOLIO
   ↓
PER-CLAIM TRUST / EVIDENCE CHECK
   ↓
RISK + REVERSIBILITY
   ↓
SCHEDULER ARBITRATION
   ↓
BUDGET SETTLEMENT
   ↓
UNIFIED COMMIT LEDGER
   ↓
STATE FOLD
   ↓
ACTION PIPELINE
   ↓
ENVIRONMENT FEEDBACK
   ↓
LEARNING PROPOSALS
   ↓
SHADOW VALIDATION
   ↓
CONSOLIDATION
   ↓
CAUSAL TRACE FINALIZATION
   ↓
NEXT CONTROL STATE
```

---

# 76. What Is Fixed and What Is Flexible

## Fixed

The following are architectural laws:

* epistemic firewall,
* boundedness,
* single commit authority,
* provenance requirements,
* required governance,
* exact/similarity separation,
* protected self-modification,
* required verification,
* failure observability.

## Flexible

The following are configuration dimensions:

* topology,
* stage composition,
* scheduler,
* economic policy,
* memory backend,
* proposer portfolio,
* verifier portfolio,
* attention mechanism,
* drive set,
* truth implementation,
* model routing,
* concurrency,
* autonomy levels,
* learning methods,
* multi-agent topology,
* deployment topology.

Thus the architecture is simultaneously **strict at the invariant layer and permissive at the mechanism layer**.

---

# 77. Architectural Philosophy

The target architecture deliberately creates an asymmetry:

> **The epistemic constitution is rigid.
> The cognitive machinery is fluid.**

Reasoning can become:

* deeper,
* faster,
* more parallel,
* more distributed,
* more neural,
* more symbolic,
* more exploratory,
* more economically optimized,
* more self-adaptive.

But adaptation occurs **inside an invariant-preserving control envelope**.

This is the central synthesis across the supplied algebraic, control-theoretic, information-space, and transaction-oriented designs. 

---

# 78. Ultimate Design Principle

The entire architecture can be summarized as:

$$
\boxed{
\text{Intelligence}
=
\text{Proposal Power}
\times
\text{Control Expressiveness}
\times
\text{Verification}
\times
\text{Resource Efficiency}
\times
\text{Learning}
}
$$

subject to:

$$
\boxed{
\text{Safety}
=
\text{Epistemic Integrity}
\land
\text{Boundedness}
\land
\text{Governance}
\land
\text{Provenance}
\land
\text{Commit Discipline}
}
$$

and:

$$
\boxed{
\mathcal R_{\mathrm{valid}}
=
\{r \in \mathcal R \mid \Phi(r)=\mathrm{true}\}
}
$$

The purpose of the design space is not to maximize every coordinate independently.

It is to maximize **useful cognitive freedom inside the feasible region**.

---

# 79. Final Specification

**SeNARS⁺ is a typed, event-sourced, resource-bounded, neuro-symbolic cognitive control plane in which all meaningful cognition is represented as governed transactions executed by a declarative, adaptive control graph over a unified memory fabric.**

Its defining properties are:

* **one cognitive state,**
* **one transaction model,**
* **one logical commit authority,**
* **one provenance model,**
* **one governance vocabulary,**
* **one resource economy,**
* **many pluggable cognitive substrates,**
* **many interchangeable schedulers,**
* **many verification strategies,**
* **many operating profiles,**
* **bounded and interruptible execution,**
* **per-claim epistemic trust,**
* **simulation before consequential action,**
* **governed learning and self-modification,**
* **causal replay,**
* **distributed scalability,**
* **configuration-defined behavior rather than hard-coded topology.**

The resulting system is not a pipeline with optional extras.

It is a **general cognitive operating architecture** whose computational, epistemic, economic, and reflexive mechanisms are all instances of the same underlying control model.

The specification above deliberately resolves the source documents into a single normative architecture rather than retaining their competing coordinate systems. The strongest synthesis choices are the declarative cognitive graph, typed transaction/commit model, economic resource layer, per-claim trust, causal provenance, verification portfolio, and governed reflexive tower.   
