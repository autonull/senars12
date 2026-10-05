# A Control Model for the Design Space of Reasoner Behavior

The premise: SeNARS is not *the* answer to "how should a reasoner be controlled" — it is **one coordinate in a large space of control designs**. Below I build the space, pin SeNARS as a point in it, then walk to other points that buy more power, flexibility, and elegance.

---

## 1. The control model in one idea

Strip any reasoner to its control skeleton and it is a 6‑tuple:

```
R  =  ⟨ S,  O,  π,  G,  β,  Λ ⟩
```

| Component | What it is | The free choice |
|---|---|---|
| **S** — state space | Typed cognitive state (beliefs, goals, questions, concepts, attention, drives) | How many attitudes, how they're separated |
| **O** — operator library | Inference rules, tools, LM rules, self‑ops; each `o : S ⇀ S` with a cost vector `c(o) ∈ ℝ⁺ᵈ` and a provenance stamp | What operations exist; are they data or code |
| **π** — **control policy** | The scheduler: given `(S, history, budgets)`, choose `(o, focus, allocation)` next | **Fixed sequence ↔ learned/reflective policy** |
| **G** — admission structure | Gates deciding what enters/leaves `S`, each with a failure polarity (open/closed) | How many, where, and their polarity |
| **β** — budget algebra | Resource dimensions, ceilings, charge/refund, reset law | Static ↔ dynamic/learned allocation |
| **Λ** — adaptation law | How `(O, π, G, β)` themselves change, and under what authority | None ↔ governed self‑rewrite |

**The design space `D` is the product of the choice‑spaces of these six components.** A reasoner is a point in `D`. Everything that makes SeNARS *SeNARS* is a particular setting of `π`, `G`, `β`, and `Λ`.

### The heart is `π`

Almost all behavioral variety lives in the **control policy `π`** — the answer to "what happens next, and with what budget?" SeNARS sets `π` to a *constant*: a hard‑coded stage sequence. Most of the power locked out of SeNARS lives exactly here.

### Guarantee conservation

The factors aren't independent. There is a **conservation law** over the space:

> *You can relocate guarantees, but you cannot create them for free.*

Spending freedom in `π` (dynamic scheduling) costs auditability *unless* you re‑spend on provenance/correlation. Removing a gate costs safety *unless* you re‑spend on judgment calibration. SeNARS is a point that front‑loads guarantees into `G`, `β`, and event‑sourcing so it can afford a rigid, inspectable `π`. Navigation through `D` is the art of **moving guarantees around without dropping the total.**

---

## 2. The axes of variation

Ten axes span `D`. Each runs from *maximally constrained* (auditable, bounded) to *maximally general* (powerful, adaptive). SeNARS's position is marked **◆**.

| # | Axis | Spectrum (constrained → general) | SeNARS ◆ |
|---|---|---|---|
| **A1** | Scheduling topology | static sequence → static DAG → agenda/best‑first → blackboard → market/auction → learned policy → explicit search | **Static sequence** (Loop B 6 stages) |
| **A2** | Temporal structure | 1 sync rate → multi‑rate nested → async event‑driven → continuous‑time | **2‑rate nested sync** (macro/micro), one detached pump |
| **A3** | Admission control | gate‑free → single gate → typed gates → policy‑as‑data → adaptive gates | **4 typed gates**, polarity asymmetric |
| **A4** | Failure polarity | all‑open → all‑closed → **asymmetric by direction** | **Ingress closed / egress open** |
| **A5** | Resource model | unbounded → static global → static per‑cycle scopes → dynamic allocation → learned budgets | **2‑tier static** (lifetime main + 6 per‑cycle scopes) |
| **A6** | State/write architecture | mutable in‑place → single‑chokepoint event‑sourced → CRDT → versioned/branching | **Single chokepoint (`authorize`) + event log** |
| **A7** | Provenance | none → source tags → full provenance DAG → calibrated judgment | **Provenance DAG + manifold judgment** |
| **A8** | Proposer/judge split | monolithic → proposer/judge → judge cascade → adversarial debate | **Strict split** (LLM proposes, kernel judges) |
| **A9** | Epistemic structure | flat beliefs → belief/goal firewall → multi‑attitude → paraconsistent | **Firewall + paraconsistent** |
| **A10** | Control/cognition coupling | controller external+fixed → parameterized → **control‑as‑reasoning** → reflective self‑rewrite | **External, mostly fixed**; stage graph off‑limits to adaptation |

Two observations fall out immediately:

1. **SeNARS sits near the constrained end on A1, A2, A5, A10** (the *control* axes) and near the general end on **A6, A7, A8, A9** (the *epistemic* axes). That asymmetry is its entire character: **it freezes control so it can liberate and audit cognition.**
2. **A10 is the master axis.** Every other axis's position is a consequence of how much of the controller is itself subject to reasoning. SeNARS lets `Λ` adapt *contents* of cognition (strategies, budgets' ceilings, rules, even governed self‑code) but places the *stage graph* of `π` outside adaptation's reach — which is precisely the gap §13.3 names.

---

## 3. SeNARS as a point

Concrete coordinates, grounded in the implementation:

| Component | SeNARS setting | Evidence |
|---|---|---|
| `S` | Belief/goal/question firewall; concepts; drives | Epistemic firewall, `CognitiveAxis` |
| `O` | 44 NAL declarations in 20 dispatch cells (loaded data); ~19 LM rules; tools; 8 self‑tools | Rule matrix, `BUILTIN_DECLARATIONS` |
| **`π`** | **Fixed 6‑stage `for`‑loop**: `perceive → attend → reason → authorize → propose → learn`; no conditional edges; only branch is `abort` | `nar-execution.ts`; §13.3 |
| `G` | 4 gates; Perception asymmetric (`admit` fail‑closed ingress, `admitTask` always‑admits cycle path); egress veto remove‑only | §6, §12.1 item 5 |
| `β` | Lifetime main budget + 6 per‑cycle scopes, open‑once reset; charge via one arithmetic | §7 |
| `Λ` | Periodic RLFP (`% 100`), self‑assessment (`% 10`), drive meta‑goals; governed self‑mod via shadow worktrees | §4.6, governance pipeline |

**Characterization.** SeNARS is the point that *maximizes inspectability and boundedness* by making `π` a constant, `G` a fixed asymmetric filter bank, and `β` a static table — then spends the freed assurance on an aggressive proposer/judge split and paraconsistent, provenance‑bearing cognition. Its cost is **control rigidity**: it cannot skip a stage, reorder under pressure, or let urgency override the sequence. The doc's own §13 gap list is a map of the neighborhood SeNARS *isn't* in.

---

## 4. Navigating the space — seven alternative points

Each proposal is a **move along specific axes**, with the gain and the guarantee it spends. All preserve the epistemic firewall and event‑sourcing (the guarantees worth keeping); they re‑spend auditability where it's cheap to re‑buy.

### A. Data‑driven stage graph — *flexibility* (moves A1, A10)
Replace the hard‑coded 6‑stage sequence with a **declarative graph**: stages as nodes, transitions as guarded edges, dispatched through the *same middleware primitive* Loop A already uses (`dispatch()`).

- **Gain:** stage skipping, conditional ordering, per‑stimulus paths — closes §13.3's "no stage‑level conditionality."
- **Cost:** `π` is no longer a constant; execution order must be *logged* to stay auditable.
- **Keep safe:** every edge fires through `stage()`, so CycleTrace still sees every region — *"a stage the trace cannot see is a stage nothing can assert about."*
- This is the single highest‑leverage, lowest‑risk move: Loop A solved the primitive; Loop B just hasn't adopted it.

### B. Agenda‑driven operator scheduling — *power* (moves A1)
Generalize `π` from a fixed sequence to an **agenda**: a priority queue of *control tasks* (attend to drive spike, authorize urgent derivation, consolidate under pressure). The controller pops the highest‑value control action rather than walking a rail.

- **Gain:** urgency can preempt; the reasoner reacts to its own signals *within* a cycle instead of waiting for the next slot.
- **Cost:** nondeterminism in ordering → must be paid back with correlation logging (Proposal F).
- **Keep safe:** the agenda only selects among *already‑gated* operators; `authorize` remains the sole write chokepoint.

### C. Dynamic, learned budgets — *power + elegance* (moves A5, A10)
Replace static scope ceilings with **allocation**: scopes become *bids*; a scheduler distributes the cycle's resource by expected marginal value (learned by RLFP or a lightweight market). Keep the open‑once reset law; let the *ceiling* move.

- **Gain:** AIKR becomes *adaptive* — the system learns **how to be bounded**, starving low‑value work instead of uniformly truncating.
- **Cost:** budget decisions become state‑dependent → harder to reason about statically.
- **Keep safe:** the *dimensions* and the single `charge`/`refund` arithmetic stay fixed; only magnitudes adapt. Guarantees shift from "never exceed N" to "never exceed the (logged) allocation."

### D. Unified admission functional — *elegance* (moves A3, A4)
Collapse the four gates conceptually into **one admission functional**:

```
Admit : Candidate × Context → { admit, veto, defer }
        parameterized by (trust‑policy, budget‑policy, epistemic‑policy)
```

The four gates become **four configurations of one primitive**. The fail‑open/fail‑closed asymmetry stops being a special case and becomes a *parameter*: ingress sets `polarity=closed`, egress sets `polarity=open, mode=remove‑only`.

- **Gain:** one place to reason about admission; the §12.1 drift between `admit` and `admitTask` becomes impossible because there's one code path with explicit modes.
- **Cost:** mostly refactor risk; behavior can be held byte‑identical.
- This is the most *elegant* move: it turns an accidental asymmetry into a declared axis value.

### E. Control‑as‑reasoning — *elegance + power* (moves A10, the master axis)
Make the controller **itself a small, fast, bounded reasoner**: a `Focus` with its own `Bag`, `Game`, `Reflex` — but whose *actions are operator selections*, and whose beliefs/goals are control‑level ("competence is low ⇒ switch strategy"). SeNARS already gestures at this with drives and meta‑goals; this generalizes the gesture into the substrate.

- **Gain:** control and cognition unify under one mechanism; `π` becomes something the system *infers* rather than something it's handed.
- **Cost:** the control loop can now be wrong → it must be gated like any other proposer.
- **Keep safe:** the control‑reasoner is an **untrusted proposer of control changes**, judged by the same manifold and admitted through the same `Admit` functional. It can *propose* a stage reorder; it cannot *commit* one without passing the gate. Reflection without authority.

### F. Correlation/causality threading — *auditability at higher power* (pays for B, C, E)
Thread a `correlationId` from stimulus through every stage, scope charge, and admission. This is not a new capability — it's the **currency you spend to buy back auditability** after moving up A1/A5/A10.

- **Gain:** "which turn admitted this?" becomes answerable *no matter how dynamic `π` gets*.
- This is the conservation law made concrete: B/C/E each consume auditability; F refunds it.

### G. Multi‑rate heterogeneous async — *power + robustness* (moves A2)
Generalize 2‑rate sync nesting into a **rate hierarchy** of loosely‑coupled async loops — fast reflexes, medium inference, slow consolidation, very‑slow self‑modification — coordinated through the shared event log and budgets rather than synchronous nesting.

- **Gain:** a slow loop never blocks a fast one; the detached `propose` pump becomes the *pattern*, not the exception.
- **Cost:** reasoning about "a cycle" weakens → again paid back by F.
- **Keep safe:** all loops still write only through `authorize`; budgets remain the global arbiter across rates.

---

## 5. Synthesis — a safe trajectory through the space

SeNARS shouldn't *jump* to maximum power; its value is precisely its guarantees. But the axes above define a **monotone path** that gains capability while re‑buying safety at each step:

```
 ◆ SeNARS (fixed π, static β, 4 gates, external control)
    │
    ├─ D  unify admission into one functional      [elegance, ~free]
    ├─ A  stage graph as data over middleware       [flexibility, cheap]
    ├─ F  thread correlationId everywhere           [refund auditability]
    ├─ C  learned budget allocation                 [power, gated by F]
    ├─ B  agenda-driven scheduling                  [power, gated by F]
    ├─ G  multi-rate async loops                    [robustness, gated by F]
    └─ E  control-as-reasoning (gated proposer)     [the master move]
```

The ordering is deliberate: **D and A restructure without changing behavior; F installs the audit currency; C, B, G spend it on power; E spends it on reflection.** At every step the epistemic firewall, the single write chokepoint, and event‑sourcing are held fixed — so each new point remains a *SeNARS‑shaped* reasoner, just a more capable one.

**The one‑sentence design thesis:** SeNARS is the point in control‑space that froze the scheduler to guarantee the epistemology; the whole design space opens up by *unfreezing the scheduler while re‑anchoring the guarantees in provenance and gated admission instead of in rigidity.*

That is the model, and that is the neighborhood worth moving into.
