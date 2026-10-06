# 𝓡 — A Design Space for Reasoning Systems

Technical reference. SeNARS instantiated as point **r\***.

---

## 0. Notation

| Mark | Meaning |
|---|---|
| `Aᵢ` | design axis (finite level set `L0…Ln`) |
| `r ∈ 𝓡` | a reasoner = one point in the product space |
| `Φ(r)` | feasibility predicate (inter-axis constraints, §5) |
| `r*` | SeNARS |
| ⛔ | coordinate pinned by an enforced build gate |
| ⚠ | coordinate claimed but under-wired (known seam) |

```
𝓡  =  Σ × Ω × Π × Τ × Κ × Φ
      semantics  resources  state/     trust/   control  self-
                              provenance integration
|r| raw = ∏|Aᵢ| ≈ 4.35 × 10¹² points;  Φ(·) collapses most as incoherent.
```

---

## 1. Axis Catalog

### Σ — Semantics (what consequence means)

| ID | Axis | Levels | Type |
|---|---|---|---|
| Σ1 | Truth carrier | L0 bool · L1 scalar P · **L2 (f,c) pair** · L3 interval/set · L4 distributional | ordinal |
| Σ2 | Consequence regime | L0 axiomatic-closed · L1 monotonic · **L2 non-axiomatic (evidence-relative under insufficient resources)** | ordinal |
| Σ3 | Rule palette | L0 deduction · L1 +induction · L2 +abduction/comparison · **L3 +meta-rules (self-applicable), rule set = versioned data** | ordinal |
| Σ4 | Contradiction policy | L0 explosive · L1 quarantined · **L2 graded paraconsistent retention** | ordinal |
| Σ5 | Term expressivity | L0 flat atoms · L1 first-order · L2 higher-order/intensional · L3 temporal/procedural · **L4 + dependent-type co-substrate** | ordinal |

### Ω — Resource regime

| ID | Axis | Levels | Type |
|---|---|---|---|
| Ω1 | Resource postulate | L0 ideal-unbounded · L1 static bounds · **L2 AIKR (insufficiency as design axiom)** | ordinal |
| Ω2 | Budget model | L0 none · L1 scalar · **L2 multi-dimensional, one table, one arithmetic** | ordinal |
| Ω3 | Execution contract | L0 batch · L1 checkpointable · **L2 anytime + interrupt + backpressure** | ordinal |
| Ω4 | Forgetting | L0 none · L1 eviction · **L2 decay + consolidation + archive (truth-decoupled from attention)** | ordinal |

### Π — State & provenance

| ID | Axis | Levels | Type |
|---|---|---|---|
| Π1 | State substrate | L0 mutable blackboard · L1 snapshot · **L2 append-only event log + checkpoint overlay** | ordinal |
| Π2 | Revision | L0 overwrite · L1 accumulate · **L2 evidence revision with independence check + lineage cap** | ordinal |
| Π3 | Audit depth | L0 none · L1 conclusion-level · L2 derivation-step · **L3 step-level + standalone verifier + hash-verified replay** | ordinal |

### Τ — Trust & integration

| ID | Axis | Levels | Type |
|---|---|---|---|
| Τ1 | Proposer topology | L0 monolith · L1 symbolic-only · **L2 symbolic + stochastic (untrusted) proposers** · L3 multi-agent mesh | ordinal |
| Τ2 | Admission control | L0 none · L1 ingress filter · L2 judge gate · **L3 multi-gate kernel (perception/action/reward/budget) + veto registry + autonomy ladder** | ordinal |
| Τ3 | Reward→truth firewall | L0 conflated · L1 policy/prose separation · **L2 structural refusal (typed + runtime enforcement)** | ordinal |
| Τ4 | Belief/goal axis | L0 conflated · L1 soft (prompt-level) · **L2 type-level + axis tagging** | ordinal |

### Κ — Control

| ID | Axis | Levels | Type |
|---|---|---|---|
| Κ1 | Attention | L0 uniform · L1 priority queue · L2 bounded bags + decay + probabilistic sampling · **L3 focus economy (weighted foci, scheduler, cross-focus budget)** | ordinal |
| Κ2 | Strategy layer | L0 fixed pipeline · L1 pluggable registry · **L2 adaptive meta-control (executive re-tuning)** | ordinal |
| Κ3 | Action authorization | L0 none · L1 allow-list · **L2 autonomy-mode ladder + scoped allow-lists + veto registry** | ordinal |

### Φ — Self-reference

| ID | Axis | Levels | Type |
|---|---|---|---|
| Φ1 | Self-modification scope | L0 none · L1 knobs · L2 strategies · L3 rules · **L4 code** | ordinal |
| Φ2 | Self-mod governance | L0 none · L1 test gate · **L2 shadow-CI + approval ladder** · L3 external immutable arbiter | ordinal |
| Φ3 | Learning channels | L0 none · L1 environment RL · L2 preference/derivation feedback · **L3 distillation flywheel + schema induction + retrospective** | ordinal |
| Φ4 | Metacognition | L0 none · L1 monitors · L2 analyzer suite · **L3 reasoning-about-reasoning + self-correction loop** | ordinal |

---

## 2. r\* — SeNARS Coordinate Instantiation

**Profile vector:** `r* = ⟨ Σ 22324 · Ω 2222 · Π 223 · Τ 2322 · Κ 322 · Φ 4233 ⟩`

| Axis | Lvl | Realizing mechanism (SeNARS) |
|---|---|---|
| Σ1 | 2 | `Truth{f,c}`; branded `Frequency`/`Confidence`; `BeliefTruthSchema` bounds at untrusted edges |
| Σ2 | 2 | AIKR foundation; evidence-relative revision; no axiom of completeness |
| Σ3 | 3 | 44 declarations / 20 exact-kind dispatch cells; 5 bounded meta-rules; `RuleTableStore` = loaded, versioned, revertable data |
| Σ4 | 2 | Contradiction-resilience bench: `(A→B)` and `¬(A→B)` cohabit with distinct truth values |
| Σ5 | 4 | Full Narsese (inheritance/implication/conjunction/sequence/operation) + MeTTa Π/Σ types as tool-gated co-substrate (arbiter pattern; no memory sharing) |
| Ω1 | 2 | AIKR named axiom; bounded bags, caps, deadlines everywhere |
| Ω2 | 2 | `BUDGET_RESOURCES`: 4 dimensions (cycles/depth/memoryOps/llmCalls), one table, one arithmetic |
| Ω3 | 2 | `AbortSignal`, wall-clock deadlines, CPU throttle, backpressure, anytime yield |
| Ω4 | 2 | Priority decay (LRU) ≠ truth decay (invalidation only); archive; pressure-driven consolidation |
| Π1 | 2 | JSONL/SQLite event log = source of truth; `nar-state` JSON = checkpoint only |
| Π2 | 2 | `Truth.revision` + independence flag; ancestor-set lineage bound |
| Π3 | 3 | `DerivationRecord` → `verifyRecord` (engine-independent, transcribed truth table) → `replayIntoMemory` + state-hash verify |
| Τ1 | 2 | LLM (S1 proposer) + NAL (S2 authority) + reflexes; ⚠ peer mesh implemented, unexported (dormant) |
| Τ2 | 3 | Four gates; shadow validation; GBNF-constrained cortex ladder; symbolic fallback on all LM paths · ⚠ ActionGate coverage = focus/game path only; tool paths bypass (seam #16) |
| Τ3 | 2 | `RewardGate`: mutation of `Truth.frequency`/`confidence` refused structurally; allowed targets = {attention-priority, policy-weights}; domain split (`external-reflex` direct, `self-*` → proposal) |
| Τ4 | 2 | Belief/Goal type split; `CognitiveAxis` ('epistemic'/'teleological') crosses every boundary |
| Κ1 | 3 | `Bag<T>` + `Focus` + `FocusBag` + `FocusScheduler`/`FocusTree`; nine memory ports |
| Κ2 | 2 | Strategy registry (5 slots × N options) + `CognitiveController.adapt()`; ⛔ stateful strategies rejected |
| Κ3 | 2 | 5-mode autonomy ladder; scoped operation allow-lists re-declared per world state; NAL veto registry · ⚠ single production caller |
| Φ1 | 4 | Codemod patches to own source via shadow git worktree |
| Φ2 | 2 | Shadow worktree + full CI + `ApprovalManager` + `PatchRiskClassifier` × `AutonomyMode`; L3 (external immutable runner) specified, not deployed · ⚠ approval handle not injected on NAR path (seam #17) |
| Φ3 | 3 | RLFP (trajectories + preferences), distillation flywheel (teacher→student heads), `SchemaInductor`, dialogue flywheel |
| Φ4 | 3 | 8 analyzers, `ReasoningAboutReasoning`, retrospectives → clamped strategy adaptation with ledger + rollback |

---

## 3. Three Orthogonal Planes

```
                 GOVERNANCE PLANE (Π, Τ, Φ)
                 “how is cognition trusted & audited”
                          ▲
                          │        ● r*
                          │
   ECONOMY PLANE ◄────────┼────────►  SEMANTICS PLANE
   (Ω, Κ)                 │            (Σ)
   “how is cognition      │            “what does a
    scheduled & forgotten”│             derivation mean”
                          │
   r* projects to near-maximal corner on all three simultaneously —
   the region usually reachable only pairwise.
```

---

## 4. Feasibility Constraints Φ(r)

Inter-axis laws; violation ⇒ incoherent or unsafe point.

| # | Constraint | Rationale |
|---|---|---|
| C1 | Φ1 ≥ L3 ⇒ Π3 ≥ L2 | Modifying the reasoner requires step-level audit |
| C2 | Φ1 = L4 ⇒ Φ2 ≥ L2 ∧ Π1 = L2 | Code self-mod without shadow validation + append-only log = uncontainable |
| C3 | Τ1 ≥ L2 ⇒ Τ2 ≥ L2 | Stochastic proposers require judge gates; else laundering |
| C4 | Φ3 ≥ L1 ⇒ Τ3 ≥ L1; Φ3 ≥ L2 ∧ Φ1 ≥ L1 ⇒ Τ3 = L2 | Any learner touching attention/policy needs the firewall; self-improving learners need it structural |
| C5 | Ω1 = L2 ⇒ Ω2 ≥ L1 ∧ Ω3 ≥ L1 ∧ Ω4 ≥ L1 | AIKR decomposes into budget + anytime + forgetting |
| C6 | Σ4 = L2 ⇒ Σ1 ≥ L2 | Graded contradiction retention requires graded truth |
| C7 | Π3 = L3 ⇒ Π1 = L2 | Replay requires append-only substrate |
| C8 | Σ2 = L2 ⇒ Σ1 ≥ L2 ∧ Ω1 ≥ L1 | Non-axiomatic logic is constituted by graded evidence + resource pressure |
| C9 | Κ1 = L3 ⇒ Ω4 ≥ L1 | Attention economy requires decay |
| C10 | Τ4 = L0 ∧ Φ3 ≥ L1 ⇒ reward-hack feasible | Excluded region, not a law — see §9 |

---

## 5. Coordinate Locks (r\* pinning mechanisms)

Axes held fixed by enforced gates, not convention:

| Coordinate | Lock (⛔) |
|---|---|
| Σ3 (rule set = data, exact-kind dispatch) | `rules:loaded-data`, `dispatch:no-wildcard`, `docs:drift` |
| Σ5 / term canonicality | `terms:canonical`, `narsese:literals`, `answer:no-fabrication` |
| Τ2 (proposers permanently untrusted) | `core:no-lm`, `cycle:no-provider`, `gates:one-cycle-path` |
| Τ3 | `reward:policy-only` |
| Ω2 | `control-budgets` |
| Ω1/Ω4 | `resource:policy` |
| Κ1 | `attention:write-surface` |
| Κ2 | `config:model-matrix` |
| Π3 | `derivation:verifiable`, `persistence:replay`, verifier-drift pin |

---

## 6. Region Map — Exemplars as Points

Approximate coordinates (key axes only):

| System | Σ1 | Σ2 | Σ4 | Ω1 | Π3 | Τ1 | Τ2 | Τ3 | Φ1 | Φ2 |
|---|---|---|---|---|---|---|---|---|---|---|
| Resolution/first-order ATP | 0 | 0 | 0 | 0 | 1 | 0 | 0 | n/a | 0 | 0 |
| SAT/SMT solver | 0 | 0 | 0 | 0 | 1 | 0 | 0 | n/a | 0 | 0 |
| Bayesian network | 1 | 1 | 1 | 1 | 1 | 0 | 0 | n/a | 0 | 0 |
| Expert system (production rules) | 1 | 1 | 1 | 1 | 1 | 0 | 1 | 0 | 1 | 0 |
| ACT-R / SOAR | 1 | 1 | 1 | 1 | 1 | 0 | 1 | 0 | 2 | 1 |
| Pure LLM agent (ReAct-class) | 0 | 1 | 0 | 0 | 0 | 0 | 1 | 0 | 1 | 0 |
| Classical NARS | 2 | 2 | 2 | 2 | 1 | 1 | 1 | 1 | 1 | 0 |
| **SeNARS (r\*)** | **2** | **2** | **2** | **2** | **3** | **2** | **3** | **2** | **4** | **2** |

Projections:

```
Τ3 (firewall)                                          Φ1 (self-mod scope)
  2 │                              ● r*                4 │                ● r*
    │                                                    3 │
  1 │          ● SOAR/ES                               2 │      ● SOAR
    │                                                    1 │  ● NARS ● CLIPS
  0 │ ●ATP ●Bayes    ●LLM-agent                        0 │●ATP ●SMT   ●LLM
    └────────────────────────────── Π3 (audit)           └────────────────── Ω1 (AIKR)
     0      1      2      3                              0      1      2
```

Observation: no other catalogued point occupies {Π3=3} × {Τ3=2} × {Φ1=4} jointly.

---

## 7. Tradeoff Surfaces

Cost structure along axes (why the space is not monotone-improvable):

| Axis ↑ | Cost |
|---|---|
| Π3 | Throughput; recorder bounded & opt-in (200 steps × 200 records) |
| Τ2 | Admission latency (judge deadline 2000 ms; fault ⇒ fail-closed violation event) |
| Ω4 | Recall completeness; forgetting is lossy by design |
| Σ4 | Decision simplicity; contradictions retained ⇒ query must grade, not collapse |
| Φ1 | Governance obligation scales (C1/C2); shadow-CI wall time per mutation |
| Τ1 | Surface area of untrusted input; every new proposer class needs new judge heads |

---

## 8. Neighborhood of r\* — Adjacent Points by Wiring Move

Dormant seams (§25 of control-flow doc) as single-step moves in 𝓡:

| Seam | Move | Effect |
|---|---|---|
| #16 ActionGate on tool paths | Τ2 coverage: focus-only → all mutations | closes the authorization asymmetry (F9/F10) |
| #17 inject approval into self-tools | Φ2: gate becomes askable | closes largest W→D governance seam |
| #1 rule admission arm | Φ1: rule channel goes live | self-applied Σ3 |
| #5 shadow-validate NL candidates | Τ2: NL ingress covered | removes unvalidated formalization path |
| #15 cooperation export | Τ1: L2 → L3 | peer mesh + judgment delegation live |
| #2/#4 NL generation stack | egress posture swap (post-hoc ⇒ pre-emission) | groundedness gate moves upstream |
| #13 episodic promotion | Ω4/Π: retrieval-verified consolidation live | closes memory flywheel |

---

## 9. Vacated Regions (deliberately empty)

| Region | Excluded by |
|---|---|
| Τ3 = 0 ∧ Φ3 ≥ 1 (reward writes truth) | Epistemic firewall; sabotage bench |
| Φ1 = 4 ∧ Φ2 < 2 (ungoverned code self-mod) | Governance pipeline; Sabotage Test (bench 7) |
| Ω1 = 0 ∧ Π1 = 2 (unbounded ideal + event log) | Incoherent: nothing to audit if resources unbounded and nothing forgotten |
| Σ4 = 0 ∧ Π2 = 2 (explosive + revision) | Contradiction collapses store before revision can run |
| Τ1 ≥ 2 ∧ Τ2 ≤ 1 (untrusted proposers, no gates) | Evidence-laundering bench |

---

## 10. Order & Metric

**Dominance (safety subset).** For `S = {Τ2, Τ3, Τ4, Π3, Φ2}`:
`r ⪯ₛ r′` iff `∀a∈S: level_a(r) ≤ level_a(r′)`. r\* is ⪯ₛ-maximal among catalogued systems.

**Distance.** Normalized weighted Hamming over ordinal axes:
`d(r,r′) = Σᵢ wᵢ·|ℓᵢ(r)−ℓᵢ(r′)| / (nᵢ−1)`; categorical axes contribute 0/1.

**Frontier claim.** r\* sits on the Pareto frontier of {Π3, Τ3, Ω1, Φ1} subject to §7 costs; movement off the frontier trades audit/firewall/bounds for throughput or simplicity.

---

## 11. Instantiation Schema (reading any system as a point)

Probe per cluster:

| Cluster | Probe |
|---|---|
| Σ | What is a truth value? When is a conclusion retracted? What happens to `P ∧ ¬P`? |
| Ω | What happens at 2× memory, 0× time? What is forgotten, and when does truth change because of it? |
| Π | Can a conclusion be re-derived by a process that never ran the engine? |
| Τ | Which components may be wrong by design, and what consumes their output unchanged? Can a reward change a belief? |
| Κ | Who decides what runs next, and can that decision itself be changed at runtime? |
| Φ | What part of the system can the system modify, and who says yes? |

Answering all 18 axes yields the point; §4 validates it; §7 prices it.
