# Ω · METAREASONER
## The Cognitive Control Algebra — Unified Ultimate Specification

> **One algebra. Every reasoner a point. Rigor is a coordinate, not a commandment.**

This document unifies `spec.1`, `spec.2`, `plan1234.1–3` into a single specification. It is a **specification of what the system is** — a configuration space — not a plan for how to build it. SeNARS migrates into it by becoming one point (`SeNARS₀`), the regression anchor.

---

## §0 · Thesis — The Rigor Spectrum

A reasoner is not an architecture. It is a **point in a structured algebra of cognition**. The current SeNARS, every `synth/` flavor, every classical system (ATP, Prolog, CLIPS, SOAR, NARS, ReAct, AlphaZero), and every system not yet designed are all points in the same space.

The five source documents agreed on the machinery but disagreed on a single question: **how much of it is mandatory?** Their specs treated invariants as "load-bearing, never traded." That is dogma. It excludes entire legitimate regions of the design space — high-frequency reactive agents, pure RL, unbounded theorem provers, embedded reflex controllers — where **you deliberately trade rigor for throughput, latency, or search depth.**

This specification resolves that by making the governing insight explicit:

> **Rigor is a coordinate.** Every guarantee — transactions, append-only logs, gates, firewalls, independent verifiers, governed self-modification — is a layer that can be **activated, downgraded, or waived**. Activating a guarantee buys safety and auditability at a runtime cost. Waiving it buys performance at a declared risk. The algebra defines the full space and the price of every movement; it does not mandate a corner.

### The two poles

| Pole | Character | Guarantees |
|---|---|---|
| **Ω₀ — Bare** | Fastest possible governed-by-nothing reasoner | None beyond the irreducible floor |
| **Ω̂ — Maximally Governed** | Fully audited, provable, self-governing | All guarantees active |

Every architecture is a projection between these poles. **SeNARS₀ sits near Ω̂. A reflex IoT controller sits near Ω₀. Lean/Coq waives boundedness. AlphaZero waives the firewall. All are legal points.**

### The three design axioms

1. **Universality.** The algebra expresses every reasoner — symbolic, neural, hybrid, cellular, thermodynamic, categorical, cybernetic, formal, reactive.
2. **Conservative extension.** Adding a guarantee layer never invalidates a configuration that lacks it. Unused layers cost nothing.
3. **Informed consent, not prohibition.** The validator rejects **contradictions**, not **leniency**. Waiving a guarantee is a first-class, declarative, risk-tagged choice — never forbidden, never silent.

### What becomes optional (per your directive)

| Feature | Status | Minimal alternative |
|---|---|---|
| **Cognitive Transactions** | Optional (§7). At `Κ.mode = raw`, cognition is plain function calls with no envelope. | Direct typed calls |
| **Append-only event log** | Optional (§8). At `Π.depth = 0`, there is no log; state is mutable and ephemeral. | In-place mutable state |
| **Single write authority** | Optional (§7). At `Κ.authority = distributed`, any component may write. | Direct memory writes |
| **Gates / judgment** | Optional (§5). At `α.gates = ∅`, everything is admitted. | No admission |
| **Budget reservation** | Optional (§6). At `β.mode = unbounded`, no reservation. | Unbounded execution |
| **Epistemic firewall** | Optional (§5). Waivable for unified-RL systems. | Conflated belief/goal |
| **Independent verifier** | Optional (§8). | No external check |

**The Irreducible Floor (§2.4) is the only non-optional part.** Everything else is on the spectrum.

---

## §1 · The Configuration Space

A reasoner is a value of `ReasonerSpec` — eight coordinates grouped into three planes plus a constitution:

```
ReasonerSpec = ⟨ Σ, κ, β | α, Κ, Π, ρ | Φ ⟩
                └─ Semantics ┘ └ Control/Economy ┘ └── Governance ──┘  └ Meta ┘
```

| Coord | Name | Plane | Question | Rigor dial |
|---|---|---|---|---|
| **Σ** | Substrate | Semantics | What do you reason over? | expressivity, fusion vs. isolation |
| **κ** | Control | Control | What happens next? | fixed → learned; opaque → inspectable |
| **β** | Economy | Economy | What limits & prices change? | unbounded → quotas → reservations → markets |
| **α** | Admission | Governance | What gets in / out / by? | open → gated → firewalled → risk-manifold |
| **Κ** | Commit | Governance | How does state become true? | raw writes → single port → transactions |
| **Π** | Provenance | Governance | What is remembered? | none → log → causal → verified replay |
| **ρ** | Reflexivity | Governance | Can it change its own rules? | frozen → knobs → strategies → rules → code |
| **Φ** | Constitution | Meta | Which guarantees are active vs. waived? | the waiver policy itself |

Each coordinate is a **lattice**: a set of named levels with a partial order. The configuration space is their product. The constitution Φ carves the **coherent** region (§2).

```ts
interface ReasonerSpec {
  Σ: SubstrateSpec;       // terms, truth, revision, storage, proposers
  κ: ControlSpec;         // word/DAG/queue/learned, nesting, heterochrony, scheduler
  β: EconomySpec;         // dimensions, scopes, reservation, pricing, thermodynamics
  α: AdmissionSpec;       // gates, orientation, trust, risk, autonomy, firewall
  Κ: CommitSpec;          // mutation model: raw | port | transactional
  Π: ProvenanceSpec;      // depth, correlation, verifier, replay
  ρ: ReflexivitySpec;     // filtration, self-mod governance, meta-controller
  Φ: GuaranteePolicy;     // active guarantees + declared waivers
}
```

---

## §2 · The Guarantee System — The Core Innovation

This is where this specification departs from its sources. The sources listed "load-bearing invariants" (`I1–I10`, `H1–H10`) as absolute. Here, they become a **catalog of guarantees**, each with a cost, a benefit, and a **waiver**.

### §2.1 The Guarantee Catalog

| ID | Guarantee | Activates | Cost to keep | Gain by waiving | Risk class if waived |
|---|---|---|---|---|---|
| **G1** | Epistemic firewall (reward ⊬ truth) | Σ, α | axis tagging, type checks | speed; unified RL value | `REWARD_HACKING` |
| **G2** | Untrusted ⇒ judged before commit | α | judgment pass | raw throughput | `EVIDENCE_LAUNDERING` |
| **G3** | Single write authority | Κ | all writes via one port | direct writes, low latency | `ORPHAN_STATE` |
| **G4** | Event-sourced state (state = fold) | Π | append log + fold | no logging overhead | `UNAUDITABLE` |
| **G5** | Independent verification | Π | separate verifier, transcribed rules | no verifier cost | `CO_ADAPTED_BUGS` |
| **G6** | Budget reservation & settlement | β | reserve/settle protocol | direct execution | `SILENT_STARVATION` / `RUNAWAY` |
| **G7** | Inspectable scheduling (control ∈ log) | κ, Π | decision events | faster scheduling | `OPAQUE_CONTROL` |
| **G8** | Equality isolation (exact ⊥ similarity) | Σ | arbiter boundary | fused memory, speed | `EQUALITY_CONTAMINATION` |
| **G9** | No silent faults (faults are events) | α, β | typed fault emission | swallow-and-continue | `SILENT_FAILURE` |
| **G10** | Irreversibility ⇒ authorization | α, ρ | risk classification + approval | instant irreversible action | `UNSAFE_IRREVERSIBILITY` |
| **G11** | Governed self-modification | ρ | shadow CI + external arbiter | direct self-mutation | `RUNAWAY_SELF_MOD` |
| **G12** | Boundedness (AIKR) | β | bounds on every path | unbounded search depth | `NON_TERMINATION` |

### §2.2 Waivers

Waiving is declarative and risk-tagged. A waiver is not an error; it is a **design selection** with an explicit cost.

```ts
interface GuaranteePolicy {
  active: GuaranteeId[];                 // guarantees this config implements
  waived: Waiver[];                      // guarantees deliberately released
}
interface Waiver {
  guarantee: GuaranteeId;
  rationale: string;                     // why performance/simplicity wins here
  riskClass: RiskClass;                  // what you accept in exchange
  mitigation?: string;                   // optional compensating control
}
```

**Example waivers that are now legal:**
- `AlphaZero` waives **G1** (conflated belief/value) → `riskClass: REWARD_HACKING`.
- `Lean/Coq` waives **G12** (unbounded tactic search) → `riskClass: NON_TERMINATION`.
- `ReAct` waives **G2** (LM output unjudged) → `riskClass: EVIDENCE_LAUNDERING`.
- `IoT reflex` waives **G4, G7** (no log, no control events) → `riskClass: UNAUDITABLE`.
- `CLIPS` waives **G3** (direct production-rule writes) → `riskClass: ORPHAN_STATE`.

### §2.3 The Validator — rejects contradictions, not leniency

```
validate(spec) → { loadable, hardErrors[], warnings[] }
```

- **`hardErrors`** arise only from **internal contradiction**, never from insufficient rigor:
  - Waived **G4** (no event log) but enabled independent verifier (**G5**) — verifier needs a log.
  - Waived **G1** (firewall) but enabled reward-learning that writes beliefs — incoherent combination.
  - Activated **G6** (reservation) with no budget dimensions.
  - Enabled governed self-mod (**G11**) with `ρ.level = code` and no external arbiter.
- **`warnings`** flag waived guarantees whose risk class conflicts with a declared **threat model** / **deployment context**. Warnings never block loading. This is informed consent.

> **Principle: errors are for contradictions, not for insufficient rigor.**

### §2.4 The Irreducible Floor (the only non-optional part)

To be a *reasoner at all*, a point needs exactly three things. These are definitional, not "rigor":

| Floor | Requirement |
|---|---|
| **F1** | A non-empty **substrate Σ** (something to reason over). |
| **F2** | A **control κ** (some rule for choosing what happens next). |
| **F3** | A declared **semantics of state change** (deterministic or explicitly stochastic). |

Everything in §2.1 is above this floor and therefore optional. `Ω₀ = F1 + F2 + F3`, nothing else.

### §2.5 Guarantee Conservation & the Trilemma

Two laws survive from the sources, restated as economics rather than edicts:

- **Conservation.** You cannot create guarantees for free, and you cannot remove them for free either. Every waiver buys performance and pays in a named risk class. Every activation buys safety and pays in runtime cost. **The ledger of guarantees always balances.**
- **Trilemma.** *Soundness of admitted steps · Completeness of ampliative closure · Bounded operation* — pick at most two freely. The space hosts all three corners: verifier+bounded (SeNARS₀), soundness+completeness-attempt (Lean, waiving G12), completeness+bounded (heuristic search, waiving strict soundness).

---

## §3 · Coordinate Σ — Substrate

What the reasoner reasons over. Multi-substrate by construction; substrates are **arbitrated islands** (exchange proposals through a boundary) or, when isolation is waived, **fused**.

```ts
interface SubstrateSpec {
  language:     'flat-atoms' | 'narsese' | 'metta' | 'propositional'
              | 'dependent-types' | 'embedding' | 'custom';
  truthAlgebra: 'boolean' | 'probabilistic' | 'nal-(f,c)' | 'nal-(f,c)×(d,c)'
              | 'dempster-shafer' | 'fuzzy' | 'paraconsistent-graded' | 'none';
  revision:     'evidence-based' | 'progress-based' | 'none';
  rules:        RuleSet;                 // loaded data, versioned, revertible
  storage:      'flat' | 'bag' | 'graph' | 'tensor' | 'cellular' | 'reversible';
  proposers:    ProposerKind[];          // nAL | reflex | lm | peer | metta | self
  isolation:    'arbited' | 'fused';     // G8 lives here
}
```

| Substrate slot | Carrier | Rigor note |
|---|---|---|
| Symbolic-uncertain (NAL) | terms graded by `(f,c)`/`(d,c)` | default uncertain core |
| Exact/formal (MeTTa, e-graphs) | dependent types, equality saturation | isolated unless **G8** waived |
| Probabilistic | distributions / factors | emits proposals |
| Neural/subsymbolic | embeddings, learned heads | untrusted proposer; judged unless **G2** waived |
| Heuristic/reflex | tabular/policy values | fast arcs |

**Attitude taxonomy** (all content kinds across all flavors): `Belief · Goal · Question · Hypothesis · Assumption · Plan · Obligation · Permission · ActionIntent · Lesson`, each graded on an axis (`epistemic · teleological · normative · procedural · provisional`). The **epistemic firewall (G1)** is the statement that `teleological` writes cannot construct an `epistemic` truth commit — enforced when G1 is active, absent when waived.

---

## §4 · Coordinate κ — Control

Control flow is **data**, not a hard-coded loop. The same representation hosts every control model.

```ts
interface ControlSpec {
  word:       'linear' | 'kat' | 'conditional-dag' | 'claim-queue'
            | 'event-driven' | 'learned';
  nesting:    number;                    // 0 = flat, 3 = SeNARS₀ macro→micro→inference
  heterochrony?: HeterochronousLevel[];  // multi-rate tower L0 reflex … L4 identity
  scheduler:  'fixed' | 'priority' | 'claim-queue' | 'pid' | 'utility'
            | 'free-energy' | 'boltzmann' | 'learned';
  inspectable: boolean;                  // G7: control decisions emitted as events
}
```

**KAT control-word algebra** (three interchangeable forms: KAT expression ⇄ conditional DAG ⇄ claim queue):

```
κ ::= stage | κ·κ | κ+κ | κ* | p?·κ | κ‖κ | 1
      seq    choice iter  guard  parallel skip
```

**Named control words** — each flavor is just a different κ:

| Model | κ |
|---|---|
| SeNARS₀ micro | `perceive · attend · reason · authorize · propose · learn` |
| SeNARS₀ macro | `perceive · recall · reason · narrate · consolidate · act · record · announce` |
| Cybernetic servo | `sense · estimate · evaluate · decide · reserve · execute · verify · commit · settle · record · meta` |
| Minimal deductive | `(infer · commit)*` |
| Reflex arc | `perceive · (danger? · act_veto + 1) · propose_fast` |

**Heterochronous tower** (optional): `L0 reflex · L1 micro-tick · L2 deliberation · L3 consolidation · L4 identity` — one κ interpreter, N clocks, coordination only through Κ/Π and correlation IDs. Higher configures lower; lower may interrupt higher.

**Scheduler inspectability (G7)**: when active, every scheduling decision is an event; learned/market schedulers are permitted *because* they are logged. When waived, the scheduler may be opaque (fastest).

---

## §5 · Coordinate α — Admission & Governance

What crosses boundaries. Collapses all "gates" into one admission functional instantiated per boundary.

```ts
interface AdmissionSpec {
  gates:       GateKind[];               // perception | action | reward | budget | ∅
  orientation: Record<Boundary, 'interior' | 'closure'>;   // fail-closed | fail-open
  trust:       'none' | 'binary' | 'source-table' | 'continuous-field';
  risk:        'none' | 'classified' | 'manifold';         // trust × risk × reversibility
  autonomy:    'none' | AutonomyRung;    // observe → propose → sandbox → auto → production
  firewall:    'structural' | 'none';    // G1
  failure:     FailurePolicy;            // per-transaction: fail-closed/open/degrade/retry/abstain
}
```

**The admission functional** — one function, four named call sites:

```
A_θ : Candidate × Context → admit | provisional | defer | reject | escalate
```

**Orientation asymmetry**: `interior` (fail-closed, contractive) for ingress; `closure` (fail-open, extensive) for egress. SeNARS₀ = `(ingress: interior, egress: closure)`. Configurable per deployment; `∅` gates when waived.

**Trust-risk-reversibility routing** (when `α.risk = manifold`):

| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| High | Low | High | auto-commit |
| High | Med | High | shadow-commit → promote |
| Med | Low | High | provisional + decay |
| Med | Med | Med | human review |
| Any | High | Low | strong proof **or** human approval |
| Low | High | Low | reject |

**Autonomy ladder** (generalized from actions to all mutations): `observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production`.

---

## §6 · Coordinate β — Economy

Resources: from nothing (unbounded) to quotas to reservations to markets.

```ts
interface EconomySpec {
  mode:       'unbounded' | 'quota' | 'reservation' | 'utility' | 'boltzmann' | 'market';
  dimensions: CostDimension[];   // cycles derivations premises memoryOps llmCalls
                                 // tokens latency attention risk humanAttention
  scopes:     BudgetScope[];     // lattice with parent/transfer
  pricing:    'none' | 'priority' | 'marginal-utility' | 'boltzmann';
  degradation: PressureLadder;   // explore → prioritize → conserve → degrade
}
```

- **Unbounded** (`G12` waived): no limits — theorem provers, offline analysis.
- **Quota**: fixed ceilings per scope (current SeNARS).
- **Reservation** (`G6` active): `reserve(bid) → token` before execution; `settle(token, actual)` after. Denied reservation → typed `budget.exhausted` event, never silent drop.
- **Utility pricing**: `score(op) = (ΔK + ΔG + ΔH) / (λ_c·C + λ_r·R + λ_h·H_human)`.
- **Thermodynamic** (optional coordinate): `P(pursue) ∝ exp(−ΔE/T)`; cognitive temperature `T` interpolates exploration ↔ exploitation. Total budget fixed — heat redistributes, never creates.

**Graceful degradation under pressure** (when budgeted): low → explore; medium → prioritize goals/proofs; high → conserve, degrade to symbolic, request help.

---

## §7 · Coordinate Κ — Commit & Mutation  *(transactions are optional)*

How state becomes true. This is where the **transaction model is made optional.**

```ts
interface CommitSpec {
  mode:      'raw' | 'port' | 'transactional';
  authority: 'distributed' | 'single';        // G3
  pipeline:  PipelineStage[];                  // only when transactional
}
```

| Κ.mode | What it is | Guarantees | Hosts |
|---|---|---|---|
| **`raw`** | Plain function calls mutate state directly. No transaction envelope, no pipeline. | None beyond floor | Prolog, Datalog, CLIPS, bare reflex |
| **`port`** | All writes route through one port, but no per-op envelope. | G3 (single write authority) | lightweight audited systems |
| **`transactional`** | Every cognitive act is a `CognitiveTransaction` traversing the full pipeline. | G3 + G2 + G1 + G10 | SeNARS₀, AEGIS, Universal |

**The CognitiveTransaction** (only exists when `Κ.mode = transactional`):

```ts
interface CognitiveTransaction {
  id, correlationId;  kind: TransactionKind;  axis: CognitiveAxis;
  inputs, outputs, effects;
  budget?: BudgetReservation;          // absent if β unbounded
  proposer: ProposerProfile;  trust: TrustProfile;  risk: RiskProfile;
  reversibility: ReversibilityClass;
  proofObligations: ProofObligation[];
  fallback: FailurePolicy;
}
```

`TransactionKind` (closed): `perception · inference · proposal · judgment · commit · action · learning · forgetting · consolidation · simulation · self-modification · meta-control`.

**Commit pipeline** (stages are individually droppable for speed):
```
Normalize → AxisCheck(G1) → EvidenceIndependence → Prove/Judge/Simulate(G2)
          → Rank → BudgetSettle(G6) → RiskClassify(G10) → Commit
```

Decision outcomes: `commit · provisional · shadow · defer · reject · clarify`.

> **Performance escape hatch:** at `Κ.mode = raw` the pipeline is absent entirely. A `FAST` reasoner can run with no transaction overhead. You pay for governance only where you enable it.

---

## §8 · Coordinate Π — Provenance  *(append-only logs are optional)*

What is remembered. This is where the **event log is made optional.**

```ts
interface ProvenanceSpec {
  depth:       0 | 1 | 2 | 3 | 4 | 5;
  correlation: boolean;               // thread correlationId stimulus → action
  verifier:    'none' | 'engine-shared' | 'standalone-transcribed';  // G5
  replay:      'none' | 'deterministic' | 'hash-verified';
}
```

| Depth | Recorded | Guarantees | Cost |
|---|---|---|---|
| **0** | Nothing (ephemeral) | — | none |
| **1** | Final answers | — | minimal |
| **2** | Derivation conclusions | — | low |
| **3** | Step-level traces | G4 partial | medium |
| **4** | Full event log + verifier + hash replay | G4 + G5 | high |
| **5** | Level 4 + control-plane events (scheduler, budget, graph edits) | G4 + G5 + G7 | highest |

- **Depth 0**: state is mutable and in-place. No log, no fold, no replay. **This is legal.** Embedded, real-time, throwaway inference.
- **Depth ≥ 3**: state = `fold(log)`; `replay ∘ log ≅ id`.
- **Verifier independence (G5)**: at `standalone-transcribed`, the verifier imports no engine code; truth tables are transcribed; drift is pinned by test. At `engine-shared` it is cheaper but co-adapted. At `none`, absent.
- **Tiered audit**: depth is a coordinate, not a code fork. Full proof for high-risk commits; sampled lineage for routine.

---

## §9 · Coordinate ρ — Reflexivity

Can the system change its rules for changing? A strict filtration; each level governs the one below; **no level approves itself** (when G11 active).

```ts
interface ReflexivitySpec {
  level:     'F0' | 'F1' | 'F2' | 'F3' | 'F4' | 'F5' | 'F6';
  governance: 'none' | 'shadow' | 'shadow-ci' | 'external-arbiter';
  metaController?: ControllerPortfolio;   // its decisions are governed transactions
}
```

| Level | Mutates | Authority (when governed) |
|---|---|---|
| **F0** | Frozen | — |
| **F1** | Knobs / parameters | auto if low-risk |
| **F2** | Strategy selection | proposal or auto |
| **F3** | Rules / schema induction | proof + shadow |
| **F4** | Topology / κ / budget lattice | meta-controller + governance, cycle-boundary hot-swap |
| **F5** | Code / config patches | shadow CI + external arbiter |
| **F6** | Constitution Φ itself | **never self-modifiable** — external/authority only |

**Meta-controller as governed proposer**: the scheduler is itself a transaction of kind `meta-control` — it perceives through the same ports, proposes κ-edits through the same ledger, is judged by the same manifold, budgeted by its own scope. It **proposes, never applies**.

**Controller portfolio** (swappable, blendable): `Deliberative · Reactive · Curious · Conservative · Creative · Social · Repair · Consolidating`.

**Transcendence clause**: `ReasonerSpec` is itself a first-class cognitive object. At F4+ the system may propose new configurations of itself (new flavors), shadow-evaluated before governance decides. **Φ is never editable below F6.**

---

## §10 · The Evaluator & Composition

### §10.1 The evaluator

```
validate : ReasonerSpec → { loadable, hardErrors, warnings }   // §2.3
evaluate : ReasonerSpec → Reasoner                             // ⟦·⟧
```

The evaluator builds a runnable reasoner from the coordinates. If `Φ` reports a contradiction, `evaluate` is undefined (rejected at load). If `Φ` reports only waivers, `evaluate` proceeds — waivers are legal.

**Evaluator guarantees scale with activation:** single commit authority iff `Κ.authority = single`; event-sourcing iff `Π.depth ≥ 3`; constitutional closure always (no contradictory spec runs).

### §10.2 Composition laws

Configurations compose equationally. With semantic function `⟦·⟧ : Spec → Behavior`:

| Operation | Symbol | Semantics |
|---|---|---|
| Sequential | `c₁ ⊗ c₂` | run c₁ then c₂ |
| Parallel | `c₁ ⊕ c₂` | concurrent, join at commit |
| Restriction | `c \| P` | project onto capability subset (degradation as algebra) |
| Refinement | `c₁ ⊑ c₂` | c₁'s behaviors ⊆ c₂'s behaviors |
| Lifting | `lift(c, F)` | apply functor F to every component |
| Nesting | `nest(c, n)` | wrap in n loop levels |
| Abstraction | `α(c)` | behavioral equivalence class (quotient) |

**Compositionality axiom** (property-tested): `⟦c₁ ⊗ c₂⟧ = ⟦c₁⟧ ∘ ⟦c₂⟧`. Two specs producing identical behavior on all stimuli are the **same reasoner** — the quotient eliminates redundancy among flavors.

**Conservative extension**: `Ω₀ ⊑ Ω₁ ⊑ Ω₂ ⊑ Ω₃ ⊑ Ω₄` — each tier adds coordinates, never moves the floor.

---

## §11 · The Flavor Catalog — All Control Models as Points

Every flavor is a `ReasonerSpec` constant. New flavors are new coordinates — **zero framework changes**.

### §11.1 Classical & external systems (hosted by waiving)

| System | Σ | κ | β | α | Κ | Π | ρ | Waived |
|---|---|---|---|---|---|---|---|---|
| Classical ATP | symbolic | fixed search | unbounded | proof-trace | raw | 2 | F0 | G6, G12 partial |
| Prolog / Datalog | symbolic | DFS | depth-bound | none | raw | 0 | F0 | G2–G11 |
| Lean / Coq | dependent types | tactic/human | unbounded | kernel-gated | port | 4 | F0 | **G12** (boundedness) |
| Bayesian reasoner | probabilistic | fixed graph | step-bound | none | port | 2 | parametric | G1 (single algebra) |
| CLIPS | symbolic | conflict-resolution | bounded | none | **distributed** | 1 | procedural | **G3** |
| SOAR / ACT-R | symbolic | impasse/conflict | bounded | none | port | 1 | chunking | G2 |
| Original NARS | symbolic-NAL | priority bag | AIKR | none | port | 2 | confidence | G2, G4, G11 |
| Pure LLM (ReAct) | subsymbolic | LM loop | unbounded | none | raw | 1 | in-context | **G1, G2** |
| RL (AlphaZero) | subsymbolic | MCTS | bounded | none | port | 2 | external-RL | **G1** (belief/goal conflated) |

### §11.2 The synth family (full enrichment)

| Flavor | Distinguishing coordinates | Typical rigor |
|---|---|---|
| **SeNARS₀** | κ=linear 6-stage depth-3; α=(C,O); β=quota; Σ=NAL | R3–R4 (anchor) |
| **Ambitious** | κ=conditional DAG + heterochronous tower; β=market; ρ=F0–F5 | R5 |
| **AEGIS / Flexible** | κ=declarative DAG + portfolio; β=reservation+utility; α=manifold | R3–R4 |
| **Universal / Ω** | all coordinates at full enrichment; KAT + claim queue; multi-sorted truth | R5 |
| **Meta** | ρ=F5 + self-applicative κ; meta-meta-control; transcendence active | R5 |
| **Bio (ACS/AUTON/CYTOS)** | Σ.storage=cellular; β=metabolic; κ=reaction network; division/apoptosis | R2–R3 |
| **Math / NOUS** | Σ=dependent types; proof-term verification; coalgebraic fixpoints | R4 |
| **Thermodynamic (Θ/HELMHOLTZ)** | β.pricing=boltzmann(T); κ=free-energy minimization; entropy accounting | R3 |
| **Category** | ports as morphisms; composition as pullback; topos logic | R4 |
| **Topological / ATLAS** | sheaf semantics; persistent-homology budgets; stratified governance | R3–R4 |
| **Cybernetic / AEGIS-servo** | κ=PID/servo loops; β=control costs; α=servo feedback; requisite variety | R2–R3 |

### §11.3 Cellular & ecological deployment

Bio is a **deployment topology** over the same cell (= one Ω₀ + one genome κ + membranes):
```
Cell = { membrane: Gate[5]; metabolism: Economy; genome: KappaRegistry;
         cytosol: MemoryPorts; nucleus: Governor; lineage: EventLog }
```
Single-cell kernel runs the full spec; tissues/ecology are multi-cell profiles. **Multi-agent/ecology is gated behind single-agent stability** (an optional capability layer, not core): peer delegation, collective calibration, provenance fusion, capability tokens.

---

## §12 · Presets Across the Rigor Spectrum

Named bundles for common deployments. **Each is a legal point; each satisfies the floor; each declares its waivers.**

| Preset | Rigor | Σ | κ | β | α | Κ | Π | ρ | Character |
|---|---|---|---|---|---|---|---|---|---|
| **BARE** | R0 | flat-atoms | linear | unbounded | ∅ | raw | 0 | F0 | Fastest; no guarantees |
| **EMBEDDED** | R0–R1 | NAL-deduction | reflex loop | quota | fail-open | raw | 0–1 | F0 | IoT/real-time, ms latency |
| **FAST** | R1 | NAL | reactive | latency-first | minimal | port | 1 | F1 | Low rigor, high throughput |
| **ARCADE** | R1–R2 | NAL | game-tick | bounded | reflex-veto | port | 1 | F1 | Game AI |
| **CONVERSATION** | R2–R3 | NAL + LM proposers | full cycle | quota | 4 gates + manifold | transactional | 3 | F2 | Default chat agent |
| **SeNARS₀** | R3–R4 | NAL + MeTTa + LM | dual-loop | quota | 4 gates + manifold | transactional | 4 | F2 | **Regression anchor** |
| **RESEARCH** | R4–R5 | Hybrid + peers | DAG + heterochronous | utility + thermo | manifold + trust-field | transactional | 5 | F4 | Full enrichment |
| **THEOREM** | R4 | dependent types | deliberative | unbounded | proof-gated | transactional | 4 | F3 | Waives G12 |
| **DEEP_AUDIT** | R5 | NAL + verifier | deliberative | conservative | full + human | transactional | 5 | F3 | Maximum observability |

**Feature toggles** (move within the valid region, never break coherence): `enableRL · enableSelfImprovement · enablePersistence · enableSystemOne · enableMetta · enablePeerDelegation · enableThermodynamic · enableHeterochronous`.

---

## §13 · Efficiency Doctrine

Abstraction must cost nothing on the hot path. Enforced by construction, not aspiration.

1. **Compiled control.** κ compiles to a flat dispatch table of stage pointers + guard predicates. Stage dispatch performs no allocation; traversal is pointer-chasing with inline integer budget checks.
2. **Integer economy.** Budget checks are fixed-width integer arithmetic on `CostVector`; reservation is one subtraction, settlement one addition. No float, no allocation in the grant path.
3. **Pay for nothing.** Conservative extension means unused layers are absent branches, not dormant code. `Κ.mode = raw` carries zero transaction overhead; `Π.depth = 0` carries zero logging overhead. **Ω₀ is a handful of files.**
4. **O(1) commit fast path.** When transactional, ledger append is a schema-validated write-ahead; the fold is lazy and checkpointed — readers never scan the log on the hot path.
5. **Devirtualization.** Ports with a single configured implementation resolve statically; the seam costs zero at runtime while keeping the alternative-substrate boundary.

**Bench ceilings (CI gates):** cycle throughput ≥ current SeNARS · ledger commit ≤ 1 ms · stage dispatch ≤ 50 µs · memory overhead ≤ 10% · meta-controller selection ≤ 5 ms. `BARE` must exceed all of these.

---

## §14 · Conformance & Instantiation Tiers

### §14.1 Tiers (conservative extension chain)

| Tier | Adds | Independently deployable as |
|---|---|---|
| **Ω₀ Kernel** | floor + one gate + budget monoid + (optional) fold | embedded / edge / minimal |
| **Ω₁ Reasoner** | inference substrate, truth algebra, revision, linear κ | symbolic reasoning core |
| **Ω₂ Agent** | admission lattice, trust, pricing, risk manifold, conditional κ | chat agent, tool user |
| **Ω₃ Cognitive** | heterochronous tower, drives, meta-controller, ρ active | autonomous self-improving agent |
| **Ω₄ Ecological** | peer delegation, collective calibration, provenance fusion | multi-agent ecosystems |

Each tier satisfies the floor and its own active guarantees. Unused higher tiers cost nothing.

### §14.2 Conformance

A build claims this spec iff:
- The **floor** (F1–F3) holds.
- Every **active** guarantee in `Φ.active` is enforced by at least one mechanism (type, load-time, runtime, or CI).
- Every **waived** guarantee in `Φ.waived` carries a `rationale` and `riskClass`.
- `validate(spec)` returns `loadable` with no `hardErrors`.
- When `Π.depth ≥ 3`: `replay(log) ≅ state`.
- When `Κ.authority = single`: there is exactly one writer.

**No build is required to activate any particular guarantee.** Conformance is about *coherence of the chosen point*, not about reaching a rigor threshold.

---

## Appendix A · SeNARS₀ Coordinate Sheet (Regression Anchor)

`SeNARS₀` is the fixed point against which all abstraction drift is measured. `evaluate(SeNARS₀)` must be behaviorally identical to the current production runtime (verified by E2E gates + event-log equivalence modulo minted IDs).

```
SeNARS₀ : ReasonerSpec = {
  Σ: { language: narsese, truthAlgebra: nal-(f,c)×(d,c), revision: evidence-based,
       storage: bag, proposers: [nal, metta, lm, reflex], isolation: arbited }
  κ: { word: linear, nesting: 3, scheduler: priority, inspectable: true,
       micro: "perceive·attend·reason·authorize·propose·learn",
       macro: "perceive·recall·reason·narrate·consolidate·act·record·announce" }
  β: { mode: quota, dimensions: [cycles,derivations,premises,memoryOps,llmCalls],
       scopes: mixed(lifetime + per-cycle) }
  α: { gates: [perception,action,reward,budget],
       orientation: { ingress: interior, egress: closure },
       trust: source-table × manifold, risk: manifold, autonomy: 5-rung,
       firewall: structural }
  Κ: { mode: transactional, authority: single, pipeline: full }
  Π: { depth: 4, correlation: true, verifier: standalone-transcribed,
       replay: hash-verified }
  ρ: { level: F2, governance: shadow-ci, metaController: adaptive-inner-fixed-outer }
  Φ: { active: [G1,G2,G3,G4,G5,G6,G7,G8,G9,G10,G11,G12], waived: [] }
}
```

SeNARS₀ activates **all twelve guarantees** — it is the maximally-governed anchor. The migration target is simply: *run this exact point on the universal evaluator*, then unlock every other point in the space by changing coordinates.

## Appendix B · What Was Unified

| Source | Contribution carried forward |
|---|---|
| `spec.2` | 12-tuple → folded into 8 coordinates; planes; invariants → guarantee catalog; flavor coverage table |
| `spec.1` | Ω₀ kernel; κ control words; guarantee conservation; substrate islands; thermodynamic policy; 27/27 synth coverage |
| `plan1234.1` | The "Big Three" shifts (control-as-data, single ledger, economy) — now each a **coordinate with an off-switch** |
| `plan1234.2` | Six coordinates; five effects; efficiency doctrine; parity semantics; collapse map |
| `plan1234.3` | 8 sorts; evaluator ⟦·⟧; flavor registry; tiered instantiation; composition laws |

**The single idea that unifies them and satisfies your directive:** *the machinery all four plans agreed on is real — but it is a menu, not a mandate.* Transactions, append-only logs, gates, firewalls, verifiers, and governed self-modification are each a coordinate you dial. Crank everything up for SeNARS₀-class safety; dial down to `raw / depth-0 / unbounded` for bare-metal speed. The algebra is the object; rigor is a setting; every reasoner is a projection.
