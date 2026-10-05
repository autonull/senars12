# ℛ — Design Space of Reasoners
**Reference model.** ℛ is a product space of architectural dimensions; a reasoner is a point; SeNARS is one point `s° ∈ ℛ`, with a declared coordinate, a realized coordinate, and a wiring mask.

---

## §1 Formal definition

```text
Dims   = { A1..A6 } ∪ { B1..B5 } ∪ { C1..C6 } ∪ { D1..D5 } ∪ { E1..E5 } ∪ { F1..F5 } ∪ { G1..G5 }   (37 dims)
Dom(d) = finite domain per dimension (§2)
ℛ      = Π_d Dom(d)                                  — the full design space
r      ∈ ℛ                                           — a reasoner point
Φ(r)   = ⋀ Kᵢ(r)                                     — feasibility predicate (§5); Φ defines the legal region
ω      : Dims → {W,G,P,D,B,X}                        — wiring status (implemented systems only)
Σ      = (r°, r*, ω)                                 — an implemented system: declared point, realized point, wiring mask
Δ(Σ)   = { d : r*(d) ≠ r°(d) }                       — realization gap (§8)
δ(r,r′)= Σ_{d ∈ shared(r,r′)} w_d · [r(d) ≠ r′(d)]   — weighted Hamming; dims n/a for either system excluded (§10)
```

Notation: `◆` = SeNARS · `○` = comparison system · `⛔` = enforced by a red gate in CI · `W/G/P/D/B/X` = wired / gated / partial / dormant / bench-only / dead (per `flow.control.md` §0.2).

---

## §2 Dimension catalog

### A — Semantic substrate
| id | design question | Dom | ordered |
|---|---|---|---|
| A1 | where do inference rules come from? | `AXIOMATIC_CLOSED` · `NON_AXIOMATIC` · `CLOSED_WORLD` · `NONE` | no (trade axis, §6) |
| A2 | what carries truth? | `BOOL` · `PROB` · `FC_PAIR(f,c)` · `FUZZY` · `VECTOR` · `NONE` | no |
| A3 | is consequence monotonic? | `MONOTONIC` · `NON_MONOTONIC` | yes |
| A4 | what happens on contradiction? | `EXPLOSION` · `REJECTION` · `GRADED_COEXISTENCE` | yes (robustness) |
| A5 | term language reach | `PROP` · `FOL` · `HOL` · `HOL+TEMPORAL+PROCEDURAL` | yes |
| A6 | exact computation coupling | `NONE` · `EMBEDDED` · `TOOL_ISOLATED` | yes (boundary strength) |

### B — Epistemic structure
| id | design question | Dom | ordered |
|---|---|---|---|
| B1 | belief vs. goal separation | `FUSED` · `SOFT_PROMPT` · `HARD_TYPE` | yes |
| B2 | source grounding | `UNIFORM` · `TIERED` · `TIERED+LEARNED_REPUTATION` | yes |
| B3 | revision operator | `OVERWRITE` · `AGM` · `NAL_INDEPENDENCE` | yes |
| B4 | evidence accounting | `DOUBLE_COUNT` · `LINEAGE_TRACKED` | yes |
| B5 | behavior under failed query | `FABRICATE` · `ABSTAIN` | yes |

### C — Resource regime
| id | design question | Dom | ordered |
|---|---|---|---|
| C1 | resource postulate | `OMNISCIENT` · `AIKR` | yes |
| C2 | memory bound | `UNBOUNDED` · `BOUNDED_NO_FORGET` · `BOUNDED_FORGET` | yes |
| C3 | interruptibility | `BATCH` · `CHECKPOINT` · `ANYTIME_COOPERATIVE` | yes |
| C4 | attention allocation | `NONE` · `UNIFORM` · `PRIORITY_BAG` · `LEARNED` | yes |
| C5 | decay coupling | `NONE` · `COUPLED` · `DECOUPLED(truth≠attention)` | yes |
| C6 | budget accounting | `IMPLICIT` · `SINGLE_COUNTER` · `MULTI_DIM_TABLE` | yes |

### D — Control & trust
| id | design question | Dom | ordered |
|---|---|---|---|
| D1 | trust in proposers (LM, reflexes, peers) | `TRUSTED_DIRECT` · `GATED_UNTRUSTED` · `NO_PROPOSERS` | yes |
| D2 | mutation mediation coverage | `DIRECT` · `PARTIAL_GATE` · `FULL_GATE` | yes |
| D3 | strategy selection | `FIXED` · `PLUGGABLE` · `ADAPTIVE` · `LEARNED` | yes |
| D4 | metacognitive level | `OBJECT` · `OBJECT+META` · `META+SELF_MODEL` | yes |
| D5 | admission ranking | `NONE` · `HEURISTIC` · `CALIBRATED_SCORE` | yes |

### E — Provenance
| id | design question | Dom | ordered |
|---|---|---|---|
| E1 | state model | `STATELESS` · `MUTABLE_SNAPSHOT` · `EVENT_SOURCED(+SNAPSHOT)` | yes |
| E2 | replay | `NONE` · `CHECKPOINT_RESUME` · `DETERMINISTIC_VERIFIED` | yes |
| E3 | derivation audit | `NONE` · `CONCLUSION_ONLY` · `STEP_PROOF` | yes |
| E4 | verifier independence | `NONE` · `CO_LOCATED` · `STANDALONE_TRANSCRIBED` | yes |
| E5 | output grounding posture | `UNGROUNDED` · `POST_HOC_FILTER` · `PRE_EMIT_GATE` | yes |

### F — Learning & self-modification
| id | design question | Dom | ordered |
|---|---|---|---|
| F1 | learning locus | `NONE` · `IN_CONTEXT` · `WEIGHTS_POLICY` · `SYMBOLIC_RULES` · `SELF_ARCHITECTURE` (set-valued) | partial |
| F2 | reward domain | `FUSED` · `SPLIT_FIREWALL` | yes |
| F3 | self-modification authority | `NONE` · `DIRECT` · `SHADOW_GOVERNED` | yes |
| F4 | autonomy rung | `OBSERVE` · `PROPOSE` · `SANDBOX` · `AUTO_MERGE_LOW` · `HUMAN_APPROVED_PROD` | yes |
| F5 | training-data integrity | `OPEN` · `EVAL_FROZEN_EXCLUSION` | yes |

### G — Integration & embodiment
| id | design question | Dom | ordered |
|---|---|---|---|
| G1 | neural role | `NONE` · `ORACLE` · `GATED_PROPOSER` · `FUSED_UNCONTROLLED` | partial |
| G2 | symbolic fallback coverage | `NONE` · `PARTIAL` · `TOTAL` | yes |
| G3 | environment coupling | `DISEMBODIED` · `TOOL_USE` · `RL_LOOP` (set-valued) | — |
| G4 | NL surface | `NONE` · `INGRESS` · `BIDIRECTIONAL` | yes |
| G5 | multi-agent topology | `SINGLE` · `MULTI_TRANSPORT` · `PEER_MESH` | yes |

---

## §3 SeNARS as a point: `s° ∈ ℛ`

| id | s°(d) | enforcing anchor (README / flow.control) |
|---|---|---|
| A1 | `NON_AXIOMATIC` | NAL; rule table = loaded data, ⛔ `rules:loaded-data` |
| A2 | `FC_PAIR` | branded `Frequency`/`Confidence`; goals carry `(d,c)` |
| A3 | `NON_MONOTONIC` | revision, decay, retraction |
| A4 | `GRADED_COEXISTENCE` | Bench 4 contradiction resilience; both sides retained, truth-graded |
| A5 | `HOL+TEMPORAL+PROCEDURAL` | full Narsese grammar incl. sequence/operation |
| A6 | `TOOL_ISOLATED` | MeTTa via ActionGate tool; Arbiter pattern; ⛔ `todo28-metta-seam` |
| B1 | `HARD_TYPE` | `CognitiveAxis`; `BeliefTruthSchema`; RewardGate firewall |
| B2 | `TIERED+LEARNED_REPUTATION` | `SOURCE_QUALITY_CONFIDENCE` + `source-reputation.ts` (ceiling-only) |
| B3 | `NAL_INDEPENDENCE` | `Truth.revision` + independence flag in verifier |
| B4 | `LINEAGE_TRACKED` | evidence lineage DAG (cap 16); Bench 1 evidence-laundering |
| B5 | `ABSTAIN` | ⛔ `answer:no-fabrication` |
| C1 | `AIKR` | founding postulate |
| C2 | `BOUNDED_FORGET` | `Bag<T>` LRU/archive/forget; ⛔ `resource:policy`; 0 unbounded accumulators |
| C3 | `ANYTIME_COOPERATIVE` | `AbortSignal`, deadlines, cooperative yield |
| C4 | `PRIORITY_BAG` (+`LEARNED` weights) | `Bag`/`Focus`/`FocusBag`; `self-scheduler` domain |
| C5 | `DECOUPLED` | truth decays on invalidation only; priority decays by LRU |
| C6 | `MULTI_DIM_TABLE` | 4 dims (`cycles, depth, memoryOps, llmCalls`); ⛔ `control-budgets` |
| D1 | `GATED_UNTRUSTED` | all proposers (LM/reflex/peer/remote) untrusted |
| D2 | `FULL_GATE` declared — **`PARTIAL_GATE` realized** | four gates; ActionGate coverage = focus/game path only (§8) |
| D3 | `PLUGGABLE+ADAPTIVE+LEARNED` | strategy registry; RLFP applies switch sets |
| D4 | `META+SELF_MODEL` | 8 analyzers, `ReasoningAboutReasoning`, self-belief vocabulary |
| D5 | `CALIBRATED_SCORE` | `rankDerivations` = conf×decisiveness−size; isotonic calibration |
| E1 | `EVENT_SOURCED(+SNAPSHOT)` | append-only JSONL/SQLite + `nar-state` checkpoint |
| E2 | `DETERMINISTIC_VERIFIED` | `replayIntoMemory` + state-hash verify |
| E3 | `STEP_PROOF` | `DerivationRecord` (200 steps/record cap) |
| E4 | `STANDALONE_TRANSCRIBED` | `verifyRecord`; truth table transcribed, drift pinned by test |
| E5 | `POST_HOC_FILTER` realized | replace-after-fact + per-delta `[filtered]`; no pre-emit gate (§8) |
| F1 | `{WEIGHTS_POLICY, SYMBOLIC_RULES, SELF_ARCHITECTURE*}` | RLFP; schema induction; *proposals only, governed |
| F2 | `SPLIT_FIREWALL` | RewardGate: reward ∩ `Truth.{f,c}` = ∅ |
| F3 | `SHADOW_GOVERNED` declared — degraded realized | worktree+full CI; approval not injected on NAR path (§8) |
| F4 | `SANDBOX` (target rung; ladder exists) | `AutonomyMode` state machine |
| F5 | `EVAL_FROZEN_EXCLUSION` | reaction-sourced rows excluded from frozen eval set |
| G1 | `GATED_PROPOSER` | System 1 proposes; System 2 disposes |
| G2 | `TOTAL` | `symbolicFallbacks`; ⛔ `rule:has-fallback`; ⛔ `core:no-lm` |
| G3 | `{TOOL_USE, RL_LOOP}` | Focus-Game-Reflex kernel; 9 shipped games |
| G4 | `BIDIRECTIONAL` declared — ingress+cortex realized | ingress live; narration via `LLMCortex`; `NLGenerationService` dormant |
| G5 | `MULTI_TRANSPORT` realized | CLI/IRC/WS/HTTP/MCP live; peer mesh dormant |

---

## §4 Occupants of ℛ

### 4.1 Coordinate comparison (n/a = dimension not applicable to that system)

| dim | ATP (Vampire) | Lean | SAT/SMT | ASP | PPL/Stan | Soar | NARS₀ (orig.) | Deep-RL | LLM-ReAct | **◆ SeNARS** |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | axiomatic | axiomatic | axiomatic | closed-world | model-fixed | production | non-axiom | none | none | **non-axiom** |
| A2 | bool | bool | bool | bool | prob | bool+pref | **(f,c)** | vector | none | **(f,c)** |
| B1 | n/a | n/a | n/a | n/a | n/a | soft | hard | fused | soft | **hard** |
| B4 | explosion | explosion | explosion | rejection | rejection | rejection | graded | n/a | rejection | **graded** |
| C1 | omniscient | omniscient | omniscient | omniscient | omniscient | hybrid | AIKR | omniscient | omniscient | **AIKR** |
| C2 | unbounded | unbounded | unbounded | unbounded | unbounded | bnd-forget | bnd-forget | unbounded | unbounded | **bnd-forget** |
| D1 | n/a | kernel-gated | n/a | n/a | n/a | direct | direct | n/a | direct | **gated** |
| E1 | snapshot | snapshot | stateless | stateless | stateless | snapshot | snapshot | weights | stateless | **event-sourced** |
| E3 | step | step | certificate | trace | none | trace | partial | none | none | **step** |
| E4 | co-located | standalone | standalone | co-located | none | none | co-located | none | none | **standalone** |
| F1 | none | none | none | none | weights | rules+wt | rules | weights | in-context | **wt+rules+arch\*** |
| F2 | n/a | n/a | n/a | n/a | n/a | fused | split | fused | fused | **split** |
| G1 | none | none | none | none | none | none | none | fused | fused | **gated proposer** |

\* architecture changes are proposals under governance, not direct writes.

### 4.2 Projection P₁ — audit depth × resource regime

```text
                     resource regime →
                  unbounded              hybrid             AIKR-bounded
              ┌────────────────────────┬─────────────────┬───────────────────────┐
 standalone   │ Lean   SAT/SMT         │                 │ ◆ SeNARS              │
 step-proof   │ ATP    ASP             │                 │                       │
 concl/trace  │ Prolog PPL             │ Soar   ACT-R    │ ○ NARS₀               │
 none         │ Stan   Deep-RL  LLM-RA │                 │                       │
              └────────────────────────┴─────────────────┴───────────────────────┘
```

### 4.3 Projection P₂ — trust regime × belief/goal separation

```text
                  proposer-trust regime →
                direct-adopt            mixed             all-gated
            ┌────────────────────────┬───────────────┬────────────────────────────┐
 hard  B/G  │                        │               │ ◆ SeNARS                   │
 soft       │ LLM-ReAct              │ (sparse)      │ Lean (kernel gates the     │
 fused      │ Deep-RL  Soar  PPL     │               │ elaborator; no ext. prop.) │
            └────────────────────────┴───────────────┴────────────────────────────┘
```

### 4.4 Cube occupancy — (resource × audit × trust) corners

| corner | occupants |
|---|---|
| omniscient · low audit · direct | LLM-ReAct, Deep-RL, PPL |
| omniscient · high audit · no/gated proposers | ATP, SAT/SMT, Lean, Prolog, ASP |
| AIKR · partial audit · direct | NARS₀, Soar |
| **AIKR · standalone audit · gated proposers** | **◆ SeNARS — sole occupant in this corpus** |

Thesis of the corner: formal systems audit but assume infinite resources; LLM-era systems scale but neither audit nor gate; the AIKR-audited-gated corner is the point SeNARS occupies.

---

## §5 Feasibility constraints (carve Φ(ℛ))

| # | rule | consequence of violation |
|---|---|---|
| K1 | `B1=HARD ⇒ A2` carries a distinct desire carrier `(d,c)` | goal/belief collapse |
| K2 | `C1=AIKR ⇒ C2≠UNBOUNDED ∧ retention(E1)<∞` | unbounded growth under a bounded postulate |
| K3 | `E4=STANDALONE ⇒ E3=STEP_PROOF` | verifier with nothing to check |
| K4 | `D1=GATED ⇒ every gate fails closed` (fault ⇒ refuse) | vacuous gating |
| K5 | `F2=SPLIT ⇒ write(reward) ∩ Truth = ∅` | reward hacking of factual confidence |
| K6 | `A4=GRADED_COEXISTENCE ⇒ A3=NON_MONOTONIC` | explosion via monotonic chaining |
| K7 | `G1=GATED_PROPOSER ⇒ G2=TOTAL` | LM outage = cognitive outage |
| K8 | `E2=DETERMINISTIC ⇒ E1=EVENT_SOURCED ∧ pure reducers` | non-replayable state |
| K9 | `F3≠NONE ⇒ shadow validation ∧ F4 ladder defined` | ungoverned self-modification |
| K10 | `D1=TRUSTED_DIRECT ∧ B1∈{FUSED,SOFT}` | sycophancy/reward-hack region — excluded under any safety requirement |
| K11 | `B5=ABSTAIN ⇒ unification with grounding + occurs check` | fabricated ground instances |
| K12 | `C3=ANYTIME ⇒ state resumable from recorded state (E1,E2)` | lost work on interrupt |

SeNARS satisfies K1–K12; K5 and K10 are the epistemic firewall stated as space-level predicates.

---

## §6 Order structure

Per-group chains (≤ = “no more disciplined than”):

```text
B:  FUSED < SOFT < HARD ;  DOUBLE_COUNT < LINEAGE ;  FABRICATE < ABSTAIN
C:  OMNISCIENT < AIKR ;  UNBOUNDED < BND_NO_FORGET < BND_FORGET ;  BATCH < CHECKPOINT < ANYTIME
D:  TRUSTED_DIRECT < GATED_UNTRUSTED ;  DIRECT < PARTIAL < FULL
E:  STATELESS < SNAPSHOT < EVENT_SOURCED ;  NONE < CONCLUSION < STEP ;  NONE < CO < STANDALONE
F:  NONE < DIRECT < SHADOW_GOVERNED ;  FUSED < SPLIT
```

| claim | status |
|---|---|
| SeNARS is maximal in B, C, E, F among compared occupants | ✓ |
| SeNARS is maximal in D among compared occupants | ✓ modulo realized coverage gap (D2, E5) |
| SeNARS ⪰ NARS₀, Soar, LLM-ReAct, Deep-RL (Pareto dominance on ordered dims) | ✓ |
| SeNARS vs. Lean/ATP/SAT | **incomparable** — A1 trade axis: closed-domain validity vs. open-world operation under insufficient knowledge. Axiomatic systems maximize guarantee within a fixed theory; NAL sacrifices completeness for resource-bounded continuation. Neither dominates. |

Trade-off surface (costs of the corner):

| gain | paid in |
|---|---|
| step audit + standalone verifier (E3,E4) | per-derivation overhead; recorder bounds (200×200) |
| gated proposers (D1) | latency (judgment pass), LM budget spend |
| bounded forget (C2) | possible loss of long-tail knowledge; declared, not eliminated |
| paraconsistency (A4) | no global consistency guarantee by construction |

---

## §7 SeNARS neighborhood — internal degrees of freedom

Configurable variants are sub-points reachable from `s°` without leaving the Feasible region:

| variant | dims shifted | value change |
|---|---|---|
| capability tier t0 (`device`, `arcade` profiles) | G1, G2 | `G1→NONE` (LM never imported); `G2=TOTAL` by necessity |
| tier t2 (`conversation`, `tool-use`, `research`) | G1 | `GATED_PROPOSER` active |
| `FAST_COGNITIVE_CONFIG` | G1, C6 | minimal LM; llm-budget ↓ |
| `LM_HEAVY_CONFIG` | G1, C6 | maximal LM enrichment; llm-budget ↑ |
| `RESEARCH_COGNITIVE_CONFIG` | E3, D5 | full tracing; derivation caps ↓ |
| `systemOne.enabled=false` | D5 | `CALIBRATED → HEURISTIC`; disabled path byte-identical |
| `persistState=false` | E1 | event log only, no snapshot |
| `AutonomyMode` rung | F4 | any of the 5 rungs |
| derivation/sampling strategy slots | D3 | any registered strategy; ⛔ rejects stateful misuse |
| `dialogue.enabled=true` | F5 labels | additional label sources; frozen-eval exclusion preserved |

Neighborhood invariant: every sub-point still satisfies K1–K12 (the corner is preserved by construction; ⛔ `config:model-matrix`: S / S+J / S+P / S+J+P are four complete systems).

---

## §8 Declared vs. realized — Δ(SeNARS)

Per `flow.control.md` §25; `r°` = README-declared, `r*` = wired reality.

| dim | r°(d) | r*(d) | ω | anchor |
|---|---|---|---|---|
| D2 | `FULL_GATE` | `PARTIAL_GATE` — ActionGate sees only game actions; F9/F10 tool paths bypass | P | §6.2, §10.3 |
| E5 | (pre-emit implied) | `POST_HOC_FILTER` — un-grounded deltas stream, then are superseded | W (post-hoc) | §9.2 |
| F3 | `SHADOW_GOVERNED` | degraded — approval gate not injected into self-tools on NAR path | P | §19.1 |
| F1 | `SYMBOLIC_RULES` active | rule-admission arm dormant (`submitRule` has no caller; `applySchemaPatch` no-op) | D | §11, §25.1 |
| G4 | `BIDIRECTIONAL` | ingress live + cortex egress; `NLGenerationService` dormant | D | §9.2 |
| G5 | `PEER_MESH` implied | one agent + transports; `cooperation/` unexported | D | §20.4 |
| B2 | shadow-validated NL candidates | `admitFormalization`/`NARIO.input` bypass ShadowValidator | P | §9.1 |
| B2 | domain-keyed reputation | `domain:` keys looked up, never recorded | P | §20.3 |

Gap semantics: each row is a one-line wiring change, not a missing design (§9).

---

## §9 Movement vectors — paths through ℛ from `s°`

Derived from `flow.control.md` §27 (alternate design possibilities). Each is an operator `μ: ℛ → ℛ`.

| μ | transition | dims affected |
|---|---|---|
| unify action authorization | `D2: PARTIAL → FULL` (one `authorize()` at `ToolManager.execute`) | D2 |
| single Authorizer port | collapse Policy/Capability/Approval into one injected port | D2, F3 |
| pre-emit groundedness | `E5: POST_HOC → PRE_EMIT_GATE` (gate at narrator, not consumer) | E5 |
| wire rule admission | call `submitRule` from schema-promotion / MeTTa adoption | F1 (D→W) |
| speculative model rules | optimistic provisional stamps + retraction event family | E1, D5 |
| ConflictSet projection | contradictions as first-class queryable object | A4/B4 surface |
| one-log persistence | checkpoint = replay cache over single log | E1 |
| signed build attestation | external runner needs no trust in agent tree | F3 |
| generated verifier table | spec-generated truth table + finite-domain agreement proof | E4 (drift → 0) |
| dormant-surface red gate | “every exported component has a caller or declared exclusion” | ω-completeness |
| first-class cognitive axis in log | branded `Claim<A extends CognitiveAxis>` carried by events | B1 (replay reconstructs firewall) |

---

## §10 Distance — indicative δ values

Weighted Hamming over the 13 shared dims of §4.1; dims n/a for either system excluded pairwise. Weights uniform here; application-specific otherwise.

| pair | δ | reading |
|---|---|---|
| SeNARS ↔ NARS₀ | ≈ 6 | nearest kin; delta is provenance + trust (E1,E3,E4,D1,G1,F1) |
| SeNARS ↔ LLM-ReAct | 13 | every applicable dim differs |
| SeNARS ↔ Deep-RL | ≈ 12 | same quadrant gap as LLM-ReAct |
| SeNARS ↔ Lean | ≈ 8 | incomparable, not far: share E3=step, E4=standalone, gated proposers; diverge on A1/A2/C/B |
| SeNARS ↔ Soar | ≈ 9 | share bounded WM + symbolic learning; diverge on trust, audit, firewall |
| LLM-ReAct ↔ Deep-RL | ≈ 5 | same corner, different substrate |

---

## §11 Index

| object | location |
|---|---|
| space definition | §1 |
| 37 dimensions | §2 |
| SeNARS coordinate `s°` | §3 |
| comparative occupants, projections, cube | §4 |
| feasibility rules K1–K12 | §5 |
| order, dominance, trade-offs | §6 |
| SeNARS sub-points (profiles/tiers/presets) | §7 |
| declared/realized gap Δ | §8 |
| movement operators | §9 |
| metric | §10 |
