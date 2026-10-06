# ATLAS — The Cognitive Manifold
### A Topological Specification for Governed, Bounded, Hybrid Reasoning

---

## §0 — Selections

**Prime Objectives:** O1 (epistemic integrity) · O2 (causal provenance) · O3 (control-plane fluidity) · O4 (resource economics) · O6 (governed reflexivity) · O7 (neuro-symbolic synergy) · O8 (unified commit ledger)

**Hard Constraints:** H1–H10, adopted in full.

**Anti-Goals:** A2 (scheduler opacity) · A4 (audit bloat) · A5 (monolithic LM authority) · A7 (unbounded cognitive richness).

**Architectural character:** D3 (unification) is the *method*; D1 (auditability) and D4 (robustness) are *ceilings that never trade down*; D2 (power) and D6 (adaptivity) are *objectives pursued only inside the constraint surface*; D5 (modularity) is the *interface discipline* (everything below is stated as typed ports).

**Design thesis.** A reasoner is not a pipeline. It is a **stratified space**: a control complex carrying a state fibration, sheaved in events, measured by finite resources, wrapped in a trust field, filtered by governance, and collapsed onto a single ordered spine where all commitment happens. Every design decision below is a statement about the topology or geometry of that space.

---

## §1 — The Six Spaces and the Spine

The architecture is the tuple

$$\mathfrak{M} = \langle\; \mathcal{C},\; p:\mathcal{E}\to\mathcal{C},\; \mathscr{S},\; \mu,\; \tau,\; \mathcal{G},\; \Lambda \;\rangle$$

| Object | Name | Topological/geometric nature |
|---|---|---|
| $\mathcal{C}$ | **Control complex** | Directed CW-complex: stages = 0-cells, guarded transitions = 1-cells, program equivalences = 2-cells |
| $p:\mathcal{E}\to\mathcal{C}$ | **State fibration** | Fiber over each control point = cognitive state; histories = sections; replay = path lifting |
| $\mathscr{S}$ | **Event sheaf** | Sheaf over the causal (Alexandrov) topology of events; audit = separation axiom |
| $\mu$ | **Resource measure** | Finite measure on $\mathcal{C}$; budgets = sub-measures; prices = Radon–Nikodym derivatives |
| $\tau$ | **Trust field** | Calibrated $[0,1]$-field over proposals; gates = interior/closure operators (literal topology) |
| $\mathcal{G}$ | **Governance filtration** | Nested subcomplexes $\mathcal{G}_0\subset\mathcal{G}_1\subset\cdots$; authority = stratum index |
| $\Lambda$ | **The Spine** | Totally ordered 1-complex — the single commit ledger; every mutation is an edge of $\Lambda$ |

Everything else — substrates, judges, schedulers, learners — is either a **map between these spaces** or a **section of one of them**. There are no other kinds of things.

---

## §2 — Chart I: The Control Complex $\mathcal{C}$ *(B1, O3)*

**Definition.** $\mathcal{C}$ is a directed cell complex:

- **0-cells** are *stage kinds*: `perceive, attend, retrieve, infer, propose, verify, rank, commit, plan, act, learn, consolidate, imagine, repair, triage, …` — an open registry, not a fixed list.
- **1-cells** are *guarded transitions* $e = (u, v, g_e, b_e)$ with guard $g_e : \text{State} \to \{0,1\}$ and budget annotation $b_e$ naming which resource cells the traversal consumes.
- **2-cells** are *program identities*: commuting diagrams declaring that two paths are equivalent (e.g., “skip-verify when proposer is trusted-core” homotopic to “verify-then-accept under trivial judgment”).

**Consequences of the topology:**

1. **Control flow is data.** A control program is a path $\gamma$ in $\mathcal{C}$; graphs are loaded, versioned, reverted like tables.
2. **Program equivalence is homotopy.** Two programs related by a 2-cell are A/B-testable, provably interchangeable, and replay-equivalent. Program changes are *deformations*, not rewrites.
3. **Conditionality, parallelism, iteration** are respectively: guarded edges, fork/join diagrams, and loops — all expressible, all static-analyzable as complex properties (e.g., “no path from `infer` reaches `commit` without passing through `verify` when the input boundary is untrusted” is a *reachability predicate on the complex*, checkable without running it).
4. **The meta-controller acts on $\mathcal{C}$, not on code.** It proposes path deformations (add an edge, re-weight a guard, insert a stage) subject to §7.

**Invariants of the complex (static, enforced at graph-compile time):**

| Invariant | Statement |
|---|---|
| C-I | Every untrusted-boundary entry cell is separated from every commit edge by at least one `verify` cell |
| C-II | No path exists from any teleological stage to any belief-mutation port (§3) |
| C-III | Every 1-cell carries a budget annotation; unannotated edges do not compile |
| C-IV | Every cell reachable from entry is co-reachable from an exit or an explicit `triage` sink (no orphan regions — dead topology is forbidden) |

---

## §3 — Chart II: The State Fibration and the Firewall *(A1, H1, O1)*

**State space.** The cognitive state is a product manifold with three factors:

$$\mathcal{S} \;=\; \mathcal{S}_{E} \times \mathcal{S}_{T} \times \mathcal{S}_{P}$$

- $\mathcal{S}_E$ — **epistemic**: beliefs as pairs $(f,c)\in[0,1]^2$ (frequency, confidence), paraconsistent (contradictory sections coexist as distinct germs with independent truth coordinates); evidence-lineage bounded.
- $\mathcal{S}_T$ — **teleological**: goals/desires as $(d,c)$; drives as homeostatic coordinates with setpoints.
- $\mathcal{S}_P$ — **procedural/working**: attention priorities, focus structure, task queues, tool state.

**The Firewall Law (geometric form).** Cognitive dynamics are vector fields $X$ on $\mathcal{S}$ generated by transactions. Let $R$ be any reward/utility-derived field. Then:

$$d\pi_E(R) \;=\; 0 \qquad\text{(reward has zero epistemic component)}$$

Reward and desire may move points along $\mathcal{S}_T$ and modulate attention coordinates in $\mathcal{S}_P$; their projection onto $\mathcal{S}_E$ is identically zero. Belief motion is generated **only** by evidence-carrying fields (revision, contradiction, invalidation). This is not a policy; it is a type-level tangent constraint on the dynamics, and every transaction schema (§8) is checked against it before admission.

**Truth as a sheaf.** Truth values form the fibers of a sheaf over the concept space: local sections may disagree on overlaps (paraconsistency); revision is the gluing of sections over a common refinement, permitted only under an **independence condition** (monodromy triviality — combined evidence must not double-count a shared ancestor). Evidence laundering is therefore topologically impossible: a section that restricts to the same ancestor twice fails the gluing axiom.

**Substrate isolation (H8, geometric form).** Each substrate (symbolic-uncertain, exact/rewrite, probabilistic, neural/subsymbolic) occupies its own chart. Cross-chart maps are restricted to **pullbacks** (exact results may inform uncertain proposals) and **proposals across the boundary**; **pushouts along uncertain maps are forbidden** — no quotient may identify exact objects on the strength of a similarity score. The e-graph and the uncertainty calculus never share an equivalence relation.

---

## §4 — Chart III: The Event Sheaf and Path Lifting *(A3, O2, C2, H3)*

**Causal topology.** Events form a poset under causal order; its Alexandrov topology gives open sets $U_e = \{x : x \preceq e\}$ (causal pasts). Provenance is the sheaf $\mathscr{S}$ over this space:

- **Sections over $U_e$** = the complete history explaining $e$.
- **Restriction** = taking causal pasts.
- **Gluing** = composing histories along shared pasts.

**The separation axiom of audit.** $\mathscr{S}$ is required to be *separated*: two cognitive histories that agree on every event cell are identical. Consequence: replay is not approximation — it is reconstruction of the unique section.

**Path lifting = replay.** The fibration $p:\mathcal{E}\to\mathcal{C}$ has the **unique path-lifting property**: given initial state $s_0$ and a control path $\gamma$ (the recorded event sequence), there exists a unique lifted state trajectory $\tilde\gamma$ with $\tilde\gamma(0)=s_0$. Determinism of the reducers is exactly the condition that $p$ is a covering map. Replay is lifting. Independent verification is lifting performed in a **disjoint trivialization** (§9, H7): the verifier reconstructs the lift using transcribed transition laws, sharing no unsafe structure with the engine.

**Correlation as a natural family.** Every event cell carries the coordinate tuple

$$\langle \text{stimulusId},\; \text{cycleId},\; \text{transactionId},\; \text{proposerId},\; \text{judgeId}?,\; \text{proofId}?,\; \text{parentId}?,\; \text{budgetRef}?,\; \text{failureClass}? \rangle$$

so that “which stimulus caused this belief?” and “which budget exhaustion caused this degradation?” are well-formed queries — paths in the causal complex, not log searches.

**Control is event-sourced too (H6).** Scheduler decisions, budget settlements, guard evaluations that branch execution, and graph edits are event cells of the same sheaf. There is no class of decision that lives outside the topology. Opacity is not a degree — it is excluded by construction.

---

## §5 — Chart IV: The Resource Measure and the Cognitive Economy *(A4, O4, B5)*

**AIKR as a measure axiom.** There is a finite measure $\mu$ on $\mathcal{C}$:

$$\mu(\mathcal{C}) \;<\; \infty \qquad\text{(global boundedness)}$$

over a product of dimensions $\{\text{cycles}, \text{derivations}, \text{memory ops}, \text{model calls}, \text{tokens}, \text{latency}, \text{attention slots}, \text{risk quota}\}$. Every traversal of a 1-cell consumes measurable resource; every transaction **reserves** a sub-measure before executing and **settles** the unused remainder after. There is no path of infinite $\mu$-measure (H5).

**Prices.** The scheduler maintains a utility measure $\nu$ (expected epistemic + teleological + homeostatic gain). Where $\nu \ll \mu$, the price field is the Radon–Nikodym derivative

$$\rho \;=\; \frac{d\nu}{d\mu}$$

— marginal utility per unit resource. Operators bid; the clearing rule is utility-per-scarce-dimension ranking subject to hard reservations (safety checks, governance obligations, and committed irreversible work are non-outbiddable — they carry *measure-zero elasticity*).

**Backpressure and degradation are geometric.** As $\mu$-mass depletes, the scheduler restricts support to sets of increasing $\rho$-density: exploration first, enrichment next, goal-work last, core coherence never. This is a continuous contraction of support, not a cliff. Starvation is a **typed event** (a denied reservation is a cell in $\mathscr{S}$), never a silent drop (H9).

**Forgetting.** Decay is a one-parameter contraction on state fibers: attention/priority decays with access; truth decays **only** under invalidation or contradiction (§3). Consolidation and archival are measure-preserving maps into lower-cost storage strata. Forgetting is a designed deformation, bounded and logged.

---

## §6 — Chart V: The Trust Field and Gates as Topology *(B4, B6, O7, H2)*

**The trust field.** Every candidate carries a calibrated scalar

$$\tau(\text{source}, \text{content}, \text{context}, \text{history}) \;\in\; [0,1]$$

composed of source-tier ceilings, per-source reputation, calibrated judge scores (digest-pinned, isotonic), and corroboration. Calibration artifacts are versioned and hash-pinned; mismatch fails closed.

**Gates are literally topological operators.** Each boundary carries a gate, and each gate is one of:

- an **interior operator** ($g(x)\le x$, contractive — *fail-closed*: on fault, refuse), or
- a **closure operator** ($x\le g(x)$, extensive — *fail-open*: on fault, admit-and-mark),

with an explicit **orientation bit** per boundary. Asymmetry between ingress and egress is a declared field value, not a code branch. Gates compose by meet; a gate committee is a weighted meet; abstention routes to clarification rather than silent loss.

**Admission is a level-set policy.** Rather than a binary snap:

| Band | Policy |
|---|---|
| $\tau \ge \theta_{\text{commit}}$ | commit (with provenance stamp) |
| $\theta_{\text{review}} \le \tau < \theta_{\text{commit}}$ | provisional commit with decay, or human/peer review |
| $\tau < \theta_{\text{review}}$ | reject (ingress) / veto (egress) — always as a typed event |

Thresholds are budget-coupled: deep judgment is consumed only when the judgment budget affords it; otherwise the gate deformation-retracts to the symbolic baseline (§10).

**Proposer/judge separation (O7).** Proposers — language models, reflexes, peers, neural heads — are maps *into* the candidate space. They are untrusted by type. Judges — symbolic verification, calibrated manifolds, simulation, proof checkers — are maps *from* candidates to verdicts. The composite `propose ⊣ admit` adjunction is the single neuro-symbolic boundary; tightening or loosening it is a continuous parameter of the trust field, never a rewiring.

---

## §7 — Chart VI: The Governance Filtration and Reflexivity *(O6, C1, H4, H10)*

**Filtration.** Authority is a nested sequence of subcomplexes

$$\mathcal{G}_0 \;\subset\; \mathcal{G}_1 \;\subset\; \mathcal{G}_2 \;\subset\; \mathcal{G}_3 \;\subset\; \mathcal{G}_4$$

| Stratum | Authority |
|---|---|
| $\mathcal{G}_0$ | observe, telemetry |
| $\mathcal{G}_1$ | propose (no state effect) |
| $\mathcal{G}_2$ | sandbox execution, shadow commit |
| $\mathcal{G}_3$ | low-risk auto-merge under proof + policy |
| $\mathcal{G}_4$ | production/irreversible — external, immutable approver only |

**The No-Retraction Law (H4, topological form).** A modification whose target lies in stratum $\mathcal{G}_k$ must be approved from stratum $\mathcal{G}_{k'}$ with $k' > k$, or by an external arbiter. In particular, no stratum admits a retraction onto itself: **self-approval is a forbidden fixed point.** The system may propose any change to itself — including changes to its control complex (§2), its budget policy (§5), or its thresholds (§6) — but the approval map always lands strictly above the proposal's origin.

**Reflexivity as a governed section.** The meta-controller is itself a bounded reasoner inhabiting $\mathcal{G}_1$: it reasons about traces, starvation events, contradiction rates, veto frequencies, and yield, and emits **deformation proposals** — edits to $\mathcal{C}$, $\mu$-allocations, threshold moves. Propose, never apply. Hot-swap occurs only at cycle boundaries with in-flight counters carried across; reconfiguration is a homotopy, not a tear.

**Irreversibility (H10).** Actions are typed by reversibility class (informational → reversible-local → reversible-external → hard-to-reverse → irreversible → forbidden). The required commit path is a monotone function of $(\tau, \text{risk}, \text{reversibility}, \text{blast radius}, \text{proof status})$: the policy surface in §8. No path reaches an irreversible effect without crossing the corresponding authorization cell.

---

## §8 — The Transaction: One Commit Surface *(B3, O8, A2, H2, H3)*

**All cognition is the same kind of thing.** Perception, inference, proposal, judgment, learning, action, consolidation, forgetting, self-modification — each is a **cognitive transaction**:

```
CognitiveTransaction {
  id, correlationId, kind
  inputs        : typed cognitive objects
  outputs       : candidates
  effects       : declared read/write set
  reservation   : sub-measure of μ (settled on completion)
  trust         : τ-profile (source, calibration, corroboration)
  risk          : { risk, reversibility, blastRadius }
  epistemicType : Belief | Goal | Question | Hypothesis | Assumption
                | Plan | Obligation | ActionIntent | Lesson
  proofObligations : [schema | derivation-proof | judge-score | simulation]
  failure       : explicit policy (fail-closed | fail-open | abstain | degrade)
}
```

**The epistemic type system** enforces, at admission:

$$\text{Reward} \nrightarrow \text{BeliefTruth},\qquad \text{Desire} \nrightarrow \text{Fact},\qquad \text{GoalFailure} \nrightarrow \text{FalseBelief}$$

**The Spine $\Lambda$.** There is exactly one commit surface: a totally ordered 1-complex (append-only ledger). Every transaction that mutates durable state traverses the same normalized path:

$$\text{normalize} \to \text{type-check} \to \text{independence-check} \to \text{verify} \;\{\text{proof},\,\text{judge},\,\text{simulation}\}\; \to \text{rank} \to \text{settle budget} \to \text{risk-classify} \to \text{commit} \lor \text{reject}$$

The policy surface deciding commit-path:

| Trust | Risk | Reversibility | Path |
|---|---|---|---|
| high | low | high | auto-commit |
| high | medium | high | shadow-commit, promote on trace evidence |
| medium | low | high | provisional commit with decay |
| medium | medium | medium | review |
| any | high | low | proof or $\mathcal{G}_4$ approval required |
| low | high | any | reject |

State at time $t$ is the fold $\mathcal{S}(t) = \text{fold}(\Lambda_{\le t})$. Snapshots are caches; the spine is truth.

---

## §9 — The Ten Laws *(H1–H10 as named invariants)*

| # | Law | Formal statement |
|---|---|---|
| **L1 Firewall** | Reward fields are tangent to $\mathcal{S}_T \times \mathcal{S}_P$ only | $d\pi_E(R) = 0$ |
| **L2 Admission** | Image of every untrusted boundary map lies inside the $\tau$-judged region | no unjudged entry into durable state |
| **L3 Witness** | Every mutation edge of $\Lambda$ carries an event cell | no edge without a witness 2-cell |
| **L4 No-Retraction** | Approval lands strictly above the proposal's stratum | no fixed points of self-approval |
| **L5 Finitude** | $\mu(\mathcal{C}) < \infty$; every path has finite measure | no unbounded reasoning path |
| **L6 Control Visibility** | Every scheduling/admission/branch decision is an event cell | no opaque control |
| **L7 Verifier Separation** | The verifier reconstructs lifts in a disjoint trivialization | no shared unsafe dependency |
| **L8 Substrate Isolation** | Cross-substrate maps are pullbacks/proposals only | no quotient by uncertain similarity |
| **L9 Failure Visibility** | Every fault affecting cognition, budget, or admission is a typed event | no silent swallow |
| **L10 Irreversibility Gate** | Irreversible effects factor through risk classification and $\mathcal{G}_{\ge 3}$ authorization | no ungoverned irreversibility |

These are **space-level predicates**, not code conventions: a configuration that violates any of them is not a point in the design space.

---

## §10 — Degradation as Deformation Retraction *(C3, D4, H9)*

Fault tolerance is stated geometrically. The full control complex $\mathcal{C}$ admits a **strong deformation retraction** onto a kernel subcomplex $\mathcal{C}_{\text{core}}$ consisting of: symbolic inference, budget accounting, admission gates, the spine, and the event sheaf.

| Fault | Retraction |
|---|---|
| judgment model unavailable | $\tau$ retracts to symbolic baseline; thresholds recomputed; typed event emitted |
| proposer outage | proposer cells become no-op nodes; guards reroute; cognition continues |
| budget pressure | support of scheduler contracts to high-$\rho$ regions (§5) |
| memory pressure | consolidation/archive maps activate; eviction is measure-preserving and logged |
| tool/actuator fault | action cells degrade to simulation-only; irreversible paths close |
| contradiction | no explosion: conflicting sections coexist with distinct truth coordinates; repair is a scheduled transaction kind |

Every retraction is continuous (no torn trajectories — in-flight work checkpoints at cell boundaries), visible (every retraction is an event), and reversible (recovery is deformation back, with state carried).

---

## §11 — Typed Surfaces (Ports) *(D5)*

Everything replaceable is a port; nothing behind a port is load-bearing by identity:

| Port family | Contract |
|---|---|
| `Memory` | concept/episodic/procedural stores behind nine capability interfaces; any conforming backend is valid |
| `Proposer` | $\text{Context} \to \text{Candidate}^*$ with trust annotation; untrusted by type |
| `Judge` | $\text{Candidate} \to \text{Verdict} \times \tau$; digest-pinned; fail-closed on mismatch |
| `BudgetOffice` | reserve / settle / price / deny (denials are events) |
| `Gate` | interior or closure operator + orientation bit |
| `CommitLedger` | the spine: fold, append, checkpoint, replay |
| `Governance` | stratum resolution, approval routing, risk classification |
| `Verifier` | independent path-lifting over transcribed transition laws |
| `Scheduler` | enabled-set → next transaction, subject to L5/L6; may be fixed, economic, or learned — the port doesn't care, the sheaf records |

The learned scheduler is thus **one point in a port's value space**, not a different architecture — and L6 guarantees its choices remain inspectable regardless of which implementation occupies the port.

---

## §12 — Construction Order *(incremental, self-contained)*

Each phase yields a complete, lawful system; each adds one chart.

| Phase | Adds | Law coverage |
|---|---|---|
| **P0 — Kernel** | Spine $\Lambda$, event sheaf $\mathscr{S}$, budget measure $\mu$ (static ceilings), epistemic types, single commit path | L1, L3, L5, L9 |
| **P1 — Control complex** | $\mathcal{C}$ as data; guards; static invariants C-I…C-IV; path-lifting replay | + L6 |
| **P2 — Trust field** | $\tau$, oriented gates, level-set admission, judge port, calibration pinning | + L2 |
| **P3 — Independence** | Disjoint verifier trivialization; transcribed transition laws; drift pinning | + L7 |
| **P4 — Economy** | Reservations → prices → support-contraction backpressure; starvation as typed events | L5 strengthened |
| **P5 — Substrate charts** | Exact/probabilistic/neural charts with pullback-only crossings | + L8 |
| **P6 — Governance filtration** | Strata, no-retraction approval, reversibility classes, policy surface | + L4, L10 |
| **P7 — Reflexivity** | Meta-controller at $\mathcal{G}_1$; deformation proposals; hot-swap at boundaries | L4 preserved under adaptation |

No phase requires a later one; every later phase preserves all earlier laws.

---

## §13 — The Point This Defines

$$\boxed{\;\mathfrak{M} \;=\; \text{governed controller transforming observations into justified commitments over a finite resource measure, on a stratified, event-sheaved, firewalled space.}\;}$

Its character in one line per objective:

- **Epistemic integrity** is a tangent constraint on the dynamics, not a rule.
- **Provenance** is a separated sheaf: agreeing everywhere implies being identical.
- **Control** is a deformable complex: programs are paths, changes are homotopies.
- **Resources** are a finite measure with prices: scarcity is geometry, exhaustion is a typed event.
- **Trust** is a calibrated field with genuinely topological gates.
- **Commitment** is one ordered spine: every mutation, of any kind, by any proposer, crosses the same surface.
- **Reflexivity** ascends a filtration and can never approve itself.
- **Degradation** is retraction onto a kernel that never stops committing justified work.

This is the ultimate hybrid: maximal unification (one transaction class, one commit surface, one budget calculus, one governance vocabulary, one provenance sheaf) with maximal constraint (ten space-level laws), within which adaptivity — economic scheduling, learned control, governed self-modification — is not merely permitted but is the intended direction of travel, because every step of it lands inside the topology rather than outside it.
