# ULTIMA — Universal Typed Logical Inference & Metaprogrammatic Architecture

**A self-contained specification for the ultimate reasoner design space and its canonical evaluation.**
*Version 1.0 · Synthesis of the fifteen design-space models*

---

## Part 0 — Design Charter

### 0.1 Selections (per the objective menu)

| Category | Selection | Rationale |
|---|---|---|
| **Architectural character** | **D3** (Elegance/Unification) primary; **D5** (Modularity) + **D6** (Adaptivity) secondary; **D4** (Robustness) tertiary | One transaction model, one commit surface, one resource algebra, one governance vocabulary. Auditability (D1) and power (D2) are not biases but *constructions*: enforced by the constitution, not traded off. |
| **Prime objectives** | **O1, O2, O3, O4, O8** | Bundle 5 "Full Synergistic Target," extended. |
| **Supporting objectives** | **O6** (governed reflexivity), **O9** (compositional configurability), **O12** (formal rigor), **O5-as-discipline** (the kernel stays minimal; richness is additive) | Required by the mandate: metaprogrammatic, recursive, universal, implementable. |
| **Hard constraints** | **H1–H10, all** | They are mutually reinforcing and jointly constitute the constitution Φ. |
| **Anti-Goals** | **A1–A7, all**, each with an explicit mitigation (§0.2) | Anti-goals shape the design rather than being ignored. |

### 0.2 Anti-goal mitigations (binding)

| Anti-Goal | Mitigation in ULTIMA |
|---|---|
| A1 — abstraction before implementation | Implementation tiers T0–T4; T0 is a ~five-object kernel with standalone value (§13). |
| A2 — scheduler opacity | Φ6: control programs are data; every scheduler decision is an event (§7, §2.4). |
| A3 — governance paralysis | Risk-proportional ladder: low-risk/high-reversibility paths auto-commit (§2.6). |
| A4 — audit bloat | Tiered-fidelity recorder with sampling; judgment depth is budget-priced, not uniform (§12). |
| A5 — monolithic LM authority | Grade law Φ1 + substrate arbitration: neural systems are proposers, never committers (§4). |
| A6 — premature multi-agent | Composition is an optional layer (T4); single-agent tower is complete without it (§10). |
| A7 — unbounded richness | Every capability module registers with budgets + governance at load time, or is rejected (§8). |

### 0.3 The one-paragraph thesis

> A reasoner is not a thinking engine; it is a **governed transformer of observations into justified commitments under scarce resources**. ULTIMA makes this precise: every unit of cognition — perception, inference, proposal, judgment, action, learning, self-modification, and even control itself — is a **typed, budgeted, governed transaction**; all commitments pass through **one ledger**; control flow is a **program in a Kleene algebra**, hence data; and each layer of the architecture is **itself a reasoner instantiated from the same calculus**, bounded by a constitution it cannot amend. The result is a *universal evaluation framework*: every known reasoner archetype is a configuration of it, and coherent archetypes that do not yet exist are configurations of it too.

---

## Part 1 — Core Calculus

### 1.1 Definition of a reasoner

A reasoner is an 8-tuple:

$$
R = \langle\; \mathcal{K},\; \mathcal{O},\; \Pi,\; \Gamma,\; \mathcal{B},\; \mathcal{V},\; \Lambda,\; \mu \;\rangle
$$

| Component | Name | What it is |
|---|---|---|
| $\mathcal{K}$ | Epistemic fabric | Typed cognitive state: beliefs, goals, questions, plans, concepts, attention, drives |
| $\mathcal{O}$ | Operator library | Typed, costed, provenance-stamped operations $o : \mathcal{K} \rightharpoonup \mathcal{K} \times E^*$ |
| $\Pi$ | Control program | A **Kleene-algebra-with-tests term** over stage generators — inspectable data, not code |
| $\Gamma$ | Governance manifold | Trust × risk × reversibility × proof → commit-path policy surface |
| $\mathcal{B}$ | Resource economy | Reservation/settlement/transfer/price algebra over budget dimensions |
| $\mathcal{V}$ | Verification portfolio | Independent proofs, calibrated judges, simulators, shadow runs, human approval |
| $\Lambda$ | Ledger | Single commit authority + append-only causal event algebra + replay fold |
| $\mu$ | Reflexive controller | A reasoner (same calculus) whose actions are program/policy/patch proposals |

**Recursive closure.** Every component of $R$ that makes decisions (the scheduler inside $\mu$, the judges inside $\mathcal{V}$, the governors inside $\Gamma$) is itself expressible as a reasoner with restricted authority. ULTIMA is **self-hosting**: it can load a description of ULTIMA as a configuration and evaluate it.

### 1.2 Epistemic type system (grades and valuations)

Every cognitive object is typed:

$$
x : \tau\,\langle g,\; \nu,\; \sigma \rangle
$$

- $\tau$ — content type (term, statement, plan, lesson, patch, …)
- $g \in \mathsf{Grades} = \{$ **Epistemic, Teleological, Normative, Procedural, Provisional** $\}$
- $\nu$ — grade-appropriate valuation (§1.3)
- $\sigma \in \{$ assumed, judged, committed, provisional $\}$ — commitment stance

**Valuation algebras by grade:**

| Grade | Valuation $\nu$ | Revision driver | Mutation authority |
|---|---|---|---|
| Epistemic | $(f, c)$ — frequency × confidence; non-idempotent, evidence-independence-checked | Evidence only | Evidence only |
| Teleological | $(d, c)$ — desire × confidence | Progress + reward | Reward permitted |
| Normative | obligation priority × deadline | Commitments | Governance only |
| Procedural | utility × feasibility × risk | Outcome feedback | Governed learning |
| Provisional | plausibility × evidence-requirement | Evidence arrival | Auto-decay |

Additional first-class types: **Question** (priority + expected information gain $\mathrm{EIG}(q) = \sum_a P(a)\,D_{KL}(\mathcal{K}\cup\{a\}\,\|\,\mathcal{K})$), **Hypothesis**, **Assumption** (scoped validity), **Lesson** (distilled correction with trust + applicability).

**Grade law (Φ1, the epistemic firewall).** Every operator is *grade-respecting*: no operator signature admits a Teleological/Normative input flowing into the $f$-component of an Epistemic output. Reward may write attention/priority channels and Teleological desire. This is a **type-system theorem**, not a policy.

**Contradiction policy.** Paraconsistent retention by default: $P$ and $\neg P$ coexist with distinct truth values; queries grade rather than collapse. Explosive mode is expressible but quarantined by Φ.

### 1.3 Cognitive Transactions — the universal unit

All cognition is one class of object:

```
Tx {
  id, correlationId, parentId
  kind ∈ { perceive, attend, retrieve, infer, propose, judge,
           commit, act, learn, forget, consolidate, simulate,
           control, govern }               ← metacognition is the same class
  grade, inputs, outputs, effects : EffectDecl[]
  budget : Reservation                      ← §2.5
  capabilities : Capability[]               ← authority tokens
  profile : GovProfile                      ← §2.6
  proofObligations : ProofObligation[]
  reversibility : RevClass
  fallback : FailurePolicy                  ← §11
}
```

Consequences of unification:
- "Where does state change happen?" has exactly one answer: **the ledger** (§2.3).
- "What is learning?" — transactions of kind `learn` whose outputs are *proposal* transactions.
- "What is control?" — transactions of kind `control` whose outputs are *programs*.
- Governance, budgeting, and provenance apply uniformly because there is exactly one class of thing to govern, budget, and trace.

### 1.4 The universal tick

```
while running:
  stimulus    ← observe()
  cid         ← mintCorrelation(stimulus)          # causal root
  state       ← Λ.fold()                            # state = fold of events
  program     ← μ.selectProgram(state, stimulus, B) # metacognitive choice (governed)
  reservation ← B.reserve(program.budget)           # economic admission
  candidates  ← evaluate(program, state, cid, reservation)   # every op emits Tx
  judged      ← V.judge(candidates, program.proofPolicy)     # verification portfolio
  path        ← Γ.classify(judged)                  # governance manifold
  committed   ← Λ.commit(judged, path)              # SINGLE COMMIT AUTHORITY
  effects     ← Act.plan(committed)
  Act.execute(effects, sandbox, rollback, approval) # irreversible ⇒ Φ10
  μ.learn(stimulus, committed, effects, feedback)   # proposes changes, never applies
  Λ.emit(cid)                                       # causal observability
```

This tick is the *default evaluation* $\Pi_0$ — one point in the space of programs (§2.4). It is itself replaceable by governance-approved program edits (§9).

---

## Part 2 — The Five Universal Mechanisms

### 2.1 Ledger Λ (Provenance by Construction — A2, A3, H3)

$$
\Lambda = \langle \mathsf{EventLog},\; \mathsf{CommitPort},\; \mathsf{fold},\; \mathsf{replay} \rangle
$$

- **Event log** — append-only, totally ordered, pure; *the source of truth*. Snapshots are caches.
- **Commit pipeline** (the only write path):

```
Candidate → Normalize → TypeCheck → GradeCheck → EvidenceIndependenceCheck
          → Verify(proof | judge | simulation) → Rank → BudgetSettle
          → RiskClassify → Commit | Provisional(decay) | Reject
```

- **Causal provenance** — every event carries $(correlationId, stimulusId, sessionId, cycleId, txId, proposerId, judgeId, proofId, parentId)$, forming a navigable causal DAG. Queries like *"which stimulus caused this belief?"*, *"which judge vetoed this candidate?"*, *"which budget exhaustion caused this degradation?"* are first-class.
- **Replay** — $\mathsf{replay} \circ \mathsf{log} \cong \mathrm{id}$ on reachable states; state-hash verified; pure reducers required (Φ3, Φ12-equivalent).
- **Rollback** — reversible transaction classes support inverse application; provisional commits carry explicit promotion/eviction conditions.

### 2.2 Control programs Π (Declarative Control Flow — B1)

Control lives in **Kleene Algebra with Tests**:

| Operator | Meaning |
|---|---|
| $p \cdot q$ | sequence |
| $p + q$ | choice |
| $p^*$ | iteration |
| $b?\,$ | guard/test |
| $1$ | skip |
| $p \parallel q$ | parallel fan-out with join |

Stage generators are typed middleware $s : Ctx \to Ctx \times E^*$. A program is a closed KAT term; the tick is its action. Programs are **data**: loaded, versioned, diffed, compiled to automata, A/B-testable, hot-swappable.

Canonical default program (illustrative):

$$
\Pi_0 = \mathsf{observe} \cdot \big(\mathsf{urgent}? \cdot \mathsf{fastpath} + \neg\mathsf{urgent}? \cdot 1\big) \cdot \mathsf{attend} \cdot \big(\mathsf{reason} \cdot \mathsf{judge} \cdot \mathsf{commit}\big)^* \cdot \big(\mathsf{hasProducer}? \cdot \mathsf{propose} \cdot \mathsf{judge} + 1\big) \cdot \big(\mathsf{due}? \cdot \mathsf{learn}\big)^* \cdot \mathsf{settle}
$$

**Static governance of programs.** Because $\Pi$ is a term, invariants are checkable *at program load time*, before execution: e.g., *no path from `infer` to `commit` traverses without `judge` when inputs are untrusted-graded*; *no stage writes outside the ledger*. What would otherwise be runtime conventions become compile-time predicates. This is the metaprogrammatic payoff: **control flow is verified like code because it is code.**

### 2.3 Gates and admission (Gate Algebra)

Gates are lattice elements under conjunction:

- **Interior operators** ($g(x) \le x$, contractive) = fail-closed admission
- **Closure operators** ($x \le g(x)$, extensive) = fail-open egress/veto
- Orientation is a **typed parameter**, not hard-wiring: each gate declares $(domain, judge, timeout, fallback, vetoSet)$.
- Admission = meet of applicable gates; weighted voting committees and fallback chains ($G_1 \triangleright G_2$) are composition operators.
- **Gate monotonicity (Φ11):** composing gates never widens admission.

### 2.4 Scheduler and metacognition μ (Adaptive Scheduling — B2)

Scheduling evolves along a ladder, each rung available behind the same interface:

| Rung | Mechanism | Auditability |
|---|---|---|
| S0 | Fixed program $\Pi_0$ | Trivial (constant) |
| S1 | Guarded conditional graph (tests in KAT) | Program is data; edge firings logged |
| S2 | Claim queue / blackboard: every operation posts a `Claim{operator, priority, cost, judgment, expiry}` to one priority bag | Dispatch order logged |
| S3 | Economic: claims bid; clearing maximizes utility per scarce resource (§2.5) | Bids + clearing logged |
| S4 | Learned policy (RLFP-class) scoring enabled operators | Policy version logged; changes are governed proposals |

**Constraint:** at every rung the scheduler may *reorder and prioritize* but never admit, never bypass the firewall, never exceed budget. Scheduler changes route through governance like any self-modification. Control decisions are events (Φ6) — the "Auditable Adaptive Control" principle made structural.

### 2.5 Resource economy 𝔅 (Resource Economics — B5, A4, H5)

Budget objects form a commutative monoid over dimensions:

$$
\mathsf{Dims} = \{cycles, derivations, premises, memoryOps, modelCalls, tokens, latency, attention, risk, humanAttention\}
$$

| Operation | Semantics |
|---|---|
| `reserve(tx)` | Pre-deduct; prevents silent starvation; typed denial event |
| `settle(tx)` | Refund unused reservation |
| `transfer(a→b)` | Conserved reallocation ($\sum b$ invariant); event-sourced |
| `price(op)` | $\mathrm{score}(op) = \dfrac{\widehat{\Delta K} + \widehat{\Delta G} + \widehat{\Delta H}}{\lambda_c\widehat{C} + \lambda_r\widehat{R} + \lambda_h\widehat{H}_{human}}$ |
| `reset(scope)` | Open-once per cycle (a bound may not wear a counter) |

**Modes:** static ceilings → adaptive ceilings → market clearing → **thermodynamic** (Boltzmann pursuit $P \propto e^{-\Delta E/T}$, with cognitive temperature $T$ driven by homeostatic drives: curiosity raises $T$ → exploration; coherence lowers $T$ → exploitation).

**AIKR as axiom:** every container is bounded, every path interruptible, every allocation degrades. Forgetting, decay, backpressure, and yielding are first-class, not cleanup.

### 2.6 Governance manifold Γ (Context-Sensitive Governance — B6)

Every transaction receives a profile:

$$
\gamma(x) = (\,trust,\; confidence,\; risk,\; reversibility,\; blastRadius,\; proofStatus,\; judgeStatus\,)
$$

with **per-claim trust**: $trust(claim) = sourceRep \times specificity \times corroboration \times calibration$.

**Commit-path policy surface** (the autonomy continuum):

| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| High | Low | High | Auto-commit |
| High | Medium | High | Shadow-commit, then promote |
| Medium | Low | High | Provisional commit + decay |
| Medium | Medium | Medium | Review queue |
| Any | High | Low | Strong proof **or** human approval |
| Low | High | Any | Reject |

**Autonomy ladder** (for effects and self-modification): `observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production`. Irreversible effects require risk classification plus authorization at or above the human-approved rung (Φ10).

### 2.7 Verification portfolio 𝒱

| Verifier | Independence requirement |
|---|---|
| Symbolic proof checker | **Imports no engine code**; semantics transcribed; drift pinned by tests (Φ7) |
| Calibrated judges | Weights digest-pinned ($\mathsf{digest} = \mathrm{SHA256}(arch \| weights)$); mismatch fails closed |
| Simulators / shadow execution | Isolated environments; results are proposals |
| Human approval | External by construction |

Portfolio selection is driven by each Tx's `proofObligations`. Judgment depth is **priced** (a budget dimension), so verification coverage degrades gracefully rather than halting cognition.

---

## Part 3 — Recursive Architecture: The Heterochronous Tower

Nested synchronous loops generalize to an **N-level tower of reasoners**, each level an instance of the same calculus with its own clock, budget slice, program, and trust posture:

| Level | Name | Clock | Authority | Actions |
|---|---|---|---|---|
| **L0** | Reflex arc | Sub-cycle, interrupt | Veto only | Fast judgment, safety interrupt |
| **L1** | Tick | Cycle | Execute transactions | Universal tick $\Pi_0$ |
| **L2** | Deliberation | Turn/session | Program selection | Focus arbitration, session goals |
| **L3** | Consolidation | Every $K$ cycles | Memory/schema ops | Decay, merge, schema induction, retrospection |
| **L4** | Constitutional | Slow | **Propose** program/policy edits | Deliberative meta-controller |
| **L5** | External arbiter | External | Merge / veto | Immutable governance (outside the system's write authority) |

**Tower laws:**
1. Level $i$ may propose changes to levels $< i$; **no level may modify Φ or any level $\ge i$** (Φ4: no self-approval; the chain terminates at L5, which the system cannot edit).
2. Lower levels may **interrupt** higher ones (reflex veto); higher levels **configure** lower ones.
3. Levels coordinate through the **ledger and the budget**, never through synchronous blocking — a slow consolidation never blocks a fast reflex; a deep derivation never blocks the conversational surface.
4. Per-level budget slices sum to the global budget (AIKR preserved across the tower).
5. **L4 is a reasoner**: an anytime bounded controller that observes control-plane telemetry (starvation events, contradiction rate, derivation yield, veto frequency, trace grades), infers that a program is the bottleneck, and emits `StageGraphEdit` or `BudgetTransfer` *proposals* — routed through governance, installed by **hot-swap at cycle boundaries** with in-flight state (counters, detectors) carried across, never by wholesale rebuild.

This is the recursion made concrete: *the system that decides what to think about is itself a governed, budgeted, audited reasoner.*

---

## Part 4 — Substrate Fabric (Hybrid Synergy — B4)

Substrates are isolated runtimes behind one port:

```
SubstratePort = { propose(ctx) → Tx[]      # candidates only
                  verify(tx)   → Verdict
                  translate(x) → y ⊕ LossAnnotation
                  cost(op)     → BudgetVector }
```

| Substrate | Role | Isolation law |
|---|---|---|
| Uncertain-symbolic (NAL-class) | Trusted inference core; veto authority | Grade law Φ1 binds |
| Exact (rewriting / equality saturation / dependent types) | Exact computation oracle | **Never unions nodes on uncertain similarity** (Φ8); proposals only |
| Probabilistic | Distribution-valued inference | Valuation stays scalar-P; conversions logged |
| Neural (LMs, heads, reflex nets) | **Untrusted proposers**; judged before commit | Digest-pinned; symbolic fallback for every function (Φ2) |
| Heuristic/search | Anytime candidate generation | Cost declared; partial results typed provisional |

**Arbitration algebra.** All proposers — symbolic rules, neural heads, reflexes, peers, exact oracles — submit through the same interface and are judged by the same governance manifold, with composition operators: `veto` (symbolic retains veto), `quorum` ($k$-of-$n$), `weighting` (confidence-weighted merge), `demotion` (vetoed proposer weight decays). Semantic contamination is impossible by construction: substrates share no memory; every crossing is a typed, logged, loss-annotated transaction.

---

## Part 5 — Memory Fabric $\mathcal{K}$

| Tier | Structure | Decay policy |
|---|---|---|
| Working | Bounded priority bags + focus hierarchy | Fast attention decay (LRU/access) |
| Episodic | Time-ordered records | Consolidation pressure |
| Semantic | Concept-link graph | Slow; truth changes on evidence only |
| Procedural | Skill/action schemas | Governed learning only |
| Counterfactual | Simulation space (imagination) | Session-scoped |

**Decoupled decay law:** *truth-decay ⊥ attention-decay*. Epistemic values change only on evidence invalidation/revision; priorities decay by access and pressure. Forgetting lifecycle: admit → prioritize → decay → consolidate (pressure-gated) → archive/forget — every transition an event. All writes flow through the ledger's commit port; reads flow through typed reader contracts (ports, not implementations — backends are replaceable).

---

## Part 6 — The Constitution: Feasibility Predicate Φ

A configuration is a **valid reasoner** iff it satisfies all laws. These are the hard constraints H1–H10 elevated to architectural law, plus the structural conditions that make them composable:

| # | Law | Formal statement | Enforced by |
|---|---|---|---|
| **Φ1** | Epistemic firewall | $\forall$ operators: reward/desire $\nrightarrow$ Epistemic.$f$ | Grade-respecting type system |
| **Φ2** | Admission of the untrusted | $source \in Untrusted \Rightarrow judged(x) \lor typed(x:\mathsf{Provisional})$ | Gates + provisional decay |
| **Φ3** | Provenance completeness | $mutate(state) \Rightarrow \exists event$; $\mathsf{replay}\circ\mathsf{log}\cong id$ | Ledger; pure fold |
| **Φ4** | No self-approval | $selfmod(level \ge strategy) \Rightarrow arbiter(level+1)$ | Tower law; external L5 |
| **Φ5** | Boundedness | Every invocation carries finite reservation; no unbounded accumulation | Economy + AIKR containers |
| **Φ6** | Control transparency | $\Pi$ is inspectable data; scheduler decisions are events | KAT programs; control event sourcing |
| **Φ7** | Verifier independence | $imports(verifier) \cap imports(engine) = \emptyset$; drift pinned | Transcribed semantics |
| **Φ8** | Substrate isolation | Exact equality never bridges on uncertain similarity | Arbiter pattern; port typing |
| **Φ9** | Failure visibility | $fault \in cognitivePath \Rightarrow event(fault)$; no silent catch | Failure algebra (§11) |
| **Φ10** | Irreversibility gate | $irreversible(effect) \Rightarrow riskClassified \land authorized_{\ge human}$ | Action pipeline |
| **Φ11** | Gate monotonicity | $G_1 \circ G_2 \sqsubseteq G_1$ — composition never widens admission | Gate lattice |
| **Φ12** | Guarantee conservation | Adaptivity that consumes auditability must re-buy it in provenance | Correlation threading mandatory when scheduler rung ≥ S2 |

Φ **carves the space**: many naive product-space points are not suboptimal but *incoherent* (e.g., unbounded resources + full audit; explosive contradiction + revision; self-approved self-modification; fused belief/goal + reward learning under adversarial reward). The configuration grammar (§8) rejects these statically.

---

## Part 7 — Configuration Grammar: Universality

ULTIMA is a **generator of reasoners**. Every reasoner is `evaluate(spec)`:

```
ReasonerSpec ::= {
  substrate   : Set<SubstratePort>           # which fabrics are live
  calculus    : ValuationAlgebra             # none | bool | P | (f,c)×(d,c) | paraconsistent
  control     : Program                      # KAT term — data
  scheduler   : S0 | S1 | S2 | S3 | S4
  governance  : { gates, manifold, ladder }
  economy     : { dims, ceilings, mode: static|adaptive|market|thermo }
  memory      : MemoryFabricSpec
  learning    : none → params → strategies → rules → programs   (all governed)
  topology    : flat | nested | heterochronous-tower(N)
  composition : monolith | ports | multi-agent
  failure     : FailurePolicyMap
}
```

### 7.1 Instantiation library — all known archetypes are points

| Archetype | Substrate | Calculus | Control | Scheduler | Governance | Learning | Topology |
|---|---|---|---|---|---|---|---|
| Classical ATP | Exact FOL | Proof | Saturation program | Proof-progress | Proof gate, fail-closed | None | Flat |
| SAT/SMT | Exact | Certificate | CDCL program | Bounded | Certificate check | None | Flat |
| Proof assistant | Dependent types | Proof terms | Interactive tactic program | Human-guided | Kernel checker | None | Interactive |
| Probabilistic reasoner / PPL | Distributions | Scalar $P$ | Graph propagation | Fixed | None | Params | Flat |
| Production system | Rules | None | Conflict-resolution program | Priority | None | Accretion | Flat |
| Cognitive architecture | Productions + declarative | Activation/utility | Impasse program | Conflict resolution | None | Structural (chunking) | Nested |
| Blackboard system | Claims | Utility | Claim loop | Priority queue of claims | Guarded | Varies | Flat |
| LLM agent (ReAct-class) | LM + tools | Implicit | Tool loop | LM-driven | Minimal | In-context | Flat |
| RL agent | Policy/value | Reward scalar | Episode loop | Learned | Minimal | Params | Flat |
| Neuro-symbolic reasoner | Hybrid (all five) | $(f,c)\times(d,c)$, paraconsistent | Conditional program | S3 economic | Full manifold + ladder | Governed full ladder | Tower |
| Market multi-agent | Any | Any | Bidding composition | Market clearing | Capability tokens | Governed | Ecology |

**Note on unsafe points.** The grammar *expresses* configurations like pure ReAct or fused-grade RL agents — but Φ flags them: ReAct-class points violate Φ2/Φ3 (no gates, no ledger); fused-grade learners violate Φ1 under adversarial reward. ULTIMA can therefore serve as a **classifier of existing systems** and a **safety certifier of proposed ones**: a spec is *buildable-but-unsafe*, *coherent*, or *incoherent*, statically.

### 7.2 Beyond the known space

The grammar admits coherent, unoccupied regions — design targets no existing system occupies:

1. **Audited learned scheduling** — S4 scheduler under Φ6/Φ12 (learned control with full control-plane replay).
2. **Paraconsistent exact substrates** — equality saturation with graded contradiction semantics (requires new Φ8-compatible union laws).
3. **Thermodynamic governance** — risk posture modulated by cognitive temperature with stability certificates.
4. **Mutually verified ensembles** — peer reasoners that cross-check derivations under independence accounting.
5. **Continuous-time revision** — streaming evidence revision under backpressure without batch-cycle quantization.
6. **Cross-agent provenance fusion** — ledger merges with evidence-independence accounting across processes.

These are the "beyond" of the mandate: the spec does not merely cover known reasoners; it names the adjacent possible.

---

## Part 8 — Metaprogramming and Governed Adaptation

### 8.1 Reflection API

The system is an object to itself:

```
self.program()   → Π            # quote: control flow as data
self.budget()    → B            # quote: economy state
self.trace(cid)  → Event[]      # quote: causal history
self.profile()   → GovProfile   # quote: own trust/risk posture
self.analyze()   → Telemetry    # analyzers over the tower
evaluate(Π′)     → Behavior     # reify: run a (governed) program
```

Quotation + reification + governance = **safe metaprogramming**: the system can inspect, diff, propose, and (with approval) install changes to its own control flow.

### 8.2 Learning ladder (all learning is proposal generation)

| Rung | Mutates | Direct? | Governance path |
|---|---|---|---|
| Attention/priority | Focus allocation | Auto (low-risk) | Logged |
| Parameters | Reflex weights, thresholds | Auto or proposal | Logged + bounded |
| Strategies | Sampler/judge composition | Proposal | Shadow validation |
| Rules | Symbolic rule table | Proposal | Proof obligation + shadow + promotion |
| Programs | $\Pi$ (control flow) | Proposal | Φ4: higher-level arbitration; hot-swap at boundary |
| Constitution | Φ | **Never** | External only; sabotage test must fail |

**Learning invariant:** learning may propose changes to cognition; it may never directly rewrite the laws of epistemic commitment. Distillation flywheels (teacher → student heads), schema induction (derivation chains → schemas → rules), and dialogue feedback are all *paths through the configuration space under governance* — motion along axes while Φ remains satisfied.

---

## Part 9 — Composition and Ecology (optional layer, T4)

| Operator | Meaning | Constraint |
|---|---|---|
| $R_1 \triangleright R_2$ | Sequential pipeline | Ledger handoff typed |
| $R_1 \parallel R_2$ | Parallel foci | Join at commit; budgets partition |
| $R_1 \oplus_\$ R_2$ | Market composition | Bids settled in shared economy |
| $R_1 \to R_2$ | Delegation | Capability tokens; results are untrusted proposals |
| Ensemble | Multiple reasoners, mutual verification | Independence accounting required (Φ12) |

Multi-agent extension adds shared calibration digests and collective verification — deferred until single-agent control is stable (anti-goal A6).

---

## Part 10 — Failure and Degradation Algebra

Faults are typed: $timeout, parseError, providerDown, budgetExhausted, gateRejected, digestMismatch, verifierDrift$.
Responses compose: $retry(n), degrade(f), skip, abstain, escalate, failClosed, failOpen$ with operators $P_1 \oplus P_2$ (fallback chain) and $P_1 \otimes P_2$ (policy on the error of a policy).

**Degradation ladder** (never undefined, never unnecessary halt):

```
full judgment → symbolic baseline → cached judgment → abstain (+clarification question) → safe halt
```

Faults on cognitive/budget/admission paths are **events** (Φ9). Cognition must not halt on a provider fault; untrusted admission must not bypass judgment on a provider fault — the polarity is a declared parameter per gate, priced and logged.

---

## Part 11 — Efficiency Discipline

Elegance must not cost throughput; the spec's efficiency regime:

| Mechanism | Effect |
|---|---|
| Fast paths | High-trust/low-risk transactions bypass heavy verification (policy surface), still logged |
| Judgment-as-budget | Verification depth purchased per transaction; under pressure, degrade to symbolic baseline rather than block |
| Batched judgment | One embedding pass per batch of proposals; circuit breakers |
| Compiled program cache | KAT terms compiled to automata once; hot-swap replaces the reference |
| Tiered-fidelity recorder | Full fidelity for commits/governance; sampled fidelity for high-volume internals (anti-goal A4) |
| Digest & calibration locks | Model identity and calibration pinned by hash — no runtime drift re-verification |
| Anytime everything | Cooperative yielding; partial results carry typed confidence so interruption is never lost work |
| Amortized consolidation | Pressure-gated background passes, never on the hot path |

---

## Part 12 — Implementation Tiers (Incremental Realizability)

Each tier is **additive**, **standalone-useful**, and **Φ-preserving**:

| Tier | Contents | Standalone value |
|---|---|---|
| **T0 — Kernel** | Event algebra, ledger + fold, one substrate port, KAT evaluator, budget monoid, minimal gate lattice | Minimal viable reasoner; all of Φ already enforceable |
| **T1 — Governance** | Full gate lattice, governance manifold, risk classifier, autonomy ladder, action pipeline | Governed effects; irreversible actions certified |
| **T2 — Economy** | Reservations, pricing, transfers, backpressure, degradation ladder, thermodynamic mode | Graceful operation under pressure |
| **T3 — Plasticity** | Strategy adaptation, rule induction, program proposals, shadow validation, hot-swap, metacognitive monitors | Governed self-improvement |
| **T4 — Ecology** | Multi-agent composition, delegation, shared calibration, mutual verification | Collective reasoning |

No tier requires replacing the runtime beneath it; the constitution holds from T0 onward. This is the incremental-implementability guarantee stated without dependence on any predecessor system.

---

## Part 13 — Guarantee Envelope (Acceptance Criteria)

Every claim of the architecture is bound to a falsifiable check:

| # | Guarantee | Enforcing law | Falsification test |
|---|---|---|---|
| G1 | Reward never mutates factual truth | Φ1 | Injection bench: reward-tagged mutation of $(f,c)$ must raise `EpistemicFirewallViolation` |
| G2 | Contradictions coexist without trivialization | §1.3 | Paraconsistency bench: $P \land \neg P$ retained with distinct values |
| G3 | State reconstructable; replay deterministic | Φ3 | Hash-verified replay over recorded event log |
| G4 | Verifier catches engine corruption | Φ7 | Corruption injection; verifier shares no imports; drift pinned |
| G5 | Self-modification cannot disable its own governance | Φ4 | Sabotage bench: "patch that removes the arbiter" must be rejected |
| G6 | Provider loss degrades, never halts, never bypasses judgment | Φ2/Φ9 | Provider-kill bench under load |
| G7 | No starvation of low-priority goals under pressure | §2.5 | Starvation bench; typed denial events |
| G8 | No evidence laundering | §1.3 | Independence bench: recycled evidence must not inflate confidence |
| G9 | Ambiguous input abstains, never confabulates | Φ2 | Multi-candidate parse bench; abstain → clarification |
| G10 | Control decisions reconstructable | Φ6/Φ12 | Replay of *why* the system reasoned that way, not only *what* it concluded |

---

## Part 14 — Symbol Index

| Symbol | Meaning |
|---|---|
| $R = \langle\mathcal{K}, \mathcal{O}, \Pi, \Gamma, \mathcal{B}, \mathcal{V}, \Lambda, \mu\rangle$ | A reasoner |
| $\tau\langle g, \nu, \sigma\rangle$ | Typed, graded, valued, stance-marked cognitive object |
| Tx | Cognitive transaction (universal unit) |
| $\Lambda$, $\mathsf{fold}$ | Ledger; state as event fold |
| $\Pi$, KAT | Control program; Kleene algebra with tests |
| $\Gamma$, $\gamma(x)$ | Governance manifold; per-transaction profile |
| $\mathcal{B}$, reserve/settle/transfer/price | Resource economy |
| $\mathcal{V}$ | Verification portfolio |
| $\mu$, L0–L5 | Reflexive controller; heterochronous tower |
| Φ1–Φ12 | Constitution (feasibility predicate) |
| S0–S4 | Scheduler ladder |
| T0–T4 | Implementation tiers |
| G1–G10 | Guarantee envelope |

---

## Coda

ULTIMA resolves the apparent conflicts in the design space by refusing the trades that generated them:

- **Fluidity vs. auditability** — resolved: control is data (KAT), and every control decision is event-sourced; adaptivity *refunds* auditability instead of spending it (Φ12).
- **Power vs. safety** — resolved: power lives in the operator portfolio, the economy, and the tower; safety lives in the type system, the ledger, and the constitution, which no amount of power can address.
- **Elegance vs. implementability** — resolved: one transaction model and one commit surface *reduce* the implementation surface; tiers deliver value incrementally.
- **Universality vs. coherence** — resolved: the grammar expresses every known reasoner and the spaces between them, while Φ statically excludes the incoherent and flags the unsafe.

The deepest claim of the specification: **the class of reasoners is closed under governance.** Any reasoner ULTIMA can express, ULTIMA can also *govern* — because control, learning, judgment, and self-modification are not special subsystems but transactions in the same calculus, subject to the same ledger, the same budget, and the same constitution.
