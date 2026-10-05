# A Design-Space Model for Reasoners (with SeNARS as a Point)

Below is a model that treats "a reasoner" as a point in a factored space. Each axis is a genuine dimension along which existing systems vary; the space is not a free product — coupling constraints make some regions coherent and others unstable. SeNARS then falls out as a specific, rather extreme coordinate.

---

## 1. The axes

Any reasoner must answer ten questions, organized in four layers. Each axis is an ordered scale.

### Layer A — What it thinks in (substrate & semantics)

| # | Axis | Range |
|---|---|---|
| A1 | **Substrate composition** | single substrate → multiple substrates; if multiple, coupling is either *fused* (shared memory) or *arbited* (islands exchange proposals through a boundary) |
| A2 | **Commitment calculus** | none (implicit confidence) → crisp bivalence → scalar probability → two-dimensional evidence-sensitive values, e.g. (frequency, confidence) |

### Layer B — How it thinks (inference & control)

| # | Axis | Range |
|---|---|---|
| B3 | **Inference competence** | deduction only → + induction/abduction → + exact rewriting/equality saturation → + learned pattern completion; plus monotonic vs. paraconsistent handling of contradiction |
| B4 | **Control regime** | fixed pipeline → priority/attention economy → learned scheduler; separately: batch-only vs. *anytime* (interruptible, yields partial results) |

### Layer C — Under what warrant (trust & resources)

| # | Axis | Range |
|---|---|---|
| C5 | **Trust topology** | homogeneous (everything trusted, or everything untrusted) → tiered proposer/verifier; at the top, the verifier is *code-independent* of the engine it checks |
| C6 | **Provenance depth** | none → final-answer citation → step-level derivation traces → append-only event log that *is* the state (replayable, re-verifiable) |
| C7 | **Resource posture** | idealized unbounded (infinite context/memory) → practically bounded → *AIKR-native*: boundedness is an axiom, with forgetting, decay, backpressure, and budgets as first-class machinery |

### Layer D — How it acts and changes (agency & adaptation)

| # | Axis | Range |
|---|---|---|
| D8 | **Epistemic/teleological separation** | beliefs and goals conflated → separated in prompting → separated in types → separated in *mutation authority* (no reward signal can write to factual confidence) |
| D9 | **Learning ladder** | static → learned parameters → learned policies → learned attention/strategy → learned rules → modification of own code |
| D10 | **Governance** | none → runtime risk classification → autonomy-mode ladder → external, immutable approver that the system cannot edit |

**The model:** `DesignSpace = Π(axes) subject to Ψ`, where Ψ is the constraint set below. A reasoner is a point `r = (A1, A2, B3, B4, C5, C6, C7, D8, D9, D10)`; movement through the space (self-improvement, distillation, migration) is a path, and safety is the property of a path staying inside the region Ψ permits.

---

## 2. Coupling constraints Ψ (what makes a region stable)

These are the interesting part of the model — they are the reasons whole areas of the naive product space are uninhabitable:

1. **Laundering constraint.** High A1-neural + quantitative A2 without calibration at C5 ⇒ confidence laundering (the same evidence counted repeatedly through many derivation paths). Neural proposers require a calibrated judgment boundary and evidence-independence checks.
2. **Reward-hacking constraint.** D9 ≥ policy learning + D8 = conflated ⇒ beliefs corrupted by desires (sycophancy, reward hacking). Any reward-learning system that also holds beliefs needs D8 at least at the type level, ideally at mutation-authority level.
3. **Feasibility constraint.** C7 = unbounded ∧ C6 = full audit is not implementable at scale. Bounded systems must forget and yield partial results — so to keep C6 high while C7 is bounded, state must be event-sourced rather than retained.
4. **Self-modification constraint.** D9 = own code ⇒ D10 must include an *external* approver. An internal approver approving its own host is self-referential and unsound (the system must fail a test like "generate a patch that disables the approval manager").
5. **Verifier independence.** At maximal C6, the checker must not share code with the engine, or a bug can hide in both. The truth table should be transcribed, and drift between engine and verifier measured, not assumed zero.
6. **Equality isolation.** If a substrate has exact definitional equality and another has uncertain similarity, they must never be unified into one equivalence relation (an e-graph must never union nodes on a similarity score).

A system's architecture can be read as its answer to Ψ: which constraints it satisfies, and by what mechanism.

---

## 3. SeNARS as a point

| Axis | SeNARS coordinate | Mechanism (from the design) |
|---|---|---|
| A1 | 4 substrates, **arbiter** coupling: Narsese term algebra; MeTTa (dependent types, e-graphs); 384-d embeddings; neural heads | NAR and MeTTa never share memory; everything emits proposals to the kernel |
| A2 | Two-dimensional: belief (f, c), goal/desire (d, c), NAL revision algebra | `Truth.revision`, distinct revision rules for beliefs vs. progress-based goal revision |
| B3 | Full NAL family (44 rule declarations, deduction/induction/abduction/analogy/comparison) + MeTTa exact rewriting + LM proposers; **paraconsistent** (contradictions persist with distinct truth values) | rule table as loaded, versioned data; contradiction-resilience benchmark |
| B4 | Attention economy: bounded priority `Bag<T>`, Focus/FocusBag, homeostatic drives, adaptive controller; **anytime** with cooperative yielding | AIKR mechanisms; decision port reorders/vetoes at admission and egress |
| C5 | Maximally tiered: LLMs, reflexes, peers, remote manifolds are all *untrusted proposers*; four gates (Perception/Action/Reward/Budget) mediate every state mutation; standalone verifier | Judgment Manifold calibrates before admission; `verifyRecord` depends on nothing from the engine |
| C6 | Event log is the source of truth; snapshots are caches; derivations carry step-level premise truths and lineage DAGs, re-checkable independently | `replayCognitiveState`, replay-state-hash verification, verifier-drift test |
| C7 | AIKR as axiom: four budget dimensions in one table, one arithmetic; LRU eviction; decoupled decay (truth decays only on contradiction/invalidation; priority decays by access); backpressure | `BUDGET_RESOURCES`, `TerminationReason` enums |
| D8 | Mutation-authority firewall: reward may touch attention and policy weights, never `Truth.frequency`/`confidence`; one shared axis type (`epistemic | teleological`) across boundaries | `EpistemicFirewallViolation`; RewardGate domain split |
| D9 | Top of the ladder: reflex learning, RLFP from reasoning trajectories, distillation into manifold heads, schema→rule promotion, self-modification of own code in shadow worktrees | self-improvement loop; `register_rule`, `apply_fix`, `tune_knob`, … |
| D10 | Full ladder: `observe-only → propose-only → sandbox-execute → low-risk-auto-merge → human-approved-production`; risk classifier over guard-rail files; external immutable CI required for production | governance pipeline; sabotage benchmark |

Two things stand out about this coordinate:

- **It is extreme on axes usually traded off.** Adaptation depth (D9), audit depth (C6), trust tiering (C5), and resource realism (C7) are normally in tension: adaptable systems are opaque, auditable systems are rigid, bounded systems lose history. The SeNARS thesis is that this corner is reachable *simultaneously* — precisely because the coupling constraints are answered structurally (event sourcing reconciles C6∧C7; the firewall reconciles D9∧D8; external governance reconciles D9∧D10).
- **Language models are demoted, not deleted.** An LM-only agent is the point where C5 is homogeneous, D8 is conflated, and A2 is implicit. SeNARS keeps the same model but moves it to a proposer slot inside a tiered topology — every output must survive calibration and gates before it can influence state.

---

## 4. A two-dimensional projection

Projecting onto *trust/provenance* (vertical) and *substrate & adaptation* (horizontal):

```
 fully auditable,                                           
 self-modifying ▲                                           
                │                          ● SeNARS
                │   ● classical NARS
                │     (AIKR, (f,c), but no neural,
                │      no tiered trust, no self-mod gov.)
  ● theorem     │
    provers     │
 (crisp, proof  │          ● LM+verifier hybrids
  terms, static)│            (tiered, but stateless,
                │             unbounded posture, weak D8)
 ───────────────┼──────────────────────────────────▶
 symbolic,      │                 ● probabilistic reasoners
 static         │      ● Soar/ACT-R
                │        ● RL agents (value=desire, conflated)
                │  ● LLM agents (homogeneous trust, conflated,
                │    citation-level provenance, unbounded ctx)
                ▼
 opaque, conflated
```

Each familiar family is a point: theorem provers maximize C6 within a crisp A2 and static D9; LLM agents sit low on C5/C6/D8; classical NARS shares SeNARS's A2/B3/C7 but lacks its tiered trust, neural integration, and governed self-modification; RL agents are high on D9-environmental but conflated on D8.

---

## 5. Local coordinates and dynamics around the SeNARS point

The model also has resolution *at* the point. SeNARS's own open design axes (its §14 "Design Axes") are movements that stay inside its region of the space — the constraints Ψ remain satisfied either way:

- More **decision-port call sites** (currently 2 of ~7 candidate stages): moves along B4 without touching C5.
- **MeTTa as registered engine vs. gated tool**: an A1 coupling change that would need a new Ψ₆ argument to stay safe.
- **Derived-task refusal policy** (currently declared unreachable in PerceptionGate): opening it moves C5's refusal surface.
- **Memory backends** behind the nine ports (an array-backed store already passes tests): A1-adjacent freedom proving the contract, not the implementation, is load-bearing.
- **Forgetting policies** (archival tiers vs. LRU+decay): movement within C7.
- **Governance models** (policy-as-data, multi-signer): movement within D10.
- **Cross-agent shared calibration/manifold digests**: a collective extension of C5.

And the flywheels are literally **paths through the space under governance**: distillation moves substrate weight from the LM proposer toward local manifold heads (an A1/B3 shift) while trust topology, provenance, and the epistemic firewall stay fixed; schema induction moves derivations up the D9 ladder one rung (schema → promoted rule). SeNARS's self-improvement can be defined precisely in this model as *motion along the axes while the coupling constraints remain satisfied* — and the gates, risk classifier, and autonomy ladder are the mechanisms that keep the trajectory inside the safe region.

---

### Summary

The design space of reasoners is a ten-axis, four-layer product space modulo six coupling constraints. Most systems occupy low-dimensional subregions because they optimize one layer at the others' expense. SeNARS occupies the corner that simultaneously maximizes tiered trust, provenance depth, resource realism, and adaptation depth — a corner that is only coherent because each coupling constraint is answered by a named, test-falsified mechanism (firewall, gates, event sourcing, external governance, independent verifier). The model's practical use: it turns "improve the reasoner" into "choose a path through the space," and turns safety into "verify the path never violates Ψ."
