# TODO19.md — One Seam Deep: NARBuilder, the Cognitive Component Library & ReasoningGame

**Version:** 1.0 (2026-09-21) · executes TODO18.md §1.5/§1 (proposal) · lineage: TODO17b.md (complete) · TODO17.md (System One arcade)
**Philosophy:** *One seam — `Game` — was the insight. This plan builds the machinery that makes every other construct cheap: agents assembled declaratively, cognition decomposed into shared sensors/actions/rewards, reasoning playable, and the learning loops closed. Every redundancy below is unified or collapsed through abstraction and adapters — nothing is built twice.*

**Core Principle:** *One assembly path, one parameter table, one component library; presets are data, builders are code, and every claim has a bench.*

---

## 1. Phases & Items

### Phase 0 — NARBuilder & the Assembly Kernel (foundational; everything composes through it)

- **F1. `NARBuilder`** — the single Factory/Builder for constructing NARs. Fluent steps (`withLM`, `withSystemOne({tier, heads})`, `withCapabilities`, `withGates`, `withParameters`, `withPersistence`), each validating + recording what it assembled; `build(): WiredNAR` exposes `describe()` (the dependency graph). Honest defaults: a step not called ⇒ subsystem **absent**, never stubbed; `build()` throws typed `BuilderError` on inconsistent specs (tier-2 cortex without LM). Port `createAgent`'s inline wiring into builder steps; entry points (`bot-ai`, `mcp-server`, `repl`, `arcade`, `multi-agent-runner`) shrink to load-spec → build → transport. | anchor `nar/src/agent/index.ts:125-260`, entry points in `src/bin/*`
- **F2. Per-instance gate registry** — `createGateRegistry()` replaces the process-global singleton; builder-injected. Retires the D0 reset-helper as a *design*; enables two domain agents in one process with isolated autonomy modes/allowlists/veto state. | anchor `nar/src/kernel/index.ts`
- **F3. `NARProfile` presets** — named spec data (`conversation`, `tool-use`, `research`, `device`, `arcade`) the builder consumes. The `device` profile asserts tier-0 truly skips LM imports at runtime. Profiles are data; nothing is hardcoded twice.
- **F4. Unified `CapabilitySurface`** — collapse the ad-hoc toggles (`enableSelf`, `lmRules.enabled`, `systemOne.enabled`, `cognitive`, `manifold.provider`, `schemaInduction`) into `{ enabled, tier, params }` declarations; uniform validation; disabled-path-byte-identical generalized as a rule every capability states. | anchors `src/config/schema.ts`, `nar/src/focus/GameFocus.ts` options
- **F5. Unified `ParameterTable` with ownership** — every parameter is `{ scope: 'system' | 'game:<id>', min, max, owner }`; config seeds it, SelfMetaGame/MetaGame actuate through it. **Collapses the three parallel tables**: SelfMetaGame's knob switch-case (`applyKnob`), `CognitiveParameters`, and the zod schema become one table + adapters. MetaGame per-game specialization (TODO18 §1e) gets its substrate for free; game-local tables are scopes of the same abstraction. | anchors `nar/src/game/SelfMetaGame.ts:137-187`, `nar/src/config/cognitive-parameters.ts`, `src/config/schema.ts`
- **F6. `ReflexAdapter` composition** — promote the arcade's local `RecordingReflex` + prefetch-forwarding into `nar/src/reflex` as composable wrappers: `forwarding`, `recording`, and **veto-aware demotion** (V2 below lands inside this adapter, not in each reflex). One wrapper chain API replaces per-script plumbing. | anchor `scripts/arcade.ts:110-149`

**Acceptance.** All entry points construct via the builder (≈0 hand-assembled components left); two-profile one-process smoke with gate isolation; `BuilderError` + disabled-path benches; ParameterTable adopted by SelfMetaGame (its `applyKnob` switch deleted); arcade reflex plumbing deleted in favor of F6.

### Phase A — The Cognitive Component Library (sensors · actions · rewards)

- **C1. Registries.** `SensorRegistry` / `ActionRegistry` / `RewardRegistry` in `nar/src/cognition/` — each component a pure, named, seeded unit with a contract: sensors never mutate; actions carry `{cost, tier, executor}` and route through kernel gates; rewards score outcomes via System One heads and stay firewall-classified (`extrinsic` → policy-weights only).
- **C2. Seed sensors** (collapse existing duplicate sources): `BagPressureSensor`, `TaskTypeMixSensor`, `DerivationBacklogSensor`, `VetoHandoverRateSensor`, `HeadHealthSensor` (**adapter over the `pnpm status` report — one health source, two consumers**), `SpendSensor`, `GovernanceQueueSensor` (over `SelfMetaGame.getGovernanceQueues()`).
- **C3. Seed actions**: `cycle`, `revise`, `spawn_subgoal`, `clarify`, `consolidate`, `ask_lm`, `rest`, `tune(<param>, v)` — the last bound to the ParameterTable by ownership (F5): game-local scope only; system knobs unreachable outside the SelfMetaGame (enforced via domain-tagged operation strings + ActionGate + `CrossDomainError`).
- **C4. Seed rewards**: `GroundednessReward`, `TaskSettledReward`, `AmbiguityReductionReward`, `SpendEfficiencyReward`, `VetoPenalty`, `ConsolidationReward` — weighted composition per game; weights are game parameters.
- **C5. `MetaGame` rebuilt on the library** — its hardcoded `legalActions` (`^focus_weight(...)` literals) become library actions over the ParameterTable: the existing MetaGame class collapses into a thin spec (dedup: no bespoke meta-action list). SelfMetaGame keeps its system scope.

**Acceptance.** Component-contract bench (purity, fail-closed sensors, gate-routed actions, firewall-classified rewards); sensor-parity bench (SelfMetaGame and a game reading the same state get identical features); scope-enforcement bench (game-scoped `tune` cannot reach system knobs).

### Phase B — ReasoningGame: reasoning is a Game

- **R1. `ReasoningGameSpec` + `createReasoningGame(spec, agent)`** — `{ id, sensors, actions, rewards, tier, params }` assembled from the library, registered in the **game registry** (no new CLI path: `--games reasoning:conversation` works through the existing `GameRegistry`). Per-domain presets: conversation (clarify-heavy, spend-dominant), tool-use (dispatch-heavy, groundedness-dominant), research (consolidate/subgoal-heavy). Eval task suites are spec config.
- **R2. Strength tiers** — tier gates `legalActions` + sensor set, mapping the Cortex Ladder onto action availability: tier-0 reflex (cheap sensors, `cycle`/`revise`/`rest`), tier-1 manifold-scored, tier-2 cortex ops (`ask_lm`…), tier-3 NAL-governed (veto + seeded meta-rules). Dynamic escalation within `ReasoningBudget` on ambiguity/novelty.
- **R3. `ReasoningMetaGame`** — the specialized per-game MetaGame (F5 scopes): reward-weight/difficulty/sensor-set tuning for one ReasoningGame instance.
- **R4. Falsification set** (each a bench):
  1. assembled arm ≥ default scheduler arm per domain (fixed suite, same seed; settled-fraction + token spend);
  2. kernel gates fire on reasoning ops exactly as on game actions (fault-inject `judgeBatch` ⇒ fail-closed);
  3. tier gating (tier-0 never offers `ask_lm`);
  4. scope enforcement (cross-scope `tune` rejected; SelfMetaGame op applies);
  5. NAL veto transplanted (seeded rule ⇒ trap never executed post-first-veto; rule-free ⇒ zero vetoes);
  6. sensor parity (bench from C-phase reused);
  7. schema induction promotes real meta-rules surviving episodes.

**Acceptance.** Two domain specs playable in one arcade run; `reasoning:*` in the summary table; lm arm's prompt becomes "which cognitive operation next?" (prompt template from the spec's action legend).

### Phase C — Closing the learning loops

- **L1. Veto-aware demotion (V2)** — lands as the `ReflexAdapter.vetoAware` wrapper (F6): actions with `LearningEvent.overriddenBy` set are demoted in proposal ordering. Falsification: veto rate per episode drops while return does not.
- **L2. MC-return labels (V3)** — implemented as a **`LabelSource`**, not a train.ts special case: an `McReturnLabelSource` adapter folds discounted returns into `JudgmentDataset` (dedup: reuses the existing label-sources pipeline). Falsification: Brier/ECE improves on short-episode games at equal episode counts.
- **L3. Cross-game value head (V4)** — shared `reflex_value` trained across all registry games (+ `game` feature). If it loses to per-game heads on held-out seeds, record why and keep per-game heads honestly. Bench: shared ≥ per-game.
- **L4. `SchemaStore` — persistent schema induction (unifies N2 + G1)** — one sidecar store of promoted schemas per (scope, id); arcade episodes *and* the conversational agent read/write it through the same API (the substrate-wide "agent learns its own domain rules" story lands as the same abstraction). Falsification: second run starts with the first run's schema count and improves return; rps agent exploits the rotation once schemas persist.

### Phase D — Reachable high-value polish

- **P1. Same-run NAL A/B (N1)** — paired rule/no-rule episodes at the same seed; the summary reports the veto's effect directly.
- **P2. SDE-style verify cascade helper (S1)** + consensus fan-out as a budget knob (S2) — both thin compositions over existing primitives.
- **P3. Tetris LM cascade (S3)** — `PlacementCascadeReflex` into the lm arm.
- **P4. Arcade replay report (O2)** — HTML over `.reports/arcade.json`; doubles as the ReasoningGame demo surface.
- **P5. External-env example (O1)** — `examples/` non-builtin `Game`; doubles as the builder's third-profile smoke.
- **P6. Fast/slow test lanes (O3)** — generalize the `test:load-sensitive` pattern.
- **P7. WASI device head (G3, within reach)** — the `device` profile's tier-0 head bundled sandboxed; deferred only if P1–P6 exhaust the cycle.

---

## 2. Falsification Benches (41–46)

| # | Bench | File | Obligation |
|---|-------|------|------------|
| 41 | **Assembly Integrity** | `tests/nar/todo19-builder.test.ts` | Builder graph accurate; `BuilderError` on inconsistent specs; absent-step ⇒ absent subsystem; profiles resolve; entry points build via NARBuilder (grep-guard on hand-wiring). |
| 42 | **Gate Isolation** | `tests/nar/todo19-gates.test.ts` | Two agents/registries in one process: autonomy/allowlist/veto changes in A don't affect B; reset helper retained only for suites that share. |
| 43 | **Component Contracts** | `tests/nar/todo19-components.test.ts` | Sensor purity + fail-closed; action gating + tier filtering + scope enforcement; reward firewall classification; ParameterTable adoption (SelfMetaGame switch deleted); sensor parity. |
| 44 | **ReasoningGame Falsification** | `tests/nar/todo19-reasoning.test.ts` | R4 items 1–7, including the NAL transplant and meta-rule persistence via SchemaStore. |
| 45 | **Learning Closure** | `tests/nar/todo19-learning.test.ts` | Veto demotion (L1); MC-return label source (L2); shared-vs-per-game head bake-off (L3); persistent schema improvement (L4). |
| 46 | **Domain Deployment** | `tests/nar/todo19-profiles.test.ts` | `device` profile skips LM import at runtime; two-domain one-process smoke; profile-driven arcade arm; ParameterTable/config roundtrip. |

---

## 3. Decision Points

| # | Question | Default proposal |
|---|----------|------------------|
| DQ1 | Profile preset set for Phase 0 | `conversation`, `arcade`, `device` first; `tool-use`/`research` with Phase B |
| DQ2 | `ReflexAdapter` API — wrapper chain vs interface extension | Wrapper chain (composition over inheritance; reflexes untouched) |
| DQ3 | MC-return discount default | γ=0.95, per-game override via spec params |
| DQ4 | ReasoningGame eval suites | Reuse existing eval fixtures; new suites only where a domain lacks one |
| DQ5 | `ParameterTable` home | `@senars/nar/config` (imported by kernel/game/self layers); zod schema seeds it via adapter |

---

## 4. Rollback

| Phase | Trigger | Action |
|-------|---------|--------|
| 0 | A builder regression | Items are local; entry points can re-pin to the old assembly path per call site (kept as a deprecated shim until Phase A acceptance) |
| A | Component contract red | Registries are additive; games keep direct assembly until each spec migrates |
| B | ReasoningGame arm < scheduler | Domain specs are data — narrow the spec (fewer ops/sensors) before touching code |
| C | Head bake-off red | Per-game heads remain the default; shared head is opt-in |
| D | Polish misbehaves | Each item independent; P7 gated behind the `device` profile flag |

---

## 5. Master Checklist

**Phase 0:** F1 NARBuilder · F2 gate registry · F3 profiles · F4 CapabilitySurface · F5 ParameterTable · F6 ReflexAdapter → [ ] Benches 41, 42
**Phase A:** C1 registries · C2 sensors · C3 actions · C4 rewards · C5 MetaGame collapse → [ ] Bench 43
**Phase B:** R1 specs · R2 tiers · R3 ReasoningMetaGame · R4 falsification set → [ ] Bench 44
**Phase C:** L1 veto demotion · L2 MC-return LabelSource · L3 cross-game head · L4 SchemaStore → [ ] Bench 45
**Phase D:** P1–P7 → [ ] Bench 46

---

## 6. Definition of Done

```text
One assembly path           One component library         One learning loop
─────────────────           ──────────────────────        ─────────────────
agents built, not wired     sensors never lie             demotion from vetoes
profiles are data           actions gated + scoped        returns, not rewards
gates per instance          rewards pay the same toll     schemas persist across runs
capabilities declarative    tiers = action availability   one head, many games

One seam: reasoning IS a game — and the tournament table knows it.
```

---

## 7. Build Order & Leverage Notes

**Foundational-first:** Phase 0 is the unlock — NARBuilder + per-instance gates make agents cheap to instantiate and safe to compose; F5/F6 are the abstractions that *prevent* the redundancy the later phases would otherwise create (a second parameter table, a second reflex wrapper). Phase A is the vocabulary; Phase B is the payoff; Phase C closes the loops Phase B opens (and lands as adapters/label-sources — no special cases); Phase D is within reach and sharpens the tools.

**Highest-leverage single items:** F2 (gate isolation — unblocks everything multi-domain), R1+R2 (the premise made real), L4 (SchemaStore — the smallest item with the largest story: the agent that keeps its lessons).

**Deduplication ledger (nothing built twice):** `RecordingReflex` → F6 · SelfMetaGame knobs → F5 · MetaGame action literals → C5 · `pnpm status` health & governance queues → C2 adapters · V2 → F6 wrapper · V3 → label-sources pipeline · N2+G1 → L4 SchemaStore · ReasoningGame CLI → existing GameRegistry · P5 → builder smoke.

*Proposal rationale lives in TODO18.md (§1 component library, §1.5 NARBuilder); this file is the executable plan.*
