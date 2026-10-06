# Ω — The Cognitive Control Plane
## A Cybernetic Specification for Bounded, Governed, Adaptive Reasoning

---

## §0 — Axiomatic Foundation

### 0.1 The Cybernetic Thesis

A reasoner is a **resource-bounded, epistemically-typed, reflexive control system** whose plant is its own knowledge state, whose actuators are inference operations, whose sensors are admission gates and self-monitors, and whose reference signals are drives, goals, and epistemic ideals.

The system's purpose is not "to think" but to **transform observations into justified commitments under scarcity**, maintaining homeostatic stability while pursuing teleological objectives, all within hard resource envelopes.

### 0.2 The Seven Cybernetic Postulates

| # | Postulate | Formal Statement |
|---|---|---|
| P1 | **Boundedness** | All cognitive resources are finite. Forgetting, yielding, and degradation are constitutive, not contingent. |
| P2 | **Separation** | Epistemic state (what is believed) and teleological state (what is desired) occupy disjoint type spaces with no reward→truth channel. |
| P3 | **Provenance** | State is the fold of an append-only event log. No mutation exists without a corresponding event. |
| P4 | **Distrust** | All proposers (neural, symbolic, reflexive, external) are untrusted by default. Only the commit authority confers epistemic status. |
| P5 | **Observability** | The controller's decisions are themselves observable, correlated, and replayable. Control is not opaque. |
| P6 | **Governance** | Self-modification authority is stratified. No level may approve its own modification without external arbitration. |
| P7 | **Continuity** | Cognition must not halt on partial failure. Degradation to a weaker mode is always preferable to cessation. |

### 0.3 The Fundamental Control Equation

At each control instant $t$, the system evolves according to:

$$\dot{\mathbf{X}}(t) = \underbrace{\Pi\bigl(\mathbf{X}(t),\; \mathbf{o}(t),\; \mathbf{r}(t),\; \mathbf{B}(t)\bigr)}_{\text{control law}} - \underbrace{\gamma(t)\,\mathbf{X}(t)}_{\text{thermodynamic decay}} + \underbrace{\varepsilon\bigl(\mathbf{I}(t)\bigr)}_{\text{epistemic boundary}}$$

Where:
- $\mathbf{X}(t)$ is the cognitive state vector (beliefs, goals, attention, resources, drives)
- $\Pi$ is the meta-controller selecting cognitive programs
- $\mathbf{o}(t)$ is the observation vector (external stimuli + internal telemetry)
- $\mathbf{r}(t)$ is the reference signal (goals, drives, epistemic ideals)
- $\mathbf{B}(t)$ is the resource state vector
- $\gamma(t)$ is the decay rate (governed by cognitive temperature)
- $\varepsilon$ is the epistemic boundary filter

The **error signal** driving the system:

$$\mathbf{e}(t) = \mathbf{r}(t) - \hat{\mathbf{y}}(t)$$

Where $\hat{\mathbf{y}}(t)$ is the estimated current state (drive levels, contradiction count, budget pressure, goal progress, quality gap).

---

## §1 — System Architecture: The Five-Plane Model

The architecture is organized as five coupled planes, each a control subsystem with its own feedback loop:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PLANE 5 · META-CONTROL                                │
│  Deliberative controller · Program selection · Governance · Reflexivity  │
├─────────────────────────────────────────────────────────────────────────┤
│                    PLANE 4 · RESOURCE ECONOMY                            │
│  Budget office · Reservation market · Pricing · Backpressure · Decay     │
├═════════════════════════════════════════════════════════════════════════╡
│                    PLANE 3 · COGNITIVE CONTROL                           │
│  Stage graph · Scheduler · Claim queue · Focus management · Arbitration  │
├═════════════════════════════════════════════════════════════════════════╡
│                    PLANE 2 · EPISTEMIC KERNEL                            │
│  Inference rules · Truth algebra · Commit ledger · Gates · Type system   │
├─────────────────────────────────────────────────────────────────────────┤
│                    PLANE 1 · SUBSTRATE FABRIC                            │
│  Term algebra · Memory · Provenance log · Correlation manifold           │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Plane Coupling Laws

| Coupling | Direction | Constraint |
|---|---|---|
| Plane 5 → Plane 3 | Meta-controller proposes stage-graph edits | Edits are proposals; governance gates apply |
| Plane 4 → Plane 3 | Budget office constrains scheduler | No operation executes without reservation |
| Plane 3 → Plane 2 | Scheduler selects operators | Only typed, gated operators are selectable |
| Plane 2 → Plane 1 | Commit ledger writes events | Single write path; all mutations pass through |
| Plane 1 → Plane 5 | Provenance informs meta-control | Observability enables adaptive control |
| All planes → Provenance | Every plane emits events | Correlation IDs thread all layers |

### 1.2 The Cybernetic Loop Structure

The system operates as a **heterochronous tower** of nested control loops, each at its own clock rate:

| Level | Name | Clock | Function | Budget Slice |
|---|---|---|---|---|
| L0 | Reflex Arc | Sub-cycle (interrupt) | Safety veto, fast judgment, game tick | Minimal |
| L1 | Cognitive Tick | Per-cycle | Perceive→reason→commit→learn | Primary |
| L2 | Deliberation | Per-turn | Multi-cycle planning, narration, action | Moderate |
| L3 | Consolidation | Every K cycles | Decay, eviction, episodic merge, schema induction | Low |
| L4 | Identity | ≪ 1/cycle | Strategy evolution, constitution review, capability scaffold | Minimal |

**Coupling rules:**
- Lower levels may **interrupt** higher levels (reflex veto)
- Higher levels **configure** lower levels (stage graph edits)
- All levels share the **same commit ledger** and **same event log**
- Each level has its own budget allocation; allocations sum to the global budget

---

## §2 — State Space & Ontology

### 2.1 The Cognitive State Vector

$$\mathbf{X} = \langle \mathcal{K},\; \mathcal{G},\; \mathcal{A},\; \mathcal{D},\; \mathcal{B},\; \mathcal{T},\; \mathcal{H} \rangle$$

| Component | Type | Content |
|---|---|---|
| $\mathcal{K}$ | Knowledge store | Beliefs, concepts, links, episodic traces |
| $\mathcal{G}$ | Goal space | Active goals, desires, obligations, plans |
| $\mathcal{A}$ | Attention field | Priority distributions, focus allocations |
| $\mathcal{D}$ | Drive vector | Homeostatic setpoints, current levels, decay rates |
| $\mathcal{B}$ | Budget state | Reservations, allocations, consumption history |
| $\mathcal{T}$ | Trust field | Per-source, per-claim, per-operation trust values |
| $\mathcal{H}$ | Event history | Append-only log, correlation graph, snapshots |

### 2.2 The Epistemic Type System

All cognitive objects carry a **type tag** determining their mutation authority:

| Type | Value Structure | Mutation Authority | Decay Policy |
|---|---|---|---|
| **Belief** | $(f, c)$ — frequency × confidence | Evidence only | Truth decays on invalidation |
| **Goal** | $(d, c)$ — desire × confidence | Reward + evidence | Progress-based |
| **Question** | $(\text{priority}, \text{EIG})$ | Curiosity + relevance | Attention decay |
| **Hypothesis** | $(\text{plausibility}, \text{evidence\_req})$ | Provisional; requires confirmation | Timeout |
| **Assumption** | $(\text{scope}, \text{validity})$ | Local reasoning context | Scope exit |
| **Plan** | $(\text{utility}, \text{feasibility}, \text{risk})$ | Goal progress + simulation | Obsolescence |
| **Obligation** | $(\text{priority}, \text{deadline})$ | Normative commitment | Deadline expiry |
| **ActionIntent** | $(\text{reversibility}, \text{authorization})$ | Governance decision | Context change |
| **Lesson** | $(\text{source}, \text{trust}, \text{applicability})$ | Learning consolidation | Supersession |

### 2.3 The Epistemic Firewall (Type-Level Invariant)

$$\forall\, \text{op} \in \text{Operations}:\quad \text{type}(\text{op}) \in \{\text{teleological}, \text{attention}\} \;\Longrightarrow\; \text{target}(\text{op}) \cap \text{Truth}.\{f, c\} = \emptyset$$

This is enforced **structurally**, not by convention:
- The type system makes reward→truth mutation a **type error**
- Runtime enforcement: any operation attempting to write to `Truth.frequency` or `Truth.confidence` from a teleological source triggers an `EpistemicFirewallViolation`
- The commit ledger rejects such transactions before they reach state

### 2.4 Substrate Isolation

Multiple inference substrates coexist under strict isolation:

| Substrate | Role | Boundary |
|---|---|---|
| Uncertain symbolic (NAL) | Core inference, truth algebra | Trusted kernel |
| Exact computation (rewriting) | Deterministic calculation | Gated oracle; never unions on similarity |
| Neural/LM | Proposal generation, pattern completion | Untrusted proposer; all outputs judged |
| Probabilistic/statistical | Calibration, scoring | Advisory; never commits directly |
| Reflexive/fast | Safety veto, game response | Interrupt-level; minimal state access |

**Isolation invariant:** No substrate may directly write to another's memory. All cross-substrate communication is mediated by **typed proposals** passing through the commit ledger.

---

## §3 — The Cognitive Transaction Model

### 3.1 Universal Transaction Type

All cognition is expressed as a **Cognitive Transaction** — the single, unified unit of cognitive work:

```
CognitiveTransaction {
  id:               TransactionId
  correlationId:    CorrelationId        // threads stimulus → outcome
  parentId:         TransactionId?       // causal ancestry
  kind:             TransactionKind      // perception | inference | proposal | judgment |
                                         // commit | action | learning | forgetting |
                                         // consolidation | simulation | self-modification
  inputs:           CognitiveObject[]    // typed read set
  outputs:          Candidate[]          // typed write candidates
  effects:          EffectDeclaration[]  // declared side effects
  budget:           BudgetReservation    // pre-reserved resources
  capabilities:     CapabilityToken[]    // what this transaction may do
  trust:            TrustProfile         // source quality, calibration
  risk:             RiskProfile          // reversibility, blast radius
  failurePolicy:    FailurePolicy        // what happens on fault
  proofObligations: ProofObligation[]    // what must be verified
  epistemicType:    EpistemicType        // belief | goal | question | ...
}
```

### 3.2 Transaction Lifecycle

Every transaction follows the same governed pipeline:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ GENERATE │───▶│ VALIDATE │───▶│ JUDGE    │───▶│ COMMIT   │
│ (propose)│    │(type+bud)│    │(verify)  │    │(ledger)  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
  Event:          Event:          Event:          Event:
  tx.generated    tx.validated    tx.judged       tx.committed
```

At each stage, the transaction may be:
- **Admitted** (proceed to next stage)
- **Rejected** (typed refusal event emitted)
- **Deferred** (placed in pending queue with timeout)
- **Degraded** (processed at lower fidelity)
- **Escalated** (requires higher governance authority)

### 3.3 The Commit Ledger

**There is exactly one write path into durable state.** All mutations — perceptions, derivations, proposals, learning, actions, self-modifications — pass through a single **Commit Ledger**:

```
Candidate
  → Normalize (canonical form)
  → Type-Check (epistemic type validation)
  → Evidence-Independence Check (no double-counting)
  → Firewall Check (reward ∉ truth mutations)
  → Proof / Judge / Simulation (verification portfolio)
  → Rank (utility × trust × specificity)
  → Budget Settlement (deduct reserved, refund unused)
  → Risk Classification (reversibility × blast radius)
  → Commit or Reject (single atomic decision)
  → Emit Event (append to provenance log)
```

**Invariants of the Commit Ledger:**
1. **Atomicity:** A transaction either fully commits or fully rejects
2. **Ordering:** Events are totally ordered; the log is the source of truth
3. **Completeness:** Every state mutation has a corresponding commit event
4. **Independence:** The verifier checking commits shares no code with the engine
5. **Reversibility tracking:** Each commit records its reversibility class

### 3.4 Transaction Kinds and Their Governance

| Kind | Proposer | Judge | Governance Level | Reversibility |
|---|---|---|---|---|
| Perception | External sensor | Perception gate | Low | N/A (informational) |
| Inference | NAL rules | Truth algebra | Low | High (retraction) |
| Proposal | LM / reflex / peer | Manifold + symbolic | Medium | High (rejection) |
| Learning | RLFP / schema induction | Shadow validation | Medium | Medium (rollback) |
| Action | Planner | Risk classifier + autonomy ladder | High | Variable |
| Self-modification | Meta-controller | External governance | Maximum | Low (code) |
| Consolidation | Consolidation loop | Budget + decay policy | Low | Medium |

---

## §4 — Control Architecture: The Cognitive Control Plane

### 4.1 The Stage Graph (Declarative Control Flow)

Control flow is **data**, not code. The system's cognitive sequence is a typed, conditional directed acyclic graph (or cyclic graph with well-founded loop edges):

```
StageGraph {
  nodes: StageNode[]
  edges: StageEdge[]
  invariants: GraphInvariant[]    // static predicates that must hold
}

StageNode {
  id:          StageId
  kind:        StageKind           // perceive | attend | infer | propose | verify |
                                   // commit | plan | act | learn | consolidate | simulate
  execute:     Middleware<CycleCtx> // the operation
  budget:      BudgetScopeId       // which budget pays
  failure:     FailurePolicy       // skip | abort | degrade | retry
  preconditions:  Predicate[]      // must hold to enter
  postconditions: Predicate[]      // must hold on exit
}

StageEdge {
  from:     StageId
  to:       StageId
  guard:    (ctx: CycleCtx) → boolean   // conditional traversal
  budget:   BudgetScopeId?              // edge may cost resources
  priority: number                      // for concurrent edges
}
```

**Key properties:**
- Stage graphs are **versioned, loadable, revertable** — like rule tables
- Multiple graphs may coexist (different cognitive programs for different situations)
- Graph edits are **governed proposals** (Plane 5 → governance → Plane 3)
- Static invariants are checkable: e.g., "no path from `infer` to `commit` bypasses `verify`"

### 4.2 The Scheduler (Adaptive Operator Selection)

The scheduler answers: **"What happens next, and with what budget?"**

The scheduler operates in **three modes**, selectable by the meta-controller:

| Mode | Mechanism | When |
|---|---|---|
| **Priority Queue** | Pop highest-priority claim from bounded bag | Default, low-pressure |
| **Economic** | Score = expected utility / marginal cost; select max | Medium-pressure, complex decisions |
| **Learned** | Policy network scores enabled operators; gates still constrain | High-adaptation, proven provenance |

**The Claim Queue:**

All schedulable work is expressed as a **Claim**:

```
Claim {
  operator:     CognitiveOperation    // what to do
  priority:     number                // computed from drives, budgets, goals
  costVector:   BudgetVector          // expected resource consumption
  judgmentScore: number?              // pre-judgment calibration (if available)
  expiry:       Timestamp             // when this claim becomes stale
  correlationId: CorrelationId       // causal threading
  epistemicType: EpistemicType       // what kind of cognitive work
}
```

The tick is:
```
while (budget.affords() ∧ queue ≠ ∅):
    claim ← pop(queue)          // highest priority
    if (gates.admit(claim)):    // governance check
        execute(claim)          // run the operation
        emit(event)             // provenance
        budget.settle(claim)    // resource accounting
```

### 4.3 The Meta-Controller (Plane 5)

The meta-controller is itself a **bounded, anytime reasoner** whose domain is control:

**Inputs:** Control telemetry (starvation events, contradiction rate, derivation yield, veto frequency, trace grades, drive levels, budget pressure)

**Outputs:** `CognitiveProgram` proposals

```
CognitiveProgram {
  stageGraph:        StageGraph          // which graph to run
  budgetAllocation:  BudgetAllocation    // how to divide resources
  proposerPortfolio: Map<Proposer, Weight>  // who generates
  verificationPolicy: VerificationPolicy   // how to check
  autonomyPolicy:    AutonomyPolicy      // what's authorized
  learningPolicy:    LearningPolicy      // what may adapt
  failurePolicy:     FailurePolicy       // degradation behavior
}
```

**The meta-controller's control law:**

$$\pi^*(t) = \arg\max_{\pi \in \Pi} \; \mathbb{E}\left[\sum_{t'} \gamma^{t'-t} \left(\Delta K_{t'} + \Delta G_{t'} + \Delta H_{t'} - \lambda_C C_{t'} - \lambda_R R_{t'}\right)\right]$$

Subject to:
- $\pi$ must satisfy all governance predicates
- $\pi$ must be within budget
- $\pi$ must preserve the epistemic firewall
- $\pi$ must maintain provenance completeness

**Critical constraint:** The meta-controller **proposes** programs; it does not **apply** them. Program installation passes through governance and is hot-swapped at cycle boundaries.

### 4.4 The Arbitration Algebra

When multiple proposers generate competing candidates, arbitration follows a typed algebra:

```
arbitrate(proposers: Proposer[], candidates: Candidate[]) → Decision

Operations:
  veto(candidate)           // any proposer with veto authority blocks
  quorum(k, candidates)     // k-of-n must agree
  weight(candidate)         // confidence-weighted merge
  demote(proposer)          // vetoed proposer's weight decays
  abstain(candidate)        // insufficient evidence → question injection
```

**Epistemic firewall in arbitration:** A proposal tagged `teleological` can never be merged into a `belief` slot regardless of quorum, weight, or proposer authority.

---

## §5 — Resource Economy

### 5.1 Budget Dimensions

| Dimension | Unit | Meaning |
|---|---|---|
| `cycles` | count | Control steps |
| `derivations` | count | Symbolic inference steps |
| `premises` | count | Premise selections |
| `memoryOps` | count | Memory reads/writes |
| `lmCalls` | count | Neural model invocations |
| `tokens` | count | Token throughput |
| `latency` | ms | Wall-clock time |
| `attention` | slots | Focus capacity |
| `risk` | quota | Safety/irreversibility budget |
| `humanAttention` | count | Approval/clarification requests |

### 5.2 The Reservation Protocol

Before executing any transaction:

```
1. RESERVE:    B_available ← B_available − B_requested
2. EXECUTE:    run the operation
3. SETTLE:     B_settled = B_reserved − B_unused
4. REFUND:     B_available ← B_available + B_unused
```

**Properties:**
- No operation executes without a reservation
- Unused resources are refunded (no waste)
- Over-reservation is detectable (starvation ≠ health)
- All reservations and settlements are **events** (auditable)

### 5.3 Utility-Based Pricing

Operations are scored by expected marginal utility per unit resource:

$$\text{score}(\text{op}) = \frac{\hat{\Delta K} + \hat{\Delta G} + \hat{\Delta H}}{\lambda_C \hat{C} + \lambda_R \hat{R} + \lambda_H \hat{H}_{\text{human}}}$$

Where:
- $\hat{\Delta K}$ = expected epistemic gain
- $\hat{\Delta G}$ = expected goal progress
- $\hat{\Delta H}$ = expected homeostatic improvement
- $\hat{C}$ = expected resource cost
- $\hat{R}$ = expected risk
- $\hat{H}_{\text{human}}$ = expected human attention cost
- $\lambda$ = Lagrange multipliers (tunable by meta-controller)

### 5.4 Pressure-Responsive Behavior

| Pressure Level | Behavior |
|---|---|
| Low | Explore, enrich, elaborate; high proposal diversity |
| Medium | Prioritize goals and proofs; reduce exploration |
| High | Conserve; degrade to symbolic; minimize LM calls |
| Critical | Halt non-essential work; emit distress signal; preserve state |

### 5.5 Thermodynamic Decay

Forgetting is governed by a cognitive temperature parameter:

$$P(\text{retain item}) \propto \exp\left(-\frac{\Delta E_{\text{item}}}{T(t)}\right)$$

Where:
- High $T$ (curiosity, exploration) → broad retention, slow decay
- Low $T$ (competence, exploitation) → selective retention, fast decay of low-value items
- $T$ is modulated by drives and meta-controller

---

## §6 — Trust, Risk, and Governance Manifold

### 6.1 The Trust Field

Trust is a **continuous field** over all candidates, computed from multiple sources:

$$T(\text{candidate}) = f\bigl(\text{sourceQuality},\; \text{reputation},\; \text{calibration},\; \text{specificity},\; \text{corroboration}\bigr)$$

Admission is a **soft gate** with three bands:

| Band | Trust Range | Action |
|---|---|---|
| **Act** | $T > \theta_{\text{act}}$ | Auto-commit |
| **Review** | $\theta_{\text{block}} < T \leq \theta_{\text{act}}$ | Provisional commit with decay; escalate |
| **Block** | $T \leq \theta_{\text{block}}$ | Reject; emit typed refusal event |

### 6.2 The Risk-Reversibility Manifold

Every candidate receives a **governance profile**:

```
GovernanceProfile {
  trust:           number    // calibrated source/proposal trust
  confidence:      number    // epistemic confidence
  risk:            number    // expected harm / irreversibility
  reversibility:   number    // ease of rollback
  blastRadius:     number    // scope of impact
  proofStatus:     ProofStatus
  judgeStatus:     JudgeStatus
  simulationStatus: SimulationStatus
}
```

The commit path is determined by a **policy surface**:

| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| High | Low | High | Auto-commit |
| High | Medium | High | Shadow-commit → promote |
| Medium | Low | High | Provisional commit with decay |
| Medium | Medium | Medium | Human review |
| Low | High | Low | Reject |
| Any | High | Low | Strong proof OR human approval required |
| Any | Any | Irreversible | Maximum governance; never auto |

### 6.3 The Autonomy Ladder

| Rung | Authority | Scope |
|---|---|---|
| 0 — Observe | Read-only; no state mutation | All |
| 1 — Propose | Generate candidates; no commit | All |
| 2 — Sandbox | Execute in isolated environment; no durable effect | Bounded |
| 3 — Low-risk auto | Auto-commit for low-risk, high-reversibility | Gated |
| 4 — Human-approved | Requires explicit human authorization | Irreversible |

**Invariant:** The system can never elevate its own autonomy rung. Elevation requires external governance action.

### 6.4 The Verification Portfolio

Candidates may be verified by multiple mechanisms:

| Mechanism | What it checks | When |
|---|---|---|
| Schema validation | Type correctness, structural well-formedness | Always |
| Symbolic proof | Logical validity, derivation correctness | Inference commits |
| Calibrated judge | Statistical calibration, Brier scoring | Neural proposals |
| Shadow execution | Behavioral equivalence in sandbox | Self-modification |
| Simulation | Predicted outcome vs. actual | Actions |
| Human approval | Expert judgment | High-risk, irreversible |
| Independence check | Evidence not double-counted | Belief revision |

### 6.5 Failure Polarity

| Boundary | Default Polarity | Rationale |
|---|---|---|
| Ingress (untrusted → memory) | **Fail-closed** | Unjudged input must not enter |
| Egress (derived → memory) | **Fail-open** | Provider fault must not halt cognition |
| Internal (cycle operations) | **Fail-open, logged** | Continuity of thought |
| Self-modification | **Fail-closed** | Ungoverned change is unacceptable |
| Irreversible actions | **Fail-closed** | No unauthorized permanent effects |

---

## §7 — Provenance and Causal Observability

### 7.1 The Correlation Manifold

Every cognitive object carries a **provenance envelope**:

```
Provenance {
  correlationId:   CorrelationId     // threads stimulus → outcome
  stimulusId:      StimulusId        // originating external input
  sessionId:       SessionId         // session scope
  cycleId:         CycleId           // which cycle
  transactionId:   TransactionId     // which transaction
  proposerId:      ProposerId        // who suggested
  judgeId:         JudgeId?          // who verified
  proofId:         ProofId?          // formal proof reference
  parentId:        ProvenanceId?     // causal parent
  budgetContext:   BudgetSnapshot    // resource state at creation
  failureContext:  FailureInfo?      // if degraded/failed
}
```

### 7.2 The Event Log

State is the **fold** of an append-only event log:

$$\mathbf{X}(t) = \text{fold}(\text{events}_0, \text{events}_1, \ldots, \text{events}_t)$$

Event types include:

| Category | Events |
|---|---|
| Cognitive | `task.admitted`, `derivation.produced`, `belief.committed`, `goal.updated` |
| Control | `stage.entered`, `stage.exited`, `graph.installed`, `scheduler.selected` |
| Budget | `budget.reserved`, `budget.settled`, `budget.exhausted`, `budget.transferred` |
| Governance | `gate.admitted`, `gate.rejected`, `veto.exercised`, `autonomy.escalated` |
| Learning | `strategy.adapted`, `rule.proposed`, `schema.induced`, `patch.generated` |
| Failure | `engine.fault`, `judge.timeout`, `provider.down`, `starvation.detected` |
| Meta | `program.proposed`, `program.installed`, `meta.goal.injected` |

### 7.3 Replay and Verification

**Replay:** Given the event log, the cognitive state can be deterministically reconstructed:

```
replayCognitiveState(events) → CognitiveState
```

**Verification:** A standalone verifier (sharing no code with the engine) can independently check:
- Derivation validity (truth table transcribed, not imported)
- Evidence independence
- Firewall compliance
- Budget consistency
- Type correctness

**Drift detection:** Periodic tests pin the divergence between engine and verifier truth tables.

### 7.4 Causal Queries Enabled

The correlation manifold enables:
- "Which user message caused this belief?"
- "Which derivation led to this action?"
- "Which judge vetoed this candidate?"
- "Which budget exhaustion caused this degradation?"
- "Which learning episode changed this strategy?"
- "Which contradiction triggered this repair loop?"

---

## §8 — Learning and Governed Self-Modification

### 8.1 The Learning Hierarchy

| Level | What changes | Authority | Governance |
|---|---|---|---|
| L0 — Parameters | Attention weights, sampling probabilities | Auto (low-risk) | Logged |
| L1 — Strategies | Which inference strategy, which sampler | Proposal or auto | Budget-gated |
| L2 — Rules | New inference rules, rule promotions | Proposal | Proof + shadow validation |
| L3 — Architecture | Stage graph edits, budget topology | Proposal | Shadow CI + governance |
| L4 — Code | Source modification, self-patches | Proposal only | External CI + human approval |
| L5 — Constitution | Governance rules, firewall, autonomy | **Never self-applied** | External only |

### 8.2 The Self-Modification Pipeline

```
Observation
  → Lesson extraction
  → Hypothesis formation
  → Strategy/patch proposal
  → Shadow execution (isolated environment)
  → Full CI validation (tests, invariants, benchmarks)
  → Risk classification
  → Governance routing (auto | human | external)
  → Bounded deployment (if approved)
  → Trace evaluation (post-deployment)
  → Retention or rollback
```

### 8.3 The Governance Invariant

$$\forall\, \text{level} \in \{L0, \ldots, L5\}: \quad \text{approve}(\text{level}) \notin \text{authority}(\text{level})$$

No level may approve its own modification. Approval authority always comes from **above** or **outside**.

### 8.4 Learning as Ledger Proposals

All learning produces **proposals to the commit ledger**, never direct state mutations:

- RLFP outputs → strategy change proposals
- Schema induction → rule promotion proposals
- Distillation → weight update proposals
- Self-assessment → parameter tuning proposals
- Code generation → patch proposals

Each passes through the same transaction lifecycle as any other cognitive operation.

---

## §9 — Graceful Degradation

### 9.1 The Degradation Hierarchy

| Level | Trigger | Behavior |
|---|---|---|
| Normal | All systems operational | Full cognitive pipeline |
| Reduced | LM unavailable | Symbolic-only inference; no neural proposals |
| Minimal | Budget critical | Core perception + memory; no inference |
| Reflexive | Time-critical | Safety veto only; no deliberation |
| Dormant | Shutdown signal | State preservation; event log flush |

### 9.2 Degradation Invariants

1. **No silent failure:** Every degradation emits a typed event
2. **No undefined behavior:** Every fault has a declared response
3. **Continuity preference:** Degradation is always preferred to halt
4. **Recovery path:** Every degraded mode has a defined recovery condition
5. **Budget preservation:** Degradation never increases resource consumption

### 9.3 The Failure Policy Map

```
FailurePolicy = {
  timeout:        retry(n) | degrade | abort
  parse-error:    reject | fallback-parser
  provider-down:  symbolic-fallback | queue-for-retry
  budget-exhaust: skip | backpressure | degrade
  gate-rejected:  typed-refusal-event
  engine-fault:   emit-fault-event + degrade
  judge-unavailable: symbolic-baseline
  memory-full:    evict-LRU | consolidate | reject-write
}
```

---

## §10 — Formal Invariants (The Constitution)

### 10.1 Hard Invariants (Never Violated)

| # | Invariant | Formal Statement |
|---|---|---|
| I1 | Epistemic Firewall | $\forall\, \text{reward signal } r: \; r \not\to \text{Truth}.\{f, c\}$ |
| I2 | Single Commit Authority | $\exists!\, \text{commit path}: \forall\, \text{mutation } m: \; m \text{ passes through commit ledger}$ |
| I3 | Provenance Completeness | $\forall\, \text{mutation } m: \; \exists\, \text{event } e: \; e \text{ records } m$ |
| I4 | Bounded Cognition | $\forall\, \text{path } p: \; \text{resources}(p) < \infty$ |
| I5 | Untrusted Proposers | $\forall\, \text{proposer } p \notin \text{kernel}: \; p \text{ outputs are proposals, not truths}$ |
| I6 | No Self-Approval | $\forall\, \text{level } l: \; \text{approve}(l) \notin \text{authority}(l)$ |
| I7 | Verifier Independence | $\text{verifier code} \cap \text{engine code} = \emptyset$ |
| I8 | Substrate Isolation | $\text{exact substrate} \not\cup \text{ on uncertain similarity}$ |
| I9 | No Silent Failure | $\forall\, \text{fault } f \text{ affecting cognition}: \; \exists\, \text{event}(f)$ |
| I10 | Irreversible Action Gate | $\forall\, \text{irreversible action } a: \; \text{risk}(a) \wedge \text{auth}(a) \text{ before execution}$ |

### 10.2 Soft Invariants (Maintained Under Normal Operation)

| # | Invariant | Degradation Behavior |
|---|---|---|
| S1 | Full judgment coverage | Degrade to symbolic baseline |
| S2 | Complete correlation threading | Minimum: cycle-level correlation |
| S3 | Adaptive scheduling | Fall back to priority queue |
| S4 | Multi-substrate operation | Single-substrate operation |
| S5 | Full learning pipeline | Parameter-only learning |

### 10.3 Feasibility Predicate

A system configuration $\mathbf{r}$ is **feasible** iff:

$$\Phi(\mathbf{r}) = \bigwedge_{i=1}^{10} I_i(\mathbf{r}) \;\wedge\; \bigwedge_{j} \text{coupling}_j(\mathbf{r})$$

Where coupling constraints include:
- Ampliative inference requires graded truth
- Self-modification requires event sourcing + external governance
- Untrusted proposers require judge gates
- Anytime operation requires preemptive scheduler
- Paraconsistency requires non-monotonic logic

---

## §11 — The Control-Theoretic Summary

### 11.1 The Complete Control Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                         META-CONTROLLER                          │
│  Observes: telemetry, drives, budgets, trace grades             │
│  Decides: cognitive program (stage graph + budget + policy)     │
│  Outputs: program proposal → governance → installation          │
└────────────────────────────┬────────────────────────────────────┘
                             │ program
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         SCHEDULER                                │
│  Input: claim queue, budget state, stage graph                   │
│  Law:   score = utility / cost; select max; respect gates       │
│  Output: next operation + budget reservation                    │
└────────────────────────────┬────────────────────────────────────┘
                             │ operation
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EPISTEMIC KERNEL                            │
│  Executes: inference rules, proposals, verification             │
│  Gates:    perception, action, reward, budget                   │
│  Commits:  single ledger, typed, governed                       │
│  Outputs:  candidates → verification → commit                   │
└────────────────────────────┬────────────────────────────────────┘
                             │ events
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PROVENANCE LAYER                            │
│  Records: all events, correlations, budgets, decisions          │
│  Enables: replay, verification, causal queries                  │
│  Feeds:   meta-controller (closes the loop)                     │
└─────────────────────────────────────────────────────────────────┘
```

### 11.2 Stability Analysis

The system maintains stability through:

| Mechanism | What it stabilizes | How |
|---|---|---|
| Budget ceilings | Resource consumption | Hard caps; no path exceeds |
| Decay/forgetting | Memory growth | Thermodynamic decay; LRU eviction |
| Epistemic firewall | Belief corruption | Type-level separation |
| Governance ladder | Self-modification runaway | External approval; shadow validation |
| Homeostatic drives | Motivational balance | Setpoint regulation; meta-goal injection |
| Paraconsistency | Contradiction explosion | Graded coexistence; no ex falso |
| Fail-open egress | Cognitive continuity | Provider fault ≠ cognitive halt |
| Fail-closed ingress | Epistemic safety | Unjudged input ≠ memory entry |

### 11.3 The Requisite Variety Condition

The controller must have at least as many states as the disturbances it must regulate. This is satisfied by:
- **Adaptive scheduling** (multiple modes, learned policies)
- **Strategy composition** (composable, parameterized strategies)
- **Multi-substrate portfolio** (symbolic + neural + exact + reflexive)
- **Heterochronous loops** (different timescales for different disturbances)
- **Meta-control** (the controller can change its own control law)

---

## §12 — Implementation Architecture

### 12.1 Module Structure

```
Ω/
├── kernel/                    # Epistemic kernel (Plane 2)
│   ├── truth-algebra/         # NAL (f,c) revision, paraconsistency
│   ├── type-system/           # Epistemic types, firewall enforcement
│   ├── commit-ledger/         # Single write path
│   ├── gates/                 # Perception, Action, Reward, Budget
│   └── rules/                 # Inference rules (loaded data)
│
├── control/                   # Cognitive control plane (Plane 3)
│   ├── stage-graph/           # Declarative control flow
│   ├── scheduler/             # Priority / economic / learned
│   ├── claim-queue/           # Bounded priority queue
│   ├── focus/                 # Focus management, attention
│   └── arbitration/           # Multi-proposer arbitration
│
├── economy/                   # Resource economy (Plane 4)
│   ├── budget-office/         # Reservations, settlements
│   ├── pricing/               # Utility scoring
│   ├── backpressure/          # Throttling, degradation signals
│   └── decay/                 # Thermodynamic forgetting
│
├── meta/                      # Meta-control (Plane 5)
│   ├── meta-controller/       # Program selection
│   ├── self-assessment/       # Analyzers, telemetry
│   ├── governance/            # Autonomy ladder, risk classifier
│   └── learning/              # RLFP, schema induction, distillation
│
├── substrate/                 # Substrate fabric (Plane 1)
│   ├── memory/                # Bounded bags, ports, decay
│   ├── provenance/            # Event log, correlation, replay
│   ├── terms/                 # Term algebra, canonical interning
│   └── verifiers/             # Standalone verification (no engine deps)
│
├── proposers/                 # Untrusted proposal generators
│   ├── neural/                # LM rules, reflexes
│   ├── symbolic/              # NAL rule applications
│   ├── exact/                 # Rewriting, computation
│   └── peers/                 # External agents (future)
│
└── ports/                     # Typed interfaces (dependency inversion)
    ├── memory-port/           # 9 named contracts
    ├── decision-port/         # Admission ordering, egress veto
    ├── scheduler-port/        # Pluggable scheduling
    ├── judge-port/            # Pluggable verification
    └── governance-port/       # Pluggable authority
```

### 12.2 Key Design Patterns

| Pattern | Application |
|---|---|
| **Ports and Adapters** | All subsystems behind typed interfaces; implementations swappable |
| **Event Sourcing** | State = fold(events); snapshots are caches |
| **Command Query Separation** | Mutations go through ledger; reads go through ports |
| **Circuit Breaker** | Provider failures degrade gracefully; typed events emitted |
| **Proposal/Commit** | All changes are proposals until governed commit |
| **Middleware Pipeline** | Stage execution composable via middleware onion |
| **Dependency Inversion** | Kernel depends on ports, not implementations |

### 12.3 Configuration as Data

All architectural choices are **declarative data**, not code:

```
SystemConfig {
  stageGraphs:      StageGraph[]           // loadable, versioned
  budgetTopology:   BudgetTopology          // dimensions, scopes, ceilings
  gatePolicies:     GatePolicy[]            // polarity, timeout, fallback
  trustCalibration: TrustConfig             // thresholds, bands, decay
  governanceRules:  GovernancePolicy        // autonomy ladder, risk classifier
  learningPolicy:   LearningConfig          // what may adapt, at what level
  failurePolicies:  FailurePolicyMap        // per-fault-type responses
  schedulerMode:    SchedulerMode           // priority | economic | learned
  metaPolicy:       MetaControlPolicy       // how often, what authority
}
```

---

## §13 — Summary: The Design in One Paragraph

**Ω is a resource-bounded, epistemically-typed, reflexive cognitive control system** that transforms observations into justified commitments through a single governed commit ledger. Its control flow is declarative data (stage graphs), its scheduling is adaptive (priority → economic → learned), its resources are an economy (reservations, pricing, backpressure), its trust is a continuous field (calibrated, risk-aware, reversibility-sensitive), its learning is governed (proposals, shadow validation, external approval), its provenance is complete (event-sourced, correlated, independently verifiable), and its degradation is graceful (typed failures, continuity preference, reflexive safety). The epistemic firewall is structural, the commit authority is singular, the verifier is independent, and the meta-controller proposes but never self-approves. Every cognitive operation is a typed transaction; every state mutation is an event; every control decision is observable. The system is simultaneously maximally auditable, maximally adaptive within constraints, and maximally unified in its abstractions — one transaction model, one commit surface, one governance vocabulary, one resource algebra, one provenance fabric.

---

*This specification is self-contained. It defines a complete cognitive architecture from first principles, implementable as a bounded, governed, adaptive reasoning system. All mechanisms are specified at the level of typed interfaces, formal invariants, and control laws, independent of any particular implementation language or deployment target.*
