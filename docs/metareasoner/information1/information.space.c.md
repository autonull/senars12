# DSR — Design Space of Reasoners
### Technical Reference v0.1 · s\* = SeNARS coordinate

---

## §0 Formal Model

```
D  = ∏ᵢ Aᵢ                      design space (20 axes, 5 clusters)
r  = ⟨K, I, C, L, G⟩ ∈ D        a reasoner is a point (spec literal, §10)
Φ  ⊆ D                          feasibility predicate (§3); D⁺ = {r : Φ(r)}
s* ∈ D⁺                         SeNARS (§4)
δ  : D ⇀ D                      movement operators between points (§8)
πₖ : D → [0,1]                  scalar projections (§7)
```

**Notation** — `⊥` incompatible · `⇒` requires/entails · `◊` bounded resource · `∅` unoccupied region · `~` approx · code cells are axis values from §1.

**Scale claims are ordinal.** Metric values (§7) are normalized rank projections, not measurements.

---

## §1 Axis Registry

### Cluster K — Knowledge & Representation

| ID | Axis | Type | Values (ordinal →) |
|----|------|------|--------------------|
| K1 | Substrate | ordinal | `SY` symbolic-discrete · `SB` subsymbolic-continuous · `HY` hybrid-compositional |
| K2 | Language expressivity | ordinal | `NL` natural-language-only · `P` propositional · `F` first-order term algebra · `H` higher-order · `D` dependent types. Flags: `+T` temporal ops, `+O` operation/action terms |
| K3 | World stance | ordinal | `CW` closed-world · `OR` open-world-revisable · `AK` open-world-insufficient (AIKR) |
| K4 | Uncertainty calculus | lattice | `0` none · `B` binary · `P` scalar probability · `E` two-dimensional evidence (f,c)/(d,c) · `I` interval/imprecise |
| K5 | Consistency policy | ordinal | `X` explosive · `R` revision-based · `A` paraconsistent retention |

### Cluster I — Inference

| ID | Axis | Type | Values |
|----|------|------|--------|
| I1 | Rule spectrum | ordinal | `–` none · `S` structural only · `D` deductive · `DI` deduction+induction · `T` full triad (+abduction/analogy/resemblance) |
| I2 | Control direction | nominal | `F` forward · `B` backward · `Bi` bidirectional/task-mediated |
| I3 | Exact-computation substrate | nominal | `–` none · `E` embedded rewrite · `O` external gated oracle · `U` unified calculus |
| I4 | Termination regime | nominal | `C` complete search · `Bd` bounded · `A` anytime/interruptible · `In` interactive |

### Cluster C — Control & Resources

| ID | Axis | Type | Values |
|----|------|------|--------|
| C1 | Resource posture | ordinal | `O` logical-omniscience · `L` time-limited · `B` budget-accounted · `K` AIKR (budget+attention+memory all bounded ◊) |
| C2 | Scheduler | ordinal | `F` FIFO · `P` priority queue · `E` economic (bag+decay+prob. sampling) · `L` learned policy |
| C3 | Forgetting | ordinal | `–` none · `e` eviction (LRU) · `d` decay · `ℓ` full lifecycle (decay + consolidation + archive/forget) |

### Cluster L — Learning & Adaptation

| ID | Axis | Type | Values |
|----|------|------|--------|
| L1 | Learning locus | ordinal | `–` none · `p` parameters only · `s` structure only · `b` both · `m` both + governed self-modification |
| L2 | Reward routing | ordinal | `U` unified signal · `S` domain-split · `F` split + epistemic firewall |
| L3 | Belief/goal separation | ordinal | `C` conflated · `P` prompt/convention-level · `H` hard type-level firewall. `h*` = vacuous (no goal channel) |

### Cluster A — Trust, Provenance, Governance

| ID | Axis | Type | Values |
|----|------|------|--------|
| A1 | Trust architecture | ordinal | `M` trusted monolith · `K` verified kernel + untrusted proposers · `E` mutually-verified ensemble |
| A2 | Provenance | ordinal | `–` none · `l` logs · `e` event-sourced replayable · `v` event-sourced + independently-verifiable derivations |
| A3 | Governance | ordinal | `F` fixed tool · `L` graded autonomy ladder · `X` ladder + external immutable governor |
| A4 | Embodiment | ordinal | `Q` query-only · `T` tool-using · `G` closed-loop agent · `G+I` agent + internal simulation (imagination) |
| A5 | Composition | nominal | `M` monolith · `P` kernel + ports · `A` + multi-agent delegation |

---

## §2 Coordinate Form

```
r = ( K1 K2 K3 K4 K5 | I1 I2 I3 I4 | C1 C2 C3 | L1 L2 L3 | A1 A2 A3 A4 A5 )
```

---

## §3 Feasibility Predicate Φ

Hard constraints. Violation ⇒ the point is unstable, not merely suboptimal.

| # | Constraint | Consequence if violated | s\* enforcement |
|---|------------|-------------------------|-----------------|
| Φ1 | K3=`AK` ⇒ K4 ≥ `E` | revision under insufficient evidence is undefined | NAL (f,c) truth algebra |
| Φ2 | K5=`X` ∧ contradictions resident in memory | ex falso trivialization | Benchmark-4 paraconsistent retention; distinct truth values coexist |
| Φ3 | A1=`K` ⇒ A2 ≥ `e` | proposer privilege escalation unauditable | 4 gates → append-only `CognitiveEvent` log |
| Φ4 | L2=`U` ∧ L3=`C` ∧ adversarial reward | belief corruption (sycophancy, reward hacking) | `RewardGate` firewall; `EpistemicFirewallViolation` on any `Truth.f/c` mutation |
| Φ5 | K2 ≥ `H` ∧ I4=`C` | undecidability; search divergence | fragments (MeTTa step cap `10000`), bounded depth, lineage caps |
| Φ6 | C1 ≤ `B` ∧ C3=`–` | memory exhaustion | `Bag<T>` capacity + LRU + pressure consolidation |
| Φ7 | L1=`m` ⇒ A3=`X` | self-approval is unsound (Löbian) | shadow worktree + CI; agent ⊥ own sandbox/approval/reward config; external runner merges |
| Φ8 | I3=`O` ∧ K4≥`E` ⇒ memory isolation of substrates | equality contamination (e-graph unioned on similarity scores) | arbiter pattern; MeTTa via ActionGate only; `EngineResult` proposals |
| Φ9 | A2=`v` ⇒ verifier code ⊥ engine code | co-adaptation hides engine bugs behind verifier bugs | `core/verify-derivation` transcribed truth table; drift test pins divergence |
| Φ10 | I4=`A` ⇒ C2 ∈ {`E`,`L`} | FIFO cannot preempt; anytime guarantee broken | `AbortSignal` + wall-clock deadlines over bag sampling |
| Φ11 | K4=`0` ∧ ambiguous NL ingress ⇒ single confident parse | calibrated error (one wrong parse ≠ uncertainty) | multi-candidate `FormalizationBatch` + abstain → clarification |
| Φ12 | A2=`v` ⇒ replay determinism | audit trail non-reproducible | pure reducers `replayCognitiveState`; state-hash verify |

**Coupling pairs** (axes not independent): `K2×I1`, `K4×K5`, `C1×C3` (Φ6), `A1×A2` (Φ3), `L1×A3` (Φ7), `L2×L3`, `I3×K4` (Φ8), `I4×C2` (Φ10). All other pairs: free.

---

## §4 s\* — SeNARS Coordinate

```
s* = ( HY  F(+T+O, D@oracle)  AK  E  A |
       T   Bi  O  A |
       K   E+L ℓ |
       m   F   H |
       K   v   X  G+I  P+A )
```

| Axis | s\* value | Grounding |
|------|-----------|-----------|
| K1 | `HY` | LLM/heads propose; NAL decides |
| K2 | `F` + temporal/operation terms; `D` reachable only through gated MeTTa | Narsese grammar; Π/Σ types in oracle |
| K3 | `AK` | AIKR = founding assumption |
| K4 | `E` | `Truth{f,c}` beliefs, `Desire{d,c}` goals |
| K5 | `A` | contradiction resilience (Bench 4) |
| I1 | `T` | 44 rule declarations / 20 kind-pair cells |
| I2 | `Bi` | task-mediated; question-driven `ask` |
| I3 | `O` | MeTTa = ActionGate tool, never parallel engine |
| I4 | `A` | `AnytimeDerivation`, cooperative yielding |
| C1 | `K` | `BUDGET_RESOURCES`, 4 dimensions, one arithmetic |
| C2 | `E+L` | `Bag<T>` + `FocusBag` economy + `SchedulerAdapter` |
| C3 | `ℓ` | decoupled decay, episodic archive/forgetting, consolidation |
| L1 | `m` | parameters (RL/reflex) + structure (schema induction) + governed patches |
| L2 | `F` | 5 reward domains; `self-*` ⇒ proposals only |
| L3 | `H` | `BeliefTruth` vs `Desire`, one `CognitiveAxis` type |
| A1 | `K` | all proposers untrusted; 4 gates |
| A2 | `v` | event sourcing + standalone verifier |
| A3 | `X` | 5-mode ladder; external CI/CD required for production |
| A4 | `G+I` | arcade/games/tools + treadmill/scenarios |
| A5 | `P+A` | 9 memory ports, `DecisionPort`, `TextGenerator`; peer delegation |

---

## §5 Occupied Points — Catalog

Codes from §1. `h*` = vacuous firewall (no goal channel). I4 omitted: ATP=`C`(practically `Bd`), Lean=`In`, Z3=`C`(fragment), PP=`C`/approx.

| System | K1 | K2 | K4 | K5 | I1 | C1 | C3 | L1 | L3 | A1 | A2 | A3 |
|--------|----|----|----|----|----|----|----|----|----|----|----|----|
| Classical ATP (Vampire/E) | SY | F | 0 | X | DI | L | – | – | h* | M | e | F |
| SMT (Z3) | SY | F | 0 | X | S | L | – | – | h* | M | l | F |
| Proof assistant (Lean 4) | SY | D | 0 | X | S | O | – | – | h* | K | v | F |
| Cyc | SY | F/H | 0 | R | D | O | – | – | h* | M | l | F |
| Production rules (CLIPS/Drools) | SY | P | 0 | X | S | O | – | – | h* | M | l | F |
| Soar | SY | F | 0 | X | DI | L | d | s | C | M | l | F |
| ACT-R | HY | F | 0 | X | DI | O | d | b | C | M | l | F |
| NARS (original) | SY | F | E | R | T | K | d | b | H | M | l | F |
| OpenCog / Hyperon | HY | F/H | P | R | DI | B | e | b | C | M | l | F |
| Probabilistic programming (Stan) | SB | P | P | X | S | O | – | – | h* | M | l | F |
| RL agent (AlphaZero-class) | SB | P | 0 | X | S | B | – | p | C | M | – | F |
| Frozen LLM | SB | NL | 0 | X | – | L | e | – | C | M | l | F |
| LLM agent (ReAct/CoALA-class) | SB | NL | 0 | X | – | L | e | p | C | M | l | L* |
| **SeNARS (s\*)** | **HY** | **F(D@O)** | **E** | **A** | **T** | **K** | **ℓ** | **m** | **H** | **K** | **v** | **X** |

`L*` = informal/ad-hoc ladder, no formal risk classification.

**Density note.** Deployed mass concentrates at `(SB, NL, 0, C, M)` — LLM region. Classical symbolic mass at `(SY, F, 0, –, M, O)`. The neighborhood `{K4≥E, L3=H, A1=K, C1=K}` is sparsely occupied: nearest named point is original NARS (missing `A1=K`, `A2=v`, `A3=X`, `L1=m`).

---

## §6 Region Maps

### 6.1 Trust architecture × Resource posture

```
A1 │
 E ensemble-verified      ·                                    ∅
 K kernel+proposers       ·      Lean▲                ★s*
 M monolith / verified-   ·  ATP▲  Z3▲                         ·
   output only            · Cyc▲ CLIPS▲ Soar▲ ACT-R▲           ·
                          ·            NARS▲ OpenCog▲          · LLM▲ LLM-agent▲ AZ▲
                          └────────────────────────────────────────
                            O omniscient   L limited   B budget   K AIKR      → C1
```

### 6.2 Learning depth × Uncertainty calculus

```
L1 │
 m self-mod               ·                              ★s*
 b param+struct           ·     OpenCog▲  NARS▲                ∅
 s structural             ·     Soar▲                          ·
 p parametric             · AZ▲  ACT-R▲                        ·
 – none                   · Z3▲ ATP▲ Lean▲ Cyc▲ CLIPS▲ PP▲ LLM▲ · LLM-agent▲
                          └────────────────────────────────────────
                            0 none        P scalar-P       E (f,c)        → K4
```

### 6.3 Belief/goal × Reward routing (epistemic-corruption plane)

```
L3 │
 H hard firewall          ·  ATP▲ Lean▲(h*)            ★s*
 P prompt-level           ·                                    ∅
 C conflated              · Soar▲ ACT-R▲ OpenCog▲ AZ▲  LLM▲ LLM-agent▲
                          └────────────────────────────────────────
                            U unified          S split       F split+firewall → L2
```

Φ4 region `(U, C)` under adversarial reward = corruption zone; contains most deployed LLM agents.

---

## §7 Scalar Projections

```
E (epistemic integrity) = .25·K4 + .20·K5 + .20·L2 + .20·L3 + .15·A2
R (resource realism)    = mean(C1, C2, C3, I4ₙ)          I4ₙ: C=.3 Bd=.5 A=1 In=.2
U (auditability)        = .50·A2 + .25·replay + .25·export-granularity
G (governed autonomy)   = mean(A3, A4, A1)
P (adaptive range)      = .60·L1 + .40·I1
```
All axis terms normalized to [0,1] by ordinal rank. `h*` scores as `H` (vacuously: no reward channel exists to corrupt).

| System | E | R | U | G | P |
|--------|-----|-----|-----|-----|-----|
| **SeNARS** | **.95** | **1.00** | **1.00** | **1.00** | **1.00** |
| NARS | .48 | .83 | .30 | .33 | .85 |
| OpenCog | .42 | .60 | .25 | .40 | .75 |
| Soar | .20 | .50 | .20 | .33 | .50 |
| ACT-R | .20 | .40 | .20 | .33 | .45 |
| Lean 4 | .35 | .10 | .95 | .17 | .10 |
| ATP | .35 | .33 | .85 | .10 | .15 |
| AlphaZero | .10 | .50 | .10 | .22 | .15 |
| LLM agent | .05 | .30 | .15 | .30 | .25 |
| Frozen LLM | .05 | .25 | .10 | .20 | .05 |

```
E ▁▂▃▄▅▆▇█  per system (×8):
SeNARS     ████████  .95        Lean       ███▌      .35
NARS       ████      .48        ATP        ███▌      .35
OpenCog    ███▌      .42        AlphaZero  █         .10
LLM-agent  ▌         .05
```

Projection caveats:
- E rewards *structure*, not measured calibration; an untested firewall still scores.
- R penalizes interactive systems (Lean) by construction — human attention is an unmodeled external budget.
- U assumes verifiability requires code independence (Φ9); checked proofs with co-developed checkers score `e`, not `v`.

---

## §8 Movement Operators

Transitions in D. Columns: precondition, failure mode if skipped, s\* mechanism realizing δ.

| δ | Transition | Requires | Skipped ⇒ | s\* instance |
|---|-----------|----------|-----------|--------------|
| δ_es | A2: `l→e` | total-ordered events + pure reducers | replay divergence | JSONL/SQLite log; `replayCognitiveState` |
| δ_vk | A1: `M→K` | schemas at every untrusted boundary | proposer privilege escalation | Zod gates; `ModelRule`/`TextGenerator`/`EmbeddingRuntime` ports |
| δ_fw | L3: `C→H` | one axis type across all boundaries (`CognitiveAxis`) | reward hacking, sycophancy | `Truth`/`Desire` split; RewardGate |
| δ_ak | C1: `L→K` | bounded containers + single budget table | OOM / hang under load | `Bag<T>`; `BUDGET_RESOURCES` |
| δ_fg | C3: `e→ℓ` | truth-decay ⊥ attention-decay separation | stale beliefs persist or valid beliefs evaporate | decoupled decay; consolidation lifecycle |
| δ_sv | A2: `e→v` | verifier ⊥ engine imports (Φ9) | drift accumulation | transcribed table + drift test + CLI checker |
| δ_gv | A3: `L→X` | shadow CI + risk classifier + immutable external merger | self-approval | `PatchRiskClassifier`; external runner mandate |
| δ_s1 | add subsymbolic proposer | digest pinning + calibration lock | uncalibrated scores enter state | `HEAD_SPECS`; `ModelDigest`; isotonic calibrators |
| δ_or | I3: `–→O` | gate + memory isolation (Φ8) | equality contamination | MeTTa arbiter pattern |
| δ_an | I4: `Bd→A` | preemptive scheduler (Φ10) + partial-result semantics | lost work on interrupt | `AnytimeDerivation`; `AbortSignal` |
| δ_sm | L1: `b→m` | δ_gv ∘ δ_sv ∘ δ_es (composition mandatory) | unsafe self-modification | shadow worktree + governance pipeline |

Operator dependencies: `δ_sm` ⇒ {`δ_gv`, `δ_sv`, `δ_es`, `δ_fw`}. `δ_s1` ⇒ calibration before scores act (unfitted heads pass through, never decide).

---

## §9 Tangent Space at s\* (internal degrees of freedom)

Local axes where s\* is a *choice among implemented alternatives*, not a forced point. Current pick → visible alternatives.

| Axis | s\* now | Alternatives |
|------|---------|--------------|
| DecisionPort call sites | 2 (`admission-order`, `egress-veto`) | 5 of 7 candidate stages unclaimed |
| Refusal policy | ingress-only; derived tasks always admitted | egress refusal (declared unreachable branch) |
| MeTTa status | gated tool | registered engine; per-head WASM runtimes |
| Budget topology | 4 dims, per-focus scopes | per-thread budgets; `UNBUDGETED` escape |
| Consolidation | single pressure-gated pass | tiered working→semantic→schema |
| Memory backend | default `Memory` over 9 ports | array-backed storeless (test-proven) |
| Governance form | in-repo prototype + external CI | policy-as-data; multi-signer |
| Ambient LM | `device` profile: zero LM | WebLLM / embedded llama.cpp |
| Cross-agent | request/response delegation | shared manifold digest; collective calibration |
| Failure polarity | gates fail-closed, decisions fail-soft | inverted split for boundary decisions |
| Temporal policy | decay + LRU + lineage caps | archival tiers; explicit forgetting policies |

---

## §10 Instantiation Grammar

```
ReasonerSpec ::= {
  K: { substrate, language, world, calculus, consistency }
  I: { spectrum, direction, exact, termination }
  C: { resources, scheduler, forgetting }
  L: { locus, reward, beliefGoal }
  A: { trust, provenance, governance, embodiment, composition }
}
```

```
s*(SeNARS) = { K:{HY, F+T+O(D@oracle), AK, E, A},
               I:{T, Bi, O, A},
               C:{K, E+L, ℓ},
               L:{m, F, H},
               A:{K, v, X, G+I, P+A} }

llm-agent  = { K:{SB, NL, OR, 0, X},
               I:{–, –, –, Bd},
               C:{L, F, e},
               L:{p, U, C},          ← violates Φ4 under adversarial reward
               A:{M, l, L*, G, M} }

lean4      = { K:{SY, D, CW, 0, X},
               I:{S, B, U, In},
               C:{O, –, –},           ← violates Φ6 only if unattended
               L:{–, –, h*},
               A:{K, v, F, Q, M} }

nars-orig  = { K:{SY, F, AK, E, R},
               I:{T, Bi, –, A},
               C:{K, E, d},
               L:{b, U, H},
               A:{M, l, F, G, M} }
```

---

## §11 Pareto Fronts

| Front | Axes | Trade | s\* position |
|-------|------|-------|--------------|
| expressivity vs decidability | K2 ↑ ⇒ I1 fragments or heuristics | Lean: `D` + human direction; ATP: `F` + incomplete search | `F` core; `D` quarantined in oracle (Φ5) |
| auditability vs throughput | A2 ↑ ⇒ per-step cost ↑ | proof logging taxed per derivation | recorder bounded 200×200, opt-in; ranking pressure valve |
| calibration vs coverage | abstain ↑ ⇒ coverage ↓ | System One abstain thresholds | abstain → clarification question + curiosity drive |
| forgetting vs stability | C3 ↑ ⇒ belief churn | naive decay destroys valid truth | truth decay ⊥ attention decay (δ_fg) |
| autonomy vs containment | A3 ↑ requires A1↑ ∧ A2↑ | unmonitored ladder = Φ3/Φ7 violation | ladder bound to gates + external governor |
| proposer diversity vs gate load | more S1 sources ⇒ verification cost | 19 LM rules + heads + peers | batched judge per embedding; circuit breakers; shadow-drop |

---

## §12 Open Regions (∅)

| Region | Coordinates | Blocker |
|--------|-------------|---------|
| Dependent types + AIKR + self-mod | `(D, K, m)` | Lean lacks C/L clusters; s\* reaches `D` only via oracle |
| Paraconsistent equality saturation | `(A) × e-graph` | no defined union semantics under conflicting truth values |
| Derivation-level proof for learned heads | A2=`v` over neural weights | digest pinning verifies identity, not behavior; calibration is statistical |
| Ensemble trust | A1=`E` | peer delegation exists; no mutual verification protocol (only `PEER_AGENT` ceiling + shadow validation) |
| Collective calibration | cross-agent isotonic fit | shared manifold digests listed as open axis, unimplemented |
| Continuous-time revision | K4=`E` under streaming backpressure | batch-cycle semantics current |
| Cross-agent provenance fusion | event-log merge with independence accounting | replay hashes are per-process |

---

## §13 Model Status

| Item | Status |
|------|--------|
| Axis count | 20 (5 clusters) |
| Constraints | 12 (Φ1–Φ12) |
| Catalogued points | 14 |
| Metrics | 5 ordinal projections |
| Movement operators | 11, 1 dependency chain (`δ_sm`) |
| Falsification of metric weights | none — weights are stipulated; bind to benches before production use |
| Known bias | R and G penalize human-in-loop systems; E cannot measure an unexercised firewall |
