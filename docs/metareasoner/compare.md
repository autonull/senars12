# Architecture-specification comparison

The uploaded document contains **15 distinct reasoner-architecture specifications**. They are not 15 unrelated architectures; they form several families that progressively change the abstraction level, granularity, and proposed evolution of SeNARS.

## 1. All 15 specifications at a glance

| Spec                    | Core model                         | Dimensions / structure                                                                                          | What it emphasizes                                         | Main architectural move                                                                                             |
| ----------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **space.a.1**           | 7-sort algebra                     | Topology, Gates, Budgets, Strategies, Valuation, Memory, Policy                                                 | Complete coordinate system for reasoners                   | Treat SeNARS as one point in a product/fiber-product design space                                                   |
| **space.a.2**           | **Cognitive Control Algebra**      | L0 substrate → L4 adaptation + provenance                                                                       | Algebraic laws, KAT control words, homeostasis, governance | Replace fixed control flow with algebraic control words; make invariants structural                                 |
| **space.a.3**           | Free many-sorted algebra           | Stage, Gate, Budget, Strategy, Memory, Event, Loop + configuration space                                        | Compositionality and executable semantics                  | Stage graph, semantic function, composition/restriction/refinement/lifting                                          |
| **space.a.4**           | Universal 7-tuple                  | Ontology, Dynamics, Valuation, Scheduling, Bounding, Trust, Reflexivity                                         | Generality across reasoner types                           | Identifies scheduling/control as the most constrained SeNARS dimension                                              |
| **space.a.5**           | Reflexive controller + 8 axes      | State, inference, control graph, budgets, admission, reflexivity, policy, etc.                                  | Explicit control-theoretic tradeoffs                       | SeNARS⁺ moves toward more adaptive control while retaining safety/provenance                                        |
| **space.b.1**           | 6-component control skeleton       | State, Operators, Policy, Gates, Budget, Adaptation                                                             | **Control policy π** as the central bottleneck             | “Guarantee conservation”: dynamic control requires compensating provenance/safety                                   |
| **space.b.2**           | Controlled transition system       | Work substrate, Scheduler, Judgment, Trust, Write, Objective, Budget, Time, Provenance                          | Concrete evolution path                                    | **SG → JC → BB → MC**: stage graph → judgment continuum → blackboard → learned controller                           |
| **space.b.3**           | 6D Cognitive Control Manifold      | Epistemic topology, dynamics, resource economics, meta-control, temporal grain, boundary                        | Continuous/dynamical-system view                           | Thermodynamic budgets, continuous strategy manifold, asynchronous event horizon                                     |
| **space.c.1**           | 10-tuple control system            | State, observations, operations, controller, governance, budget, verification, learning, failure, observability | **Unified control plane**                                  | Every cognition becomes a typed transaction passing through proposal → verification → commit                        |
| **control.space.a**     | **12-axis RDS**                    | ε ρ σ ι κ ψ β λ α γ φ π                                                                                         | Compact ordinal “genome” of architecture                   | A concise comparative coordinate vector for SeNARS                                                                  |
| **control.space.b**     | **37-dimensional reference model** | A–G groups + declared/realized coordinates + wiring mask                                                        | **Implementation realism**                                 | Distinguishes what SeNARS claims from what is actually wired, gated, partial, dormant or dead                       |
| **control.space.c**     | 23-axis reference + 3 planes       | Semantics, Resources, Provenance, Trust, Control, Self-reference                                                | Feasibility and guarantee structure                        | Positions SeNARS near a high-guarantee corner and formalizes inter-axis constraints                                 |
| **information.space.a** | 10-axis conceptual model           | Substrate, inference/control, trust/resources, adaptation/governance                                            | **Coupling constraints** Ψ                                 | Explicitly models laundering, reward hacking, boundedness, self-modification and verifier-independence constraints  |
| **information.space.b** | **29-axis technical inventory**    | Semantic, control, resource, provenance, epistemic, learning, governance, coupling                              | Maximum feature resolution                                 | Fine-grained registry of almost every architectural decision and its compatibility rules                            |
| **information.space.c** | **20-axis DSR**                    | Knowledge, Inference, Control/Resources, Learning, Trust/Provenance/Governance                                  | Normalized technical reference                             | Compact but rigorous space with feasibility predicate, reference points and distance/movement operators             |

---

# 2. The major families are doing different jobs

### A-series: build the algebra

The **space.a.*** specifications progressively formalize the same idea.

**a.1** is the broadest initial coordinate chart: seven sorts and a product/fiber-product view.

**a.2** makes control flow mathematically explicit with a **Kleene Algebra with Tests (KAT)** and introduces algebraic laws such as gate orientation, resource monotonicity, provenance fidelity, anytime boundedness, and governed self-modification.

**a.3** turns that into something closer to an executable meta-architecture: a free algebra whose configurations can be composed, restricted, refined and evaluated.

**a.4** abstracts further into a universal control model: what exists, how it changes, how it is valued, what runs next, what limits it, what is trusted, and whether it can modify itself.

**a.5** then uses those axes to explicitly design a more adaptive SeNARS rather than merely describing the existing one.

So the A-series is essentially:

> **coordinate system → algebraic laws → compositional semantics → universal control abstraction → redesign**

---

### B-series: decide how SeNARS should evolve

The B-series is less concerned with cataloguing everything and more concerned with **where to move**.

`space.b.1` makes the central insight that the decisive variable is the scheduler/control policy `π`, and that increased scheduling freedom has to be paid for with stronger guarantees such as provenance. 

`space.b.2` is the clearest **architectural roadmap**. It explicitly defines four candidate points:

**SeNARS → SeNARS-SG → SeNARS-JC → SeNARS-BB → SeNARS-MC**

where:

* **SG** = conditional stage graph
* **JC** = judgment continuum
* **BB** = unified claim queue / blackboard
* **MC** = learned meta-controller

The document recommends this progression rather than jumping directly to a learned scheduler. 

`space.b.3` is the most speculative of the B-series. It replaces discrete architectural parameters with continuous/dynamical concepts such as temperature, free-energy-like resource allocation, continuous strategy vectors, and an asynchronous event horizon. 

---

### C1: synthesize everything into one runtime architecture

`space.c.1` goes beyond “design space” and proposes a concrete **SeNARS⁺ Cognitive Control Plane**.

Its key idea is:

> **Every cognitive operation is a typed transaction.**

A transaction declares its inputs, outputs, effects, budget reservation, capabilities, trust, risk, reversibility, fallback and proof obligations. The architecture then replaces heterogeneous mutation paths with a **single commit ledger**. 

It also adds a richer resource economy, governance profile, unified epistemic type system, meta-controller, governed learning, simulation-before-action, rollback, and causal provenance. 

This is the most ambitious **target architecture**, rather than merely a coordinate model.

---

# 3. The Control-space family changes resolution rather than philosophy

The three `control.space.*` documents are best viewed as different resolutions of the same design-space idea.

### `control.space.a` — compact genome

It compresses the architecture into **12 ordinal axes**, each scored 0–3, producing a compact genome:

`ε3 ρ3 σ3 ι3 κ3 ψ3 β3 λ3 α3 γ3 φ2 π3`.

This is useful for comparing architectures quickly. 

### `control.space.b` — implementation audit

This is the most valuable specification for distinguishing **architecture-on-paper from architecture-in-code**.

It introduces:

* 37 dimensions
* declared coordinate `r°`
* realized coordinate `r*`
* wiring mask `ω`
* realization gap `Δ`

That means an architecture can explicitly say “full gate coverage,” while the implementation can be recorded as only partial. 

This is a significant improvement over the earlier specs because it can represent **unfinished seams**, not just idealized architecture.

### `control.space.c` — formal reference point

This compresses again into a ~23-axis model grouped into six major planes and explicitly defines feasibility constraints. It is a cleaner formal reference than the 37-dimensional version while retaining coupling laws. 

---

# 4. The information-space family focuses on constraints

### `information.space.a`

This is the strongest **conceptual constraint model**.

Its important contribution is that the design space is **not a free Cartesian product**. Some combinations are structurally invalid:

* neural/high-uncertainty inference without calibrated trust → evidence laundering
* reward learning + fused beliefs/goals → reward hacking/sycophancy
* self-modifying code without external governance → unsound self-approval
* independent verification requires code separation
* exact equality cannot be conflated with uncertain similarity 

### `information.space.b`

This is the **most exhaustive inventory**: 29 axes covering representation, truth, inference, scheduler, attention, budgets, forgetting, provenance, verification, trust calibration, learning, governance, LM coupling, judgment, environment and transports. 

It is effectively the detailed implementation/configuration registry.

### `information.space.c`

This is a more normalized reference with 20 axes and five clusters:

**Knowledge → Inference → Control/Resources → Learning → Trust/Provenance/Governance**

Its main value is that it combines the inventory with feasibility rules, reference architectures, coordinate notation, movement operators and distance in the design space. 

---

# 5. Where the specifications agree

Despite the different formalisms, there is strong convergence.

| Architectural question                     | Consensus across specs                                                                                                 |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **What is the fundamental object?**        | A reasoner is a bounded controlled dynamical/transition system, not merely a NAL engine.                               |
| **What distinguishes SeNARS?**             | Strong symbolic substrate + uncertainty + bounded resources + trust boundaries + provenance + adaptation.              |
| **Biggest rigidity?**                      | The **hard-coded control/stage sequence**.                                                                             |
| **Most important safety property?**        | Belief/goal separation and the **reward → truth firewall**.                                                            |
| **Most important state-control property?** | A tightly controlled mutation/commit path.                                                                             |
| **Most important boundedness property?**   | AIKR: explicit budgets, forgetting/decay, interruption/anytime behavior.                                               |
| **Most important audit property?**         | Event sourcing + replay + independent verification.                                                                    |
| **Preferred evolution?**                   | Make control flow data-driven before making the scheduler learned.                                                     |
| **Role of LM/neural components?**          | Prefer **untrusted proposers + trusted symbolic/verification layer** rather than putting the LM in the epistemic core. |
| **Self-modification?**                     | Must remain governed, shadow-tested, and progressively authorized.                                                     |

---

# 6. The important disagreements

There are several **real specification inconsistencies**, not just differences in emphasis.

### 1. How many loops does SeNARS have?

The specifications use different descriptions:

* `space.a.1`: **3 nested loops** — A, B, C.
* `space.a.3`: `{macro, micro, inference}`.
* `space.a.5`: **two nested loops plus a third inner inference generator**.
* Some later specifications describe the system as macro → micro plus an inference generator rather than a literal third architectural loop.

So “3 loops” and “2 loops + inner generator” are not necessarily contradictory semantically, but the documents do **not use a consistent loop ontology**.

### 2. Is SeNARS's scheduler fixed or already adaptive?

The answer depends on what is being called “scheduler.”

The earlier control models say the **stage scheduler is fixed**: `perceive → attend → reason → authorize → propose → learn`.

Other specifications give SeNARS a higher control score because its **internal attention/premise sampling** already uses priority bags, focus structures and adaptive strategy slots.

Thus:

> **Outer control topology = rigid; inner selection mechanisms = adaptive.**

That distinction should be made explicit in any consolidated specification.

### 3. Are there really four gates on every mutation path?

The idealized models describe a strongly gated system, while `control.space.b` explicitly introduces **declared vs realized** coordinates and records partial/dormant seams. 

Therefore, the later implementation-oriented model is more precise for answering “what does the current implementation actually guarantee?”

### 4. How many budget dimensions are current?

The core specifications consistently describe **four primary dimensions** and six per-cycle scopes.

The richer SeNARS⁺ proposal expands this to dimensions such as tokens, latency, attention, risk and human attention. That is a **proposed extension**, not the same current budget model. 

### 5. Is trust a discrete asymmetry or a continuum?

Two competing models appear:

* Earlier specifications: **ingress fail-closed / egress fail-open** is a defining architectural asymmetry.
* `SeNARS-JC`: this becomes a **judgment budget/continuum** whose operating point depends on available judgment resources. 

This is a genuine architectural choice, not just notation.

### 6. Is self-modification “implemented” or merely specified?

Several compact coordinate systems place SeNARS near the maximum of self-modification/governance. The 37-axis `control.space.b` model is more conservative because it explicitly distinguishes **wired, gated, partial, dormant, bench-only and dead** functionality. 

For implementation claims, that later model should take precedence over idealized coordinate scores.

---

# 7. Which specification is strongest for which purpose?

| Purpose                                         | Best specification        |
| ----------------------------------------------- | ------------------------- |
| **Conceptual overview**                         | `space.a.1`               |
| **Most elegant formal algebra**                 | `space.a.2`               |
| **Compositional/executable semantics**          | `space.a.3`               |
| **Universal reasoner taxonomy**                 | `space.a.4`               |
| **Control-theoretic analysis**                  | `space.a.5` / `space.b.1` |
| **Concrete evolution roadmap**                  | **`space.b.2`**           |
| **Continuous/dynamical alternative**            | `space.b.3`               |
| **Concrete future architecture**                | **`space.c.1`**           |
| **Compact architecture “genome”**               | `control.space.a`         |
| **Implementation-vs-specification audit**       | **`control.space.b`**     |
| **Formal feasibility/reference coordinates**    | `control.space.c`         |
| **Conceptual coupling/safety constraints**      | `information.space.a`     |
| **Exhaustive architectural inventory**          | **`information.space.b`** |
| **Normalized technical design-space reference** | **`information.space.c`** |


----




### The `space.a.*` Series (Algebraic & Control-Theoretic)
1. **`space.a.1.md`**: Defines the reasoner as a fiber product of **7 Sorts** (Topology, Gates, Budgets, Strategies, Valuation, Memory, Policy).
2. **`space.a.2.md`**: Uses **Kleene Algebra with Tests (KAT)** to model the control flow as an inspectable "control word" ($\kappa$) and defines the Proposer/Judge adjunction.
3. **`space.a.3.md`**: Maps a **Configuration Space $\mathcal{C}$** to behavior via a semantic function to Coalgebras, emphasizing compositionality.
4. **`space.a.4.md`**: The **7-Tuple Control Model** ($\mathcal{K}, \Omega, \mathcal{V}, \pi, \beta, \varepsilon, \mu$), heavily focused on Scheduling ($\pi$) as the primary bottleneck.
5. **`space.a.5.md`**: Defines **8 Axes** of behavior and proposes 8 specific moves (M1–M8) to reach "SeNARS⁺", such as the Heterochronous Loop Tower.

### The `space.b.*` Series (Manifolds & Guarantee Conservation)
6. **`space.b.1.md`**: A 6-tuple model spanning 10 axes, introducing the concept of **Guarantee Conservation** (you cannot gain scheduling flexibility without spending auditability).
7. **`space.b.2.md`**: The **Cognitive Control Model (CCM)** with 9 axes, proposing variants like SeNARS-SG (Stage Graph) and SeNARS-BB (Blackboard).
8. **`space.b.3.md`**: The **6D Cognitive Control Manifold**, proposing shifts toward *Cognitive Thermodynamics* (Free Energy Principle) and Asynchronous Event Horizons.

### The `space.c.*` & `control.space.*` Series (Transactions & Genomes)
9. **`space.c.1.md`**: Reframes all cognition as **Cognitive Transactions** passing through a Unified Commit Ledger.
10. **`control.space.a.md`**: The **12D Genome** ($\epsilon, \rho, \sigma, \iota, \kappa, \psi, \beta, \lambda, \alpha, \gamma, \phi, \pi$) for compactly encoding reasoner architectures.
11. **`control.space.b.md`**: The massive **37-Dimensional Space ($\mathcal{R}$)**, uniquely identifying the "wiring seams" (Declared vs. Realized gaps) in SeNARS's current codebase.
12. **`control.space.c.md`**: A 20-axis model across 6 clusters, focusing heavily on **Feasibility Constraints $\Phi(r)$** (which combinations of axes are mathematically stable).

### The `information.space.*` Series (Coupling Constraints & Projections)
13. **`information.space.a.md`**: A 10-axis, 4-layer model focused on **Coupling Constraints $\Psi$** (e.g., the Laundering Constraint, the Reward-Hacking Constraint).
14. **`information.space.b.md`**: A highly granular **29-Axis Technical Reference** (A1–A29) detailing exact SeNARS coordinates vs. alternatives.
15. **`information.space.c.md`**: The **DSR (Design Space of Reasoners)** with 20 axes across 5 clusters (K, I, C, L, A) and 12 hard feasibility constraints.



