# Control Algebra for Reasoner Design Spaces

## 0. Framing

A **reasoner** is a controlled dynamical system whose state space is a structured knowledge base, whose control signals are inference operations, and whose feedback is evidence revision. The space of all such systems forms an algebraic variety. SeNARS occupies one point. This document specifies the coordinate system.

---

## 1. The Sort Signature

A reasoner design $\mathcal{R}$ is a tuple drawn from seven sorts:

$$\mathcal{R} = \langle \mathcal{T},\; \mathcal{G},\; \mathcal{B},\; \mathcal{S},\; \mathcal{V},\; \mathcal{M},\; \mathcal{P} \rangle$$

| Sort | Name | Algebraic Structure | SeNARS Instance |
|------|------|---------------------|-----------------|
| $\mathcal{T}$ | **Topology** | Operad of stage compositions | 3 nested loops, 6+8+3 stages |
| $\mathcal{G}$ | **Gates** | Bounded lattice of admission morphisms | 4 gates, fail-closed ingress / fail-open egress |
| $\mathcal{B}$ | **Budgets** | Commutative monoid with partial order | 4 dimensions × 6 scopes, open-once |
| $\mathcal{S}$ | **Strategies** | Operad with typed slots | 5 slots × N implementations |
| $\mathcal{V}$ | **Valuation** | Evidence algebra (truth monoid) | NAL $(f, c)$ with revision |
| $\mathcal{M}$ | **Memory** | State comonad with decay comonad | Bag\<T\>, concepts, links, episodic |
| $\mathcal{P}$ | **Policy** | Lattice of failure/degradation maps | fail-open egress, fail-closed ingress |

The **design space** is the product:

$$\mathfrak{D} = \mathcal{T} \times \mathcal{G} \times \mathcal{B} \times \mathcal{S} \times \mathcal{V} \times \mathcal{M} \times \mathcal{P}$$

Each axis is itself a structured space. We now specify each.

---

## 2. Sort $\mathcal{T}$: Control Topology

### 2.1 Definition

A control topology is a **typed directed hypergraph** $\tau = (V, E, \ell, \circ)$ where:
- $V$ is a set of **stage nodes**
- $E \subseteq V \times V$ is the **edge set** (control flow)
- $\ell : V \to \text{StageKind}$ labels each node
- $\circ : V^* \to V$ is a **sequential composition** operator (monoid)

Additionally, a topology carries:
- A **nesting depth** function $d : V \to \mathbb{N}$ (which loop owns which stage)
- A **branching structure** at each node: $\beta(v) \in \{\text{linear}, \text{conditional}, \text{parallel}, \text{loop}\}$

### 2.2 The Composition Operad

Stages compose via three operations:

| Operation | Symbol | Meaning |
|-----------|--------|---------|
| Sequential | $s_1 \triangleright s_2$ | Execute $s_1$ then $s_2$ |
| Conditional | $s_1 \triangleleft_g s_2$ | Execute $s_1$ or $s_2$ based on guard $g$ |
| Parallel | $s_1 \parallel s_2$ | Execute concurrently, join |
| Iteration | $s^n$ | Execute $s$ exactly $n$ times |
| Nesting | $s_1 \hookrightarrow s_2$ | $s_2$ runs inside $s_1$'s scope |

These form an **operad**: the collection of all $n$-ary compositions of stages.

### 2.3 SeNARS as a Point in $\mathcal{T}$

$$\tau_{\text{SeNARS}} = \underbrace{(\text{perceive} \triangleright \text{recall} \triangleright \text{reason} \triangleright \text{narrate} \triangleright \text{consolidate} \triangleright \text{act} \triangleright \text{record} \triangleright \text{announce})}_{\text{Loop A: } d=0}$$

$$\hookrightarrow \underbrace{(\text{perceive} \triangleright \text{attend} \triangleright \text{reason} \triangleright \text{authorize} \triangleright \text{propose} \triangleright \text{learn})^n}_{\text{Loop B: } d=1}$$

$$\hookrightarrow \underbrace{(\text{sample} \triangleright \text{prime} \triangleright \text{select} \triangleright \text{derive})^m}_{\text{Loop C: } d=2}$$

**Key topological choices:**
- Loop A: linear chain, 8 nodes, detached async dispatch
- Loop B: `for`-loop, 6 nodes, strictly serial
- Loop C: async generator, 3 nested `for` loops, 7 exits
- Nesting is **one-way** (no up-edge from B→A or C→B)
- `propose` is **detached** (fire-and-forget, no await)

### 2.4 The Neighborhood

| Variation | What changes | Example system |
|-----------|-------------|----------------|
| Flat topology ($d = 0$ only) | No nesting, single loop | Simple ReAct agent |
| Deeper nesting ($d = 3+$) | Meta-reasoning loops | Gödel machine |
| Parallel stages | Concurrent inference paths | MCTS with UCB |
| Conditional stages | Skip stages based on state | Adaptive pipelines |
| Cyclic edges (back-edges) | Iterate until convergence | Fixed-point reasoning |
| Event-driven (no fixed order) | Reactive, stimulus-driven | Blackboard architectures |

---

## 3. Sort $\mathcal{G}$: Gate Algebra

### 3.1 Definition

A gate is a **partial morphism** in the category of cognitive states:

$$g : \text{Candidate} \rightharpoonup \text{Admitted} \cup \text{Rejected}$$

Gates form a **bounded lattice** $(\mathcal{G}, \leq, \wedge, \vee, \top, \bot)$ where:
- $g_1 \leq g_2$ iff $g_1$ admits a subset of what $g_2$ admits (more restrictive)
- $g_1 \wedge g_2$ = conjunction (both must admit)
- $g_1 \vee g_2$ = disjunction (either admits)
- $\top$ = always admit (fail-open)
- $\bot$ = never admit (fail-closed)

### 3.2 Gate Parameters

Each gate $g$ is parameterized by a **policy tuple**:

$$g = \langle \text{domain},\; \text{judge},\; \text{timeout},\; \text{fallback},\; \text{veto\_set} \rangle$$

| Parameter | Type | Range |
|-----------|------|-------|
| domain | enum | {ingress, egress, cycle, tool} |
| judge | $\text{Candidate} \to \text{Verdict}$ | {symbolic, manifold, human, none} |
| timeout | $\mathbb{R}^+$ | ms |
| fallback | enum | {fail-open, fail-closed, degrade} |
| veto_set | $\text{Set}(\text{Candidate})$ | remove-only or add-only |

### 3.3 The Asymmetry Operator

Define the **asymmetry map** $\alpha : \mathcal{G} \to \{0, 1\}^2$:

$$\alpha(g) = (\text{ingress\_policy}, \text{egress\_policy})$$

| $\alpha$ | Meaning | Example |
|----------|---------|---------|
| $(\text{closed}, \text{open})$ | Strict in, permissive out | **SeNARS** |
| $(\text{open}, \text{open})$ | Permissive both ways | Naive chatbot |
| $(\text{closed}, \text{closed})$ | Strict both ways | Formal verifier |
| $(\text{open}, \text{closed})$ | Permissive in, strict out | Hypothesis generator |

### 3.4 SeNARS Point

$$\mathcal{G}_{\text{SeNARS}} = \{\text{PerceptionGate}, \text{BudgetGate}, \text{ActionGate}, \text{RewardGate}\}$$

$$\alpha(\text{PerceptionGate}) = (\text{closed}_{\text{ingress}},\; \text{open}_{\text{cycle}})$$

The **critical asymmetry**: `admitTask` (cycle path) always returns `admitted: true`. The gate is an event emitter and budget deriver, not a filter, on the internal path.

---

## 4. Sort $\mathcal{B}$: Budget Algebra

### 4.1 Definition

A budget algebra is a **commutative monoid with ceiling** $(\mathcal{B}, +, 0, \leq, \lceil \cdot \rceil)$:

- $+$ : consumption accumulation (commutative, associative)
- $0$ : no consumption
- $\leq$ : "fits within" relation
- $\lceil b \rceil$ : the ceiling function (maximum allowed)

A budget state is a vector:

$$\mathbf{b} = (b_1, b_2, \ldots, b_k) \in \mathbb{N}^k$$

where $k$ is the number of **dimensions**.

### 4.2 The Scope Operator

A **scope** is a budget with a **reset operator**:

$$\text{reset} : \mathcal{B} \to \mathcal{B}, \quad \text{reset}(b) = \lceil b \rceil$$

The **open-once law**:

$$\text{charge}(\text{reset}(b), c) = \text{charge}(b, c) \quad \text{if } b \text{ is already open}$$

This prevents "a bound wearing a counter" — resetting on every charge would make the scope inexhaustible.

### 4.3 Budget Dimensions

The **dimension signature** is a finite set $D = \{d_1, \ldots, d_k\}$. Each dimension has:
- A **ceiling** $c_i \in \mathbb{N} \cup \{\infty\}$
- A **reset period** $r_i \in \{\text{lifetime}, \text{per-cycle}, \text{per-call}\}$
- A **termination reason** $t_i$ (what to report when exhausted)

### 4.4 SeNARS Point

$$\mathcal{B}_{\text{SeNARS}} = \langle D = \{\text{cycles}, \text{memoryOps}, \text{llmCalls}, \text{depth}\} \rangle$$

| Scope | Dimension | Ceiling | Reset |
|-------|-----------|---------|-------|
| derivations | cycles | 100 | per-cycle |
| premises | cycles | 64 | per-cycle |
| candidate-derivations | cycles | 16384 | per-cycle |
| proposal-application | memoryOps | 64 | per-cycle |
| control-work | cycles | 16 | per-cycle |
| decision-derivations | llmCalls | 8 | per-cycle |
| main budget | all 4 | varies | lifetime |

**Key algebraic property**: `decision-derivations` and `derivations` are **separate rows** — a decision budget of zero provably does not change the symbolic derivation count. This is the four-configuration invariance, budgeted rather than asserted.

### 4.5 The Neighborhood

| Variation | What changes |
|-----------|-------------|
| Single global budget | No scopes, no dimensions |
| Per-agent budgets (multi-agent) | Budget vector indexed by agent |
| Continuous budgets (real-valued) | CPU-time as $\mathbb{R}^+$, not $\mathbb{N}$ |
| No reset (pure lifetime) | Every bound is permanent |
| Adaptive ceilings | Ceiling changes based on performance |

---

## 5. Sort $\mathcal{S}$: Strategy Operad

### 5.1 Definition

A strategy system is an **operad** $\mathcal{S}$ with:
- A set of **slots** $I = \{i_1, \ldots, i_n\}$ (typed input positions)
- A set of **implementations** $\text{Impl}(i)$ for each slot
- A **composition law** $\gamma : \prod_i \text{Impl}(i) \to \text{Reasoner}$
- A **resolution function** $\rho : \text{Config} \to \prod_i \text{Impl}(i)$

### 5.2 The Slot Signature

$$\mathcal{S} = \langle I, \text{Impl}, \gamma, \rho \rangle$$

Each slot $i$ has:
- A **type signature**: $\text{Input} \to \text{Output}$
- A **set of implementations**: $\text{Impl}(i) = \{s_1, s_2, \ldots\}$
- A **configuration space**: $\text{Config}(i)$
- A **statefulness flag**: $\text{stateful}(s) \in \{0, 1\}$

### 5.3 SeNARS Point

$$\mathcal{S}_{\text{SeNARS}} = \langle I = \{\text{sampling}, \text{premise}, \text{derivation}, \text{lmRule}, \text{attention}\} \rangle$$

| Slot | Implementations | Cardinality |
|------|----------------|-------------|
| sampling | priority, top-n, novelty, goal-biased, diverse, windowed-roulette | 6 |
| premise | default-formation, bag, resolution, goal-driven, analogical, sampled, exhaustive, semantic, decomposition, prolog-resolution, term-link, embedding-link | 12 |
| derivation | default, anytime, focused, sampled | 4 |
| lmRule | all, priority, rotation, diverse, lm-graph | 5 |
| attention | simple, spreading, goal-relevance, composite | 4 |

**Total configuration space**: $6 \times 12 \times 4 \times 5 \times 4 = 5760$ distinct strategy profiles.

**Key constraint**: The controller is **rebuilt wholesale** on any strategy change. `adapt()` calls `buildInferenceController(newParams)` which resolves all five slots and rebuilds the `InferenceController` — losing `derivationCount` and the circular detector's state.

### 5.4 The Composition Law

$$\gamma(s_{\text{samp}}, s_{\text{prem}}, s_{\text{deriv}}, s_{\text{lm}}, s_{\text{att}}) = \text{InferenceController}$$

This is a **surjective** map: many strategy profiles may produce equivalent behavior. It is not injective — different configurations can yield the same inference trace.

---

## 6. Sort $\mathcal{V}$: Valuation Algebra (Truth)

### 6.1 Definition

A valuation algebra is a **monoid** $(\mathcal{V}, \otimes, e)$ where:
- $\otimes$ is the **evidence combination** operator
- $e$ is the **prior** (no evidence)
- The monoid is **non-idempotent**: $v \otimes v \neq v$ (evidence accumulates)

Additionally, $\mathcal{V}$ carries:
- A **revision** operator: $\text{rev} : \mathcal{V} \times \mathcal{V} \to \mathcal{V}$
- A **projection** operator: $\text{proj} : \mathcal{V} \times \mathbb{N} \to \mathcal{V}$ (temporal decay)
- A **negation** operator: $\neg : \mathcal{V} \to \mathcal{V}$

### 6.2 The NAL Instance

$$\mathcal{V}_{\text{NAL}} = ([0,1] \times [0,1], \otimes_{\text{rev}}, (0.5, 0))$$

where $(f, c)$ is frequency × confidence, and:

$$\text{rev}((f_1, c_1), (f_2, c_2)) = \left(\frac{f_1 c_1 (1-c_2) + f_2 c_2 (1-c_1)}{c_1(1-c_2) + c_2(1-c_1)}, \; c_1(1-c_2) + c_2(1-c_1)\right)$$

**Key algebraic properties:**
- Revision is **commutative** but not **associative** (order matters for chains)
- Confidence is **sub-additive**: $c_{\text{rev}} < c_1 + c_2$
- Frequency is a **weighted average**: pulled toward the more confident source

### 6.3 The Epistemic/Teleological Split

The valuation algebra factors:

$$\mathcal{V} = \mathcal{V}_{\text{epistemic}} \times \mathcal{V}_{\text{teleological}}$$

| Aspect | Epistemic (Beliefs) | Teleological (Goals) |
|--------|---------------------|----------------------|
| Value | $(f, c)$ — frequency, confidence | $(d, c)$ — desire, confidence |
| Revision | Evidence-based | Progress-based |
| Mutation authority | Evidence only | Reward + evidence |
| Firewall | RewardGate blocks reward → $f$ | Reward may affect $d$ |

This is the **epistemic firewall**: a type-level invariant that $\text{reward} \not\to \text{Truth.frequency}$.

### 6.4 The Neighborhood

| Variation | What changes |
|-----------|-------------|
| Boolean truth | $\mathcal{V} = \{0, 1\}$, no uncertainty |
| Probability | $\mathcal{V} = [0,1]$, single scalar |
| Dempster-Shafer | $\mathcal{V} = 2^\Theta$, belief functions |
| Fuzzy | $\mathcal{V} = [0,1]$, min/max operations |
| Paraconsistent | $\mathcal{V}$ includes contradictions as values |
| No truth (pure symbolic) | $\mathcal{V} = \{\top\}$, singleton |

---

## 7. Sort $\mathcal{M}$: Memory Algebra

### 7.1 Definition

A memory algebra is a **comonad** $(\mathcal{M}, \varepsilon, \delta)$ with:
- $\varepsilon : \mathcal{M} \to \text{State}$ (extract/counsel)
- $\delta : \mathcal{M} \to \mathcal{M} \circ \mathcal{M}$ (duplicate/extend)

Plus a **decay comonad** $\mathcal{D}$:
- $\text{decay} : \mathcal{M} \times \mathbb{N} \to \mathcal{M}$ (temporal forgetting)
- $\text{evict} : \mathcal{M} \times \text{Pressure} \to \mathcal{M}$ (pressure-driven forgetting)

### 7.2 The Bag Operator

The fundamental memory structure is a **bounded priority bag**:

$$\text{Bag}(T) = \langle \text{items} : T^*, \; \text{capacity} : \mathbb{N}, \; \text{priority} : T \to [0,1] \rangle$$

Operations:
- $\text{add}(b, x)$: insert with priority
- $\text{sample}(b)$: probabilistic extraction by priority
- $\text{decay}(b, \lambda)$: reduce all priorities by $\lambda$
- $\text{evict}(b)$: remove lowest-priority items when over capacity

### 7.3 SeNARS Point

$$\mathcal{M}_{\text{SeNARS}} = \langle \text{Memory}, \text{EpisodicMemory}, \text{WorkingMemory} \rangle$$

All three are `Bag<T>` instances. The **port abstraction** means the cycle path depends on 9 named contracts (`ConceptReader`, `ConceptWriter`, `TaskAdmission`, `BeliefTable`, `GoalEnumeration`, `LinkPort`, `StatisticsView`, `SymbolIndex`, `MemoryClock`, `AttentionOwner`), not on `Memory` directly.

**Key property**: The `authorize` stage is the **only write path** into memory. Nothing else writes. This is a topological invariant of the control flow.

---

## 8. Sort $\mathcal{P}$: Policy Algebra (Failure & Degradation)

### 8.1 Definition

A policy algebra is a **lattice** $(\mathcal{P}, \leq)$ of failure-response maps:

$$p : \text{Fault} \to \text{Response}$$

where:
- $\text{Fault} \in \{\text{timeout}, \text{parse-error}, \text{provider-down}, \text{budget-exhausted}, \text{gate-rejected}\}$
- $\text{Response} \in \{\text{abort}, \text{retry}, \text{degrade}, \text{skip}, \text{fail-closed}, \text{fail-open}\}$

### 8.2 The Degradation Spectrum

$$\bot = \text{abort-on-any-fault} \;\leq\; \text{fail-closed} \;\leq\; \text{retry-then-degrade} \;\leq\; \text{fail-open} \;\leq\; \text{ignore} = \top$$

### 8.3 SeNARS Point

$$\mathcal{P}_{\text{SeNARS}} = \begin{cases} \text{fail-closed} & \text{at ingress (untrusted → memory)} \\ \text{fail-open} & \text{at egress (derived → memory)} \\ \text{fail-open, silent} & \text{at engine.reason(), engine.absorb()} \\ \text{fail-open, logged} & \text{at propose pump, tool dispatch} \\ \text{unprotected} & \text{at rlfp.optimize(), emitCognitiveStateSummary()} \end{cases}$$

**The critical asymmetry**: "failing closed would halt cognition on a provider fault — the one thing a bounded runtime may not do." But at ingress, "degrading to unjudged admission would bypass the injection veto."

---

## 9. The Composition Law

A complete reasoner design is the **fiber product** of all seven sorts:

$$\mathcal{R} = \mathcal{T} \times_{\mathcal{G}} \mathcal{B} \times_{\mathcal{B}} \mathcal{S} \times_{\mathcal{V}} \mathcal{M} \times_{\mathcal{M}} \mathcal{P}$$

The fiber product means: the choices must be **compatible**. Not every combination is valid. The compatibility constraints are:

| Constraint | Meaning |
|-----------|---------|
| $\mathcal{T} \models \mathcal{G}$ | Every stage boundary has a gate or an explicit no-gate |
| $\mathcal{G} \models \mathcal{B}$ | Every gate decision is budgeted |
| $\mathcal{B} \models \mathcal{T}$ | Every loop iteration charges a budget |
| $\mathcal{S} \models \mathcal{V}$ | Strategy outputs are valid truth values |
| $\mathcal{V} \models \mathcal{M}$ | Truth values can be stored in memory |
| $\mathcal{M} \models \mathcal{P}$ | Memory operations have failure policies |

---

## 10. SeNARS as a Point: The Full Coordinate Vector

$$\mathcal{R}_{\text{SeNARS}} = \begin{pmatrix} \mathcal{T} = \text{3-nested-loops, one-way nesting, 6+8+3 stages} \\ \mathcal{G} = \text{4 gates, } \alpha = (\text{closed}_{\text{in}}, \text{open}_{\text{out}}) \\ \mathcal{B} = \text{4 dimensions, 6 scopes, open-once, lifetime main} \\ \mathcal{S} = \text{5 slots, 5760 profiles, wholesale rebuild} \\ \mathcal{V} = \text{NAL } (f,c) \text{ with epistemic/teleological split} \\ \mathcal{M} = \text{Bag<T> comonad, 9 ports, single write path} \\ \mathcal{P} = \text{fail-closed ingress, fail-open egress, silent engine} \end{pmatrix}$$

---

## 11. The Design Space Topology

### 11.1 Axes of Variation

The design space $\mathfrak{D}$ has at least these **independent axes**:

| Axis | Range | SeNARS Position |
|------|-------|-----------------|
| Nesting depth | $0, 1, 2, 3, \ldots$ | 3 |
| Gate asymmetry | $\{(\text{O},\text{O}), (\text{O},\text{C}), (\text{C},\text{O}), (\text{C},\text{C})\}$ | $(\text{C}, \text{O})$ |
| Budget reset period | $\{\text{lifetime}, \text{per-cycle}, \text{per-call}\}$ | mixed |
| Strategy slot count | $0, 1, 2, \ldots$ | 5 |
| Truth algebra | $\{\text{boolean}, \text{probabilistic}, \text{NAL}, \text{D-S}, \text{fuzzy}\}$ | NAL |
| Memory structure | $\{\text{flat}, \text{bag}, \text{graph}, \text{tensor}\}$ | Bag + graph |
| Failure policy | $\{\text{abort}, \text{fail-closed}, \text{degrade}, \text{fail-open}\}$ | mixed |
| LM integration | $\{\text{none}, \text{proposer}, \text{judge}, \text{both}\}$ | proposer + judge |
| Event sourcing | $\{\text{none}, \text{append-only}, \text{snapshot}\}$ | append-only + snapshot |
| Self-modification | $\{\text{none}, \text{governed}, \text{ungoverned}\}$ | governed |

### 11.2 Notable Neighboring Points

| System | $\mathcal{T}$ | $\mathcal{G}$ | $\mathcal{V}$ | Key Difference from SeNARS |
|--------|---------------|---------------|---------------|---------------------------|
| ReAct | Flat, 3 stages | None | Boolean | No nesting, no gates, no budget |
| AutoGPT | Flat, loop | None | None | Unbounded, no truth algebra |
| Coq/Lean | Flat, tactic | Proof gate | Boolean (provability) | Fail-closed everywhere, no uncertainty |
| Bayesian reasoner | Flat | None | Probability | Single truth algebra, no epistemic split |
| ACT-R | 2 loops | Production gate | Activation | Cognitive architecture, no NAL |
| OpenCog | Graph | Attention | Probabilistic | AtomSpace, no event sourcing |
| **SeNARS** | **3 nested** | **4 gates** | **NAL** | **All of the above, composed** |

### 11.3 The Extremal Points

| Point | Description |
|-------|-------------|
| $\mathcal{R}_{\min}$ | Single stage, no gates, no budget, boolean truth, no memory | 
| $\mathcal{R}_{\max}$ | Infinite nesting, all gates fail-closed, infinite budget, all strategies, paraconsistent truth, tensor memory |
| $\mathcal{R}_{\text{SeNARS}}$ | Bounded, event-sourced, fail-open egress, NAL, Bag memory, 5 strategy slots |

---

## 12. The Control-Theoretic Interpretation

Viewed as a **control system**:

| Control Theory | SeNARS Analog |
|---------------|---------------|
| Plant | Memory / Concept Space |
| Controller | Inference Cycle (Loop B) |
| Reference signal | Goals / Drives |
| Error signal | Drive intensity below threshold |
| Control signal | Narsese operation goals |
| Actuator | Tools / Self-modification |
| Sensor | PerceptionGate / Ingress |
| Observer | CycleTrace / Event Log |
| Feedback | RLFP / Drives / Self-assessment |
| Disturbance | Untrusted LM outputs / External stimuli |
| Bandwidth | Budget (cycles, memoryOps, llmCalls) |
| Stability | Epistemic coherence (no contradiction explosion) |
| Robustness | Fail-open egress (cognition must not halt) |

The **control law** is:

$$u(t) = \text{rankDerivations}(\text{vetoAtEgress}(\text{derive}(\text{sample}(\text{memory}))))$$

The **feedback loop** is:

$$\text{drive intensity} \xrightarrow{\text{below threshold}} \text{inject meta-goal} \xrightarrow{\text{tool dispatch}} \text{reward} \xrightarrow{\text{stimulate}} \text{drive intensity}$$

---

## 13. Invariants as Algebraic Laws

The CI gates enforce **equational laws** in the control algebra:

| Law | Algebraic Form | CI Gate |
|-----|---------------|---------|
| One inference path | $\exists! \; \text{InferenceController}$ | `pnpm gates:one-cycle-path` |
| No nested propose | $\text{propose} \not\subset \text{reason}$ | `findInCycleProposals` |
| No LM in core | $\text{cycle\_path} \cap \text{lm/} = \emptyset$ | `pnpm core:no-lm` |
| Budgets are declared | $\forall \text{charge}, \exists \text{BudgetScopeId}$ | `pnpm control-budgets` |
| No wildcard dispatch | $\forall \text{rule}, \text{kind}_1 \times \text{kind}_2$ exact | `pnpm dispatch:no-wildcard` |
| Rules are data | $\text{rules} \in \text{LoadedTable}$ | `pnpm rules:loaded-data` |
| Memory is ported | $\text{cycle\_path} \to \text{ports}$, not $\to \text{Memory}$ | `pnpm memory:ports` |
| Attention: one write | $\exists! \; \text{setAttentionModel}$ | `pnpm attention:write-surface` |
| Terms canonical | $\text{reduce}(\text{reduce}(t)) = \text{reduce}(t)$ | `pnpm terms:canonical` |

These are **equations in the algebra** that SeNARS satisfies. Other reasoner designs may satisfy different equations.

---

## 14. Summary: The Coordinate Chart

$$\boxed{\mathcal{R}_{\text{SeNARS}} \in \mathfrak{D} = \mathcal{T} \times \mathcal{G} \times \mathcal{B} \times \mathcal{S} \times \mathcal{V} \times \mathcal{M} \times \mathcal{P}}$$

SeNARS is the point where:
- **Topology** is 3-deep nested, one-way, serial inner loop
- **Gates** are asymmetric: fail-closed in, fail-open out
- **Budgets** are 4-dimensional, 6-scoped, open-once per cycle
- **Strategies** are 5-slotted, 5760-profile, wholesale-rebuild
- **Valuation** is NAL $(f,c)$ with epistemic/teleological firewall
- **Memory** is Bag-comonad with 9 ports and single write path
- **Policy** is fail-open for cognition, fail-closed for trust boundary

Every other reasoner design is a different point in this space. The algebra tells you which coordinates you can change independently, which are coupled, and what invariants you must preserve.