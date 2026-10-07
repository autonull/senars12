# MetaReasoner — Ultimate Architecture Specification

> SeNARS abstracted and upgraded: one kernel, versatile control models.
> Default SeNARS, all `synth/` flavors, and future models are **configurations** of one machine — not separate architectures.

## 0. Thesis

A reasoner is a **governed controller turning observations into justified commitments under scarcity**:

```
observe → propose → judge → schedule → reserve → execute → verify → gate → commit
```

Everything — perception, inference, action, learning, self-modification — is one primitive (`Transaction`) traversing one path (`CommitLedger`) under one bound (`Budget`) with one trace (`EventLog`). Control topology, scheduling intelligence, substrate mix, resource policy, and governance strictness are **data**, not code forks.

## 1. Governing Selection

From `synthesize.md` menu. Resolves all elegance/safety/power conflicts below.

**Prime objectives:** `O1` epistemic integrity · `O2` causal provenance · `O3` control-plane fluidity · `O8` unified commit ledger · `O5` minimal kernel (with `O4/O6/O7/O9` as scaled-in options, §9).

**Hard constraints (never violated):** `H1` reward↛truth · `H2` no unjudged admission · `H3` no mutation without event · `H4` no self-approval · `H5` no unbounded path · `H6` no opaque scheduler.

**Anti-goals:** `A2` opaque scheduler · `A5` monolithic LM authority · `A1` abstraction-before-kernel · `A7` unbounded richness (drives/imagination/consolidation only budgeted + governed).

**Conflict order:** `integrity > audit > unification > power > adaptivity`. When fluidity threatens integrity, fluidity yields. When economy threatens auditability, economy degrades first (guarantee conservation, §6).

## 2. One Ontology

| Primitive | Type | Meaning |
|---|---|---|
| `Transaction` | `T = { id, parent?, axis, op, in, out?, budget, trust, risk, proof?, fallbacks }` | Sole unit of work. Perception, derivation, tool call, learning step, self-mod are all `T`. |
| `Event` | `E = { seq, time, txId, kind, payload, causationId }` | Append-only fact. State is `fold(E)` — never stored independently. |
| `ControlWord` | `κ` | Declarative program over stage generators (`· + * p? ‖`). The only sequencing construct. |
| `Gate` | `G : T × State → Admit \| Provisional \| Defer \| Reject \| Escalate` | Typed boundary check. All `G` share one interface. |
| `Budget` | `B = { reserve, charge, price, backpressure }` | Spendable dimensions (per `core/budget` `BUDGET_RESOURCES`); economy policy pluggable. |
| `Judgment` | `J : Proposal → ScoredClaim` | Calibrated scoring. Proposers never write truth directly (`propose ⊣ admit`). |
| `Commit` | `Ledger.append(E*)` | Single mutation authority. No second write path exists. |

```typescript
type Axis = 'epistemic' | 'teleological';
type Transaction = { id: Id; parent?: Id; axis: Axis; op: OpId; budget: Reservation; trust: Trust; risk: Risk; proof?: ProofObligation };
type Verdict = 'commit' | 'provisional' | 'defer' | 'reject' | 'escalate' | 'degrade';
```

**Firewall as typing:** `Reward → V_teleological` is well-typed; `Reward → BeliefTruth` is untypable. `teleological` writes can never construct an `epistemic` commit — compiler + gate enforce it (`H1`).

### 2.1 Content taxonomy (all synth attitudes, one axis rule)

All `synth/` content kinds collapse to `Content = attitude × Axis × grade`:

```typescript
type Attitude = 'Belief' | 'Goal' | 'Question' | 'Hypothesis' | 'Assumption' | 'Plan' | 'Obligation' | 'Permission' | 'ActionIntent' | 'Lesson';
type Grade = 'epistemic' | 'teleological' | 'normative' | 'procedural' | 'provisional';
```

- `Belief{f,c} / Goal{d,c}` keep NAL truth/desire algebra (non-associative revision + lineage-disjointness + decoupled truth/attention decay).
- `Hypothesis/Assumption/Plan/Obligation/Permission/ActionIntent/Lesson` are `provisional`-graded by default: ceilinged confidence + expiry + contradiction watch; promotion to `Belief` requires proof + independence check.
- `comb(ε+τ→π)`: acting on belief+desire yields `ActionIntent` (teleological), never a belief. `Reward→Belief.f` fails typecheck (`H1`); `teleological ∤ Belief` in every membrane/gate/fibration presentation.

## 3. Minimal Kernel Ω₀ (immutable, always on)

The smallest load-bearing core. Everything else is an optional port behind it.

```
┌──────────────────────────────────────────────┐
│ Ω₀: Ledger + EventLog + κ-interpreter + B + G │
│ ports: Substrate · Scheduler · Memory · Judge │
│        Governor · Observer (all injectable)   │
└──────────────────────────────────────────────┘
```

| Kernel owns | Kernel never owns |
|---|---|
| `Ledger` (sole `append`), `EventLog` shape, `κ` interpreter, `B` arithmetic (`budgetAffords/charge/refusal` once), `G` interface + firewall typing, `fold/replay/verify` | Any inference rule, any LM call, any scheduling heuristic, any memory eviction policy, any price function |

Kernel API (complete):

```typescript
propose(t: Transaction): Promise<ProposalId>;
judge(id: ProposalId): Promise<ScoredClaim>;
reserve(id: ProposalId, b: Budget): Reservation | Backpressure;
execute(id: ProposalId): Promise<RawResult>;
verify(id: ProposalId, r: RawResult): Verdict;
commit(id: ProposalId): Event[]; // H3: no commit without events
```

Anything bypassing this path is a kernel bug, not a fast path.

## 4. Uniform Lifecycle (all cognition, one path)

```
Propose → Judge → Schedule → Reserve → Execute → Verify → Gate → Commit|Provisional|Defer|Reject|Degrade
                                                                          │ retry/shadow/simulate
                                                                          └─▶ Record(E*) → fold(State')
```

- **Propose:** any substrate (`NAL`, `MeTTa`, `LM`, `reflex`, `peer`, `self-mod`) emits candidates. Untrusted by construction.
- **Judge:** `Judgment Manifold` (or symbolic stub when degraded) scores `task_type · risk · feasibility · ambiguity · source_quality` in one batched pass. Low-risk fast path, high-risk full proof — same interface, different policy (judgment continuum). Priced judgment depth: cheap heads first, simulator/human only when risk × irreversibility warrants.
- **Schedule:** `κ` + `π` decide *what runs next*. Never the substrate itself (`H6`).
- **Reserve/Execute/Verify:** budget reservation first (`H5`); execution sandboxed by `CapabilityTier` + `CapabilityToken`; verification per portfolio (§4.1).
- **Gate:** four kernel gates collapse to one interface with four policies: `ingress (fail-closed) · egress/action (fail-open, risk-gated) · reward (axis-typed) · budget (afford/refuse)`. Declared once, configured per deployment. Orientation algebra: `interior = fail-closed`, `closure = fail-open`, `g1 ▷ g2` fallback chain.
- **Commit:** typed `Ledger.append`. `epistemic` commits require proof + independence flags; `teleological` commits require risk authorization; `provisional` commits carry ceiling + expiry.

Failure is a value: every stage returns `Verdict`, never swallows (`H9`); `degrade` yields a weaker-but-typed result (symbolic fallback, cached judgment, abstain+question).

### 4.1 Verification portfolio + simulation + failure algebra

One `Verifier` port, five policies composed per risk (`flexible.oc1` §verification, `ambitious.oc1` §portfolio, `meta.qw3` §V):

```typescript
type Verifier = 'exact-replay' | 'calibrated-judge' | 'independence-check' | 'simulation' | 'shadow' | 'human';
```

- `exact-replay`: standalone `verify-derivation` (zero engine deps, transcribed truth table, drift-pinned).
- `calibrated-judge`: manifold heads + isotonic thresholds + abstain bands.
- `independence-check`: evidence-lineage DAG disjointness; revision refused on shared lineage.
- `simulation` / `shadow`: counterfactual branch store (isolated, budgeted, discarded-or-promoted); self-mod requires `shadow-CI + external immutable runner + bake-off parity` before promotion.
- `human`: only for irreversible / high-blast-radius `T`; priced in `humanAttention` budget dimension.

```typescript
type Failure = { stage: Stage; polarity: 'fail-closed' | 'fail-open'; typed: FaultKind; fallback: Verdict };
```

Directional polarity: boundary failures close, interior degrades; every fault carries `correlationId + budget context + retry/shadow/degrade` path. No silent failure (`H9`); no irreversible action without risk classification + authorization (`H10`).

## 5. Control As Data — κ Replaces Hard-Coded Loops

Default SeNARS's rigidity (fixed macro 8-phase + micro 6-stage for-loop) becomes **one frozen program**:

```typescript
// default SeNARS = one κ string, not architecture
const defaultKappa = `perceive · attend · reason · authorize · propose · learn`;
const macroKappa   = `perceive · recall · reason · narrate · consolidate · act · record · announce`;
const servoKappa   = `sense · estimate · evaluate · decide · reserve · execute · verify · commit · settle · record · meta`; // cybernetic
```

| construct | form | use |
|---|---|---|
| sequence / choice / loop / guard | `a·b`, `a+b`, `a*`, `p?` | conditional stage graph (SG) |
| parallel / claim queue | `a ‖ b`, `queue(claims)` | blackboard (BB): stages pull highest-utility claims |
| learned emission | `π(state,history) → κ'` | meta-controller (MC): emits control words, never raw mutations |
| nesting / iteration | `a ↪ b`, `a^n` | operad / morphogenetic compositions (bio) compile to guarded `κ` |

`wf(κ)` decidable at load: no `infer → commit` without `verify`; every path budget-annotated; every mutation behind `★` cut-point (= `Ledger`); `abort: κ → 1` + `hotswap` only at stage boundaries. `MC` output is always a `κ` string — inspectable, replayable, diffable (`H6`).

**Scheduler ladder (only sanctioned escalation):** `fixed κ → SG → JC (judgment-budgeted) → BB → economic/priced → MC`. Each step pre-pays in provenance + budget observability (§6). Utility default `score = (ΔK+ΔG+ΔH)/(λC·C+λR·R+λH·H)`; thermodynamic option `P ∝ exp(-ΔF/T)` (§8) is a scheduler policy, same `κ` target.

### 5.1 Heterochronous tower + async horizon (bio/cybernetic/thermo)

Multi-rate execution without extra kernels: one `κ` interpreter, N clocks, one `Ledger`:

```
L0 reflex (preemptive, budget-capped, may bypass deliberation — never bypass Ledger)
L1 micro-tick (default κ) · L2 deliberation · L3 consolidation · L4 identity/constitution
```

- Higher configures lower, lower interrupts higher (reflex-interrupts-higher). Coordination only via `Ledger + Budget lattice` + `correlationId`.
- Async event horizon: `L0/L1` never block on `L2–L4`; slow layers publish `provisional` claims that fast layers may use at ceiling.
- Cybernetic reading: `e = reference − estimate` (drives/contradiction/pressure as error); objective `J = Σ γ^t(ΔK+ΔG+ΔH − αR − βC − λΦ)` maximized subject to `B + G + firewall`; Lyapunov/stability = boundedness + degradation ladder, not a second controller.

### 5.2 Topological presentation theorem (all topology lenses hosted)

Sheaf/manifold/CW/fibration vocabularies describe the **same** `κ + Ledger` machine:

| Topological claim | Kernel realization |
|---|---|
| local DAG sections + gluing | `κ` fragments + `queue.merge` (gluing = claim-queue union) |
| base `B` = causal DAG, `π: E → B` covering | `correlationId/parentId` DAG; replay = unique path-lift |
| spine `★` / cut-point law | `Ledger`: every write-path factors through `commit` |
| compactness / finite measure / polytope | boundedness (`H5`): `μ(C) < ∞`, exhaustion = `∂Π` faces = degradation modes |
| trust metric `g` / connection `∇` / price `ρ = dν/dμ` | `TrustProfile` scalar field + `Economy.price` function (no Riemannian machinery in kernel) |
| non-Hausdorff / `H¹` paraconsistency | contradiction tolerated as coexisting beliefs + `ContradictionSet` watch; consistency = asymptote |
| homotopy / 2-cell program identity | `κ`-equivalence checked as string/DAG equality at load, not runtime homotopy |

### 5.3 Cellular deployment (all bio lenses hosted)

Bio is a **deployment topology** over the same cell (= one `Ω₀` + one genome `κ` + membranes):

```typescript
type Cell = { membrane: Gate[5]; metabolism: Economy; genome: KappaRegistry; cytosol: MemoryPorts; nucleus: Governor; lineage: EventLog };
```

- Membrane = 5-channel gate (`ingress/egress/commit/signal/division`); firewall-as-membrane-typing.
- Organelles = `Proposer` registry (`NAL44 / MeTTa / neural / tool-I/F`); substrate isolation `H8` = organelle membrane.
- Genome = versioned/diffable/revertible `κ` + `Economy` + gate policies; editing is `self-mod T` (§11).
- Growth = governed protocols only: division (fail-closed, genome-inherit + membrane-clone), differentiation (stem → specialized via morphogen gradient = scheduler hints), apoptosis (ledger-sealed teardown), signaling graph (reconfigurable `queue` routes), shared metabolism (pooled `Budget` with transporters = transfer rules).
- Single-cell kernel runs the full spec; tissues/organs/organism/ecology are multi-cell profiles (§9), never a kernel change.

All synth control geometries compile to `κ`:

| Lens | Becomes |
|---|---|
| `universal/meta` KAT / 7-sort | canonical `κ` + `R=<S,C,B,G,V,M,P>` notation (this spec's language) |
| `topological` sheaf/DAG | `κ` with `‖` + locality tags; gluing = queue merge (§5.2) |
| `cybernetic` servo loop | `servoKappa` + `J` objective + tower clocks (§5.1) |
| `bio` cellular | deployment topology: cells run genome `κ`; membranes = gates (§5.3) |
| `math/category` coalgebra | semantics of `κ`: `tick = Commit(Judge(Φ_κ), G)`; `M = fold(L)`; verifier = independent functor |
| `thermodynamic` free-energy | budget/scheduling policy: `T` + `P ∝ exp(-ΔF/T)` inside `reserve/schedule` (§8) |

## 6. Guarantee Conservation

> Flexibility is bought with auditability. No free adaptivity.

| Gain | Mandatory payment |
|---|---|
| conditional branch / parallelism | branch event + guard value logged (`H3`) |
| claim-queue / BB reordering | priority + utility + preemption reason per claim |
| learned `π` / market pricing | inspectable `κ'` output + reservation ledger + shadow evaluation before promotion |
| provisional admission | ceiling + provenance + expiry + contradiction watch |
| self-mod proposal | sandbox + test suite + external/governed approval (`H4`) + rollback plan |
| reflex bypass / async horizon | bypass event + ceiling + post-hoc judgment |
| cellular division / differentiation | genesis/seal events + genome diff + lineage link |

Feasibility predicate `Φ(r)`: a configuration is loadable iff `H1–H6` typecheck + every fluidity feature declares its payment. Unpaid configs fail closed at load time.

## 7. Substrates — Islands, Never Fusion

Coexisting engines behind one `Proposer` port; arbitration boundary explicit:

```typescript
type Proposer = { id: OpId; propose(ctx: Ctx, b: Budget): Promise<Candidate[]> };
```

| Island | Role | Hard boundary |
|---|---|---|
| `NAL` (uncertain inference) | truth-preserving derivation with `{f,c}` + lineage | revision/independence laws; temporal projection explicit |
| `MeTTa`/e-graph (exact) | equality saturation, rewriting, types | never unions on NAR similarity; `definitional-equality ≠ uncertain-equivalence` (`H8`) |
| `LM/neural/reflex/peer` (System 1) | candidate synthesis, translation, value priors | `LLM_PRIOR` ceiling; shadow-validated; symbolic fallback on outage (`A5`) |
| `Manifold` heads | judgment/calibration, not generation | judges; never commits |
| `tools/actuators` | typed operator library (`cost/trust/event` signatures) | `ActionGate` + `CapabilityToken`; simulation before irreversible |

Rule tables are **loaded data** (versioned, enumerable, revertible); dispatch is exact kind-pair, no wildcards. Verifier (`verify-derivation`) shares no engine deps — drift pinned by test, not asserted. Distillation flywheel (`play → JudgmentDataset → train → calibrate → bake-off → head swap`) is a governed `self-mod T` (§11), never a side channel.

## 8. Resources As Economy (policy, not arithmetic)

Kernel arithmetic fixed (`BUDGET_RESOURCES` single table; `scopeLimitKey/scopeTerminationReason` derive from it). Policy pluggable:

```typescript
type Economy = { price(op: OpId, ctx: Ctx): Cost; allocate(claims: Claim[], b: Budget): Ordering; onExhaustion: 'backpressure' | 'degrade' | 'preempt' };
```

- Minimal: static quotas + `backpressure` refusal (embedded default).
- Full: reservations, dynamic pricing, market/thermodynamic allocation (`P ∝ exp(-ΔF/T)`, temperature `T` = explore/exploit knob), attention + risk + human-attention dimensions.
- Exhaustion never silently drops: refusal names dimension + reason; charge-beyond remainder = `backpressure` event (`H5/H9`).

### 8.1 Thermodynamic policy (all thermo lenses hosted, zero kernel change)

```typescript
type ThermoPolicy = { temperature(t: State): T; freeEnergy(c: Claim): F; entropy: S_max };
```

- `F = U − T·S`, `ΔF = E[epi] + E[prag] − λ·cost`; schedule by `P ∝ exp(ΔF/T)`; `T(t+1) = T + α(set−T) + β·curiosity − γ·risk`; `T` never reward-writable.
- Activation `ψ = w₁·surprise + w₂·utility + w₃·drive − w₄·age`; annealing `hot-explore → cool-commit → reheat-on-stall`.
- Entropy ceiling `S_max`: overflow triggers export (forgetting → consolidation into schemas / archive), never silent eviction.
- Laws restated operationally: shared-`T` scheduling; `ΔU = Q − W` (inflow minus committed work); `ΔS ≥ 0` per closed budget window unless exported to archive.

## 9. Scalability — Profiles From Minimal To Full

One codebase, declarative composition. A profile = `κ + scheduler + substrates + economy + governance + memory bounds + clocks`.

| Profile | κ | Scheduler | Substrates | Economy | Governance |
|---|---|---|---|---|---|
| `nano` (edge) | frozen 3-stage `perceive·reason·commit` | fixed | NAL only | static quotas | fail-closed, no self-mod |
| `default` (current SeNARS) | frozen 8+6 `κ` (§5) | fixed outer + adaptive inner (bags/focus) | NAL + MeTTa + LM-proposers + manifold | 4-dim budgets | 4 gates, autonomy ladder |
| `reflex` | `urgent?·fastpath + full` | preemptive L0 + L1 | reflex + NAL | capped bypass budget | post-hoc judgment mandatory |
| `sg` | conditional graph | SG | + claim queues | reservations | per-claim risk |
| `bb` | queue-driven `κ` | BB blackboard | + peers | utility ordering | capability tokens |
| `mc` | learned `π → κ'` | MC (shadow-promoted) | full neuro-symbolic | market/thermodynamic | simulation-before-action, rollback |
| `cellular` (bio deployment) | per-cell genome `κ` | local + membrane routing | per-cell subset | local + shared pools | division/differentiation protocols |
| `ecology` (deferred, `A6`) | federated `κ` set | collective BB | + delegation | provenance-fusion pricing | mutual-trust calibration, tokens |

Each `synth/` lens maps to a profile + policy choice (§5 table + App. A), not a rewrite. Future models = new profile file + optional port implementation; kernel untouched. `SpecLiteral` + `Φ` load-time check reject unpaid configs (§6).

## 10. Memory / Provenance / Observability

- **Event-sourced:** `Ledger` (SQLite/JSONL) is truth; snapshot is checkpoint only. `replay(fromSeq) → State` with `replay ∘ log ≅ id`; derivation records carry `premiseTruths + lineage DAG + independence`; standalone verifier replays without engine. Bounded retention + compaction allowed; correlation coverage never compacted away.
- **Memory fabric (all memory proposals hosted):** `working / semantic / episodic / procedural / counterfactual-branch / quarantine / archive` are all `Bag<T>`-shaped organs behind the same `MemoryPorts` (`ConceptReader/Writer, TaskAdmission, BeliefTable, GoalEnumeration, LinkPort, StatisticsView, SymbolIndex, MemoryClock, AttentionOwner`). Cycle depends on ports, never a god-object. Counterfactual/quarantine stores are isolated, budgeted, non-queryable by default; promotion is a judged `T`.
- **Causal IDs:** every `T/E/judgment/charge/commit` carries `correlationId + parentId`; gate spans join counters to events; Prometheus + REPL (`:judge`, `:health`, `:spend`) read the same ledger. Control decisions are in-ledger events (`H6`).
- **Forgetting:** decoupled decay (truth on invalidation/contradiction; priority on LRU; thermodynamic decay by predictive value); pressure → consolidation/sleep/induction as governed `T`, never silent eviction.

## 11. Governance / Adaptation (governed reflexivity)

Learning, strategy change, rule induction, head swaps, code patches are all `Transaction(op='self-mod')` with escalating authority:

```
proposal → shadow/simulation → bake-off parity → governed approval → commit → monitor → rollback?
```

- No self-approval (`H4`); autonomy ladder `observe-only → propose-only → sandbox → low-risk-auto → human-approved`. Filtration `F₀ params ⊂ F₁ strategies ⊂ F₂ rules ⊂ F₃ κ/topology ⊂ F₄ constitution`: modification at `Fₖ` requires approval above `Fₖ`; constitution outside the tower it governs.
- Proof-carrying modification: `shadowTrace + test suite + rollback plan` attached; architecture-search / genome-edit / head-swap / distillation all traverse this path.
- `ReflectionAPI`: `Reflect(κ, trace) → κ'` proposes only; application is a governed `T`. Drives/curiosity/imagination/consolidation/introspection (`EIG`, surprise, homeostatic error) are budgeted proposers, never controllers (`A7` containment).
- Trust calibration: source-reputation multiplier lowers ceiling only, never writes truth; digest-pinned artifacts (`ModelDigest = SHA256(encoder‖heads)`); unfitted heads report `fitted:false` and pass through.
- Multi-agent/delegation deferred until single-agent control stable (`A6` avoidance): when enabled (`ecology` profile), peer outputs enter as `PEER_AGENT`-ceilinged untrusted proposals with provenance fusion + collective calibration + capability tokens.

## 12. Shareability Refactor (what the current codebase owes this spec)

Dedup extractions that make §3–§11 real (spec, not plan — listed as required end-state congruences):

1. `core/control`: `κ` AST + interpreter + `CognitiveProgram` type; macro/micro loops become two `κ` constants + one `tick(κ)` function. Dead `tick.ts` 11-stage vocabulary removed.
2. `core/transaction`: `Transaction/Verdict/Economy/Gate/Judge` types — single import site; gates/proposers/schedulers depend on it, never duplicate it.
3. `core/ledger`: sole `append/commit` path; perception/action/reward/budget gates call it; no direct memory mutation API remains public.
4. `core/budget` (exists — extend): reservation + pricing + `ThermoPolicy` hooks; scope table declares dimension only.
5. `nar/memory/ports` (exists — enforce): cycle modules import ports; `memory:ports` gate fails on god-object import; fabric organs register behind ports.
6. Rule tables + `HEAD_SPECS` + boundary fragments stay as the three declarative registries (already the pattern — extend to `κ` profiles + `Economy` policies + genome registry).

Eliminated redundancy (either/or resolved):

| Before (duplicated) | After (once) |
|---|---|
| macro-phase list × micro-stage list × dead `tick.ts` stages | one `κ` language, three constants |
| 4 gate impls × manifold judges × NAL veto × egress checks | one `Gate` interface; policies as data |
| budget counters × scope table × spend summaries × refusal strings | one `BUDGET_RESOURCES` table + `Economy` policy |
| LM-rule matrix × V2 matrix × reflex policies × peer delegation | one `Proposer` port; matrices become registrations |
| 15 `space.*` coordinate notations (7-sort/12-genome/37-dim/29-axis/…) | one `R=<S,C,B,G,V,M,P>` + `κ` + `Φ`; old genomes render as profile coordinates |

## 13. Conformance

A build claims this spec iff: `H1–H6` hold by type + gate test; `tick(κ)` runs `nano` and `default` profiles byte-identical to legacy paths with System-One-off; every `commit` replays from `EventLog` (`replay ∘ log ≅ id`); every scheduler decision diffs as `κ`; `mc/cellular/thermodynamic` profiles load as data-only additions with kernel diff = ∅; `Φ` rejects unpaid configs fail-closed.

## Appendix A — Complete `synth/` Coverage (27/27)

Every file below hosts as profile + policy + port registration. Kernel diff = ∅ in all rows.

| File | Control claim | Host (§) |
|---|---|---|
| `ambitious.oc1` SeNARS⁺ plane | 10-step commit pipeline, 3-layer scheduler, memory fabric, verification portfolio, drives | §4 + §4.1 + §5 + §10 + §11 |
| `ambitious.qw1` conditional graph | `ControlGraph` DAG + heterochronous tower + autonomy + shadow-CI | §5 + §5.1 + §11 |
| `flexible.oc1` UCP | 14-step lifecycle, blackboard, counterfactual, simulation, introspection, arch-search, L1–L5 scaling | §4 + §4.1 + §9 (`bb→ecology`) + §11 |
| `flexible.qw1` AEGIS DAG | 4-axis content, 3-level firewall, market/thermo option, tower + drives, `SpecLiteral` + tokens | §2.1 + §5 + §8.1 + §9 |
| `universal.qw1` Ω-Calculus | KAT `𝒞` × 3 presentations, 8-sorts, guarantee conservation | §5 (canonical notation) + §6 |
| `universal.qw2` UCCP | guarded parallel DAG + Boltzmann + 4-loop async horizon + filtration | §5 + §5.1 + §8.1 + §11 |
| `meta.qw1` Ω 7-sorts | `R=<S,C,B,G,V,M,P>` + `ControlWord` + `ConditionalDAG` + `Φ` ops | §5 (canonical) + §12 |
| `meta.qw2` recursive algebra | tower of interpreters, `Reflect`, resource semiring, admission lattice | §5.1 + §8 + §11 (`ReflectionAPI`) |
| `meta.qw3` ULTIMA | 8-tuple, `S0–S4` ladder, `Γ` risk surface, priced judgment, `EIG` | §4.1 + §5 + §9 + §11 |
| `math.qw1` unified calculus | 4-plane octuple, revision algebra, `wf/abort/hotswap`, dual charts | §2.1 + §4.1 + §5 + §8.1 |
| `math.qw2` NOUS | coalgebra lifecycle, gate lattice + firewall ideal, filtration, L1–L10 | §5 + §6 + §11 |
| `math.qw3` NOEMA Kleisli | graded monad `bind_{r,s}`, 7 axioms, nucleus gates, epi replay split | §4 + §5 (`wf`) + §10 (`replay∘log≅id`) |
| `bio.qw1` ACS | cell/organism, membrane algebra, genome registry, autopoiesis | §5.3 + §9 (`cellular`) |
| `bio.qw2` AUTON | operad composition, polarity field, tower, division protocols | §5 + §5.3 + §11 |
| `bio.qw3` CYTOS | 8-sorts, 5-channel membrane, organelle registry, stem pool, shared metabolism | §5.3 + §7 + §8 |
| `thermodynamic.qw1` Θ | free-energy postulate, 3 laws, `T`-dynamics, annealing, landscape | §8.1 + §5.1 |
| `thermodynamic.qw2` control plane | 7 axioms, `EIF`, revision/forgetting-as-decay, flywheel, blended meta-controller | §8.1 + §10 + §11 |
| `thermodynamic.qw3` HELMHOLTZ | `F=U−T·S≤Φ`, entropy ceiling/export, heterochronous slices, failure polarity | §8.1 + §4.1 + §5.1 |
| `category.qw1` ℜ coalgebraic | `α:X→F(X)`, 5 generators, quantale, cofree provenance, filtration | §5 (semantics) + §8 + §10 |
| `category.qw2` cognitive coalgebra | pointed coalgebra, topos firewall, trace `νF`, `W`-monad pricing | §2.1 + §5 + §10 |
| `category.qw3` unified coalgebraic | container + linear `⊗`/`!`, attitude fibration, traced iteration | §2.1 + §5 (`wf`) + §8 |
| `topological.qw1` ℭ manifold | fibered `E→B`, sheaf gluing, budget connection, trust metric | §5.2 (presentation theorem) |
| `topological.qw2` ATLAS | CW-complex paths + homotopy, measure pricing, spine `Λ` | §5.2 + §8 |
| `topological.qw3` fibration F | 2-complex + `★` cut-point, flat connection, polytope/simplex pricing | §5.2 + §4 (★ = Ledger) |
| `cybernetic.qw1` AEGIS servo | 11-step loop, Lyapunov, actuator library, portfolio, drives | §5 (`servoKappa`) + §5.1 + §4.1 |
| `cybernetic.qw2` five-plane | L0–L4 tower, coupling laws, `Ẋ` dynamics, arbitration algebra | §5.1 + §7 |
| `cybernetic.qw3` control plane | 11-tuple, `J` objective, kinded governance, tick/meta-tick/reflex-arc | §5.1 + §9 + §11 |

Open/beyond items flagged inside synth files (ensemble mutual-trust, paraconsistent saturation, continuous-time revision, full organism organs, federated fusion) all route to the deferred `ecology` profile — specified interfaces (§11), no kernel debt.

## Appendix B — Laws (math/category restated operationally)

`state = fold(log)` · `replay ∘ log ≅ id` · `Hom(Reward, Truth_B) = ∅` (`H1`) · `∃! commit: Judged → Ledger` (single authority) · `ν` revision non-idempotent + independence predicate · `reset ∘ reset = reset` · natural `abort` · closed KAT + `wf(κ)` · `F₀ ⊂ … ⊂ Fₙ`, constitution outside tower (`H4`) · `exact ⊥ similarity` coproduct isolation (`H8`) · `M2` grade linearity `r+s` on `bind` · conservation: adaptivity spend ≤ provenance income (§6).
