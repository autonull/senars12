# AUTON: A Cellular, Autopoietic Cognitive Architecture

## Complete Self-Contained Specification

---

## Part I — Design Charter

### §1.1 Vision

AUTON is a **cellular, autopoietic cognitive architecture**: a living system of bounded, governed, event-sourced reasoning cells that compose into tissues and organisms, grow through governed division, specialize through differentiation, maintain themselves through self-production, and evolve under hard epistemic and resource constraints.

The architecture is not a pipeline, not a monolith, not a fixed topology. It is a **morphogenetic field** — a space of possible cognitive organisms whose actual form emerges from the interaction of cellular composition laws, resource economics, epistemic firewalls, and governed adaptation.

### §1.2 Selected Prime Objectives

| ID | Objective | Role in AUTON |
|---|---|---|
| O1 | Maximum epistemic integrity | Belief/goal firewall, paraconsistency, evidence independence, calibrated admission |
| O2 | Auditable causal provenance | Every operation carries correlation IDs; full causal DAG reconstruction |
| O3 | Control-plane fluidity | Declarative stage graphs, KAT control words, cognitive DAGs — control is data |
| O4 | Resource economics | Reservations, prices, thermodynamic allocation, market clearing |
| O6 | Governed reflexivity | All adaptation passes through proposal → shadow validation → governance |
| O7 | Neuro-symbolic synergy | Neural proposes; symbolic judges, calibrates, vetoes, commits |
| O8 | Unified commit ledger | All state mutation uses one governed transaction/commit path |

### §1.3 Hard Constraints (Non-Negotiable)

| ID | Constraint |
|---|---|
| H1 | No reward signal may directly alter belief truth values |
| H2 | No untrusted proposal may enter cell memory without judgment or explicit provisional typing |
| H3 | No state mutation may occur without an event-log entry |
| H4 | No self-modification may be self-approved without external or governed arbitration |
| H5 | No reasoning path may be unbounded in memory, time, derivations, or model calls |
| H6 | No scheduler decision may be completely opaque; control choices must be inspectable |
| H7 | No verifier may share unsafe engine dependencies when checking derivations |
| H8 | No exact symbolic substrate may union nodes based solely on uncertain similarity |
| H9 | No failure may be silently swallowed where it affects cognition, budget, or admission |
| H10 | No irreversible action may bypass risk classification and authorization |

### §1.4 Anti-Goals

| ID | Anti-Goal |
|---|---|
| AG1 | No scheduler opacity: learned/market schedulers must remain auditable |
| AG2 | No monolithic model authority: no single substrate becomes the implicit core controller |
| AG3 | No unbounded cognitive richness: drives, imagination, consolidation require budgets and governance |
| AG4 | No abstraction before implementation: every formal structure must have a runnable kernel path |

### §1.5 Architectural Character Bias

AUTON resolves the D1–D6 tension as follows:

> **D3 (Unification) > D1 (Auditability) > D4 (Robustness) > D5 (Modularity) > D6 (Adaptivity) > D2 (Power)**

Unification is primary: one cell model, one transaction model, one commit surface, one governance vocabulary, one resource model. Auditability is the price of admission. Robustness is non-negotiable. Modularity enables evolution. Adaptivity is governed. Raw power is the last priority, constrained by everything above.

---

## Part II — Formal Ontology

### §2.1 The Seven Sorts

Every cognitive entity in AUTON is drawn from a typed algebra of seven sorts:

$$\mathcal{A} = \langle\, \mathcal{C},\; \mathcal{M},\; \mathcal{E},\; \mathcal{B},\; \mathcal{G},\; \mathcal{V},\; \mathcal{P}\,\rangle$$

| Sort | Name | Algebraic Structure | Governs |
|---|---|---|---|
| $\mathcal{C}$ | Cell | Bounded coalgebra with membrane | The fundamental unit of cognition |
| $\mathcal{M}$ | Membrane | Oriented gate lattice (interior/closure operators) | Trust boundary, admission, egress |
| $\mathcal{E}$ | Economy | Ordered commutative monoid with market extension | Resource accounting, reservation, pricing |
| $\mathcal{B}$ | Body | State comonad with decay and sampling | Persistent cognitive content (memory) |
| $\mathcal{G}$ | Genome | Typed invariant specification with governance ladder | Constitution, invariants, self-modification authority |
| $\mathcal{V}$ | Valuation | Evidence algebra with epistemic/teleological factorization | Truth, desire, priority, confidence |
| $\mathcal{P}$ | Provenance | Free event monoid with causal fold | Audit trail, replay, verification |

The design space is the fiber product:

$$\mathfrak{D}_{\text{AUTON}} = \mathcal{C} \times_{\mathcal{M}} \mathcal{E} \times_{\mathcal{E}} \mathcal{B} \times_{\mathcal{B}} \mathcal{G} \times_{\mathcal{G}} \mathcal{V} \times_{\mathcal{V}} \mathcal{P}$$

Compatibility is not optional. The fiber product enforces that membrane decisions are budgeted, budget charges are logged, body mutations are gated, governance constraints are typed, truth values are storable, and every operation is event-sourced.

### §2.2 The Composition Operad

Cells compose via five operations forming an operad $\circ$:

| Operation | Symbol | Meaning |
|---|---|---|
| Sequential | $c_1 \triangleright c_2$ | Execute $c_1$ then $c_2$ |
| Conditional | $c_1 \triangleleft_g c_2$ | Execute $c_1$ or $c_2$ based on guard $g$ |
| Parallel | $c_1 \parallel c_2$ | Execute concurrently, join at synchronization barrier |
| Nesting | $c_1 \hookrightarrow c_2$ | $c_2$ runs inside $c_1$'s budget and trust scope |
| Iteration | $c^n$ or $c^*$ | Bounded or fixpoint iteration |

These operations are **data**, not code. A cognitive program is a term in this operad, loaded, versioned, and revertable like a rule table.

### §2.3 The Cell Type System

Every cell is typed along three orthogonal axes:

$$\text{CellType} = \langle\, \text{EpistemicAxis},\; \text{TemporalGrain},\; \text{AuthorityLevel}\,\rangle$$

| Axis | Values |
|---|---|
| EpistemicAxis | `epistemic` (belief-producing) · `teleological` (goal-producing) · `procedural` (action-producing) · `metacognitive` (control-producing) |
| TemporalGrain | `reflex` (sub-cycle) · `tick` (single cycle) · `deliberative` (multi-cycle) · `consolidative` (slow) · `constitutional` (very slow) |
| AuthorityLevel | `observe` · `propose` · `sandbox` · `auto-commit` · `governed-merge` |

The type system enforces:

$$\text{EpistemicAxis} = \text{epistemic} \implies \text{Reward} \nrightarrow \text{Truth}$$
$$\text{EpistemicAxis} = \text{teleological} \implies \text{Desire} \nrightarrow \text{Fact}$$
$$\text{AuthorityLevel} \leq \text{auto-commit} \implies \text{Reversibility} = \text{high}$$

---

## Part III — The Cognitive Cell

### §3.1 Cell Structure

A cell $\chi$ is a bounded coalgebra:

$$\chi = \langle\, \mathcal{M}_\chi,\; \mathcal{B}_\chi,\; \mathcal{E}_\chi,\; \kappa_\chi,\; \mathcal{P}_\chi,\; \mathcal{G}_\chi\,\rangle$$

| Component | Role |
|---|---|
| $\mathcal{M}_\chi$ | **Membrane**: the gate lattice controlling admission and egress |
| $\mathcal{B}_\chi$ | **Body**: bounded priority bags, concept graphs, episodic/semantic stores |
| $\mathcal{E}_\chi$ | **Economy**: local budget slice, reservation ledger, cost accounting |
| $\kappa_\chi$ | **Control word**: a KAT expression defining the cell's internal stage sequence |
| $\mathcal{P}_\chi$ | **Provenance**: local event log, correlation ID, causal parent |
| $\mathcal{G}_\chi$ | **Genome**: invariants, type constraints, governance level, self-modification authority |

A cell is **bounded**: its body has finite capacity, its economy has finite budget, its control word has finite depth, and its provenance log is append-only with bounded retention.

### §3.2 The Membrane

The membrane $\mathcal{M}_\chi$ is an oriented gate lattice. Every gate $g$ is either:

- **Interior** (contractive, $g(x) \leq x$): fail-closed. Used at ingress. Untrusted content must pass judgment to enter.
- **Closure** (extensive, $x \leq g(x)$): fail-open. Used at egress. Derived content exits unless explicitly vetoed.

The membrane carries a **polarity field**:

$$\alpha(\mathcal{M}_\chi) : \text{Direction} \to \{\text{fail-closed},\; \text{fail-open},\; \text{calibrated}\}$$

| Direction | Default Polarity | Rationale |
|---|---|---|
| Ingress (external → cell) | fail-closed | Unjudged content must not enter |
| Egress (cell → external) | fail-open | Cognition must not halt on provider fault |
| Internal (cell → cell) | calibrated | Trust field determines admission threshold |
| Division (cell → daughter) | fail-closed | Daughter cells inherit genome, not unfiltered state |

Gates compose as a bounded lattice:

$$g_1 \wedge g_2 = \text{conjunction (both must admit)}$$
$$g_1 \vee g_2 = \text{disjunction (either admits)}$$
$$\top = \text{always admit (fail-open)}$$
$$\bot = \text{never admit (fail-closed)}$$

New gates are new lattice elements. The epistemic firewall is a **closed ideal** in the lattice: no composition of gates can produce a path from reward to truth.

### §3.3 The Control Word (KAT)

The internal control flow of a cell is a **Kleene Algebra with Tests** expression:

$$\kappa_\chi \in \text{KAT}(\text{Stages}, \text{Guards})$$

The KAT signature:

| Operation | Symbol | Meaning |
|---|---|---|
| Sequence | $\cdot$ | Execute left then right |
| Choice | $+$ | Execute left or right |
| Iteration | $^*$ | Repeat zero or more times (bounded) |
| Test | $p?$ | Guard: proceed only if predicate $p$ holds |
| Skip | $1$ | Identity (no-op) |
| Abort | $0$ | Immediate termination |

Example control words:

**Reflex cell** (fast, minimal):
$$\kappa_{\text{reflex}} = \text{perceive} \cdot \text{judge} \cdot (\text{safe}? \cdot \text{act} + \text{unsafe}? \cdot \text{veto})$$

**Deliberation cell** (rich, conditional):
$$\kappa_{\text{delib}} = \text{perceive} \cdot \text{attend} \cdot (\text{hasWork}? \cdot \text{reason} \cdot \text{authorize} + 1) \cdot (\text{hasProposer}? \cdot \text{propose} + 1) \cdot (\text{due}? \cdot \text{learn})^*$$

**Consolidation cell** (slow, periodic):
$$\kappa_{\text{consol}} = (\text{pressure}? \cdot \text{decay} \cdot \text{evict} \cdot \text{merge} \cdot \text{archive})^*$$

**Metacognitive cell** (self-observing):
$$\kappa_{\text{meta}} = \text{observe} \cdot \text{diagnose} \cdot (\text{adequate}? \cdot 1 + \text{inadequate}? \cdot \text{propose-reconfiguration})$$

The control word is **data**. It can be loaded, versioned, A/B tested, reverted, and governed. The metacognitive cell can propose new control words, but they pass through the governance pipeline before installation.

### §3.4 The Cell Body (Memory)

The body $\mathcal{B}_\chi$ is a state comonad with decay:

$$\mathcal{B}_\chi = (\text{Store},\; \text{Decay},\; \text{Capacity},\; \text{Sampling},\; \text{Persistence})$$

| Component | Specification |
|---|---|
| Store | Bounded priority bags $\text{Bag}\langle T \rangle$ with typed content (beliefs, goals, questions, hypotheses, plans) |
| Decay | Truth decay $\perp$ attention decay. Truth decays only on invalidation/contradiction. Priority decays by access/LRU. |
| Capacity | Finite. Pressure-driven consolidation when capacity exceeded. |
| Sampling | Probabilistic extraction by priority, weighted by attention model |
| Persistence | Event-sourced. The body is reconstructable from the provenance log. Snapshots are caches. |

The body supports **multiple memory tiers** as a lattice:

$$\text{Working} \;\leq\; \text{Episodic} \;\leq\; \text{Semantic} \;\leq\; \text{Procedural}$$

Each tier has its own decay rate, capacity, and sampling policy. Consolidation moves content up the lattice. Forgetting moves content down or removes it.

### §3.5 The Cell Economy

The economy $\mathcal{E}_\chi$ is an ordered commutative monoid with market extension:

$$\mathcal{E}_\chi = (\text{Budget},\; +,\; 0,\; \leq,\; \lceil\cdot\rceil,\; \text{Reserve},\; \text{Settle},\; \text{Price})$$

**Budget dimensions** (minimum set):

| Dimension | Unit | Reset |
|---|---|---|
| cycles | control steps | per-cycle |
| derivations | symbolic inference steps | per-cycle |
| memoryOps | reads/writes | per-cycle |
| modelCalls | neural/LM invocations | per-cycle |
| tokens | token consumption | per-cycle |
| latency | wall-clock time | per-cycle |
| risk | irreversibility quota | lifetime |
| humanAttention | approval/clarification cost | lifetime |

**Reservation protocol**:

Before executing any operation, the cell reserves resources:

$$B_{\text{available}} \leftarrow B_{\text{available}} - B_{\text{reserved}}$$

After execution:

$$B_{\text{settled}} = B_{\text{reserved}} - B_{\text{unused}}$$

Refunded resources return to the available pool. This prevents silent starvation and enables backpressure.

**Pricing**:

Operations are priced by marginal utility:

$$\text{score}(\text{op}) = \frac{\hat{\Delta}K + \hat{\Delta}G + \hat{\Delta}H}{\lambda_c \hat{C} + \lambda_r \hat{R} + \lambda_h \hat{H}_{\text{human}}}$$

where $\hat{\Delta}K$ is expected epistemic gain, $\hat{\Delta}G$ is goal progress, $\hat{\Delta}H$ is homeostatic balance, $\hat{C}$ is cost, $\hat{R}$ is risk, and $\hat{H}_{\text{human}}$ is human attention cost.

**Open-once law**: A budget scope may be reopened at most once per cycle. Resetting on every charge would make the scope inexhaustible.

### §3.6 The Cell Event Log (Provenance)

Every cell maintains an append-only event log:

$$\mathcal{P}_\chi : \text{Event}^* \quad \text{(free monoid under append)}$$

Every event carries:

```
interface CognitiveEvent {
  eventId: EventId;
  cellId: CellId;
  correlationId: CorrelationId;    // threads stimulus → cell → derivation → action
  parentId?: EventId;              // causal parent
  timestamp: LogicalClock;
  kind: EventKind;                 // perceive | attend | reason | admit | veto | budget | fault | ...
  payload: TypedPayload;
  budgetCharge?: BudgetCharge;
  trustAnnotation?: TrustAnnotation;
  proofObligation?: ProofObligation;
}
```

**Replay**: The cell body is reconstructable from the event log:

$$\text{replay}(\mathcal{P}_\chi) \cong \mathcal{B}_\chi \quad \text{on reachable states}$$

**Admit-before-write**: No state mutation occurs without a preceding gate event in the log. This is an algebraic invariant, not a convention.

**Correlation threading**: A single `CorrelationId` is minted at the stimulus and threaded through every cell, every stage, every budget charge, every gate decision, every derivation. The provenance becomes a **causal DAG**, not parallel shadows.

---

## Part IV — Cell Composition: Tissues, Organs, Organisms

### §4.1 Tissue Formation

A **tissue** is a cooperative ensemble of cells sharing a budget pool, a provenance scope, and a coordination protocol:

$$\text{Tissue} = \langle\, \{\chi_1, \ldots, \chi_n\},\; \mathcal{E}_{\text{shared}},\; \mathcal{P}_{\text{shared}},\; \text{Coordination}\,\rangle$$

Tissues form through three mechanisms:

1. **Division**: A cell divides into two daughter cells, sharing the parent's genome but with independent bodies and budgets.
2. **Recruitment**: A tissue recruits a new cell by issuing a `CellSpec` that is instantiated and admitted through the tissue's membrane.
3. **Fusion**: Two tissues merge their budget pools and provenance scopes under a unified coordination protocol.

### §4.2 Organ Formation

An **organ** is a higher-order structure composed of tissues with a shared governance framework:

$$\text{Organ} = \langle\, \{\text{Tissue}_1, \ldots, \text{Tissue}_m\},\; \mathcal{G}_{\text{organ}},\; \text{MetaController}\,\rangle$$

Organs have their own governance level, their own meta-controller, and their own budget allocation policy. The meta-controller is itself a cell (a metacognitive cell) that observes the organ's performance and proposes reconfigurations.

### §4.3 The Organism

An **organism** is the top-level composition:

$$\text{Organism} = \langle\, \{\text{Organ}_1, \ldots, \text{Organ}_k\},\; \mathcal{G}_{\text{constitution}},\; \mathcal{E}_{\text{global}},\; \mathcal{P}_{\text{global}}\,\rangle$$

The organism has a **constitution** — the highest-level governance framework that defines the invariants, the epistemic firewall, the autonomy ladder, and the self-modification authority. The constitution is the **DNA** of the organism.

### §4.4 Inter-Cell Signaling

Cells communicate through **typed signals**:

$$\text{Signal} = \langle\, \text{source},\; \text{target},\; \text{kind},\; \text{payload},\; \text{trust},\; \text{budget}\,\rangle$$

| Signal Kind | Meaning |
|---|---|
| `proposal` | A candidate for admission (untrusted until judged) |
| `event` | A factual occurrence (logged, correlated) |
| `budget-transfer` | A resource transfer between cells (governed) |
| `interrupt` | A reflex-level preemption (highest priority) |
| `consolidation-request` | A request to move content to a higher memory tier |
| `division-request` | A request to create a daughter cell |
| `apoptosis-signal` | A governed cell death signal |

All signals pass through the receiving cell's membrane. No signal bypasses the gate lattice.

### §4.5 The Heterochronous Tower

The organism organizes cells into a **heterochronous tower** of temporal grains:

```
Level 5 · Constitutional (≪ 1/cycle)
  Genome review · invariant audit · governance evolution

Level 4 · Identity (every K×100 cycles)
  Schema induction · capability scaffold · constitution refinement

Level 3 · Consolidation (every K×10 cycles)
  Decay · eviction · episodic merge · retrospection

Level 2 · Deliberation (per macro turn)
  Perceive → recall → reason → narrate → consolidate → act → record

Level 1 · Tick (per micro cycle)
  Perceive → attend → reason → authorize → propose → learn

Level 0 · Reflex arc (sub-cycle, interruptible)
  Fast judgment · safety veto · game tick · manifold fast-path
```

Lower levels can **interrupt** higher levels (reflex veto). Higher levels **configure** lower levels (constitutional constraints). Each level has its own clock, budget slice, and trust posture.

### §4.6 Cell Division Protocol

Cell division is the primary growth mechanism:

```
function divide(parent: Cell, spec: CellSpec): [Cell, Cell] {
  // 1. Validate spec against parent genome
  assert parent.genome.permits(spec);
  
  // 2. Allocate budget from parent's economy
  const childBudget = parent.economy.reserve(spec.budgetRequest);
  
  // 3. Create daughter cells
  const daughter1 = new Cell({
    genome: parent.genome.inherit(),       // genome is inherited, not copied
    membrane: parent.membrane.clone(),     // membrane is cloned
    body: parent.body.split(spec.partition), // body is partitioned
    economy: childBudget,
    controlWord: spec.controlWord,         // control word may differ
    provenance: parent.provenance.fork(),  // provenance forks
  });
  
  const daughter2 = new Cell({
    genome: parent.genome.inherit(),
    membrane: parent.membrane.clone(),
    body: parent.body.split(spec.complement),
    economy: parent.economy.remainder(),
    controlWord: parent.controlWord,       // original retains parent's word
    provenance: parent.provenance.fork(),
  });
  
  // 4. Log the division
  parent.provenance.append({
    kind: 'cell-division',
    parentId: parent.id,
    daughters: [daughter1.id, daughter2.id],
    spec: spec,
    budget: childBudget,
  });
  
  return [daughter1, daughter2];
}
```

**Invariants of division**:
- The genome is inherited, not mutated (mutations require governance).
- The membrane is cloned with the same polarity field.
- The body is partitioned; no content is duplicated without explicit provenance.
- The budget is conserved: parent's budget = daughter1's budget + daughter2's budget.
- The provenance forks: both daughters share the parent's causal history.

### §4.7 Cell Differentiation

Cells differentiate by specializing their control word, membrane, and body:

$$\text{differentiate}(\chi, \text{CellType}) \to \chi'$$

Differentiation is governed: the cell proposes a differentiation, the governance pipeline validates it, and the change is applied through the unified commit ledger.

**Differentiation paths**:

| From | To | Mechanism |
|---|---|---|
| Generic cell | Reflex cell | Simplify control word; increase interrupt priority; reduce budget |
| Generic cell | Deliberation cell | Enrich control word; add proposer/judge stages; increase budget |
| Generic cell | Consolidation cell | Add decay/eviction/merge stages; slow clock; reduce interrupt priority |
| Generic cell | Metacognitive cell | Add observe/diagnose/propose stages; grant read-only access to sibling cells |
| Generic cell | Governance cell | Add risk-classify/shadow-validate/approve stages; external governance authority |

### §4.8 Apoptosis (Governed Cell Death)

Cells die when:

1. Their budget is permanently exhausted and cannot be replenished.
2. Their governance level is violated and cannot be restored.
3. The organism's meta-controller determines they are no longer useful.
4. A corruption is detected that cannot be repaired.

Apoptosis is **governed**: the cell cannot kill itself. A governance cell issues the apoptosis signal, the cell's body is archived to the provenance log, and the cell's budget is returned to the organism's global pool.

```
function apoptosis(cell: Cell, reason: ApoptosisReason): void {
  // 1. Archive the cell's body to the provenance log
  cell.provenance.append({ kind: 'apoptosis', reason, body: cell.body.snapshot() });
  
  // 2. Return budget to the organism's global pool
  organism.economy.reclaim(cell.economy);
  
  // 3. Remove the cell from its tissue
  cell.tissue.remove(cell);
  
  // 4. Notify parent cells
  cell.provenance.causalParent?.notify({ kind: 'cell-death', cellId: cell.id, reason });
}
```

---

## Part V — The Unified Commit Ledger

### §5.1 Cognitive Transactions

Every unit of cognition is a **typed transaction**:

```
interface CognitiveTransaction {
  id: TransactionId;
  correlationId: CorrelationId;
  cellId: CellId;
  kind: TransactionKind;
  inputs: CognitiveObject[];
  outputs: Candidate[];
  effects: EffectDeclaration[];
  budget: BudgetReservation;
  capabilities: CapabilityToken[];
  trust: TrustProfile;
  risk: RiskProfile;
  reversibility: ReversibilityClass;
  fallback: FailurePolicy;
  proofObligations: ProofObligation[];
}
```

Transaction kinds:

| Kind | Meaning |
|---|---|
| `perception` | External stimulus enters a cell |
| `inference` | Symbolic derivation within a cell |
| `proposal` | Untrusted candidate for admission |
| `judgment` | Calibrated evaluation of a proposal |
| `commit` | State mutation through the ledger |
| `action` | External effect through a tool |
| `learning` | Parameter/strategy/rule change |
| `forgetting` | Governed content removal |
| `consolidation` | Memory tier promotion |
| `division` | Cell creation |
| `differentiation` | Cell type change |
| `apoptosis` | Cell death |
| `reconfiguration` | Control word change |
| `budget-transfer` | Resource movement between cells |

### §5.2 The Commit Path

All transactions pass through a single commit path:

```
Candidate
  → Normalize
  → Type-Check (epistemic axis, temporal grain, authority level)
  → Evidence-Independence Check (no double-counting)
  → Proof / Judge / Simulation (verification portfolio)
  → Rank (by utility, trust, risk)
  → Budget Settlement (reserve → settle → refund)
  → Risk Classification (reversibility, blast radius)
  → Commit or Reject
```

**The commit ledger is the single write path.** No state mutation occurs outside it. This is the topological invariant of the architecture.

### §5.3 The Epistemic Type System

The commit ledger enforces a full cognitive type system:

| Type | Value Structure | Mutation Authority |
|---|---|---|
| Belief | $(f, c)$ — frequency, confidence | Evidence only |
| Goal | $(d, c)$ — desire, confidence | Reward + evidence |
| Question | Priority + Expected Information Gain | Curiosity + relevance |
| Hypothesis | Plausibility + Evidence Requirement | Proposal + judgment |
| Assumption | Scope + Validity | Local reasoning context |
| Plan | Utility + Feasibility + Risk | Goal progress + simulation |
| Obligation | Priority + Deadline | Governance + commitment |
| Permission | Scope + Conditions | Governance + autonomy level |
| ActionIntent | Reversibility + Authorization | Risk classification + approval |
| Lesson | Source + Trust + Applicability | Learning + governance |

The type system enforces:

$$\text{Reward} \nrightarrow \text{BeliefTruth}$$
$$\text{GoalFailure} \nrightarrow \text{FalseBelief}$$
$$\text{Desire} \nrightarrow \text{Fact}$$
$$\text{PlanUtility} \neq \text{EpistemicTruth}$$

These are not policies. They are **type-level invariants** enforced by the commit ledger's type checker.

---

## Part VI — The Epistemic Core

### §6.1 Truth Algebra

The valuation algebra is a non-idempotent monoid:

$$\mathcal{V} = ([0,1] \times [0,1],\; \otimes_{\text{rev}},\; (0.5, 0))$$

where $(f, c)$ is frequency × confidence, and revision is:

$$\text{rev}((f_1, c_1), (f_2, c_2)) = \left(\frac{f_1 c_1 (1-c_2) + f_2 c_2 (1-c_1)}{c_1(1-c_2) + c_2(1-c_1)},\; c_1(1-c_2) + c_2(1-c_1)\right)$$

Properties:
- Revision is commutative but not associative.
- Confidence is sub-additive: $c_{\text{rev}} < c_1 + c_2$.
- Frequency is a weighted average pulled toward the more confident source.

### §6.2 The Epistemic/Teleological Firewall

The valuation algebra factors:

$$\mathcal{V} = \mathcal{V}_{\text{epistemic}} \times \mathcal{V}_{\text{teleological}}$$

| Aspect | Epistemic (Beliefs) | Teleological (Goals) |
|---|---|---|
| Value | $(f, c)$ | $(d, c)$ |
| Revision | Evidence-based | Progress-based |
| Mutation authority | Evidence only | Reward + evidence |
| Firewall | RewardGate blocks reward → $f$ | Reward may affect $d$ |

The firewall is a **closed ideal** in the gate lattice: no composition of gates can produce a path from reward to truth. This is enforced at the type level, the gate level, and the commit ledger level.

### §6.3 Paraconsistency

Contradictions are tolerated:

$$(A \to B) \;\text{and}\; \neg(A \to B) \;\text{coexist with distinct truth values}$$

The system does not explode. Contradictions are retained, graded, and available for query. Resolution is a governed process, not an automatic one.

### §6.4 Substrate Arbitration

Multiple substrates coexist under explicit arbitration:

| Substrate | Role | Trust Level |
|---|---|---|
| Symbolic (NAL) | Core inference, truth algebra, veto authority | Trusted kernel |
| Exact (rewrite/equality saturation) | Precise computation, formal verification | Trusted tool (gated) |
| Neural (LM, manifold heads) | Proposal generation, judgment calibration | Untrusted proposer |
| Probabilistic | Uncertainty quantification, calibration | Calibrated judge |
| Heuristic | Sampling, attention, priority | Governed strategy |

**Arbitration invariant**: Exact substrates never union nodes based on uncertain similarity. Neural substrates never directly mutate truth values. Symbolic substrates retain veto authority over all admissions.

The proposer/judge relationship is an **adjunction**:

$$\text{propose} \dashv \text{admit}$$

The Judgment Manifold is the (co)unit: it measures how much of a proposal survives judgment. Tightening the adjunction → pure symbolic. Loosening it → model-heavy. "How much to trust System 1" is a continuous parameter, not a wiring decision.

---

## Part VII — Resource Economy

### §7.1 The Economic Model

The resource economy is a **thermodynamic system** governed by the Free Energy Principle:

**Cognitive Energy** ($E$): Every task, belief, and derivation has an activation energy based on surprise (prediction error) and utility.

**Cognitive Temperature** ($T$): The organism has a global temperature parameter.
- High $T$ (high curiosity/drive) = broad, stochastic sampling (exploration)
- Low $T$ (high competence/coherence) = greedy, deep derivation (exploitation)

**Boltzmann Transition**: The probability of pursuing a derivation path is:

$$P \propto \exp(-\Delta E / T)$$

This replaces hard cutoffs with smooth, thermodynamically-grounded allocation.

### §7.2 Market-Based Allocation

Within the thermodynamic envelope, cells bid for resources:

```
interface BudgetMarket {
  cells: Map<CellId, BudgetBid>;
  auction: 'first-price' | 'second-price' | 'proportional';
  clearing: (bids: BudgetBid[]) => Allocation;
}
```

Each cell bids based on its expected marginal utility. The market clears at the start of each cycle. High-value derivations outbid low-priority observability. Exhaustion is replaced by outbidding.

**Conservation law**: Total budget is conserved across all cells. A cell cannot create resources. It can only bid for them, receive them, or return them.

### §7.3 Backpressure and Degradation

When resources are scarce, the organism degrades gracefully:

| Pressure Level | Response |
|---|---|
| Low | Explore, enrich, elaborate |
| Medium | Prioritize goals and proofs |
| High | Conserve, degrade to symbolic, reduce judgment depth |
| Critical | Fail-closed ingress, fail-open egress, halt non-essential cells |
| Terminal | Apoptosis of non-essential cells; preserve genome and provenance |

Degradation is **typed**: each degradation step is a governed transaction with a typed event in the provenance log.

---

## Part VIII — Provenance and Causal Observability

### §8.1 Event Sourcing

The provenance log is the **source of truth**. State is a fold over events:

$$\text{State}(t) = \text{fold}(\mathcal{P}, \text{init}, t)$$

Snapshots are caches. The event log is append-only, immutable, and independently verifiable.

### §8.2 Correlation Threading

Every event carries a `CorrelationId` that threads from stimulus to cell to derivation to action:

```
stimulus ──▶ organism ──▶ organ ──▶ tissue ──▶ cell ──▶ stage ──▶ derivation
   │              │          │          │         │         │           │
   └──────────────┴──────────┴──────────┴─────────┴─────────┴───────────┘
                              same CorrelationId
```

This makes the provenance a **causal DAG**, not parallel shadows. Any event can be traced back to its stimulus and forward to its consequences.

### §8.3 Replay and Verification

**Replay**: The organism's state is reconstructable from the event log:

$$\text{replayCognitiveState}(\mathcal{P}) \cong \text{State}$$

**Verification**: Derivations are independently verifiable by a standalone verifier that shares no code with the inference engine:

$$\text{verify}(\text{DerivationRecord}) \to \{\text{valid}, \text{invalid}\}$$

The verifier's truth table is transcribed, not imported. Drift between engine and verifier is measured, not assumed zero.

**Control replay**: Not just what was believed, but why the controller chose to reason that way:

$$\text{replayControlState}(\mathcal{P}) \to \text{ControlHistory}$$

Every scheduling decision, budget charge, gate decision, and graph edit is a `CognitiveEvent` in the log.

---

## Part IX — Governance and Evolution

### §9.1 The Autonomy Ladder

All actions and mutations are classified on a five-rung ladder:

| Rung | Authority | Example |
|---|---|---|
| 0 — Observe | Read-only | Query memory, inspect state |
| 1 — Propose | Generate candidate, no commit | LM rule proposal, schema induction |
| 2 — Sandbox | Execute in isolation | Tool call in sandbox, shadow execution |
| 3 — Auto-commit (low risk) | Commit without approval | Attention weight update, strategy switch |
| 4 — Governed merge (high risk) | External approval required | Code patch, governance change, reward function |

The rung is determined by a **risk/reversibility manifold**:

| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| High | Low | High | Auto-commit |
| High | Medium | High | Shadow-commit then promote |
| Medium | Low | High | Provisional commit with decay |
| Medium | Medium | Medium | Review |
| Low | High | Low | Reject |
| Any | High | Low | Strong proof or external approval required |

### §9.2 Governed Self-Modification

Self-modification follows a strict pipeline:

```
observation
  → lesson
  → hypothesis
  → strategy proposal
  → shadow test (isolated execution)
  → bounded deployment
  → trace evaluation
  → retention or rollback
```

**Invariants**:
- Learning may propose changes to cognition, but it may not directly rewrite the laws of epistemic commitment.
- The genome (constitution) is never a self-modification target.
- Code self-modification requires external governance (H4).
- Every self-modification is event-sourced, correlated, and replayable.

### §9.3 The Governance Genome

The genome $\mathcal{G}$ is the organism's constitution:

```
interface Genome {
  invariants: Invariant[];           // epistemic firewall, AIKR, single commit path
  typeConstraints: TypeConstraint[]; // belief/goal separation, authority levels
  autonomyLadder: AutonomyLadder;    // five-rung classification
  selfModAuthority: SelfModAuthority; // what may be modified, by whom, under what conditions
  governancePipeline: GovernancePipeline; // proposal → shadow → approval → merge
  externalGovernor: ExternalGovernor;  // immutable, external, cannot be edited by the organism
}
```

The genome is **inherited** during cell division. It is **never mutated** by the organism itself. Changes to the genome require external governance.

---

## Part X — Autopoiesis: Self-Production

### §10.1 The Autopoietic Closure

AUTON is autopoietic: it produces and maintains the components that constitute it.

| Component | Produced By | Maintained By |
|---|---|---|
| Cells | Cell division (governed) | Apoptosis, differentiation, budget allocation |
| Membranes | Membrane cloning during division | Gate lattice updates (governed) |
| Budgets | Market clearing, reservation, settlement | Conservation law, backpressure |
| Control words | Metacognitive cells (proposals) | Governance pipeline, hot-swap at cycle boundaries |
| Provenance | Every operation | Append-only, immutable, replayable |
| Genome | Inherited from parent organism | External governance (never self-modified) |
| Truth algebra | Axiomatic (NAL revision) | Evidence, revision, paraconsistent retention |
| Governance | Governance cells | External governor, shadow validation |

The system produces the cells that produce the system. The membrane produces the enzymes that produce the membrane. The provenance produces the audit that validates the provenance.

### §10.2 Bootstrap Protocol

AUTON bootstraps from a **minimal seed cell**:

```
SeedCell = {
  genome: MINIMAL_GENOME,           // epistemic firewall, AIKR, single commit path
  membrane: FAIL_CLOSED_INGRESS,    // untrusted content must pass judgment
  body: EMPTY,                      // no initial content
  economy: MINIMAL_BUDGET,          // enough for one cycle
  controlWord: PERCEIVE → JUDGE → COMMIT,  // minimal viable loop
  provenance: GENESIS_EVENT,        // the first event
}
```

From this seed, the organism grows through governed cell division:

1. **Phase 1 — Germination**: The seed cell perceives, judges, and commits. It creates the first provenance events.
2. **Phase 2 — Differentiation**: The seed cell divides into a reflex cell, a deliberation cell, and a consolidation cell.
3. **Phase 3 — Organ formation**: Cells organize into tissues and organs. The metacognitive organ is created.
4. **Phase 4 — Governance activation**: The governance pipeline is activated. Self-modification proposals begin to flow.
5. **Phase 5 — Constitutional maturity**: The genome is fully instantiated. External governance is connected. The organism is autopoietic.

### §10.3 Growth Constraints

Growth is governed by the same constraints as everything else:

- **H5**: No reasoning path may be unbounded. New cells must have bounded budgets.
- **H4**: No self-modification may be self-approved. New cells must pass governance.
- **H2**: No untrusted proposal may enter without judgment. New cells must have membranes.
- **H3**: No state mutation may occur without an event-log entry. New cells must have provenance.

The organism cannot grow faster than its governance pipeline can validate. This is a feature, not a bug.

---

## Part XI — Feasibility Constraints

### §11.1 The Constraint Set

The valid region of the AUTON design space is defined by the following constraints:

| # | Constraint | Rationale |
|---|---|---|
| Φ1 | Epistemic firewall: Reward $\nrightarrow$ BeliefTruth | Prevents sycophancy, reward hacking |
| Φ2 | AIKR $\implies$ bounded memory + anytime + forgetting | Unbounded growth under bounded postulate is incoherent |
| Φ3 | Untrusted proposers $\implies$ judge gates | Proposer privilege escalation without judgment is unauditable |
| Φ4 | Self-modification $\implies$ external governance | Self-approval is unsound (Löbian) |
| Φ5 | Event-sourced $\implies$ replayable + pure reducers | Audit trail must be reproducible |
| Φ6 | Step-level audit $\implies$ standalone verifier | Co-adaptation hides engine bugs behind verifier bugs |
| Φ7 | Paraconsistent $\implies$ graded truth | Explosive contradiction + revision is incoherent |
| Φ8 | Anytime $\implies$ priority scheduler | FIFO cannot preempt; anytime guarantee broken |
| Φ9 | Exact substrate $\perp$ uncertain similarity | Equality contamination (e-graph unioned on similarity) |
| Φ10 | Cell division $\implies$ genome inheritance + budget conservation | Division without governance is uncontrolled growth |
| Φ11 | Apoptosis $\implies$ governed + budget reclamation | Ungoverned death leaks resources |
| Φ12 | Differentiation $\implies$ governance + provenance | Ungoverned specialization breaks invariants |

### §11.2 Guarantee Conservation

The factors are not independent. There is a conservation law:

> You can relocate guarantees, but you cannot create them for free.

Spending freedom in scheduling costs auditability unless you re-spend on provenance. Removing a gate costs safety unless you re-spend on judgment calibration. Adding a cell costs governance unless you re-spend on membrane integrity.

AUTON front-loads guarantees into the genome, the membrane, and the event log so it can afford fluid control, thermodynamic economics, and governed evolution.

---

## Part XII — Implementation Topology

### §12.1 The Minimal Kernel

The smallest viable AUTON implementation requires:

1. **One cell** with a membrane, a body, a budget, a control word, and a provenance log.
2. **One gate** (fail-closed ingress).
3. **One budget dimension** (cycles).
4. **One truth algebra** (NAL $(f,c)$).
5. **One event log** (append-only).
6. **One commit path** (the unified ledger).

This is the **seed cell**. Everything else grows from it.

### §12.2 Growth Phases

| Phase | Adds | Cells |
|---|---|---|
| 0 — Seed | Minimal kernel | 1 |
| 1 — Germination | Perception, judgment, commit | 1 |
| 2 — Differentiation | Reflex, deliberation, consolidation | 3 |
| 3 — Tissue | Budget sharing, coordination | 3–10 |
| 4 — Organ | Meta-controller, governance | 10–50 |
| 5 — Organism | Constitution, external governance, autopoiesis | 50+ |

Each phase is a **governed transition**. The organism does not jump phases. It grows through them.

### §12.3 The Generalized Control Equation

The behavior of the organism at any time $t$ is governed by:

$$\dot{\mathbf{X}} = \mathcal{T}(\mathbf{X}, \mathbf{u}) - \gamma \mathbf{X} + \mathcal{E}(\mathbf{I})$$

Where:
- $\mathbf{X}$ is the epistemic state (the hypergraph of beliefs, goals, concepts across all cells)
- $\dot{\mathbf{X}}$ is the rate of change of knowledge
- $\mathcal{T}(\mathbf{X}, \mathbf{u})$ is the transition operator (NAL/rewrite rules), modulated by the continuous control vector $\mathbf{u}$ (the strategy manifold)
- $\gamma \mathbf{X}$ is the thermodynamic decay (AIKR forgetting/budgeting), governed by cognitive temperature
- $\mathcal{E}(\mathbf{I})$ is the epistemic boundary (the membrane gate), filtering external stimuli $\mathbf{I}$ into the state

### §12.4 Design Principle

> A reasoner is not primarily a "thinking engine." It is a **governed, bounded, cellular organism** that transforms observations and internal states into justified commitments under scarce resources, producing and maintaining the components that constitute it.

AUTON makes this universal:

- All cognition is proposal.
- All commitment is governed.
- All resource use is explicit.
- All learning is accountable.
- All state is event-sourced.
- All explanation is causal.
- All growth is cellular.
- All death is governed.
- All identity is autopoietic.

---

## Appendix A — Notation Summary

| Symbol | Meaning |
|---|---|
| $\chi$ | A cell |
| $\mathcal{M}_\chi$ | Cell membrane |
| $\mathcal{B}_\chi$ | Cell body |
| $\mathcal{E}_\chi$ | Cell economy |
| $\kappa_\chi$ | Cell control word (KAT) |
| $\mathcal{P}_\chi$ | Cell provenance |
| $\mathcal{G}_\chi$ | Cell genome |
| $\mathcal{V}$ | Valuation algebra |
| $\mathfrak{D}_{\text{AUTON}}$ | Design space |
| $\Phi$ | Feasibility predicate |
| $\alpha$ | Membrane polarity field |
| $\triangleright, \triangleleft_g, \parallel, \hookrightarrow, ^*$ | Composition operad |
| $\dashv$ | Proposer/judge adjunction |
| $\otimes_{\text{rev}}$ | Evidence revision |
| $\text{Bag}\langle T \rangle$ | Bounded priority bag |

## Appendix B — Invariant Summary

| Invariant | Enforcement |
|---|---|
| Reward $\nrightarrow$ BeliefTruth | Type system + gate lattice + commit ledger |
| Single commit path | Topological invariant of control flow |
| Append-only provenance | Free event monoid, no mutation |
| Bounded cognition | Budget algebra, open-once law, backpressure |
| Untrusted proposers | Membrane gate lattice, fail-closed ingress |
| Standalone verifier | Code independence, transcribed truth table |
| Genome immutability | External governance, no self-modification |
| Budget conservation | Division protocol, market clearing |
| Governed death | Apoptosis protocol, budget reclamation |
| Correlation threading | Single CorrelationId from stimulus to action |

---

*This specification is complete and self-contained. It defines AUTON as a cellular, autopoietic cognitive architecture with governed growth, thermodynamic economics, epistemic firewalls, unified commit, and full causal observability. Every structure has a formal definition, every invariant has an enforcement mechanism, and every growth phase has a governance protocol.*
