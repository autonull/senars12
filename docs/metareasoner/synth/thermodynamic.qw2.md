# THERMODYNAMIC COGNITIVE CONTROL PLANE

## A Complete Architecture Specification for Bounded, Governed, Resource-Aware Reasoning

---

## §0 — Design Selections

**Prime Objectives:** O1 (Epistemic Integrity) · O2 (Causal Provenance) · O3 (Control-Plane Fluidity) · O4 (Resource Economics) · O8 (Unified Commit Ledger)

**Hard Constraints:** H1–H6, H8–H10 (all except H7, which is subsumed by the verifier-independence axiom)

**Anti-Goals:** A2 (scheduler opacity) · A4 (audit bloat) · A5 (monolithic LM authority)

**Architectural Character:** D3 (Maximum Elegance/Unification) tempered by D1 (Auditability) and D4 (Robustness). D6 (Adaptivity) is permitted only within the invariant envelope defined by §11.

**Governing Principle:**

> A reasoner is not primarily a thinking engine. It is a **governed thermodynamic controller** that transforms observations into justified commitments under scarce energy, minimizing variational free energy while preserving epistemic integrity.

---

## §1 — Foundational Axioms

The architecture rests on seven irreducible postulates. Every mechanism below is a consequence of these.

| # | Axiom | Statement |
|---|---|---|
| **Ω1** | **Insufficiency** | Knowledge and resources are always insufficient. Boundedness is not a limitation to overcome but the design condition. Forgetting, decay, interruption, and backpressure are first-class. |
| **Ω2** | **Epistemic Separation** | What the system takes to be true (belief) and what it wants (goal/desire) occupy disjoint type spaces. No reward, utility, or desire signal may mutate factual truth values. |
| **Ω3** | **Proposal Before Commitment** | No untrusted source — neural, stochastic, external, or self-generated — may directly mutate durable state. All mutation requires judgment, budget settlement, and explicit commit. |
| **Ω4** | **Provenance by Construction** | Every cognitive operation is, by its type signature, an event-producing transaction. Observability is not added; it is constitutive. |
| **Ω5** | **Free Energy Minimization** | Cognition allocates scarce compute to reduce variational free energy — the upper bound on surprise. Resource allocation is governed by expected information gain per unit energy expended. |
| **Ω6** | **Governed Reflexivity** | The system may propose changes to its own strategies, rules, parameters, and structure, but may never self-approve changes that alter its governance, epistemic commitments, or safety boundaries. |
| **Ω7** | **Graceful Continuity** | Cognition must not halt on provider fault, budget exhaustion, or judgment unavailability. The system degrades to a known weaker mode rather than producing undefined behavior or stopping. |

---

## §2 — Formal Model

A reasoner under this specification is a **resource-bounded, epistemically typed, thermodynamically governed control system**:

$$\mathcal{R} = \langle\, \mathcal{X},\; \mathcal{O},\; \mathcal{U},\; \Pi,\; \mathcal{G},\; \mathcal{B},\; \mathcal{V},\; \mathcal{L},\; \mathcal{F},\; \Omega \,\rangle$$

| Symbol | Name | Role |
|--------|------|------|
| $\mathcal{X}$ | Cognitive State | Memory, beliefs, goals, attention, drives, event history, energy fields |
| $\mathcal{O}$ | Observations | External stimuli, internal telemetry, tool results, human feedback |
| $\mathcal{U}$ | Operations | Typed cognitive transactions: perceive, infer, propose, judge, commit, act, learn, consolidate |
| $\Pi$ | Thermodynamic Controller | Selects operations by expected free-energy reduction per unit cost |
| $\mathcal{G}$ | Governance Predicates | Gates, policies, invariants, epistemic firewalls, risk classifiers |
| $\mathcal{B}$ | Energy Algebra | Cognitive energy pools, temperature, reservations, settlements, conservation laws |
| $\mathcal{V}$ | Verification Portfolio | Proofs, calibrated judges, simulators, shadow execution, human approval |
| $\mathcal{L}$ | Adaptation Operators | Parameter tuning, strategy selection, rule induction, governed self-modification |
| $\mathcal{F}$ | Failure Policy Map | Per-operation degradation: fail-open, fail-closed, abstain, degrade, fallback |
| $\Omega$ | Causal Observability Graph | Correlation IDs, event log, derivation traces, control traces, causal DAG |

**The control law at each tick $t$:**

$$o_t = \text{observe}(\mathcal{E}_t,\; \mathcal{X}_t)$$

$$\kappa_t = \Pi\bigl(\mathcal{X}_t,\; o_t,\; \mathcal{B}_t,\; \mathcal{G},\; T_t\bigr) \quad \text{where } T_t = \text{cognitive temperature}$$

$$Y_t = \text{execute}(\kappa_t,\; \mathcal{X}_t)$$

$$Z_t = \mathcal{V}(Y_t,\; \mathcal{X}_t)$$

$$\mathcal{X}_{t+1} = \begin{cases} \text{commit}(Z_t) & \text{if } \mathcal{G}(Z_t, \mathcal{B}_t) \wedge \text{energy}(Z_t) \leq \mathcal{B}_t \\ \text{degrade}(\mathcal{X}_t, Y_t, \mathcal{F}) & \text{otherwise} \end{cases}$$

Every transition emits a typed event into $\Omega$.

---

## §3 — Epistemic Type System

### 3.1 Cognitive Attitudes

All cognitive content is typed. The type system enforces separation at the level of mutation authority, not merely naming.

| Type | Value Structure | Mutation Authority |
|------|----------------|-------------------|
| **Belief** | $(f, c)$ — frequency × confidence | Evidence only. Revision via independence-checked accumulation. |
| **Goal** | $(d, c)$ — desire × confidence | Reward + progress. Never touches Belief. |
| **Question** | $(\text{priority},\; \text{EIG})$ — expected information gain | Scheduler + curiosity drive |
| **Hypothesis** | $(\text{plausibility},\; \text{evidence\_requirement})$ | Proposer + judge |
| **Assumption** | $(\text{scope},\; \text{validity})$ | Local reasoning context |
| **Plan** | $(\text{utility},\; \text{feasibility},\; \text{risk})$ | Planner + risk classifier |
| **Obligation** | $(\text{priority},\; \text{deadline})$ | Governance + commitment |
| **Lesson** | $(\text{source},\; \text{trust},\; \text{applicability})$ | Learning + consolidation |

### 3.2 The Epistemic Firewall

The firewall is a **structural type invariant**, not a policy:

$$\text{Reward} \nrightarrow \text{Belief}.f \quad\wedge\quad \text{Reward} \nrightarrow \text{Belief}.c$$

$$\text{GoalFailure} \nrightarrow \text{FalseBelief}$$

$$\text{Desire} \nrightarrow \text{Fact}$$

$$\text{PlanUtility} \neq \text{EpistemicTruth}$$

**Enforcement mechanism:** Every cognitive object carries an axis tag $\alpha \in \{\text{epistemic},\; \text{teleological},\; \text{procedural}\}$. The commit ledger rejects any transaction whose declared axis mismatches its mutation target. A reward signal tagged `teleological` cannot write to a `Belief`-typed slot regardless of the proposer's confidence.

### 3.3 Contradiction Policy

Contradictions are **retained with distinct truth values** (graded paraconsistency):

$$(A \to B) \text{ with } (f_1, c_1) \quad \text{coexists with} \quad \neg(A \to B) \text{ with } (f_2, c_2)$$

The system does not explode. Query resolution grades contradictions rather than collapsing them. Resolution is a cognitive operation (costing energy), not an automatic deletion.

### 3.4 Revision Algebra

Belief revision uses evidence-sensitive combination:

$$\text{rev}\bigl((f_1, c_1),\; (f_2, c_2)\bigr) = \left(\frac{f_1 c_1 (1-c_2) + f_2 c_2 (1-c_1)}{c_1(1-c_2) + c_2(1-c_1)},\;\; c_1(1-c_2) + c_2(1-c_1)\right)$$

**Constraints:**
- Revision requires an **independence check**: evidence sources must not share ancestry beyond a bounded lineage depth.
- Confidence is sub-additive: $c_{\text{rev}} < c_1 + c_2$.
- Revision is commutative but not associative (order matters for chains; event sourcing preserves order).

---

## §4 — Thermodynamic Resource Economics

This is the architectural centerpiece. Static budget counters are replaced by a **cognitive thermodynamics** governed by the Free Energy Principle.

### 4.1 Core Quantities

| Quantity | Symbol | Definition |
|----------|--------|------------|
| **Cognitive Energy** | $E(x)$ | Activation energy of item $x$ (task, belief, derivation, proposal). Computed from surprise × utility. |
| **Cognitive Temperature** | $T$ | Global exploration/exploitation parameter. High $T$ → broad stochastic sampling. Low $T$ → greedy deep derivation. |
| **Free Energy** | $\mathcal{F}$ | Upper bound on surprise: $\mathcal{F} = \underbrace{D_{\text{KL}}(q \| p)}_{\text{complexity}} - \underbrace{\mathbb{E}_q[\ln p(o)]\}_{\text{accuracy}}$ |
| **Expected Free Energy** | $\text{EIF}(a)$ | Expected free energy reduction from action $a$: drives scheduling. |
| **Entropy** | $S$ | Disorder in the cognitive state. High $S$ → many unresolved contradictions, stale beliefs, fragmented attention. |
| **Work** | $W$ | Useful cognitive work: derivations that reduce $\mathcal{F}$. |
| **Heat** | $Q$ | Dissipated compute: operations that consumed energy without reducing $\mathcal{F}$. |
| **Total Energy Pool** | $\mathcal{E}_{\text{total}}$ | The AIKR-bound total energy available. Conserved. Never infinite. |

### 4.2 The Boltzmann Scheduler

Instead of a fixed sequence or simple priority queue, the scheduler samples the next operation from a **Boltzmann distribution** over enabled operations:

$$P(\text{execute } u_i) = \frac{\exp\bigl(-\Delta E_i / T\bigr)}{\sum_j \exp\bigl(-\Delta E_j / T\bigr)}$$

Where:
- $\Delta E_i$ = the **energy barrier** of operation $u_i$ (cost to execute)
- $T$ = cognitive temperature (set by drives, budget pressure, and meta-controller)

**Interpretation:**
- At high $T$ (curiosity, exploration, low pressure): the system samples broadly, pursuing diverse and novel operations even if costly.
- At low $T$ (competence, exploitation, high pressure): the system greedily pursues the lowest-energy (highest-value) operations.
- At $T \to 0$: pure greedy. At $T \to \infty$: uniform random.

### 4.3 Temperature Regulation

Temperature is not fixed. It is regulated by a **homeostatic controller**:

$$T_{t+1} = T_t + \alpha \cdot \bigl(T^* - T_t\bigr) + \beta \cdot \text{EIF\_gradient} + \gamma \cdot \text{pressure}$$

Where:
- $T^*$ = setpoint (configurable per deployment mode)
- $\text{EIF\_gradient}$ = rate of free energy reduction (if declining, increase $T$ to explore)
- $\text{pressure}$ = budget exhaustion signal (if high, decrease $T$ to conserve)

**Drive coupling:**

| Drive | Effect on $T$ | Effect on $\Delta E$ |
|-------|---------------|---------------------|
| Curiosity | Increases $T$ (explore) | Lowers barrier for Question operations |
| Competence | Decreases $T$ (exploit) | Lowers barrier for Goal-achieving operations |
| Coherence | Increases $T$ when $S$ is high | Lowers barrier for contradiction-resolution |
| Social | Modulates $T$ toward clarification | Lowers barrier for human-in-loop operations |

### 4.4 Energy Conservation & Reservations

**Conservation law:** Total energy is bounded. The system cannot create energy.

$$\sum_{i} E_{\text{consumed}}(u_i) \leq \mathcal{E}_{\text{total}}(t)$$

**Reservation protocol:** Before executing a transaction, the scheduler reserves energy:

$$\mathcal{E}_{\text{available}} \leftarrow \mathcal{E}_{\text{available}} - E_{\text{reserved}}(\kappa_t)$$

After execution:

$$\mathcal{E}_{\text{settled}} = E_{\text{reserved}} - E_{\text{unused}}$$

$$\mathcal{E}_{\text{available}} \leftarrow \mathcal{E}_{\text{available}} + E_{\text{unused}}$$

**Backpressure:** When $\mathcal{E}_{\text{available}} < E_{\text{threshold}}$:
1. Temperature drops (conserve).
2. Low-priority operations are deferred or dropped.
3. Degradation mode activates (§12).
4. A typed `energy.pressure` event is emitted.

### 4.5 Energy Dimensions

Energy is multi-dimensional. Each dimension has a ceiling, a reset policy, and a thermodynamic interpretation:

| Dimension | Thermodynamic Analog | Reset Policy | Ceiling |
|-----------|---------------------|--------------|---------|
| **cycles** | Control steps (work quanta) | Per-cycle | Configurable |
| **derivations** | Inference work | Per-cycle | Configurable |
| **memory_ops** | State access (heat) | Per-cycle | Configurable |
| **lm_calls** | External oracle queries (high-energy) | Per-cycle | Configurable |
| **tokens** | Communication bandwidth | Per-call | Configurable |
| **latency** | Wall-clock time | Per-operation | Configurable |
| **risk** | Irreversibility quota | Lifetime | Configurable |
| **human_attention** | External authority cost | Lifetime | Configurable |

### 4.6 Entropy & Forgetting

**Entropy** measures cognitive disorder:

$$S(\mathcal{X}) = \underbrace{S_{\text{contradiction}}}_{\text{unresolved conflicts}} + \underbrace{S_{\text{staleness}}}_{\text{decayed beliefs}} + \underbrace{S_{\text{fragmentation}}}_{\text{attention spread}} + \underbrace{S_{\text{orphan}}}_{\text{unconnected evidence}}$$

When $S > S_{\text{threshold}}$, the system triggers **consolidation** (a thermodynamic phase transition):
- Decay stale beliefs (reduce $S_{\text{staleness}}$)
- Merge episodic fragments into schemas (reduce $S_{\text{fragmentation}}$)
- Resolve or quarantine contradictions (reduce $S_{\text{contradiction}}$)
- Archive or forget orphaned items (reduce $S_{\text{orphan}}$)

**Forgetting is thermodynamic:** items decay not by arbitrary TTL but by their contribution to free energy. An item with high predictive value (low surprise) persists. An item with zero predictive value (fully explained by other beliefs) decays.

$$\text{decay\_rate}(x) \propto \exp\bigl(-\text{EIF}(x) / T\bigr)$$

### 4.7 Pricing & Utility

Operations are priced by **marginal utility per unit energy**:

$$\text{score}(u_i) = \frac{\widehat{\Delta K}_i + \widehat{\Delta G}_i + \widehat{\Delta H}_i}{\lambda_c \hat{C}_i + \lambda_r \hat{R}_i + \lambda_h \hat{H}_{\text{human},i}}$$

Where:
- $\widehat{\Delta K}$ = expected epistemic gain (uncertainty reduction, contradiction resolution)
- $\widehat{\Delta G}$ = expected teleological gain (goal progress)
- $\widehat{\Delta H}$ = expected homeostatic gain (drive balance, entropy reduction)
- $\hat{C}$ = expected energy cost
- $\hat{R}$ = expected risk
- $\hat{H}_{\text{human}}$ = expected human attention cost
- $\lambda_c, \lambda_r, \lambda_h$ = Lagrange multipliers (tunable per deployment)

The scheduler selects operations maximizing $\text{score}(u_i)$ subject to the energy constraint.

---

## §5 — Cognitive Transaction Algebra

### 5.1 The Transaction Type

Every unit of cognition — perception, inference, proposal, judgment, action, learning, consolidation, self-modification — is a **typed cognitive transaction**:

```
interface CognitiveTransaction {
  id:              TransactionId;
  correlationId:   CorrelationId;
  kind:            TransactionKind;
  inputs:          CognitiveObject[];
  outputs:         Candidate[];
  effects:         EffectDeclaration[];
  energy:          EnergyReservation;
  capabilities:    CapabilityToken[];
  trust:           TrustProfile;
  risk:            RiskProfile;
  reversibility:   ReversibilityClass;
  fallback:        FailurePolicy;
  proofObligations: ProofObligation[];
  axis:            CognitiveAxis;  // epistemic | teleological | procedural
}
```

### 5.2 Transaction Kinds

| Kind | Description | Default Axis |
|------|-------------|--------------|
| `perception` | Ingress of external stimulus | epistemic |
| `attention` | Focus allocation, priority adjustment | procedural |
| `inference` | Symbolic derivation (deduction, induction, abduction) | epistemic |
| `proposal` | Untrusted candidate generation (LM, reflex, peer) | epistemic |
| `judgment` | Verification, calibration, scoring | epistemic |
| `commit` | Durable state mutation | epistemic / teleological |
| `action` | External effect via tool or actuator | teleological |
| `learning` | Parameter update, strategy change, rule induction | procedural |
| `forgetting` | Decay, eviction, archival | procedural |
| `consolidation` | Schema induction, episodic merge, entropy reduction | procedural |
| `simulation` | Internal model execution (imagination) | epistemic |
| `meta_control` | Scheduler/graph/budget modification proposal | procedural |

### 5.3 Composition Laws

Transactions compose algebraically:

| Operation | Symbol | Meaning |
|-----------|--------|---------|
| Sequential | $\tau_1 \triangleright \tau_2$ | Execute $\tau_1$ then $\tau_2$ |
| Parallel | $\tau_1 \parallel \tau_2$ | Execute concurrently, join at commit |
| Conditional | $\tau_1 \triangleleft_g \tau_2$ | Execute $\tau_1$ or $\tau_2$ based on guard $g$ |
| Iteration | $\tau^n$ | Execute $\tau$ exactly $n$ times |
| Kleene star | $\tau^*$ | Iterate until guard fails |
| Choice | $\tau_1 + \tau_2$ | Scheduler selects based on EIF |
| Fallback | $\tau_1 \triangleright_f \tau_2$ | Try $\tau_1$; on failure, execute $\tau_2$ |

**Compositionality theorem:** For all transactions $\tau_1, \tau_2$:

$$\llbracket \tau_1 \triangleright \tau_2 \rrbracket = \llbracket \tau_1 \rrbracket \circ \llbracket \tau_2 \rrbracket$$

$$\llbracket \tau_1 \parallel \tau_2 \rrbracket = \llbracket \tau_1 \rrbracket \times \llbracket \tau_2 \rrbracket$$

This means behavior is equationally predictable. The system's execution trace is a homomorphic image of its transaction expression.

---

## §6 — Control Topology & Scheduling

### 6.1 The Conditional Cognitive Graph

Control flow is **data**, not code. The architecture replaces any fixed pipeline with a **conditional directed acyclic graph** (or cyclic graph with well-foundedness constraints):

$$\mathcal{C} = (V_c,\; E_c,\; \text{guard},\; \text{effect},\; \text{energy})$$

Where:
- $V_c$ = set of stage nodes (each is a transaction kind)
- $E_c \subseteq V_c \times V_c \times \text{Pred}$ = guarded edges
- $\text{guard}: E_c \to \text{Predicate}$ = condition for traversal
- $\text{effect}: V_c \to \mathcal{X} \to \mathcal{X} \times \mathcal{E}^*$ = stage semantics
- $\text{energy}: E_c \to \mathbb{R}^+$ = energy cost of traversal

### 6.2 The Control Word (KAT)

The graph is expressible as a **Kleene Algebra with Tests** term:

$$\kappa = \text{perceive} \cdot \text{attend} \cdot (\text{ready}? \cdot \text{infer} \cdot \text{judge}) \cdot (\text{hasProposals}? \cdot \text{propose} + \neg\text{hasProposals}? \cdot 1) \cdot (\text{due}? \cdot \text{learn})^*$$

This makes the control flow:
- **Inspectable**: the term is a data structure that can be printed, diffed, and versioned.
- **Replayable**: replaying the same $\kappa$ with the same events reproduces the same trace.
- **A/B-testable**: alternative $\kappa$ terms can be evaluated in shadow.
- **Governable**: edits to $\kappa$ are self-modification proposals subject to governance.

### 6.3 Multi-Rate Heterochronous Tower

The system operates at multiple temporal scales simultaneously:

| Level | Rate | Function |
|-------|------|----------|
| L0 — Reflex arc | Sub-cycle, interruptible | Safety veto, fast judgment, game tick |
| L1 — Micro tick | Per-cycle | Perceive → attend → infer → judge → commit → propose → learn |
| L2 — Macro turn | Per-conversational-turn | Recall → reason → narrate → consolidate → act → record |
| L3 — Consolidation | Every $K$ cycles | Decay, eviction, episodic merge, retrospection |
| L4 — Identity | $\ll 1/\text{cycle}$ | Schema induction, capability scaffold, constitution review |

**Interaction rules:**
- Lower levels can **interrupt** higher levels (reflex veto).
- Higher levels **configure** lower levels (L4 sets L1's graph structure).
- All levels share the same energy pool (conservation across rates).
- All levels write only through the commit ledger (§8).
- Each level has its own budget slice: $\sum_i \mathcal{E}_i = \mathcal{E}_{\text{total}}$.

### 6.4 The Thermodynamic Scheduler

The scheduler is the system's **meta-controller**. It is not a fixed algorithm but a **portfolio of controllers** selected by the thermodynamic state:

| Controller | Activation Condition | Behavior |
|------------|---------------------|----------|
| **Deliberative** | High EIG, low pressure | Deep inference, high proof burden, low $T$ |
| **Reactive** | Urgent stimulus, reflex trigger | Fast path, minimal judgment, immediate response |
| **Curious** | High surprise, low goal pressure | High $T$, question generation, broad exploration |
| **Conservative** | High risk, low trust | High rejection threshold, minimal commitment |
| **Creative** | Low pressure, high entropy | High proposal diversity, sandboxed experimentation |
| **Repair** | High contradiction, test failure | Focused contradiction resolution, schema fix |
| **Consolidating** | High $S$, cycle boundary | Memory decay, schema induction, entropy reduction |
| **Social** | Ambiguity, low confidence | Clarification-seeking, human-in-the-loop |

The meta-controller selects or **blends** controllers based on:
- Current entropy $S$
- Energy pressure
- Drive states
- Recent free energy gradient
- Risk level
- Human availability

Its output is a **cognitive program**:

```
interface CognitiveProgram {
  stageGraph:        StageGraph;
  temperature:       number;
  budgetAllocation:  BudgetAllocation;
  proposerPortfolio: ProposerWeights;
  verificationPolicy: VerificationPolicy;
  autonomyPolicy:    AutonomyPolicy;
  learningPolicy:    LearningPolicy;
}
```

### 6.5 Well-Foundedness

Every loop in the control graph must terminate:

$$\forall \ell \in \text{Loops},\; \exists n \in \mathbb{N}:\; \ell^n \text{ terminates}$$

Termination is guaranteed by:
- Energy depletion (the loop runs out of budget)
- Abort signal (external interruption)
- Guard failure (the loop's condition becomes false)
- Maximum iteration bound (hard cap on loop depth)

No infinite loop exists without at least one of these exit conditions.

---

## §7 — Admission, Trust & Governance

### 7.1 The Gate Lattice

Gates form a **bounded lattice** $(\mathcal{G}, \leq, \wedge, \vee, \top, \bot)$:

- $g_1 \leq g_2$ iff $g_1$ admits a subset of what $g_2$ admits (more restrictive)
- $g_1 \wedge g_2$ = conjunction (both must admit)
- $g_1 \vee g_2$ = disjunction (either admits)
- $\top$ = always admit (fail-open)
- $\bot$ = never admit (fail-closed)

Each gate is parameterized by:

```
interface GateSpec {
  domain:     'ingress' | 'egress' | 'cycle' | 'tool' | 'meta';
  judge:      JudgeSpec;
  timeout:    number;
  fallback:   'fail-open' | 'fail-closed' | 'degrade';
  polarity:   'closure' | 'interior';  // fail-open vs fail-closed
  vetoSet:    Set<CandidateId>;
}
```

### 7.2 The Trust Manifold

Trust is a **continuous calibrated field**, not a binary:

$$T(\text{source},\; \text{content},\; \text{context},\; \text{history}) \in [0, 1]$$

Built from:
- Source quality ceiling (per-source maximum trust)
- Source reputation multiplier (learned, floor-bounded)
- Calibrated judgment scores (isotonic calibration, Brier-scored)
- Claim specificity (vague claims get lower trust than specific ones)
- Corroboration (independent confirmation raises trust)

**Admission bands:**

| Trust Range | Action |
|-------------|--------|
| $T > 0.85$ | Auto-commit (with event) |
| $0.6 < T \leq 0.85$ | Provisional commit with decay |
| $0.4 < T \leq 0.6$ | Human review or shadow-commit |
| $T \leq 0.4$ | Reject (fail-closed) |

### 7.3 Risk, Reversibility & Authorization

Every candidate receives a **governance profile**:

```
interface GovernanceProfile {
  trust:          number;
  confidence:     number;
  risk:           number;       // expected harm / irreversibility
  reversibility:  number;       // ease of rollback
  blastRadius:    number;       // scope of impact
  proofStatus:    ProofStatus;
  judgeStatus:    JudgeStatus;
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

### 7.4 Proposer Topology

All proposers are **untrusted by default**:

| Proposer Class | Trust Ceiling | Judgment Required |
|---------------|---------------|-------------------|
| Symbolic derivation (internal) | 0.9 | Egress veto only |
| Language model (LM) | 0.5 | Full judgment manifold |
| Reflex / learned policy | 0.6 | Calibration check |
| Peer agent | 0.5 | Shadow validation + judgment |
| Human input | 0.9 | Ingress gate only |
| Tool result | 0.7 | Schema validation |
| Self-generated proposal | 0.5 | Full governance pipeline |

**The proposer/judge adjunction:**

$$\text{propose} \dashv \text{admit}$$

Proposers generate candidates. Judges evaluate them. The **Judgment Manifold** measures how much of a proposal survives judgment. This makes "how much do we trust System 1" a continuous parameter, not a wiring decision.

### 7.5 Substrate Isolation (Arbiter Pattern)

Different reasoning substrates coexist but **never share memory directly**:

| Substrate | Role | Boundary |
|-----------|------|----------|
| Symbolic (NAL) | Core inference, truth algebra | Trusted kernel |
| Exact (rewriting/e-graph) | Deterministic computation | Gated oracle, proposals only |
| Neural (LM, heads) | Proposal generation, calibration | Untrusted proposer |
| Probabilistic | Uncertainty quantification | Calibration layer |
| Heuristic | Sampling, attention | Strategy layer |

**Critical invariant:** An exact substrate (e-graph) must **never** union nodes based on uncertain similarity scores. Equality saturation operates only on proven equalities. The boundary between substrates is enforced by the arbiter pattern: all cross-substrate communication is via typed proposals through the commit ledger.

---

## §8 — Unified Commit Ledger

### 8.1 The Single Commit Authority

All durable state mutation passes through **one commit port**:

```
Candidate
  → Normalize
  → Type-Check (axis, attitude, schema)
  → Evidence-Independence Check
  → Proof / Judge / Simulation
  → Rank (by utility score)
  → Energy Settlement
  → Risk Classification
  → Commit or Reject
```

This is the **only** path by which state changes. There is no side-door, no direct write, no bypass.

### 8.2 The Event Fold

State is an **append-only event log**. The current state is a fold:

$$\mathcal{X}(t) = \text{fold}(\text{events}[0..t])$$

Where `fold` is a pure, deterministic reducer. This guarantees:
- **Replayability**: replaying events reconstructs state exactly.
- **Auditability**: every state change has a corresponding event.
- **Rollback**: any prior state is reconstructable by truncating the log.
- **Independence**: the verifier can reconstruct state without running the engine.

### 8.3 Commit Atomicity

Each commit is **atomic**: either the full transaction commits (all effects applied, event emitted) or it does not (no partial state change). This is enforced by the event-sourced model: a commit is a single event that references all its inputs and outputs.

### 8.4 What Commits

Everything:
- Perceived observations
- Derived beliefs
- Generated goals
- LM formalizations
- Reflex proposals
- Tool results
- Schema inductions
- Strategy changes
- Parameter tunings
- Patches (code/config)
- Action intentions
- Human corrections
- Consolidation results
- Forgetting decisions

---

## §9 — Provenance & Causal Observability

### 9.1 Correlation Threading

Every cognitive object carries a **provenance envelope**:

```
interface Provenance {
  correlationId:   CorrelationId;   // threads stimulus → outcome
  stimulusId:      StimulusId;      // originating input
  sessionId:       SessionId;
  cycleId:         CycleId;
  transactionId:   TransactionId;
  proposerId:      ProposerId;
  judgeId?:        JudgeId;
  proofId?:        ProofId;
  parentId?:       ProvenanceId;    // causal parent
  energySpent:     EnergyReceipt;   // thermodynamic cost
}
```

This makes the following queries answerable at any depth:
- "Which user message caused this belief?"
- "Which derivation led to this action?"
- "Which judge vetoed this candidate?"
- "Which budget exhaustion caused this degradation?"
- "Which contradiction triggered this repair loop?"
- "How much energy did this reasoning path consume?"

### 9.2 Event Types

Every event is typed:

| Event Type | Emitted By |
|-----------|-----------|
| `stimulus.received` | Ingress |
| `transaction.executed` | Scheduler |
| `derivation.produced` | Inference |
| `gate.admitted` / `gate.rejected` | Gate lattice |
| `energy.reserved` / `energy.settled` / `energy.exhausted` | Budget algebra |
| `commit.applied` / `commit.rejected` | Commit ledger |
| `control.graph_edit_proposed` | Meta-controller |
| `temperature.adjusted` | Homeostatic controller |
| `entropy.threshold_exceeded` | Entropy monitor |
| `degradation.activated` | Failure policy |
| `engine.fault` | Any component (never silent) |

### 9.3 Replay & Verification

**Replay:** Given the event log, the system can reconstruct any prior state:

$$\text{replay}(\text{events}[0..t]) \cong \mathcal{X}(t)$$

**Independent verification:** A standalone verifier (sharing no code with the engine) can:
1. Transcribe the derivation rules.
2. Re-derive conclusions from premises.
3. Check truth-value propagation.
4. Verify event-log consistency.

The verifier's truth table is **transcribed** (not imported), and drift between engine and verifier is measured by test, not assumed zero.

### 9.4 Control-Plane Event Sourcing

Control decisions are **themselves events**:
- Every scheduling decision is logged.
- Every temperature change is logged.
- Every graph edit proposal is logged.
- Every budget reservation/settlement is logged.
- Every degradation activation is logged.

This means the system can explain not only **what** it believes, but **why it chose to reason that way**.

---

## §10 — Adaptation Tower & Governed Reflexivity

### 10.1 The Governance Filtration

Self-modification authority forms a **filtration** (nested hierarchy of increasing authority):

$$\mathcal{F}_0 \subset \mathcal{F}_1 \subset \mathcal{F}_2 \subset \mathcal{F}_3 \subset \mathcal{F}_4$$

| Level | Authority | Mechanism | Governance |
|-------|-----------|-----------|-----------|
| $\mathcal{F}_0$ | Parameters (attention weights, thresholds) | Auto-apply within bounds | Logged |
| $\mathcal{F}_1$ | Strategy selection (sampling, premise, derivation) | Proposal or auto | Logged + rollback |
| $\mathcal{F}_2$ | Rule induction (new symbolic rules) | Proposal + shadow test | Proof + shadow CI |
| $\mathcal{F}_3$ | Control graph edit (stage topology) | Proposal + governance | Shadow + approval |
| $\mathcal{F}_4$ | Code / architecture mutation | Proposal + external CI | Full external governance |

**Critical invariant:** $\mathcal{F}_4$ is **never self-approved**. The system cannot modify its own governance, its epistemic firewall, its safety boundaries, or its approval mechanism.

### 10.2 Learning as Governed Proposals

All learning produces **proposals**, not direct changes:

| Learning Domain | Mutates | Direct? | Governance |
|----------------|---------|---------|-----------|
| Attention weights | Focus allocation | Sometimes auto | Low risk, logged |
| Strategy selection | Inference behavior | Proposal or auto | Medium risk |
| Parameter tuning | Budgets/thresholds | Proposal | Medium risk |
| Rule induction | Symbolic rules | Proposal | Proof + shadow |
| Schema induction | Cognitive schemas | Proposal | Shadow + review |
| Patch generation | Code/config | Proposal | CI + approval |
| Governance change | Gates/policies | **Never self-applied** | External only |
| Reward function | Utility weights | **Never direct** | Human/external |

### 10.3 The Meta-Controller as Bounded Reasoner

The meta-controller (which selects cognitive programs, edits stage graphs, adjusts temperature) is itself a **bounded, governed reasoner**:

- It has its own energy budget slice.
- Its proposals are routed through the governance pipeline.
- It can propose graph edits but cannot apply them without governance.
- Its reasoning is event-sourced and replayable.
- It operates under the same epistemic firewall (its "beliefs" about control cannot be corrupted by reward).

### 10.4 The Distillation Flywheel

Knowledge flows from expensive to cheap:

$$\text{LM proposals} \xrightarrow{\text{judge}} \text{committed beliefs} \xrightarrow{\text{pattern}} \text{schema} \xrightarrow{\text{induce}} \text{symbolic rules} \xrightarrow{\text{distill}} \text{local heads}$$

Each step reduces dependency on the expensive proposer while preserving the epistemic guarantees. The system becomes more self-sufficient over time without sacrificing auditability.

---

## §11 — Feasibility Laws & Invariants

These are the **hard constraints** that no configuration may violate. They define the valid subspace $\mathcal{D}^+ \subseteq \mathcal{D}$.

| # | Law | Statement | Enforcement |
|---|-----|-----------|-------------|
| **Φ1** | Epistemic Firewall | No transaction tagged `teleological` may write to a `Belief`-typed slot. | Type system + commit ledger |
| **Φ2** | Commit Uniqueness | All durable state mutation passes through the single commit ledger. | Architecture (no other write path exists) |
| **Φ3** | Event Completeness | Every state mutation has a corresponding event. Every control decision has a corresponding event. | Transaction type system |
| **Φ4** | Energy Conservation | Total energy consumed ≤ total energy available. No operation executes without reservation. | Budget algebra |
| **Φ5** | Bounded Cognition | No loop, derivation, search, or LM call chain is unbounded. All have explicit caps. | Well-foundedness + budget |
| **Φ6** | Untrusted Proposers | No LM, neural, reflex, or peer output enters memory without judgment or explicit provisional typing. | Gate lattice |
| **Φ7** | Verifier Independence | The derivation verifier shares no code with the inference engine. | Build system + transcription |
| **Φ8** | Substrate Isolation | Exact substrates (e-graph) never union on uncertain similarity. Cross-substrate communication is via typed proposals. | Arbiter pattern + type system |
| **Φ9** | Governed Self-Modification | No self-modification at level $\mathcal{F}_3$ or above is self-approved. | External governance pipeline |
| **Φ10** | No Silent Failure | No fault affecting cognition, budget, or admission may be silently swallowed. All faults emit typed events. | Failure policy map |
| **Φ11** | Replay Determinism | Given the same event log, replay produces the same state. | Pure reducers + no hidden state |
| **Φ12** | Graceful Degradation | On provider fault, the system degrades to a known weaker mode. It does not halt or produce undefined behavior. | Failure policy + fallback |

### 11.1 Coupling Constraints

Certain axis combinations are **incoherent** and excluded:

| Antecedent | Consequent | Rationale |
|-----------|-----------|-----------|
| Ampliative inference (induction/abduction) | Requires non-binary truth | Binary truth cannot represent uncertain generalization |
| Untrusted proposers present | Requires judge gates | Without gates, untrusted output corrupts state |
| Self-modification at $\mathcal{F}_3+$ | Requires event sourcing + shadow validation | Without audit, self-mod is uncontainable |
| AIKR boundedness | Requires forgetting + backpressure + budgets | Boundedness without mechanisms is just a claim |
| Paraconsistent retention | Requires graded truth | Explosion collapses contradictions before they can be useful |
| Event-sourced state | Requires deterministic replay | Without replay, event sourcing is just logging |
| Learned scheduler | Requires control-plane event sourcing | Without tracing, learned scheduling is opaque |

---

## §12 — Degradation & Failure Topology

### 12.1 The Degradation Spectrum

$$\bot = \text{abort} \;\leq\; \text{fail-closed} \;\leq\; \text{retry-then-degrade} \;\leq\; \text{fail-open} \;\leq\; \text{ignore} = \top$$

### 12.2 Per-Domain Failure Policy

| Domain | On Fault | Rationale |
|--------|----------|-----------|
| **Ingress** (untrusted → memory) | Fail-closed | An unjudged stimulus must not enter |
| **Egress** (derived → output) | Fail-open | A provider fault must not halt cognition |
| **Internal inference** | Fail-open + event | Cognition continues; fault is logged |
| **LM proposer** | Degrade to symbolic fallback | Every LM function has a symbolic alternative |
| **Judge manifold** | Degrade to symbolic baseline | Calibration unavailable → conservative symbolic judgment |
| **Tool execution** | Fail-closed + retry | External effects require confirmation |
| **Self-modification** | Fail-closed | Ungoverned change is never permitted |
| **Budget exhaustion** | Degrade + backpressure | Reduce scope, lower temperature, defer low-priority |
| **Memory pressure** | Consolidate + forget | Thermodynamic forgetting, not crash |

### 12.3 Degradation Modes

| Mode | Trigger | Behavior |
|------|---------|----------|
| **Full** | Normal operation | All subsystems active |
| **Reduced** | LM unavailable | Symbolic-only reasoning, no proposals |
| **Minimal** | Budget critical | Core inference only, no learning, no consolidation |
| **Reflexive** | Urgent stimulus | Reflex arc only, no deliberation |
| **Dormant** | All energy exhausted | Quiescent; only perception gate active |

Each mode transition is a **typed event** with explicit trigger and recovery conditions.

---

## §13 — Implementation Architecture

### 13.1 Module Topology

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UNIFIED ALGEBRAIC STATE                           │
│  Symbolic terms ⊕ Exact e-graphs ⊕ Embeddings ⊕ Neural heads       │
│  Single event-sourced provenance chain                              │
│  Correlation-ID threaded through every layer                        │
├─────────────────────────────────────────────────────────────────────┤
│                    THERMODYNAMIC SCHEDULER                           │
│  Boltzmann sampler over enabled transactions                        │
│  Temperature regulation (drives + pressure + EIF gradient)          │
│  Energy reservation & settlement                                    │
│  Cognitive program selection (meta-controller)                      │
├─────────────────────────────────────────────────────────────────────┤
│                    CONDITIONAL STAGE GRAPH                           │
│  Data-driven, loaded, versioned, revertable                         │
│  KAT control word: tests, choice, iteration, parallelism            │
│  Multi-rate heterochronous tower (L0–L4)                            │
├════════════════════════════════════════════════════════════════════╡
│  GATE LATTICE: Perception │ Action │ Reward │ Budget │ Proof        │
├════════════════════════════════════════════════════════════════════╡
│                    UNIFIED COMMIT LEDGER                            │
│  Single commit port: normalize → type-check → judge → settle → commit │
│  Atomic transactions, event-sourced, rollback-capable               │
│  Epistemic firewall enforced at type level                          │
├─────────────────────────────────────────────────────────────────────┤
│                    TRUST & GOVERNANCE MANIFOLD                      │
│  Calibrated trust field (continuous, multi-source)                  │
│  Risk × Reversibility × Trust → commit path                        │
│  Autonomy ladder (observe → propose → sandbox → auto → human)       │
├─────────────────────────────────────────────────────────────────────┤
│                    ADAPTATION TOWER                                  │
│  Governed filtration: F0 ⊂ F1 ⊂ F2 ⊂ F3 ⊂ F4                     │
│  Distillation flywheel: LM → schema → rule → local heads           │
│  Meta-controller as bounded, governed reasoner                      │
├─────────────────────────────────────────────────────────────────────┤
│                    CAUSAL OBSERVABILITY GRAPH                       │
│  Correlation IDs: stimulus → cycle → transaction → derivation       │
│  Control-plane event sourcing (scheduler decisions are events)      │
│  Independent verifier (transcribed rules, drift-pinned)             │
│  Entropy monitor + consolidation triggers                           │
└─────────────────────────────────────────────────────────────────────┘
```

### 13.2 Typed Ports

All external interactions are through typed ports. No module directly imports another's internals:

| Port | Provides | Consumes |
|------|----------|----------|
| `PerceptionPort` | Typed stimuli | Raw ingress |
| `InferencePort` | Derivation candidates | Beliefs, goals, rules |
| `ProposalPort` | Untrusted candidates | LM/reflex/peer output |
| `JudgmentPort` | Calibrated scores | Candidates + context |
| `CommitPort` | Committed state changes | Judged candidates |
| `BudgetPort` | Energy reservations | Transaction energy requests |
| `GovernancePort` | Authorization decisions | Risk profiles |
| `ProvenancePort` | Event emission | All operations |
| `MemoryPort` | State read/write | Committed mutations |
| `ToolPort` | External effects | Action intentions |
| `MetaControlPort` | Program selection | System state |
| `VerificationPort` | Proof checking | Derivation records |

### 13.3 Configuration as Data

All architectural choices are **data**, not code:

```
interface ReasonerConfig {
  stageGraph:       StageGraph;          // conditional DAG
  controlWord:      KATExpression;       // KAT term
  temperature:      TemperaturePolicy;   // regulation rules
  energyPool:       EnergyAllocation;    // dimensions + ceilings
  gateLattice:      GateSpec[];          // gate configurations
  trustManifold:    TrustPolicy;         // calibration + thresholds
  governance:       GovernancePolicy;    // autonomy ladder + risk classifier
  adaptationTower:  FiltrationSpec;      // F0–F4 authority levels
  failurePolicy:    FailureMap;          // per-domain degradation
  proposerPortfolio: ProposerSpec[];     // LM, reflex, peer, symbolic
  verifierSpec:     VerifierConfig;      // transcription + drift pin
}
```

The system's behavior is fully determined by this configuration. Changing the configuration changes the reasoner. The configuration is itself versioned, event-sourced, and governable.

### 13.4 Implementation Phases

| Phase | Scope | Deliverable |
|-------|-------|-------------|
| **Phase 1** | Core kernel | Transaction type, commit ledger, event fold, energy algebra, gate lattice |
| **Phase 2** | Thermodynamic scheduler | Boltzmann sampler, temperature regulation, energy reservation |
| **Phase 3** | Conditional stage graph | KAT control word, data-driven stages, multi-rate tower |
| **Phase 4** | Trust manifold | Calibrated judgment, risk/reversibility, governance profiles |
| **Phase 5** | Adaptation tower | Governed filtration, distillation flywheel, meta-controller |
| **Phase 6** | Full observability | Correlation threading, control-plane events, independent verifier |

Each phase is independently deployable. Each preserves the invariants of §11. Each has a clear test and verification strategy.

---

## §14 — Summary: The Complete Coordinate

$$\boxed{\mathcal{R}_{\text{TCCP}} = \langle\; \text{Thermodynamic},\; \text{Typed},\; \text{Governed},\; \text{Event-Sourced},\; \text{Bounded},\; \text{Adaptive} \;\rangle}$$

| Dimension | Value |
|-----------|-------|
| **Epistemic substrate** | Non-axiomatic, evidence-sensitive $(f,c)$, paraconsistent, belief/goal firewall |
| **Resource model** | Thermodynamic: free energy, temperature, Boltzmann scheduling, conservation |
| **Control topology** | Conditional cognitive graph, KAT control word, multi-rate heterochronous tower |
| **Scheduling** | Thermodynamic meta-controller: portfolio of controllers, energy-priced |
| **Admission** | Gate lattice, calibrated trust manifold, risk/reversibility authorization |
| **Commit model** | Single unified ledger, atomic transactions, event-sourced fold |
| **Provenance** | Correlation-threaded, control-plane event-sourced, independently verifiable |
| **Adaptation** | Governed filtration (F0–F4), distillation flywheel, meta-controller as bounded reasoner |
| **Failure** | Per-domain degradation, graceful continuity, no silent faults |
| **Substrate** | Hybrid: symbolic + exact + neural + probabilistic, arbiter-isolated |
| **Governance** | Autonomy ladder, external immutable governor, no self-approval |
| **Observability** | Full causal graph, replayable, deterministic, drift-pinned verifier |

**The governing equation of the entire system:**

$$\dot{\mathcal{X}} = \underbrace{\mathcal{T}(\mathcal{X},\; \mathbf{u})}_{\text{inference}} - \underbrace{\gamma(T) \cdot \mathcal{X}}_{\text{thermodynamic decay}} + \underbrace{\mathcal{E}(\mathcal{I})}_{\text{gated ingress}} - \underbrace{\nabla_\mathcal{X} \mathcal{F}}_{\text{free energy minimization}}$$

Where:
- $\mathcal{X}$ = epistemic state
- $\mathcal{T}$ = transition operator (rules, modulated by control vector $\mathbf{u}$)
- $\gamma(T)$ = temperature-governed decay (AIKR forgetting)
- $\mathcal{E}(\mathcal{I})$ = epistemic boundary (gated ingress of stimuli)
- $\nabla_\mathcal{X} \mathcal{F}$ = free energy gradient (drives attention toward surprise)

This is a **complete, self-contained specification**. Every mechanism is defined. Every invariant is stated. Every degradation path is named. The architecture is implementable in phases, auditable by construction, governable by design, and thermodynamically bounded by axiom.
