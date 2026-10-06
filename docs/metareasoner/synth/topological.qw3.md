# The Cognitive Fibration ℱ
## A Topological Specification for Bounded, Governed, Adaptive Reasoners

---

## §0 — Charter

### 0.1 Governing selection

| Category | Selection | Rationale |
|---|---|---|
| **Prime objectives** | **O1** epistemic integrity · **O2** causal provenance · **O3** control-plane fluidity · **O4** resource economics · **O8** unified commit ledger | These five jointly force a geometric structure: integrity is a *grading*, provenance is a *covering*, control is a *path space*, economics is a *simplex*, commit is *sheaf gluing*. |
| **Hard constraints** | **H1** firewall · **H3** event-totality · **H4** no self-approval · **H5** no unbounded path | Taken as the four axioms **G1–G4**. Constraints H2, H6, H7, H8, H9, H10 become **derived theorems**, not additional machinery (§11). |
| **Anti-goals** | **A2** scheduler opacity · **A4** audit bloat · **A5** monolithic LM authority | Resolved structurally: the scheduler lives *inside* the covered base complex (§6); the covering is finite-sheeted over bounded executions (§6.4); neural substrates inhabit a sheet with no quotient authority (§8). |
| **Character bias** | **D3** unification as primary; **D1** auditability and **D6** adaptivity reconciled by the covering structure — *adapt freely on the base, remain deterministic on the cover*; **D5** via typed ports everywhere. |

### 0.2 Master thesis

> A reasoner is a **flow of typed transactions over a stratified base complex**, carrying four bundles — epistemic, resource, transactional, governmental — whose mutation is **sheaf gluing through one commit cell**, whose history is a **covering space with unique path lifting**, and whose bounds are the **compactness of its resource body**.

Every safety property is a topological invariant; every capability is a move within the space that preserves the invariant.

### 0.3 Geometry ↔ cognition legend

| Geometric object | Cognitive meaning |
|---|---|
| 0-cells of the base complex 𝒞 | stages (cognitive operations) |
| 1-cells of 𝒞 | guarded transitions (control steps) |
| 2-cells of 𝒞 | coherence laws (which reorderings are equivalent) |
| Paths in 𝒞 | control programs (KAT terms) |
| Path homotopy | safe reconfiguration equivalence |
| Fundamental groupoid Π₁(𝒞) | the program algebra |
| Commit cell ★ | the single commit authority |
| Fiber of ℰ | epistemic attitudes (belief/goal/question) at a state |
| Connection on ℰ | evidence revision along derivations |
| Holonomy | evidence dependence — forced trivial on the evidence cover |
| H¹ of the epistemic sheaf | retained contradictions (paraconsistency) |
| Sections of ℬ | budget allocations |
| Compact polytope Π | AIKR — boundedness *is* compactness |
| Faces of Π | degradation modes |
| Simplex Δⁿ | allocation market |
| Prices | cotangent covectors (dual of consumption) |
| Sheaf gluing | commit |
| Covering map p : ℰᵥ → 𝒞 | provenance / replay |
| Unique path lifting | deterministic replay |
| Sheets of the cover | correlation threads |
| Filtration 𝒢 | governance authority levels |
| No-retraction | no self-approval |
| Stratified cube 𝓜_g | trust–risk–reversibility policy |
| Adjunction propose ⊣ admit | proposer/judge boundary |

---

## §1 — The Base Complex 𝒞 (control topology)

### 1.1 Definition

The **control topology** is a finite, typed, directed 2-complex:

```
𝒞 = ( V, E, R, ℓ, ★ )
  V  — 0-cells (stages), typed: cognitive | meta | governance | resource
  E  — 1-cells (transitions) e : v → w with guard gₑ : Ctx → {0,1}
  R  — 2-cells: rewrite relations on paths (sequencing associativity,
       choice distribution, loop unrolling, commute diamonds)
  ℓ  — typing labelling V and E
  ★  — the distinguished commit cell
```

### 1.2 Program algebra

Control programs are elements of the **Kleene algebra with tests** over 𝒞:

$$\kappa ::= v \mid \kappa_1 \cdot \kappa_2 \mid \kappa_1 + \kappa_2 \mid \kappa^* \mid p?\cdot\kappa \mid 1 \mid 0 \qquad \text{modulo the 2-cell relations } R$$

Programs are therefore **paths up to homotopy**: `Π₁(𝒞, R)` — the fundamental groupoid of the complex modulo its 2-cells. Control flow is *data*: a program is a finitely representable element of this algebra, loadable, versionable, diffable, revertable.

### 1.3 Law of the commit cell

**★ is a cut-point of the mutation region.** Every path from a write-bearing stage to a state change factors through ★:

$$\forall \text{ write-bearing } v:\quad \text{Path}(v, \text{state}) \;=\; \text{Path}(v, ★)\cdot\text{Path}(★, \text{state})$$

This is **single commit authority (A2)** stated topologically — not as a code convention but as a property of the complex checked once against the graph.

### 1.4 Well-formed programs

A program κ is **well-formed** iff:
1. **closed** — no free tests;
2. **bounded** — every `κ*` carries a finite unwinding witness (budget certificate, §3);
3. **commit-respecting** — all write effects route through ★;
4. **graded** — every subpath respects the epistemic grading (§2.3).

Well-formedness is decidable on the finite complex.

---

## §2 — The Epistemic Bundle ℰ (truth geometry)

### 2.1 Fibers

Over each cognitive state x, the fiber is a graded product:

$$\mathcal{E}_x \;=\; \underbrace{B_x \times Q_x}_{\text{epistemic grade}} \;\times\; \underbrace{G_x}_{\text{teleological grade}}$$

- Beliefs carry two-dimensional evidence-sensitive values $(f, c) \in [0,1]^2$;
- Goals carry $(d, c)$; questions carry priority + expected information gain;
- the grading map $\gamma : \mathcal{E} \to \{\textsf{epistemic}, \textsf{teleological}\}$ is globally defined and preserved by every cognitive map.

### 2.2 Revision as connection

Evidence revision is a **connection** ∇ on ℰ: transporting a truth value along a derivation edge applies the revision operator. The **evidence cover** $\widehat{\mathcal{E}}$ is the cover on which each evidence item appears exactly once (the lineage DAG unfolded). The governing law:

> **Flatness on the evidence cover.** ∇ is flat (holonomy-trivial) on $\widehat{\mathcal{E}}$: transporting evidence around any cycle yields no additional accumulation.

Double-counting is precisely **nontrivial holonomy**; the evidence-independence check at commit is the test that a candidate section descends from the flat cover. Evidence laundering is thereby impossible by construction.

### 2.3 The firewall as a structure-group decomposition (Axiom G1)

The structure group of ℰ decomposes:

$$\mathrm{Struct}(\mathcal{E}) \;=\; \mathrm{Struct}_{\textsf{ep}} \times \mathrm{Struct}_{\textsf{tel}}, \qquad \mathrm{Struct}_{\textsf{tel}} \text{ acts trivially on } B_x$$

Reward, desire, and utility are sections of the teleological factor; they may act on **priority** (the attention section) and **policy weights**, never on $(f,c)$. The firewall is not a rule enforced at runtime — it is the statement that certain maps do not exist in the bundle category.

### 2.4 Paraconsistency as cohomology

A retained contradiction $\{\varphi, \neg\varphi\}$ with distinct truth values is a **non-trivial Čech 1-cocycle** of the epistemic sheaf. The system neither explodes (quotients nothing) nor ignores (the class is structured data). Define:

$$\mathrm{Contradictions}(x) \;=\; H^1(\mathcal{E}|_{\text{neighborhood of } x})$$

Contradiction classes carry truth-graded coefficients, decay under consolidation flows, and are queryable first-class objects. Global consistency is the vanishing of $H^1$ — an *asymptote*, never a precondition.

---

## §3 — The Resource Sheaf ℬ (economic geometry)

### 3.1 The resource body

AIKR is the statement that all resource bodies are **compact**:

$$\Pi \;=\; \prod_{i=1}^{d} [0,\, \mathrm{cap}_i] \;\subset\; \mathbb{R}^{d}_{+} \qquad \text{(a compact convex polytope)}$$

Dimensions include cycles, derivations, premises, memory operations, LM calls, tokens, latency, attention, risk quota, human-attention quota. **Every execution path has a cumulative consumption trajectory entirely inside Π.** This is Axiom **G4**; unbounded reasoning is not forbidden — it is *not a path in the space*.

### 3.2 Sheaf of budgets

ℬ is a sheaf of ordered commutative monoids over 𝒞:

- a **budget scope** is a section over an open region of 𝒞;
- **restriction maps** are reservations (reserve before execute, settle after);
- **open-once reset** is the gluing law for per-cycle sections;
- **transfer** between scopes is a section-preserving map, event-typed, total-budget-preserving:
$$\mathrm{transfer}(s_i, s_j, a):\quad s_i - a,\; s_j + a, \qquad \sum_k s_k \text{ invariant}$$

### 3.3 The market simplex

Active foci/scopes bid for allocation; allocations are points of the **budget simplex**:

$$\Delta^n = \Big\{ x \in [0,1]^n \;\Big|\; \sum_i x_i = 1 \Big\}$$

The market solves, at each clearing:

$$x^{*} \;=\; \arg\max_{x \in \Delta^n} \; \sum_i u_i(x_i) \;-\; \lambda\,\mathrm{cost}(x), \qquad x_i \propto \exp\!\big(u_i / T\big)$$

- $u_i$ — expected marginal cognitive utility (epistemic gain + goal progress + homeostatic relief);
- $T$ — **cognitive temperature**, coupled to drives: curiosity raises $T$ (exploration), coherence lowers it (exploitation);
- **prices are covectors** $p \in (\mathbb{R}^d)^{*}$ — the dual picture: consumption is a vector, budgets are the linear functionals bounding it, and pricing is the duality pairing $\langle p, c \rangle$.

Scarcity is therefore not a counter but a **geometry**: exhaustion is contact with $\partial\Pi$; allocation is a point in a simplex; value is a covector.

### 3.4 Degradation as faces

Each **face** of Π is a named degradation mode:

| Face | Mode |
|---|---|
| $[\text{LM calls} = 0]$ | symbolic-only |
| $[\text{latency} = \text{cap}]$ | reflex-fast |
| $[\text{risk quota} = 0]$ | observe-only |
| $[\text{derivations} = 0]$ | abstain-and-ask |

The flow **retracts onto a face** when the interior is exhausted — graceful degradation (C3) is a retraction in the resource topology, never a crash, never silent: every contact with $\partial\Pi$ is a typed event (§6).

---

## §4 — The Transaction Sheaf 𝕋 (unified cognition)

### 4.1 Transactions

Every unit of cognition — perception, attention, retrieval, inference, proposal, judgment, commit, action, learning, forgetting, consolidation, simulation, self-modification — is a **local section of 𝕋**, i.e. a typed transaction:

```
Transaction {
  id            : TxId
  correlation   : SheetId                  // which sheet of the cover (§6)
  kind          : CognitiveKind
  grade         : epistemic | teleological | mixed-tagged
  inputs        : CognitiveObject[]
  outputs       : Candidate[]
  effects       : EffectDeclaration[]      // read-set, write-set, capability needs
  reservation   : Section(ℬ)               // budget reservation
  trust         : τ ∈ [0,1]                // point of 𝓜_g (§7)
  risk          : ρ ∈ [0,1]
  reversibility : r ∈ [0,1]
  proofObligations : ProofObligation[]
  fallback      : FaceOf(Π)                // degradation face on failure
}
```

Transactions compose by the **stage operad**:

$$\triangleright \text{(sequential)} \quad \triangleleft_g \text{(conditional)} \quad \parallel \text{(parallel)} \quad {}^{*} \text{(bounded iteration)} \quad \hookrightarrow \text{(nested scope)}$$

### 4.2 Commit is gluing

𝕋 is a **sheaf**, and the commit ledger is its gluing map. Given transactions $\{t_i\}$ over a cover $\{U_i\}$ of the current cycle region:

$$t_i|_{U_i \cap U_j} \sim t_j|_{U_i \cap U_j} \;\;\forall i,j \qquad\Longrightarrow\qquad \exists!\, t \text{ over } \bigcup_i U_i$$

where compatibility $\sim$ is the conjunction of:

1. **type agreement** — epistemic grades match;
2. **firewall check** — no teleological section touches an epistemic fiber (G1);
3. **evidence independence** — the candidate lifts to the flat evidence cover (§2.2);
4. **budget feasibility** — reservations sum inside Π (G4);
5. **verification** — proof / calibrated judge / simulation portfolio discharges the proof obligations.

**Existence and uniqueness of the glued section is exactly single-commit authority.** Rejection is a typed event, never silence.

### 4.3 The commit pipeline (the star of ★)

```
Candidate
  → normalize → typecheck → grade-check (G1)
  → evidence-cover lift (independence)
  → verification portfolio (proof ⊕ judge ⊕ simulation)
  → 𝓜_g classification (trust, risk, reversibility, blast radius)
  → budget settlement
  → GLUE at ★ → append event → fold state
```

---

## §5 — The Governance Filtration 𝒢 (stratified authority)

### 5.1 The filtration

Authority is a **filtration of the complex**:

$$\varnothing = \mathcal{C}_{-1} \;\subset\; \mathcal{C}_{0} \;\subset\; \mathcal{C}_{1} \;\subset\; \cdots \;\subset\; \mathcal{C}_{5} = \mathcal{C}$$

| Stratum | Authority | Examples |
|---|---|---|
| 𝒞₀ | observe | telemetry, analysis |
| 𝒞₁ | propose | any candidate, including self-mod proposals |
| 𝒞₂ | sandbox execute | shadow runs, simulated actions |
| 𝒞₃ | auto-commit low-risk | attention weights, strategy slots |
| 𝒞₄ | approved production | rule induction, governed patches |
| 𝒞₅ | constitution | firewall, gluing law, covering, filtration itself |

### 5.2 Law of upward generation

An operation at stratum k is **authorized only by a section generated in $\mathcal{C}_{k+1} \setminus \mathcal{C}_{k}$**. The constitutional stratum 𝒞₅ has **no internal generators**: its approvers are external and immutable.

### 5.3 No fixed point of authority (Axiom G3)

> There exists no admissible approval section for a stratum-k commit that is produced by a stratum-k map.

This is the Löbian core stated topologically — the analogue of the no-retraction theorem: a bounded reasoner cannot continuously retract its governing boundary onto itself. Self-modification at every level is *propose-don't-apply*; application is always an upward-generated section. Changes to 𝒞₅ are not expressible from within the system.

---

## §6 — The Provenance Covering 𝒫 (audit geometry)

### 6.1 Definition

Provenance is a **covering map**:

$$p : \mathcal{E}_v \longrightarrow \mathcal{C}$$

where $\mathcal{E}_v$ is the **event complex**: 0-cells are typed events (`admit`, `derive`, `charge`, `transfer`, `commit`, `veto`, `fault`, `reconfigure`, `degrade`…), 1-cells are causal edges, 2-cells are correlation coherences, and p sends each event to the stage/transition that produced it.

### 6.2 The lifting laws

| Property | Geometric statement | Cognitive consequence |
|---|---|---|
| **Deterministic replay** | paths in 𝒞 lift uniquely given a start point | state reconstructable from the event fold |
| **Correlation** | a correlationId selects a **sheet** (component of the lifted execution) | "which stimulus caused this belief" is a sheet query |
| **Control auditability** | scheduler decisions are 1-cells of 𝒞, hence covered | every *why-it-reasoned-that-way* is an event |
| **Verifier independence** | the checker is defined purely on the combinatorics of $\mathcal{E}_v$ | verification shares no dynamics with the engine |
| **Causal DAG** | sheets are simply connected | conclusions and their control histories are joinable |

### 6.3 Replay and verification

$$\mathrm{replay} : \mathcal{E}_v|_{\text{sheet}} \to \mathrm{State}, \qquad \mathrm{hash}(\mathrm{replay}(s)) = \mathrm{hash}(\mathrm{recorded}(s))$$

The standalone verifier checks **path well-formedness in the cover**: typed event sequences, truth-table agreement (transcribed from the specification, drift-pinned), gluing coherence — reading only covering data.

### 6.4 Finiteness — audit without bloat

By G4 every execution is bounded; therefore **the covering is finite-sheeted over bounded executions**. Audit cost is proportional to executed work, not to the universe of possible work. This dissolves the auditability/performance antinomy: the log is a covering of the bounded path, never of an unbounded space.

---

## §7 — The Trust–Risk–Reversibility Manifold 𝓜_g

### 7.1 The policy body

$$\mathcal{M}_g \;=\; [0,1]^3_{(\tau, \rho, r)} \;\times\; \{\text{blast radius}\} \;\times\; \{\text{proof status}\}$$

stratified into commit-path regions:

| Trust τ | Risk ρ | Reversibility r | Commit path |
|---|---|---|---|
| high | low | high | auto-commit |
| high | medium | high | shadow-commit → promote |
| medium | low | high | provisional commit with decay |
| medium | medium | medium | review stratum |
| any | high | low | strong proof or external approval |
| low | high | low | reject |

### 7.2 Dynamics on 𝓜_g

Every transaction traces a **trajectory** in 𝓜_g from proposal to disposition; gates are cross-sections of this flow. Context-sensitive governance (B6) is the statement that the **stratum**, not the origin, determines the path: an LM proposal, a reflex proposal, a peer proposal, and a self-modification proposal all flow through the same stratified body.

### 7.3 Failure polarity as a section

Fail-closed/fail-open is no longer a hardcoded asymmetry but a **policy section** of the 𝓜_g-bundle: ingress defaults to the closed section, internal cognition to the open-but-tagged section, egress to veto-with-event. The section is data, governable, and every evaluation of it is an event.

---

## §8 — Substrate Arbiter Geometry (hybrid synergy)

### 8.1 Sheets

The substrate space is a **disjoint union of sheets**:

$$\mathcal{S} \;=\; S_{\textsf{symbolic}} \;\sqcup\; S_{\textsf{exact}} \;\sqcup\; S_{\textsf{neural}} \;\sqcup\; S_{\textsf{heuristic}}$$

- $S_{\textsf{symbolic}}$: non-axiomatic term algebra with $(f,c)$ truth;
- $S_{\textsf{exact}}$: dependent-type / equality-saturation substrate;
- $S_{\textsf{neural}}$: embeddings, calibrated heads, language-model proposers;
- $S_{\textsf{heuristic}}$: reflexes, samplers, local search.

### 8.2 The arbiter law

All inter-sheet maps factor through the **propose–admit adjunction**:

$$\mathsf{propose} \;\dashv\; \mathsf{admit}, \qquad \eta : \mathrm{id} \to \mathsf{admit}\circ\mathsf{propose}$$

The unit η is the **judgment gap** — the calibrated measure of how much of a proposal survives judgment. Tightening η is pure symbolism; loosening it is neural enrichment; the dial is continuous and governed.

### 8.3 Monodromy prohibition (exact-sheet purity)

> **No quotient of $S_{\textsf{exact}}$ is induced by similarity morphisms from $S_{\textsf{neural}}$.**

Identifications in the exact sheet are generated solely by certified equalities. An uncertain similarity, transported around an exact computation, would produce nontrivial holonomy the exact sheet cannot support — such transports are rejected at the arbiter boundary. Exact computation is consumed only as **gated oracle results**, i.e. as proposals entering 𝕋.

---

## §9 — The Cognitive Flow Φ (dynamics)

### 9.1 Master equation

$$\frac{d\mathbf{X}}{dt} \;=\; \underbrace{\mathbb{T}(\mathbf{X},\, u)}_{\text{transaction action}} \;-\; \underbrace{\gamma(\mathbf{X},\,T)}_{\text{thermodynamic decay}} \;+\; \underbrace{\mathfrak{B}(\mathbf{I})}_{\text{boundary injection}}$$

- $\mathbf{X}$ — the epistemic state (global section data);
- $u = (\kappa, x^{*}, T)$ — the control triple: program, allocation, temperature;
- $\gamma$ — decay flow governed by cognitive temperature: truth decays only on invalidation, priority decays by access (decoupled);
- $\mathfrak{B}$ — boundary injection filtered through 𝓜_g.

### 9.2 The meta-controller

The scheduler is itself a **bounded transaction generator** inside 𝒞: it reasons about control under its own budget slice, producing *program proposals* $(\kappa', x', T')$ that enter the ordinary gluing pipeline. It may propose; it may not apply. Its deliberation is covered (§6), so learned scheduling is audited scheduling (anti-goal A2 dissolved).

### 9.3 Reconfiguration as homotopy

A hot-swap of control programs is admissible iff:

$$\kappa \simeq \kappa' \quad \text{relative to commit-cell visits and endpoints}$$

Because provenance is a covering, **homotopic programs lift to equivalent event paths** — reconfiguration preserves the provenance type, is reversible, and carries counters and detectors across the boundary. Unsafe reconfigurations are exactly those that change the homotopy class; they are treated as stratum-𝒞₄ self-modifications and governed accordingly.

---

## §10 — The Master Loop

```
while running:
    stimulus        ← boundary.observe()
    sheet           ← mint CorrelationId(stimulus)          // §6: choose lift
    X               ← ledger.fold()                          // state from events

    // — control plane (governed, covered) —
    u               ← metacontroller.select(X, drives, Π)    // (κ, bids, T) proposal
    x*              ← market.clear(bids, Π)                  // §3.3: point of Δⁿ
    κ               ← governance.approve(u, stratum)         // §5: upward-generated

    // — cognitive plane —
    candidates      ← traverse(κ, X, x*, sheet)              // §4: local sections
    judged          ← verify(candidates)                     // proof ⊕ judge ⊕ simulation
    classified      ← 𝓜_g.classify(judged)                   // §7: trust/risk/reversibility

    // — commit plane —
    committed       ← ★.glue(classified)                     // §4.2: sheaf gluing
    actions         ← act.plan(committed, reversibility)     // simulate → authorize → sandbox → confirm
    learning        ← learn.observe(stimulus, committed, actions)
    learning.propose(ledger)                                 // §5: proposals only
    consolidate(X, T)                                        // decay flow
    cover.emit(sheet)                                        // causal trace
```

Every line is a typed transaction or a covered transition; there is no code path outside the complex.

---

## §11 — Axioms and Derived Laws

### 11.1 The four axioms

| ID | Name | Statement |
|---|---|---|
| **G1** | Firewall | The teleological structure group acts trivially on epistemic fibers (§2.3). |
| **G2** | Event-totality | The flow lifts entirely to the provenance covering: every transition — cognitive, control, budgetary, failure — is an event (§6). |
| **G3** | No fixed point of authority | No stratum-k map generates an admissible approval section for stratum-k commits (§5.3). |
| **G4** | Compactness | Every execution trajectory lies in the compact resource body Π; all loops carry finite unwinding witnesses (§3.1). |

### 11.2 Derived theorems

| Constraint | Theorem | One-line proof |
|---|---|---|
| **H2** — no unjudged proposal enters memory | Gluing requires compatibility | By the sheaf axiom, local sections that fail compatibility have no glued extension. |
| **H6** — no opaque scheduler | Scheduler decisions are covered | Scheduling is a 1-cell family of 𝒞; by G2 every transition lifts. |
| **H7** — verifier independence | The checker reads only the cover | The verifier is defined on $\mathcal{E}_v$ combinatorics alone (§6.3). |
| **H8** — no exact unions on similarity | Monodromy prohibition | §8.3: similarity induces no quotient on $S_{\textsf{exact}}$. |
| **H9** — no silent failures | Failures are transitions | Fault is a typed 1-cell of 𝒞; by G2 it lifts to an event. |
| **H10** — irreversible actions authorized | Irreversibility is a stratum of 𝓜_g | The $r \approx 0$ region intersects only the proof/review strata (§7.1). |

**Four axioms generate ten constraints.** The safety surface of the architecture is a small set of topological invariants, not a long list of rules.

---

## §12 — Feasibility Predicate Φ

A configuration $r$ of the fibration is **feasible** iff:

| # | Constraint | Rationale |
|---|---|---|
| Φ1 | ampliative inference ⇒ graded truth values | revision under insufficient evidence is undefined on bivalent carriers |
| Φ2 | contradiction retention ⇒ non-monotonic transport | monotonic chaining detonates retained contradictions |
| Φ3 | untrusted proposers ⇒ judgment gates + cover | ungated proposal flow is privilege escalation without audit |
| Φ4 | learned policy ⇒ firewall at mutation-authority level | reward-learning touching belief truth is the corruption region |
| Φ5 | higher-order expressivity ⇒ fragment bounds | undecidability; search divergence without caps |
| Φ6 | bounded resources ⇒ bounded containers + forgetting | Π compact forces the state body compact |
| Φ7 | self-modification ⇒ upward-generated approval | self-approval is a forbidden fixed point (G3) |
| Φ8 | exact oracle + graded truth ⇒ sheet isolation | equality contamination via similarity holonomy |
| Φ9 | independent verification ⇒ transcribed tables, drift-pinned | co-adapted verifiers hide correlated bugs |
| Φ10 | anytime execution ⇒ preemptive scheduler + partial results | FIFO cannot preempt; the guarantee breaks |
| Φ11 | ambiguous ingress ⇒ multi-candidate + abstention | a single confident parse is calibrated error |
| Φ12 | replayable audit ⇒ pure fold + deterministic cover | non-reproducible audit trails are not audit trails |

---

## §13 — Construction Phases

Each phase yields a **runnable sub-fibration**; each is closed under the axioms already introduced.

| Phase | Deliverable | Geometry built |
|---|---|---|
| **0 — Kernel** | commit cell ★, gluing port, event cover, resource polytope Π, graded truth carrier | the minimal load-bearing core: one complex, one cover, one ledger, one body |
| **1 — Declarative control** | stage graph as data over the dispatch primitive; conditional edges; correlation sheets minted at stimuli | base complex becomes first-class; sheets live |
| **2 — Economic plane** | reservations, market clearing on Δⁿ, transfer lattice, named degradation faces | resource sheaf fully operational |
| **3 — Governed reflexivity** | deliberative meta-controller proposing (κ, x, T) through gluing; homotopy-checked hot-swap at cycle boundaries | control plane becomes adaptive under G3 |
| **4 — Ecological sheets** | peer sheets with mutual-verification protocols; shared calibration digests; capability tokens as sections of the authority bundle | the fibration extends to a bundle of fibrations |

No phase requires replacing a running substrate wholesale: every phase adds structure to the complex, the cover, or the sheaves while prior invariants remain provable.

---

## §14 — Signature Card

$$\boxed{\mathbb{F} \;=\; \big\langle\, \mathcal{C},\; \mathcal{E},\; \mathcal{B},\; \mathbb{T},\; \mathcal{G},\; \mathcal{P},\; \Phi \,\big\rangle}$$

| Component | Identity |
|---|---|
| $\mathcal{C}$ | finite typed 2-complex; KAT program algebra; commit cell ★ as cut-point |
| $\mathcal{E}$ | graded epistemic bundle; revision connection flat on the evidence cover; $H^1$ = retained contradictions |
| $\mathcal{B}$ | sheaf of ordered monoids over 𝒞; compact polytope Π; market on Δⁿ; prices as covectors; faces = degradation modes |
| $\mathbb{T}$ | transaction sheaf; stage operad; commit = gluing |
| $\mathcal{G}$ | six-stratum filtration; upward-generated authority; constitution external |
| $\mathcal{P}$ | provenance covering; unique lifting = deterministic replay; sheets = correlation; finite-sheeted over bounded executions |
| $\Phi$ | cognitive flow; thermodynamic decay; meta-controller as governed proposer; reconfiguration as homotopy |

### Objective compliance

| Requirement | Realized by |
|---|---|
| **A1** epistemic integrity | §2 grading, flat connection, cohomological contradictions |
| **A2** single commit authority | §1.3 cut-point + §4.2 gluing uniqueness |
| **A3** provenance by construction | §6 covering — events precede state, lifting precedes replay |
| **A4** bounded cognition | §3.1 compactness as axiom G4 |
| **B1** declarative control | §1.2 programs as path-algebra elements |
| **B2** adaptive scheduling | §9.2 deliberative meta-controller, covered and budget-sliced |
| **B3** unified transactions | §4 — one sheaf, one gluing law for all cognitive kinds |
| **B4** hybrid synergy | §8 sheets + arbiter adjunction + monodromy prohibition |
| **B5** resource economy | §3.3–3.4 simplex markets, covector prices, face-retractions |
| **B6** context-sensitive governance | §7 stratified 𝓜_g flow |
| **C1** governed adaptation | §5 filtration + G3 |
| **C2** causal observability | §6 sheets: stimulus→cycle→transaction→proposer→judge→proof→budget→failure |
| **C3** graceful degradation | §3.4 face retractions + §7.3 policy sections |
| **C4** incremental implementability | §13 phased construction of closed sub-fibrations |

---

### Closing statement

The design reduces to one sentence:

> **Cognition is the flow of graded transactions over a stratified, compactly-budgeted complex; commitment is sheaf gluing at a single cell; history is a covering with unique lifting; authority is a filtration with no fixed points.**

Everything else — markets, meta-controllers, neural proposers, paraconsistent memory, homotopic reconfiguration — is motion within the space these invariants define.
