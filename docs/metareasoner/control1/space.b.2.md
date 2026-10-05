# A Control Model for the Reasoner Design Space

The goal: extract the *implicit* control decisions SeNARS makes, turn them into explicit axes, and treat SeNARS as one coordinate in the space those axes span. Then move along the axes deliberately.

---

## 1. The Cognitive Control Model (CCM)

Strip a reasoner to its control skeleton and it is a **controlled transition system**. Everything else is implementation.

```
repeat:
    s ← observe(S)                                        # cognitive state
    E ← { o ∈ O(s) : ∀γ∈Γ. γ(o,s)=allow  ∧  β ⊨ cost(o) } # enabled set
    o ← π(s, E ; ρ, J)                                    # schedule one
    S′ ← apply(o, S) ;  β ← β − cost(o) ;  emit(o,S,S′)   # act · spend · record
    S ← S′
```

A reasoner is the tuple that fills this loop:

| Symbol | Name | What it fixes |
|---|---|---|
| `W` | **work substrate** | what a schedulable unit *is* |
| `O` | **operators** | the state-transforming actions |
| `π` | **scheduler** | how the next operator is chosen |
| `Γ` | **gates** | who can veto an operator |
| `β` | **budget** | what bounds work, and when it resets |
| `J` | **judgment** | what decides truth/value, and on absence/fault |
| `ρ` | **objective** | drives · goals · rewards |
| `T` | **timescale topology** | how the loop nests (edges, sync/async) |
| `P` | **provenance** | what is recorded & independently checkable |

**The design space** is the product of each component's value range:
`D = W × Π × Γ × B × J × R × T × P`.
An architecture is a point in `D`; its *behavior* is the trajectory the loop traces. SeNARS is one such point — a notably conservative one.

---

## 2. The Axes and Their Spectra

Each axis is a genuine dimension along which real systems differ.

| # | Axis | Spectrum (rigid → fluid) | Governs |
|---|---|---|---|
| 1 | **Work substrate** `W` | `stage` → `task` → `concept` → `claim` | granularity of scheduling |
| 2 | **Scheduler** `π` | fixed-sequence → priority-queue → dataflow → auction → learned | how "what's next" is decided |
| 3 | **Judgment substrate** `J` | symbolic-only → hybrid → statistical-only | who decides truth/value |
| 4 | **Trust policy** | fail-closed ↔ fail-open; symmetric ↔ asymmetric | behavior on absence/fault |
| 5 | **Write control** `Γ` | single chokepoint ↔ multi-path | who may mutate state |
| 6 | **Objective coupling** `ρ` | none → homeostatic → reward-shaped → fully-learned | how motivation steers `π` |
| 7 | **Budget topology** `β` | lifetime ↔ per-cycle; #dimensions; reset granularity | shape of boundedness |
| 8 | **Timescale topology** `T` | #loops, nesting, up-edges, sync/async edges | temporal organization |
| 9 | **Provenance** `P` | none → log → replayable → independently-verifiable | auditability depth |

Where familiar architectures sit (to show this is a *general* space, not SeNARS-specific):

| Architecture | π | J | Write | ρ | P |
|---|---|---|---|---|---|
| Classical planner | dataflow | symbolic | multi-path | goal | low |
| ReAct / LLM agent loop | learned(LLM) | statistical | multi-path | reward/prompt | very low |
| Blackboard system | auction/priority | varies | guarded | varies | low |
| Pure RL agent | learned | statistical | multi-path | reward | low |
| **SeNARS** | **fixed-sequence** | **hybrid** | **single chokepoint** | **homeostatic + RLFP** | **max** |

---

## 3. SeNARS as a Point

| Axis | SeNARS coordinate | Load-bearing or contingent? |
|---|---|---|
| `W` | `stage` (micro) / `phase` (macro) | contingent |
| `π` | **fixed-sequence** in both loops; adaptivity confined to 5 strategy slots | **contingent** |
| `J` | hybrid — symbolic baseline + manifold overlay | load-bearing idea, contingent *policy* |
| Trust | **asymmetric** — ingress fail-closed, egress fail-open | contingent |
| Write | **single chokepoint** (`authorize`/`admit`) | **load-bearing** |
| `ρ` | homeostatic drives + meta-goals + RLFP (strategy-level only) | partly load-bearing |
| `β` | 2-tier — lifetime main + 6 per-cycle scopes | load-bearing idea, contingent values |
| `T` | 3 loops, one-way nesting, one async cross-cycle edge (`propose`) | contingent |
| `P` | **max** — event-sourced, replayable, independently verifiable | **load-bearing** |

**Load-bearing invariants** (SeNARS's identity — do not trade away): single write path, epistemic firewall (belief/goal), bounded cognition (AIKR), judgment-before-commitment, maximal provenance.

**Contingent choices** (relaxable without losing identity): the fixed stage sequence, the hardcoded ingress/egress asymmetry, the hardcoded `propose`-detached synchrony, and the restriction of adaptivity to strategy slots.

---

## 4. The Central Insight

> **SeNARS has already paid for maximal provenance but spends almost none of it.**

Provenance (`P`) is the *enabler* of safe adaptivity: if every scheduler decision is event-sourced, replayable, and independently verifiable, you can make `π` more adaptive **without losing auditability**. SeNARS sits at the far-rigid end of `π` despite holding the one asset (max `P`) that would make a fluid `π` safe. The design opportunity is to **cash in provenance for power and flexibility** — along axes that don't touch the load-bearing invariants.

The master trade-off:

```
control determinism  ◄──────────────────────►  adaptivity / power
      (auditable)                                   (capable)
```

Every variant below moves right on this axis *while staying replayable*, because the single write path and event log are preserved.

---

## 5. Variant Designs

Four points in the space, each a deliberate movement that preserves the load-bearing invariants.

### 5.1 SeNARS-SG — *Conditional Stage Graph*
**Thesis: control flow becomes data.**

- **Move:** `π` fixed-sequence → **dataflow/conditional**; keep `W = stage`.
- **Mechanism:** represent the micro-tick as a graph `G=(V_stages, E)` whose edges carry predicates over `{cycleSignals, β, drives}`. Execute it with the *same* `dispatch()` middleware primitive Loop A already uses — collapsing the Macro/Micro asymmetry into one control substrate. The `stage()` wrapper still wraps every node, so `CycleTrace` still sees every stage ("a stage the trace cannot see is a stage nothing can assert about" holds).
- **What it unlocks:** stage skipping becomes expressible (today `propose` is a runtime no-op when no producer is bound); the `learn` modulo-guards become edges; the **dead 11-stage vocabulary** (`negotiate`, `validate`, `act`…) is resurrected as *conditional* nodes rather than a fixed pipeline. This is precisely the top gap flow.md §13.3/§13.4 names.
- **Preserves:** single write path, budgets, provenance, firewall.
- **Gains:** flexibility + elegance. **Cost:** modest — ordering becomes declarative but still fully traced.

### 5.2 SeNARS-JC — *Judgment Continuum*
**Thesis: trust is a budget, not a direction.**

- **Move:** asymmetric fail-closed/fail-open → a single **judgment budget** `β_J` (a new `BUDGET_SCOPES` row, dimension `llmCalls`).
- **Mechanism:** ingress (`PerceptionGate.admit`) *and* egress (`vetoAtEgress`, `rankForAdmission`) consult the manifold **iff** `charge('judgment')` affords; otherwise both degrade to the symbolic baseline. Fail-closed/fail-open becomes a *function of budget state*: affordable-but-faulted → keep today's asymmetric policy (injection risk at ingress); unaffordable → pure symbolic both ways.
- **What it unlocks:** the hardcoded ingress/egress asymmetry becomes a **point on a continuum** controlled by one knob; egress judging becomes available whenever budget allows (today it is opt-in config, not budget-driven). Judging depth is now a deployment dial.
- **Preserves:** everything — it's a refinement.
- **Gains:** elegance + safety. **Cost:** ~none; orthogonal to the scheduling axis.

### 5.3 SeNARS-BB — *Unified Claim Queue (Blackboard)*
**Thesis: everything is a bid on a single queue.**

- **Move:** `W` → `claim`; `π` → **priority-queue**.
- **Mechanism:** abolish the fixed 6-stage sequence. Every cognitive operation — a rule-firing batch, a tool goal, a meta-goal injection, a proposal drain, a consolidation pass — posts a `Claim = {operator, priority, cost-vector, judgment-score, expiry}` onto a single `Bag<Claim>` (reusing the existing AIKR priority queue). The tick is: `while β affords ∧ queue≠∅: c ← pop(queue); if Γ(c): apply(c)`. Priority is computed from `ρ` (drives), `β`, and `J`.
- **What it unlocks:** true **anytime** behavior — reasoning, acting, and consolidating interleave by priority, not by arbitrary stage order; adding a capability is just posting a new claim type. This is the blackboard architecture, strictly more powerful than a pipeline.
- **Preserves:** the single write path — any claim that writes memory still routes through `admit()`; budgets; provenance (each dispatch is traced); firewall.
- **Gains:** power + flexibility. **Cost:** ordering is no longer self-evident — it *demands* the strong trace SeNARS already has.

### 5.4 SeNARS-MC — *Learned Meta-Controller* (the frontier)
**Thesis: the scheduler itself becomes the learned object.**

- **Move:** `π` → **learned**; `ρ` → reward-shaped scheduler.
- **Mechanism:** promote RLFP from adapting *strategy slots* to adapting the **claim-priority function** (in BB) or **edge weights** (in SG). The learned component scores enabled operators; gates and budgets still hard-constrain execution — it can *reorder and prioritize* but never admit, never bypass the firewall, never exceed budget. Scheduler changes are routed through governance like self-modification.
- **Gains:** adaptive control, efficiency. **Cost:** highest auditability risk — approach only once BB's trace is proven; reward-hacking of the scheduler is mitigated by the existing `RewardGate` (reward may not touch `Truth`) and by governance routing.

---

## 6. Projected Map

Two axes that matter most; `JC` sits on an orthogonal (judgment) layer compatible with every point.

```
 adaptivity / power
      ▲
      │                              ● MC   learned scheduler
      │
      │                 ● BB         claim queue
      │
      │        ● SG                  conditional stage graph
      │
      │   ● SeNARS                   fixed stages
      │
      └──────────────────────────────────────────►  rigidity
            (every point stays replayable — provenance is held constant at max)

      ⊕ JC (judgment continuum) — an orthogonal layer applicable to any of the above
```

---

## 7. Synthesis — a Recommended Target

Keep the five load-bearing invariants fixed; move deliberately on the contingent ones:

1. **Now → SeNARS-SG.** Highest leverage, lowest risk, resolves the architecture's own top-identified gap, and unifies both loops under one `dispatch` primitive.
2. **Layer on → SeNARS-JC.** Turns the hardcoded trust asymmetry into a tunable; compatible with SG and everything after.
3. **Evolve toward → SeNARS-BB.** A stage graph whose nodes post claims is a natural stepping stone to the blackboard; this is where the real power lives.
4. **Approach last → SeNARS-MC**, and only inside BB's proven provenance envelope.

**The through-line:** SeNARS's distinguishing asset is not its rigidity — it is its *provenance*. Rigidity is a leftover habit. By spending provenance capital on a conditional graph, then a claim queue, then a constrained learned scheduler, you gain power and flexibility **without** giving up the epistemic firewall, the single write path, or replayable audit. That is the elegant region of the design space SeNARS is currently adjacent to but not occupying.
