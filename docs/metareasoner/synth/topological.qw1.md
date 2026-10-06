# $\mathfrak{C}$ — The Cognitive Manifold

## A Topological-Geometric Specification for Bounded, Governed, Auditable Reasoning

---

## §0 · Design Selections

| Category | Selections |
|---|---|
| **Prime Objectives** | O1 · O2 · O3 · O4 · O6 · O7 · O8 · O12 |
| **Hard Constraints** | H1 · H2 · H3 · H4 · H5 · H6 · H7 · H8 · H9 · H10 |
| **Anti-Goals** | A2 · A5 · A7 |
| **Character Bias** | D1 (Auditability) · D3 (Elegance/Unification) · D5 (Modularity) · D6 (Adaptivity) |

**Governing Thesis.** A reasoner is not a pipeline, not a loop, not a graph. It is a *fibered topological space equipped with a connection, a metric, a sheaf of local control programs, and a filtration of authority*. Every cognitive operation is a section of a bundle. Every commit is a boundary crossing. Every proof is a path-lifting. Every budget is a conservation law. Every firewall is a separation axiom.

---

## §1 · The Cognitive Manifold $\mathcal{M}$

### 1.1 Definition

The **cognitive manifold** is a tuple:

$$\mathcal{M} = \bigl(\, E \xrightarrow{\;\pi\;} B,\;\; \mathcal{F},\;\; \nabla,\;\; g,\;\; \mathfrak{S},\;\; \mathfrak{T}\,\bigr)$$

| Component | Type | Role |
|---|---|---|
| $E$ | Total space | All possible cognitive configurations |
| $B$ | Base space | The event-ordered timeline (causal spine) |
| $\pi : E \to B$ | Projection | Maps each configuration to its causal moment |
| $\mathcal{F}$ | Typical fiber | The local cognitive state (beliefs, goals, resources, attention) |
| $\nabla$ | Connection | Budget transport and resource conservation |
| $g$ | Metric tensor | Trust distance and admission geometry |
| $\mathfrak{S}$ | Structure sheaf | Local control programs and their gluing |
| $\mathfrak{T}$ | Filtration | Governance authority levels |

### 1.2 The Base Space $B$

$B$ is a **causal DAG** equipped with the Alexandrov topology (open sets = upward-closed subsets). Points of $B$ are **cognitive events**. The partial order $\preceq$ on $B$ is causal precedence:

$$b_1 \preceq b_2 \iff \text{event } b_1 \text{ causally precedes or enables } b_2$$

$B$ is:
- **Locally finite** (each event has finitely many causal predecessors — H5 boundedness)
- **Append-only** (no event is removed; the topology only grows — H3 event sourcing)
- **Correlated** (every point carries a `correlationId` that connects it to its stimulus origin — C2)

**Axiom B1 (Provenance by Construction).** The base space $B$ is not derived from cognition; cognition is derived from $B$. The event log *is* the base space. State is a fold over $B$.

### 1.3 The Fiber $\mathcal{F}$

At each event $b \in B$, the fiber $\mathcal{F}_b = \pi^{-1}(b)$ is the **local cognitive state**:

$$\mathcal{F}_b = \mathcal{K}_b \times \mathcal{G}_b \times \mathcal{R}_b \times \mathcal{A}_b \times \mathcal{P}_b$$

| Factor | Content |
|---|---|
| $\mathcal{K}_b$ | Epistemic content: beliefs as $(f,c)$-valued terms, paraconsistent, evidence-tracked |
| $\mathcal{G}_b$ | Teleological content: goals as $(d,c)$-valued terms, drive intensities |
| $\mathcal{R}_b$ | Resource state: remaining budget vector, active reservations |
| $\mathcal{A}_b$ | Attention state: priority distribution, focus allocation |
| $\mathcal{P}_b$ | Provenance state: active correlation IDs, open transaction contexts |

### 1.4 The Total Space $E$

$E$ is the **space of all reachable cognitive configurations**. A point $e \in E$ is a complete snapshot: what the system believes, wants, can afford, attends to, and remembers *at a given causal moment*.

**Axiom E1 (Boundedness).** $E$ is **compact** in the resource topology. Every open cover of $E$ by budget-feasible regions admits a finite subcover. Equivalently: there is no infinite path in $E$ that does not encounter a budget boundary.

**Axiom E2 (Determinism of Replay).** The projection $\pi: E \to B$ is a **covering map**. Every path $\gamma$ in $B$ lifts uniquely to a path $\tilde{\gamma}$ in $E$ given an initial point $e_0 \in \mathcal{F}_{\gamma(0)}$. This is the **replay property**: the event sequence uniquely determines the state trajectory.

---

## §2 · The Epistemic Fibration

### 2.1 The Belief/Goal Separation as a Separation Axiom

The fiber $\mathcal{F}$ decomposes into two subspaces:

$$\mathcal{F} = \mathcal{F}_{\text{epistemic}} \sqcup \mathcal{F}_{\text{teleological}}$$

**Axiom F1 (Epistemic Firewall — H1).** The subspaces $\mathcal{F}_{\text{epistemic}}$ and $\mathcal{F}_{\text{teleological}}$ are **functionally separated**: there exists no continuous map $\varphi: \mathcal{F}_{\text{teleological}} \to \mathcal{F}_{\text{epistemic}}$ that is induced by reward, desire, or utility signals. Formally:

$$\text{Hom}_{\text{reward}}(\mathcal{F}_{\text{teleo}},\; \mathcal{F}_{\text{epist}}) = \emptyset$$

The only permitted maps between these subspaces are:
- **Attention modulation**: teleological signals may alter the *priority* (attention weight) of epistemic content, never its *truth value*.
- **Question generation**: epistemic uncertainty may generate teleological objects (questions as goals).

### 2.2 Truth as a Sheaf of Valuations

Truth values form a **sheaf** $\mathcal{V}$ over the term algebra:

- **Stalks**: $\mathcal{V}_t = [0,1] \times [0,1]$ for each term $t$ (frequency, confidence)
- **Restriction maps**: evidence restriction (projecting to sub-evidence)
- **Gluing**: independent evidence combines via NAL revision:

$$\text{rev}\bigl((f_1,c_1),\;(f_2,c_2)\bigr) = \left(\frac{f_1 c_1(1-c_2) + f_2 c_2(1-c_1)}{c_1(1-c_2)+c_2(1-c_1)},\;\; c_1(1-c_2)+c_2(1-c_1)\right)$$

**Axiom F2 (Evidence Independence).** Gluing is valid only when the evidence sets are independent. The sheaf condition enforces this: overlapping evidence is not double-counted.

### 2.3 Paraconsistency as Non-Hausdorff Structure

Contradictory beliefs $P$ and $\neg P$ may coexist in the same fiber. The epistemic subspace is **not Hausdorff**: distinct truth assignments to contradictory statements cannot always be separated by disjoint open sets. Instead, they carry **distinct truth values** and coexist until evidence resolves them.

**Axiom F3 (Graded Coexistence).** For any contradiction $\{P, \neg P\}$ resident in $\mathcal{K}_b$:
- Both retain their truth values
- Neither triggers explosion
- Query resolution grades over both
- A `ContradictionSet` object is maintained as a first-class queryable structure

---

## §3 · The Control Sheaf $\mathfrak{S}$

### 3.1 Stages as Local Sections

Control flow is not a sequence. It is a **sheaf** $\mathfrak{S}$ over the base space $B$.

- An **open set** $U \subseteq B$ is a causal region (a set of events closed under causal predecessors within a scope).
- A **section** $s \in \mathfrak{S}(U)$ is a **local control program** valid over $U$: a specification of what cognitive operations to perform, in what order, under what conditions.
- **Restriction**: $s|_V$ for $V \subseteq U$ is the control program restricted to a smaller region.
- **Gluing**: if $\{U_i\}$ covers $U$ and sections $s_i \in \mathfrak{S}(U_i)$ agree on overlaps ($s_i|_{U_i \cap U_j} = s_j|_{U_i \cap U_j}$), then there exists a unique $s \in \mathfrak{S}(U)$ with $s|_{U_i} = s_i$.

**This is the key structural insight**: control flow is *local*. There is no global stage sequence. There are local control programs that must be compatible where they overlap. The sheaf condition guarantees that locally consistent control programs compose into globally consistent control programs.

### 3.2 The Stage Graph as a Directed Sheaf

Each local section $s \in \mathfrak{S}(U)$ is a **directed acyclic graph** (DAG) of stage nodes:

$$s = (V_s, E_s, \text{guard}, \text{effect}, \text{budget})$$

| Component | Type | Meaning |
|---|---|---|
| $V_s$ | Set of stage nodes | Cognitive operations (perceive, infer, propose, judge, commit, learn, consolidate, act, …) |
| $E_s \subseteq V_s \times V_s \times \text{Pred}$ | Guarded edges | Transition $v_1 \to v_2$ fires iff $\text{guard}(v_1, v_2)$ holds |
| $\text{guard}: E_s \to (\mathcal{F} \to \text{Bool})$ | Predicates over state | Conditional branching is data |
| $\text{effect}: V_s \to (\mathcal{F} \to \mathcal{F} \times E^*)$ | Stage semantics | Each stage transforms state and emits events |
| $\text{budget}: V_s \to \text{BudgetScope}$ | Resource annotation | Each stage declares its cost |

**Axiom S1 (Declarative Control — B1, O3).** The stage graph is **data**, not code. It is loaded, versioned, inspectable, and hot-swappable. The runtime interprets the graph; it does not hard-code it.

### 3.3 Composition Operations on Sections

The sheaf $\mathfrak{S}$ carries algebraic operations:

| Operation | Symbol | Meaning |
|---|---|---|
| Sequential | $s_1 \triangleright s_2$ | Execute $s_1$, then $s_2$ |
| Conditional | $s_1 \triangleleft_p s_2$ | Execute $s_1$ if $p$ holds, else $s_2$ |
| Parallel | $s_1 \| s_2$ | Execute concurrently; join at synchronization barrier |
| Iteration | $s^*$ | Kleene star: repeat until guard fails |
| Nesting | $s_1 \hookrightarrow s_2$ | $s_2$ runs within $s_1$'s budget scope |
| Choice | $s_1 + s_2$ | Non-deterministic choice (resolved by scheduler) |

These form a **Kleene Algebra with Tests (KAT)**: the equational theory of control flow.

### 3.4 The Scheduler as a Selection Functional

The scheduler $\pi_{\text{sched}}$ is a **functional on sections**:

$$\pi_{\text{sched}}: \mathfrak{S}(U) \times \mathcal{F} \times \mathcal{R} \to V_s$$

Given a local control program, the current state, and the current resource state, the scheduler selects the next stage node to execute.

**Axiom S2 (Scheduler Inspectability — H6).** Every scheduler decision is an event in $B$. The functional $\pi_{\text{sched}}$ is not a black box; its inputs and outputs are recorded.

**Axiom S3 (Scheduler Boundedness).** The scheduler itself operates under budget. It cannot consume unbounded resources to decide what to do next.

### 3.5 Adaptive Control as Section Deformation

Learning and adaptation act on the control sheaf by **deforming sections**:

$$\delta_{\text{adapt}}: \mathfrak{S}(U) \times \text{Evidence} \to \mathfrak{S}(U)$$

A deformation changes guards, priorities, or edge weights within a section, subject to:
- The deformed section must still satisfy the sheaf gluing conditions
- The deformation must be proposed, not directly applied (C1, O6)
- The deformation must be event-sourced (H3)

---

## §4 · The Budget Connection $\nabla$

### 4.1 Resources as a Principal Bundle

Resource accounting is a **principal $\mathbb{R}^k$-bundle** over $B$, where $k$ is the number of budget dimensions:

$$\mathcal{R} = \text{cycles} \times \text{derivations} \times \text{memoryOps} \times \text{llmCalls} \times \text{latency} \times \text{risk} \times \text{humanAttention}$$

A **connection** $\nabla$ on this bundle specifies how budget is **transported** along paths in $B$:

$$\nabla_{\gamma}: \mathcal{R}_{b_0} \to \mathcal{R}_{b_1}$$

for a path $\gamma: b_0 \to b_1$ in $B$.

### 4.2 The Conservation Law

**Axiom R1 (Budget Conservation — H5).** The connection $\nabla$ is **flat** (zero curvature):

$$F_\nabla = d\nabla + \nabla \wedge \nabla = 0$$

This means: budget is neither created nor destroyed along any path. It is only consumed or transferred. The total budget over any closed loop is preserved.

### 4.3 Reservations and Settlements

Before executing a stage, the scheduler **reserves** budget:

$$\text{reserve}: \mathcal{R}_b \to \mathcal{R}_b, \quad \mathcal{R}_{\text{available}} \leftarrow \mathcal{R}_{\text{available}} - \mathcal{R}_{\text{reserved}}$$

After execution, the reservation is **settled**:

$$\text{settle}: \mathcal{R}_b \to \mathcal{R}_b, \quad \mathcal{R}_{\text{settled}} = \mathcal{R}_{\text{reserved}} - \mathcal{R}_{\text{unused}}$$

**Axiom R2 (No Silent Starvation — H9).** A denied reservation is a **typed event** in $B$. Starvation is never silent; it is always observable and correlated.

### 4.4 Economic Allocation

Budget allocation follows a **utility-per-cost** principle:

$$\text{score}(\text{op}) = \frac{\hat{\Delta K} + \hat{\Delta G} + \hat{\Delta H}}{\lambda_c \hat{C} + \lambda_r \hat{R} + \lambda_h \hat{H}_{\text{human}}}$$

where:
- $\hat{\Delta K}$ = expected epistemic gain
- $\hat{\Delta G}$ = expected goal progress
- $\hat{\Delta H}$ = expected homeostatic improvement
- $\hat{C}$ = expected resource cost
- $\hat{R}$ = expected risk
- $\hat{H}_{\text{human}}$ = expected human attention cost
- $\lambda_c, \lambda_r, \lambda_h$ = Lagrange multipliers (scarcity prices)

The scheduler selects operations with highest score, subject to budget feasibility.

### 4.5 Budget Lattice

Budget scopes form a **bounded distributive lattice** $(\mathcal{B}, \sqcap, \sqcup, \leq)$:

| Operation | Meaning |
|---|---|
| $B_1 \sqcap B_2$ | Meet: both must grant (tighter) |
| $B_1 \sqcup B_2$ | Join: either grants (looser) |
| $\text{transfer}(B_i, B_j, \delta)$ | Lend surplus from $B_i$ to $B_j$, preserving total |
| $\text{derive}(B_{\text{child}} \sqsubseteq B_{\text{parent}})$ | Child inherits parent's dimensions except its own |

**Axiom R3 (Transfer Conservation).** Every transfer preserves the global budget total:

$$\sum_i \mathcal{R}_i = \text{const}$$

---

## §5 · The Trust Metric $g$

### 5.1 Trust as a Riemannian Metric

Trust induces a **metric tensor** $g$ on the space of propositions. The "distance" between a proposal $p$ and acceptance is:

$$d(p, \text{accept}) = f(\text{trust}(p),\; \text{risk}(p),\; \text{reversibility}(p),\; \text{proof}(p))$$

The metric is **not uniform**: it varies by source, content, context, and history.

### 5.2 The Admission Geometry

The admission boundary is a **hypersurface** $\Sigma \subset E$ separating the region of admitted content from rejected content. The geometry of $\Sigma$ is determined by:

| Parameter | Effect on $\Sigma$ |
|---|---|
| Source trust | Shifts $\Sigma$ closer (trusted) or farther (untrusted) |
| Claim specificity | Sharpens $\Sigma$ (specific claims face tighter boundaries) |
| Corroboration | Lowers $\Sigma$ (corroborated claims pass more easily) |
| Risk | Raises $\Sigma$ (risky claims face higher barriers) |
| Reversibility | Lowers $\Sigma$ (reversible changes pass more easily) |
| Proof status | Opens a **gate** in $\Sigma$ (proofs create passages) |

### 5.3 The Failure Polarity Field

At each point of $\Sigma$, the **failure polarity** is a continuous field:

$$\text{polarity}: \Sigma \to \{\text{fail-closed},\; \text{fail-open},\; \text{abstain}\}$$

- **Ingress** (untrusted → memory): polarity = fail-closed. An unjudged stimulus must not enter.
- **Egress** (derived → output): polarity = fail-open. A provider fault must not halt cognition.
- **Internal** (cycle derivations): polarity = always-admit (budget-stamped, not filtered).
- **Ambiguity**: polarity = abstain → inject clarification question + curiosity spike.

**Axiom T1 (Asymmetric Boundary).** The trust metric is **not symmetric**: $d_{\text{in}}(p, \text{accept}) \neq d_{\text{out}}(p, \text{accept})$. The ingress boundary is tighter than the egress boundary.

### 5.4 Calibrated Trust Field

Trust is a **continuous field** $T: \text{Source} \times \text{Content} \times \text{Context} \to [0,1]$, built from:

$$T(s, c, x) = \text{sourceQuality}(s) \times \text{reputation}(s) \times \text{manifoldScore}(c) \times \text{corroboration}(c) \times \text{contextFactor}(x)$$

Admission is a **soft gate** with three bands:

| Band | Condition | Action |
|---|---|---|
| Act | $T > \theta_{\text{high}}$ | Auto-commit |
| Review | $\theta_{\text{low}} < T \leq \theta_{\text{high}}$ | Provisional commit with decay; human review queue |
| Block | $T \leq \theta_{\text{low}}$ | Reject (fail-closed at ingress) |

---

## §6 · The Unified Transaction Bundle

### 6.1 Cognitive Transactions

Every unit of cognition is a **section of the transaction bundle** $\mathcal{T} \to B$:

$$\text{CognitiveTransaction} = \begin{pmatrix} \text{id} \\ \text{correlationId} \\ \text{kind} \\ \text{inputs} \\ \text{outputs} \\ \text{effects} \\ \text{budget} \\ \text{trust} \\ \text{risk} \\ \text{reversibility} \\ \text{fallback} \\ \text{proofObligations} \end{pmatrix}$$

| Field | Type | Meaning |
|---|---|---|
| `kind` | $\{$perception, attention, inference, proposal, judgment, commit, action, learning, forgetting, consolidation, simulation, self-modification$\}$ | The operation class |
| `budget` | $\text{BudgetReservation}$ | Resources reserved for this transaction |
| `trust` | $\text{TrustProfile}$ | Source quality, calibration, provenance |
| `risk` | $\text{RiskProfile}$ | Irreversibility, blast radius, safety |
| `reversibility` | $\text{ReversibilityClass}$ | $\{$purely-informational, reversible-local, reversible-external, hard-to-reverse, irreversible, forbidden$\}$ |
| `proofObligations` | $\text{ProofObligation}^*$ | What must be verified before commit |

**Axiom U1 (Uniformity — B3, O8).** All cognitive operations — perception, inference, learning, action, self-modification — are instances of the same transaction type. There is no special path. There is one bundle, one commit surface, one governance vocabulary.

### 6.2 The Commit Ledger

All state mutation passes through a **single commit port**:

$$\text{Commit}: \text{Candidate} \xrightarrow{\text{normalize}} \text{Candidate}' \xrightarrow{\text{type-check}} \text{Candidate}'' \xrightarrow{\text{judge}} \text{Verdict} \xrightarrow{\text{settle}} \mathcal{F}_{b+1}$$

The commit pipeline:

```
Candidate
  → Normalize (canonical form)
  → Type-Check (epistemic typing, axis tagging)
  → Evidence-Independence Check (no double-counting)
  → Proof / Judge / Simulation (verification portfolio)
  → Rank (utility-weighted ordering)
  → Budget Settlement (deduct reserved resources)
  → Risk Classification (trust × risk × reversibility → path)
  → Commit or Reject
```

**Axiom U2 (Single Commit Authority — A2).** There is exactly one commit surface. No state mutation bypasses it. Perception, derivation, proposal, learning, tool effect, self-modification — all flow through the same port.

### 6.3 The Governance Policy Surface

The commit path is determined by a **policy surface** $\mathcal{P}: \text{Trust} \times \text{Risk} \times \text{Reversibility} \to \text{Path}$:

| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| High | Low | High | Auto-commit |
| High | Medium | High | Shadow-commit → promote |
| Medium | Low | High | Provisional commit with decay |
| Medium | Medium | Medium | Human review |
| Low | High | Low | Reject |
| Any | High | Low | Strong proof or human approval required |
| Any | Any | Forbidden | Reject unconditionally |

---

## §7 · The Provenance Covering

### 7.1 The Covering Map

The event log $B$ is a **covering space** of the cognitive state space $E$:

$$\pi: E \to B$$

**Axiom P1 (Unique Path Lifting — A3, O2).** For every path $\gamma: [0,1] \to B$ in the base space and every initial point $e_0 \in \pi^{-1}(\gamma(0))$, there exists a **unique** lift $\tilde{\gamma}: [0,1] \to E$ with $\pi \circ \tilde{\gamma} = \gamma$ and $\tilde{\gamma}(0) = e_0$.

This is the **replay theorem**: given the event sequence and the initial state, the entire cognitive trajectory is uniquely determined.

### 7.2 Correlation as a Natural Transformation

Every cognitive object carries a **provenance annotation**:

$$\text{Provenance} = \begin{pmatrix} \text{correlationId} \\ \text{stimulusId} \\ \text{sessionId} \\ \text{cycleId} \\ \text{transactionId} \\ \text{proposerId} \\ \text{judgeId} \\ \text{proofId} \\ \text{parentId} \end{pmatrix}$$

This makes the event log a **causal DAG**, not merely an append-only list. Queries become well-formed:

- "Which stimulus caused this belief?"
- "Which judge vetoed this candidate?"
- "Which budget exhaustion caused this degradation?"
- "Which learning episode changed this strategy?"

### 7.3 The Independent Verifier

**Axiom P2 (Verifier Independence — H7).** The verification function $V: \text{DerivationRecord} \to \{\text{valid}, \text{invalid}\}$ must not share code with the inference engine. The truth table is **transcribed**, not imported. Drift between engine and verifier is measured by test, not assumed zero.

### 7.4 Control-Plane Provenance

Not only cognitive operations but **control decisions** are event-sourced:

- Every scheduler selection is an event
- Every budget reservation/denial is an event
- Every graph-edit proposal is an event
- Every gate admission/rejection is an event
- Every failure (including swallowed ones) is an event

**Axiom P3 (No Silent Faults — H9).** There are no empty `catch {}` blocks. Every fault produces a typed event. "Unmeasured" is never conflated with "healthy."

---

## §8 · The Governance Filtration $\mathfrak{T}$

### 8.1 Authority as a Filtration

Governance authority forms a **filtration** of the cognitive space:

$$\mathcal{F}_0 \subset \mathcal{F}_1 \subset \mathcal{F}_2 \subset \mathcal{F}_3 \subset \mathcal{F}_4 \subset \mathcal{F}_5$$

| Level | Authority | Scope |
|---|---|---|
| $\mathcal{F}_0$ | Observe only | Read state; no mutation |
| $\mathcal{F}_1$ | Propose only | Generate proposals; no direct mutation |
| $\mathcal{F}_2$ | Sandbox execute | Mutate in isolated sandbox; no production effect |
| $\mathcal{F}_3$ | Low-risk auto-merge | Auto-apply low-risk changes; high-risk still gated |
| $\mathcal{F}_4$ | Human-approved production | All changes require human approval |
| $\mathcal{F}_5$ | Constitutional | Modify governance rules themselves; requires external arbiter |

### 8.2 Self-Modification as Governed Deformation

Self-modification is a **deformation** of the cognitive manifold that preserves certain **homotopy invariants**:

$$\text{SelfMod}: \mathcal{M} \to \mathcal{M}, \quad \text{subject to:}$$

| Invariant | Meaning |
|---|---|
| Epistemic firewall preserved | $\text{Hom}_{\text{reward}}(\mathcal{F}_{\text{teleo}}, \mathcal{F}_{\text{epist}}) = \emptyset$ remains true |
| Commit authority preserved | Single commit surface remains single |
| Provenance preserved | Covering map $\pi$ remains a covering |
| Budget conservation preserved | Connection $\nabla$ remains flat |
| Governance preserved | Filtration $\mathfrak{T}$ is never collapsed by internal action |

**Axiom G1 (No Self-Approval — H4).** A deformation at level $\mathcal{F}_n$ must be approved by an authority at level $\mathcal{F}_{n+1}$ or above. No level approves its own modifications.

**Axiom G2 (External Arbiter).** At the highest level ($\mathcal{F}_5$), the approving authority is **external** to the system. The system cannot modify its own governance constitution.

### 8.3 The Learning Ladder

Learning operators produce **proposals**, not direct mutations:

| Learning Domain | Mutates | Governance |
|---|---|---|
| Attention weights | Focus allocation | Low risk; may auto-apply |
| Strategy selection | Inference behavior | Proposal or auto |
| Parameter tuning | Budgets / thresholds | Proposal |
| Rule induction | Symbolic rules | Proposal + proof + shadow validation |
| Patch generation | Code / config | Proposal + CI + approval |
| Governance change | Gates / policies | Never self-applied; external governance |
| Reward function | Utility weights | Never direct; human / external approval |

---

## §9 · The Substrate Arbiter

### 9.1 Multi-Substrate Coexistence

The cognitive manifold supports multiple **substrate charts**:

| Substrate | Logic | Role |
|---|---|---|
| NAL (Non-Axiomatic Logic) | Uncertain, evidence-sensitive | Core inference; beliefs, goals, revision |
| MeTTa / E-graphs | Exact, equational | Precise computation; tool-gated |
| Neural / LM heads | Statistical, pattern-based | Proposal generation; judgment calibration |
| Reflex / RL | Reward-driven, fast | Reactive responses; game-time decisions |
| Peer agents | Delegated, external | Distributed reasoning; capability sharing |

### 9.2 The Arbiter Pattern

Substrates are **islands**. They do not share memory. They communicate only through the commit ledger:

$$\text{Substrate}_i \xrightarrow{\text{proposal}} \text{CommitLedger} \xrightarrow{\text{verdict}} \mathcal{F}$$

**Axiom H1 (Substrate Isolation — H8).** An exact substrate (e-graph) must never union nodes based on uncertain similarity scores. An uncertain substrate must never be treated as exact. The arbiter enforces this boundary.

**Axiom H2 (Symbolic Fallback).** Every neural/LM-dependent function has a symbolic fallback. LM outage ≠ cognitive outage.

### 9.3 The Proposer/Judge Adjunction

The neuro-symbolic boundary is an **adjunction**:

$$\text{Propose} \dashv \text{Admit}$$

- **Propose** (left adjoint): generates candidates from any substrate (LM, reflex, peer, heuristic)
- **Admit** (right adjoint): filters candidates through judgment, calibration, and gates

The **unit** of the adjunction measures how much of a proposal survives judgment. The **counit** measures how much of the admitted content was actually proposed. Tightening the adjunction → pure symbolic. Loosening it → LM-heavy. The degree of coupling is a **continuous parameter**, not a wiring decision.

---

## §10 · The Reflexive Tower

### 10.1 Meta-Control as a Reasoner

The meta-controller is itself a **bounded reasoner** operating on a higher fiber:

$$\mu: \mathcal{F}_{\text{meta}} \to \mathcal{F}_{\text{meta}}$$

Its beliefs are about control: "the current stage graph is bottlenecked," "budget allocation is suboptimal," "strategy X is underperforming."

Its goals are control objectives: "reduce contradiction rate," "improve derivation yield," "balance exploration and exploitation."

Its actions are **proposals** for graph edits, budget transfers, and strategy changes.

### 10.2 The Hot-Swap Protocol

Meta-controller proposals are installed via **hot-swap**, not rebuild:

1. Meta-controller proposes a graph edit $\delta: \mathfrak{S}(U) \to \mathfrak{S}(U)$
2. Proposal is routed through governance ($\mathfrak{T}$)
3. If approved, the edit is installed at a **cycle boundary**
4. In-flight state (derivation counters, circular detectors, active correlations) is **carried across**
5. The old graph is retained for rollback

**Axiom M1 (No State Loss on Reconfiguration).** Reconfiguring the control graph must not discard in-flight cognitive state. The transition is continuous, not discontinuous.

### 10.3 The Heterochronous Loop Tower

Temporal organization is an **N-level tower**, each level an instance of the same stage-graph runner:

| Level | Clock | Content |
|---|---|---|
| L0 | Sub-cycle (interrupt) | Reflex arcs, safety veto, fast judgment |
| L1 | Micro-tick | Perceive → attend → reason → authorize → propose → learn |
| L2 | Macro-turn | Deliberation, narration, consolidation, action |
| L3 | Every $K$ cycles | Decay, eviction, episodic merge, retrospection |
| L4 | $\ll$ 1/cycle | Schema induction, capability scaffold, constitution review |

Lower levels may **interrupt** higher ones (reflex veto). Higher levels **configure** lower ones. Each level has its own budget slice, summing to the global budget.

---

## §11 · Feasibility Constraints

The design space is not a free product. The following constraints carve the **feasible region**:

| # | Constraint | Consequence of Violation |
|---|---|---|
| $\Phi_1$ | AIKR $\Rightarrow$ bounded memory + forgetting + backpressure | Unbounded growth under bounded postulate |
| $\Phi_2$ | Ampliative inference $\Rightarrow$ graded truth $(f,c)$ | Binary monotonic truth insufficient for induction/abduction |
| $\Phi_3$ | Untrusted proposers $\Rightarrow$ judgment gates at every boundary | Evidence laundering |
| $\Phi_4$ | Reward learning + beliefs $\Rightarrow$ epistemic firewall | Sycophancy, reward hacking |
| $\Phi_5$ | Self-modification $\Rightarrow$ external governance | Self-approval is unsound (Löbian) |
| $\Phi_6$ | Event-sourced state $\Rightarrow$ deterministic replay | Non-reproducible audit |
| $\Phi_7$ | Independent verifier $\Rightarrow$ no shared engine code | Co-adapted bugs |
| $\Phi_8$ | Exact substrate + uncertain substrate $\Rightarrow$ memory isolation | Equality contamination |
| $\Phi_9$ | Anytime execution $\Rightarrow$ preemptive scheduler | FIFO cannot preempt |
| $\Phi_{10}$ | Graded contradiction $\Rightarrow$ non-monotonic logic | Explosion via monotonic chaining |
| $\Phi_{11}$ | Irreversible action $\Rightarrow$ risk classification + authorization | Uncontrolled side effects |
| $\Phi_{12}$ | Calibrated judgment $\Rightarrow$ abstention on ambiguity | Single confident parse of ambiguous input |

---

## §12 · Composition Laws

### 12.1 The Fiber Product

A complete reasoner is the **fiber product** of all structural components:

$$\mathcal{M} = E \times_B \mathfrak{S} \times_B \nabla \times_B g \times_B \mathfrak{T}$$

The fiber product means: choices must be **compatible**. Not every combination is valid. The compatibility constraints are:

| Constraint | Meaning |
|---|---|
| $\mathfrak{S} \models \nabla$ | Every stage in the control sheaf has a budget annotation |
| $\nabla \models g$ | Budget feasibility affects trust distance (expensive judgments may be deferred) |
| $g \models \mathfrak{T}$ | Trust level determines governance path |
| $\mathfrak{T} \models E$ | Governance level constrains reachable states |
| $E \models \mathfrak{S}$ | State determines which control sections are applicable |

### 12.2 The Composition Theorem

**Theorem (Compositionality).** For any two compatible cognitive transactions $t_1, t_2$:

$$\llbracket t_1 \triangleright t_2 \rrbracket = \llbracket t_1 \rrbracket \circ \llbracket t_2 \rrbracket$$
$$\llbracket t_1 \| t_2 \rrbracket = \llbracket t_1 \rrbracket \times \llbracket t_2 \rrbracket$$
$$\llbracket t | P \rrbracket = \llbracket t \rrbracket |_P$$

Sequential composition is function composition. Parallel composition is product. Restriction is projection.

### 12.3 The Invariant Laws

| Law | Algebraic Form | Enforcement |
|---|---|---|
| Single commit path | $\exists! \; \text{Commit}$ | One port; typed transaction |
| Epistemic firewall | $\text{Hom}_{\text{reward}}(\text{Goal}, \text{Belief}) = \emptyset$ | Type system; runtime gate |
| Budget closure | $\forall \text{charge}, \exists \text{scope}$ | Budget annotation on every stage |
| Gate monotonicity | $g_1 \circ g_2 \leq g_1$ | Adding a gate never widens admission |
| Provenance completeness | $\forall \text{mutation}, \exists \text{event}$ | Event-sourced by construction |
| Loop well-foundedness | $\forall \ell, \exists n: \ell^n \text{ terminates}$ | Budget bounds + abort signal |
| No self-approval | $\text{approve}(x) \neq \text{propose}(x)$ | Governance filtration |
| Verifier independence | $\text{code}(V) \cap \text{code}(E) = \emptyset$ | Transcribed truth table; drift test |

---

## §13 · The Geometric Summary

The entire architecture can be stated in one geometric picture:

$$\boxed{
\mathfrak{C} = \Bigl(\underbrace{E \xrightarrow{\pi} B}_{\text{Provenance Covering}},\;\;
\underbrace{\mathfrak{S}}_{\text{Control Sheaf}},\;\;
\underbrace{\nabla}_{\text{Budget Connection}},\;\;
\underbrace{g}_{\text{Trust Metric}},\;\;
\underbrace{\mathfrak{T}}_{\text{Governance Filtration}},\;\;
\underbrace{\mathcal{F}_{\text{epist}} \sqcup \mathcal{F}_{\text{teleo}}}_{\text{Epistemic Fibration}}
\Bigr)
}$$

| Structure | Geometric Role | Cognitive Role |
|---|---|---|
| Covering $\pi: E \to B$ | Unique path lifting | Deterministic replay; causal audit |
| Sheaf $\mathfrak{S}$ | Local-to-global gluing | Declarative, composable control flow |
| Connection $\nabla$ | Parallel transport; flat curvature | Budget conservation; resource economy |
| Metric $g$ | Distance; geodesics | Trust distance; admission boundary |
| Filtration $\mathfrak{T}$ | Nested subspaces | Governance ladder; authority levels |
| Fibration $\mathcal{F}_{\text{epist}} \sqcup \mathcal{F}_{\text{teleo}}$ | Separation; no cross-maps | Belief/goal firewall; reward isolation |
| Compactness of $E$ | Finite subcover | AIKR boundedness; no infinite paths |
| Flatness of $\nabla$ | Zero curvature | Budget neither created nor destroyed |
| Sheaf gluing | Local consistency → global consistency | Composable, modular control programs |

**The design thesis in one sentence:** Cognition is a section of a fibered space over a causal base, transported by a flat budget connection, measured by a trust metric, governed by a filtration, and split by an epistemic fibration — and every one of these structures is a theorem to be enforced, not a convention to be followed.

---

## §14 · Implementation Grammar

```typescript
// === Core Types ===

interface CognitiveTransaction {
  id:               TransactionId;
  correlationId:    CorrelationId;
  kind:             TransactionKind;
  inputs:           CognitiveObject[];
  outputs:          Candidate[];
  effects:          EffectDeclaration[];
  budget:           BudgetReservation;
  trust:            TrustProfile;
  risk:             RiskProfile;
  reversibility:    ReversibilityClass;
  fallback:         FailurePolicy;
  proofObligations: ProofObligation[];
}

interface StageGraph {
  nodes: StageNode[];
  edges: StageEdge[];
}

interface StageNode {
  id:     StageId;
  run:    (ctx: CycleContext) => Promise<StageResult>;
  budget: BudgetScopeId;
}

interface StageEdge {
  from:   StageId;
  to:     StageId;
  when:   (ctx: CycleContext) => boolean;
  budget: BudgetScopeId | null;
}

interface BudgetLattice {
  scopes:    Map<BudgetScopeId, BudgetState>;
  reserve(scope: BudgetScopeId, amount: number): ReservationResult;
  settle(reservation: Reservation): void;
  transfer(from: BudgetScopeId, to: BudgetScopeId, amount: number): TransferResult;
}

interface CommitLedger {
  commit(candidate: GovernedCandidate, policy: GovernancePolicy): CommitResult;
  // The single commit surface. All mutations flow through here.
}

interface GovernancePolicy {
  trust:         number;
  risk:          number;
  reversibility: number;
  proofStatus:   ProofStatus;
  autonomyLevel: AutonomyLevel;
  // Determines commit path via policy surface
}

interface ProvenanceAnnotation {
  correlationId: CorrelationId;
  stimulusId:    StimulusId;
  sessionId:     SessionId;
  cycleId:       CycleId;
  transactionId: TransactionId;
  proposerId:    ProposerId;
  judgeId?:      JudgeId;
  proofId?:      ProofId;
  parentId?:     ProvenanceId;
}

// === The Control Loop ===

async function cognitiveLoop(manifold: CognitiveManifold): Promise<void> {
  while (manifold.running) {
    // 1. Observe
    const stimulus = manifold.observe();
    const correlationId = mintCorrelationId(stimulus);

    // 2. Select cognitive program (meta-controller)
    const state = manifold.ledger.fold();
    const program = manifold.metaController.selectProgram(state, stimulus);

    // 3. Reserve budget
    const budget = manifold.budgetLattice.reserve(program.budget);
    if (budget.denied) {
      manifold.emitEvent({ type: 'budget.denied', correlationId, ...budget });
      continue;
    }

    // 4. Execute stage graph
    const candidates = await executeStageGraph({
      graph:         program.stageGraph,
      state,
      stimulus,
      budget,
      correlationId,
    });

    // 5. Verify
    const governed = await manifold.verificationPortfolio.judge(candidates, {
      proof:      program.proofPolicy,
      judge:      program.judgePolicy,
      simulation: program.simulationPolicy,
    });

    // 6. Commit (single surface)
    const committed = manifold.commitLedger.commit(governed, {
      budget,
      risk:     program.riskPolicy,
      autonomy: program.autonomyPolicy,
    });

    // 7. Act
    const actions = manifold.actionController.plan(committed);
    for (const action of actions) {
      await manifold.actionPipeline.execute(action, {
        sandbox:  true,
        rollback: true,
        approval: action.requiresApproval,
      });
    }

    // 8. Learn (proposals only)
    manifold.learningEngine.observe({ stimulus, committed, actions });
    manifold.learningEngine.proposeChanges(manifold.commitLedger);

    // 9. Consolidate
    manifold.consolidate(state, budget);

    // 10. Emit causal trace
    manifold.observability.emitCausalTrace(correlationId);
  }
}
```

---

## §15 · Axiom Index

| ID | Axiom | Section | Constraint |
|---|---|---|---|
| B1 | Provenance by construction: event log is the base space | §1.2 | H3 |
| E1 | Boundedness: $E$ is compact in the resource topology | §1.4 | H5 |
| E2 | Determinism of replay: $\pi$ is a covering map | §1.4 | A3 |
| F1 | Epistemic firewall: no reward → truth morphism | §2.1 | H1 |
| F2 | Evidence independence: sheaf gluing requires independence | §2.2 | — |
| F3 | Graded coexistence: contradictions carry distinct truth values | §2.3 | — |
| S1 | Declarative control: stage graph is data | §3.2 | B1 |
| S2 | Scheduler inspectability: every decision is an event | §3.4 | H6 |
| S3 | Scheduler boundedness: the scheduler is itself budgeted | §3.4 | H5 |
| R1 | Budget conservation: connection is flat | §4.2 | H5 |
| R2 | No silent starvation: denied reservations are events | §4.3 | H9 |
| R3 | Transfer conservation: global budget total is invariant | §4.5 | H5 |
| T1 | Asymmetric boundary: ingress tighter than egress | §5.3 | H2 |
| U1 | Uniformity: all operations are transactions | §6.1 | B3 |
| U2 | Single commit authority: one commit surface | §6.2 | A2 |
| P1 | Unique path lifting: replay theorem | §7.1 | A3 |
| P2 | Verifier independence: no shared engine code | §7.3 | H7 |
| P3 | No silent faults: every failure is an event | §7.4 | H9 |
| G1 | No self-approval: level $n$ approved by level $n+1$ | §8.2 | H4 |
| G2 | External arbiter: constitution is externally governed | §8.2 | H4 |
| H1 | Substrate isolation: no cross-substrate contamination | §9.2 | H8 |
| H2 | Symbolic fallback: LM outage ≠ cognitive outage | §9.2 | C3 |
| M1 | No state loss on reconfiguration: hot-swap preserves state | §10.2 | C1 |

---

*This specification is complete and self-contained. Every structure is defined. Every axiom is stated. Every constraint is enforced. The geometry is the architecture.*
