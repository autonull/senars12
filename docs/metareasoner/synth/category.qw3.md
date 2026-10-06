# 𝕌 — The Unified Coalgebraic Reasoner

## A Self-Contained Specification

**Mathematical backbone:** elementary topos theory, polynomial functors, final coalgebras, fibrations, adjunctions, monoids, and filtered objects.

**One-line essence.** A reasoner is a *resource-bounded, epistemically graded coalgebra* whose complete observable behavior is a morphism into a final coalgebra (provenance), whose mutations coequalize through a single commit adjunction (proposer ⊣ judge), whose truth/desire split is a fibration, whose authority is a well-founded filtration, and whose control is an element of a free Kleene algebra — i.e., **data**.

---

## §0 — Design Charter

This specification commits to a selection from the objective menu, which fixes every subsequent trade-off.

### 0.1 Selections

| Class | Commitment | IDs |
|---|---|---|
| **Prime Objectives** | Epistemic integrity; auditable causal provenance; control-plane fluidity; governed reflexivity; neuro-symbolic synergy; unified commit; compositional configurability | O1, O2, O3, O6, O7, O8, O9 (O5 as structural discipline) |
| **Hard Constraints** | The full Constitution (§12) | H1–H10 |
| **Anti-Goals** | No abstraction without a runnable kernel; no opaque scheduling; no monolithic LM authority; no unbounded richness | A1, A2, A5, A7 |
| **Architectural bias** | **Primary:** D3 elegance/unification. **Strong:** D1 auditability, D4 robustness, D5 modularity. **Bounded:** D6 adaptivity | — |

### 0.2 Governing resolution rule

When elegance, safety, adaptability, and performance conflict, they resolve in this order:

> **Constitution (H1–H10) ▸ Provenance (O2) ▸ Unification (D3) ▸ Adaptivity (D6) ▸ Performance.**

Adaptivity may spend *throughput* but may never spend *auditability, the firewall, or boundedness.* This is the categorical statement that the coalgebra's image in the final coalgebra must remain total and well-founded under every adaptation.

---

## §1 — The Base Category

All structure lives in a single category, so that every subsystem speaks one typed language.

**Definition 1.1 (Base category).** Let **𝔼** be an *elementary topos* with natural numbers object. Concretely one may take **𝔼 = Set^Σ**, the presheaf topos over a cognitive signature Σ, or an effective topos when computability is required.

This supplies:

- **Dependent types** via slices 𝔼/I (the epistemic fibration lives here).
- **Power objects** (decidable predicates, guards).
- **Exponentials** B^A (strategies, judges, schedulers as internal morphisms).
- **Finite limits/colimits** (pullbacks for correlation, coequalizers for commit).

**Definition 1.2 (Two tensor structures).** 𝔼 carries:

1. The **cartesian** product × (observation, copying where lawful).
2. A **symmetric monoidal closed** structure (⊗, I) for *resources*, with a comonad ! mediating the two (a linear/non-linear model). Resources are ⊗-objects: they cannot be copied or discarded except by an explicit morphism (budget charge / refund). This makes AIKR a *structural* property of the tensor, not a runtime check.

**Definition 1.3 (Signature sorts).** The base sorts of Σ:

| Sort | Reading |
|---|---|
| M | memory / cognitive state carrier |
| A | cognitive content (terms) |
| V | epistemic value (truth) |
| D | teleological value (desire) |
| R | resources |
| E | events |
| K | control programs |
| G | governance verdicts |
| O | observations / stimuli |
| Ω | correlation identifiers |
| 2 | verdicts {admit, refuse} |

All subsequent objects are built from these by the type formers of 𝔼.

---

## §2 — Cognitive State as a Graded Object

**Definition 2.1 (Attitude fibration).** Let **B = {epi, tel}** be the attitude base. Define a fibration

$$\pi : \mathsf{Att} \longrightarrow \mathbf{B}$$

with fibers **𝔼_pi = π⁻¹(epi)** (beliefs) and **𝔼_tel = π⁻¹(tel)** (goals). Valuation is fibered:

$$\mathsf{Tr} : \mathbb{E}_{pi} \to \mathsf{Val}_{epi},\quad \mathsf{Tr}(b) = (f,c)$$
$$\mathsf{De} : \mathbb{E}_{tel} \to \mathsf{Val}_{tel},\quad \mathsf{De}(g) = (d,c)$$

The total state object is the **fibered product** over the attitude base:

$$M \;=\; \mathbb{E}_{pi} \times_{\mathbf{B}} \mathbb{E}_{tel}$$

together with attention/priority metadata living in a *separate* subobject **Attn** that both fibers project to.

**Definition 2.2 (The epistemic firewall — H1).** The firewall is the *absence of a morphism class*:

$$\mathrm{Hom}_{\mathbb{E}}\big(\mathsf{Rwd},\; \mathrm{End}(\mathbb{E}_{pi})\big) \;=\; \varnothing$$

Reward **Rwd** may act only on the teleological fiber, and within it only on the **Attn** component:

$$\mathsf{Rwd} \;\longrightarrow\; \mathrm{End}_{\mathsf{Attn}}(\mathbb{E}_{tel}), \qquad \mathsf{Rwd} \;\not\longrightarrow\; \mathrm{End}(\mathsf{Tr})$$

In grading terms: every reward-carrying morphism is graded `tel`; composition with any morphism writing **Tr** is *ill-typed* and rejected by the type system. **This is A1 and H1 as a structural invariant, not a policy.** Contradiction tolerance is retained by allowing 𝔼_pi to carry a *paraconsistent* valuation object (graded coexistence, not explosion).

---

## §3 — The Behavior Endofunctor

Control and effect are packaged into a single endofunctor via a **polynomial functor (container)**, which is the categorical form of "control flow as data."

**Definition 3.1 (Cognitive container).** A *container* is a pair **(S, P)** with S an object of **step-shapes** and P : S → 𝔼 the **continuation-position family**. Its polynomial functor is

$$\Phi(X) \;=\; \sum_{s : S}\Big(\,\mathsf{Out}(s)\;\times\; \prod_{p : P(s)} X\,\Big)$$

where the output object of shape s is

$$\mathsf{Out}(s) \;=\; O(s) \times E(s) \times R(s) \times G(s) \times \mathsf{Val}(s)$$

(observation, emitted events, resource receipt, governance verdict, valuation).

**Reading.** A shape *s* is a single cognitive step (a stage instance together with its budget receipt, governance verdict, and emitted events). A position *p ∈ P(s)* is a continuation slot. Branching, conditionality, parallelism, and iteration are all encoded in the *shape of P*:

- **Linear** step: |P(s)| = 1.
- **Conditional**: P(s) selected by a guard g : X → 2 (a decidable subobject).
- **Parallel fan-out**: |P(s)| = n, with a join shape downstream.
- **Iteration**: a shape whose continuation refers back (handled by the traced structure, §5).

**Definition 3.2 (Cognitive coalgebra).** A **cognitive system** is a coalgebra

$$\xi : X \longrightarrow \Phi(X)$$

for the functor Φ. The map ξ sends each state to (i) the shape of the step to perform, (ii) its outputs, and (iii) its continuation states.

Because S and P are *objects of 𝔼* (not meta-level syntax), **the control topology is data**. This is B1 by construction.

**Modularity note (D5).** Φ may be factored as Φ ≅ T ∘ Φ₀ where Φ₀ is pure shape and T is an effect monad (budget × governance × event-writer), joined by a distributive law. This keeps budget, governance, and provenance swappable behind typed ports while preserving the single coalgebraic spine.

---

## §4 — Control as Data: the Kleene Object

**Definition 4.1 (Control object).** Let **K** be the carrier of the **free Kleene algebra with tests** on the object of stage generators Γ. It is an object of 𝔼, with operations · (sequence), + (choice), * (iteration), p? (test), 1 (skip).

A **control program** is a global element

$$\kappa : 1 \longrightarrow K$$

and its semantics is an interpretation morphism

$$\llbracket - \rrbracket : K \longrightarrow \big[\,X \to \Phi(X)\,\big]$$

so that each program κ denotes a coalgebra transformer. **The running system is the coalgebra (X, ξ_κ) with ξ_κ = ⟦κ⟧.**

**Consequences.**

1. **Declarative control (B1, O3).** Changing control = choosing a different κ : 1 → K. The functor Φ is untouched. Stage skipping, triage branches, and alternative loops are elements of K, not code edits.
2. **Inspectability (H6).** κ is a *decidable* object of 𝔼; its evaluation trace is a subobject of the event log (§7), so no scheduler decision is opaque.
3. **Compositionality.** ⟦κ₁ · κ₂⟧ = ⟦κ₁⟧ ∘ ⟦κ₂⟧ and ⟦κ₁ + κ₂⟧ is the copairing, so control programs compose equationally.

**Adaptive scheduling (B2, O4, D6)** is then a morphism that *chooses κ from evidence*:

$$\sigma : M \times H \times \mathbb{R} \longrightarrow K$$

where H is history and ℝ the resource/economy state (§6). **Constraint A2:** σ must itself be a logged, decidable coalgebra (§7), so a learned or economic scheduler is *never* opaque. The freedom is in which κ is chosen; the auditability of the choice is invariant.

---

## §5 — Boundedness and Anytime Behavior

**Definition 5.1 (Well-foundedness — H5).** A coalgebra (X, ξ) is **admissible** only if it carries a **rank** morphism ρ : X → ℕ that is strictly decreasing along every non-trivial continuation:

$$\forall x,\;\forall p \in P(\xi(x)):\quad \rho\big(\xi(x)_p\big) < \rho(x) \;\;\text{or}\;\; \xi(x)_p \text{ is terminal}$$

Admissibility is the categorical form of "no unbounded reasoning path." Iteration (Kleene *) is interpreted only in the **traced monoidal** subcategory where the trace is well-founded under ρ. This makes *anytime* and *interruptibility* structural: every reachable state has finite remaining rank, so interruption always yields a defined partial result.

**Definition 5.2 (Resource bound).** The rank ρ is coupled to the resource monoid (§6): a step is enabled only when its reservation succeeds. Boundness is thus the conjunction of rank-well-foundedness and resource feasibility.

---

## §6 — The Resource Calculus and Economy

**Definition 6.1 (Resource monoid).** Resources form a **commutative ordered monoid object**

$$(\mathbb{R},\;\oplus,\;0,\;\leq)$$

in 𝔼, internalized in the (⊗, I) tensor so resources are linear (not freely copyable).

**Definition 6.2 (Reservation).** A reservation is a morphism

$$\mathsf{res} : \mathbb{R} \times \mathsf{Op} \longrightarrow \mathbb{R} + \mathsf{Refuse}$$

that is *subtractive* (only decreases the available bundle) and returns a typed refusal on failure. **H9:** every Refuse is an event, never silently swallowed.

**Definition 6.3 (Economy — B5, O4).** A pricing object **Price** and a utility valuation

$$U(\mathit{op}) \;=\; \frac{\widehat{\Delta K} + \widehat{\Delta G} + \widehat{\Delta H}}{\lambda_c\,\widehat{C} + \lambda_r\,\widehat{R} + \lambda_h\,\widehat{H}_{human}}$$

(epistemic + teleological + homeostatic gain over cost, risk, and human-attention cost) turn scheduling into *utility-per-resource* selection. The scheduler σ (§4) selects the morphism maximizing U subject to res succeeding and the Constitution holding.

**Safeguards (A2, A4).** (i) Total resource is conserved under transfer (no laundering); (ii) every reservation, transfer, and denial is an event (§7); (iii) audit depth is bounded and opt-in per derivation, so the economy never buys opacity or bloat.

---

## §7 — Provenance: the Final Coalgebra

This is the categorical heart of **A3, O2, and H3**.

**Definition 7.1 (Final coalgebra).** Since Φ is a polynomial (hence accessible) endofunctor, it has a **final coalgebra**

$$\zeta : \nu\Phi \longrightarrow \Phi(\nu\Phi)$$

The object **νΦ** is the universe of all possible cognitive behaviors.

**Definition 7.2 (The audit map — anamorphism).** For any coalgebra (X, ξ), finality gives a unique coalgebra morphism

$$\llbracket \xi \rrbracket : X \longrightarrow \nu\Phi$$

the **anamorphism (unfold)**. This map *is* the event log: it sends each reachable state to its complete, observable behavior. **Provenance is not added; it is the universal property of the coalgebra.**

**Definition 7.3 (Replay — catamorphism).** A **reconstructor** is a Φ-algebra α : Φ(M) → M. Its catamorphism

$$\llparenthesis \alpha \rrparenthesis : \nu\Phi \longrightarrow M$$

folds behavior back into state (replay).

**Axiom 7.4 (Provenance fidelity — H3, B5).** On reachable states,

$$\llparenthesis \alpha \rrparenthesis \;\circ\; \llbracket \xi \rrbracket \;\cong\; \mathrm{id}_X$$

i.e., *replay ∘ log = identity.* Every mutation is preceded by an event (admit-before-write), so the state is reconstructable from the log.

**Definition 7.5 (Causal correlation — C2).** Let Ω be the correlation object. Events are a functor **Ev : Stim → E** over Ω, and correlation is a **natural transformation**

$$\mathsf{corr} : \mathsf{Ev} \Rightarrow \underline{\Omega}$$

threading a correlation id from stimulus through every step, charge, admission, and commit. Categorically this makes events a *fibered category over Ω*: "which stimulus caused this belief?" is a fiber lookup ∫Ev → Ω. This is O2 and C2 as naturality.

**Definition 7.6 (Verifier independence — H7).** The verifier is a morphism in a **disjoint slice** 𝔼/Verifier that imports no engine algebra; it re-derives conclusions from the logged proof object alone. Independence is the statement that the verifier and engine share no common subobject through which a bug could hide in both.

---

## §8 — The Commit Adjunction: Untrusted Proposers, Trusted Judgment

This encodes **A2, O7, O8, H2, and the neuro-symbolic boundary** in one structure.

**Definition 8.1 (Proposal and admission).** Let **P** be the object of proposals. Define functors

$$\mathsf{Propose} : M \to P, \qquad \mathsf{Admit} : P \to M$$

**Axiom 8.2 (The commit adjunction).**

$$\mathsf{Propose} \;\dashv\; \mathsf{Admit}$$

The **unit** η : Id ⇒ Admit ∘ Propose and **counit** ε : Propose ∘ Admit ⇒ Id measure the *propose↔admit gap* — the amount of a proposal that survives judgment. **The judgment manifold is the (co)unit.** Tightening the adjunction → pure symbolic; loosening → proposer-heavy. Thus "how much to trust System 1" is a **continuous natural-transformation parameter**, not a wiring decision (O7).

**Definition 8.3 (Single commit surface — A2, O8, H2).** All durable mutation — perception, inference, proposals, learning, actions, consolidation, self-modification — coequalizes through one **commit object** C:

$$\xymatrix{ P \ar@<.5ex>[r]^{\mathsf{judge}} \ar@<-.5ex>[r]_{\mathsf{veto}} & C \ar[r]^-{\mathsf{commit}} & M }$$

There is exactly one write morphism C → M. Every proposer (LM, reflex, neural, peer, exact-tool) factors through **Propose**; nothing writes M directly. **Untrusted proposers, trusted judgment** is the statement that Propose's image is always mediated by Admit.

**Definition 8.4 (Context-sensitive governance at commit — B6).** Each candidate carries a **governance profile** gp = (trust, confidence, risk, reversibility, blast-radius, proof-status, judge-status). The commit path is a morphism selected from a policy surface

$$\mathsf{path} : \mathsf{GP} \longrightarrow \mathsf{CommitPath}$$

so that (trust, risk, reversibility, proof) *jointly* determine auto-commit / shadow-commit / provisional / human-review / reject. **H10:** irreversible actions map only to paths with risk classification + authorization.

---

## §9 — Governance Tower and Governed Reflexivity

This encodes **C1, O6, H4, and Löbian soundness** as a well-founded filtration.

**Definition 9.1 (Authority filtration).** Authority is a **filtered object**

$$\mathbb{T}_0 \;\hookrightarrow\; \mathbb{T}_1 \;\hookrightarrow\; \cdots \;\hookrightarrow\; \mathbb{T}_n$$

with level = mutation authority. A level-*i* self-modification is a morphism

$$\mathbb{T}_i \longrightarrow \mathrm{End}(\mathbb{T}_j) \quad \text{defined only for } j < i.$$

**Axiom 9.2 (Irreflexivity — H4, Löbian).** There is no self-approval morphism 𝕋_i → End(𝕋_i) that is not mediated by 𝕋_{i+1}. A level may propose changes to strictly lower levels; it may not approve itself. External/immutable arbitration is the top stratum 𝕋_n that the system cannot edit.

**Axiom 9.3 (Truth is outside the tower).** The epistemic fiber 𝔼_pi (§2) is *not* in the scope of any 𝕋_i. Self-improvement may restructure control, strategies, rules, and code — never factual truth valuation.

**Definition 9.4 (Governed adaptation ladder — C1, O6).** Learning operators are morphisms producing **proposals**, not direct changes:

$$\mathsf{learn} : M \to P \quad\text{(into the commit adjunction, §8)}$$

with authority increasing by target: parameters < strategies < rules < code < governance. Each rung requires the rung below's verification envelope (shadow execution, test, rollback) before the next is reachable. **D6 adaptivity is thus realized, but strictly within the filtration and the firewall.**

---

## §10 — Hybrid Substrate Arbitration

This encodes **B4, O7, H8** — coexistence without semantic contamination.

**Definition 10.1 (Substrate objects).** Substrates S₁,…,S_k (symbolic-uncertain, exact, probabilistic, neural) are objects of 𝔼 each carrying its **own** internal relation: the exact substrate carries an equivalence =_ex (definitional equality); the uncertain substrate carries an evidence relation ~ (graded).

**Axiom 10.2 (Substrate separation — H8).** There is **no coequalizer** identifying =_ex with ~. An exact structure (e.g., an e-graph) may never union nodes on uncertain similarity. The two relations live in disjoint slices.

**Definition 10.3 (Arbitration span).** Substrates interact only through an **arbiter span**

$$S_{ex} \;\longleftarrow\; A \;\longrightarrow\; S_{un}$$

which is a *relation* (proposal-mediated), not an identification. Exact results enter the commit adjunction (§8) as proposals with high trust; uncertain results enter with graded trust. Memory isolation (Φ8 of the corpus) is the statement that substrates do not share a state subobject.

---

## §11 — Failure and Graceful Degradation

This encodes **C3, D4, H9.**

**Definition 11.1 (Error functor).** An error functor **Err** and failure policies as **natural transformations**

$$\eta : \mathrm{Id} \;\Rightarrow\; (-) + \mathsf{Err}$$

distributed over Φ. Gates are **interior/closure operators** (fail-closed / fail-open) on the admission lattice, with polarity a *typed field*, not a buried branch.

**Definition 11.2 (Graceful degradation — C3).** Degradation is a **coalgebra morphism** from the full coalgebra to a weaker sub-coalgebra (a retraction onto a symbolic/fallback spine). On fault of judgment, compute, memory, tool, or model, the system maps to a defined weaker mode.

**Axiom 11.3 (No silent failure — H9).** Every error is an event in the final-coalgebra image (§7); error injection is faithful, so no fault affecting cognition, budget, or admission is swallowed.

---

## §12 — The Constitution: Laws and Feasibility

The **feasible designs** form the full subcategory **𝔼_feas ⊆ 𝔼** cut out by these laws (each a commuting diagram / universal property). This is the hard-constraint set H1–H10 plus the load-bearing foundations, stated categorically.

| # | Law | Categorical form | Source |
|---|---|---|---|
| **L1** | Epistemic firewall | Hom(Rwd, End(𝔼_pi)) = ∅ | A1, H1 |
| **L2** | Admission before write | every write factors through Admit; ∃! commit C→M | A2, H2 |
| **L3** | Provenance fidelity | ⦇α⦈ ∘ ⟦ξ⟧ ≅ id on reachable states | A3, H3 |
| **L4** | Well-foundedness | rank ρ strictly decreasing; iteration only in traced, well-founded subcat | A4, H5 |
| **L5** | Control inspectability | κ decidable; its evaluation a subobject of νΦ | H6 |
| **L6** | Verifier independence | verifier in disjoint slice, no engine imports | H7 |
| **L7** | Substrate separation | no coequalizer of =_ex with ~ | H8 |
| **L8** | No silent failure | Err faithful; every fault an event | H9 |
| **L9** | Risk-gated irreversibility | irreversible ⇒ risk-classified + authorized path | H10 |
| **L10** | Governance irreflexivity | no unmediated 𝕋_i → End(𝕋_i); truth outside tower | H4 |
| **L11** | Resource linearity | resources ⊗-objects; no free weakening/contraction | A4 |
| **L12** | Single commit coequalizer | all mutations coequalize at C | A2 |

**Definition 12.1 (Feasibility predicate).** 

$$\Phi_{feas}(X,\xi) \;=\; \bigwedge_{i=1}^{12} L_i(X,\xi)$$

A **reasoner** is a coalgebra in 𝔼_feas. Adaptation (§4, §9) is a *path through 𝔼_feas*: it may move the point, but may never leave the subcategory. **Safety is path-invariance of the Constitution.**

---

## §13 — The Unified Signature

The whole design is one tuple:

$$\boxed{\;\mathbb{U} \;=\; \big\langle\; \mathbb{E},\;\Phi,\;\nu\Phi,\;\pi,\;\mathbb{R},\;K,\;(\mathsf{Propose}\dashv\mathsf{Admit}),\;\mathbb{T}_\bullet,\;\Omega,\;\mathsf{Err},\;\mathbb{L}\;\big\rangle\;}$$

| Component | Role | Principle served |
|---|---|---|
| 𝔼 | base topos + linear resource tensor | D5, A4 |
| Φ | behavior endofunctor (container) | B1, B3 |
| νΦ | final coalgebra = provenance universe | A3, O2 |
| π | attitude fibration (belief/goal) | A1, O1 |
| ℝ | resource monoid + economy | A4, B5, O4 |
| K | Kleene control object | B1, O3 |
| Prop ⊣ Adm | commit adjunction | A2, O7, O8 |
| 𝕋_• | authority filtration | C1, O6 |
| Ω | correlation (naturality) | C2, O2 |
| Err | failure natural transformation | C3, D4 |
| 𝕃 | Constitution L1–L12 | H1–H10 |

**Master equation.** A cognitive step is the coalgebra

$$\xi_\kappa : X \longrightarrow \Phi(X),\qquad \xi_\kappa = \llbracket \kappa \rrbracket,$$

with audit map ⟦ξ_κ⟧ : X → νΦ, natural in Ω, governed by 𝕋_•, graded by π, and bounded by ℝ — and every adaptation is an endomorphism of 𝔼_feas.

---

## §14 — Reference Architecture (Layered Realization)

The categorical structure maps to seven layers, each a typed port (D5 modularity):

| Layer | Categorical object | Concrete responsibility |
|---|---|---|
| **L0 Substrate** | S₁…S_k + arbiter span | NAL (f,c) uncertain core; exact co-substrate; neural/peer proposers; isolation (L7) |
| **L1 Resource** | ℝ, res, U | budget monoid, reservations, pricing, backpressure, economy (L11) |
| **L2 Control** | K, Φ, σ | stage graph (container), control word κ, scheduler (L4, L5) |
| **L3 Commit** | Prop ⊣ Adm, C, GP | gates, judgment manifold (co)unit, single commit ledger, governance profile (L2, L9) |
| **L4 Provenance** | νΦ, Ω, verifier | event log (final coalgebra), replay, causal correlation, independent verifier (L3, L6) |
| **L5 Governance** | 𝕋_• | authority filtration, governed self-modification, external arbiter (L10) |
| **L6 Degradation** | Err, interior/closure gates | failure policies, fallback spine, graceful retraction (L8) |

**Kernel port signatures** (minimal implementable core, O5/A1):

```
Substrate  : Term → (Valuation × Lineage)                # L0
Control    : 1 → K                                        # pick κ
Shape      : K → Σ_s (Out(s) × P(s) → X)                  # Φ
Budget     : R × Op → R + Refuse                          # res
Gate       : Candidate × GP → {Admit, Veto, Defer}        # Admit lattice
Commit     : Admitted → Event × M                         # single write
Log        : X → νΦ                                       # anamorphism
Replay     : νΦ → M                                       # catamorphism
Govern     : Proposal → Verdict × AuthorityLevel          # 𝕋_•
Degrade    : Fault → WeakerCoalgebra                      # Err retraction
```

This is the smallest load-bearing kernel: **substrate + control word + gate + budget + provenance**, extended by the richer layers without changing the coalgebraic spine.

---

## §15 — Implementation Ladder (Incremental Realizability — C4)

Each phase is independently deployable and preserves L1–L12 throughout. No phase requires replacing the runtime wholesale (A1).

| Phase | Move | Categorical content | Unlocked principle |
|---|---|---|---|
| **P0 — Kernel** | substrate + κ + gate + budget + event log | (X, ξ), ℝ, Admit, νΦ minimal | A2–A4, H1–H3, H5 |
| **P1 — Stage graph as data** | replace fixed sequencing with container Φ | S, P objects | B1, O3, L4, L5 |
| **P2 — Correlation threading** | natural transformation corr : Ev ⇒ Ω | fibered events | C2, O2 |
| **P3 — Unified commit ledger** | coequalize all mutations at C | Prop ⊣ Adm, single C→M | A2, O8, B3, L2, L12 |
| **P4 — Resource economy** | reservations + pricing + utility | ℝ-economy | B5, O4, A4 |
| **P5 — Adaptive scheduling** | σ : M×H×ℝ → K, logged and decidable | κ selection | B2, D6, L5 (no opacity) |
| **P6 — Governed reflexivity** | authority filtration + external arbiter | 𝕋_• | C1, O6, L10 |

The ladder is monotone in capability and constant in the Constitution: **each phase spends throughput or complexity, never auditability, the firewall, or boundedness** (§0.2).

---

## §16 — Why This Is the Synthesis

- **Category theory** supplies the unification (D3): one topos, one functor, one coalgebra, one adjunction, one filtration — no special cases (one control model, one transaction model, one commit surface, one governance vocabulary, one resource model).
- **Coalgebra** supplies the dynamic, observable, bounded core: state → behavior is the transition; the final coalgebra makes *provenance a universal property*, not a logging afterthought.
- **The duality unfold/fold** (anamorphism/catamorphism) *is* the log/replay guarantee.
- **The fibration** *is* the belief/goal firewall.
- **The adjunction** *is* untrusted-proposer/trusted-judgment and the single commit surface.
- **The filtration** *is* governed self-modification with Löbian soundness.
- **The Kleene object** *is* control-as-data.
- **The linear tensor** *is* AIKR boundedness.

Every load-bearing principle, every capability objective, and every evolution objective from the menu is realized as a *named categorical structure*, and every hard constraint is a *law cutting out the feasible subcategory*. The result is a single, self-contained, implementable specification whose elegance is matched by a concrete, phased migration path.

**Final statement.** 

> A reasoner in 𝕌 is a well-founded, epistemically graded Φ-coalgebra whose audit map into the final coalgebra is total, whose every mutation coequalizes through one governed adjunction, whose control is a decidable element of a free Kleene algebra, whose resources are linear, whose authority is irreflexive, and whose adaptations are precisely the endomorphisms of the feasible subcategory.
