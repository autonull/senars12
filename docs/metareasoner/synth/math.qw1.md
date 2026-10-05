# Ω — The Unified Calculus of Governed Cognition

**A complete, self-contained algebraic specification for bounded, auditable, adaptive hybrid reasoners · v1.0**

---

## §0 — Design Declaration

**Selected bundle: Full Synergistic Target** (extended).

| Class | Selection |
|---|---|
| **Prime objectives** | O1 epistemic integrity · O2 causal provenance · O3 control-plane fluidity · O4 resource economics · O6 governed reflexivity · O7 neuro-symbolic synergy · O8 unified commit ledger |
| **Hard constraints** | H1–H10 in full. *(H7 verifier independence, H8 substrate isolation, H10 irreversible-action authorization are promoted from optional to binding: they are entailed by A3-provenance-by-construction, B4-substrate synergy, and B6-context-sensitive governance.)* |
| **Anti-goals** | A1 maximal abstraction before implementation · A2 scheduler opacity · A4 audit bloat · A5 monolithic LM authority · A7 unbounded cognitive richness |
| **Character bias** | **D3 unification** as primary; **D1 auditability** as tie-breaker; **D2 power** and **D6 adaptivity** admitted only inside the invariant envelope; **D4 robustness** and **D5 modularity** as structural defaults |

**Priority ordering for conflict resolution:**

$$\text{epistemic integrity} \;>\; \text{auditability} \;>\; \text{unification} \;>\; \text{cognitive power} \;>\; \text{adaptivity}$$

No gain on a lower-ranked axis may purchase a loss on a higher-ranked one.

---

## §1 — Essence

> **A reasoner is a resource-bounded, epistemically typed control system whose state is a fold over an append-only ledger, whose tick is the action of a control word, whose every mutation is a judged transaction, and whose every judgment is an event.**

Formally, a reasoner is an octuple organized into four planes:

$$
\mathcal{R} \;=\; \Big\langle\;
\underbrace{\langle \mathcal{A},\, \mathcal{V} \rangle}_{\text{I · epistemic plane}}
\;,\;
\underbrace{\langle \mathcal{K},\, \mathcal{B} \rangle}_{\text{II · control plane}}
\;,\;
\underbrace{\langle \mathcal{T},\, \mathcal{J},\, \mathcal{G} \rangle}_{\text{III · governance plane}}
\;,\;
\underbrace{\mathcal{L}}_{\text{IV · provenance plane}}
\;\Big\rangle
$$

| Plane | Component | Algebraic structure |
|---|---|---|
| I | $\mathcal{A}$ — content | graded term algebra |
| I | $\mathcal{V}$ — valuation | evidence monoid with revision |
| II | $\mathcal{K}$ — control | Kleene algebra with tests (KAT) |
| II | $\mathcal{B}$ — budget | module over an ordered semiring |
| III | $\mathcal{T}$ — transactions | category of typed, budgeted operations |
| III | $\mathcal{J}$ — judgment | oriented gate lattice + calibration |
| III | $\mathcal{G}$ — governance | policy surface over a risk manifold |
| IV | $\mathcal{L}$ — ledger | free event monoid with fold |

**Semantic function.** The octuple denotes a coalgebra:

$$
\llbracket \mathcal{R} \rrbracket \;=\; \big(\, M,\; \mathsf{observe} : M \to \Theta^{*},\; \mathsf{tick} : M \times \Theta \times R \to M \times E^{*} \,\big)
$$

where the state is always recovered by fold — never stored as primary truth:

$$
M_{t} \;=\; \mathsf{fold}\big(\, \mathcal{L}_{\leq t} \,\big), \qquad \mathcal{L} \in E^{*} \text{ append-only.}
$$

**The master equation of one tick** (fully elaborated in §14):

$$
\boxed{\quad
\mathsf{tick}(\theta) \;=\;
\mathsf{Commit}\!\Big(
\mathcal{J}\big( \Phi_{\kappa}(M,\, \beta) \big),\;
\mathcal{G}
\Big)
\;\;\vdash\;\;
\mathcal{L}' = \mathcal{L} \cdot e^{*}
\quad}
$$

A stimulus $\theta$ mints a correlation; the meta-controller selects a cognitive program $(\kappa, \beta, \pi)$; the control word $\kappa$ acts on state under budget $\beta$, emitting candidate transactions; the judgment algebra $\mathcal{J}$ evaluates them; the governance surface $\mathcal{G}$ routes each to a commit path; the unique commit port settles them into the ledger. **Everything else in this specification is the elaboration of one symbol in that equation.**

---

# PLANE I — THE EPISTEMIC SUBSTRATE

## §2 — Content Algebra $\mathcal{A}$

**2.1 Graded terms.** Content is a term algebra over signature $\Sigma_{\mathcal{A}}$ (variables, compounds, sequences, operations), **graded by cognitive type** $\mathcal{C}$:

$$
\mathcal{A} \;=\; \bigsqcup_{c \,\in\, \mathcal{C}} \mathcal{A}_{c}, 
\qquad
\mathcal{C} = \{\, \mathsf{Belief},\ \mathsf{Goal},\ \mathsf{Question},\ \mathsf{Hypothesis},\ \mathsf{Assumption},\ \mathsf{Plan},\ \mathsf{Obligation},\ \mathsf{Lesson},\ \mathsf{ActionIntent} \,\}
$$

Every grade carries an **axis**:

$$
\mathsf{axis} : \mathcal{C} \to \{ \varepsilon\ (\text{epistemic}),\ \tau\ (\text{teleological}),\ \pi\ (\text{pragmatic}) \}
$$

with $\mathsf{axis}(\mathsf{Belief}) = \mathsf{axis}(\mathsf{Hypothesis}) = \varepsilon$, $\mathsf{axis}(\mathsf{Goal}) = \mathsf{axis}(\mathsf{Obligation}) = \tau$, plans/intentions/lessons pragmatic.

**2.2 Grade-respecting dynamics.** An inference rule is a partial, cost-annotated, provenance-stamped morphism

$$
\rho : \mathcal{A}_{c_{1}} \times \cdots \times \mathcal{A}_{c_{n}} \rightharpoonup \mathcal{A}_{c'} \times V_{c'} \times \mathsf{Stamp},
\qquad
c' = \mathsf{comb}(c_{1},\dots,c_{n})
$$

where $\mathsf{comb}$ is the fixed axis-combination law:

| inputs | output axis |
|---|---|
| $\varepsilon$ only | $\varepsilon$ |
| $\tau$ only | $\tau$ |
| $\varepsilon + \tau$ | $\pi$ (plans, never facts) |
| any + $\mathsf{Reward}$ | $\tau$ or attention channel of $\pi$ — **never $\varepsilon$** |

This is the **epistemic firewall as a typing theorem** (Law L1): there exists no generator of type $\mathsf{Reward} \to V_{\varepsilon}$. Sycophancy is not discouraged; it is untypable.

**2.3 Rule sets are data.** The rule family $\{\rho\}$ is a loaded, versioned, revertible table with exact input-kind dispatch (no wildcard arity). Rules carry: origin $\in \{\mathsf{builtin}, \mathsf{declared}, \mathsf{induced}\}$, a fallback path, and a provenance stamp.

## §3 — Valuation Algebra $\mathcal{V}$

**3.1 Truth carrier.** Valuation factors by axis:

$$
\mathcal{V} = \mathcal{V}_{\varepsilon} \times \mathcal{V}_{\tau}, 
\qquad
\mathcal{V}_{\varepsilon} = [0,1]^{2} \ni (f, c), 
\qquad
\mathcal{V}_{\tau} = [0,1]^{2} \ni (d, c)
$$

frequency $f$ = proportion of positive evidence; confidence $c$ = amount of evidence; desire $d$ = goal attractiveness. Neither component is a Bayesian posterior; both are evidence-relative under insufficient resources.

**3.2 Revision.** For evidence-independent inputs:

$$
\mathrm{rev}\big((f_{1}, c_{1}),\, (f_{2}, c_{2})\big)
\;=\;
\left(
\frac{f_{1} c_{1} (1 - c_{2}) \;+\; f_{2} c_{2} (1 - c_{1})}
{c_{1}(1 - c_{2}) \;+\; c_{2}(1 - c_{1})}
,\;\;
c_{1}(1 - c_{2}) + c_{2}(1 - c_{1})
\right)
$$

Properties: commutative; **not associative**; confidence sub-additive ($c' < c_{1} + c_{2}$); frequency is a confidence-weighted mean. Revision requires an **independence flag**; dependent evidence is rejected at the revision boundary, not silently double-counted.

**3.3 Evidence lineage.** Every valuation carries an ancestor DAG with bounded depth; revision is permitted only between lineages whose ancestor sets are disjoint (bounded intersection permitted, recorded). This makes *evidence laundering* — the same observation returning as confidence inflation through many derivation paths — structurally detectable.

**3.4 Paraconsistency.** Contradictory valuations $\varphi$ and $\neg\varphi$ **coexist** as distinct ledger entries with distinct $(f, c)$. There is no explosion rule; queries grade and rank rather than collapse. Consistency is an achieved property, never a presupposed one.

**3.5 Decoupled decay.** Two independent clocks:

$$
\text{truth decay: } (f,c) \to \text{revise/retract only on invalidating evidence}
$$
$$
\text{attention decay: priority} \to \text{decay by recency/access/pressure}
$$

What is *believed* and what is *attended to* age differently. Attention starvation is never belief deletion.

## §4 — Substrate Composition (Hybrid Synergy without Contamination)

**4.1 Substrates.** The epistemic plane admits multiple substrates:

$$
\mathcal{A} \;=\; \mathcal{A}_{\mathsf{sym}} \;\oplus\; \mathcal{A}_{\mathsf{exact}} \;\oplus\; \mathcal{A}_{\mathsf{sub}}
$$

- $\mathcal{A}_{\mathsf{sym}}$ — uncertain symbolic core (graded terms, §2–§3);
- $\mathcal{A}_{\mathsf{exact}}$ — exact/dependently-typed co-substrate (definitional equality, rewriting, e-graphs);
- $\mathcal{A}_{\mathsf{sub}}$ — subsymbolic layer (embeddings, calibrated heads, reflex policies).

**4.2 Arbiter coupling — not fusion.** Substrates never share mutable memory. The exact substrate is an **isolated oracle**: invoked through a governed tool boundary, returning *proposals* of type $\mathsf{EngineResult}$ that re-enter through the ordinary transaction pipeline. The subsymbolic layer is permanently typed **proposer**, never judge-of-record.

**4.3 Isolation law (L8).** Equivalence in $\mathcal{A}_{\mathsf{exact}}$ is never established on uncertain similarity:

$$
\mathsf{similarity}(x, y) > \theta \;\;\not\Rightarrow\;\; \mathsf{union}_{\text{e-graph}}(x, y)
$$

Exact equality and uncertain resemblance live in different equivalence regimes and the boundary is a typed port.

---

# PLANE II — THE CONTROL PLANE

## §5 — Control Algebra $\mathcal{K}$ (Control Flow is Data)

**5.1 KAT.** $\mathcal{K}$ is the Kleene algebra with tests over stage generators $\Sigma$ and a Boolean test algebra $\mathsf{Test}$:

$$
\kappa \;::=\; \sigma \;\mid\; p? \;\mid\; \kappa_{1} \cdot \kappa_{2} \;\mid\; \kappa_{1} + \kappa_{2} \;\mid\; \kappa^{*} \;\mid\; 1 \;\mid\; 0
$$

sequence · choice · guarded test · iteration · skip · deadlock. **A cognitive cycle is a closed KAT term**, not a code path. The tick is its action:

$$
\Phi_{\kappa} : M \times R \to M \times E^{*}
$$

**5.2 Stage graphs as data.** Control programs are declared as annotated graphs and compiled:

$$
G = \big( V_{s},\; E_{s} \subseteq V_{s} \times \mathsf{Test} \times V_{s},\; \mathsf{pre},\; \mathsf{post},\; \mathsf{cost} : E_{s} \to \mathcal{B},\; \mathsf{fail} : V_{s} \to \mathsf{Policy} \big)
\qquad
\mathsf{compile}(G) = \kappa_{G}
$$

Each node carries preconditions, postconditions, the budget scope that pays for its traversal, and a failure policy. Stage skipping, conditional ordering, parallel fan-out with join, optional stages, and loop-back edges are **edge annotations**, all inspectable, versionable, and A/B-testable as terms.

**5.3 Well-formedness.** $\mathsf{wf}(\kappa)$ holds iff: (i) $\kappa$ is closed; (ii) every iteration is budget-bounded or abort-guarded (well-foundedness); (iii) every write-position occurs inside a commit stage; (iv) every untrusted-proposal position is dominated by a judgment node; (v) all edges carry budget annotations. $\mathsf{wf}$ is checked at compile time; an ill-formed program is rejected before execution, not during.

**5.4 Delimited control.** Abort and reconfigure are first-class operators over $\kappa$:

$$
\mathsf{abort} : \kappa \to 1 \quad (\text{natural: commutes with every stage}), 
\qquad
\mathsf{hotswap} : (\kappa, \kappa') \to \kappa' \text{ at cycle boundary}
$$

$\mathsf{hotswap}$ installs a new control word only at boundaries, carrying counters and in-flight state across. Reconfiguration never destroys the state it is reconfiguring around.

**5.5 Scheduler spectrum — one algebra, many points.** Scheduling discipline is a coordinate, not a fork:

$$
\kappa = \text{linear} \;\subset\; \text{conditional graph} \;\subset\; \text{claim queue} \;\subset\; \text{utility-priced} \;\subset\; \text{learned policy}
$$

In the claim-queue regime, the tick becomes: *while budget affords and queue non-empty, pop the highest-utility claim $\tau$; if $\Gamma(\tau)$ admits, execute*. In the learned regime, the scheduler is itself a governed proposer (§11): it may reorder and reprioritize; it may never admit, never bypass the firewall, never exceed budget. **Scheduler opacity is excluded by construction (H6): every scheduling decision is a control-plane event (§10).**

## §6 — Budget Algebra $\mathcal{B}$ (Computation is an Economy)

**6.1 Resource module.** Budgets form a free module over the ordered semiring $(\mathbb{R}^{+}, +, \max, 0)$ with basis of dimensions:

$$
D = \{\, \mathsf{cycles},\ \mathsf{derivations},\ \mathsf{premises},\ \mathsf{memoryOps},\ \mathsf{modelCalls},\ \mathsf{tokens},\ \mathsf{latency},\ \mathsf{attention},\ \mathsf{risk},\ \mathsf{humanAttention} \,\}
$$

One table, one arithmetic, typed exhaustion reasons. Scopes form a **sublattice** with inheritance ($\mathsf{child} \sqsubseteq \mathsf{parent}$) and two sanctioned operations:

$$
\mathsf{transfer}(s_{1}, s_{2}, q) \;\; \text{s.t.} \;\; \textstyle\sum s \text{ conserved}
\qquad
\mathsf{reset}_{\mathsf{once}} : \text{at most one reopening per scope per cycle}
$$

**6.2 Reservation–settlement protocol.** Before execution:

$$
R_{\mathsf{avail}} \leftarrow R_{\mathsf{avail}} - R_{\mathsf{reserved}}(\tau);
\qquad
\text{after: } \;\;
R_{\mathsf{settled}} = R_{\mathsf{reserved}}(\tau) - R_{\mathsf{unused}}(\tau)
$$

Starvation and exhaustion are **typed events**, never silence.

**6.3 Pricing and clearing.** Each candidate transaction bids with expected marginal utility per scarce resource:

$$
\mathsf{score}(\tau)
\;=\;
\frac{
\widehat{\Delta K}_{\tau} + \widehat{\Delta G}_{\tau} + \widehat{\Delta H}_{\tau}
}{
\lambda_{c}\, \widehat{C}_{\tau} \;+\; \lambda_{r}\, \widehat{R}_{\tau} \;+\; \lambda_{h}\, \widehat{H}^{\,\mathrm{human}}_{\tau}
}
$$

(epistemic gain + teleological gain + homeostatic gain) ÷ (weighted cost, risk, human-attention). The scheduler clears each cycle by descending score. Exhaustion is replaced by **outbidding**: low-value work is starved, not uniformly truncated.

**6.4 Thermodynamic limit.** As an equivalent semantics, define cognitive energy $\Delta E(\tau)$ = prediction error − expected utility, and global temperature $T$ set by homeostasis (high curiosity/drive ⇒ high $T$ ⇒ exploration; high competence/coherence ⇒ low $T$ ⇒ exploitation). Admission follows

$$
P(\tau) \;\propto\; \exp\!\big(-\Delta E(\tau) / T\big)
\qquad \text{subject to } \textstyle\sum \Delta E \leq E_{\max}\;(\text{AIKR})
$$

The market formulation (§6.3) and the thermodynamic formulation (§6.4) are two charts on the same economic manifold; an implementation fixes one chart per stratum (§15).

**6.5 Budget laws.**

- **Monotonicity:** $\mathsf{charge}$ only decreases availability.
- **Conservation:** $\mathsf{transfer}$ preserves the global total.
- **Open-once:** a scope may reset at most once per cycle — a bound wearing a counter is no bound.
- **Boundedness axiom (AIKR):** every bag, queue, and lineage is capacity-bounded; forgetting, decay, backpressure, and cooperative yielding are first-class. There exists a global natural $\mathsf{abort}$.

---

# PLANE III — THE GOVERNANCE PLANE

## §7 — Transaction Calculus $\mathcal{T}$ (One Class of Operation)

**7.1 The universal type.** Perception, inference, proposal, judgment, commitment, action, learning, forgetting, consolidation, simulation, and self-modification are all values of one type:

$$
\tau : \mathsf{Transaction} = 
\left\langle
\begin{array}{l}
\mathsf{id},\ \mathsf{corr},\ \mathsf{kind},\\
\mathsf{inputs},\ \mathsf{outputs},\ \mathsf{effects} : \mathsf{EffectDeclaration},\\
\mathsf{budget} : \mathsf{Reservation},\quad
\mathsf{trust} : \mathsf{TrustProfile},\quad
\mathsf{risk} : \mathsf{RiskProfile},\\
\mathsf{reversibility} : \mathsf{RevClass},\quad
\mathsf{fallback} : \mathsf{Policy},\quad
\mathsf{proofObligations} : \mathsf{Proof}^{*}
\end{array}
\right\rangle
$$

Every transaction declares what it reads, what it may write, what it reserves, what proofs it must satisfy, how it fails, whether it is reversible, and which governance path it requires. **Control flow becomes explicit, typed, and analyzable.**

**7.2 Composition.** Transactions form a category: sequential composition where effect declarations match, monoidal product for concurrency with an explicit join transaction, restriction $\tau \mid P$ for degradation projections. Composition is lawful only where budget and trust profiles compose (checked statically).

**7.3 Two-phase commit.** Every transaction executes the same protocol:

$$
\mathsf{reserve} \;\to\; \mathsf{execute} \;\to\; \mathsf{verify} \;\to\; \mathsf{settle} \;\to\; 
\begin{cases} \mathsf{commit} \\ \mathsf{reject} \end{cases}
$$

**7.4 Single commit authority (A2).** There is exactly one write morphism into durable state:

$$
\mathsf{commit} : \widehat{\mathcal{A}} \to M + \mathsf{Reject}
\qquad (\exists! \text{ — admission uniqueness})
$$

All mutations — perceived observations, derived beliefs, generated goals, formalizations, reflex proposals, tool results, schema inductions, strategy changes, patches, action intentions, human corrections — normalize, type-check, verify, rank, settle, and pass through this one port. *“Where does state change happen?” has exactly one answer.*

## §8 — Judgment Algebra $\mathcal{J}$

**8.1 Oriented gate lattice.** Gates form a bounded lattice $(\mathcal{G}, \leq, \wedge, \vee, \top, \bot)$ with composition (serial $\circ$, parallel $\|$, voting $\oplus$, fallback $\triangleright$, complement $\neg$). Every gate is idempotent and **oriented**:

$$
\alpha(g) \in \{ \mathsf{interior}\ (g(x) \leq x,\ \text{fail-closed}),\;\; \mathsf{closure}\ (x \leq g(x),\ \text{fail-open}) \}
$$

Direction policy is a **parameter of the admission functional**, not a branch in code.

**8.2 Unified admission functional.** All gates are configurations of one primitive:

$$
\mathsf{Admit} : \mathsf{Candidate} \times \mathsf{Context} \times R \;\to\; \{ \mathsf{admit},\ \mathsf{veto},\ \mathsf{defer} \} \times J
$$

parameterized by ⟨trust-policy, budget-policy, epistemic-policy, polarity, mode⟩. Adding a gate is adding a lattice element; the epistemic firewall is a **closed ideal** in the lattice.

**8.3 Trust field.** Admission consults a calibrated, per-claim trust field:

$$
\mathcal{T}(s, a, x, H) \;=\; 
\mathsf{srcRep}(s) \;\cdot\; \mathsf{specificity}(a) \;\cdot\; \mathsf{corroboration}(a, H) \;\cdot\; \mathsf{calibration}(j)
\;\in\; [0,1]
$$

Source reputation is a prior, not a ceiling. The field partitions into three bands — **act / review / block** — with explicit abstention: insufficient evidence injects a clarification question plus curiosity signal, never a silent drop.

**8.4 Proposer/judge adjunction.** The neuro-symbolic boundary is an adjunction:

$$
\mathsf{propose} \;\dashv\; \mathsf{admit}
$$

with the judgment manifold as (co)unit measuring how much of a proposal survives judgment. Tightening the adjunction tends toward pure symbolic; loosening it tends toward proposer-heavy cognition. **“How much do we trust System 1?” is a continuous, logged, calibratable parameter — never a wiring decision.**

**8.5 Verification portfolio.** Candidates may be checked by any combination of: schema/type check · evidence-independence check · formal proof · calibrated judge · simulation · shadow execution · human approval. Verdicts are typed, scored, and event-sourced; NAL retains an absolute veto on egress.

## §9 — Governance Manifold $\mathcal{G}$ (Context-Sensitive Authority)

**9.1 Governance profile.** Every candidate acquires:

$$
\gamma(\tau) = \langle\, \mathsf{trust},\ \mathsf{confidence},\ \mathsf{risk},\ \mathsf{reversibility},\ \mathsf{blastRadius},\ \mathsf{proofStatus},\ \mathsf{judgeStatus},\ \mathsf{simStatus} \,\rangle
$$

**9.2 Policy surface.** Commit path is a function of the profile:

| trust | risk | reversibility | proof | ⇒ path |
|---|---|---|---|---|
| high | low | high | — | **auto-commit** |
| high | medium | high | — | **shadow-commit, then promote** |
| medium | low | high | — | **provisional commit + decay** |
| medium | medium | medium | — | **review** |
| any | high | low | ✓ verified | **proof-gated commit** |
| any | high | low | ✗ | **human approval required** |
| low | any | any | — | **reject / quarantine** |

**9.3 Autonomy ladder.** Five ordinal rungs, modeled as a state machine:

$$
\mathsf{observe\text{-}only} \;\to\; \mathsf{propose\text{-}only} \;\to\; \mathsf{sandbox\text{-}execute} \;\to\; \mathsf{low\text{-}risk\text{-}auto} \;\to\; \mathsf{human\text{-}approved\text{-}production}
$$

**9.4 Action reversibility classes.** Actions are typed: informational → reversible-local → reversible-external → hard-to-reverse → irreversible → forbidden. Irreversible actions require strong proof **and** human approval; forbidden actions (e.g., disabling a safety gate) are rejected by type. **Action control is epistemic governance extended to effects: simulate → assess → authorize → sandbox → confirm → commit → rollback-if-needed.**

**9.5 Constitution.** The following are **immutable**: the firewall (L1), single commit port (L2), event-sourcing (L3), budget conservation (L4), verifier independence (L7), substrate isolation (L8), and the existence of governance itself. No internal proposal may alter the constitution; constitutional change is not an operation the calculus expresses.

---

# PLANE IV — PROVENANCE

## §10 — Causal Observability

**10.1 Event schema.** Events form a free monoid $(E^{*}, \cdot, \epsilon)$, append-only. Every event carries the full correlation tuple:

$$
e.\mathsf{corr} = \langle\, \mathsf{stimulusId},\ \mathsf{sessionId},\ \mathsf{cycleId},\ \mathsf{txnId},\ \mathsf{proposerId},\ \mathsf{judgeId},\ \mathsf{proofId},\ \mathsf{parentId},\ \mathsf{budgetCtx} \,\rangle
$$

Events thereby form a **causal DAG**, not parallel logs. The following queries are well-formed at any depth: *which stimulus caused this belief · which derivation led to this action · which judge vetoed this candidate · which budget exhaustion caused this degradation · which learning episode changed this strategy.*

**10.2 Control-plane provenance.** Scheduling, admission, budget transfer, and graph-edit decisions are events of the same tier as cognitive content. Two replay functions exist:

$$
\mathsf{replayCognitiveState} : E^{*} \to M \quad (\text{what was believed})
\qquad
\mathsf{replayControlState} : E^{*} \to \Pi \quad (\text{why it reasoned that way})
$$

**10.3 Determinism.** Reducers are pure; snapshots are caches only; replay reconstructs state and verifies by state hash:

$$
\mathsf{replay} \circ \mathsf{log} \;\cong\; \mathrm{id} \quad \text{on reachable states}
$$

**10.4 Independent verifier.** Derivation checking is performed by a verifier that **imports nothing from the engine**: its semantics table is transcribed, and drift between engine and verifier is pinned by test. A bug cannot hide in both.

**10.5 Bounded provenance (anti-bloat).** Recorders are capacity-bounded and opt-in per tier (e.g., step-level records capped per derivation and per cycle); sampling policy is declared, typed, and itself logged. Audit depth is a budgeted resource, not an unconditional tax.

**10.6 Failure transparency.** There are no silent catches. Every fault — including engine-internal faults — is a typed event ($\mathsf{engine.fault}$, $\mathsf{budget.denied}$, $\mathsf{gate.veto}$, $\mathsf{judge.timeout}$). *Unmeasured is never confused with healthy.*

---

## §11 — Reflexivity Tower (Governed Self-Modification)

**11.1 Authority filtration.** Self-modification authority forms a strict filtration:

$$
\mathcal{F}_{0} \;\subset\; \mathcal{F}_{1} \;\subset\; \mathcal{F}_{2} \;\subset\; \mathcal{F}_{3} \;\subset\; \mathcal{F}_{4}
$$

| level | may modify | authority |
|---|---|---|
| $\mathcal{F}_{0}$ | valuation algebra $V$, constitution | **never** — outside the tower |
| $\mathcal{F}_{1}$ | knobs, thresholds, attention weights | low-risk auto, logged |
| $\mathcal{F}_{2}$ | strategies, scheduler weights, budget ceilings | proposal or guarded auto |
| $\mathcal{F}_{3}$ | rules, stage graphs, control words | proposal + proof + shadow validation |
| $\mathcal{F}_{4}$ | code, architecture | shadow CI + risk classification + **external immutable arbiter** |

Each level is governed by the one above; ascent in the tower is gated at every rung.

**11.2 Learning is proposal.** All learners — reflex, trajectory-preference, distillation, schema induction, patch generation — have one type:

$$
\mathsf{learn} : \mathsf{Trajectory} \to \mathsf{Proposal}
$$

A proposal enters the ordinary pipeline: normalize → verify → shadow-test → bounded deployment → trace evaluation → retain or rollback. **Learning may propose changes to cognition; it may never rewrite the laws of epistemic commitment.**

**11.3 Meta-controller.** The scheduler’s most general regime is itself a bounded reasoner with its own budget slice, reasoning about control:

$$
\text{meta-goal: } (\mathsf{currentControl} \to \mathsf{adequate})\,?
\qquad
\text{action: emit } \mathsf{StageGraphEdit} \lor \mathsf{BudgetTransfer} \text{ as proposal}
$$

It **proposes; it does not apply.** Its outputs route through the governance pipeline like any $\mathcal{F}_{3}$ change, installed only by boundary hot-swap (§5.4). Reflection without authority.

**11.4 External arbiter.** At $\mathcal{F}_{4}$, approval is structurally external: an immutable runner the system cannot edit merges or rejects. Self-approval at this level is not forbidden — it is **unrepresentable** (Law L10; Löbian soundness).

---

## §12 — Failure Algebra (Graceful Degradation by Construction)

**12.1 Policy lattice.** Failure policies form a lattice of natural transformations $\eta : \mathrm{Id} \to \mathsf{Error}$:

$$
\bot = \mathsf{abort} \;\leq\; \mathsf{fail\text{-}closed} \;\leq\; \mathsf{retry\text{-}then\text{-}degrade} \;\leq\; \mathsf{fail\text{-}open} \;\leq\; \mathsf{ignore} = \top
$$

Policies compose ($\oplus$ fallback, $\otimes$ nested application). Every transaction and every graph edge carries one.

**12.2 Directional defaults — a parameter, not a branch.**

| boundary | polarity | rationale |
|---|---|---|
| ingress (untrusted → state) | **fail-closed** | an unjudged stimulus must not enter |
| internal cognition | **fail-open** | a provider fault must not halt bounded cognition |
| egress veto | **fail-open, typed event** | cognition continues; veto is visible |

**12.3 Degradation ladder.** On resource or component loss, the system descends a declared ladder rather than failing undefined:

$$
\text{full judgment} \;\to\; \text{symbolic baseline} \;\to\; \text{minimal bounded cognition} \;\to\; \text{safe halt}
$$

Judgment depth is a **budget-driven dial**: when the judgment budget is exhausted, admission degrades to the symbolic baseline and the degradation is a typed event. Every proposer class has a symbolic fallback; absence of any optional component yields a strictly weaker, still-lawful reasoner (restriction $\mathcal{R} \mid P$, §13.3).

---

## §13 — The Equational Core

The calculus is quotiented by twelve laws. **They hold for every valid point of the space — they are the space’s constitution.**

| # | Law | Form |
|---|---|---|
| **L1** | Epistemic firewall | $\nexists$ generator $\mathsf{Reward} \to V_{\varepsilon}$; reward touches only attention/policy channels of $\tau$-graded items |
| **L2** | Single commit authority | $\exists!\, \mathsf{commit} : \widehat{\mathcal{A}} \to M$; no write outside it |
| **L3** | Provenance fidelity | $\mathsf{replay} \circ \mathsf{log} \cong \mathrm{id}$; admit-before-write (no mutation without a preceding event) |
| **L4** | Resource conservation & monotonicity | $\mathsf{charge}$ decreases; $\mathsf{transfer}$ conserves total; open-once reset |
| **L5** | Gate monotonicity | $\mathcal{J}_{1} \circ \mathcal{J}_{2} \sqsubseteq \mathcal{J}_{1}$ — adding judgment never widens admission |
| **L6** | Well-foundedness | every iteration budget-bounded or abort-guarded; $\exists$ global natural $\mathsf{abort}$ |
| **L7** | Verifier independence | $\mathsf{imports}(\mathsf{Verifier}) \cap \mathsf{imports}(\mathsf{Engine}) = \varnothing$; drift pinned |
| **L8** | Substrate isolation | exact equivalence never formed from uncertain similarity; substrates share no mutable memory |
| **L9** | Failure transparency | every fault is a typed event; no silent catch affecting cognition, budget, or admission |
| **L10** | Governed reflexivity | authority filtration (§11.1); $V$ and the constitution outside the tower; $\mathcal{F}_{4}$ externally arbitrated |
| **L11** | Evidence independence | revision only across disjoint lineages; dependence ⇒ typed refusal |
| **L12** | Control inspectability | every scheduling/admission/budget decision is an event; $\kappa$ is data, readable at all times (H6) |

---

## §14 — Feasibility Predicate $\Phi(\mathcal{R})$

A configuration is **inhabitable** only if these inter-plane constraints hold. Violation is not suboptimality; it is incoherence.

| # | Constraint | Rationale |
|---|---|---|
| Φ1 | ampliative rules $\Rightarrow$ graded valuation $(f,c)$ or richer | binary monotonic truth cannot support induction/abduction under insufficient evidence |
| Φ2 | AIKR $\Rightarrow$ bounded stores $\wedge$ forgetting $\wedge$ backpressure | boundedness decomposes into containers + decay + yield |
| Φ3 | untrusted proposers $\Rightarrow$ judgment gate at every ingress | else evidence laundering and privilege escalation |
| Φ4 | any learning touching policy $\Rightarrow$ structural firewall (L1) | reward-hack region otherwise |
| Φ5 | $\mathcal{F}_{4}$ self-modification $\Rightarrow$ external arbiter $\wedge$ shadow validation $\wedge$ event-sourced state | self-approval unsound; uncontainable otherwise |
| Φ6 | step-level verification $\Rightarrow$ append-only substrate $\wedge$ deterministic reducers | replay requires a fold, not a snapshot |
| Φ7 | exact co-substrate present $\Rightarrow$ memory isolation + arbiter coupling (L8) | equality contamination otherwise |
| Φ8 | anytime execution $\Rightarrow$ preemptive scheduler $\wedge$ partial-result semantics | FIFO cannot honor interruption |
| Φ9 | graded paraconsistency $\Rightarrow$ non-monotonic dynamics | monotonic chaining detonates retained contradictions |
| Φ10 | learned/market scheduler $\Rightarrow$ control-plane event sourcing | opacity forbidden (A2) |
| Φ11 | ambiguous ingress $\Rightarrow$ multi-candidate parse $\wedge$ abstention path | one confident wrong parse is calibrated error |
| Φ12 | independent verification $\Rightarrow$ transcribed semantics $\wedge$ drift test | co-adapted checker hides shared bugs |

$$
\mathcal{D}^{+} \;=\; \big\{\, \mathcal{R} \in \mathcal{D} \;:\; \Phi(\mathcal{R}) \,\big\}
$$

---

## §15 — Compositionality, Configuration, and the Minimal Kernel

**15.1 Semantic compositionality (Theorem).** For configurations $c_{1}, c_{2}$:

$$
\llbracket c_{1} \otimes c_{2} \rrbracket = \llbracket c_{1} \rrbracket \circ \llbracket c_{2} \rrbracket
\qquad
\llbracket c_{1} \oplus c_{2} \rrbracket = \llbracket c_{1} \rrbracket \times \llbracket c_{2} \rrbracket
\qquad
\llbracket c \mid P \rrbracket = \llbracket c \rrbracket \mid P
$$

Reasoners compose sequentially, in parallel, and degrade by projection — equationally, with laws L1–L12 preserved by construction whenever $\Phi$ holds.

**15.2 Refinement.** $c_{1} \sqsubseteq c_{2}$ iff every behavior of $c_{1}$ is a behavior of $c_{2}$. A refined reasoner substitutes for a general one.

**15.3 Configuration grammar.**

```
ReasonerSpec ::= {
  epistemic : { substrate, grades, valuation, revision, consistency, decay }
  control   : { stageGraph | controlWord, scheduler ∈ {linear..learned},
                delimitedOps, metaController? }
  economy   : { dimensions, scopes, policy ∈ {static, priced, market, thermo} }
  governance: { gates[], admission, trustField, policySurface,
                autonomyRung, reversibilityClasses, constitution }
  ledger    : { eventSchema, correlation, replay, verifier, bounds }
  reflexivity: { filtration, learners[], arbiter }
  failure   : { lattice, directionalDefaults, degradationLadder }
}
```

**15.4 The minimal kernel — what is load-bearing.** Strip the calculus to its generators; exactly five remain:

1. a **substrate** $\langle \mathcal{A}, \mathcal{V} \rangle$ — something to reason with;
2. a **control word** $\kappa$ — something to sequence reasoning;
3. an **admission gate** $\mathcal{J}$ — a boundary between outside and state;
4. a **resource monoid** $\mathcal{B}$ — the fact that cognition is finite;
5. a **provenance fold** $\mathcal{L}$ — the auditability that makes the rest trustworthy.

Everything else — drives, proposers, economies, manifolds, towers — is **enrichment**: a coordinate dialable from absent to present without leaving $\mathcal{D}^{+}$. The full specification sets nearly all dials to *present*; the kernel guarantees the system remains buildable at any setting.

---

## §16 — Operational Semantics (The Unified Tick)

```
while running:
    θ            ← observe()
    corr         ← mintCorrelation(θ)                       # §10.1
    M            ← fold(L)                                  # state is the fold
    (κ, β, π)    ← metaController.selectProgram(M, θ)       # §11.3, governed
    reserve      ← budgetOffice.reserve(β)                  # §6.2; deny ⇒ typed event

    candidates   ← Φ_κ ( M, θ, reserve, corr )              # §5.1: control word acts
                    ▷ every stage: pre/post checked, budget charged, event emitted

    judged       ← Admit( candidates, trustField, budget )  # §8: judge portfolio
    routed       ← policySurface( judged, γ(·), autonomy )  # §9: commit path

    committed    ← commit( routed )                          # §7.4: the one port
                    ▷ L1 re-checked at the port: reward ∩ Truth.ε = ∅

    actions      ← plan( committed )
    for a in actions:                                        # §9.4 pipeline
        simulate → assess → authorize → sandbox → confirm → commit | rollback

    learners.observe( θ, committed, outcome )
    learners.propose( commitLedger )                         # §11.2: proposal only
    consolidate( M, budget )                                 # decay, archive, schema
    emitCausalTrace( corr )                                  # §10: DAG closed
```

---

## §17 — Construction Strata (Implementability)

The specification is built in five conservative extensions. **Each stratum preserves L1–L12 and Φ; later strata never invalidate earlier ones** (anti-goal A1: purity never blocks a runnable kernel).

| Stratum | Adds | Laws engaged |
|---|---|---|
| **S0 · Kernel** | graded substrate, NAL valuation, linear $\kappa$, one gate, scalar budget, ledger + fold, independent verifier | L1–L7, L9, L11 in force from the first build |
| **S1 · Conditional control** | stage graph as data, correlation IDs, control-plane event sourcing | + L12 |
| **S2 · Economy** | resource module, reservations, pricing, clearing/thermodynamics, transfers | + L4 in full |
| **S3 · Judgment manifold** | calibrated trust field, verification portfolio, unified admission functional, autonomy ladder | + L5, §9 |
| **S4 · Reflexivity** | meta-controller, authority filtration, external arbiter, learning-as-proposal | + L10 |

Each stratum is a **conservative enrichment**: new coordinates open; no invariant moves.

---

## §18 — The Coordinate Claim

The point of $\mathcal{D}^{+}$ specified here is characterized by simultaneous maximization on axes usually traded off:

$$
\mathcal{R}_{\Omega} \;=\;
\left\langle
\begin{array}{l}
\text{graded paraconsistent evidential truth,} \\
\text{data-driven control with delimited reconfiguration,} \\
\text{economic resource allocation under conservation,} \\
\text{one transaction type, one commit port, one governance surface,} \\
\text{calibrated judgment with proposer/judge adjunction,} \\
\text{causally complete, independently verifiable provenance,} \\
\text{governed reflexivity with external arbitration}
\end{array}
\right\rangle
$$

This corner is coherent **only because each coupling constraint is answered structurally**: event sourcing reconciles full audit with bounded resources (Φ6·Φ2); the graded type system reconciles deep learning with factual integrity (Φ4); external governance reconciles code-level self-modification with soundness (Φ5); substrate isolation reconciles exact and uncertain computation (Φ7); control-plane provenance reconciles adaptive scheduling with inspectability (Φ10).

---

## §19 — Summary: The Whole Specification on One Line

$$
\boxed{
\text{All cognition is proposal. All commitment is governed. All resource use is settled.}
\;\;
\text{All learning is accountable. All state is a fold. All explanation is causal.}
}
$$

The calculus Ω is the smallest structure in which those six sentences are simultaneously **theorems rather than policies** — and the design space it generates is the space of all reasoners obtainable by dialing its coordinates while its twelve laws hold.
