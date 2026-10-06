# THE HELMHOLTZ ARCHITECTURE
## A Thermodynamic, Free-Energy Specification for Bounded Governed Cognition

**Version 1.0 · Self-contained reference specification**

---

## §0 — Design Charter

This specification is synthesized under the following selections from the design-objective menu. These selections are the constitution against which every internal conflict below is resolved.

### Prime Objectives
| ID | Objective | Role in this design |
|---|---|---|
| **O1** | Maximum epistemic integrity | Belief/goal firewall, paraconsistency, evidence independence, calibrated admission |
| **O2** | Auditable causal provenance | Correlation manifold, replayable control, standalone verification |
| **O3** | Control-plane fluidity | Declarative conditional cognitive graph, not fixed loops |
| **O4** | Resource economics | **Recast as thermodynamics: free-energy pool, temperature, entropy budget** |
| **O6** | Governed reflexivity | All learning/self-modification as governed proposals |
| **O7** | Neuro-symbolic synergy | Neural/LM propose; symbolic/manifold judge, calibrate, veto |
| **O8** | Unified commit ledger | One typed commit surface for all durable mutation |

### Hard Constraints (all held)
**H1** reward ∤ truth · **H2** untrusted ⇒ judged/provisional · **H3** mutation ⇒ event · **H4** no self-approved self-modification · **H5** no unbounded path · **H6** no opaque scheduling · **H7** verifier ⊥ engine · **H8** exact substrates never union on similarity · **H9** no silent cognitive failure · **H10** irreversible ⇒ risk-classified.

### Anti-Goals
**A2** no opaque scheduler · **A4** no audit bloat · **A5** no monolithic LM authority.

### Architectural Bias
**D3 Elegance/Unification** as the primary bias, tempered by **D1 Auditability** and **D4 Robustness**, with **D6 Adaptivity** enabled under hard constraint. The governing thesis:

> **A reasoner is a bounded thermodynamic system that minimizes variational free energy under a finite Helmholtz budget, where every mutation is a governed proposal, every decision is a causal event, and the control flow itself is data.**

Everything below is one mechanism serving that thesis.

---

## §1 — The Five Axioms

The architecture rests on five axioms. Each is a load-bearing invariant enforced structurally, not by convention.

### Axiom I — Bounded Free Energy (the thermodynamic AIKR)
Cognition has a finite allocatable free-energy pool **Φ**. No reasoning path may draw unbounded energy, time, memory, or model calls. Scarcity is not an operational accident; it is the founding postulate. Budgets, interruption, yielding, forgetting, and backpressure are first-class.

### Axiom II — Epistemic Separation
Factual truth and desiderative value occupy disjoint type spaces with disjoint mutation authority. No reward, desire, goal, or utility signal may write to a belief's truth value. Desire may modulate attention and policy; it may never alter evidence.

### Axiom III — Provenance by Construction
State is an append-only causal event log. Snapshots are caches. Every perception, inference, proposal, judgment, reservation, commit, and failure carries a correlation identity joinable to its stimulus. Replay and independent verification are guaranteed by the substrate, not bolted on.

### Axiom IV — Governed Change
No subsystem may approve its own durable mutation. Learning, rule induction, strategy change, and code modification produce *proposals* that traverse shadow validation, risk classification, and an authority ladder whose top rungs are external to the mutating process.

### Axiom V — Anytime, Interruptible, Degradable
Every operation is preemptible, yields partial results, and has a declared degradation mode. On fault or exhaustion the system transitions to a known weaker mode; it never produces undefined behavior and never silently swallows a cognitive fault.

---

## §2 — The Thermodynamic Calculus

This is the spine of the architecture. All scheduling, budgeting, attention, forgetting, and revision are instances of one calculus.

### 2.1 State variables

| Symbol | Name | Meaning |
|---|---|---|
| **Φ** | Free-energy pool | Total allocatable cognitive resource (the Helmholtz budget) |
| **U** | Internal energy | Current activation load across active tasks, beliefs, derivations |
| **S** | Cognitive entropy | Aggregate uncertainty + open-task disorder |
| **T** | Temperature | Exploration/exploitation dial; modulated by drives and pressure |
| **F** | Free energy | **F = U − T·S** (Helmholtz); the quantity cognition minimizes |

The system maintains the operating invariant:

$$F(t) = U(t) - T(t)\,S(t), \qquad F(t) \le \Phi$$

### 2.2 Variational free energy (the inference step)

For a belief state approximating posterior **q(s)** given observations **o**:

$$\mathcal{F}[q] \;=\; \mathbb{E}_{q}\big[\ln q(s) - \ln p(o, s)\big] \;=\; D_{KL}\big(q(s)\,\|\,p(s\mid o)\big) - \ln p(o)$$

**Inference is minimization of 𝓕 with respect to q.** Evidence revision is the variational update that merges two evidence sources while *minimizing* the free-energy bound and *respecting evidence independence* (so the same evidence cannot be counted twice — this is the structural prevention of evidence laundering).

### 2.3 Expected free-energy reduction (the utility signal)

Every candidate cognitive operation **o** carries an estimated **expected free-energy reduction**:

$$\Delta\mathcal{F}(o) \;=\; \underbrace{\mathbb{E}\big[\text{epistemic gain}\big]}_{\text{uncertainty reduction / information}} \;+\; \underbrace{\mathbb{E}\big[\text{pragmatic gain}\big]}_{\text{goal progress}} \;-\; \underbrace{\lambda_c\,\widehat{\text{cost}}(o)}_{\text{resource expenditure}}$$

This single scalar unifies curiosity (epistemic gain), goal-directedness (pragmatic gain), and economy (cost). It is the universal priority signal.

### 2.4 The Boltzmann scheduling law

The scheduler selects among enabled operations by a temperature-controlled softmax over expected free-energy reduction:

$$P(\text{select } o) \;=\; \frac{\exp\big(\Delta\mathcal{F}(o)\,/\,T\big)}{\sum_{o'} \exp\big(\Delta\mathcal{F}(o')\,/\,T\big)}$$

| Regime | Behavior |
|---|---|
| **T → 0** | Greedy exploitation: always take the highest-Δ𝓕 operation |
| **T high** | Broad exploration: stochastic sampling across candidates (curiosity) |
| **T modulated** | Continuous interpolation; no discrete strategy switch required |

**This replaces fixed sequencing and discrete strategy slots with one continuous, auditable law.** Because the selection is a logged event carrying all Δ𝓕 estimates and the active T, the scheduler is never opaque (**H6**, anti-goal **A2**).

### 2.5 Temperature governance

Temperature is not a free knob; it is a governed state driven by homeostasis and pressure:

$$T(t) \;=\; T_{\text{base}} \cdot \underbrace{g_{\text{curiosity}}(t)}_{\text{exploration drive}} \cdot \underbrace{g_{\text{pressure}}(t)}_{\text{resource scarcity}} \cdot \underbrace{g_{\text{coherence}}(t)}_{\text{stability demand}}$$

- Rising curiosity deficit → ↑ T (explore, ask, generate questions).
- Rising resource pressure → ↓ T (conserve, focus, exploit).
- Rising contradiction/instability → ↓ T (stabilize, repair).

### 2.6 Entropy budget and forgetting

Entropy **S** is bounded by a ceiling **S_max** (bounded memory). When **S → S_max**, the system performs **entropy export** = forgetting/consolidation:

- **Decay** reduces activation of low-access items (LRU, priority-weighted).
- **Consolidation** compresses episodic traces into schemas (raises information density per unit entropy).
- **Truth-decay is decoupled from attention-decay**: a belief's truth degrades only on evidence-invalidation, never merely because it is unattended. Forgetting removes *access*, not *justified truth*.

### 2.7 The generalized control equation

The continuous-time envelope of the whole system:

$$\dot{\mathbf{X}} \;=\; \mathcal{T}\big(\mathbf{X},\, \mathbf{u}(T)\big) \;-\; \gamma(T)\,\mathbf{X} \;+\; \mathcal{E}(\mathbf{I})$$

- **X** — epistemic state (beliefs, goals, concepts, links).
- **𝓣(X, u(T))** — transition operator (inference) modulated by control vector **u**, itself a function of temperature.
- **−γ(T)X** — thermodynamic decay; rate γ rises with temperature and pressure.
- **𝓔(I)** — epistemic boundary filtering external stimuli **I** through the admission manifold.

---

## §3 — The Epistemic Type System

All durable cognitive content is strongly typed. Types enforce the firewall (**H1**, Axiom II).

### 3.1 Cognitive types

| Type | Value structure | Mutation authority |
|---|---|---|
| **Belief** | (frequency *f*, confidence *c*) | **Evidence only** |
| **Goal** | (desire *d*, confidence *c*) | Reward + evidence |
| **Question** | (priority, expected information gain) | Curiosity drive, attention |
| **Hypothesis** | (plausibility, evidence requirement) | Proposal + testing |
| **Assumption** | (scope, validity window) | Local reasoning context |
| **Plan** | (utility, feasibility, risk) | Goal + simulation |
| **ActionIntent** | (reversibility, authorization) | Risk manifold |
| **Lesson** | (source, trust, applicability) | Distillation, governance |

### 3.2 The firewall as a type invariant

Every object carries a **cognitive axis** ∈ {**epistemic**, **teleological**}. The type system enforces, as a structural refusal:

$$\text{Reward} \nrightarrow \text{Belief}.f/c, \qquad \text{GoalFailure} \nrightarrow \text{FalseBelief}, \qquad \text{Desire} \nrightarrow \text{Fact}$$

Reward may write only to {attention priority, policy weights, goal desire}. Any attempt to mutate belief truth from a teleological signal raises a typed **EpistemicFirewallViolation** and is refused at the commit surface.

### 3.3 Paraconsistency

Contradictions are tolerated: **P** and **¬P** may coexist in memory with distinct truth values, graded by evidence. The system never trivializes by explosion. Query resolution grades and reports conflict rather than collapsing it. (Non-monotonic, revision-based, evidence-relative.)

---

## §4 — The Unified Cognitive Transaction

**All cognition is a transaction.** Perception, attention, retrieval, inference, proposal, judgment, commit, action, learning, forgetting, consolidation, simulation, and self-modification are one typed class. This is the unification demanded by O8 and bias D3.

```
interface CognitiveTransaction {
  id            : TransactionId
  correlationId : CorrelationId          // joins stimulus → outcome
  kind          : TransactionKind        // perceive | infer | propose | judge |
                                         // commit | act | learn | forget |
                                         // consolidate | simulate | selfmod
  inputs        : CognitiveObject[]
  outputs       : Candidate[]
  effects       : EffectDeclaration[]    // what it may read/write
  freeEnergy    : FreeEnergyReservation  // ΔΦ reserved; settled after
  deltaF        : ExpectedFreeEnergyReduction   // utility estimate (§2.3)
  trust         : TrustProfile           // source, calibration, provenance
  risk          : RiskProfile            // harm, irreversibility, blast radius
  reversibility : ReversibilityClass
  proofObligations: ProofObligation[]
  fallback      : FailurePolicy          // §12
  epistemicAxis : epistemic | teleological
}
```

Every transaction **declares** what it reads, what it may write, what free energy it reserves, what proofs it must satisfy, how it fails, and whether it is reversible. Control flow therefore becomes explicit, typed, and analyzable — never implicit side effects.

---

## §5 — Resource Thermodynamics

Budgets are not counters; they are an economy of free energy. This realizes O4 under Axiom I and hard constraint **H5**.

### 5.1 Dimensions of cost

Every transaction draws from a multi-dimensional resource vector, but all dimensions are priced into a single free-energy scalar for scheduling:

| Dimension | Meaning |
|---|---|
| control-steps | Scheduler iterations |
| derivations | Symbolic inference steps |
| premises | Premise selections |
| memory-ops | Reads/writes |
| model-calls / tokens | Neural/LM invocations |
| latency | Wall-clock time |
| attention | Focus slots |
| risk | Irreversibility quota |
| human-attention | Approval/clarification cost |

### 5.2 Reservation, execution, settlement

```
reserve(Φ_available, tx.freeEnergy)      // before execution
execute(tx)
settle(Φ, reserved − unused)             // return unspent energy
```

Reservation prevents silent starvation and provides backpressure. A denied reservation is a **typed thermodynamic event**, distinguishable from health.

### 5.3 Pricing by marginal utility

Operations are scored by utility per scarce resource:

$$\text{score}(tx) \;=\; \frac{\Delta\mathcal{F}(tx)}{\lambda_c\,\widehat{\text{cost}} \;+\; \lambda_r\,\widehat{\text{risk}} \;+\; \lambda_h\,\widehat{\text{human-cost}}}$$

The Boltzmann scheduler (§2.4) selects over these scores. Under pressure the economy naturally:
- **low pressure** → explore, elaborate, enrich (high effective T);
- **medium pressure** → prioritize goals and proofs;
- **high pressure** → conserve, degrade to symbolic core, request human help only when necessary.

### 5.4 Thermodynamic backpressure

When the free-energy pool or entropy ceiling is approached, the system raises **thermodynamic pressure**, which:
1. Lowers temperature toward exploitation.
2. Triggers entropy export (forgetting/consolidation).
3. Applies cooperative yielding and preemption.
4. Refuses low-Δ𝓕 reservations.

This is graceful saturation, not hard cutoff.

---

## §6 — Control Flow: The Declarative Cognitive Graph

Control is **data**, not code (O3, Axiom of bounded-anytime, bias D3). The fixed sequence is replaced by a typed conditional graph executed by the Boltzmann scheduler.

### 6.1 The cognitive DAG

Nodes are transaction-generators; edges are guarded:

```
Perceive → Attend → Retrieve → Infer → Propose → Verify → Rank
        → Commit → Plan → Act → Learn → Consolidate
```

with conditional edges whose guards are predicates over thermodynamic and epistemic state:

| Edge | Guard |
|---|---|
| Infer → Propose | `freeEnergy.remaining > threshold` |
| Propose → Verify | `proposer.untrusted == true` |
| Verify → Commit | `proof.ok ∨ judge.calibratedScore > admissionThreshold` |
| Commit → Act | `risk ≤ autonomy.allowedRisk` |
| Learn → MetaPropose | `learning.domain ≠ forbidden` |
| any → Triage | `pressure.starved(control)` |

### 6.2 Invariants compiled into the graph

What is elsewhere enforced by review is here enforced by the graph topology itself:
- no write outside **Commit**;
- no untrusted proposal outside **Verify**;
- no reward update to belief truth;
- no unbounded read without a free-energy reservation;
- no external action without risk/reversibility classification;
- no LM import into the symbolic hot path except through a bounded, judged port.

### 6.3 Heterochronous loop tower

Multiple rates coexist, each an instance of the same graph runner with its own clock, free-energy slice, and trust posture. Lower levels may interrupt higher (reflex veto); higher levels configure lower.

| Level | Timescale | Function |
|---|---|---|
| L4 Identity | ≪ 1/cycle | Constitution review, capability scaffold |
| L3 Consolidation | every K cycles | Decay, episodic merge, schema induction |
| L2 Deliberation | macro turn | Perceive → reason → narrate → act |
| L1 Tick | micro cycle | Perceive → attend → infer → commit → learn |
| L0 Reflex arc | sub-cycle interrupt | Fast judge, safety veto |

The free-energy slices across levels sum to the global Φ (Axiom I preserved).

### 6.4 The meta-controller

The scheduler is itself a bounded anytime reasoner that selects **cognitive programs** — portfolios of controllers (deliberative, reactive, curious, conservative, creative, repair, consolidating). Its output is a program, not a direct action:

```
interface CognitiveProgram {
  stageGraph        : StageGraph
  freeEnergyAlloc   : Allocation
  proposerWeights   : Portfolio
  verificationPolicy: Policy
  autonomyPolicy    : Policy
  temperature       : T
}
```

The meta-controller **proposes** programs; it does not apply them without governance (§9). This is reflexive control without unbounded self-modification.

---

## §7 — Admission and the Unified Commit Ledger

**One commit authority.** Every durable mutation — perceived observation, derived belief, generated goal, formalization, reflex proposal, tool result, schema induction, strategy change, patch, action intention, human correction — passes through one ledger (**O8**, **H3**, Axiom III).

### 7.1 The commit pipeline

```
Candidate
  → Normalize
  → Type-check                (axis, schema)
  → Evidence-independence check   (anti-laundering)
  → Proof / Judge / Simulation    (verification portfolio)
  → Rank                      (Δ𝓕 × calibrated trust)
  → Free-energy settlement
  → Risk classification
  → Commit | Reject | Provisional
```

This single port answers "where does state change happen?" with exactly one answer.

### 7.2 Provisional typing

Untrusted proposals that pass below full-admission threshold but above rejection may be committed as **provisional, typed, decay-eligible** objects (**H2** satisfied without discarding signal). Provisional status is part of the type and is visible to all downstream consumers.

### 7.3 The provenance fold

State is reconstructed by folding the event log:

```
replayEpistemicState(events)  → reconstruct beliefs
replayControlState(events)    → reconstruct why it reasoned that way
```

Both cognition and control are event-sourced, so the system can explain not only what it believes but why it chose to reason that way.

---

## §8 — Trust, Risk, and Reversibility Manifold

Governance is continuous, not categorical (**B6**, **H10**). Every candidate receives a governance profile:

```
interface GovernanceProfile {
  trust         : number    // calibrated source/proposal trust
  confidence    : number    // epistemic confidence
  risk          : number    // expected harm / irreversibility
  reversibility : number    // ease of rollback
  blastRadius   : number    // scope of impact
  proofStatus   : ProofStatus
  judgeStatus   : JudgeStatus
  simulationStatus: SimulationStatus
}
```

The commit path is determined by a policy surface:

| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| High | Low | High | Auto-commit |
| High | Medium | High | Shadow-commit then promote |
| Medium | Low | High | Provisional commit with decay |
| Medium | Medium | Medium | Human review |
| Low | High | Low | Reject |
| Any | High | Low | Strong proof or human approval required |

Actions are typed by reversibility (informational → reversible-local → reversible-external → hard-to-reverse → irreversible → forbidden), and irreversible actions require risk classification and authorization (**H10**).

---

## §9 — Governed Reflexivity

All learning and self-modification are proposals, never direct rewrites of epistemic law (Axiom IV, **H4**, O6).

### 9.1 The learning ladder

| Domain | Mutates | Direct? | Governance |
|---|---|---|---|
| Attention weights | Focus allocation | Sometimes auto | Low risk |
| Strategy / temperature | Inference behavior | Proposal or auto | Medium risk |
| Parameter tuning | Budgets/thresholds | Proposal | Medium risk |
| Rule induction | Symbolic rules | Proposal | Proof + shadow validation |
| Patch generation | Code/config | Proposal | CI + approval |
| Governance change | Gates/policies | **Never self-applied** | External governance |
| Reward function | Utility weights | **Never direct** | Human/external approval |

### 9.2 The self-improvement cycle

```
observation → lesson → hypothesis → strategy proposal
  → shadow test → bounded deployment → trace evaluation
  → retention | rollback
```

Self-modification is a special case of epistemic commitment, routed through the same commit ledger, so it inherits auditability, rollback, and governance. The invariant:

> Learning may propose changes to cognition, but it may not directly rewrite the laws of epistemic commitment.

---

## §10 — Substrate Arbitration: Hybrid Synergy

Symbolic, exact, probabilistic, neural, and heuristic mechanisms coexist under explicit arbitration (**O7**, **B4**, **H8**).

### 9.1 The arbiter pattern

- **Neural / LM / reflex / peer** components are **untrusted proposers**. They generate candidates; they never decide.
- **Symbolic (non-axiomatic evidential logic)** and the **calibrated judgment manifold** judge, calibrate, veto, and commit.
- **Exact computation** (dependent-type / e-graph rewriting) is a **gated oracle**: it runs behind an action gate, with **memory isolation** from uncertain substrates.

### 9.2 Contamination prevention

An exact substrate **never** unions nodes on uncertain similarity (**H8**). Equality-saturation and uncertain-inference exchange only typed proposals through the arbiter boundary; they do not share memory or a unified equivalence relation.

### 9.3 Symbolic fallback

Every neural/LM function has a symbolic fallback so that model outage degrades to a known weaker mode rather than cognitive outage (Axiom V, **C3**). The LM is a judged proposer, never the core controller (anti-goal **A5**).

---

## §11 — Provenance and Causal Observability

Provenance is causal, not merely append-only (**O2**, Axiom III, **C2**).

### 11.1 The correlation manifold

Every object carries:

```
interface Provenance {
  correlationId, stimulusId, sessionId, cycleId,
  transactionId, proposerId, judgeId?, proofId?, parentId?
}
```

This makes the following queries well-formed at any depth:
- Which stimulus caused this belief?
- Which derivation led to this action?
- Which judge vetoed this candidate?
- Which free-energy exhaustion caused this degradation?
- Which contradiction triggered this repair loop?

### 11.2 Standalone verification

The derivation verifier is **code-independent** of the inference engine (**H7**): it carries a transcribed truth table, imports no engine algebra, and its drift from the engine is measured and pinned by test. Replay is hash-verified and deterministic.

### 11.3 Anti-bloat

Observability is graded by transaction kind and risk (anti-goal **A4**): high-risk and high-Δ𝓕 transactions log at full fidelity; low-risk routine operations log compactly. The recorder is itself bounded.

---

## §12 — Failure and Degradation Semantics

Failure policies are first-class, composable, and never silent (**H9**, Axiom V, **C3**).

### 12.1 The failure algebra

```
FailurePolicy ∈ { propagate, abstain, degrade(f), retry(n),
                  fail-closed, fail-open, escalate }
```

Policies compose: `P₁ ⊕ P₂` (try P₁ then P₂), `P₁ ⊗ P₂` (apply P₁ to the error of P₂).

### 12.2 Directional polarity

- **Ingress** (untrusted → memory): **fail-closed**. An unjudged stimulus must not enter.
- **Internal cognition**: **fail-open**. A provider fault must not halt bounded cognition.
- **Irreversible egress**: **fail-closed under risk**.

### 12.3 Typed faults

Every swallowed or degraded fault emits a typed event (`engine.fault`, `reservation.denied`, `judge.timeout`). No fault affecting cognition, budget, or admission is silent. Starvation is distinguishable from health.

---

## §13 — The Constitution: Feasibility Laws

The hard constraints, stated as formal predicates. A design point is valid iff all hold.

| # | Law | Formal statement |
|---|---|---|
| **Φ1** | Epistemic firewall | `write(reward) ∩ Belief.truth = ∅` |
| **Φ2** | Judged admission | `untrusted(x) ⇒ judged(x) ∨ provisional(x)` before commit |
| **Φ3** | Provenance completeness | `∀ mutation m, ∃ event e : causes(e, m)` |
| **Φ4** | No self-approval | `selfmod(x) ⇒ approved_by(x, external ∨ higher_rung)` |
| **Φ5** | Boundedness | `∀ path p, cost(p) ≤ Φ ∧ memory(p) ≤ S_max` |
| **Φ6** | Scheduler transparency | `∀ selection s, logged(s) ∧ inspectable(Δ𝓕, T, candidates)` |
| **Φ7** | Verifier independence | `imports(verifier) ∩ imports(engine) = ∅` |
| **Φ8** | Exact isolation | `union_egraph(a,b) ⇒ ¬uncertain_similarity(a,b)` |
| **Φ9** | No silent failure | `fault(f) ∧ cognitive(f) ⇒ emitted(f)` |
| **Φ10** | Irreversibility gating | `irreversible(a) ⇒ risk_classified(a) ∧ authorized(a)` |
| **Φ11** | Evidence independence | `revision(e₁,e₂) requires independent(e₁,e₂)` |
| **Φ12** | Replay determinism | `replay(log) ≡ original_state` via pure reducers |

**Φ1, Φ4, Φ7, Φ8, Φ11** are the deep load-bearing laws; the others are their operational projections.

---

## §14 — The Minimal Viable Kernel

Despite the richness above, the architecture reduces to a small load-bearing core. Everything else is enrichment that can be dialed from "present" to "absent" without leaving the design space.

### The five irreducible components

1. **A substrate** — typed terms + an evidence-sensitive truth algebra + an exact oracle.
2. **A control word / graph** — the declarative cognitive graph executed by the Boltzmann scheduler.
3. **An admission gate** — the boundary between outside and state.
4. **A free-energy monoid** — reservation, charge, settlement, entropy export.
5. **A provenance fold** — append-only log, correlation, replay, standalone verifier.

### The kernel control loop

```
while running:
    stimulus   ← observe()
    corrId     ← mintCorrelationId(stimulus)
    state      ← ledger.fold()
    program    ← metaController.selectProgram(state, stimulus)   // proposes
    Φ          ← freeEnergyOffice.reserve(program.allocation)
    candidates ← executeCognitiveGraph(program.graph, state, Φ, corrId)
    judged     ← verificationPortfolio.judge(candidates, program.proofPolicy)
    committed  ← commitLedger.commit(judged, program.riskPolicy, Φ)
    actions    ← actionController.plan(committed)
    for a in actions: actionPipeline.execute(a, sandbox, rollback, approval)
    learningEngine.observe(stimulus, committed, actions, outcome)
    learningEngine.proposeChanges(commitLedger)      // proposals, never direct
    consolidate(state, Φ, S)                          // entropy export
    observability.emitCausalTrace(corrId)
```

### Extension points (typed ports)

Substrates, schedulers, judges, memory backends, governance policies, and action pipelines are all replaceable behind typed ports. The kernel depends on contracts, not implementations (bias D5 within the D3 frame).

---

## §15 — Synthesis Statement

The Helmholtz Architecture is the point in the reasoner design space where:

- **Resource governance** is *thermodynamic* — a finite Helmholtz free-energy pool, a governed temperature, and a bounded entropy ceiling replace static counters, and Boltzmann selection over expected free-energy reduction replaces fixed sequencing.
- **Control** is *data* — a declarative, conditional, heterochronous cognitive graph, with a meta-controller that proposes programs under governance.
- **Mutation** is *unified* — every perception, inference, proposal, action, learning step, and self-modification is one typed transaction passing through one commit ledger.
- **Epistemics** are *firewalled* — belief and goal are disjoint types with disjoint mutation authority; paraconsistency is tolerated; evidence independence prevents laundering.
- **Trust** is *manifold* — calibrated trust, risk, reversibility, and proof jointly determine the commit path, with a governed autonomy ladder.
- **Provenance** is *causal* — correlation-threaded, replayable, independently verifiable, and graded against bloat.
- **Reflexivity** is *governed* — the system may propose changes to its strategies, rules, and code, but never self-approves and never rewrites the laws of epistemic commitment.

It is simultaneously **powerful** (continuous adaptive scheduling, hybrid substrates, concurrent multi-rate cognition), **safe** (epistemic firewall, judged admission, external governance, irreversibility gating), **auditable** (causal replay, standalone verification, transparent thermodynamic scheduling), and **elegant** (one calculus, one transaction, one ledger, one governance vocabulary, one resource model).

The deepest unification: **scarcity, attention, curiosity, forgetting, and control are all instances of one thing — the minimization of free energy under a bounded budget.** That is the single principle from which the whole architecture follows.

---

*End of specification. The constitution (§13) is the acceptance test; the kernel (§14) is the migration target; the calculus (§2) is the soul.*
