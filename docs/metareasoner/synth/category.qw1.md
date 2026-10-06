# $\mathfrak{R}$ — A Coalgebraic Specification of the Reasoner Design Space

## Complete & Self-Contained

---

## §0 — Governing Selection

### Prime Objectives

| ID | Principle | Role in this specification |
|---|---|---|
| **O1** | Maximum epistemic integrity | §3: Epistemic grading as a categorical invariant |
| **O2** | Auditable causal provenance | §7: Provenance as cofree comonad; §11: Final coalgebra semantics |
| **O3** | Control-plane fluidity | §4: Stage graphs as Kleisli morphisms; control words as data |
| **O4** | Resource economics | §5: Budget as quantale-valued valuation functor |
| **O5** | Minimal implementable kernel | §2: Five irreducible generators |
| **O6** | Governed reflexivity | §8: Filtration of authority subcategories |
| **O7** | Neuro-symbolic synergy | §6: Proposer/judge adjunction |
| **O8** | Unified commit ledger | §9: Commit as colimit |
| **O12** | Formal/mathematical rigor | Throughout: equational laws, universal properties, typed invariants |

### Hard Constraints (all ten, non-negotiable)

| ID | Constraint | Categorical enforcement |
|---|---|---|
| **H1** | No reward → belief-truth mutation | §3: No morphism $\text{Reward} \to \text{Truth}_B$ in graded category |
| **H2** | No untrusted proposal enters memory unjudged | §6: Admission requires passage through gate lattice |
| **H3** | No state mutation without event | §7: Structure map factors through event comonad |
| **H4** | No self-approval of self-modification | §8: Governance filtration excludes reflexive morphisms at $L_4$ |
| **H5** | No unbounded reasoning path | §5: Valuation functor bounded by quantale ceiling |
| **H6** | No opaque scheduler decision | §7: Control decisions are events in the cofree comonad |
| **H7** | No verifier shares unsafe engine dependencies | §11: Replay functor is independent (natural transformation to a separate category) |
| **H8** | No e-graph union on uncertain similarity | §6: Substrate isolation via functor boundaries |
| **H9** | No silently swallowed failure | §10: Failure policy is a natural transformation, always observable |
| **H10** | No irreversible action bypasses risk classification | §9: Commit colimit requires governance profile |

### Anti-Goals

| ID | Anti-Goal | Design consequence |
|---|---|---|
| **A2** | Avoid scheduler opacity | §5: Every allocation is an event; market clearing is logged |
| **A5** | Avoid monolithic LM authority | §3, §6: LM is a proposer object, never a terminal object |
| **A7** | Avoid unbounded cognitive richness | §5: Drives, imagination, consolidation are budgeted operations |

### Architectural Character Bias

**D3 (Elegance/Unification) + D5 (Modularity) + D1 (Auditability) + D6 (Adaptivity under constraint)**

---

## §1 — The Ambient Category $\mathcal{C}$

### 1.1 Objects

Let $\mathcal{C}$ be a **locally small, complete, cocomplete category** of cognitive states. Its objects are structured knowledge carriers:

$$\text{Ob}(\mathcal{C}) = \{ \text{Beliefs},\; \text{Goals},\; \text{Questions},\; \text{Concepts},\; \text{Proposals},\; \text{Actions},\; \text{Lessons},\; \ldots \}$$

Each object $X \in \mathcal{C}$ carries:
- A **truth annotation** $\tau(X) \in \mathbb{T}$ (the truth algebra, §1.3)
- A **provenance annotation** $\pi(X) \in \mathcal{E}$ (event context, §7)
- A **grade** $\gamma(X) \in \{B, G, Q, P, A, L\}$ (epistemic axis, §3)

### 1.2 Morphisms

A morphism $f: X \to Y$ in $\mathcal{C}$ is a **cognitive operation**: it transforms one structured state into another. Every morphism carries:
- A **cost vector** $c(f) \in \mathbb{R}_{\geq 0}^n$ (resource consumption, §5)
- A **trust profile** $\theta(f) \in [0,1]^k$ (verification status, §6)
- An **event signature** $e(f) \in \mathcal{E}$ (what it logs, §7)

### 1.3 The Truth Algebra $\mathbb{T}$

The truth values form a **bounded distributive lattice** with two carriers:

$$\mathbb{T}_B = [0,1] \times [0,1] \quad \text{(frequency, confidence) for beliefs}$$
$$\mathbb{T}_G = [0,1] \times [0,1] \quad \text{(desire, confidence) for goals}$$

with operations:
- **Revision** $\star: \mathbb{T} \times \mathbb{T} \to \mathbb{T}$ (evidence combination, commutative, non-idempotent)
- **Decay** $\delta: \mathbb{T} \times \mathbb{N} \to \mathbb{T}$ (temporal forgetting)
- **Negation** $\neg: \mathbb{T} \to \mathbb{T}$

**Axiom (Evidence Independence):** For revision $a \star b$, the evidence bases of $a$ and $b$ must be independent (no shared derivation ancestors beyond a bounded lineage).

### 1.4 The Resource Quantale $\mathbb{Q}$

Resources form a **commutative quantale** $(\mathbb{Q}, \oplus, \mathbf{0}, \leq)$:
- $\oplus$: resource addition (commutative, associative)
- $\mathbf{0}$: zero resource
- $\leq$: "fits within" ordering
- $\top$: the ceiling (maximum allocatable)

$$\mathbb{Q} = \mathbb{R}_{\geq 0}^n \quad \text{(cycles, derivations, memory-ops, model-calls, latency, risk)}$$

with pointwise ordering and a **ceiling function** $\lceil \cdot \rceil: \mathbb{Q} \to \mathbb{Q}$.

---

## §2 — The Coalgebraic Reasoner

### 2.1 Core Definition

A **reasoner** is a coalgebra $(X, \alpha)$ for an endofunctor $F: \mathcal{C} \to \mathcal{C}$:

$$\alpha: X \longrightarrow F(X)$$

where $X$ is the **cognitive state space** (the carrier) and $F$ is the **cognitive signature functor**:

$$F(X) \;=\; \underbrace{\mathcal{O}(X)}_{\text{observations}} \;\times\; \underbrace{\mathcal{T}(X)}_{\text{transitions}} \;\times\; \underbrace{\mathcal{E}(X)}_{\text{events}} \;\times\; \underbrace{\mathcal{B}(X)}_{\text{budget state}}$$

Explicitly:
- $\mathcal{O}(X) = \text{Hom}_{\mathcal{C}}(\text{Stimulus}, X)$ — what can be perceived
- $\mathcal{T}(X) = \coprod_{o \in \text{Ops}} \text{Hom}_{\mathcal{C}}(X, X)$ — available transitions (operators)
- $\mathcal{E}(X) = X \times \text{Event}$ — state paired with its event emission
- $\mathcal{B}(X) = X \times \mathbb{Q}$ — state paired with remaining budget

### 2.2 The Five Irreducible Generators

The functor $F$ is generated by five primitive operations. Every reasoner in the design space is a model of these:

| Generator | Type | Meaning |
|---|---|---|
| $\mathsf{obs}$ | $1 \to \mathcal{O}(X)$ | Observe/perceive a stimulus |
| $\mathsf{step}$ | $X \to \mathcal{T}(X)$ | Select and apply one cognitive operator |
| $\mathsf{emit}$ | $X \to \mathcal{E}(X)$ | Emit an event (provenance) |
| $\mathsf{charge}$ | $X \to \mathcal{B}(X)$ | Consume budget |
| $\mathsf{gate}$ | $\mathcal{T}(X) \to \mathcal{T}(X) + \{\bot\}$ | Admit or refuse a transition |

### 2.3 The Tick as Coalgebra Unfolding

One cognitive cycle is the **anamorphism** (unfold) of the coalgebra:

$$\text{tick}: X \xrightarrow{\alpha} F(X) \xrightarrow{F(\alpha)} F^2(X) \xrightarrow{F^2(\alpha)} \cdots$$

The **behavior** of the reasoner is the unique coalgebra morphism into the **final coalgebra** $(\nu F, \zeta)$:

$$\llbracket \cdot \rrbracket: (X, \alpha) \longrightarrow (\nu F, \zeta)$$

This is the **provenance fold**: the complete, observable behavioral trace.

### 2.4 Bisimulation and Behavioral Equivalence

Two states $x, y \in X$ are **bisimilar** ($x \sim y$) iff there exists a span of coalgebra morphisms relating them. This gives:

- **Replay equivalence:** Two event logs produce bisimilar states iff they are behaviorally indistinguishable.
- **Verifier independence:** The replay functor $\text{Replay}: \mathcal{E}^* \to X$ operates in a category $\mathcal{C}'$ with no shared morphisms with the engine category (H7).

---

## §3 — Epistemic Grading (The Firewall)

### 3.1 The Grading Category $\mathcal{G}$

Define a small category $\mathcal{G}$ with objects $\{B, G, Q, P, A, L\}$:
- $B$ = Belief (epistemic)
- $G$ = Goal (teleological)
- $Q$ = Question (inquisitive)
- $P$ = Plan (practical)
- $A$ = Action (effectual)
- $L$ = Lesson (meta-cognitive)

### 3.2 Graded Objects

The ambient category $\mathcal{C}$ is **fibered over $\mathcal{G}$** via a functor:

$$\Gamma: \mathcal{C} \to \mathcal{G}$$

Every object $X$ has a grade $\Gamma(X)$. Every morphism $f: X \to Y$ must satisfy:

$$\Gamma(f): \Gamma(X) \to \Gamma(Y) \quad \text{is a valid grade transition}$$

### 3.3 The Firewall as an Absence Theorem

**Theorem (Epistemic Firewall).** In the graded category $\mathcal{C}$, there exists **no morphism**:

$$\nexists\; f: \text{Reward}_G \to \text{Truth}_B$$

That is: $\text{Hom}_{\mathcal{C}}(\text{Reward}_G, \text{Truth}_B) = \emptyset$.

**Proof sketch.** The grade functor $\Gamma$ maps $\text{Reward}_G$ to $G$ and $\text{Truth}_B$ to $B$. The only valid grade transitions into $B$ are from $B$ (evidence revision) and $Q$ (question resolution). There is no grade morphism $G \to B$ in $\mathcal{G}$. Therefore no cognitive operation can carry reward signal into factual truth. $\square$

### 3.4 Paraconsistent Coexistence

The truth lattice $\mathbb{T}_B$ is **non-trivial under contradiction**: for any proposition $\varphi$, both $\varphi$ and $\neg\varphi$ may coexist as distinct objects in $\mathcal{C}$ with distinct truth values:

$$\tau(\varphi) = (f_1, c_1) \quad \text{and} \quad \tau(\neg\varphi) = (f_2, c_2) \quad \text{with } c_1, c_2 > 0$$

This is **graded paraconsistency**: contradiction does not trigger explosion but rather retention with independent evidence accounting.

---

## §4 — Control Topology (Declarative Stage Graphs)

### 4.1 The Kleisli Category of Control

Control flow lives in the **Kleisli category** $\mathcal{C}_T$ of a monad $T$ on $\mathcal{C}$, where $T$ captures computational effects (budget consumption, event emission, gate consultation):

$$T(X) = X \times \mathbb{Q} \times \mathcal{E}^* \times \{0, 1\}$$

A morphism in $\mathcal{C}_T$ is:

$$f: X \to T(Y)$$

meaning: "given state $X$, produce state $Y$ while consuming resources, emitting events, and possibly being gated."

### 4.2 Stage Graphs as Data

A **stage graph** is a finite directed graph in $\mathcal{C}_T$:

$$\mathcal{S} = (V, E, \text{guard}, \text{effect})$$

where:
- $V = \{s_1, \ldots, s_n\}$ are **stage objects** (morphisms $s_i: X_i \to T(X_{i+1})$)
- $E \subseteq V \times V \times \text{Pred}$ are **guarded edges**
- $\text{guard}: E \to \text{Hom}_{\mathcal{C}}(X, \Omega)$ (predicates into the subobject classifier)
- $\text{effect}: V \to \text{Hom}_{\mathcal{C}}(X, T(X))$ (stage semantics)

### 4.3 Control Words (KAT Algebra)

The set of all valid stage graphs forms a **Kleene Algebra with Tests** (KAT):

| Operation | Symbol | Meaning |
|---|---|---|
| Sequence | $\kappa_1 \cdot \kappa_2$ | Execute $\kappa_1$ then $\kappa_2$ |
| Choice | $\kappa_1 + \kappa_2$ | Execute one or the other |
| Iteration | $\kappa^*$ | Repeat zero or more times |
| Test | $p?$ | Guard: proceed only if $p$ holds |
| Skip | $1$ | Identity (do nothing) |
| Abort | $0$ | Terminate immediately |

A reasoner's tick is the action of a **control word** $\kappa \in \text{KAT}$ on the state:

$$\Phi_\kappa: X \to T(X)$$

**Key principle:** $\kappa$ is **data**, not code. It can be inspected, replayed, A/B-tested, and modified by the meta-controller (subject to §8 governance).

### 4.4 Composition Laws for Control

$$\Phi_{\kappa_1 \cdot \kappa_2} = \Phi_{\kappa_2} \circ \Phi_{\kappa_1} \quad \text{(sequential)}$$
$$\Phi_{\kappa_1 + \kappa_2} = \Phi_{\kappa_1} \sqcup \Phi_{\kappa_2} \quad \text{(choice, resolved by scheduler)}$$
$$\Phi_{\kappa^*} = \bigsqcup_{n \geq 0} \Phi_{\kappa^n} \quad \text{(iteration as least fixpoint)}$$
$$\Phi_{p? \cdot \kappa} = \Phi_\kappa \circ \chi_p \quad \text{(test restricts domain)}$$

where $\chi_p: X \to X$ is the characteristic map of predicate $p$ (partial identity on the subobject where $p$ holds).

### 4.5 Multi-Rate Temporal Tower

The control topology supports an **N-level heterochronous tower**:

$$L_0 \subset L_1 \subset L_2 \subset \cdots \subset L_N$$

Each level $L_i$ is an instance of the stage-graph runner with:
- Its own clock rate $\omega_i$
- Its own budget slice $\beta_i$ (with $\sum_i \beta_i \leq \beta_{\text{global}}$)
- Its own trust posture $\theta_i$

Lower levels may **interrupt** higher levels (reflex veto). Higher levels **configure** lower levels (meta-control). The tower is a **filtration** in the categorical sense.

---

## §5 — Resource Valuation (Economic Budgets)

### 5.1 The Valuation Functor

Budget accounting is a **lax monoidal functor**:

$$\mathcal{V}: \mathcal{C} \to \mathbb{Q}$$

mapping each cognitive operation to its resource cost. The lax structure gives:

$$\mathcal{V}(f \circ g) \leq \mathcal{V}(f) \oplus \mathcal{V}(g) \quad \text{(sub-additivity)}$$

### 5.2 Reservation and Settlement

Before executing a transaction $\tau$, the scheduler **reserves**:

$$\beta_{\text{available}} \leftarrow \beta_{\text{available}} - \beta_{\text{reserved}}(\tau)$$

After execution, **settlement** occurs:

$$\beta_{\text{settled}} = \beta_{\text{reserved}} - \beta_{\text{unused}}$$

This is modeled as a **natural transformation** between the reservation functor and the settlement functor:

$$\sigma: \text{Reserve} \Rightarrow \text{Settle}$$

### 5.3 Utility Pricing

Each candidate operation $o$ is assigned a **cognitive utility score**:

$$u(o) = \frac{\hat{\Delta}K + \hat{\Delta}G + \hat{\Delta}H}{\lambda_c \cdot \hat{C} + \lambda_r \cdot \hat{R} + \lambda_h \cdot \hat{H}_{\text{human}}}$$

where:
- $\hat{\Delta}K$ = expected epistemic gain (information-theoretic)
- $\hat{\Delta}G$ = expected goal progress
- $\hat{\Delta}H$ = expected homeostatic improvement
- $\hat{C}$ = expected resource cost
- $\hat{R}$ = expected risk
- $\hat{H}_{\text{human}}$ = expected human attention cost

The scheduler selects operations by descending utility per unit scarce resource.

### 5.4 Budget Lattice

Budget scopes form a **bounded distributive lattice** $(\mathcal{B}, \sqcap, \sqcup, \leq)$:
- $\sqcap$ (meet): both scopes must grant (tighter)
- $\sqcup$ (join): either scope grants (looser)
- $\otimes$ (product): independent dimensions

Operations on the lattice:
- **Transfer:** $\text{transfer}(b_1, b_2, \delta)$ — lend surplus from $b_1$ to $b_2$, preserving $\oplus$-total
- **Sublation:** $\text{derive}(b_{\text{child}} \sqsubseteq b_{\text{parent}})$ — child inherits parent dimensions

### 5.5 The AIKR Axiom

**Axiom (Insufficient Knowledge and Resources).** For every reasoning path $p$:

$$\mathcal{V}(p) \leq \lceil \beta \rceil < \infty$$

No reasoning path is unbounded. Every path has a finite budget ceiling. When the ceiling is reached, the system **degrades gracefully** (yields partial results, drops lowest-priority work, or asks for clarification) rather than halting or producing undefined behavior.

---

## §6 — Admission, Trust, and the Proposer/Judge Adjunction

### 6.1 The Gate Lattice

Gates form a **bounded lattice** $(\mathcal{G}, \leq, \wedge, \vee, \top, \bot)$:

- $g_1 \leq g_2$ iff $g_1$ admits a subset of what $g_2$ admits
- $g_1 \wedge g_2$: conjunction (both must admit)
- $g_1 \vee g_2$: disjunction (either admits)
- $\top$: always admit (fail-open)
- $\bot$: never admit (fail-closed)

Each gate is either:
- An **interior operator** (contractive, $g(x) \leq x$): fail-closed
- A **closure operator** (extensive, $x \leq g(x)$): fail-open

### 6.2 The Proposer/Judge Adjunction

The neuro-symbolic boundary is an **adjunction**:

$$\mathsf{Propose} \dashv \mathsf{Judge}$$

$$\mathsf{Propose}: \mathcal{C}_{\text{untrusted}} \to \mathcal{C}_{\text{proposals}}$$
$$\mathsf{Judge}: \mathcal{C}_{\text{proposals}} \to \mathcal{C}_{\text{committed}}$$

with unit $\eta: \text{Id} \Rightarrow \mathsf{Judge} \circ \mathsf{Propose}$ measuring how much of a proposal survives judgment.

**The Judgment Manifold** is the (co)unit of this adjunction: it quantifies the propose-judge gap. Tightening the adjunction → pure symbolic. Loosening → neural-heavy. This makes "how much to trust System 1" a **continuous parameter**.

### 6.3 Trust as a Functor

Trust is a **functor** on the category of cognitive events:

$$\mathcal{T}: \mathcal{C} \to \mathcal{C}_{\mathcal{T}}$$

where $\mathcal{C}_{\mathcal{T}}$ is the category of trust-annotated objects. Each object carries:

$$\mathcal{T}(X) = X \times (\text{source}, \text{quality}, \text{provenance}, \text{verification}, \text{reversibility})$$

Trust propagates through composition:

$$\mathcal{T}(f \circ g) = \mathcal{T}(f) \circ \mathcal{T}(g)$$

### 6.4 Substrate Isolation

Different reasoning substrates (symbolic, exact, probabilistic, neural) are **separate subcategories** connected only by **functor boundaries**:

$$F_{\text{symbolic}}: \mathcal{C}_{\text{NAL}} \to \mathcal{C}_{\text{proposals}}$$
$$F_{\text{exact}}: \mathcal{C}_{\text{MeTTa}} \to \mathcal{C}_{\text{proposals}}$$
$$F_{\text{neural}}: \mathcal{C}_{\text{LM}} \to \mathcal{C}_{\text{proposals}}$$

**Axiom (H8):** No functor $F_{\text{exact}}$ may identify (union) two objects based solely on uncertain similarity from $F_{\text{neural}}$. Exact substrates operate on provable equality only.

---

## §7 — Provenance (The Cofree Comonad)

### 7.1 Event Category $\mathcal{E}$

Events form a **free monoid** $(\mathcal{E}^*, \cdot, \epsilon)$ under sequential concatenation:
- $\mathcal{E}^*$: all finite event sequences
- $\cdot$: concatenation
- $\epsilon$: empty sequence

### 7.2 The Cofree Comonad

Provenance is the **cofree comonad** over the event monoid:

$$W(X) = X \times \mathcal{E}^*$$

with comonad structure:
- **Counit** $\varepsilon: W(X) \to X$ — extract the state, forget the history
- **Comultiplication** $\Delta: W(X) \to W(W(X))$ — every prefix of the history is itself a valid history

### 7.3 The Provenance Fold

The **anamorphism** into the final coalgebra produces the complete behavioral trace:

$$\text{unfold}: X \to \nu F \cong \mathcal{E}^\omega$$

The **catamorphism** (fold) reconstructs state from events:

$$\text{fold}: \mathcal{E}^* \to X$$

**Replay Law:** $\text{fold} \circ \text{unfold} \cong \text{id}$ on reachable states.

### 7.4 Correlation as a Natural Transformation

A **correlation ID** is a natural transformation threading causality:

$$\chi: \text{Stimulus} \Rightarrow \text{Event}^*$$

For every stimulus $s$, there is a natural family of events $\chi_s$ such that every downstream event (derivation, gate decision, budget charge, commit) carries the same correlation. This makes the event log a **causal DAG**, not a flat sequence.

### 7.5 Independent Verification

The **replay functor** operates in a separate category $\mathcal{C}'$:

$$\text{Replay}: \mathcal{E}^* \to \mathcal{C}'$$

with **no shared morphisms** with the engine category $\mathcal{C}$. The truth table is **transcribed** (copied at build time), and drift between engine and verifier is **measured**, not assumed zero.

---

## §8 — Governance Filtration

### 8.1 The Tower of Authority

Self-modification authority forms a **filtration of subcategories**:

$$\mathcal{C}_0 \subset \mathcal{C}_1 \subset \mathcal{C}_2 \subset \mathcal{C}_3 \subset \mathcal{C}_4$$

| Level | Authority | Operations permitted |
|---|---|---|
| $\mathcal{C}_0$ | Observe | Read state, emit observations |
| $\mathcal{C}_1$ | Propose | Generate proposals (no state mutation) |
| $\mathcal{C}_2$ | Sandbox | Execute in isolation; results are proposals |
| $\mathcal{C}_3$ | Governed Deploy | Shadow validation + CI + risk classification |
| $\mathcal{C}_4$ | Constitutional | Modify governance rules themselves (external arbiter required) |

### 8.2 The No-Self-Approval Theorem

**Theorem.** No morphism at level $\mathcal{C}_4$ may have itself as both domain and codomain in the approval category:

$$\nexists\; f: \text{Approval} \to \text{Approval} \quad \text{at } \mathcal{C}_4$$

Self-modification proposals must be approved by an **external, immutable arbiter** (H4). The system cannot edit its own gates, reward functions, or approval mechanisms.

### 8.3 Learning as Governed Proposals

All learning operators produce **proposals**, not direct mutations:

$$\text{Learn}: \mathcal{C} \to \mathcal{C}_{\text{proposals}}$$

The proposal then traverses the governance pipeline:

$$\text{proposal} \xrightarrow{\text{shadow}} \text{validated} \xrightarrow{\text{risk}} \text{classified} \xrightarrow{\text{approve}} \text{committed}$$

At each stage, the proposal may be rejected, deferred, or escalated.

---

## §9 — The Commit Colimit (Unified Admission)

### 9.1 Cognitive Transactions

Every unit of cognition is a **typed transaction**:

$$\tau = \langle \text{id},\; \text{correlationId},\; \text{kind},\; \text{inputs},\; \text{outputs},\; \text{effects},\; \text{budget},\; \text{trust},\; \text{risk},\; \text{reversibility},\; \text{proofObligations} \rangle$$

Transaction kinds: $\{\text{perception}, \text{inference}, \text{proposal}, \text{judgment}, \text{commit}, \text{action}, \text{learning}, \text{forgetting}, \text{consolidation}, \text{simulation}\}$.

### 9.2 Commit as Colimit

The **commit operation** is the **colimit** of the admission diagram:

$$\text{Commit} = \varinjlim \left( \text{Candidate} \xrightarrow{\text{normalize}} \text{Typed} \xrightarrow{\text{judge}} \text{Verified} \xrightarrow{\text{budget}} \text{Settled} \xrightarrow{\text{risk}} \text{Governed} \right)$$

The universal property: any state mutation that does not factor through this colimit is **not a valid commit**. This is the **single commit authority** (A2).

### 9.3 The Governance Profile

Every candidate carries a governance profile:

$$\Gamma(c) = \langle \text{trust},\; \text{confidence},\; \text{risk},\; \text{reversibility},\; \text{blastRadius},\; \text{proofStatus},\; \text{judgeStatus} \rangle$$

The commit path is determined by a **policy surface** $\Pi: \Gamma \to \text{Path}$:

| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| High | Low | High | Auto-commit |
| High | Medium | High | Shadow-commit, then promote |
| Medium | Low | High | Provisional commit with decay |
| Medium | Medium | Medium | Human review |
| Low | High | Low | Reject |
| Any | High | Low | Strong proof or human approval |

### 9.4 Failure Policies

Failure is a **natural transformation** $\eta: \text{Id} \Rightarrow \text{Error}$:

$$\eta(X) \in \{\text{propagate},\; \text{degrade}(f),\; \text{retry}(n),\; \text{abstain},\; \text{fail-closed},\; \text{fail-open}\}$$

**Axiom (H9):** No failure may be silently swallowed. Every failure is an event in the provenance comonad (§7).

---

## §10 — Equational Laws

The design space is quotiented by these **universal laws**:

| # | Law | Categorical Form |
|---|---|---|
| L1 | **Admission Uniqueness** | $\exists!\; \text{Commit}: \text{Verified} \to X$ (one commit surface) |
| L2 | **Budget Closure** | $\forall f,\; \mathcal{V}(f) \leq \lceil \beta \rceil$ (every operation is budgeted) |
| L3 | **Gate Monotonicity** | $g_1 \circ g_2 \leq g_1$ (adding gates never widens admission) |
| L4 | **Epistemic Separation** | $\text{Hom}(G, B) = \emptyset$ in the graded category |
| L5 | **Provenance Completeness** | $\forall \Delta X,\; \exists e \in \mathcal{E}^*$ (every mutation is logged) |
| L6 | **Loop Well-Foundedness** | $\forall \kappa^*,\; \exists n.\; \kappa^n$ terminates or is budget-exhausted |
| L7 | **Trust Propagation** | $\mathcal{T}(f \circ g) = \mathcal{T}(f) \circ \mathcal{T}(g)$ |
| L8 | **Failure Transparency** | $\eta(\text{swallow}) \circ \text{observe} = \text{observe} \circ \eta(\text{swallow})$ — swallowed errors don't alter observables |
| L9 | **Replay Fidelity** | $\text{fold} \circ \text{unfold} \cong \text{id}$ on reachable states |
| L10 | **Governance Irreflexivity** | $\nexists f \in \mathcal{C}_4: f \text{ approves } f$ |

---

## §11 — The Final Coalgebra (Behavioral Semantics)

### 11.1 Existence

The final coalgebra $(\nu F, \zeta)$ exists by the **Adámek construction** (since $F$ is a polynomial functor on a locally presentable category):

$$\nu F = \varinjlim \left( 1 \xleftarrow{!} F(1) \xleftarrow{F(!)} F^2(1) \xleftarrow{F^2(!)} \cdots \right)$$

This is the space of **all possible behaviors** — the complete, observable trace of any reasoner.

### 11.2 The Universal Property

For any reasoner coalgebra $(X, \alpha)$, there exists a **unique** coalgebra morphism:

$$\llbracket \alpha \rrbracket: (X, \alpha) \to (\nu F, \zeta)$$

This morphism is the **complete behavioral specification** of the reasoner. Two reasoners are behaviorally equivalent iff their morphisms into $\nu F$ agree.

### 11.3 Replay as Catamorphism

Given an event log $e \in \mathcal{E}^*$, replay is the **catamorphism** (fold):

$$\text{replay}: \mathcal{E}^* \to X$$

satisfying:

$$\text{replay}(\epsilon) = x_0 \quad \text{(initial state)}$$
$$\text{replay}(e \cdot e') = \text{step}(\text{replay}(e), e') \quad \text{(sequential application)}$$

### 11.4 Independent Verification

The verifier is a **separate coalgebra** $(X', \alpha')$ in a category $\mathcal{C}'$ with:
- $\text{Hom}_{\mathcal{C}'}(\text{Engine}, \text{Verifier}) = \emptyset$ (no shared code)
- The truth table is **transcribed** at build time
- Drift is measured by a **natural transformation** $\delta: \text{Engine} \Rightarrow \text{Verifier}$ whose deviation is bounded and tested

---

## §12 — Feasibility Predicate

A point in the design space is **feasible** iff it satisfies all constraints:

$$\Phi(r) = \bigwedge_{i=1}^{12} \Phi_i(r)$$

| # | Constraint | Formal statement |
|---|---|---|
| $\Phi_1$ | AIKR requires boundedness | $\text{C1}=K \Rightarrow \mathcal{V}(p) < \infty\; \forall p$ |
| $\Phi_2$ | Graded contradiction requires graded truth | $\text{K5}=A \Rightarrow \mathbb{T} \geq (f,c)$ |
| $\Phi_3$ | Untrusted proposers require gates | $\text{A1}=K \Rightarrow \text{A2} \geq e$ |
| $\Phi_4$ | Reward + conflated belief/goal = corruption | $\text{L2}=U \wedge \text{L3}=C \Rightarrow \bot$ (excluded) |
| $\Phi_5$ | High expressivity requires bounded search | $\text{K2} \geq H \Rightarrow \text{I4} \neq C$ |
| $\Phi_6$ | Budget without forgetting = exhaustion | $\text{C1} \leq B \Rightarrow \text{C3} \neq \text{none}$ |
| $\Phi_7$ | Self-modification requires external governance | $\text{L1}=m \Rightarrow \text{A3}=X$ |
| $\Phi_8$ | Exact + uncertain substrates require isolation | $\text{I3}=O \wedge \text{K4} \geq E \Rightarrow \text{memory isolation}$ |
| $\Phi_9$ | Independent verification requires code separation | $\text{A2}=v \Rightarrow \text{Verifier} \perp \text{Engine}$ |
| $\Phi_{10}$ | Anytime requires preemptive scheduling | $\text{I4}=A \Rightarrow \text{C2} \in \{E, L\}$ |
| $\Phi_{11}$ | Ambiguous input requires multi-candidate | $\text{K4}=0 \wedge \text{NL ingress} \Rightarrow \text{multi-candidate}$ |
| $\Phi_{12}$ | Replay requires event sourcing + purity | $\text{A2}=v \Rightarrow \text{pure reducers}$ |

---

## §13 — The Meta-Controller (Reflexive Scheduling)

### 13.1 The Controller as a Reasoner

The meta-controller is itself a **bounded reasoner** $(X_\mu, \alpha_\mu)$ whose state is the control configuration:

$$X_\mu = \langle \kappa,\; \beta,\; \theta,\; \text{history} \rangle$$

Its operators are **control mutations**:
- Edit the stage graph $\kappa$
- Transfer budget between scopes
- Adjust trust thresholds
- Select cognitive programs

### 13.2 The Propose-Don't-Apply Principle

The meta-controller **proposes** control changes but does not **apply** them:

$$\text{MetaController}: X_\mu \to \mathcal{C}_{\text{proposals}}$$

Proposals traverse the governance pipeline (§8) before installation. Installation occurs at a **cycle boundary** (hot-swap), preserving in-flight state.

### 13.3 Cognitive Programs

The meta-controller selects from a **portfolio of cognitive programs**:

$$\text{Program} = \langle \text{stageGraph},\; \text{budgetAllocation},\; \text{proposerWeights},\; \text{verificationPolicy},\; \text{autonomyPolicy},\; \text{learningPolicy} \rangle$$

Programs include: Deliberative, Reactive, Curious, Conservative, Creative, Repair, Consolidating.

---

## §14 — Composition and Modularity

### 14.1 Typed Ports

All subsystems communicate through **typed ports** (natural transformations between functors):

| Port | Type | Meaning |
|---|---|---|
| $\text{StimulusIn}$ | $\text{External} \to \mathcal{C}$ | Perception ingress |
| $\text{CommitOut}$ | $\mathcal{C} \to \text{Durable}$ | State mutation |
| $\text{JudgeIn}$ | $\text{Proposals} \to \text{Verified}$ | Admission |
| $\text{BudgetQuery}$ | $\text{Ops} \to \mathbb{Q}$ | Resource check |
| $\text{EventEmit}$ | $\mathcal{C} \to \mathcal{E}^*$ | Provenance |
| $\text{GovernIn}$ | $\text{Proposals} \to \text{Approved}$ | Governance |

### 14.2 Functorial Substitution

Any component may be replaced by any other with the same functor signature. The system is **modular by construction**: swapping a scheduler, a judge, a memory backend, or a substrate requires only that the replacement is a valid functor with the same source and target categories.

### 14.3 The Design Space as a Category

The space of all feasible reasoner designs is itself a category $\mathfrak{D}$:
- **Objects:** Feasible reasoner configurations (points satisfying $\Phi$)
- **Morphisms:** Valid transitions between configurations (movement operators $\delta$)
- **Composition:** Sequential application of transitions
- **Identity:** No change

---

## §15 — Instantiation Schema

A concrete reasoner is specified by filling the following **coalgebraic type**:

```
Reasoner ::= {
  carrier:       X                    -- cognitive state space
  structure:     α: X → F(X)          -- coalgebra map
  grading:       Γ: C → G             -- epistemic firewall
  control:       κ ∈ KAT              -- stage graph (data)
  valuation:     V: C → Q             -- resource functor
  gates:         G: Lattice           -- admission operators
  trust:         T: C → C_T           -- trust functor
  provenance:    W: Cofree(E*)        -- event comonad
  governance:    C₀ ⊂ C₁ ⊂ C₂ ⊂ C₃ ⊂ C₄  -- filtration
  commit:        colim(admission)     -- universal commit
  meta:          (Xμ, αμ)             -- meta-controller coalgebra
  laws:          {L1..L10}            -- equational theory
  feasibility:   Φ(r) = true          -- well-formedness
}
```

---

## §16 — Summary of Guarantees

| Guarantee | Mechanism | Law |
|---|---|---|
| Reward cannot corrupt truth | Epistemic grading, no morphism $G \to B$ | L4 |
| All mutations are event-sourced | Cofree comonad, structure map factors through events | L5, L9 |
| All reasoning is bounded | Quantale valuation with finite ceiling | L2, $\Phi_1$ |
| All proposals are judged | Proposer/judge adjunction, gate lattice | L1, L3 |
| All self-modification is governed | Filtration, no self-approval | L10, $\Phi_7$ |
| All behavior is replayable | Final coalgebra, catamorphic fold | L9 |
| All failures are observable | Failure as natural transformation, never swallowed | L8, H9 |
| All control is inspectable | Control words are data, logged as events | H6 |
| All substrates are isolated | Functor boundaries, no cross-contamination | $\Phi_8$, H8 |
| All actions are risk-classified | Governance profile determines commit path | H10 |

---

*This specification defines the reasoner not as a pipeline, but as a coalgebra whose behavior is completely determined by its structure map, whose safety is enforced by categorical invariants, whose provenance is the unique morphism into the final coalgebra, and whose evolution is a governed path through the category of feasible designs.*
