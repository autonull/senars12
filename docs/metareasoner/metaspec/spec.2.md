# METAREASONER — Ultimate Meta-Reasoner Architecture Specification

# 1 · Overview

Ultimate meta-reasoner architecture: an abstract, universal, governed cognitive control system.

## The Thesis

A reasoner is not primarily a thinking engine — it is a **governed controller** that transforms observations and internal states into **justified commitments** under scarce resources.

> All cognition is proposal. All commitment is governed. All resource use is explicit.
> All learning is accountable. All state is event-sourced. All explanation is causal.

## Contents

| # | File | Contents |
|---|---|---|
| 1 | §2 Core Architecture | Executive summary; four core abstractions (Cognitive Transaction, Control Graph, Commit Ledger, Resource Economy); 12-tuple formal model; component specifications; reasoner coverage table; configurability; scalability tiers; behavioral coordinates |
| 2 | §3 Formal Model | Stratified product space (Semantics / Economy / Governance planes); epistemic type system; KAT control calculus; gate lattice; reflexive filtration F₀–F₆; constitution Φ as equational laws; composition algebra; instantiation tiers; Pareto tradeoffs |
| 3 | §4 Components | Substrate layer (NAL, MeTTa, neural, arbitration); control layer (DAG, KAT word, meta-controller, program portfolio); resource layer (budget lattice, reservation, pricing, thermodynamics); governance layer (gates, trust manifold, judgment, risk, autonomy, verification); memory layer (ports, decoupled decay); provenance layer (event log, correlation, replay, standalone verifier); reflexive tower; stability & degradation ladder |
| 4 | §5 Invariants & Enforcement | Ten load-bearing invariants with enforcement + falsification test; twelve feasibility laws Φ; coupling constraints; static/dynamic/observability enforcement architecture; preservation under composition; load-time rejection criteria; runtime monitoring; per-phase migration invariants |
| 5 | §6 Configurations | Specification grammar; three profiles (device / conversation / research); three presets (FAST / NEURAL_HEAVY / DEEP_AUDIT); eight feature toggles; six behavioral coordinates; composition operations; instantiation tiers M₀–M₇ |
| 6 | §7 Migration Strategy | Six-phase migration (kernel → ledger → graph → economy → reflexivity → enrichment); per-phase deliverables, steps, preserved invariants; risk mitigation; rollback strategy; validation gates |

## Load-Bearing Invariants

| # | Invariant |
|---|---|
| I1 | Epistemic firewall — reward/desire never mutates factual truth |
| I2 | Single write authority — all durable mutation passes one commit port |
| I3 | Event-sourced state — state = fold of append-only log |
| I4 | Untrusted proposers, trusted judgment — proposals judged before commit |
| I5 | Bounded cognition — AIKR: budgets, forgetting, decay, interruption first-class |
| I6 | Independent verification — checker shares no code with the engine |
| I7 | Inspectable control — no opaque scheduler decision |
| I8 | Equality isolation — exact substrate never unions on uncertain similarity |
| I9 | No silent failure — faults affecting cognition/budget/admission are events |
| I10 | No irreversible bypass — irreversible actions pass risk classification + authorization |

## The Guarantee-Conservation Law

> **You can relocate guarantees, but you cannot create them for free.**

Spending freedom in scheduling (adaptivity, markets, learned control) *costs* auditability **unless** you re-spend on provenance and correlation. METAREASONER never drops a guarantee to buy power; it **buys power by re-anchoring guarantees in provenance and gated admission** rather than in rigidity.

**Provenance is the currency that purchases adaptivity.**

## The Guarantee Trilemma

Soundness of admitted steps · completeness of ampliative closure · bounded operation — **pick at most two freely.**

METAREASONER occupies the **verifier + bounded** corner: it sacrifices completeness (no axiom of completeness under AIKR) to keep soundness-of-admitted-steps and bounded operation.

## Control Models Covered

| Model | Source | Coverage |
|---|---|---|
| **SeNARS default** | `control1/`, `control2/`, `information1/` | Dual nested loops, priority bags + RLFP, fail-closed ingress, 5-rung autonomy ladder — a *specific* point in the space (§configs 5.5) |
| **Neuro-symbolic governed** | `synth/ambitious`, `synth/flexible` | Transaction model + commit ledger + resource economy + verification portfolio (§spec §1) |
| **Universal calculus** | `synth/universal`, `synth/meta` | Stratified planes, KAT control word, oriented gate lattice, reflexive filtration (§formal) |
| **Cybernetic** | `synth/cybernetic` | Plant/controller/actuator duality, stability definition, degradation ladder (§components §8) |
| **Thermodynamic** | `synth/thermodynamic` | Activation energy, cognitive temperature, Boltzmann allocation (§components §3.4) |
| **Category/coalggebraic** | `synth/category` | Semantic function ⟦·⟧, composition/refinement/restriction (§formal §8) |
| **Topological/geometric** | `synth/topological` | Design-space distance, Pareto fronts (§formal §10) |
| **Biological/autopoietic** | `synth/bio` | Bounded bags, drives, self-reproduction of control structures (§components §8.1) |
| **Mathematical** | `synth/math` | Formal rigor, algebraic laws, typed invariants (§formal) |
| **Future models** | — | Any control word satisfying Φ is expressible without architectural change |

## Core Ontology — Seven Irreducible Sorts

$$\mathcal{M} = \langle \Sigma, \Omega, \mathcal{V}, \mathcal{T}, \mathcal{C}, \mathcal{K}, \mathcal{G}, \mathcal{R}, \mathcal{F} \rangle_{\Phi}$$

| Symbol | Name | Question |
|---|---|---|
| Σ | Substrate | What exists, and how is it typed? |
| Ω | Dynamics | How does state change? |
| 𝒱 | Valuation | How is state scored, and what may reward touch? |
| 𝒯 | Economy | What limits and prices change? |
| 𝒞 | Control | What changes next? |
| 𝒦 | Commit Ledger | What commits? |
| 𝒢 | Governance | What gates and authorizes change? |
| ℛ | Reflexivity | Can the system change its rules for changing? |
| ℱ | Failure Policy | What happens on fault? |

## Precedence Order (Conflict Resolution)

```
Safety (A1–A4)  >  Auditability (D1)  >  Unification (D3)  >  Modularity (D5)
                >  Adaptivity (D6)    >  Power (D2)        >  Robustness (D4)
```

## Anti-Goals — Retained as Binding

| # | Anti-Goal |
|---|---|
| A2 | Avoid scheduler opacity — learned/market schedulers must emit inspectable decision events |
| A5 | Avoid monolithic LM authority — language models remain proposers, never core controllers |

**Rejected as anti-goals** (embraced with named management mechanism):
abstraction-before-runnable-kernel → managed by kernel-first staging · governance paralysis → managed by graduated autonomy · audit bloat → managed by tiered audit · premature multi-agent → managed by stability gate · unbounded richness → managed by budgeted richness.

## Source Corpus

| Directory | Contribution |
|---|---|
| `control1/`, `control2/` | Control-flow analysis of SeNARS: loops, gates, budgets, failure matrices, wiring status (48 flows: 32 wired, 6 gated, 4 partial, 4 bench, 5 dormant) |
| `information1/` | Information-flow graph: payloads, axes, ingress/reason/memory/act/learn flows, cross-cutting concerns |
| `compare.md` | Cross-family analysis of 15 architecture specs; consensus and disagreements |
| `synth/` | Nine flavor/lens syntheses: ambitious, flexible, universal, meta, bio, math, thermodynamic, category, topological, cybernetic |
| `synthesize.md` | Design-objective menu: A/B/C/D objectives, H1–H10 hard constraints, anti-goals, example bundles |

----

# 2 · Core Architecture

## Executive Summary

**Design Thesis:** A reasoner is not primarily a "thinking engine" — it is a **governed controller** that transforms observations and internal states into **justified commitments** under scarce resources. SeNARS already embodies this principle through its epistemic firewall, event-sourced provenance, AIKR boundedness, and gated admission. The next evolution radically generalizes *how* it sequences, funds, and schedules cognition — while preserving every load-bearing invariant.

**Core Innovation:** Replace the rigid, hard-coded control topology with a **unified cognitive transaction model** where every operation — perception, inference, proposal, learning, action, self-modification — is a typed, budgeted, governed, event-sourced transaction flowing through a single commit ledger. Control flow becomes **data** (a conditional DAG), resources become an **economy** (reservations + prices), and adaptation becomes **governed proposal** (all learning passes through the same commit path as cognition).

**What This Buys:**
- **Flexibility:** Conditional stage graphs, parallel foci, adaptive scheduling — without losing auditability
- **Power:** Economic resource allocation, information-theoretic question valuation, continuous strategy manifolds
- **Elegance:** One transaction model, one commit ledger, one governance vocabulary, one resource economy
- **Safety:** Every invariant preserved; every adaptation governed; every mutation event-sourced
- **Scalability:** From minimal kernel to fully-featured neuro-symbolic ecology via monotone enrichment

---

## 1. Core Abstractions

### 1.1 Cognitive Transaction (CT) — The Universal Unit of Work

Every unit of cognition is a typed transaction. There is no other unit of work.

```typescript
interface CognitiveTransaction {
  // Identity & causal correlation
  id: TransactionId;
  correlationId: CorrelationId;        // threads stimulus → cycle → derivation → action
  parentId?: TransactionId;            // causal DAG edge

  // Type & semantics
  kind: TransactionKind;               // perception | attention | retrieval | inference
                                        // proposal | judgment | commit | action | learning
                                        // forgetting | consolidation | simulation | self-modification | meta-control
  axis: CognitiveAxis;                 // 'epistemic' | 'teleological' | 'procedural' | 'governance'

  // Inputs & outputs
  inputs: CognitiveObject[];           // what this reads (beliefs, goals, questions, stimuli)
  outputs: Candidate[];                // what this produces (proposals, derivations, actions)
  effects: EffectDeclaration[];        // what this may write (typed, scoped)

  // Resource economics
  budget: BudgetReservation;           // reserved before execution, settled after
  cost: CostVector;                    // actual consumption (cycles, derivations, memoryOps, llmCalls, tokens, latency, attention, risk, humanAttention)
  utility: UtilityEstimate;            // expected epistemic/teleological/homeostatic gain

  // Trust & governance
  proposer: ProposerProfile;           // who generated this (LM, reflex, NAL, peer, self-mod)
  trust: TrustProfile;                 // source reputation, calibration, confidence
  risk: RiskProfile;                   // irreversibility, blast radius, safety classification
  reversibility: ReversibilityClass;   // purely-info | reversible-local | reversible-external | hard-to-reverse | irreversible

  // Verification
  proofObligations: ProofObligation[]; // what must be verified before commit
  judgeStatus: JudgeStatus;            // pending | calibrated | vetoed | abstained
  proofStatus: ProofStatus;            // none | symbolic | formal | shadow-validated
  simulationStatus: SimulationStatus;  // none | pending | passed | failed

  // Failure & fallback
  fallback: FailurePolicy;             // fail-open | fail-closed | degrade | abstain | retry
  timeout: Duration;

  // Metadata
  timestamp: Timestamp;
  cycleId: CycleId;
  stageId: StageId;
}
```

**Key Properties:**
- **Unified:** Perception, inference, learning, action, self-modification are all CTs
- **Typed:** Every CT declares its axis (epistemic/teleological/procedural/governance), enforcing the firewall at the type level
- **Budgeted:** Every CT reserves resources before execution; no unbounded reasoning
- **Governed:** Every CT passes through the same commit ledger with the same governance vocabulary
- **Event-sourced:** Every CT is appended to the event log; the log *is* the state

### 1.2 Control Graph (CG) — Data-Driven Control Flow

Replace the hard-coded stage loop with a conditional DAG loaded as data.

```typescript
interface ControlGraph {
  nodes: StageNode[];
  edges: StageEdge[];
  entry: StageId;
  exit: StageId[];
}

interface StageNode {
  id: StageId;
  kind: StageKind;                     // perceive | attend | retrieve | infer | propose
                                        // verify | rank | commit | plan | act | learn | consolidate | forget | simulate | metapropose
  run: (ctx: CycleContext) => Promise<CognitiveTransaction[]>;
  budget: BudgetScopeId;               // which scope pays for this stage
  gates: GateId[];                     // gates this stage must pass
  preconditions: Predicate[];          // guards that must hold before execution
  postconditions: Predicate[];         // assertions after execution
  failurePolicy: FailurePolicy;        // skip | abort | degrade | fallback
  traceRegion: TraceRegionId;          // observability hook
}

interface StageEdge {
  from: StageId;
  to: StageId;
  when: (ctx: CycleContext) => boolean;  // conditional edge guard
  cost?: BudgetScopeId;                   // edge traversal may cost
  parallel?: boolean;                     // fan-out / join
  priority?: number;                      // for parallel fan-out ordering
}
```

**Example: SeNARS⁺ Micro-Tick Graph**

```
perceive → attend → [hasWork?] → reason → authorize → [hasProposals?] → propose → learn → [!aborted?] → perceive
                  ↘ [starved?] → triage ↗                            ↘ [noProposer?] → learn
```

**Key Properties:**
- **Conditional:** Edges have guards; stages can be skipped
- **Data-driven:** The graph is loaded like the rule table; versioned, revertable
- **Inspectable:** Every edge traversal is event-sourced; control decisions are auditable
- **Composable:** Graphs can be nested (macro/micro), parallelized, or learned

### 1.3 Commit Ledger (CL) — Single Write Path

All state mutation flows through one governed commit surface.

```typescript
interface CommitLedger {
  commit(ct: CognitiveTransaction, ctx: CommitContext): Promise<CommitResult>;
}

interface CommitContext {
  budget: BudgetState;
  risk: RiskPolicy;
  autonomy: AutonomyPolicy;
  verification: VerificationPolicy;
}

interface CommitResult {
  status: 'committed' | 'rejected' | 'deferred' | 'abstained' | 'provisional' | 'shadow';
  reason?: string;
  eventId: EventId;                  // appended to event log
}
```

**Commit Pipeline:**

```
Candidate → Normalize → Type-Check → Axis-Check (firewall) → Evidence-Independence
         → Proof/Judge/Simulate → Rank → Budget-Settle → Risk-Classify → Commit-or-Reject
```

**Key Properties:**
- **Unified:** Perception, derivation, proposal, learning, action, self-mod — all commit through the same ledger
- **Governed:** Every commit passes through the same verification portfolio (proof, judge, simulation)
- **Event-sourced:** Every commit is an event; the log is the source of truth
- **Reversible:** Every commit is classified by reversibility; irreversible commits require strong proof or human approval

### 1.4 Resource Economy (RE) — From Static Budgets to Cognitive Economics

Replace fixed integer scopes with reservations, prices, and markets.

```typescript
interface ResourceEconomy {
  reserve(bid: BudgetBid): Promise<BudgetReservation>;
  settle(reservation: BudgetReservation, actual: CostVector): void;
  price(operation: CognitiveOperation): PriceEstimate;
  allocate(bids: BudgetBid[]): Allocation;
}

interface BudgetBid {
  transactionId: TransactionId;
  dimensions: CostVector;            // cycles, derivations, premises, memoryOps, llmCalls, tokens, latency, attention, risk, humanAttention
  priority: number;                  // expected utility per unit cost
  deadline?: Timestamp;
}

interface BudgetReservation {
  id: ReservationId;
  granted: CostVector;
  expires: Timestamp;
}
```

**Pricing Model:**

```
score(op) = (ΔK + ΔG + ΔH) / (λ_c · C + λ_r · R + λ_h · H_human)

where:
  ΔK = expected epistemic gain (information gain, uncertainty reduction)
  ΔG = expected teleological gain (goal progress)
  ΔH = expected homeostatic gain (drive balance, curiosity satisfaction)
  C = compute cost (cycles, derivations, memoryOps)
  R = risk cost (irreversibility, blast radius)
  H_human = human attention cost (approval, clarification)
  λ_c, λ_r, λ_h = tunable weights
```

**Key Properties:**
- **Economic:** Resources allocated by expected marginal utility, not fixed quotas
- **Graceful:** Under pressure, low-value work is outbid, not silently dropped
- **Adaptive:** Prices can be learned (RLFP) or thermodynamic (Boltzmann distribution)
- **Bounded:** Total budget is fixed (AIKR); only allocation is dynamic

---

## 2. Formal Model

### 2.1 The Reasoner Tuple

A reasoner in this architecture is a 12-tuple:

```
R = ⟨ Σ, Ω, Π, Τ, Κ, Φ, Λ, Β, Γ, Ψ, Θ, Ε ⟩

where:
  Σ = Epistemic substrate (NAL + MeTTa + embeddings)
  Ω = Dynamics (rules, tools, LM rules, meta-rules)
  Π = Control graph (conditional DAG / KAT control word)
  Τ = Resource economy (reservations + prices + markets)
  Κ = Commit ledger (single write path)
  Φ = Verification portfolio (proof, judge, simulation)
  Λ = Learning operators (RLFP, schema induction, self-mod)
  Β = Budget algebra (dimensions, scopes, lattice, reservation)
  Γ = Gate algebra (4 kernel gates, oriented lattice, trust field)
  Ψ = Epistemic firewall (belief/goal separation, reward ⊥ truth)
  Θ = Strategy profile (pluggable, adaptive, governed)
  Ε = Event log (append-only, replayable, independently verifiable)
```

### 2.2 The Control Loop

At each tick `t`:

```
1. observe:    o(t)    = observe(E(t), X(t))                    // sensor
2. correlate:  cid     = mintCorrelationId(o(t))                // causal threading
3. schedule:   ct(t)   = Π(X(t), o(t), Τ(t), Γ, cid)           // controller selects CT
4. reserve:    br(t)   = Τ.reserve(ct(t).budget)               // resource economics
5. execute:    Y(t)    = execute(ct(t), X(t), br(t))            // plant + actuator
6. verify:     Z(t)    = Φ.verify(Y(t), X(t))                  // proof/judge/simulate
7. commit:     X(t+1)  = Κ.commit(Z(t), br(t), Γ, Ψ)           // single write path
8. settle:     Τ.settle(br(t), Y(t).cost)                      // resource accounting
9. log:        Ε.append(ct(t), Y(t), Z(t), X(t+1))             // event sourcing
10. learn:     Λ.observe(o(t), Y(t), Z(t), X(t+1), feedback)   // adaptation
```

### 2.3 Invariants (Enforced by Construction)

| Invariant | Enforcement Mechanism |
|---|---|
| **Epistemic firewall** | `CognitiveTransaction.axis` is typed; `CommitLedger` rejects cross-axis mutations |
| **AIKR boundedness** | `ResourceEconomy.reserve` fails if budget exhausted; no unbounded loops |
| **Event-sourced state** | `EventLog.append` called after every commit; `replayCognitiveState` reconstructs state |
| **Untrusted proposers** | `GateAlgebra` gates all ingress; `VerificationPortfolio` judges all proposals |
| **Single write path** | `CommitLedger.commit` is the only mutation surface; no direct writes |
| **Replayable audit** | `EventLog` is append-only; `verifyRecord` is engine-independent |
| **Governed self-mod** | `LearningOperators` produce proposals; `GovernancePipeline` approves via shadow CI + external runner |

---

## 3. Component Specifications

### 3.1 Epistemic Substrate (Σ) — Hybrid Compositional

**NAL** (uncertain, evidence-sensitive) + **MeTTa** (exact, dependent types) + **embeddings** (neural proposals).

**Arbiter Pattern:** Substrates never share memory. MeTTa is a gated tool (ActionGate), not a parallel engine. Embeddings are proposer inputs, not truth carriers.

**Equality Isolation:** MeTTa's e-graph never unions nodes based on uncertain similarity (NAL similarity scores). Exact equality and uncertain similarity are kept separate.

### 3.2 Dynamics (Ω) — Operator Library

**Rule Palette:** 44 NAL declarations (deduction, induction, abduction, analogy, comparison) + meta-rules (strategy select, knob tune, test repair, schema promote, capability scaffold).

**Proposer Ensemble:** LM rules (19 belief/goal/question/meta), reflexes (tabular Q / ε-greedy / UCB / manifold), peer agents (delegation over WebSocket), self-tools (8 governed self-modification operators).

**Exact Co-Processor:** MeTTa via ActionGate; equality saturation for symbolic computation; never fused with NAL's uncertain reasoning.

### 3.3 Control Graph (Π) — Declarative Control Flow

**Conditional DAG:** Stages are nodes; transitions are guarded edges; the graph is loaded like the rule table.

**Parallel Foci:** Multiple `Focus` instances can reason in parallel, each with its own budget slice; results merge at `authorize`.

**Heterochronous Tower:** Fast reflex arcs (sub-cycle), medium inference (micro-tick), slow consolidation (every K cycles), very-slow identity/schema induction (≪ 1/cycle) — all instances of the same `ControlGraph` runner with different clocks.

### 3.4 Resource Economy (Τ) — Multi-Dimensional Budget Algebra

**Budget Dimensions:** cycles, derivations, premises, memoryOps, llmCalls, tokens, latency, attention, risk, humanAttention.

**Reservation Model:** Before execution, scheduler reserves resources; after execution, it settles actual vs. reserved. Prevents silent starvation.

**Pricing:** Operations priced by expected marginal utility; scheduler chooses highest-value cognition it can afford.

**Thermodynamic Option:** Replace integer budgets with energy-based model governed by Free Energy Principle. Cognitive temperature `T` controls exploration vs. exploitation; Boltzmann transition `P ∝ exp(-ΔE / T)` replaces hard cutoffs.

### 3.5 Commit Ledger (Κ) — Single Write Path

**Single Write Path:** Every mutation — perception, derivation, proposal, learning, action, self-mod — commits through the same ledger.

**Commit Path:** Normalize → Type-Check → Axis-Check → Evidence-Independence → Proof/Judge/Simulate → Rank → Budget-Settle → Risk-Classify → Commit-or-Reject.

**Reversibility:** Every commit classified by reversibility; irreversible commits require strong proof or human approval.

### 3.6 Verification Portfolio (Φ) — Multi-Mechanism Validation

**Proof:** Symbolic verification (derivation records, step proofs), formal verification (MeTTa equality saturation), shadow validation (git worktree + full CI).

**Judge:** System One Judgment Manifold (19 heads, isotonic calibration, Brier-scored, digest-pinned weights). Fail-closed on mismatch.

**Simulation:** Sandbox execution for actions; shadow execution for self-modification; deterministic replay for derivations.

### 3.7 Learning Operators (Λ) — Governed Adaptation Ladder

**Learning Ladder:** Confidence accumulation → schema induction → RLFP (preference learning) → distillation flywheel → dialogue flywheel → governed self-modification.

**Governed Self-Mod:** All learning produces proposals; proposals pass through governance pipeline (PatchRiskClassifier → GovernancePolicyEngine → ProposalRouter → SandboxValidator → shadow worktree + full CI → external immutable runner).

**Authority Ladder:** observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production.

### 3.8 Budget Algebra (Β) — Lattice Structure

**4 Base Dimensions:** cycles, depth, memoryOps, llmCalls. One table (`BUDGET_RESOURCES`), one arithmetic.

**Scopes:** Lifetime main budget + per-cycle scopes (derivations, premises, candidate-derivations, proposal-application, control-work, decision-derivations). Open-once reset.

**Lattice Extension:** Scopes form a lattice; a scope with surplus can lend to a starved one (preserving total budget); child scopes inherit parent dimensions.

### 3.9 Gate Algebra (Γ) — Oriented Lattice + Trust Field

**4 Kernel Gates:** Perception, Action, Reward, Budget. Every state mutation passes through them.

**Asymmetry:** Ingress (untrusted → memory) is fail-closed; egress (derived → memory) is fail-open. Internal cycle derivations always admitted (gate stamps budgets but has no refusal branch).

**Calibrated Trust Field:** Replace binary admit/reject with continuous trust field `T(source, content, context, history) ∈ [0,1]`. Admission is a soft gate with three bands (act / review / block).

### 3.10 Epistemic Firewall (Ψ) — Type-Level Separation

**Type-Level Separation:** `CognitiveAxis = 'epistemic' | 'teleological' | 'procedural' | 'governance'` crosses every boundary. Beliefs carry `(f, c)` (frequency, confidence); goals carry `(d, c)` (desire, confidence).

**Reward Gate:** Reward signals may modulate attention priority and policy weights, but never `Truth.frequency` or `Truth.confidence`. Enforced structurally, not by convention.

**Mutation Authority:** Only evidence may mutate belief truth; only reward + evidence may mutate goal desire.

### 3.11 Strategy Profile (Θ) — Pluggable & Adaptive

**5 Slots:** sampling, premise, derivation, lmRule, attention. Each has a finite set of named implementations.

**Adaptive:** `CognitiveController.adapt()` resolves slots and rebuilds the controller; RLFP applies switch sets.

**Continuous Manifold Option:** Treat strategies as continuous vectors in a latent control space; gradient-based meta-learning interpolates between strategies.

### 3.12 Event Log (Ε) — Causal Provenance Fabric

**Append-Only:** JSONL/SQLite; every commit is an event; the log *is* the state.

**Replayable:** `replayCognitiveState(events)` reconstructs beliefs; `replayControlState(events)` reconstructs *why* it reasoned that way.

**Independently Verifiable:** `verifyRecord` depends on nothing from the engine; truth table is transcribed; drift is pinned by test.

**Causal Graph:** Every event carries `correlationId`, `stimulusId`, `sessionId`, `cycleId`, `transactionId`, `proposerId`, `judgeId`, `proofId`, `parentId`. Provenance is a causal DAG, not parallel shadows.

---

## 4. Covering All Reasoner Types — and Beyond

This architecture is a **terminal object**: known architectures are projections (some axes dialed to minimal values).

| Archetype | Σ | Δ | 𝒱 | Τ | Π | Γ | Λ | Reading |
|---|---|---|---|---|---|---|---|---|
| Classical ATP | symbolic | deduction | bool | unbounded | fixed search | proof-trace | none | Graded truth, economy, gates off |
| Prolog/Datalog | symbolic | deduction | bool | depth-bound | DFS | none | none | Minimal projection |
| Theorem prover (Lean/Coq) | exact/dependent | deduction | proof | unbounded | tactic/human | kernel-gated | none | Fail-closed everywhere, no uncertainty |
| Bayesian reasoner | probabilistic | marginalization | scalar p | step-bound | fixed graph | none | parametric | Single truth algebra |
| Production rules (CLIPS) | symbolic | forward-chaining | bool | bounded | conflict-resolution | none | procedural | — |
| Cognitive architecture (SOAR/ACT-R) | symbolic | productions | utility/activation | bounded | impasse/conflict | none | chunking/compilation | — |
| Original NARS | symbolic | full NAL | (f,c) | AIKR | priority bag | none | confidence-accum | Minus gates/provenance/reflexivity |
| Pure LLM agent (ReAct) | subsymbolic | generation | none | unbounded | LM loop | none | in-context | Violates Φ under adversarial reward |
| RL agent (AlphaZero) | subsymbolic | search+gradient | value | bounded | MCTS | none | external-RL | Conflated belief/goal |
| **Neuro-symbolic governed reasoner** | hybrid | NAL+LM+exact | (f,c)×(d,c) | full economy | fluid graph | full lattice+verifier | governed | **This architecture at full enrichment** |

**Regions designed to occupy that are currently open:**
- Dependent types ⊕ AIKR ⊕ governed self-modification (no current system joins all three)
- Paraconsistent equality saturation (defined union semantics under conflicting truth)
- Ensemble/mutual trust (peer proposals under mutual verification)
- Collective calibration (cross-agent isotonic fitting, shared manifold digests)
- Continuous-time revision under streaming backpressure
- Cross-agent provenance fusion (event-log merge with independence accounting)
- Derivation-level proof for learned heads (beyond digest-pinning identity)

---

## 5. Configurability & Customization

### 5.1 The Spec Literal

A deployment is a declarative literal over axes in clusters. Every component is a typed, pluggable axis:

```
METAREASONER = {
  K: { substrate, language, world, calculus, consistency }   // Knowledge
  I: { spectrum, direction, exact, termination }              // Inference
  C: { resources, scheduler, forgetting }                     // Control
  L: { locus, reward, beliefGoal }                            // Learning
  A: { trust, provenance, governance, embodiment, composition }// Authority
}
```

### 5.2 Profiles, Presets, Tiers

- **Profiles** (e.g., `device` / `conversation` / `research`) shift substrate & neural axes
- **Presets** (e.g., `FAST` / `NEURAL_HEAVY` / `DEEP_AUDIT`) shift judgment depth, learning, provenance caps
- **Feature toggles** (RL, self-improvement, persistence, System-One) move within a bounded subspace

**The invariants and Φ are the manifold boundary:** every reachable sub-point still satisfies Φ. You can customize everything *except* the load-bearing core.

### 5.3 Config-Time Feasibility

The config literal is validated against Φ before instantiation. Infeasible combinations (e.g., reward-writes-truth, code-self-mod-without-external-arbiter, opaque-scheduler) are **rejected at load time**.

---

## 6. Scalability & the Ecological Layer (Gated, Off by Default)

Multi-agent reasoning is a **capability layer**, not core, activated only once single-agent control is stable and proven:

- **Delegation** — propose/respond over typed transports
- **Peer proposals** — other agents are untrusted proposers (same manifold)
- **Shared calibration** — cross-agent manifold digests / collective isotonic fit
- **Collective verification** — mutually-verified ensembles with independence accounting
- **Capability tokens** — scoped authority for delegated actions
- **Provenance fusion** — event-log merge with cross-process replay hashing

---

## 7. Example Behavioral Coordinates

### 7.1 Reflexive Agent
```
ControlGraph:      single loop
Scheduler:         priority queue
Admission:         fail-open
Verification:      minimal
Budget:            latency-first
Autonomy:          sandbox-only
Learning:          reflex weights only
```

### 7.2 Formal Theorem Prover
```
ControlGraph:      deliberative loop
Scheduler:         proof-progress
Admission:         proof-gated
Verification:      formal proof
Budget:            derivation-heavy
Autonomy:          observe-only
Learning:          rule induction with proof
```

### 7.3 Creative Explorer
```
ControlGraph:      proposal graph
Scheduler:         novelty-weighted
Admission:         provisional
Verification:      shadow simulation
Budget:            high proposal diversity
Autonomy:          sandbox
Learning:          schema induction
```

### 7.4 Safe Production Agent
```
ControlGraph:      transaction graph
Scheduler:         risk-adjusted utility
Admission:         calibrated + proof
Verification:      judge + simulation + human
Budget:            conservative
Autonomy:          human-approved irreversible actions
Learning:          governed proposals only
```

### 7.5 SeNARS (Current)
```
ControlGraph:      dual nested loops
Scheduler:         priority bags + RLFP
Admission:         fail-closed ingress, mostly open internal
Verification:      manifold + symbolic verifier
Budget:            scopes + lifetime limits
Autonomy:          five-rung ladder
Learning:          governed self-improvement
Epistemics:        belief/goal firewall
Observability:     event log + cycle trace
```

### 7.6 METAREASONER (Ultimate Hybrid)
```
ControlGraph:      conditional DAG + heterochronous tower
Scheduler:         economic meta-controller (utility-driven)
Admission:         unified commit ledger
Verification:      proof/judge/simulation portfolio
Budget:            reservations + prices + markets
Autonomy:          risk/reversibility manifold
Learning:          governed proposal pipeline
Epistemics:        typed cognitive algebra
Observability:     causal proof graph with correlation IDs
```

---

## 8. Summary

**METAREASONER is the point in the design space where:**

- **Control flow is data** (conditional DAG, not hard-coded loop)
- **Resources are an economy** (reservations + prices, not static quotas)
- **All cognition is transactional** (perception, inference, learning, action, self-mod — all CTs)
- **All mutation is governed** (single commit ledger, one governance vocabulary)
- **All state is event-sourced** (append-only log, replayable, independently verifiable)
- **All adaptation is governed** (learning produces proposals; external runner merges)
- **All explanation is causal** (correlation IDs thread stimulus → cycle → derivation → action)

**What This Preserves:**
- Epistemic firewall (belief/goal separation, reward ⊥ truth)
- AIKR boundedness (budgets, forgetting, decay, backpressure)
- Event-sourced provenance (append-only log, replayable, verifiable)
- Untrusted proposers, trusted judgment (LM proposes, kernel judges)
- Governed self-modification (shadow CI, external runner, autonomy ladder)

**What This Unlocks:**
- Flexibility (conditional stage graphs, parallel foci, adaptive scheduling)
- Power (economic resource allocation, information-theoretic question valuation)
- Elegance (one transaction model, one commit ledger, one governance vocabulary)
- Adaptivity (learned scheduler, continuous strategy manifolds, governed reflexivity)

**The Deepest Lesson:**
A reasoner's power is bounded not by its inference rules but by the expressiveness of its control graph and the depth of its reflexivity — and its safety is bounded by how much of that control is event-sourced, replayable, and governed. SeNARS optimized safety; METAREASONER recovers power without spending it.

----

# 3 · Formal Model

## 1. The Reasoner as a Stratified Product Space

A reasoner is a point in a stratified product space governed by a feasibility predicate:

$$\mathcal{M} = \big\langle\; 
\underbrace{\Sigma,\ \Omega,\ \mathcal{V}}_{\text{Semantics Plane}} \;\big|\;
\underbrace{\mathcal{T},\ \mathcal{C}}_{\text{Economy Plane}} \;\big|\;
\underbrace{\mathcal{K},\ \mathcal{G},\ \mathcal{R},\ \mathcal{F}}_{\text{Governance Plane}} \;\big|\;
\underbrace{\Phi}_{\text{Constitution}}\;\big\rangle$$

| Component | Name | Algebraic Structure | Question It Answers |
|---|---|---|---|
| **Σ** | Substrate | Multi-sorted term algebra ⊕ type system ⊕ graded carrier | What exists, and how is it typed? |
| **Ω** | Dynamics | Operator library; each $\delta : \Sigma \rightharpoonup \Sigma \times Event^*$ with cost vector | How does state change? |
| **𝒱** | Valuation | Evidence algebra (truth monoid) × desire carrier × rank function | How is state scored? |
| **𝒯** | Economy | Ordered commutative monoid + reservation module + price semiring | What limits and prices change? |
| **𝒞** | Control | Kleene Algebra with Tests over stage generators; meta-controller | What changes next? |
| **𝒦** | Commit Ledger | Single commit port: $Candidate \to State$ with governance predicate | What commits? |
| **𝒢** | Gates | Oriented gate lattice × trust field × risk/reversibility manifold × verifier | What gates and authorizes change? |
| **ℛ** | Reflexivity | Filtration of self-modification authority; learning-as-proposal | Can the system change its rules for changing? |
| **ℱ** | Failure Policy | Natural transformation Id → Failure (degradation maps) | What happens on fault? |
| **Φ** | Constitution | Feasibility predicate = conjunction of hard constraints | Which configurations are coherent? |

---

## 2. Semantics Plane

### 2.1 Σ — Substrate & Epistemic Type System

Ω is **multi-substrate by construction**, with substrates *arbitrated* (islands exchange proposals through a boundary) rather than *fused* (shared memory).

**Substrate Slots (Typed Ports):**

| Substrate | Carrier | Role | Isolation Rule |
|---|---|---|---|
| Symbolic-uncertain | Term algebra, graded by `(f,c)/(d,c)` | Default reasoning, revision | — |
| Exact/formal | Dependent types, e-graphs, equality saturation | Exact computation | **Never unions nodes on uncertain similarity (H8)** |
| Probabilistic | Distributions / factors | Statistical inference | Emits proposals, not facts |
| Neural/subsymbolic | Embeddings, learned heads | Proposal generation, judgment features | Digest-pinned; calibrated before scores act |
| Heuristic/reflex | Tabular/policy values | Fast arcs | Always judged before commit |

**Epistemic Type System:** Attitudes are first-class, disjoint types with distinct carriers and *distinct mutation authorities*:

| Type | Carrier | May Be Written By |
|---|---|---|
| **Belief** | `(frequency, confidence)` | Evidence only |
| **Goal / Desire** | `(desire, confidence)` | Reward + evidence |
| **Question** | `(priority, expected-info-gain)` | Curiosity / controller |
| **Hypothesis** | `(plausibility, evidence-requirement)` | Abduction |
| **Assumption** | `(scope, validity)` | Local reasoning |
| **Plan** | `(utility, feasibility, risk)` | Planning |
| **Obligation / Permission** | `(priority, deadline)` / `(scope, conditions)` | Normative layer |
| **ActionIntent** | `(reversibility, authorization)` | Action controller |
| **Lesson** | `(source, trust, applicability)` | Distillation |

**Epistemic Firewall as Grading:** Σ is `{epistemic, teleological, procedural, governance}`-graded. Every operator in Ω must be **grade-respecting**; there is *no generator of type `Reward → Belief.frequency`*. This makes "reward cannot launder into fact" a theorem about the signature (Constitution **H1**), enforced by the type system.

**Consistency Policy:** Paraconsistent retention with graded truth. `P` and `¬P` coexist with distinct truth values; contradiction never triggers explosion; contradictions are first-class queryable objects.

### 2.2 Ω — Dynamics (Operator Library)

Operators are **data**, loaded, versioned, revertable. Each operator is a partial map:

$$\delta : \Sigma \rightharpoonup \Sigma \times Event^*$$

carrying:
- **Cost vector** $c(\delta) \in \mathbb{R}^{+d}$ (into the Economy)
- **Grade** (which attitudes it touches)
- **Provenance stamp**
- **Trust posture** (trusted-core vs. untrusted-proposer)

**Spectrum:** Structural rules · deductive · inductive · abductive/analogy/resemblance · meta-rules (self-applicable) · exact rewriting · learned pattern completion · neural proposal · tool side-effects. Exact and uncertain operators live in separate dispatch cells with **exact kind-pair dispatch, no wildcards**.

**Proposer/Judge Adjunction (Neuro-Symbolic Handoff):**

$$\mathsf{propose} \;\dashv\; \mathsf{admit}$$

The *Judgment Manifold* is the (co)unit measuring how much of a proposal survives judgment. Tightening → pure symbolic; loosening → proposal-heavy. "How much do we trust System-1" is a **continuous parameter**, not a wiring decision (Constitution **H2**, **A5**).

### 2.3 𝒱 — Valuation

- **Truth:** Non-idempotent evidence monoid; revision is commutative, sub-additive in confidence; frequency is a confidence-weighted average. Evidence-independence is tracked (lineage) to prevent double-counting / evidence laundering.
- **Priority/Attention:** Decoupled from truth. *Truth decays only on invalidation; attention decays by access.* This separation is load-bearing (prevents valid beliefs evaporating and stale beliefs persisting).
- **Ranking:** `score = f(confidence, decisiveness, expected-info-gain, size)`; may be hand-scored, learned, or market-priced (Economy plane).

---

## 3. Economy Plane

### 3.1 𝒯 — The Resource Economy

**Resource Postulate (AIKR as Axiom):** Insufficiency of knowledge and resources is a design foundation, not an inconvenience. Cognition is finite; forgetting, decay, backpressure, interruption, and budgets are first-class.

**Budget Algebra:** An ordered commutative monoid with ceiling, lifted to a **module over a semiring** so scopes are a *basis* — they can be tensor-combined, minted at runtime, and projected.

**Dimensions:** cycles, derivations, premises, memory-ops, LM-calls, tokens, latency, attention-slots, risk-quota, human-attention.

**Three Economic Mechanisms, Layered:**

1. **Reservations:** Before executing, a transaction reserves resources:
   $$B_{available} \leftarrow B_{available} - B_{reserved}$$
   After: $B_{settled} = B_{reserved} - B_{unused}$. Prevents silent starvation; yields typed backpressure.

2. **Pricing / Marginal Utility:** Operations scored by expected utility per scarce resource:
   $$\mathrm{score}(op)=\frac{\widehat{\Delta K}+\widehat{\Delta G}+\widehat{\Delta H}}{\lambda_c\,\widehat{C}+\lambda_r\,\widehat{R}+\lambda_h\,\widehat{H}_{human}}$$

   The scheduler selects highest utility-per-cost, giving graceful pressure response (explore → prioritize → conserve → degrade).

3. **Thermodynamic Allocation (Optional Enrichment):** Replace hard cutoffs with energy-based model:
   - Each task has activation energy from surprise × utility
   - Global cognitive temperature $T$ governs exploration/exploitation
   - Pursuit probability follows Boltzmann factor $P \propto \exp(-\Delta E/T)$
   - Budget exhaustion becomes *outbidding*, not silent drop

**Constitutional Binding:** Every `charge` names a scope (**H5**); total budget preserved under transfers (no resource laundering); reset law is **open-once** (a bound cannot wear a counter).

### 3.2 𝒞 — The Control Calculus (KAT)

Control is **data**, expressed in a **Kleene Algebra with Tests (KAT)** over stage generators: sequence `·`, choice `+`, iteration `*`, guard `p?`, skip `1`, parallel `∥`.

A reasoner's tick is the action of a **control word** $\kappa$ on state.

**Three Equivalent Presentations:**

1. **Conditional Stage Graph (DAG):** Stages as nodes; edges guarded by predicates over `{signals, 𝒯, drives}`. Enables skipping, parallel fan-out, optional stages, cyclic back-edges.

2. **Claim Queue (Blackboard):** Every cognitive operation posts a typed `Claim = {operator, priority, cost-vector, judgment-score, expiry}` onto a bounded priority bag; the tick pops the highest-value claim the budget affords and the gates admit.

3. **Learned/Meta-Controller Policy:** A meta-controller selects or *blends* from a portfolio of controllers, emitting a **Cognitive Program**:
   ```
   CognitiveProgram = { stageGraph, budgetAllocation, proposerPortfolio,
                        verificationPolicy, autonomyPolicy, learningPolicy }
   ```

**Scheduler Inspectability (Constitution H6):** Every scheduling decision is itself a `CognitiveEvent`. A learned or market scheduler is permitted *only because* its choices are logged, correlated, and replayable — opacity is forbidden (Anti-goal **A2**).

---

## 4. Governance Plane

### 4.1 𝒦 — Commit Ledger: Single Commit Authority

**Principle:** Every durable mutation is a proposal; every proposal is judged; every accepted proposal is committed through **one** port.

**Commit Pipeline:**
```
Candidate → Normalize → TypeCheck → GradeCheck(firewall)
          → EvidenceIndependenceCheck → Prove/Judge/Simulate
          → Rank → BudgetSettlement → RiskClassification
          → Commit | Reject | Defer | ProvisionalCommit | ShadowCommit
```

**Commit Modes:**

| Mode | Condition | Behavior |
|---|---|---|
| **Commit** | All obligations satisfied, risk ≤ threshold | Durable write, event logged |
| **ProvisionalCommit** | Medium trust, low risk | Written with decay timer; promoted or expired |
| **ShadowCommit** | Self-modification, high risk | Applied to shadow copy; promoted after validation |
| **Defer** | Budget exhausted, judgment unavailable | Queued with expiry; retried when resources available |
| **Reject** | Proof failed, veto, firewall violation | Rejected with typed reason; event logged |
| **Degrade** | Judge unavailable, fallback active | Committed with reduced confidence; flagged for re-judgment |

**Single Write Invariant:**
$$\exists!\; \mathsf{commit} : \mathsf{Candidate} \to \mathsf{State}$$

No other path writes to durable memory. Enforced architecturally: memory ports expose read interfaces broadly but write interfaces only to the commit ledger.

**Event-Sourced Fold:**
$$\mathsf{State}(t) = \mathsf{fold}(\mathsf{events}_{0..t},\; \mathsf{State}_0)$$
where `fold` is a pure, deterministic reducer. Snapshots are caches; the event log is the source of truth.

### 4.2 𝒢 — Gates, Trust, Risk, Autonomy

**Oriented Gate Lattice:** Gates are idempotent operators forming a bounded lattice; each is either a **closure** (extensive, fail-open) or an **interior** (contractive, fail-closed). The ingress/egress asymmetry is a **typed orientation field**: ingress defaults to fail-closed (injection veto), egress defaults to fail-open (cognition must not halt). Gates compose by meet/conjunction, support voting, fallback, and parametric degradation.

**Calibrated Trust Field:** Binary admit/reject generalizes to continuous field $T(source, content, context, history) \in [0,1]$ built from source-quality ceilings, reputation, calibrated judge heads (digest-pinned, isotonic), and corroboration. Admission becomes banded — act / review / block — and **per-claim**, not merely per-source.

**Risk / Reversibility Manifold:** Every candidate carries a governance profile:
```
{ trust, confidence, risk, reversibility, blastRadius,
  proofStatus, judgeStatus, simulationStatus }
```

The commit path is a policy surface over `(trust, risk, reversibility)`:
- High-trust / Low-risk / High-reversibility → auto-commit
- Low-trust / High-risk / Low-reversibility → strong proof or human approval (Constitution **H10**)

**Autonomy Ladder:** Observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production. This generalizes action control to *all* cognitive mutations, not just external actions. **Actions are simulated before commitment** and typed by reversibility.

**Independent Verification:** The verifier shares **no unsafe engine dependencies** with the reasoner it checks (Constitution **H7**): truth tables are transcribed, engine and verifier code are disjoint, and drift between them is *measured and pinned*, never assumed zero.

### 4.3 ℛ — Reflexivity (Governed Self-Modification)

Self-modification authority forms a **filtration** $F_0 \subset F_1 \subset \ldots \subset F_6$, higher index = more authority, each level governing the one below with strictly bounded, decreasing reach:

| Level | Scope | Authority | Governance |
|---|---|---|---|
| **F₀** | Frozen | No self-modification | N/A |
| **F₁** | Knobs/parameters | Parameter tuning (thresholds, weights) | Auto-applied within bounds |
| **F₂** | Strategies | Strategy selection, sampling policy | Proposal → shadow → auto-apply if low-risk |
| **F₃** | Rules | Rule induction, schema promotion, rule retirement | Proposal → proof → shadow → governance |
| **F₄** | Topology | Stage graph edits, budget lattice changes | Meta-controller proposal + governance → cycle-boundary hot-swap |
| **F₅** | Code | Source-code patches, architecture mutations | Proposal → shadow worktree → full CI → external approval → merge |
| **F₆** | Constitution | Governance rules, firewall axioms, budget ceilings | **Never self-modifiable.** External immutable authority only. |

**Self-Modification Invariant:**
$$\text{Learning may propose changes to cognition, but it may not directly rewrite the laws of epistemic commitment.}$$

Specifically:
- The epistemic firewall (H1) is at F₆ — never self-modifiable
- The commit ledger structure (H3) is at F₆
- The budget ceiling existence (H5) is at F₆
- The verifier independence requirement (H7) is at F₆
- Everything else is modifiable at its appropriate level, subject to governance

**Safe Self-Improvement Ladder:**
```
observation → lesson → hypothesis → strategy proposal → shadow test
           → bounded deployment → trace evaluation → retention | rollback
```

The meta-controller **proposes** control-graph edits; it does **not apply** them. Edits install only at cycle boundaries (hot-swap, preserving in-flight state) and inherit the autonomy ladder.

### 4.4 ℱ — Failure Policy

A natural transformation $\eta : Id \to Failure$. Responses: propagate · swallow · degrade(f) · retry(n) · escalate · abstain. **Failures affecting cognition, budget, or admission may never be silently swallowed (Constitution H9)** — they become typed events. On any fault the system degrades to a *known weaker mode* (e.g., full judgment → symbolic baseline) rather than halting or producing undefined behavior.

---

## 5. The Unifying Mechanism — Cognitive Transactions

Perception, inference, proposal, judgment, action, learning, forgetting, consolidation, and self-modification are **all the same general class of object**:

```
CognitiveTransaction {
  id, correlationId, kind            // perception|attention|inference|proposal|
                                     //   judgment|commit|action|learning|
                                     //   forgetting|consolidation|simulation|selfmod
  inputs, outputs                    //   meta-control
  effects: EffectDeclaration[]
  budget: Reservation
  capabilities: CapabilityToken[]
  trust: TrustProfile
  risk: RiskProfile
  reversibility: ReversibilityClass
  fallback: FailurePolicy
  proofObligations: ProofObligation[]
  grade: epistemic | teleological | procedural | governance  // firewall in the transaction
}
```

Each transaction declares what it reads, what it may write, what it reserves, what proofs it must satisfy, how it fails, whether it is reversible, and which governance path it requires. **Control flow is thus explicit, typed, and analyzable.**

---

## 6. Provenance Plane — Causal Observability

### 6.1 Event Fold
The append-only `CognitiveEvent` log *is* the source of truth.
`replay(events) ≅ id` on reachable states; admit-before-write (no state write without a preceding gate event).

### 6.2 Correlation Manifold
One `correlationId` is minted at the stimulus and threaded through every transaction, gate decision, budget charge, and trace region. Provenance becomes a **causal DAG**, not parallel shadows.

Queries become well-formed:
- Which stimulus caused this belief?
- Which derivation led to this action?
- Which judge vetoed this candidate?
- Which budget exhaustion caused this degradation?
- Which learning episode changed this strategy?

### 6.3 Control-Plane Replay
Because scheduling decisions are events, the system reconstructs not only *what* it believes but *why it chose to reason that way*.

### 6.4 Independent Verification + Replay Hash
Derivations re-checkable by a process that never ran the engine; replay produces a verifiable state hash.

### 6.5 Tiered Audit (Managing Anti-goal A4)
Full step-level proof reserved for high-stakes/high-risk transactions; routine cognition carries lighter lineage; sampling is itself a budgeted, logged policy. Audit depth is an axis you dial, not a fixed cost.

---

## 7. The Constitution — Φ as Equational Laws

The hard constraints, stated as the feasibility predicate. A configuration is **legal iff** it satisfies all:

| # | Law | Algebraic Form | Rationale |
|---|---|---|---|
| **H1** | Reward ∤ Truth | No generator `Reward → Belief.(f)`; grade-respecting Ω | Belief corruption / sycophancy |
| **H2** | Untrusted ⇒ judged | `propose ⇒ judged-before-commit ∨ provisional-typing` | Evidence laundering |
| **H3** | Mutation ⇒ event | ∀ write, ∃ ledger entry | Auditability by construction |
| **H4** | No self-approval | `self-mod ⇒ external ∨ governed arbitration` | Self-approval is unsound (Löbian) |
| **H5** | Boundedness | Every reasoning path bounded in time/memory/derivations/LM | AIKR; prevents runaway |
| **H6** | No opaque scheduling | Control choices ∈ event log | Control-plane transparency |
| **H7** | Verifier independence | `imports(verifier) ∩ imports(engine) = ∅` | Prevents co-adapted bugs |
| **H8** | Equality isolation | Exact substrate never unions on uncertain similarity | Prevents equality contamination |
| **H9** | No silent cognitive faults | Faults affecting cognition/budget/admission are events | Observability of faults |
| **H10** | Irreversibility ⇒ authorization | Irreversible actions pass risk classification + authorization | Safety |

**Derived Entailments** (raising one axis forces another):
- AIKR ⇒ budgets + anytime + forgetting
- Untrusted proposers ⇒ gates
- Self-mod ⇒ governance + step-audit
- Event-sourcing ⇒ deterministic replay
- Graded contradiction ⇒ graded truth
- Reward-learning + beliefs ⇒ firewall

These carve the infeasible regions: *reward-writes-truth*, *ungoverned code self-mod*, *untrusted proposers without gates*, *explosive consistency + revision*, *unbounded + full audit*.

---

## 8. Compositional Operations on Configurations

Reasoners compose equationally. With semantic function `⟦·⟧ : Config → Behavior`:

| Operation | Symbol | Semantics |
|---|---|---|
| Sequential composition | $c_1 \otimes c_2$ | Run $c_1$ then $c_2$ |
| Parallel composition | $c_1 \oplus c_2$ | Run concurrently, join |
| Restriction | $c \mid P$ | Project onto subset of capabilities (degradation as algebra) |
| Refinement | $c_1 \sqsubseteq c_2$ | $c_1$'s behaviors ⊆ $c_2$'s behaviors |
| Lifting | $\mathsf{lift}(c, f)$ | Apply a functor to every component (e.g. parallelize) |
| Abstraction | $\alpha(c)$ | Map to behavioral equivalence class |

**Compositionality:** `⟦c₁ ⊗ c₂⟧ = ⟦c₁⟧ ∘ ⟦c₂⟧`. Everything replaceable behind **typed ports**: substrates, schedulers, judges, memory models, verifiers, and governance policies are all plug-points, so long as the plugged implementation satisfies Φ.

---

## 9. Instantiation Tiers (Kernel-First)

The architecture stages from smallest viable core to full engine; each tier satisfies Φ and is independently deployable. **Abstraction never blocks a runnable kernel** (rejected Anti-goal A1):

| Tier | Adds | Character |
|---|---|---|
| **M₀ Kernel** | substrate + control word + one gate + budget monoid + provenance fold | Minimal load-bearing reasoner |
| **M₁ Reasoner** | inference substrate, truth algebra, revision | Symbolic/uncertain reasoning |
| **M₂ Agent** | full gate lattice, trust field, economy pricing, risk manifold | Governed interaction |
| **M₃ Cognitive** | drives, multi-rate loops, consolidation, imagination, reflexivity | Rich agency (budgeted) |
| **M₄ Ecological** | peer delegation, collective calibration, provenance fusion | Multi-agent (single-agent stability gate first) |

**The Five-Part Minimal Core** (what you cannot remove and still call it a reasoner):
1. A substrate
2. A control word
3. An admission gate
4. A resource monoid
5. A provenance fold

Everything else — drives, System-1, reflexivity, thermodynamics, manifold — is *enrichment*: coordinates you can dial from absent to present without leaving the space.

---

## 10. Tradeoff Surfaces & Pareto Fronts

The architecture is not monotone-improvable; moving along an axis pays a cost.

| Axis ↑ | Cost | Mitigation |
|---|---|---|
| Provenance depth | Throughput; recorder overhead | Tiered/sampled audit; bounded recorders |
| Gate coverage | Admission latency | Budgeted judgment; fail-soft degradation |
| Forgetting | Recall completeness | Decoupled decay (truth ⊥ attention); archival |
| Paraconsistency | Decision simplicity | Contradictions as queryable graded objects |
| Reflexivity scope | Governance obligation | Filtration; shadow-CI; external arbiter |
| Proposer diversity | Verification load | Batched judges; circuit breakers; shadow-drop |
| Control fluidity | Static analyzability | Invariants become graph predicates; control events logged |

**The Guarantee Trilemma:** Soundness of admitted steps · completeness of ampliative closure · bounded operation — pick at most two freely. This architecture occupies the **verifier + bounded** corner: it sacrifices completeness (no axiom of completeness under AIKR) to keep soundness-of-admitted-steps and bounded operation, and it purchases adaptivity by re-anchoring guarantees in **provenance and gated admission** rather than in rigidity.

----

# 4 · Components

## 1. Epistemic Substrate Layer

### 1.1 NAL Symbolic Substrate
**Role:** Core uncertain reasoning with evidence-sensitive truth revision.

**Interfaces:**
- `TermAlgebra` — canonical terms, interning, reducers (11 term + 1 task)
- `RuleEngine` — 44 builtin declarations, 20 exact kind-pair dispatch cells
- `TruthAlgebra` — `(f,c)` revision: commutative, sub-additive confidence, weighted frequency
- `DerivationRecorder` — bounded 200×200, step-level premise truths, lineage DAG (capped 16)

**Key Properties:**
- Paraconsistent: `(A→B)` and `¬(A→B)` coexist with distinct truth values
- Evidence independence tracked via lineage DAG
- Decoupled decay: truth decays only on invalidation/contradiction; attention decays by LRU/access

### 1.2 MeTTa Exact Co-Processor
**Role:** Deterministic computation, formal verification, type-checked transformation.

**Interfaces:**
- `ExactOracle` — equality saturation, e-graphs, dependent types (Π/Σ)
- `RuleDispatcher` — rewrite rules with guards, JIT compilation, parallel map/reduce
- `SpaceOps` — fork/merge/clone/persist, pattern-match (fail-closed), unification (occurs check)

**Isolation Invariants:**
- Never unions nodes on uncertain similarity (H8)
- Results enter as proposals with source-quality annotation, not as trusted axioms
- IPC via valibot protocol + SharedArrayBuffer SPSC ring

### 1.3 Neural / Subsymbolic Substrate
**Role:** Proposal generation, embedding, calibration.

**Interfaces:**
- `ProposerPort` — LM rules (19 templates), reflex suggestions, schema hypotheses
- `EmbeddingRuntime` — 384-d pooled, LRU + free-list, O(1) alias-free cache
- `JudgmentHead` — 19 heads (6 ingress, 5 action, 5 synthesis, 3 memory), isotonic calibration

**Trust Posture:** **Untrusted proposer** — outputs are proposals, never facts. Calibrated before scores act. Digest-pinned weights (SHA256 encoderDigest ‖ headWeightsDigest).

### 1.4 Substrate Arbitration Layer
**Principle:** Substrates exchange **proposals through typed boundaries**, never raw internal state.

```
Substrate_i ──proposal──▶ Arbitration Layer ──judged──▶ Commit Ledger
```

**Invariants:**
- E-graph never unions on uncertain similarity (H8)
- Neural head never writes directly to belief store
- Probabilistic inference never overwrites symbolic derivation without commit ledger
- LM output never enters cycle path without judgment

**Coupling Modes:**
| Mode | Description | Use Case |
|---|---|---|
| **Isolated** | Substrates run independently; no interaction | Maximum safety; formal verification |
| **Arbited** | Substrates exchange proposals through boundary; no shared memory | Default; NAL + MeTTa |
| **Federated** | Substrates share common event log but maintain separate state | Multi-agent; peer delegation |
| **Fused** | Substrates share state (forbidden for exact + uncertain) | Only for same-class substrates |

---

## 2. Control Layer

### 2.1 Control Graph (Conditional DAG)
**Replaces:** Hard-coded 6-stage `for`-loop in `NARExecution.run()`

**Structure:**
```typescript
StageGraph {
  nodes: StageNode[]
  edges: StageEdge[]
  entry: StageId
  exit: StageId[]
}

StageNode {
  id: StageId
  run: Middleware<CycleContext>
  budget: BudgetScopeId
  gates: GateId[]
  preconditions: Predicate[]
  postconditions: Predicate[]
  failurePolicy: FailurePolicy
  traceRegion: TraceRegionId
}

StageEdge {
  from: StageId
  to: StageId
  when: (ctx: CycleContext) => boolean
  cost?: BudgetScopeId
  parallel?: boolean
  priority?: number
}
```

**Graph Invariants (Static Predicates):**
| Invariant | Formal Statement |
|---|---|
| No unverified write | $\nexists$ path $s \to^* \mathsf{commit}$ without passing $\mathsf{verify}$ |
| No nested proposal in inference | $\nexists$ path $\mathsf{infer} \to^* \mathsf{propose}$ within single inference scope |
| No untrusted commit | $\forall$ path to $\mathsf{commit}$: proposer is trusted OR judge has scored |
| No reward → truth | $\nexists$ edge from `teleological` stage to `belief`-writing stage |
| Budget coverage | $\forall$ node $n$: $\mathsf{budget}(n) \neq \bot$ |
| Gate coverage | $\forall$ node $n$ with $\mathsf{kind} \in \{\mathsf{commit}, \mathsf{act}\}$: $\mathsf{gates}(n) \neq \emptyset$ |

### 2.2 Control Word (KAT Expression)
**Representation:** First-class value, versioned, revertable, governable.

```typescript
ControlWord {
  expression: KATExpression
  stageGraph: ConditionalDAG
  budgetMap: Map<StageId, BudgetScopeId>
  gateMap: Map<StageId, GateId[]>
  invariants: GraphPredicate[]
  version: VersionId
  provenance: TransactionId  // meta-control transaction that produced this
}
```

**Example Control Words:**
- **Minimal deductive:** $\kappa = (\mathsf{retrieve} \cdot \mathsf{infer} \cdot \mathsf{commit})^*$
- **Full neuro-symbolic:** $\kappa = \mathsf{perceive} \cdot \mathsf{attend} \cdot (\mathsf{hasWork}? \cdot \mathsf{infer} \cdot \mathsf{verify} \cdot \mathsf{rank} \cdot \mathsf{commit}) \cdot (\mathsf{hasProposer}? \cdot \mathsf{propose} + \neg\mathsf{hasProposer}? \cdot 1) \cdot (\mathsf{due}? \cdot \mathsf{learn})^*$
- **Parallel foci:** $\kappa = \mathsf{attend} \cdot (\mathsf{infer}_{\text{belief}} \parallel \mathsf{infer}_{\text{goal}}) \cdot \mathsf{join} \cdot \mathsf{commit}$
- **Reflex arc:** $\kappa = \mathsf{perceive} \cdot (\mathsf{danger}? \cdot \mathsf{act}_{\text{veto}} + 1) \cdot \mathsf{propose}_{\text{fast}}$

### 2.3 Meta-Controller (Recursive Core)
The meta-controller is itself an instance of the framework:
$$\text{MetaController} = \mathcal{M}(\text{control-state},\; \text{control-operators},\; \text{control-budget})$$

**Meta-Controller Observes:** Control-word version, budget allocation, trace grades, starvation events, contradiction rate, derivation yield, reflex-vs-NAL veto frequency, budget utilization.

**Meta-Controller Proposes:** `StageGraphEditProposal`, `BudgetReallocationProposal` — routed through governance, never applied directly.

**Hard Constraints:**
1. **Propose, do not apply** — outputs proposals; governance pipeline decides
2. **Hot-swap at boundaries** — graph edits take effect at cycle boundaries, preserving in-flight counters and detector state
3. **Bounded authority** — cannot modify epistemic firewall, commit ledger interface, or governance ladder

### 2.4 Cognitive Program Portfolio
The meta-controller selects a complete control configuration:

```typescript
CognitiveProgram {
  stageGraph: StageGraph
  budgetAllocation: BudgetAllocation
  proposerPortfolio: Map<ProposerKind, Weight>
  verificationPolicy: VerificationPolicy
  autonomyPolicy: AutonomyPolicy
  learningPolicy: LearningPolicy
  attentionPolicy: AttentionPolicy
}
```

**Named Programs:**

| Program | Character | When Selected |
|---|---|---|
| **Deliberative** | Deep inference, high proof burden, sequential | Complex questions, high-stakes decisions |
| **Reactive** | Fast reflexes, low latency, minimal judgment | Urgent stimuli, game ticks, safety veto |
| **Curious** | High exploration, question generation, diverse sampling | Low drive satisfaction, novel environments |
| **Conservative** | High rejection threshold, low risk, symbolic-only | Degraded resources, high uncertainty |
| **Creative** | High proposal diversity, sandboxed experimentation | Explicit exploration goals |
| **Social** | Clarification-seeking, human-in-the-loop | Ambiguous input, low confidence |
| **Repair** | Contradiction resolution, test fixing, consistency | Detected incoherence |
| **Consolidating** | Memory decay, schema induction, integration | Low external stimulus, maintenance cycles |

---

## 3. Resource Layer

### 3.1 Budget Ledger
**Dimensions (10):**
| Dimension | Unit | Typical Ceiling |
|---|---|---|
| `cycles` | Control steps | Per-cycle + lifetime |
| `derivations` | Symbolic inference steps | Per-cycle |
| `premises` | Premise selections | Per-cycle |
| `memoryOps` | Memory reads/writes | Per-cycle + lifetime |
| `modelCalls` | Neural/LM invocations | Per-cycle + lifetime |
| `tokens` | LM token usage | Per-call + lifetime |
| `latency` | Wall-clock time | Per-transaction |
| `attention` | Focus slots | Per-cycle |
| `risk` | Safety/irreversibility quota | Per-session |
| `humanAttention` | Approval/clarification cost | Per-session |

**Algebra:** Bounded distributive lattice with economic operations:
| Operation | Symbol | Semantics |
|---|---|---|
| Meet (tighter) | $B_1 \sqcap B_2$ | Grant only if both grant |
| Join (looser) | $B_1 \sqcup B_2$ | Grant if either grants |
| Product (independent) | $B_1 \otimes B_2$ | Independent dimensions |
| Transfer | $\text{transfer}(B_i, B_j, \Delta)$ | Lend surplus from $B_i$ to $B_j$ |
| Reservation | $\text{reserve}(B, \text{cost})$ | Pre-commit resources before execution |
| Settlement | $\text{settle}(B, \text{actual})$ | Reconcile reserved vs. consumed |

### 3.2 Reservation Manager
**Protocol:**
```
1. RESERVE:   Before executing, scheduler reserves required budget:
               B_available ← B_available − B_reserved

2. EXECUTE:   Transaction runs within its reservation.

3. SETTLE:    After execution:
               B_settled = B_reserved − B_unused
               B_available ← B_available + B_unused

4. EXHAUSTION: If reservation fails:
               → Typed exhaustion event (never silent)
               → Backpressure signal to scheduler
               → Degradation or skip per failure policy
```

### 3.3 Utility Estimator
**Scoring Function:**
$$\mathsf{score}(\tau) = \frac{\hat{\Delta}K + \hat{\Delta}G + \hat{\Delta}H}{\lambda_c \hat{C} + \lambda_r \hat{R} + \lambda_h \hat{H}_{\text{human}}}$$

Where:
- $\hat{\Delta}K$ = expected epistemic gain (uncertainty reduction, contradiction resolution)
- $\hat{\Delta}G$ = expected teleological gain (goal progress)
- $\hat{\Delta}H$ = expected homeostatic improvement (drive balance, coherence)
- $\hat{C}$ = expected resource cost
- $\hat{R}$ = expected risk
- $\hat{H}_{\text{human}}$ = expected human attention cost
- $\lambda_c, \lambda_r, \lambda_h$ = tunable scarcity weights

### 3.4 Thermodynamic Extension (Optional)
**Model:**
- Every task has **activation energy** $E$ based on surprise × utility
- System has global **cognitive temperature** $T$
- Probability of pursuing a derivation: $P \propto \exp(-\Delta E / T)$
- High $T$ → exploration; Low $T$ → exploitation
- Total energy pool is bounded (AIKR preserved)

---

## 4. Governance Layer

### 4.1 Gate Registry (Oriented Lattice)
**Four Kernel Gates:** Perception, Action, Reward, Budget.

**Gate Orientation:**
| Orientation | Semantics | Failure Behavior |
|---|---|---|
| **Interior** (fail-closed) | Contractive: $g(x) \leq x$. Only admits a subset. | On fault → refuse |
| **Closure** (fail-open) | Extensive: $x \leq g(x)$. Does not remove. | On fault → admit with degraded flag |

**Default Asymmetry:** $\alpha = (\text{interior}, \text{closure})$ — strict in, permissive out. Configurable per deployment.

**Gate Composition:**
| Operation | Semantics |
|---|---|
| $G_1 \circ G_2$ | Serial: admit only if both admit |
| $G_1 \parallel G_2$ | Parallel: admit if both admit (concurrent evaluation) |
| $G_1 \oplus G_2$ | Voting: admit if weighted majority admits |
| $G_1 \triangleright G_2$ | Fallback: try $G_1$; on fault, try $G_2$ |
| $\neg G$ | Complement: admit iff $G$ refuses |

### 4.2 Trust Manifold
**Trust Profile:**
```typescript
TrustProfile {
  sourceQuality: Float          // tiered: PRIMARY=0.9, LLM_PRIOR=0.5, ...
  sourceReputation: Float       // per-source learned multiplier (floor 0.5)
  claimSpecificity: Float       // how specific/falsifiable the claim is
  corroboration: Float          // independent evidence supporting this claim
  calibratedScore: Float?       // manifold head output (isotonic calibrated)
  judgeStatus: JudgeStatus      // {pending, scored, vetoed, abstained}
  proofStatus: ProofStatus      // {none, schema, step-proof, formal}
  digestPinned: Boolean         // model weights hash-verified
}
```

**Admission Bands:**
| Band | Condition | Action |
|---|---|---|
| **Act** | $T \geq \theta_{\text{act}}$ | Commit directly |
| **Review** | $\theta_{\text{defer}} \leq T < \theta_{\text{act}}$ | Provisional commit with decay; flagged for re-judgment |
| **Block** | $T < \theta_{\text{defer}}$ | Reject (ingress) or veto (egress) |
| **Ambiguous** | abstain | Inject clarification question + curiosity spike |

### 4.3 Judgment Manifold
**Structure:** Calibrated ensemble of multiple heads (symbolic, manifold, reflex, peer).
- Isotonic calibration maps raw scores to calibrated probabilities
- Model digests (SHA256 of weights) pinned; mismatch → fail-closed
- Abstention → clarification question + curiosity drive spike
- Every judgment decision is a `CognitiveTransaction` of kind `judgment`

### 4.4 Risk Classifier
**Governance Profile:**
```typescript
GovernanceProfile {
  trust: [0, 1]
  confidence: [0, 1]
  risk: [0, 1]
  reversibility: [0, 1]
  blastRadius: [0, 1]
  proofStatus: ProofStatus
  judgeStatus: JudgeStatus
  simulationStatus: SimulationStatus
  autonomyLevel: AutonomyLevel
}
```

**Authorization Policy Surface:**
| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| High | Low | High | Auto-commit |
| High | Medium | High | Shadow-commit, then promote |
| Medium | Low | High | Provisional commit with decay |
| Medium | Medium | Medium | Human review |
| Low | High | Low | Reject |
| Any | High | Low | Strong proof or human approval required |
| Any | Any | Informational | Auto-commit (no state change) |

### 4.5 Autonomy Ladder
| Rung | Authority | Human Role |
|---|---|---|
| 0 — Observe-only | System watches; no mutations | Passive monitoring |
| 1 — Propose-only | System proposes; human decides | Active approval |
| 2 — Sandbox-execute | System executes in isolated sandbox | Post-hoc review |
| 3 — Low-risk auto | System auto-applies low-risk changes | Exception review |
| 4 — Human-approved production | System operates; irreversible changes need approval | Governance board |

### 4.6 Verification Portfolio
| Verifier | What It Checks | Independence |
|---|---|---|
| **Symbolic verifier** | Derivation validity, truth-table agreement | Engine-independent; transcribed rules |
| **Calibrated judge** | Proposal quality, grounding, coherence | Digest-pinned weights; isotonic calibration |
| **Simulator** | Action consequences, plan feasibility | Isolated execution |
| **Shadow executor** | Self-modification patches, config changes | Full CI in isolated worktree |
| **Proof checker** | Formal invariant preservation | Zero engine dependencies |
| **Human approver** | High-risk, irreversible, novel changes | External authority |

---

## 5. Memory Layer

### 5.1 Memory Architecture
**Structure:** Bounded comonad with decay, eviction, and port abstraction.

```typescript
Memory {
  store: BoundedBag<Term, TruthValue, Metadata>
  concepts: ConceptGraph          // term → concept links
  episodic: EpisodicStore         // time-indexed experiences
  working: WorkingMemory          // active focus contents
  procedural: ProceduralStore     // learned skills, schemas
  ports: MemoryPorts              // 10 typed access interfaces
}
```

### 5.2 Memory Ports (Typed Access)
All cycle-path access goes through **named ports**, not direct memory references:

| Port | Interface |
|---|---|
| `ConceptReader` | Read concepts, links, truth values |
| `ConceptWriter` | Write concepts (commit ledger only) |
| `TaskAdmission` | Admit tasks into the cycle |
| `BeliefTable` | Query beliefs by term |
| `GoalEnumeration` | Enumerate active goals |
| `LinkPort` | Read/write concept links |
| `StatisticsView` | Read memory statistics |
| `SymbolIndex` | Term → symbol lookup |
| `MemoryClock` | Timestamps, decay scheduling |
| `AttentionOwner` | Attention model installation |

### 5.3 Decay & Forgetting
| Mechanism | Trigger | Effect |
|---|---|---|
| **Priority decay** | LRU / access pattern | Reduces attention priority; does not affect truth |
| **Truth decay** | Temporal invalidation / contradiction | Reduces confidence; only on evidence change |
| **Eviction** | Bag over capacity | Removes lowest-priority items |
| **Consolidation** | Memory pressure | Merges episodic → semantic; compresses |
| **Archival** | Long-term inactivity | Moves to cold storage; retrievable |
| **Forgetting** | Explicit policy or pressure | Permanent removal; event-logged |

**Critical Invariant:** Truth decay and attention decay are **decoupled**. A belief's truth value changes only on evidence invalidation, never on access patterns. Attention priority changes on access, never on evidence.

### 5.4 Bounded Bags
All containers are **bounded priority bags**:
$$\text{Bag}(T) = \langle \text{items}: T^*,\; \text{capacity}: \mathbb{N},\; \text{priority}: T \to [0,1] \rangle$$

Operations: `add`, `sample` (probabilistic by priority), `decay`, `evict`. No unbounded accumulators exist.

---

## 6. Provenance Layer

### 6.1 Event Log
**Structure:** Append-only JSONL/SQLite; typed events; ordered; immutable.

**Event Families (36+ types):**
- Kernel (12): `task.admitted`, `derivation.accepted`, `belief.revised`, `concept.activated`, `budget.exhausted`, `policy.violation`, `autonomy.mode.changed`, `self-mod.proposal`, `judgment.resolved`, `egress.gate.rejected`, `shadow.validation.dropped`
- NAR (22): `input.user`, `derivation.made`, `atom.derived/retracted`, `belief.added/retracted`, `drive.changed`, `goal.achieved/failed`, `skill.executed`, `tool.request/response`, `config.set/delete/schema`, `kernel.ready`, `backend.registered`, `bootstrap`, `cycle`, `health`, `conflict.detected`
- Proposal (2): `proposal.admitted`, `proposal.rejected`

### 6.2 Correlation Threader
Every event carries:
```typescript
Provenance {
  correlationId: CorrelationId    // minted at stimulus entry
  stimulusId: StimulusId          // originating external input
  sessionId: SessionId
  cycleId: CycleId                // which control cycle
  transactionId: TransactionId    // which cognitive transaction
  proposerId: ProposerId          // who generated this
  judgeId: JudgeId?               // who verified this
  proofId: ProofId?               // formal proof, if any
  parentId: ProvenanceId?         // parent in derivation DAG
  budgetScopeId: BudgetScopeId?   // which scope paid for this
  failureContext: FailureContext? // if degraded or rejected
}
```

### 6.3 Replay Engine
**Properties:**
- Pure reducers: $\text{fold}(\text{events}) \to X$
- Deterministic: $\text{replay}(\text{log}) \cong X_{\text{current}}$
- State hash after replay must match live state hash
- Control events (scheduling, admission, budget, graph-edit decisions) are **first-class events**

### 6.4 Standalone Verifier
**Independence (H7):**
- Imports **no engine code**
- Uses **transcribed truth table** (pinned by drift test)
- Checks: revision algebra, evidence independence, rule applicability, truth-value bounds

**Derivation Record:**
```typescript
DerivationRecord {
  conclusion: Term
  truthValue: (f, c)
  premises: [{term, truthValue}]
  rule: RuleId
  lineage: LineageDAG          // capped at depth 16
  stepProof: StepProof[]       // per-step justification
}
```

---

## 7. Reflexive Tower

### 7.1 Levels of Self-Modification
| Level | What Changes | Authority | Governance |
|---|---|---|---|
| L0 | Frozen | None | N/A |
| L1 | Knobs (thresholds, weights) | Auto or proposal | Low risk |
| L2 | Strategy selection | Proposal or auto | Medium risk; logged |
| L3 | Rules (symbolic induction, schema promotion) | Proposal + proof + shadow | High risk; CI validation |
| L4 | Topology (stage graph, budget lattice) | Meta-controller + governance | Highest risk; hot-swap at boundary |
| L5 | Code (patches, architecture) | Proposal → shadow worktree → full CI → external approval → merge | |
| L6 | Constitution (firewall, commit interface, governance) | **Never self-modifiable** | External only |

### 7.2 Learning as Governed Proposals
| Learning Domain | Mutates | Direct? | Governance |
|---|---|---|---|
| Attention weights | Focus allocation | Sometimes auto | Low risk |
| Strategy selection | Inference behavior | Proposal or auto | Medium risk |
| Parameter tuning | Budgets, thresholds | Proposal | Medium risk |
| Rule induction | Symbolic rules | Proposal | Proof + shadow validation |
| Schema promotion | Procedural → declarative | Proposal | Proof + shadow |
| Patch generation | Code / config | Proposal | CI + approval |
| Governance change | Gates, policies | **Never self-applied** | External governance |
| Reward function | Utility weights | **Never direct** | Human / external approval |

### 7.3 Governance Pipeline
```
Observation
  → Lesson (distilled correction)
  → Hypothesis (provisional explanation)
  → Strategy Proposal (typed, budgeted, scoped)
  → Shadow Test (isolated execution; full CI)
  → Risk Classification (PatchRiskClassifier)
  → Bounded Deployment (sandbox or low-risk auto)
  → Trace Evaluation (post-deployment monitoring)
  → Retention or Rollback
```

**Invariant:** Learning may propose changes to cognition, but it may not directly rewrite the laws of epistemic commitment (L6).

---

## 8. Stability & Degradation

### 8.1 Homeostatic Drives
| Drive | Setpoint | Function |
|---|---|---|
| **Curiosity** | High when novel | Drives exploration, question generation |
| **Competence** | High when capable | Drives skill acquisition, strategy refinement |
| **Coherence** | High when consistent | Drives contradiction resolution, consolidation |
| **Social** | High when connected | Drives clarification, delegation, communication |

Drives decay over time and are replenished by satisfying activities. Drive gaps generate **error signals** that the meta-controller uses to select cognitive programs.

### 8.2 Degradation Ladder
| Level | Condition | Behavior |
|---|---|---|
| 0 | Full operation | All substrates, all proposers, full judgment |
| 1 | Model unavailable | Symbolic fallback for all LM functions |
| 2 | Budget pressure | Reduce derivation depth; skip low-utility operations |
| 3 | Memory pressure | Aggressive eviction; consolidation; archive |
| 4 | Judgment unavailable | Symbolic-only admission; no manifold scoring |
| 5 | Tool unavailable | Skip tool-dependent stages; continue reasoning |
| 6 | Critical resource exhaustion | Minimal operation; preserve state; alert |
| 7 | Unrecoverable fault | Persist state; emit fault event; halt gracefully |

**Invariant:** Degradation is always **typed and logged**. No silent failure (H9). Every degradation produces a `CognitiveEvent` with the degradation reason.

### 8.3 Failure Policy Map
| Policy | Semantics | Use Case |
|---|---|---|
| `FailClosed` | On fault, reject / refuse | Ingress gates (safety) |
| `FailOpen` | On fault, admit / continue | Egress, internal cognition (liveness) |
| `Degrade(δ)` | On fault, apply degradation function δ | Judgment → symbolic fallback |
| `Abstain` | On fault, produce no output; inject question | Ambiguous input |
| `Retry(n)` | On fault, retry up to $n$ times | Transient network faults |
| `Escalate` | On fault, escalate to higher authority | Human review trigger |

----

# 5 · Invariants & Enforcement

## 1. Load-Bearing Invariants (Never Traded)

| # | Invariant | Formal Statement | Enforcement Mechanism | Falsification Test |
|---|---|---|---|---|
| **I1** | Epistemic firewall | `Reward ∤ BeliefTruth(f,c)` | Type-level: `CognitiveTransaction.axis` tagged; `CommitLedger` rejects cross-axis mutations | Benchmark: reward hacking attempt → must fail at type-check |
| **I2** | Single write authority | $\exists!\; \mathsf{commit} : \mathsf{Candidate} \to \mathsf{State}$ | Architectural: memory ports expose reads broadly, writes only to commit ledger | Test: state-hash verify after replay; no direct `memory.addTask` outside ledger |
| **I3** | Event-sourced state | $\mathsf{State}(t) = \mathsf{fold}(\mathsf{events}_{0..t}, \mathsf{State}_0)$ | `EventLog.append` called after every commit; `replayCognitiveState` reconstructs Σ | Test: state-hash verify; `replay ∘ log ≅ id` on reachable states |
| **I4** | Untrusted proposers, trusted judgment | `propose ⇒ judged-before-commit ∨ provisional-typing` | `GateAlgebra` gates all ingress; `VerificationPortfolio` judges all proposals | Benchmark: evidence laundering attempt → must be caught at admission |
| **I5** | Bounded cognition (AIKR) | Every reasoning path bounded in time/memory/derivations/LM | `ResourceEconomy.reserve` fails if budget exhausted; no unbounded loops | Test: AIKR pressure → graceful degradation, never hang |
| **I6** | Independent verification | `imports(verifier) ∩ imports(engine) = ∅` | Truth table transcribed, not imported; engine and verifier code disjoint; drift pinned by test | Test: verifier-drift pin; verifier re-derives without engine |
| **I7** | Inspectable control | Control choices ∈ event log | Every scheduling decision is a `CognitiveEvent`; `CycleTrace` sees every stage | Test: control-plane replay reconstructs *why* |
| **I8** | No equality contamination | Exact substrate never unions on uncertain similarity | E-graph isolation invariant; MeTTa results enter as proposals with source-quality | Test: arbiter pattern; equality saturation never sees NAL similarity |
| **I9** | No silent failure | Faults affecting cognition/budget/admission are events | Every failure is typed event; degradation is known weaker mode | Test: fault injection → typed event emitted, no silent swallow |
| **I10** | No irreversible bypass | Irreversible actions pass risk classification + authorization | `RiskProfile` classifies; `AutonomyPolicy` gates; `ActionGate` enforces | Test: action authorization → high-risk requires approval |

---

## 2. Constitution Φ — Hard Feasibility Laws

A configuration $r$ is **legal iff** $\Phi(r) = \text{true}$. Violating any produces an incoherent reasoner.

| # | Law | Formal Statement | Rationale |
|---|---|---|---|
| **Φ1** | AIKR requires bounded memory | $\mathcal{B}.\text{postulate} = \text{AIKR} \Rightarrow \mathcal{M}.\text{capacity} < \infty$ | Unbounded growth under bounded resources is incoherent |
| **Φ2** | Ampliative inference requires graded truth | $\mathcal{S}.\text{rules} \supseteq \{\text{induction, abduction}\} \Rightarrow \mathcal{V}.\text{carrier} \geq (f,c)$ | Binary truth cannot represent uncertain ampliative conclusions |
| **Φ3** | Untrusted proposers require gates | $\mathcal{S}.\text{proposers} \supseteq \{\text{stochastic}\} \Rightarrow \mathcal{G}.\text{gates} \neq \emptyset$ | Unjudged untrusted input = evidence laundering |
| **Φ4** | Reward learning requires firewall | $\mathcal{P}.\text{learning} \supseteq \{\text{reward}\} \Rightarrow \mathcal{V}.\text{firewall} = \text{structural}$ | Reward without firewall = belief corruption |
| **Φ5** | Self-modification requires governance | $\mathcal{P}.\text{selfmod} \geq \text{rules} \Rightarrow \mathcal{G}.\text{governance} \geq \text{shadow+CI}$ | Ungoverned self-mod = uncontainable |
| **Φ6** | Code self-mod requires external approval | $\mathcal{P}.\text{selfmod} = \text{code} \Rightarrow \mathcal{G}.\text{governance} \geq \text{external}$ | Self-approval is unsound (Löbian) |
| **Φ7** | Event sourcing requires replay | $\mathcal{P}.\text{provenance} \geq \text{event-sourced} \Rightarrow \mathcal{P}.\text{replay} \geq \text{deterministic}$ | Log without replay is just noise |
| **Φ8** | Independent verifier requires transcription | $\mathcal{P}.\text{verifier} = \text{standalone} \Rightarrow \text{truth table transcribed, not imported}$ | Shared code = shared bugs |
| **Φ9** | Paraconsistency requires non-monotonic logic | $\mathcal{V}.\text{contradiction} = \text{retained} \Rightarrow \mathcal{S}.\text{monotonic} = \text{false}$ | Monotonic + contradiction = explosion |
| **Φ10** | Exact substrate isolation | $\mathcal{S}.\text{exact} \neq \bot \wedge \mathcal{S}.\text{uncertain} \neq \bot \Rightarrow \text{memory isolation}$ | E-graph union on similarity = equality contamination |
| **Φ11** | Anytime requires preemptive scheduler | $\mathcal{B}.\text{execution} = \text{anytime} \Rightarrow \mathcal{C}.\text{scheduler} \in \{\text{priority, economic, learned}\}$ | FIFO cannot preempt |
| **Φ12** | Adaptive budgets require event-sourced decisions | $\mathcal{B}.\text{allocation} = \text{dynamic} \Rightarrow \mathcal{P}.\text{provenance} \geq \text{event-sourced}$ | Opaque dynamic allocation = unauditable |

---

## 3. Coupling Constraints (Inter-Axis Dependencies)

These further restrict the legal region of the design space.

| Coupling | Constraint | Implication |
|---|---|---|
| $\mathcal{S}.\text{expressivity} \times \mathcal{S}.\text{rules}$ | Higher-order terms require rule fragments or bounded search | Cannot have full higher-order logic with unbounded search |
| $\mathcal{B}.\text{postulate} \times \mathcal{M}.\text{forgetting}$ | AIKR requires forgetting; no AIKR without decay/eviction | Bounded memory ⇒ mandatory decay/eviction |
| $\mathcal{G}.\text{gates} \times \mathcal{P}.\text{provenance}$ | Every gate decision must be event-logged | Gate coverage ⇒ provenance depth ≥ gate decisions |
| $\mathcal{C}.\text{scheduler} \times \mathcal{P}.\text{provenance}$ | Learned schedulers must emit decision events | Adaptive scheduling ⇒ control-plane events |
| $\mathcal{V}.\text{firewall} \times \mathcal{P}.\text{learning}$ | Any learner touching attention/policy needs the firewall | RL on attention weights ⇒ epistemic firewall |
| $\mathcal{C}.\text{control-word} \times \mathcal{R}.\text{level}$ | Meta-control edits require governance level ≥ L4 | Control graph changes ⇒ governed reflexivity |

---

## 4. Enforcement Architecture

### 4.1 Static Enforcement (Compile/Load Time)

| Mechanism | What It Enforces | Tooling |
|---|---|---|
| **Type System** | Epistemic firewall (I1), axis separation | TypeScript branded types, discriminated unions |
| **Config Validation** | Feasibility predicate Φ | Zod schema + custom validators at load time |
| **Graph Invariant Checking** | No unverified writes, budget/gate coverage | Static analysis of `ControlWord.stageGraph` |
| **Dependency Gates** | Package direction, cycle-path isolation | `pnpm core:no-lm`, `pnpm cycle:no-provider`, `deps:gate` |

### 4.2 Dynamic Enforcement (Runtime)

| Mechanism | What It Enforces | Implementation |
|---|---|---|
| **Commit Ledger** | Single write path (I2), firewall (I1), governance | Central `CommitLedger.commit()`; all mutations route here |
| **Budget Reservation** | AIKR boundedness (I5), no silent starvation | `ResourceEconomy.reserve()` fails with typed exhaustion event |
| **Gate Algebra** | Untrusted proposer gating (I4), ingress/egress asymmetry | `GateRegistry` with oriented lattice; trust field computation |
| **Event Log** | Event-sourced state (I3), inspectable control (I7) | `EventLog.append()` after every commit; correlation ID threading |
| **Verification Portfolio** | Independent verification (I6), judgment calibration | `SymbolicVerifier` (transcribed rules), `JudgmentManifold` (digest-pinned) |
| **Reflexive Tower** | Governed self-mod (I10), no self-approval | `GovernancePipeline` with external runner; shadow worktree + CI |

### 4.3 Observability Enforcement (Continuous)

| Mechanism | What It Enforces | Implementation |
|---|---|---|
| **Cycle Trace** | Every stage visible, every decision auditable | `CycleTrace` regions with `finally` blocks; `getPhaseSummary` |
| **Budget Telemetry** | Per-scope consumption, exhaustion events | Prometheus `gateDecisionsTotal`, `gateVetoesTotal`, `lm_spend_*` |
| **Replay Verification** | Deterministic replay, state-hash match | `replayIntoMemory` → `computeReplayStateHash` / `verifyReplayStateHash` |
| **Drift Tests** | Engine-verifier agreement pinned | `verifier-drift.test.ts` measures and pins divergences |

---

## 5. Invariant Preservation Under Composition

When composing configurations $c_1 \otimes c_2$, $c_1 \oplus c_2$, or $c \mid P$:

| Invariant | Preserved By |
|---|---|
| **I1 (Firewall)** | Type system compositionality; axis tags flow through composition |
| **I2 (Single Write)** | Commit ledger is a singleton port; composition cannot create second |
| **I3 (Event Source)** | Event log is monoidal; `fold(e₁ ∘ e₂) = fold(e₂) ∘ fold(e₁)` |
| **I4 (Proposer/Judge)** | Arbitration layer is a port; composition preserves boundary |
| **I5 (AIKR)** | Budget monoid is compositional; total ceiling preserved under $\sqcap, \sqcup, \otimes$ |
| **I6 (Verifier)** | Verifier port contract requires transcription; implementations cannot share code |
| **I7 (Inspectable)** | Control events are first-class in event log; composition preserves event structure |
| **I8 (Equality)** | Substrate isolation is a port contract; arbiter pattern composes |
| **I9 (No Silent)** | Failure policy is part of operator spec; composition cannot remove |
| **I10 (Irreversible)** | Risk classifier and autonomy ladder are ports; composition respects governance |

---

## 6. Configuration Rejection Criteria

At load time, the following configurations are **rejected** (not merely warned):

| Rejected Configuration | Violated Law | Error Type |
|---|---|---|
| `reward` writes to `Belief.frequency` or `Belief.confidence` | H1, Φ1, Φ4 | `EpistemicFirewallViolation` |
| LM proposer wired directly to memory without gate | H2, Φ3 | `UntrustedProposerError` |
| Budget scope with no ceiling or open-ended allocation | H5, Φ1 | `UnboundedBudgetError` |
| Verifier importing engine algebra modules | H7, Φ8 | `VerifierIndependenceError` |
| E-graph configured to union on NAL similarity scores | H8, Φ10 | `EqualityContaminationError` |
| Self-modification pipeline without external approval at L5+ | H4, Φ6 | `UngovernedSelfModError` |
| Learned scheduler without decision-event emission | H6, Φ12 | `OpaqueSchedulerError` |
| Config with `eventSourced: true` but no `replay` implementation | Φ7 | `MissingReplayError` |
| Paraconsistent retention with monotonic logic substrate | Φ9 | `ContradictionExplosionError` |
| Any-time execution with FIFO-only scheduler | Φ11 | `NonPreemptiveSchedulerError` |

---

## 7. Runtime Invariant Monitoring

**Continuous Checks (every cycle):**

```typescript
interface InvariantMonitor {
  // I1: Firewall
  checkFirewall(): AssertionResult;
  
  // I2: Single write
  checkWritePaths(): AssertionResult;
  
  // I3: Event sourcing
  checkEventLogCompleteness(): AssertionResult;
  
  // I5: Budget bounds
  checkBudgetBounds(): AssertionResult;
  
  // I7: Control visibility
  checkControlEventCoverage(): AssertionResult;
  
  // I9: Silent failures
  checkFailureEvents(): AssertionResult;
}
```

**Alerting:** Any invariant violation emits a `policy.violation` event with typed reason, correlation ID, and full causal context. System enters degradation mode (level ≥ 2) rather than continuing with violated invariant.

---

## 8. Migration Invariants (SeNARS → METAREASONER)

During incremental migration, these invariants **must hold at every phase**:

| Phase | Invariants Active | New Invariants Added |
|---|---|---|
| **0. Kernel** | I1, I2, I3, I5 | — |
| **1. Ledger** | I1–I3, I5 | I4 (untrusted proposers gated) |
| **2. Graph** | I1–I5 | I7 (inspectable control) |
| **3. Economy** | I1–I5, I7 | Φ12 (adaptive budgets event-sourced) |
| **4. Manifold** | I1–I5, I7, Φ12 | I6 (independent verifier), I8 (equality isolation) |
| **5. Tower** | I1–I8, Φ1–Φ12 | I9 (no silent failure), I10 (no irreversible bypass), Φ3–Φ6 |
| **6. Reflexivity** | All | Φ5–Φ6 (governed self-mod), Φ11 (anytime scheduler) |
| **7. Ecology** | All | Φ3 extended (peer proposers gated) |

**No phase may regress on any invariant.** Each phase is a valid METAREASONER configuration satisfying Φ.

----

# 6 · Configurations

## 1. Specification Grammar

A reasoner configuration is a first-class value expressed in a declarative grammar:

```typescript
ReasonerSpec = {
  // Knowledge plane
  substrate: SubstrateConfig
  language: LanguageConfig
  world: WorldModelConfig
  calculus: CalculusConfig
  consistency: ConsistencyConfig

  // Inference plane
  spectrum: InferenceSpectrumConfig
  direction: InferenceDirectionConfig
  exact: ExactComputeConfig
  termination: TerminationConfig

  // Control plane
  resources: ResourceConfig
  scheduler: SchedulerConfig
  forgetting: ForgettingConfig

  // Learning plane
  locus: LearningLocusConfig
  reward: RewardConfig
  beliefGoal: BeliefGoalSplitConfig

  // Authority plane
  trust: TrustConfig
  provenance: ProvenanceConfig
  governance: GovernanceConfig
  embodiment: EmbodimentConfig
  composition: CompositionConfig
}
```

---

## 2. Profile Definitions

### 2.1 Device Profile (Tier 0 — Reflex Only)
```json
{
  "profile": "device",
  "substrate": {
    "terms": "flat-atoms",
    "rules": ["deduction"],
    "truth": "boolean",
    "proposers": [],
    "paraconsistent": false
  },
  "control": {
    "kappa": "(infer · commit)*",
    "scheduler": "FIFO",
    "parallelFoci": false
  },
  "budget": {
    "dims": ["derivations"],
    "ceilings": { "derivations": 100 }
  },
  "governance": {
    "gates": [],
    "firewall": "none"
  },
  "valuation": {
    "truth": "boolean",
    "goals": "none"
  },
  "memory": {
    "store": "flat-table",
    "decay": "none"
  },
  "provenance": {
    "level": 0,
    "verifier": "none"
  },
  "reflexivity": { "level": "L0" }
}
```
**Character:** Minimal deductive engine. No LM, no gates, no provenance. Fast, deterministic, embedded.

---

### 2.2 Conversation Profile (Tier 2 — Cortex + NAL)
```json
{
  "profile": "conversation",
  "substrate": {
    "terms": "Narsese",
    "rules": "NAL-44",
    "truth": "(f,c)",
    "proposers": ["LM-rules", "reflex"],
    "paraconsistent": true
  },
  "control": {
    "kappa": "full-cycle-graph",
    "scheduler": "priority-bags",
    "parallelFoci": false
  },
  "budget": {
    "dims": ["cycles", "derivations", "premises", "memoryOps", "modelCalls"],
    "scopes": "lattice",
    "allocation": "priority"
  },
  "governance": {
    "gates": ["perception", "action", "reward", "budget"],
    "orientation": ["closed", "open"],
    "manifold": "19-head-calibrated",
    "autonomy": "5-rung-ladder"
  },
  "valuation": {
    "truth": "NAL",
    "goals": "(d,c)",
    "firewall": "structural",
    "ranking": "EIG"
  },
  "memory": {
    "store": "bounded-bags+graph",
    "decay": "decoupled",
    "ports": 10,
    "episodic": true,
    "procedural": true
  },
  "provenance": {
    "level": 3,
    "verifier": "standalone-transcribed",
    "correlation": "full"
  },
  "reflexivity": {
    "level": "L3",
    "governance": "shadow+CI"
  }
}
```
**Character:** Neuro-symbolic conversation. LM proposes, NAL judges. Governed, auditable, bounded.

---

### 2.3 Research Profile (Tier 2+ — Full Enrichment)
```json
{
  "profile": "research",
  "substrate": {
    "terms": "Narsese+MeTTa",
    "rules": "NAL-44+exact",
    "truth": "(f,c)×(d,c)",
    "proposers": ["LM", "reflex", "peer", "metta"],
    "paraconsistent": true
  },
  "control": {
    "kappa": "full-cycle-graph",
    "scheduler": "economic",
    "parallelFoci": true,
    "heterochronous": true
  },
  "budget": {
    "dims": ["cycles", "derivations", "premises", "memoryOps", "modelCalls", "latency", "risk", "humanAttention"],
    "scopes": "lattice",
    "allocation": "utility-based",
    "thermodynamic": true
  },
  "governance": {
    "gates": ["perception", "action", "reward", "budget"],
    "orientation": ["closed", "open"],
    "manifold": "19-head-calibrated",
    "autonomy": "5-rung-ladder",
    "trustField": true,
    "riskManifold": true
  },
  "valuation": {
    "truth": "NAL",
    "goals": "(d,c)",
    "firewall": "structural",
    "ranking": "EIG",
    "questionValuation": "info-theoretic"
  },
  "memory": {
    "store": "bounded-bags+graph",
    "decay": "decoupled",
    "ports": 10,
    "episodic": true,
    "procedural": true,
    "counterfactual": true
  },
  "provenance": {
    "level": 5,
    "verifier": "standalone-transcribed",
    "correlation": "full",
    "controlPlaneEvents": true
  },
  "reflexivity": {
    "level": "L5",
    "governance": "shadow+CI+external"
  },
  "arbitration": {
    "mode": "arbited",
    "isolation": "strict"
  }
}
```
**Character:** Full neuro-symbolic-governed reasoner. Economic scheduling, continuous trust, recursive reflexivity, multi-rate cognition.

---

## 3. Preset Definitions

### 3.1 FAST Preset (Latency-Optimized)
```json
{
  "preset": "FAST",
  "overrides": {
    "control.scheduler": "reactive",
    "budget.allocation": "latency-first",
    "governance.manifold": "symbolic-only",
    "provenance.level": 1,
    "reflexivity.level": "L1",
    "substrate.proposers": ["reflex"]
  }
}
```

### 3.2 NEURAL_HEAVY Preset (Proposal-Rich)
```json
{
  "preset": "NEURAL_HEAVY",
  "overrides": {
    "control.scheduler": "creative",
    "budget.allocation": "high-proposal-diversity",
    "governance.manifold": "full-ensemble",
    "governance.trustField": "loose",
    "substrate.proposers": ["LM", "LM-rules", "reflex", "peer"],
    "provenance.level": 4
  }
}
```

### 3.3 DEEP_AUDIT Preset (Maximum Observability)
```json
{
  "preset": "DEEP_AUDIT",
  "overrides": {
    "control.scheduler": "deliberative",
    "governance.manifold": "full-ensemble+formal",
    "governance.autonomy": "human-approved-production",
    "provenance.level": 5,
    "provenance.controlPlaneEvents": true,
    "reflexivity.level": "L3",
    "verification": "proof+judge+simulation+formal"
  }
}
```

---

## 4. Feature Toggles (Bounded Subspace)

| Toggle | Axis | Default | Range |
|---|---|---|---|
| `enableRL` | Learning → RLFP | `false` | `false` \| `true` |
| `enableSelfImprovement` | Reflexivity → self-mod | `false` | `false` \| `true` |
| `enablePersistence` | Provenance → event log backend | `false` | `false` \| `sqlite` \| `jsonl` |
| `enableSystemOne` | Substrate → judgment manifold | `false` | `false` \| `true` |
| `enableMetta` | Substrate → exact co-processor | `false` | `false` \| `true` |
| `enablePeerDelegation` | Ecological → multi-agent | `false` | `false` \| `true` |
| `enableThermodynamic` | Economy → allocation mode | `false` | `false` \| `true` |
| `enableHeterochronous` | Control → multi-rate | `false` | `false` \| `true` |

**Invariant:** Every toggle combination satisfies Φ. Toggles move within the valid region.

---

## 5. Behavioral Coordinate Examples

### 5.1 Reflexive Agent (Embedded/IoT)
```yaml
ControlGraph:      single loop (perceive → act)
Scheduler:         priority queue (reactive)
Admission:         fail-open (internal)
Verification:      minimal (symbolic only)
Budget:            latency-first (hard deadline)
Autonomy:          sandbox-only
Learning:          reflex weights only (L1)
Provenance:        level 1 (final answers)
Substrate:         NAL deduction only
```
**Use Case:** Real-time control, robotics, game AI. Millisecond latency budget.

---

### 5.2 Formal Theorem Prover (Math/Verification)
```yaml
ControlGraph:      deliberative loop (retrieve → infer → verify → commit)
Scheduler:         proof-progress (depth-first with backtracking)
Admission:         proof-gated (formal verification required)
Verification:      formal proof (MeTTa equality saturation)
Budget:            derivation-heavy (high ceiling, no LM calls)
Autonomy:          observe-only (no external effects)
Learning:          rule induction with proof (L3)
Provenance:        level 4 (step-level traces + formal proofs)
Substrate:         Exact (dependent types) + NAL deduction
```
**Use Case:** Theorem proving, formal verification, program synthesis. Correctness > speed.

---

### 5.3 Creative Explorer (Research/Discovery)
```yaml
ControlGraph:      proposal graph (attend → propose → verify → rank → commit)
Scheduler:         novelty-weighted (high exploration budget)
Admission:         provisional (medium trust → review band)
Verification:      shadow simulation (sandbox execution)
Budget:            high proposal diversity (tokens, modelCalls)
Autonomy:          sandbox (all actions simulated)
Learning:          schema induction + RLFP (L3-L4)
Provenance:        level 3 (derivation conclusions + causal graph)
Substrate:         NAL + LM proposers + MeTTa for exact sub-problems
```
**Use Case:** Scientific discovery, open-ended reasoning, hypothesis generation. Exploration > exploitation.

---

### 5.4 Safe Production Agent (Enterprise/Operations)
```yaml
ControlGraph:      transaction graph (full commit pipeline per mutation)
Scheduler:         risk-adjusted utility (conservative)
Admission:         calibrated + proof (high threshold)
Verification:      judge + simulation + human (for irreversible)
Budget:            conservative (low ceilings, high reserves)
Autonomy:          human-approved irreversible actions (L4)
Learning:          governed proposals only (L2-L3)
Provenance:        level 5 (full causal graph + control plane)
Substrate:         NAL + symbolic verifier (no LM in hot path)
```
**Use Case:** Production systems, compliance, safety-critical. Auditability > adaptivity.

---

### 5.5 SeNARS (Current Implementation)
```yaml
ControlGraph:      dual nested loops (macro 8-phase, micro 6-stage)
Scheduler:         priority bags + RLFP (adaptive inner, fixed outer)
Admission:         fail-closed ingress, mostly open internal
Verification:      manifold + symbolic verifier (19 heads)
Budget:            scopes + lifetime limits (6 control scopes)
Autonomy:          5-rung ladder (action only)
Learning:          governed self-improvement (L3-L4, approval gap)
Epistemics:        belief/goal firewall (structural)
Observability:     event log + cycle trace (provenance level 2-3)
```
**Use Case:** Current SeNARS deployment. Balanced, bounded, auditable, neuro-symbolic.

---

### 5.6 METAREASONER (Ultimate Hybrid Target)
```yaml
ControlGraph:      conditional DAG + heterochronous tower (5 levels)
Scheduler:         economic meta-controller (utility-driven, learned)
Admission:         unified commit ledger (typed, governed)
Verification:      proof/judge/simulation portfolio (multi-mechanism)
Budget:            reservations + prices + markets (lattice + thermodynamic)
Autonomy:          risk/reversibility manifold (all mutations)
Learning:          governed proposal pipeline (L1-L5)
Epistemics:        typed cognitive algebra (axis-tagged transactions)
Observability:     causal proof graph with correlation IDs (level 5)
```
**Use Case:** The target architecture. Flexible, powerful, self-aware, governable.

---

## 6. Configuration Composition

Configurations compose algebraically:

```typescript
// Sequential: run config A then config B
const sequential = compose(configA, configB);  // c₁ ⊗ c₂

// Parallel: run configs concurrently, join results
const parallel = parallelize(configA, configB); // c₁ ⊕ c₂

// Restrict: project onto subset of capabilities (degradation as algebra)
const degraded = restrict(config, { substrate: "symbolic-only" }); // c | P

// Refine: substitute with richer implementation
const refined = refine(config, { scheduler: "economic" }); // c₁ ⊑ c₂

// Lift: apply functor (e.g., parallelize every component)
const lifted = lift(config, parallelize); // lift(c, f)
```

**Compositionality:** `⟦c₁ ⊗ c₂⟧ = ⟦c₁⟧ ∘ ⟦c₂⟧`. All compositions preserve Φ.

---

## 7. Instantiation Tiers (Kernel-First)

| Tier | Config | Capability |
|---|---|---|
| **M₀** | Minimal deductive | Single rule, flat memory, no provenance |
| **M₁** | + NAL truth, priority bags | Uncertain reasoning, attention |
| **M₂** | + Event sourcing, replay | Auditable cognition |
| **M₃** | + Gates, firewall, judgment | Governed neuro-symbolic |
| **M₄** | + Conditional graph, correlation | Fluid control, causal tracing |
| **M₅** | + Budget lattice, utility scheduling | Economic resource allocation |
| **M₆** | + Meta-controller, governed self-mod | Recursive self-improvement |
| **M₇** | + Multi-agent, peer delegation | Ecological reasoning |

Each tier adds capability without breaking invariants of previous tiers.

----

# 7 · Migration Strategy

## Migration Philosophy

**Principle:** Every architectural abstraction must have a plausible migration path from current SeNARS mechanisms. Avoid designs whose elegance depends on replacing the entire runtime at once. The elegance never depends on replacing the whole runtime at once.

**Approach:** Layered, monotone enrichment — each phase preserves all invariants of prior phases while adding capability. SeNARS is not discarded; it is *lifted* into the new architecture.

---

## Phase 0: Kernel (Weeks 1-2) — Foundation

**Goal:** Establish the five-part minimal core that satisfies Φ trivially.

### Deliverables
| Component | SeNARS Source | New Implementation |
|---|---|---|
| Substrate | NAL term algebra + truth algebra | `TermAlgebra`, `TruthAlgebra` ports |
| Control Word | Hard-coded 6-stage loop → KAT expression | `ControlWord` with `(infer · commit)*` |
| Admission Gate | `PerceptionGate.admitTask()` | `GateRegistry` with single interior gate |
| Budget Monoid | `KernelBudgetGate` + `ControlBudgets` | `BudgetLedger` with single `derivations` dimension |
| Provenance Fold | `EventLog` + `CognitiveEvent` | `EventLog` with `fold()` and `replay()` |

### Migration Steps
1. Extract `NARExecution.run()` stage sequence into `ControlWord.expression`
2. Wrap `authorize` stage in `CommitLedger.commit()`
3. Route `memory.addTask()` through `CommitLedger` (write path unification)
4. Add `correlationId` threading to `EventLog.append()`
5. Verify `replay(events) ≅ id` on current state

### Preserves
- All current behavior
- All invariants (I1–I5)

### Gains
- Elegance: one write path
- Causal observability: correlation IDs

---

## Phase 1: Unified Commit Ledger (Weeks 3-5) — Unification

**Goal:** Collapse all mutation paths into one `CommitLedger`.

### Current Mutation Paths (to Unify)
| Path | Current Entry Point | Current Gate |
|---|---|---|
| Perception (ingress) | `NARIO.input()` → `admit()` | `PerceptionGate` (async, fail-closed) |
| Derived admission | `NARExecution.authorize()` → `admit()` | `PerceptionGate` (sync, no refusal) |
| Tool goal dispatch | `dispatchToolGoals()` → `toolGoalExecutor` | None (ActionGate not consulted) |
| Model tool calls | `motorToToolSet()` → `motor.execute()` | None |
| Chat act tools | `phases.act()` → `commandParser` → `motor` | `PolicyEngine` only |
| Proposal admission | `proposals.takeDerived()` → `admit()` | `PerceptionGate` + lifecycle |
| Rule admission | `admitRule.admit()` → `RuleTableStore.admit()` | Lifecycle only (no gate) |
| Learning admission | `consolidateLearning()` → `nar.input()` | `PerceptionGate` |

### Migration Steps
1. Introduce `CognitiveTransaction` interface with all current mutation types as `TransactionKind`
2. Wrap each mutation path in `CommitLedger.commit(ct, ctx)`
3. Standardize commit pipeline: Normalize → TypeCheck → AxisCheck → EvidenceCheck → Verify → Rank → BudgetSettle → RiskClassify → GovernanceGate → Commit
4. Event-source all commits (already mostly done)
5. Add `correlationId` to every transaction

### Preserves
- All invariants
- All current behavior (commit pipeline configured to pass everything)

### Gains
- Single write authority (I2)
- Causal observability (I3, I7)
- Foundation for governed adaptation

---

## Phase 2: Data-Driven Control Graph (Weeks 6-9) — Flexibility

**Goal:** Replace hard-coded 6-stage loop with conditional DAG.

### Current Control Flow (to Replace)
```typescript
// nar-execution.ts:197 — hard-coded for loop
for (i = 0; i < steps; i++) {
  perceive → attend → reason → authorize → propose → learn
}
```

### Migration Steps
1. Introduce `ControlGraph` interface with `StageNode[]`, `StageEdge[]`
2. Represent current 6-stage loop as a graph (all guards = `true`, all edges = sequential)
3. Add conditional edges:
   - `perceive → attend` when `!signal.aborted`
   - `attend → reason` when `budget.remaining > θ`
   - `reason → authorize` when `hasDerivations`
   - `authorize → propose` when `hasProposer`
   - `propose → learn` when `!aborted`
   - `learn → perceive` when `!aborted`
4. Dispatch through existing `dispatch()` middleware primitive (Loop A already uses it)
5. `CycleTrace` still sees every stage (trace regions per node)

### Preserves
- All invariants
- `CycleTrace` observability
- Current behavior (all conditions true by default)

### Gains
- Stage skipping (e.g., skip `propose` if no producer)
- Conditional ordering (e.g., `attend` before `reason` only if budget affords)
- Parallel foci (fan-out at `attend` → `infer_belief` ∥ `infer_goal`)
- Graph versioning, revertability, governance

---

## Phase 3: Resource Economics (Weeks 10-14) — Adaptive Allocation

**Goal:** Replace static budgets with reservations + prices + markets.

### Current Budget System (to Enrich)
| Aspect | Current | Target |
|---|---|---|
| Dimensions | 4 base + 6 scopes | 10 dimensions + lattice scopes |
| Allocation | Fixed ceilings per scope | Reservations + utility pricing |
| Exhaustion | Silent truncation / break | Typed exhaustion event + backpressure |
| Transfer | None | Lattice transfer (surplus → starved) |
| Adaptation | None | Utility-driven + optional thermodynamic |

### Migration Steps
1. Introduce `ResourceEconomy.reserve()` / `settle()` alongside existing `ControlBudgets.charge()`
2. Keep `BUDGET_RESOURCES` as single source of truth for ceilings
3. Add pricing model: `score(op) = (ΔK + ΔG + ΔH) / (λ_c·C + λ_r·R + λ_h·H_human)`
4. Gradually replace fixed ceilings with dynamic allocation:
   - Phase 3a: Reservation protocol (prevents silent starvation)
   - Phase 3b: Utility scheduling (replaces priority bags for stage selection)
   - Phase 3c: Budget lattice transfers (surplus lending)
   - Phase 3d: Optional thermodynamic layer (Boltzmann allocation)

### Preserves
- AIKR boundedness (total budget fixed)
- Current behavior (pricing configured to match current priorities)

### Gains
- Graceful degradation under pressure
- Adaptive allocation (explore → prioritize → conserve → degrade)
- Economic reasoning about cognition

---

## Phase 4: Governed Reflexivity (Weeks 15-22) — Self-Improvement

**Goal:** Make the controller itself a learned, governed object.

### Current Adaptation (to Govern)
| Mechanism | Current | Target |
|---|---|---|
| Strategy adaptation | `CognitiveController.adapt()` → rebuilds `InferenceController` | Meta-controller proposes `ControlWord` edits |
| RLFP | `PolicyOptimizer` → strategy priority + knob updates | RLFP produces `SelfImprovementProposal` → governance |
| Schema induction | `SchemaInductor` → `SelfImprovementProposal` → `GovernanceResolver` | Same, but through unified commit ledger |
| Self-tools | 8 tools, approval not injected on NAR path | Approval gate injected; shadow CI mandatory |

### Migration Steps
1. **Promote RLFP:** From adapting strategy slots → adapting control graph edge weights and budget allocations
2. **Unify Proposals:** All learning (RLFP, schema induction, meta-cognition) produces `SelfImprovementProposal` through `CommitLedger`
3. **Governance Pipeline:** `PatchRiskClassifier` → `GovernancePolicyEngine` → `ProposalRouter` → `SandboxValidator` → shadow worktree + full CI → external immutable runner
4. **Hot-Swap:** Control-word edits install at cycle boundaries (preserve `derivationCount`, circular-detector state)
5. **Meta-Controller as Reasoner:** `MetaController = METAREASONER(control-state, control-operators, control-budget)`

### Preserves
- All invariants (governance pipeline enforces H4, H6, H10)
- Current learning behavior (proposals follow same path)

### Gains
- Adaptive control (learned scheduler, continuous strategy manifolds)
- Governed self-improvement (proposal → shadow → external → merge)
- Recursive reflexivity (meta-controller reasons about control using NAL)

---

## Phase 5: Full Enrichment (Weeks 23+) — Complete Architecture

**Goal:** Activate all axes to their full enrichment.

### Remaining Enrichments
| Axis | Current State | Full Enrichment |
|---|---|---|
| **Provenance Depth** | Level 2 (derivation conclusions) | Level 5 (control-plane events, scheduler decisions, graph edits) |
| **Trust Field** | Binary admit/reject (mostly) | Continuous `T ∈ [0,1]` with act/review/block bands |
| **Judgment Manifold** | 19 heads, isotonic, digest-pinned | + peer heads, collective calibration, ensemble mutual trust |
| **Autonomy Ladder** | 5 rungs (action only) | 5 rungs (all cognitive mutations) |
| **Heterochronous Tower** | 2 loops (macro + micro) | 5 levels (reflex → tick → deliberation → consolidation → identity) |
| **Ecological Layer** | Dormant/bench-only | Peer delegation, shared calibration, provenance fusion (gated) |

### Migration Steps
1. Increase provenance depth incrementally (cost/benefit per level)
2. Replace binary gates with continuous trust field (parameterized default)
3. Extend autonomy ladder from actions → all mutations
4. Implement heterochronous tower: each level = `ControlGraph` runner with own clock/budget
5. Gate ecological layer behind single-agent stability check

---

## Migration Risk Mitigation

| Risk | Mitigation |
|---|---|
| **Behavioral regression** | Each phase has integration tests against SeNARS behavioral baseline; `replay` verification |
| **Performance regression** | Benchmarks at each phase (`cycle-bench`, `rule-dispatch`, `manifold-bench`); budgets prevent unbounded cost |
| **Invariant violation** | Config validation against Φ at load time; runtime invariant monitor; CI gates |
| **Complexity explosion** | Kernel-first staging; each phase independently deployable; feature toggles |
| **Governance paralysis** | Graduated autonomy (risk determines path, not blanket approval); low-risk auto-applies |
| **Audit bloat** | Tiered/sampled audit; provenance depth is configurable axis |

---

## Rollback Strategy

Each phase is **revertible**:
- Control words are versioned; previous version hot-swaps at cycle boundary
- Budget lattice transfers are event-sourced; `revert(revision)` replays from event log
- Governance proposals have `retention | rollback`; shadow worktree cleaned on rejection
- Feature toggles move within bounded subspace; invariants are the manifold boundary

---

## Validation Gates (Per Phase)

| Gate | Command | Must Pass |
|---|---|---|
| **Behavioral Parity** | `pnpm e2e:pipeline` | Identical outputs for fixed seeds |
| **Invariant Check** | `pnpm config:validate` | Φ satisfied |
| **Replay Verify** | `pnpm replay:verify` | State hash matches |
| **Drift Pin** | `pnpm verifier:drift` | Engine-verifier divergence ≤ threshold |
| **Performance** | `pnpm bench:cycle` | ≤ 10% regression on median |
| **Safety** | `pnpm sabotage:test` | No invariant violation under fault injection |

---

## Timeline Summary

| Phase | Duration | Focus | Key Deliverable |
|---|---|---|---|
| 0. Kernel | 2 weeks | Foundation | Minimal core satisfying Φ |
| 1. Ledger | 3 weeks | Unification | Single commit ledger |
| 2. Graph | 4 weeks | Flexibility | Conditional stage graph |
| 3. Economy | 5 weeks | Adaptive Allocation | Reservation + pricing |
| 4. Reflexivity | 8 weeks | Self-Improvement | Governed meta-controller |
| 5. Enrichment | Ongoing | Full Power | All axes at full enrichment |

**Total:** ~22 weeks to full architecture, with runnable, validated system at every phase.

----

