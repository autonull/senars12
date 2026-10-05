# AEGIS
### Adaptive Epistemic Governance & Inference Substrate
**A Complete, Self-Contained Specification for a Governed Hybrid Reasoner**

---

## 0. Preamble

AEGIS is built on a single thesis:

> **A reasoner is not primarily a "thinking engine." It is a governed controller that transforms observations and internal states into justified commitments under scarce resources.**

From this, one master abstraction follows and organizes everything:

> **All cognition is a typed, budgeted, governed transaction that is proposed, verified, and committed through a single ledger — and every such transaction is causally observable.**

Perception, attention, inference, neural proposal, judgment, action, learning, forgetting, consolidation, and self-modification are not separate subsystems bolted together. They are the **same class of operation** — a `CognitiveTransaction` — differing only in type, cost, trust requirements, and commit path. This is what makes AEGIS simultaneously **ambitious** (it can express any reasoner behavior), **flexible** (control flow is data), **scalable** (multi-rate, multi-focus, multi-agent), **comprehensive** (one model covers epistemics, control, resources, governance, and reflexivity), and **customizable** (every component is a declarative, pluggable axis).

The design is **safe by construction**, not safe by convention: a feasibility predicate Φ carves the space of coherent configurations, and every AEGIS deployment is a point that satisfies Φ by design.

---

## 1. Constitution

### 1.1 Governing Selections

**Prime Objectives** (selected — the ambitious set):
`O1` epistemic integrity · `O2` causal provenance · `O3` control-plane fluidity · `O4` resource economics · `O5` minimal kernel · `O6` governed reflexivity · `O7` neuro-symbolic synergy · `O8` unified commit ledger · `O9` compositional configurability · `O11` cognitive richness · `O12` formal rigor · `O14` ecological reasoning

**Hard Constraints** (all ten — non-negotiable):
`H1`–`H10`

**Anti-Goals** (resolved):
`A1` no abstraction-before-runnable-kernel · `A2` no opaque scheduler · `A4` no audit bloat · `A5` no monolithic LM authority · `A6` multi-agent is a gated layer, not core · `A7` no unbounded cognitive richness

### 1.2 Character Bias & Precedence

AEGIS maximizes across **D1–D6**, with a strict precedence order for resolving conflicts:

```
Safety (A)  >  Auditability (D1)  >  Unification (D3)  >  Modularity (D5)
            >  Adaptivity (D6)    >  Power (D2)        >  Robustness (D4)
```

### 1.3 The Master Resolution Law — Guarantee Conservation

> **You can relocate guarantees, but you cannot create them for free.**

Spending freedom in scheduling (adaptivity, markets, learned control) *costs* auditability **unless** you re-spend on provenance and correlation. AEGIS never drops a guarantee to buy power; it **buys power by re-anchoring guarantees in provenance and gated admission** rather than in rigidity.

### 1.4 Load-Bearing Invariants (never traded)

| # | Invariant |
|---|---|
| I1 | **Epistemic firewall** — reward/desire never mutates factual truth |
| I2 | **Single write authority** — all durable mutation passes one commit port |
| I3 | **Event-sourced state** — state = fold of append-only log |
| I4 | **Untrusted proposers, trusted judgment** — proposals are judged before commit |
| I5 | **Bounded cognition** — AIKR: budgets, forgetting, decay, interruption are first-class |
| I6 | **Independent verification** — the checker shares no code with the engine |
| I7 | **Inspectable control** — no opaque scheduler decision |

---

## 2. Formal Foundation

### 2.1 The Reasoner Tuple

An AEGIS reasoner is the 9-tuple:

```
R = ⟨ Σ, κ, β, ε, Γ, V, μ, Ω, F ⟩
```

| Symbol | Name | Role |
|---|---|---|
| **Σ** | Epistemic state | The typed, event-sourced knowledge base |
| **κ** | Control word / graph | Declarative control flow (data, not code) |
| **β** | Resource economy | Budgets, reservations, prices, markets |
| **ε** | Governance manifold | Trust × risk × reversibility → commit path |
| **Γ** | Commit ledger | The single admission/commit authority |
| **V** | Verification portfolio | Proofs, calibrated judges, simulators |
| **μ** | Reflexive tower | Governed self-modification levels |
| **Ω** | Provenance graph | Correlation, replay, causal navigation |
| **F** | Failure policy map | Per-transaction degradation semantics |

### 2.2 The Feasibility Predicate Φ (the Constitution of the Space)

A configuration `r` is **legal** iff `Φ(r)` holds. These are not style preferences; violating any one produces an unstable or unsafe reasoner.

| # | Constraint | Rationale |
|---|---|---|
| **Φ1** | `reward ∉ writers(Belief.truth)` | Belief corruption / sycophancy |
| **Φ2** | untrusted proposer ⇒ judge gate before commit | Evidence laundering |
| **Φ3** | code self-mod ⇒ shadow validation ∧ external arbiter ∧ event-sourced | Self-approval is unsound (Löbian) |
| **Φ4** | self-mod ⇒ step-level audit | Ungoverned mutation |
| **Φ5** | event-sourced ⇒ deterministic replay | Non-reproducible audit |
| **Φ6** | exact/e-graph substrate ∉ union-on-uncertain-similarity | Equality contamination |
| **Φ7** | AIKR ⇒ bounded containers ∧ forgetting ∧ anytime | Memory exhaustion / hang |
| **Φ8** | verifier imports ∉ engine | Co-adaptation hides bugs |
| **Φ9** | anytime ⇒ preemptive scheduler ∧ partial results | Lost work on interrupt |
| **Φ10** | learned/market scheduler ⇒ full decision provenance | Opaque control (anti-goal A2) |
| **Φ11** | irreversible action ⇒ risk classification ∧ authorization | Uncontained blast radius |
| **Φ12** | paraconsistent retention ⇒ graded truth carrier | Explosion via monotonic chaining |
| **Φ13** | non-axiomatic logic ⇒ graded evidence ∧ resource posture | Undefined revision |
| **Φ14** | attention economy ⇒ decay | Saturation / starvation |

**Configurations are validated against Φ at load time.** An infeasible config is rejected before any cognition runs.

---

## 3. The Master Abstraction — Cognitive Transactions

### 3.1 Definition

Every unit of cognition is a typed transaction. This is the single object class from which all behavior is composed.

```typescript
interface CognitiveTransaction {
  id:               TransactionId;
  correlationId:    CorrelationId;        // threads stimulus → … → outcome
  kind: TransactionKind;                  // §3.2
  inputs:           CognitiveObject[];
  outputs:          Candidate[];
  effects:          EffectDeclaration[];  // what it *may* write
  budget:           BudgetReservation;    // §8
  capabilities:     CapabilityToken[];
  governance:       GovernanceProfile;    // §9
  fallback:         FailurePolicy;        // §14
  proofObligations: ProofObligation[];
  reversibility:    ReversibilityClass;
}

type TransactionKind =
  | "perception" | "attention" | "retrieval" | "inference"
  | "proposal"   | "judgment"  | "commit"    | "action"
  | "learning"   | "forgetting"| "consolidation" | "simulation"
  | "self-modification";
```

### 3.2 Why One Class?

Because it collapses every accidental asymmetry into **one governed pipeline**. There is no longer a special path for perception, another for LM proposals, another for learning, another for self-patches. They are all `Candidate`s flowing to one ledger. The differences are **fields on the transaction** (trust, risk, reversibility, budget), not separate code paths.

---

## 4. Epistemic State & Type System

### 4.1 Cognitive Attitudes (the typed state)

AEGIS separates epistemic and teleological content at the **type level**, and adds a richer attitude vocabulary:

| Type | Meaning | Value structure | Axis |
|---|---|---|---|
| **Belief** | Taken-to-be-true | `(frequency, confidence)` | epistemic |
| **Goal** | Wanted | `(desire, confidence)` | teleological |
| **Question** | Wanted-to-know | priority + expected info gain | epistemic |
| **Hypothesis** | Provisional explanation | plausibility + evidence requirement | epistemic |
| **Assumption** | Local premise | scope + validity | epistemic |
| **Plan** | Action sequence | utility + feasibility + risk | teleological |
| **Obligation** | Normative commitment | priority + deadline | teleological |
| **Permission** | Allowed action class | scope + conditions | governance |
| **ActionIntent** | Prepared effect | reversibility + authorization | teleological |
| **Lesson** | Distilled correction | source + trust + applicability | learning |

Every object carries a `CognitiveAxis ∈ {epistemic, teleological, governance, learning}` tag that crosses every boundary.

### 4.2 Truth Calculus

- **Beliefs:** `(f, c)` — frequency × confidence, non-axiomatic, evidence-relative under insufficient resources.
- **Goals:** `(d, c)` — desire × confidence, progress-revised.
- **Revision:** evidence combination with an **evidence-independence check** (prevents the same evidence being double-counted through many derivation paths).
- **Paraconsistency:** contradictions `(A→B)` and `¬(A→B)` **coexist** with distinct truth values; graded retention, no explosion.
- **Decay is decoupled:** truth decays only on invalidation/contradiction; attention/priority decays by access. *(Φ14, and protects valid beliefs from evaporating.)*

### 4.3 The Epistemic Firewall (I1 / Φ1)

Enforced at three levels, not one:
1. **Type level** — `Belief` and `Goal` are distinct types; no reward schema can produce a `Belief`.
2. **Mutation-authority level** — reward signals may write only to `{attention-priority, policy-weights}`. Any attempt to mutate `Belief.frequency/confidence` raises an `EpistemicFirewallViolation`.
3. **Domain level** — reward domains are split; unknown domain ⇒ fail-closed `CrossDomainError`.

### 4.4 Memory Architecture

Bounded, layered, port-based:

- **Working** — bounded priority bags, fast decay.
- **Episodic** — event-tied, retrieval-verified consolidation.
- **Semantic** — consolidated, slow decay.
- **Procedural** — learned skills/schemas (governed).
- **Counterfactual** — simulation/imagination sandbox (no durable writes).

All accessed through **typed ports** (the contract, not the implementation, is load-bearing). All containers are capacity-bounded with LRU + pressure-driven consolidation.

---

## 5. The Commit Ledger (Single Commit Authority — I2, O8)

### 5.1 Principle

> **Every durable mutation is a proposal. Every proposal is judged. Every accepted proposal is committed through one ledger.**

This includes perceptions, derived beliefs, generated goals, neural formalizations, reflex proposals, tool results, schema inductions, strategy changes, knob tunings, patches, action intentions, and human corrections.

### 5.2 The Admission Pipeline

```
Candidate
  → Normalize
  → Type-Check                     (attitude + axis)
  → Evidence-Independence Check    (no laundering)
  → Verify { proof | judge | simulation }
  → Rank                           (calibrated score × decisiveness)
  → Budget Settlement
  → Risk / Reversibility Classification
  → Commit  |  Reject  |  Defer
```

The answer to *"where does state change happen?"* is always: **the commit ledger.**

### 5.3 Event-Sourced State (I3 / Φ5)

- The **append-only event log is the source of truth**; snapshots are caches.
- Every commit emits a typed `CognitiveEvent`.
- `replayState(events)` reconstructs Σ; state-hash verification confirms determinism.
- Pure reducers guarantee `replay ∘ log ≅ id` on reachable states.

---

## 6. Declarative Control — The Cognitive Graph (O3, B1)

### 6.1 Control Flow Is Data

The fixed stage loop is replaced by a **conditional cognitive DAG** (equivalently, a Kleene-Algebra-with-Tests control word). Stages are nodes; transitions are guarded, budgeted edges.

```typescript
interface StageNode { id: StageId; run: Middleware<CycleCtx>; }
interface StageEdge {
  from: StageId; to: StageId;
  when: (ctx: CycleCtx) => boolean;   // conditional edge
  budget?: BudgetScopeId;             // edge may cost a scope
  parallel?: boolean;                 // fan-out / join
}
```

Example skeleton (edges conditional):

```
Perceive → Attend → Retrieve → Infer → Propose → Verify → Rank
   → Commit → Plan → Act → Learn → Consolidate

Infer   → Propose   if budget.remaining > θ
Propose → Verify    if proposer.untrusted
Verify  → Commit    if proof.ok ∨ judge.score > θ_admit
Commit  → Act       if action.risk ≤ autonomy.allowedRisk
Learn   → MetaPropose if learning.domain ≠ forbidden
```

### 6.2 Compiled Invariants

What other systems enforce with review comments, AEGIS enforces **by graph compilation**:

- no write outside `Commit`
- no untrusted proposal outside `Verify`
- no reward update to belief truth
- no unbounded read without `control-work`
- no external action without risk/reversibility classification
- no neural import into the symbolic hot path except through a bounded port

Stage-skipping, parallel foci, and alternative loops are **expressible without restructuring.** The graph is loaded, versioned, and revertable — like the rule table.

---

## 7. The Scheduler & Meta-Controller (O3, B2, D6)

### 7.1 Controller Portfolio

The scheduler is a **meta-controller that chooses cognitive programs**, not a fixed dispatcher. It maintains a portfolio:

| Controller | Behavior |
|---|---|
| **Deliberative** | deep inference, high proof burden |
| **Reactive** | fast reflexes, low latency |
| **Curious** | exploration, question generation |
| **Conservative** | high rejection threshold, low risk |
| **Creative** | high proposal diversity, sandboxed |
| **Social** | clarification-seeking, human-in-loop |
| **Repair** | contradiction resolution, test fixing |
| **Consolidating** | decay, schema induction, sleep-like integration |

### 7.2 Cognitive Programs

The meta-controller's output is not an action but a **program**:

```typescript
interface CognitiveProgram {
  stageGraph:        StageGraph;
  budgetAllocation:  BudgetAllocation;
  proposerPortfolio: ProposerWeights;
  verificationPolicy: VerificationPolicy;
  autonomyPolicy:    AutonomyPolicy;
  learningPolicy:    LearningPolicy;
}
```

Selection/blending is driven by drives, budgets, risk, recent reward, trace grades, human corrections, and environmental volatility.

### 7.3 Inspectable Adaptation (I7 / Φ10)

A learned or market-based scheduler is permitted **only because** every scheduling decision is itself a typed, event-sourced `CognitiveEvent` (Guarantee Conservation). Control state is replayable: `replayControlState(events)` reconstructs *why* the system chose to reason the way it did. **There is no opaque scheduler.**

---

## 8. Resource Economy (O4, B5)

### 8.1 Budget Dimensions

```
cycles · derivations · premises · memoryOps · llmCalls · tokens
latency · attention · risk · humanAttention
```

One table, one arithmetic (typed `TerminationReason` on exhaustion — **no silent swallow**, H9).

### 8.2 Reservations, Prices, Markets

- **Reserve before execute:** `B_available ← B_available − B_reserved`; settle after: `B_settled = B_reserved − B_unused`. Prevents silent starvation and gives real backpressure.
- **Utility pricing:** `score(op) = (ΔK̂ + ΔĜ + ΔĤ) / (λ_c·Ĉ + λ_r·R̂ + λ_h·Ĥ_human)` — expected cognitive gain per scarce resource.
- **Market clearing:** scopes bid for budget by expected marginal value each cycle; exhaustion becomes *"outbid by higher-value work,"* not silent truncation.
- **Bounded ladder & transfer:** scopes form a lattice; surplus may lend to starved siblings while preserving the global budget (AIKR still binds).

### 8.3 Graceful Behavior Under Pressure

| Pressure | Behavior |
|---|---|
| low | explore, enrich, elaborate |
| medium | prioritize goals and proofs |
| high | conserve, degrade to symbolic, ask for help only when necessary |

### 8.4 Optional Thermodynamic Layer

For maximal fluidity, integer quotas may be replaced by an energy-based allocation: probability of pursuing a path `P ∝ exp(−ΔE / T)`, where `T` (cognitive temperature) interpolates exploration ↔ exploitation. This is a **configurable economy mode**, not required.

---

## 9. Trust, Risk, Reversibility Manifold (O6 governance, B6)

### 9.1 Governance Profile

Every candidate receives:

```typescript
interface GovernanceProfile {
  trust:         number;   // calibrated source/proposal trust
  confidence:    number;   // epistemic confidence
  risk:          number;   // expected harm / irreversibility
  reversibility: number;   // ease of rollback
  blastRadius:   number;   // scope of impact
  proofStatus:   ProofStatus;
  judgeStatus:   JudgeStatus;
  simulationStatus: SimulationStatus;
}
```

### 9.2 The Policy Surface

Commit path is a function of `(trust, risk, reversibility, proof, autonomy)`:

| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| High | Low | High | Auto-commit |
| High | Medium | High | Shadow-commit → promote |
| Medium | Low | High | Provisional commit + decay |
| Medium | Medium | Medium | Human review |
| Low | High | Low | Reject |
| Any | High | Low | Strong proof **or** human approval |

This generalizes action authorization from actions to **all** cognitive mutations.

### 9.3 Autonomy Ladder (H4, H10)

`observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production`

A finite-state machine over all five rungs. Irreversible actions require risk classification + authorization (Φ11).

### 9.4 Calibrated Judgment & the Proposer/Judge Adjunction (I4 / Φ2)

```
propose : M → Proposal      (System 1 — LM / reflex / peer)
   ⊣
admit   : Proposal → M      (System 2 — NAL + manifold judge)
```

The **Judgment Manifold** is the unit/counit measuring how much of a proposal survives judgment — making "how much do we trust System 1" a **continuous, calibrated parameter**, not a wiring decision. Tightening → pure symbolic; loosening → neural-heavy. On fault, judgment degrades to the symbolic baseline (H2/C3).

---

## 10. Substrate Synergy & Arbitration (O7, B4)

### 10.1 The Substrate Portfolio

| Substrate | Role | Trust posture |
|---|---|---|
| **Symbolic (NAL)** | uncertain inference, revision, veto authority | trusted core |
| **Exact (rewriting / e-graph)** | definitional computation | trusted, isolated |
| **Probabilistic** | calibrated scoring | judged |
| **Neural / LM** | proposal generation, formalization, narration | **untrusted proposer** |
| **Reflex / RL** | fast learned responses | untrusted proposer |
| **Peer agents** | delegated proposals | untrusted, capability-tokened |

### 10.2 Arbitration Algebra

All proposers submit through one interface and are judged by one trust field:

```
arbitrate : Proposer[] × Proposal[] → Decision
  with  veto       (symbolic core retains veto)
        quorum     (k-of-n agreement)
        weighting  (confidence-weighted merge)
        demotion   (vetoed proposer's weight decays)
```

The firewall is enforced **inside** the algebra: a `teleological` proposal can never merge into a `belief` slot regardless of quorum.

### 10.3 Isolation Invariants (Φ6 / Φ8)

- The exact substrate **never unions** nodes on uncertain similarity.
- Substrates exchange **proposals through a boundary** (arbiter pattern); they do not share mutable memory.
- Every neural function has a **symbolic fallback** (graceful degradation when models are absent).

---

## 11. The Heterochronous Tower (O11, C-richness)

Cognition runs at multiple natural clock rates, coordinated through the shared event log and budgets — not synchronous nesting:

```
Level 4 · Identity        (≪ 1/cycle)  schema induction, constitution review
Level 3 · Consolidation   (every K)    decay, eviction, episodic merge
Level 2 · Deliberation    (macro turn) perceive→recall→reason→narrate→act→record
Level 1 · Tick            (micro cycle) perceive→attend→reason→authorize→propose→learn
Level 0 · Reflex arc      (sub-cycle)  fast-judge, safety veto, game tick
```

Lower levels may **interrupt** higher (reflex veto); higher levels **configure** lower. Each level is an instance of the same stage-graph runner with its own budget slice and trust posture. Drives, curiosity, imagination (counterfactual simulation), and self-assessment live here — **all budgeted and governed** (anti-goal A7).

---

## 12. Provenance & Causal Observability (O2, C2)

### 12.1 Universal Correlation

Every object and event carries:

```typescript
interface Provenance {
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
```

### 12.2 The Causal Graph

The event log is **causally navigable**, enabling:
- *Which stimulus caused this belief?*
- *Which derivation led to this action?*
- *Which judge vetoed this candidate?*
- *Which budget exhaustion caused this degradation?*
- *Which learning episode changed this strategy?*

### 12.3 Independent Verification (I6 / Φ8)

- Derivations carry step-level premise truths and lineage DAGs.
- The **standalone verifier** imports nothing from the engine; the truth table is transcribed.
- **Drift between engine and verifier is measured and pinned by test**, never assumed zero.

---

## 13. Reflexivity & Governed Self-Modification (O6, C1)

### 13.1 The Self-Modification Ladder (Φ3 / Φ4)

| Level | Mutates | Authority |
|---|---|---|
| 0 | Frozen | — |
| 1 | Knobs/parameters | auto or low-risk |
| 2 | Strategies | proposal or auto |
| 3 | Rules (schema induction) | proof + shadow validation |
| 4 | Code / architecture | shadow CI + **external immutable arbiter** |

**Learning may propose changes to cognition, but it may never directly rewrite the laws of epistemic commitment.** Self-modification is a special case of epistemic commitment, routed through the same ledger — with proposal, shadow execution, rollback, and progressively stronger authority.

### 13.2 The Safe Self-Improvement Path

```
observation → lesson → hypothesis → strategy proposal → shadow test
   → bounded deployment → trace evaluation → retention | rollback
```

The meta-controller **proposes** control-graph edits; it does **not apply** them. Edits install only at cycle boundaries (hot-swap, preserving in-flight state) and inherit the autonomy ladder.

---

## 14. Degradation & Failure Policy (C3, H9)

### 14.1 Per-Transaction Failure Polarity

Each transaction declares its failure semantics: `fail-open | fail-closed | abstain | degrade(f) | fallback`.

The **directional default**:
- **Ingress** (untrusted → memory): **fail-closed** — an unjudged stimulus must not enter.
- **Egress / internal cognition**: **fail-open** — a provider fault must not halt bounded cognition.

### 14.2 No Silent Swallow

Every fault is a typed event. Degradation is a **known weaker mode**, never undefined behavior:
- LM unavailable ⇒ symbolic fallback.
- Judgment unaffordable ⇒ symbolic baseline.
- Budget exhausted ⇒ outbid / skip with typed `TerminationReason`.
- Abstention ⇒ clarification question + curiosity spike, not a drop.

---

## 15. Configurability & Customization (O9, D5)

### 15.1 The Spec Literal

A deployment is a declarative literal over 20 axes in 5 clusters. Every component is a typed, pluggable axis:

```
AEGIS = {
  K: { substrate, language, world, calculus, consistency }   // Knowledge
  I: { spectrum, direction, exact, termination }              // Inference
  C: { resources, scheduler, forgetting }                     // Control
  L: { locus, reward, beliefGoal }                            // Learning
  A: { trust, provenance, governance, embodiment, composition }// Authority
}
```

### 15.2 Profiles, Presets, Tiers

- **Profiles** (e.g., `device` / `conversation` / `research`) shift substrate & neural axes.
- **Presets** (e.g., `FAST` / `NEURAL_HEAVY` / `DEEP_AUDIT`) shift judgment depth, learning, provenance caps.
- **Feature toggles** (RL, self-improvement, persistence, System-One) move within a bounded subspace.

**The invariants I1–I7 and Φ are the manifold boundary**: every reachable sub-point still satisfies Φ. You can customize everything *except* the load-bearing core.

### 15.3 Config-Time Feasibility

The config literal is validated against Φ before instantiation. Infeasible combinations (e.g., reward-writes-truth, code-self-mod-without-external-arbiter, opaque-scheduler) are **rejected at load time.**

---

## 16. Scalability & the Ecological Layer (O14 — gated, off by default)

Multi-agent reasoning is a **capability layer**, not core (anti-goal A6), activated only once single-agent control is stable and proven:

- **Delegation** — propose/respond over typed transports.
- **Peer proposals** — other agents are untrusted proposers (same manifold).
- **Shared calibration** — cross-agent manifold digests / collective isotonic fit.
- **Collective verification** — mutually-verified ensembles with independence accounting.
- **Capability tokens** — scoped authority for delegated actions.
- **Provenance fusion** — event-log merge with cross-process replay hashing.

---

## 17. Incremental Implementability (O5, O13, anti-goal A1)

AEGIS is layered so a **minimal runnable kernel** exists at every stage. Build order:

| Phase | Delivers | Invariants active |
|---|---|---|
| **0. Kernel** | substrate + control word + gate + budget + provenance fold | I1–I3, I5 |
| **1. Ledger** | unified commit port; all mutation → transactions | I2, I4 |
| **2. Graph** | control flow as data; conditional stages | I7, Φ10 |
| **3. Economy** | reservations + prices; static → adaptive budgets | Φ9 |
| **4. Manifold** | calibrated judgment; trust/risk/reversibility surface | Φ2, Φ11 |
| **5. Tower** | heterochronous multi-rate loops | Φ7 |
| **6. Reflexivity** | governed self-modification ladder | Φ3, Φ4 |
| **7. Ecology** | multi-agent delegation & collective verification | Φ2 |

Each phase preserves the invariants of all prior phases. **The elegance never depends on replacing the whole runtime at once.**

### The Tick (assembled)

```
while running:
  stimulus      = observe()
  correlationId = mint(stimulus)
  state         = ledger.fold()
  program       = metaController.selectProgram(state, stimulus)
  budget        = budgetOffice.reserve(program.budget)
  candidates    = executeGraph(program.stageGraph, state, stimulus, budget, correlationId)
  governed      = verifyPortfolio.judge(candidates, program)
  committed     = ledger.commit(governed, budget, program.risk, program.autonomy)
  actions       = actionController.plan(committed, worldModel)
  execute(actions) with sandbox + rollback + approval
  learningEngine.proposeChanges(ledger)      // proposals, never direct
  consolidate(state, budget)
  observability.emitCausalTrace(correlationId)
```

---

## 18. Formal Recap

```
AEGIS = ⟨
  transaction-graph topology,        // control flow is data
  economic meta-controller,          // adaptive, inspectable scheduling
  reservation-market budgeting,      // resources as economy
  typed epistemic attitude algebra,  // belief/goal/question/plan firewall
  portfolio proposers,               // symbolic + exact + probabilistic + neural + reflex
  proof / judge / simulation portfolio,
  single commit ledger,              // one write authority
  trust-risk-reversibility manifold, // governance is a policy surface
  governed self-modification,        // proposal → shadow → external arbiter
  causal provenance graph,           // correlation + replay + independent verifier
  heterochronous tower,              // multi-rate cognition
  per-transaction failure policy     // graceful, never silent
⟩
```

**Design principle, restated:**

> *All cognition is proposal. All commitment is governed. All resource use is explicit. All learning is accountable. All state is event-sourced. All explanation is causal.*

AEGIS is the point in the reasoner design space that is **ambitious** in expressiveness, **flexible** in control, **scalable** across rates and agents, **comprehensive** across epistemics–control–resources–governance–reflexivity, and **customizable** along every axis — while remaining, by construction, **epistemically intact, bounded, and fully auditable.**
