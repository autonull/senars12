# The Cognitive Coalgebra
## A Complete, Self-Contained Specification for a Governed Hybrid Reasoner

---

## Part 0 — Selected Governing Principles

Before the specification, the selections that resolve all design conflicts.

**Architectural bias (Section D):** **D3 (Unification)** is the primary bias — one transaction model, one commit surface, one control semantics, one governance vocabulary, one resource algebra. **D1 (Auditability)** and **D5 (Modularity)** are co-equal secondary constraints; **D6 (Adaptivity)** is admitted only where it can be purchased without spending D1. D2 and D4 are treated as *emergent properties* of the construction, not independent targets.

**Prime Objectives:** O1 · O2 · O3 · O4 · O6 · O7 · O8 — the full synergistic bundle.
**Hard Constraints:** H1–H10, all ten, adopted as the *Constitution*. They are mutually consistent and jointly close every known corruption channel (reward-hacking, evidence-laundering, self-approval, unbounded search, silent failure, verifier co-adaptation, substrate contamination, ungoverned irreversibility).
**Anti-Goals:** A2 (scheduler opacity), A4 (audit bloat), A5 (monolithic LM authority), A7 (unbounded cognitive richness).
**Non-negotiable foundations A1–A4 and capability/evolution objectives B1–B6, C1–C4:** all retained; the construction below exists to satisfy them simultaneously.

The one-sentence thesis of the design:

> **A reasoner is a pointed coalgebra whose transitions are governed transactions, whose state is the colimit of its event history, whose control flow is an element of a Kleene algebra, whose admission is a topology, and whose self-modification is a well-founded filtration — and all five are the same construction viewed from different heights.**

---

## Part 1 — Mathematical Foundations

### §1.1 The base category

Fix a **many-sorted topos** 

$$\mathcal{E} = \mathbf{Set}^{\Sigma}$$

where $\Sigma$ is a small *signature category*: objects are cognitive sorts, morphisms are primitive typed operations. Objects of $\mathcal{E}$ are $\Sigma$-typed sets; morphisms are type-respecting maps. All constructions below are internal to $\mathcal{E}$.

**Sorts.** The signature contains at minimum:

| Sort | Meaning | Structure |
|---|---|---|
| $\mathsf{Term}$ | symbolic content | term algebra, canonical |
| $\mathsf{V}_e$ | epistemic truth | $[0,1]^2$ pairs $(f,c)$ with revision monoid |
| $\mathsf{V}_t$ | teleological value | $[0,1]^2$ pairs $(d,c)$ with progress revision |
| $\mathsf{Belief}=\mathsf{Term}\times\mathsf{V}_e$ | factual commitment | — |
| $\mathsf{Goal}=\mathsf{Term}\times\mathsf{V}_t$ | desire commitment | — |
| $\mathsf{Question}, \mathsf{Hypothesis}, \mathsf{Plan}, \mathsf{ActionIntent}$ | derivative attitudes | typed |
| $\mathsf{Prop}$ | proposals | all candidate mutations |
| $\mathsf{Verd}$ | verdicts | trust, confidence, risk, reversibility |
| $\mathsf{Ev}$ | events | append-only labels |
| $\mathsf{Q}$ | resources | quantale (§3) |
| $\mathsf{Prog}$ | control programs | KAT (§4) |

**Truth monoid.** $(\mathsf{V}_e, \otimes, e)$ is a commutative, non-idempotent monoid: revision $\otimes$ combines independent evidence, $e=(\tfrac12,0)$ is vacuous belief, confidence is sub-additive, and revision carries an *independence witness* — a proof obligation carried with every application of $\otimes$ (preventing evidence double-counting).

### §1.2 Grading: the Epistemic Firewall (H1, A1)

**Definition 1.2.1 (Grade).** A *grade* is a functor $\chi : \Sigma \to \mathbf{2}$ to the two-point poset, with values $\mathsf{epistemic}$ and $\mathsf{teleological}$. The signature is **graded**: every generator $g : A \to B$ in $\Sigma$ carries a grade profile.

**Axiom F1 (Firewall).** 
(i) $\mathsf{V}_e$ has grade $\mathsf{epistemic}$; $\mathsf{V}_t$ has grade $\mathsf{teleological}$; the two are disjoint coproduct summands of the value object.
(ii) Every generator $g$ with a teleological input is forbidden from having $\mathsf{V}_e$-frequency as an output component. The only admissible teleological→system channels are the **attention channel** $\mathsf{Att}$ and the **policy channel** $\mathsf{Pol}$:

$$\rho : \mathsf{Reward} \longrightarrow \mathsf{Att} \times \mathsf{Pol}$$

(iii) Well-formed programs are grade-preserving morphisms; the typechecker rejects any composition whose type would route reward into factual confidence.

*Consequence.* “No reward writes truth” is not a policy comment; it is a typing discipline. Sycophancy is a type error. The firewall is compatible with paraconsistent retention: contradictory beliefs may coexist as distinct $\mathsf{Belief}$ elements with distinct truth values — graded coexistence, never collapse.

### §1.3 Substrate separation (H8, B4)

**Definition 1.3.1 (Substrate coproduct with arbiter).** A hybrid substrate is a coproduct

$$\mathsf{State} = \mathsf{Sym} + \mathsf{Exact} + \mathsf{Emb} + \mathsf{Neu}$$

of symbolic, exact-computational, embedded/vector, and neural-proposal regions, with the universal property that **no coequalizer identifying elements across summands exists in the signature**. Cross-substrate influence occurs only through the **arbiter object**:

$$\mathsf{Arb} : \mathsf{State}_i \longrightarrow \mathsf{Prop} \longrightarrow \mathsf{State}_j$$

— every cross-substrate effect is a *proposal*, judged and committed like any other.

**Axiom F7 (Substrate isolation).** In particular, the exact substrate’s equality relation is never quotiented by the neural substrate’s similarity relation. Exact computations emit results as proposals with proofs attached; embeddings and neural heads emit proposals with calibrated scores attached. Neither may write the other’s state.

---

## Part 2 — The Core Coalgebra

### §2.1 Behavior functor

**Definition 2.1.1.** Define the endofunctor $F : \mathcal{E} \to \mathcal{E}$ by

$$F(X) \;=\; 1 \;+\; \mathcal{P}_{\omega}\big(\mathsf{Lab} \times X\big)$$

where $\mathcal{P}_{\omega}$ is the finite-powerset functor (bounded nondeterminism — finiteness is a *constructor*, giving A4 by structure), and the label object

$$\mathsf{Lab} \;=\; \coprod_{k \in \mathsf{ActKind}} \big(\mathsf{Payload}_k \times \mathsf{Q} \times \mathsf{Verd} \times \mathsf{Corr}\big)$$

carries, per transition: an action kind (perceive · attend · infer · propose · judge · commit · act · learn · consolidate · fault · schedule), its typed payload, the resource cost $\in \mathsf{Q}$, the verdict context, and a **correlation id** $\in \mathsf{Corr}$. The summand $1$ is clean termination.

**Definition 2.1.2 (Reasoner).** A *reasoner* is a pointed coalgebra

$$(S,\; \xi : S \to F(S),\; s_0 : 1 \to S)$$

A step $\xi(s)$ either terminates or yields a finite set of (label, successor) pairs — one cognitive transition per branch, each labeled with everything needed to audit it.

**Axiom F3 (Provenance by construction).** The coalgebra *is* the observation mechanism: every transition emits its full label. There is no separate “logging layer”; the forgetful map $\mathsf{Lab} \times S \to \mathsf{Ev} \times S$ is structural. *Consequence:* a silent failure is not expressible (H9) — faults are transitions labeled $\mathsf{fault}$, and scheduler choices are transitions labeled $\mathsf{schedule}$ with their reason payloads (H6).

### §2.2 The final coalgebra and trace semantics

**Theorem 2.2.1 (Behavioral semantics).** $F$ admits a final coalgebra $(\nu F,\, \zeta)$ on the accessible part. Every reasoner admits a unique coalgebra morphism

$$\tau : (S,\xi) \longrightarrow (\nu F, \zeta)$$

The map $\tau$ is the **total provenance semantics**: $\tau(s)$ is the complete tree of possible futures of state $s$, with all labels, costs, verdicts, and correlations intact.

- **Replay** is the anamorphism: from any event prefix, unfold back into the coalgebra.
- **Verification** is the catamorphism: fold an event prefix through a (transcribed) dynamics.
- **Bisimilarity** is equality in $\nu F$: two implementations are interchangeable iff their trace maps agree.

**Definition 2.2.2 (Correlation).** A correlation id is the image, under $\tau$, of the pointed stimulus. The provenance structure of a conclusion is the *fiber of $\tau$ over that id*: the sub-DAG of all transitions carrying it. “Which stimulus caused this belief?” is the query “which fiber contains this event?” — always well-posed (C2, O2).

**Definition 2.2.3 (Audit bounds).** $\nu F$ is explored through a **recorder bound**: the provenance image retained per window is a bounded subobject (e.g., step cap × record cap), selected by priority. Audit depth is thus a *budgeted projection* of $\tau$, never its full materialization — this resolves the audit-bloat anti-goal (A4) without sacrificing provenance-by-construction: the structure is total, its retention is economic.

---

## Part 3 — The Resource Quantale and the Economy (O4, B5)

### §3.1 Resource algebra

**Definition 3.1.1.** Resources form the **quantale**

$$\mathsf{Q} = \big([0,\infty]^k,\; \leq,\; +,\; 0\big)$$

ordered pointwise, monoidal by pointwise addition. Dimensions include: control steps, derivations, premise selections, memory operations, model invocations, tokens, wall-clock latency, attention slots, risk quota, and human-attention quota. The bottom element $0$ is free; $\infty$ is forbidden (there are no infinite ceilings — this is the AIKR stance, baked into the algebra: every ceiling is a finite element of $\mathsf{Q}$).

**Operations.** $\mathsf{reserve} : \mathsf{Q} \to \mathsf{Q}$ (escrow), $\mathsf{charge} : \mathsf{Q} \times \mathsf{Q} \to \mathsf{Q} + \mathsf{Refuse}$ (monotone-decreasing), $\mathsf{settle}$ (refund unused reservation), $\mathsf{transfer}$ (lattice move between scopes preserving the global total).

**Axiom F2 (Bounded cognition).** 
(i) All ceilings are finite elements of $\mathsf{Q}$; 
(ii) $\mathsf{charge}$ is monotone-decreasing and refusal is a *typed value*, never an exception; 
(iii) every container is a bounded finite object ($\mathcal{P}_{\leq n}$ or bounded bags with decay); 
(iv) **decoupled forgetting**: truth decays only under invalidation/contradiction evidence; priority decays by access. The two decay maps are distinct natural transformations $\delta_v, \delta_a : \mathsf{Memory} \Rightarrow \mathsf{Memory}$.

### §3.2 The resource-writer monad

**Definition 3.2.1.** Cost accounting is the **writer monad** over $\mathsf{Q}$:

$$W(X) = X \times \mathsf{Q}, \qquad \eta(x) = (x, 0), \qquad (x, q) \gg\!= f = \text{let } (y, q') = f(x) \text{ in } (y, q + q')$$

Every stage is a morphism $S \to W(S)$ in Kleisli$(W)$: executing a stage returns a state and *accumulates its exact cost*. Sequential composition adds costs; the total cost of a program is read off monadically. H5 (“no unbounded path”) becomes: **every program carries a cost ceiling** $\lceil\kappa\rceil \in \mathsf{Q}$, and the runtime refuses reservation when the ceiling cannot be met. Unboundedness is not merely discouraged — it is not denotable.

### §3.3 Prices, utility, and the market scheduler

**Definition 3.3.1 (Cognitive economy).** A *price* is a morphism $p : \mathsf{Op} \to \mathsf{Q}$; an *expected-utility* morphism $\hat{u} : \mathsf{Op} \to \mathbb{R}$ combines epistemic gain, goal progress, homeostatic balance, and risk penalty:

$$\hat{u}(o) \;=\; \widehat{\Delta K} + \widehat{\Delta G} + \widehat{\Delta H} \;-\; \lambda_r \widehat{\mathrm{Risk}} \;-\; \lambda_h \widehat{\mathrm{HumanAttn}}$$

The **market scheduler** selects, among reservation-feasible operations, those maximizing utility-per-cost $\hat{u}(o)\,/\,p(o)$. Reservation happens *before* execution; settlement *after*; starvation is therefore distinguishable from idleness — a denied reservation is an event with a typed reason.

**Axiom F10 (Scheduler transparency).** Every scheduling decision — selection, deferral, preemption, price revision, market clearing — is a labeled transition with its reason payload (utility estimate, price, alternatives considered). No opaque scheduling exists (H6, A2): a learned or market-based scheduler is admissible *only because* its decisions are events in the same coalgebra it governs.

**Graceful pressure response.** Utility-per-cost ordering yields degradation for free: under low pressure, exploration-priced operations win; under high pressure, only goal-critical and proof-bearing operations clear the market; under exhaustion, the system degrades to cheaper substrates (symbolic-only mode) — a *movement along the price object*, not a special-case fallback (C3).

---

## Part 4 — Control as Data: The Kleene Algebra of Programs (O3, B1, B2)

### §4.1 The program object

**Definition 4.1.1 (KAT of cognition).** Let $\mathsf{Gen}$ be the set of **stage generators** (atomic cognitive operations, each a morphism in Kleisli$(W)$) and $\mathsf{Test}$ the set of **guards** (predicates on $S$). The **program object** is the free Kleene Algebra with Tests:

$$\mathsf{Prog} = \mathrm{KAT}(\mathsf{Gen}, \mathsf{Test})$$

with operations $\cdot$ (sequence), $+$ (choice), $^*$ (iteration), $p?$ (test), $1$ (skip), quotiented by the KAT axioms. A **program** is an element $\kappa \in \mathsf{Prog}$.

**Axiom B-1 (Declarative control).** Control flow is *data*: programs are values of $\mathsf{Prog}$ — stored, versioned, composed, diffed, governed, and hot-swapped at coalgebra boundaries. Conditional edges, optional stages, parallel fan-out, and loop-until-convergence are KAT expressions:

$$\kappa = \mathsf{perceive} \cdot \mathsf{attend} \cdot \big(\mathsf{ready}? \cdot \mathsf{infer} \cdot \mathsf{commit} \;+\; \neg\mathsf{ready}? \cdot 1\big) \cdot \big(\mathsf{due}? \cdot \mathsf{consolidate}\big)^*$$

**Denotational semantics.** $\llbracket \kappa \rrbracket : S \to W(S)$ is defined by the standard KAT action on Kleisli$(W)$; compositionality holds: $\llbracket \kappa_1 \cdot \kappa_2 \rrbracket = \llbracket \kappa_1 \rrbracket \gg\!= \llbracket \kappa_2 \rrbracket$. Programs compose equationally; equivalence of control flows is an algebraic question.

### §4.2 Stage graph presentation

Every $\kappa$ may be presented as a finite guarded automaton: nodes are stage generators, edges carry guards and budget-scope annotations. The automaton presentation is *compiled data* — loaded at startup or installed by governance — and statically checkable: invariants such as “no path from inference to memory bypassing commit” become **graph predicates**, decidable before runtime (D1 without rigidity).

### §4.3 The scheduler as program selector

**Definition 4.3.1.** The scheduler is a morphism

$$\sigma : \mathsf{Context} \longrightarrow \mathsf{Prog}$$

selecting, per cognitive situation, a program from a governed **program portfolio** $\{\kappa_{\mathrm{reactive}}, \kappa_{\mathrm{deliberative}}, \kappa_{\mathrm{curious}}, \kappa_{\mathrm{repair}}, \kappa_{\mathrm{consolidating}}, \kappa_{\mathrm{creative}}, \dots\}$.

- Fixed sequencing is the degenerate case $|\mathrm{portfolio}| = 1$.
- Priority/claim-queue scheduling is $\sigma$ over programs built from claim-consumption generators.
- Learned scheduling is $\sigma$ parameterized by a learned scoring morphism — admissible only under F10 (all choices are events) and F5 (all changes are governed proposals).

### §4.4 Heterochrony: the tower of rates

**Definition 4.4.1 (Rate functor).** Let $\mathbf{Rt}$ be the poset of cognitive rates

$$\mathsf{reflex} \;<\; \mathsf{tick} \;<\; \mathsf{turn} \;<\; \mathsf{consolidation} \;<\; \mathsf{identity}$$

A **heterochronous reasoner** is a functor $\mathcal{C} : \mathbf{Rt} \to \mathbf{Coalg}(F)$ — one coalgebra per rate — together with two natural transformations:

- $\mathsf{veto} : \mathcal{C}(r_{\text{fast}}) \Rightarrow \mathcal{C}(r_{\text{slow}})$ — lower levels may interrupt higher (reflex safety);
- $\mathsf{configure} : \mathcal{C}(r_{\text{slow}}) \Rightarrow \mathsf{Prog}(\mathcal{C}(r_{\text{fast}}))$ — higher levels rewrite lower-level programs, only via governance.

Each level owns a budget slice; slices sum to the global budget (one $\mathsf{Q}$, many allocations). Reflex arcs get their natural sub-cycle timescale; identity-level schema review runs on geological time; neither blocks the other.

---

## Part 5 — Transactions, Admission, and the Commit Ledger (O8, B3, A2)

### §5.1 Cognitive transactions

**Definition 5.1.1 (Transaction).** A **cognitive transaction** is a morphism in the symmetric monoidal category $\mathbf{Txn}$ with objects the cognitive sorts and arrows carrying a typed attribute record:

$$T : \mathsf{In} \to \mathsf{Out}, \qquad \mathrm{attr}(T) = \langle \underbrace{b}_{\mathsf{Q}\text{-reservation}},\; \underbrace{\theta}_{\text{trust profile}},\; \underbrace{\rho}_{\text{risk profile}},\; \underbrace{\iota}_{\text{reversibility class}},\; \underbrace{\pi}_{\text{proof obligations}},\; \underbrace{\phi}_{\text{failure policy}},\; \underbrace{c}_{\mathsf{Corr}} \rangle$$

**Axiom B-3 (Transaction uniformity).** *Every* cognitive operation — perception, attention, derivation, proposal, judgment, action, learning step, forgetting step, consolidation pass, self-modification patch — is a transaction. There is exactly one class of operation; the taxonomy of cognition lives in the transaction’s $\mathsf{kind}$ field, not in separate execution paths.

**Composition.** Sequential composition $\gg\!=$ accumulates reservations via $W$; parallel composition $\otimes$ reserves the join of budgets; both preserve correlation by inheriting the parent id and minting children. The transaction category is an **operad**: $n$-ary compositions of transactions are transactions.

### §5.2 Proposals and judges (O7, B4)

**Axiom B-4 (Proposer/judge adjunction).** Untrusted generation and trusted admission form an adjunction

$$\mathsf{propose} \;\dashv\; \mathsf{admit}$$

Every producer — symbolic rule, exact engine result, neural head, language model, reflex, peer agent — inhabits the *proposer* side: its outputs are elements of $\mathsf{Prop}$, typed provisional, never state. The *judge* side consumes $\mathsf{Prop}$ through a **verification portfolio**: schema check, formal proof, calibrated judgment score, shadow simulation, or human approval. The unit/counit of the adjunction measure the propose↔admit gap — the calibration surface.

**Trust topology.** Judges compute a continuous trust field $\mathsf{Trust} : \mathsf{Prop} \to [0,1]$ from source quality, source reputation, calibrated head scores, and corroboration. Admission bands (act · review · block) are cuts of this field. The field value at admission is recorded in the transition label — calibration data is never discarded.

**Judgment budget.** Judgment itself is a priced operation. Under judgment-budget exhaustion, admission degrades to the cheapest sufficient judge (symbolic baseline) — the trust posture is a *dial on the economy*, not a hardwired asymmetry.

### §5.3 Gates as topology

**Definition 5.3.1.** The lattice of admissible subobjects of $\mathsf{Prop}$ carries **admission operators** $j : \mathrm{Sub}(\mathsf{Prop}) \to \mathrm{Sub}(\mathsf{Prop})$, idempotent and either:

- **interior** ($j(X) \leq X$): fail-closed — on absence or fault, refuse;
- **closure** ($X \leq j(X)$): fail-open — on absence or fault, admit (with degraded typing).

A gate is an interior/closure operator plus an **orientation bit**. Gates compose by meet (all must admit), may be joined into weighted committees, and carry explicit fault policies. The epistemic firewall is a **closed ideal** in the gate lattice: the family of grade-respecting gates, which no composition can leave.

**Axiom F9 (No silent failure).** Every gate fault — timeout, judge unavailable, budget refusal, digest mismatch — is a labeled transition with a typed fault kind and a chosen policy outcome. “Fail-open” and “fail-closed” are named, recorded behaviors; *swallowing* is not a policy value.

### §5.4 The Commit Ledger (single write authority)

**Definition 5.4.1.** The **commit ledger** is the unique state-write morphism

$$\mathsf{commit} : \mathsf{Prop} \times \mathsf{Verd} \times \mathsf{Q} \longrightarrow S + \mathsf{Rejected}$$

**Axiom F4 (Single commit authority).** Every mutation of durable cognitive state factors uniquely through $\mathsf{commit}$: for any write $w : X \to S$ there exists a unique factorization $X \to \mathsf{Prop}\times\mathsf{Verd}\times\mathsf{Q} \xrightarrow{\mathsf{commit}} S$. The ledger pipeline is fixed:

$$\mathsf{Candidate} \to \mathsf{Normalize} \to \mathsf{TypeCheck} \to \mathsf{EvidenceIndependence} \to \mathsf{Verify} \to \mathsf{Rank} \to \mathsf{Settle} \to \mathsf{RiskClassify} \to \mathsf{Commit} \mid \mathsf{Reject}$$

Perception commits observations. Derivations commit beliefs. Proposals commit judged content. Learning commits lessons and parameter deltas. Actions commit intentions. Self-modification commits governed patches. Forgetting commits removals. One port, one pipeline, one audit shape (D3 in its purest form).

### §5.5 State as colimit of events (B3, O2)

**Definition 5.5.1.** The event log is a chain in $\mathcal{E}$:

$$E_0 \hookrightarrow E_1 \hookrightarrow E_2 \hookrightarrow \cdots$$

Define the **state functor** $\mathsf{St}$ from the poset of event prefixes to $\mathcal{E}$ by deterministic fold:

$$\mathsf{St}(E_n) = \mathsf{commit}\text{-fold}(E_n)$$

The current state is the filtered colimit $\varinjlim \mathsf{St}$. Snapshots are *caches* — values of $\mathsf{St}$ memoized at checkpoints — never sources of truth.

**Theorem 5.5.2 (Replay).** Under pure (side-effect-free) commit reduction, $\mathsf{St}$ is well-defined independent of evaluation order, and replay of any prefix reconstructs the state hashed identically. *Proof sketch:* purity makes the fold a functor; filtered colimits commute with the finite constructions used by commit. ∎

**Verifier independence (H7, Axiom F6).** The verifier is a second state functor $\mathsf{St}^{\dagger}$ defined over a **transcribed signature** $\Sigma^{\dagger}$ sharing no code with the engine’s $\Sigma$. A drift test — agreement on a finite corpus, pinned by construction — measures $\mathsf{St}$ vs. $\mathsf{St}^{\dagger}$ divergence rather than assuming it zero. A bug cannot hide in both because the two live in different categories by design.

---

## Part 6 — Governance and Reflexivity (O6, C1, H4, H10)

### §6.1 The governance object

**Definition 6.1.1.** Every commit candidate receives a **governance profile**:

$$g(T) = \langle \mathsf{trust},\; \mathsf{confidence},\; \mathsf{risk},\; \mathsf{reversibility},\; \mathsf{blastRadius},\; \mathsf{proofStatus} \rangle \;\in\; \mathsf{Gov}$$

The **policy surface** is a morphism

$$\pi : \mathsf{Gov} \longrightarrow \mathsf{Path}, \qquad \mathsf{Path} = \{\mathsf{auto},\; \mathsf{shadow},\; \mathsf{provisional},\; \mathsf{review},\; \mathsf{proof\text{-}required},\; \mathsf{reject}\}$$

continuous in the sense that adjacent profiles map to adjacent paths. Trust, risk, reversibility, and proof status *jointly* determine the path (B6) — the autonomy ladder is the restriction of $\pi$ to action transactions; the same surface governs belief commitments, strategy changes, and patches.

**Axiom F8 (Irreversibility gate).** Transactions whose reversibility class is irreversible require $\mathsf{proofStatus}=\mathsf{checked}$ or human approval before commit; forbidden-class transactions (e.g., disabling a safety gate) are rejected at type-check time, before governance is even consulted (H10).

### §6.2 Authority filtration and the no-self-approval law

**Definition 6.2.1.** The **authority filtration** is a well-founded poset of levels

$$\mathcal{F}_0 \subset \mathcal{F}_1 \subset \cdots \subset \mathcal{F}_n \subset \mathcal{F}_{\mathrm{ext}}$$

Every mutable component of the system is assigned a level: parameters < strategies < rules < programs < governance policies. The top level $\mathcal{F}_{\mathrm{ext}}$ is **external**: an immutable environment (CI, external runner, human approver) that the system cannot write.

**Axiom F5 (No self-approval).** A change proposal at level $\ell$ requires judgment at level strictly greater than $\ell$:

$$\mathsf{approve} : \mathcal{F}_{>\ell} \times \mathsf{Prop}_\ell \to \mathsf{Verd}$$

*Consequence.* The Löbian loop is closed by construction: no chain of self-modifications reaches its own approval authority, because the authority poset is well-founded and its top is outside the system’s write surface. Self-modification at level $\ell$ proceeds: *propose → shadow-execute → verify → approve-at-$\ell{+}1$ → commit → observe → retain-or-rollback*.

**Axiom (Learning as proposal).** All learning operators — parameter updates, strategy adaptations, rule inductions, schema promotions, patch generations — are morphisms into $\mathsf{Prop}$, never into $S$ directly. Learning that touches the reward or governance objects routes exclusively to $\mathsf{Prop}$ at the highest level and can never be auto-committed.

### §6.3 The meta-controller (governed reflexivity, D6 under D1)

**Definition 6.3.1.** The **meta-controller** is itself a small reasoner coalgebra whose plant is the control plane: its observations are scheduler telemetry, starvation events, contradiction rates, calibration drift, and trace grades; its outputs are *program-edit proposals* $\Delta\kappa$ and *budget-transfer proposals*, all routed through §6.2.

It may **propose** a new stage graph, a new program for the portfolio, a price revision, or a timescale reorganization. It may **never apply** directly: its commits are proposals at the program level, approved one level up, hot-swapped at cycle boundaries with all counters and detectors carried across. Reflection without authority — the adaptivity of D6 purchased with the auditability of D1 intact.

---

## Part 7 — The Constitution (Collected Axioms)

| # | Name | Statement | Constraint satisfied |
|---|---|---|---|
| **F1** | Firewall | Graded signature; reward reaches only attention/policy channels | H1, A1 |
| **F2** | Boundedness | Finite ceilings, bounded containers, decoupled forgetting | H5, A4 |
| **F3** | Provenance by construction | Every transition is a fully-labeled event | H3, H6, H9 |
| **F4** | Single commit authority | All writes factor uniquely through the ledger | A2, O8 |
| **F5** | No self-approval | Approval authority strictly above change level, well-founded, external top | H4, C1 |
| **F6** | Verifier independence | Transcribed signature; drift measured, not assumed | H7 |
| **F7** | Substrate isolation | No cross-substrate quotienting; arbiter-only influence | H8, B4 |
| **F8** | Irreversibility gate | Risk/reversibility jointly determine commit path | H10, B6 |
| **F9** | No silent failure | Every fault is a typed, recorded transition | H9, C3 |
| **F10** | Scheduler transparency | Every control decision is an inspectable event | H6, A2 |

**Theorem 7.1 (Mutual consistency).** The constitution is jointly satisfiable: the construction of Parts 1–6 is a model of F1–F10. *Sketch:* F1 is typing; F2 is the choice of finite quantale elements and bounded functors; F3 is the coalgebra shape; F4 is the universal property of commit; F5 is well-foundedness; F6–F7 are coproduct/transcription discipline; F8–F10 are labeling requirements on transitions already demanded by F3. No axiom constrains what another requires to be free. ∎

**Theorem 7.2 (Conservation of guarantees).** In this design space, guarantees are neither created nor destroyed — only relocated. Spending determinism on adaptive scheduling (Part 4) is *paid back* by F10+F3 (scheduler decisions as events). Spending binary gating on continuous trust fields (Part 5) is paid back by recording the field value at every admission. Any movement through the space that drops a guarantee without re-anchoring it violates some F-axiom and is, by definition, outside the specification.

---

## Part 8 — Reference Architecture (Component Realization)

The abstract construction materializes as twelve components behind typed ports (D5). Every component is replaceable by any behaviorally equivalent implementation — same trace map, same port signature (Theorem 2.2.1 as the substitution criterion).

| Component | Categorical identity | Port surface |
|---|---|---|
| **Type kernel** | Signature $\Sigma$ + grade functor $\chi$ | typecheck, gradeOf, channel registry |
| **State fold** | $\mathsf{St}$ colimit engine | fold, snapshot, hash, restore |
| **Commit ledger** | $\mathsf{commit}$ universal morphism | submit(candidate) → verdict + event |
| **Transaction runtime** | $\mathbf{Txn}$ monoidal executor | reserve, execute, settle, fault |
| **Budget office** | $\mathsf{Q}$-action + writer monad | reserve, charge, transfer, settle, price |
| **Program registry** | $\mathsf{Prog}$ object, versioned | load, validate, install-at-boundary, diff |
| **Scheduler** | $\sigma : \mathsf{Context} \to \mathsf{Prog}$ + market clearing | select, bid, clear, explain |
| **Gate lattice** | interior/closure operators | admit, veto, committee, orientation |
| **Verification portfolio** | $\mathsf{Prop} \to \mathsf{Verd}$ family | schema, proof, judge, simulate, escalate |
| **Governance surface** | $\pi : \mathsf{Gov} \to \mathsf{Path}$ | classify, route, approve-at-level |
| **Meta-controller** | control-plane coalgebra | observe, propose $\Delta\kappa$, propose transfers |
| **Provenance graph** | trace map $\tau$ + fibers | query(correlationId), replay, verify, export |

**Cognitive type system.** The full attitude vocabulary is first-class: $\mathsf{Belief}(f,c)$, $\mathsf{Goal}(d,c)$, $\mathsf{Question}(\text{priority}, \text{expected information gain})$, $\mathsf{Hypothesis}(\text{plausibility}, \text{evidence requirement})$, $\mathsf{Assumption}(\text{scope}, \text{validity})$, $\mathsf{Plan}(\text{utility}, \text{feasibility}, \text{risk})$, $\mathsf{Obligation}(\text{priority}, \text{deadline})$, $\mathsf{ActionIntent}(\text{reversibility}, \text{authorization})$, $\mathsf{Lesson}(\text{source}, \text{trust}, \text{applicability})$. The type system enforces, beyond F1: goal-failure never entails false belief; plan-utility never masquerades as truth; assumptions are scoped and discharged.

**Action pipeline.** Actions are transactions whose commit path is extended:

$$\mathsf{Goal} \to \mathsf{Plan} \to \mathsf{Simulate} \to \mathsf{RiskClassify} \to \mathsf{Authorize} \to \mathsf{Sandbox} \to \mathsf{Confirm} \to \mathsf{Commit} \to (\mathsf{Rollback})$$

Simulation-before-commitment makes external effects governed by the same surface as internal beliefs — one governance vocabulary for thought and deed (D3).

---

## Part 9 — Key Properties of the Construction

**P1 — Unified audit.** Because transactions, programs, commits, and scheduler decisions are all labeled transitions of one coalgebra, a single query language answers: which stimulus caused this belief · which judge admitted it · which price enabled it · which program was running · which budget refusal degraded it · which learning episode changed the strategy. Causal observability (C2) is total by construction.

**P2 — Anytime everything.** The writer monad plus reservation means every operation has a cost-so-far; interruption is a coalgebra morphism into the truncated behavior — partial results are legitimate states, not exceptions. Boundedness (A4) is denotational, not disciplinary.

**P3 — Degradation as movement, not exception.** Model unavailable → judgment budget reprices → symbolic judge wins the market. Memory pressure → forgetting transactions outbid derivations. Contradiction detected → repair program selected by the meta-controller. Every degradation is a scheduler event with a reason — inspectable, replayable, improvable (C3).

**P4 — Adaptivity with a ceiling.** The controller can learn to schedule, reprice, and restructure — up to the level of program edits — but every adaptation is a proposal in a well-founded hierarchy with an external top. The system approaches recursive self-improvement asymptotically without ever reaching self-approval (C1, anti-goal A7 closed).

**P5 — Modularity by bisimulation.** Every port defines a behavioral contract as a trace-map fragment. A neural head, a judge ensemble, a memory backend, an exact engine may each be replaced by any implementation with the same trace image — and *equivalence is checkable* via replay and drift tests, not asserted (D5).

**P6 — Economic grace.** The quantale economy replaces quota exhaustion with pricing: nothing is ever “silently out of budget”; it is *outbid*, and the outbidding is an event with a utility estimate. AIKR becomes adaptive while remaining total: the global budget still binds; only its allocation moves.

---

## Part 10 — Incremental Construction Sequence (C4)

The specification builds in five phases, each a closed, coherent system satisfying the full constitution:

| Phase | Deliverable | What it adds |
|---|---|---|
| **0 — Kernel** | Types, grade checker, event fold, commit ledger, budget office, gates | F1–F4, F9 live; the system is already a complete bounded audited reasoner with fixed programs |
| **1 — Declarative control** | KAT program object, stage-graph compiler, program registry, hot-swap at boundaries | O3/B1: control becomes data; invariants become graph predicates |
| **2 — Economy** | Reservation/settlement, pricing, market scheduler, budget transfers | O4/B5: quotas become prices; starvation becomes typed refusal |
| **3 — Correlation & control-plane sourcing** | Correlation fibers, scheduler/control events in the ledger | O2 at full depth; pays back all auditability spent in phases 1–2 |
| **4 — Meta-controller & portfolio** | Control-plane coalgebra, governed program-edit proposals, heterochronous tower | O6/D6: the system infers and proposes its own control improvements, one approval level above itself |

Each phase preserves every axiom of the constitution; no phase requires replacing a prior phase’s runtime — only wrapping it in the next categorical layer.

---

## Part 11 — Formal Summary

A reasoner, in final form, is the tuple

$$\boxed{\mathcal{R} = \big\langle\; \underbrace{(\Sigma,\chi)}_{\text{graded types}},\;\; \underbrace{(S,\xi,s_0)}_{\text{pointed }F\text{-coalgebra}},\;\; \underbrace{\mathsf{Q}}_{\text{resource quantale}},\;\; \underbrace{\mathsf{Prog}}_{\text{KAT programs}},\;\; \underbrace{\sigma}_{\text{scheduler}},\;\; \underbrace{\mathsf{commit}}_{\text{ledger}},\;\; \underbrace{\pi}_{\text{policy surface}},\;\; \underbrace{(\mathcal{F}_\bullet,\mathcal{F}_{\mathrm{ext}})}_{\text{authority filtration}},\;\; \underbrace{\tau}_{\text{trace semantics}} \;\big\rangle}$$

subject to the constitution F1–F10, where:

- **what it thinks** is a graded type system with evidence-sensitive truth and tolerant contradiction;
- **how it changes** is a coalgebra of fully-labeled, budget-decorated transitions;
- **what it does next** is an element of a Kleene algebra, selected by a transparent market;
- **what it may keep** is whatever survives one commit pipeline under one ledger;
- **what it may become** is whatever survives a well-founded approval tower whose top it does not own;
- **what it is, behaviorally** is the unique point its trace map selects in the final coalgebra of all possible provenances.

The design is complete in the sense that every design objective has a denotation, every hard constraint has an axiom, every anti-goal has a closed channel, and every component has a replacement criterion. It is self-contained in the sense that nothing outside the specification — no convention, no comment, no out-of-band review — is load-bearing: the firewall is a type discipline, the audit is the coalgebra itself, the bounds are the algebra of resources, and the governance is the well-foundedness of the approval order.
