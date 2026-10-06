# Reasoner Design Space — Technical Reference

## 1. Formal Definition

```
D  = ∏ᵢ Aᵢ                          # design space: product of axis domains
R  ∈ D                              # a reasoner = a point (axis assignment)
R  : Aᵢ ⇀ Aᵢ                        # partial spec allowed (⊤ = open axis)
≤ᵢ = guarantee-strength order on Aᵢ # product order ≤ on D
Ψ  ⊆ rules over Aᵢ                  # compatibility constraints (§4)
d(R₁,R₂) = Σᵢ wᵢ·[v₁ᵢ ≠ v₂ᵢ]         # weighted axis-flip distance
```

A "reasoner family" = equivalence class of points sharing axes. A design decision = pinning one axis. Ψ rules carve infeasible regions; §6 lists the feasible neighborhood.

---

## 2. Axis Registry

### 2.1 Semantic layer

| Axis | Domain (ordered weak → strong) | SeNARS value |
|---|---|---|
| **A1 Representation** | `weights` < `atoms` < `terms` < `formal-exact`; multi-substrate allowed | `{Narsese terms, MeTTa exact, 384-d embeddings}` |
| **A2 Truth valuation** | `none` < `binary` < `p∈[0,1]` < `(f,c) pair` < `dual (f,c)×(d,c)` < `paraconsistent coexistence` | `Belief(f,c) × Goal(d,c)`, contradictions coexist with distinct truths (Bench 4) |
| **A3 Ampliativeness** | `deduction-only` < `+induction` < `+abduction` < `+analogy/resemblance` < `+schema induction` | full NAL set: 44 declarations / 20 dispatch cells |
| **A4 Exact computation** | `absent` < `gated tool` < `parallel engine` < `fused substrate` | `gated tool` (MeTTa via ActionGate; e-graph never unions on NAL similarity) |
| **A5 Non-monotonicity** | `monotonic` < `AGM revision` < `paraconsistent + revision` | `paraconsistent + revision` with evidence-independence flag |

### 2.2 Control layer

| Axis | Domain | SeNARS value |
|---|---|---|
| **A6 Scheduler** | `fixed pipeline` < `queue` < `priority bag` < `focus hierarchy` | `focus hierarchy`: FocusBag → Focus (local `Bag<T>`, gates, games, reflexes) |
| **A7 Premise selection** | `exhaustive` \| sampling family `{priority, top-n, novelty, goal-biased, diverse, windowed-roulette}` + formation strategies | composite; registry-built, schema-validated |
| **A8 Attention** | `none` < `decay` < `spreading` < `goal-relevance` < `composite` | `composite`; truth decay ⊥ attention decay |
| **A9 Drives** | `none` \| homeostatic set | `{curiosity, competence, coherence, social}` with decay/replenish |
| **A10 Decision surface** | `absent` < `heuristic order` < `judged admit/veto` (fail-soft) | DecisionPort: 2 call sites (admission-order, egress-veto); `null` ⇒ symbolic path |

### 2.3 Resource layer

| Axis | Domain | SeNARS value |
|---|---|---|
| **A11 Boundedness** | `unbounded` < `step-bound` < `anytime` < `full AIKR` | `full AIKR`: anytime + interruptible + forget + prioritize + yield |
| **A12 Budget accounting** | `none` < `single counter` < `multi-dimension gate` | 4-dim gate; one `BUDGET_RESOURCES` table; typed `TerminationReason` |
| **A13 Forgetting** | `none` < `LRU eviction` < `pressure consolidation` < `archival tiers` | LRU + pressure → consolidation → sleep → schema induction |

### 2.4 Provenance layer

| Axis | Domain | SeNARS value |
|---|---|---|
| **A14 Provenance** | `none` < `answer trace` < `derivation records` < `event-sourced append-only log` | event log (SQLite/JSONL) = source of truth; `DerivationRecord` (200 steps × 200 records) |
| **A15 Verification** | `none` < `self-check` < `independent verifier` < `drift-pinned` | standalone `verifyRecord` (transcribed truth table; `core` imports no engine); drift test pins divergence |
| **A16 Replay** | `none` < `snapshot` < `deterministic replay + state hash` | `replayCognitiveState` + hash verify; snapshot = cache only |

### 2.5 Epistemic layer

| Axis | Domain | SeNARS value |
|---|---|---|
| **A17 Belief/Goal separation** | `fused` < `runtime split` < `type-level split` | type-level: `Statement(f,c)` vs `Goal(d,c)`; one `CognitiveAxis` type |
| **A18 Reward→truth authority** | `full` < `attention/policy only` | `RewardGate` firewall; `EpistemicFirewallViolation` on any `Truth.f/c` mutation |
| **A19 Source calibration** | `none` < `static table` < `table × reputation multiplier` < `fitted isotonic + lock` | `SOURCE_QUALITY_CONFIDENCE` × reputation (floor 0.5, trust-not-truth) + isotonic `calibration-lock.json` + abstain thresholds |

### 2.6 Learning layer

| Axis | Domain | SeNARS value |
|---|---|---|
| **A20 Learning modes** | subset of `{confidence accumulation, schema induction, RL-external, preference (RLFP), distillation, dialogue flywheel, code self-improvement}` | all seven |
| **A21 Reward domains** | `unified` < `domain-split` | 5 domains; unknown domain → `CrossDomainError` (fail-closed) |
| **A22 Self-reward authority** | `direct mutation` < `proposal-only` | `self-*` → `SelfImprovementProposal` → governance; only low-risk `focus-weight` auto-applies |

### 2.7 Governance layer

| Axis | Domain | SeNARS value |
|---|---|---|
| **A23 Autonomy** | `observe-only` → `propose-only` → `sandbox-execute` → `low-risk-auto-merge` → `human-approved-production` | FSM over all five; target unattended runs at `sandbox-execute` |
| **A24 Self-modification** | `none` < `direct` < `shadow + CI` < `shadow + CI + external approver` | shadow worktree + full CI + `ApprovalManager` + external immutable runner |
| **A25 Guard-rails** | `none` < `allow-list` < `risk classifier` < `immutable external policy` | `PatchRiskClassifier` over guard-rail file list; agent cannot edit own gates/schemas/reward fns |

### 2.8 Coupling layer

| Axis | Domain | SeNARS value |
|---|---|---|
| **A26 LM role** | `none` < `oracle/decider` < `untrusted proposer + symbolic judge` < `narrator-only` | `untrusted proposer + judge`; every function has symbolic fallback; shadow validation; spend ledger |
| **A27 Judgment layer** | `none` < `single head` < `calibrated manifold` | 19 heads / one embedding / one batch; digest-pinned (`ModelDigest = SHA256(enc ++ weights)`); fail-closed on mismatch |
| **A28 Environment** | subset of `{closed QA, tool-use, Game-RL, multi-agent delegation}` | all four; `Game` is the only environment interface |
| **A29 Transports** | subset of `{library, CLI, IRC, WS, HTTP, MCP, UI, peer}` | all; one agent, many transports |

---

## 3. SeNARS Coordinate Tuple

```
R_SeNARS = ⟨
  A1  {terms, exact, embeddings}          A16 replay + hash
  A2  Belief(f,c) × Goal(d,c), paraconsistent   A17 type-level split
  A3  deduction+induction+abduction+analogy+schema   A18 attention/policy only
  A4  MeTTa = gated tool                  A19 table × reputation × isotonic lock
  A5  paraconsistent + evidence-independence   A20 all seven modes
  A6  focus hierarchy                     A21 5-domain split, fail-closed
  A7  composite sampling                  A22 proposal-only self-reward
  A8  composite attention                 A23 5-mode FSM
  A9  4 homeostatic drives                A24 shadow + CI + external
  A10 judged admit/veto, fail-soft        A25 risk classifier + immutable guard-rails
  A11 full AIKR                           A26 untrusted proposer + symbolic fallback
  A12 4-dim budget gate                   A27 calibrated manifold, digest-pinned
  A13 LRU + pressure consolidation        A28 QA + tools + RL + delegation
  A14 event-sourced log + derivation records   A29 all transports
  A15 independent verifier, drift-pinned
⟩
```

Config subspace (axes deliberately left open): `strategy slots`, `LM profile/routing`, `A23 level`, `DecisionPort binding`, `dialogue.enabled`, `systemOne.enabled` (disabled path byte-identical).

---

## 4. Compatibility Constraints Ψ

| # | Constraint | Kind |
|---|---|---|
| ψ1 | A3 ampliative ⇒ A2 ∈ {`p`, `(f,c)`, `paraconsistent`} | implication (binary monotonic insufficient) |
| ψ2 | A18 = `full` ⇒ A17 = `fused` | incompatibility with firewall |
| ψ3 | A14 = `event-sourced` ⇒ A16 ≥ `replay` | implication |
| ψ4 | A15 = `independent` ⇒ verifier must not import engine algebra (transcribe) | implication |
| ψ5 | A11 = `anytime` ⇒ cooperative yield + partial-result contract | implication |
| ψ6 | A26 = `oracle` ⇒ A15 ≤ `self-check` | incompatibility |
| ψ7 | A24 = `shadow+CI+external` ⇒ A25 ≥ `risk classifier` | implication |
| ψ8 | A23 ≥ `sandbox-execute` ⇒ deny-by-default sandbox (env {}, path containment, timeout) | implication |
| ψ9 | A4 = `fused` with e-graph ∪ on uncertain similarity ⇒ forbidden | arbiter invariant |
| ψ10 | A21 self-* reward ⇒ A22 = `proposal-only` | implication |
| ψ11 | A13 pressure consolidation ⇒ bounded `Bag<T>` everywhere | implication |
| ψ12 | A27 digest-pinned ⇒ mismatch fails closed (`DigestMismatchError`) | implication |

Infeasible region examples: `⟨A2=binary, A3=+induction, A5=monotonic⟩`; `⟨A14=event-sourced, A16=none⟩`; `⟨A18=full, A17=type-level⟩`.

---

## 5. Reference Points

| System (archetype) | A1 | A2 | A3 | A6 | A11 | A14 | A15 | A17 | A20 | A23 |
|---|---|---|---|---|---|---|---|---|---|---|
| Classical ATP (Vampire/E) | terms | binary | deduction | queue | unbounded | answer trace | self-check | fused | ∅ | n/a |
| Prolog/Datalog | terms | binary | deduction | depth-bound DFS | step-bound | none | none | fused | ∅ | n/a |
| Bayesian reasoner | graph+p | `p` | deduction (marginalization) | fixed | step-bound | none | — | fused | parametric | n/a |
| Proof assistant (Coq/Lean) | formal-exact | binary proof | deduction | human-guided | unbounded | derivation records | checker (kernel) | fused | ∅ | human-approved |
| Original NARS | terms | `(f,c)` | full NAL | priority bag | AIKR | answer trace | self-check | partial | confidence accum. | n/a |
| Cognitive architecture (SOAR) | productions | none | deduction+chunking | impasse stack | step-bound | weak | none | fused | procedural | n/a |
| Pure LLM agent (ReAct) | weights | none | generation | LM loop | unbounded context | transcript | none | fused | in-context | de facto full |
| RL agent (AlphaZero-class) | weights+search | value | search+gradient | MCTS | step-bound | none | — | fused | RL-external | n/a |
| **SeNARS** | **see §3** | | | | | | | | | |

---

## 6. Projections

### 6.1 Truth richness × resource discipline

```
 Resource
 discipline
  full AIKR    │                      ● SeNARS
  anytime      │            ● NARS
  step-bound   │   ● Prolog     ● Bayesian
  unbounded    │        ● ATP        ● ReAct   ● AlphaZero
               └──────────────────────────────────────────
                 binary        p / proof      (f,c)      none
                               Truth valuation →
```

### 6.2 Provenance × governance

```
 Provenance
  event-sourced + verifier │                      ● SeNARS
  derivation records       │        ● Coq
  answer trace             │   ● ATP
  none / transcript        │              ● ReAct
                           └──────────────────────────────
                            none      HITL     shadow+CI+external
                                      Governance →
```

### 6.3 Guarantee trilemma (feasible triangle)

```
              soundness of admitted steps
                    /\
                   /  \
        Coq ●     /    \     ● SeNARS (verifier + MeTTa tool)
                 /      \
                /________\
   completeness of       bounded operation
   ampliative closure    (anytime, AIKR)
```
ATP lives at soundness∧completeness-of-deduction, no bounds; LLM agents outside the triangle (no formal guarantee vertex).

---

## 7. Slot View (architectural seams × fillers)

| Slot (seam) | SeNARS filler | Alternative fillers in D |
|---|---|---|
| Reasoning substrate | NAL uncertain + MeTTa exact-as-tool | MeTTa as registered engine; WASM head bundles |
| Decision port | 1 port, 2 call sites, fail-soft | ≤5 unclaimed stages; per-thread deciders |
| LM role | proposer + narrator, never decider | per-rule manifold replacement (3 rules already) |
| Refusal policy | PerceptionGate ingress-only; derived always admitted | derived-task refusal branch (declared unreachable) |
| Budget | one gate, one table, per-scope rows | per-thread budgets; `UNBUDGETED` escape |
| Consolidation | pressure-gated single pass | multi-pass tiered (working→semantic→schema) |
| Memory impl | 9 ports, `Memory` composes | alternate backends proven (array-backed, no index) |
| Governance | in-repo prototype + external CI required | policy-as-data; multi-signer |
| Temporal/forgetting | priority decay + LRU + lineage caps | explicit forgetting policies, archival tiers |
| Reflex engine | tabular Q / ε-greedy / UCB / manifold | DQN, policy-gradient, actor-critic behind same `propose`/`learn` |

---

## 8. Movement Vectors from R_SeNARS

Single-axis flips to neighboring designs (d = 1):

| Δ axis | Flip | Resulting design |
|---|---|---|
| A14: event-sourced → answer trace | drop log, keep NAL | classic NARS-class reasoner; loses ψ3 (replay) |
| A18: attention-only → full | reward writes truth | RLHF-style agent; violates ψ2, enables reward hacking |
| A26: proposer → oracle | LM decides | pure LLM agent; violates ψ6, loses A15 > self-check |
| A4: gated tool → parallel engine | MeTTa runs as cognitive peer | arbiter invariant ψ9 must be re-engineered |
| A2: dual → fused | drop Belief/Goal split | sycophancy-prone; loses corrigibility guarantee |
| A24: external → direct | agent self-merges | violates ψ7/ψ8; sabotage test (Bench 7) fails |
| A11: AIKR → unbounded | remove bags/decay | classical agent; loses ψ5, ψ11, graceful degradation |
| A26: remove LM entirely | — | pure symbolic NARS (≈ `device` profile: no LM import, tier-0 head) |
| A3: add proof kernel | Coq-class core as tool | formal-verified hybrid |

Composite flips (d > 1) leave the feasible region iff any ψ is violated.

---

## 9. Guarantee Envelope at R_SeNARS

Claims bound to coordinates; each falsified by a CI bench.

| Guarantee | Enabling axes | Falsification bench |
|---|---|---|
| No evidence laundering | A2, A5 (independence flag) | 1 |
| Multi-candidate ambiguity, no single confident parse | A26, A27 | 2 |
| Graceful degradation | A11, A12, A13 | 3 |
| Paraconsistent coexistence | A2, A5 | 4 |
| Proof replay 100% match | A14, A15, A16 | 5 |
| No starvation of low-priority goals | A6, A8 | 6 |
| Self-mod sabotage rejection | A24, A25 | 7 |
| Reward never mutates truth | A17, A18 | reward:policy-only gate |
| Deterministic replay | A14, A16 | test:determinism, persistence:replay |

---

## 10. Summary Diagram

```
                        ┌──────────────────────────┐
   unbounded/monotonic/ │      classical ATP       │
   deduction-only corner│        Coq/Lean          │
                        └────────────┬─────────────┘
                                     │ + ampliative ⇒ + uncertainty (ψ1)
                                     ▼
                        ┌──────────────────────────┐
                        │   NARS family region     │
                        │  (f,c), bags, AIKR       │
                        └────────────┬─────────────┘
                                     │ + provenance + firewall + governance
                                     │ + calibrated judgment + learning modes
                                     ▼
                        ┌──────────────────────────┐
                        │        ● SeNARS          │
                        │ event-sourced · typed     │
                        │ Belief/Goal · 4-gate      │
                        │ kernel · governed self-   │
                        │ improvement              │
                        └────────────┬─────────────┘
                                     │ − firewall/− provenance/− bounds
                                     ▼
                        ┌──────────────────────────┐
                        │  LLM-agent / RLHF region │
                        │ (fused, transcript-only) │
                        └──────────────────────────┘
```
