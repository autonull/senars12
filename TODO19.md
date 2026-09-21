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

**Phase 0:** F1 NARBuilder · F2 gate registry · F3 profiles · F4 CapabilitySurface · F5 ParameterTable · F6 ReflexAdapter → [x] Benches 41, 42 ✅ (commit 69cf414)
**Phase A:** C1 registries · C2 sensors · C3 actions · C4 rewards · C5 MetaGame collapse → [x] Bench 43 ✅ (`nar/src/cognition/`)
**Phase B:** R1 specs · R2 tiers · R3 ReasoningMetaGame · R4 falsification set → [x] Bench 44 ✅ (R4.7 covered by L4)
**Phase C:** L1 veto demotion · L2 MC-return LabelSource · L3 cross-game head · L4 SchemaStore → [x] Bench 45 ✅ (L3 real bake-off landed — see session 3 notes)
**Phase D:** P1 NAL A/B ✅ · P2 SDE verify cascade + consensus fan-out budget knob ✅ (`nar/src/lm/system-one/verify.ts`) · P3 landed (`nar/src/lm/system-one/cascade-reflex.ts`, wired at `scripts/arcade.ts:155`) · P4 arcade replay HTML report ✅ (`scripts/arcade-replay.ts`, `pnpm arcade:replay`) · P5 external-env example + builder third-profile smoke ✅ (`examples/external-env.ts`) · P6 fast/slow lanes ✅ · P7 landed (`withDeviceHead` builder step — see session 3 notes) → [x] Bench 46 ✅

### Progress Notes (2026-09-21 — implementation session)

- **Landed:** all Phase 0–C items + P1/P6. Benches 41–46 exist and pass
  (`tests/nar/todo19-{builder,gates,components,reasoning,learning,profiles}.test.ts`,
  207 files green on `pnpm test:unit`).
- **Key files:** `nar/src/agent/builder.ts` + `profiles.ts` (F1/F3), `nar/src/kernel/GateRegistry.ts`
  (`createGateRegistry`, F2), `nar/src/config/parameter-table.ts` (F5), `nar/src/reflex/adapters.ts` (F6/L1),
  `nar/src/cognition/{types,sensors,actions,rewards,registries,meta-spec,ReasoningGame,ReasoningMetaGame}.ts` (A+B),
  `nar/src/lm/system-one/mc-return.ts` (L2), `nar/src/focus/schema-store.ts` (L4), `nar/src/focus/nal-ab.ts` (P1).
- **Entry points:** `createAgentFromEnv` (bot-ai/repl/mcp/senars) and `multi-agent.ts` all build via
  `NARBuilder.fromProfile(...)`. `SeNARSFactory` remains for tests/legacy paths — candidate for full retirement.
- **ParameterTable:** SelfMetaGame knobs are system-scoped entries with actuator closures; the `applyKnob`
  switch is deleted; `tune` actions are scope-enforced via `ParameterScopeError` (game scopes cannot reach
  system knobs — benched).
- **ReasoningGame:** assembled from library defaults when a spec omits sensor/action/reward lists; domain
  presets registered via `registerReasoningGames(registry)`; eval tasks are spec data (deterministic per seed).
  `legalActions` include `settle`/`finish` episode-control ops.
- **L3 decision (honest):** the shared-value-head bake-off was recorded as data-policy, not run end-to-end:
  per-game heads stay the default unless a full held-out bake-off shows the shared head winning. Wiring the
  real bake-off (train `reflex_value` with a `game` feature across registry games) is the main remaining lift.
- **Remaining work:**
  - ~~**L3 bake-off**~~ → **landed** (session 3, below).
  - ~~**P3**~~ → already landed in `cascade-reflex.ts` + `scripts/arcade.ts` (session 3 audit).
  - ~~**P7**~~ → **landed** (session 3, below).
  - ~~**SeNARSFactory deletion**~~ → **landed** (session 4, below): call sites migrated, class deleted,
    kernel-construction helpers retained as plain functions for tests/benches.
- **Progress (second session, 2026-09-21):**
  - **P2 landed** as `nar/src/lm/system-one/verify.ts`: `verifyCascade` (SDE-style — stage-1
    `truthProbability` routes through `ConfidenceRouter` bands; stage-2 evidential verification only on
    review/block; `act` never re-verified) + `fanoutWithinBudget`/`consensusFanout` (consensus k clamped to
    remaining `maxLMCalls − consumed.llmCalls − charged`, floor 1 — exhaust degrades to a single judgment).
    Benched in `tests/nar/todo19-verify.test.ts` (band routing, abstain short-circuit, budget clamping).
  - **P4 landed** as `scripts/arcade-replay.ts` (`pnpm arcade:replay`): HTML over `.reports/arcade.json`
    (default out `.reports/arcade-replay.html`); summary table + per-game per-arm action strips colored by
    reward valence, handovers outlined. `.reports/**` added to biome `files.excludes` (generated artifacts
    must not be linted). Doubles as the ReasoningGame demo surface — `reasoning:*` arms render if logged.
  - **P5 landed** as `examples/external-env.ts`: non-builtin `ThermostatGame` (exported) registers into a
    plain `GameRegistry` and plays through `GameFocus` with `TabularQReflex`; also asserts the
    `device` profile builds LM-free via `NARBuilder.fromProfile('device').build()` (third-profile smoke).
  - **R4.2 closed**: dedicated fault-injection bench appended to Bench 44 — faulted `judgeBatch` +
    `ManifoldReflex` over `GameFocus.setReflexPrefetchContext`: prefetch failure leaves the table cold,
    ticks resolve, the episode progresses on the incumbent fallback, no panel veto spam.
- **Gotchas (P5):** the example's first reflexes deadlocked on action `"0"` — zero-value/zero-confidence
  proposals all tie at `value×confidence = 0` and argmax keeps the first legal action; `EpsilonGreedyReflex`
  never escapes (exploration only perturbs `value`, and `count` only grows for the action already chosen).
  `TabularQReflex` (epsilon-shuffle exploration + visit-count confidence) escapes — use it for cold-start
  examples. Also: `GameFocus` executes actions as strings; `Game.step` implementations typed for numbers
  must `Number(action)` the argument.
- **Progress (third session, 2026-09-21):**
  - **L3 landed for real** as `bakeOffSharedHead` in `nar/src/lm/system-one/train.ts`:
    `TrainingRow.game?` + `gameFeatureDim` option (dense hashed game block appended after the
    Hadamard action block, seed `0x85ebca6b`); `TrainedLinearHead.score(embedding, action, game?)`
    and `evaluate` parse `game (\S+)` from the instruction. The bake-off splits each game's rows
    deterministically (mulberry seed), trains shared (game-featured, pooled) vs per-game
    (gameFeatureDim 0) arms, scores both on identical per-game holdouts, and adopts the shared head
    only if it does not lose on any domain (`verdict: 'shared' | 'per-game'`). Bench 45's
    data-policy placeholder replaced with three real tests: transfer regime (scarce per-game data ⇒
    shared viable), honest-loss regime (game×state *interaction* — the additive game block cannot
    represent it ⇒ per-game kept), and input validation. Naming: `SharedHeadBakeOff{Options,Result}`
    — `BakeOffResult` was already taken by distill's head-promotion bake-off.
  - **P7 landed** as `NARBuilder.withDeviceHead({ wasmPath, modelDigest, dimension })` +
    `NARProfileSpec.deviceHead` data: the tier-0 head is the existing zero-import WASM bundle
    (`wasi-head-bundle.ts`, TODO17 D5/X27), loaded at `build()` through the sandbox posture
    (SHA256-pinned, fail-closed `BuilderError` on digest mismatch) and exposed as
    `WiredNAR.deviceHead`. Dimension is bound at evaluate time (wrong-dim ⇒ throw), not at load.
    Benched in Bench 46 (parity with direct `loadHeadBundle`, subsystem presence, digest-mismatch
    rejection, dimension fail-closed). The `device` profile itself stays headless by default —
    bundles are offline artifacts; profiles declare them as data when present.
  - **SeNARSFactory call sites migrated** (`src/bin/status.ts`, `src/bin/self-report.ts`,
    `src/cli/narsese-repl.ts` → `NARBuilder.withLM(...).withNarConfig(...)`); factory marked
    `@deprecated` for tests/legacy. Note: builder build() also runs `createAgent` — fine for these
    CLIs, but test sites needing a bare `new NAR(...)` can keep the factory until deletion.
  - **P3 audit**: already implemented (`cascade-reflex.ts` `PlacementCascadeReflex` + stage-2
    top-K fan-out, consumed at `scripts/arcade.ts:155`, benched in `todo17-games.test.ts`) — the
    "deferred" checklist note was stale; nothing to build.
  - Fixed a pre-existing typecheck error in `todo19-reasoning.test.ts` (`registry.create` returns
    `Game`; the ReasoningGame assertion needed a cast).
- **Gotchas (session 3):** don't name new exports `BakeOffResult`/`BakeOffOptions` in
  `system-one/` — distill.ts already owns them; biome rejects assignment-in-expression (write LCGs
  as statements); `wasi-head-bundle.js` imports failed as a *static* vitest import from a test that
  also imports `train.js` (circular resolution) — the dynamic `await import(...)` pattern used by
  `todo16c-train.test.ts` is the reliable one.
- **Progress (fourth session, 2026-09-21): SeNARSFactory + factory module retired.**
  - The factory module itself is gone: `nar/src/factory.ts` → `nar/src/nar-presets.ts`, exporting
    plain kernel-construction presets over `new NAR`: `createNAR(options)` (default: LM rules on,
    isolated registry/event bus — same semantics as the old `createDefault`), `createBotNAR({maxConcepts})`,
    `createMinimalNAR()`, `createTestNAR({maxConcepts, lmService})` (decay off, small depth). The
    `SeNARSFactory` class, `fromConfig`, `createForCLI`, and the `createWithStrategies`/`createCognitive*`
    variants are deleted (none had external callers). `SeNARSConfig` type export dropped; `SeNARSOptions`
    kept. The `@senars/nar/factory` subpath no longer exists; the last three test importers migrated to
    `@senars/nar`. `tests/nar/unit/factory.test.ts` → `nar-presets.test.ts`.
  - All ~20 test files, 4 scripts, and `examples/systemone-ingress.ts` migrated; the only remaining
    `SeNARSFactory` mention in code is the grep-guard assertion in `todo19-builder.test.ts:90`.
    Full `pnpm test:unit` green (208 files, 1772 tests).
  - Design note: bare-`NAR` construction for tests/benches is intentionally *not* routed through
    `NARBuilder` — the builder's `build()` also assembles the Agent transport, which benches and kernel
    unit tests neither need nor want. "One assembly path" applies to *agent* assembly; kernel
    construction is a one-line `new NAR(config)` and lives as plain preset functions, not a class.
- **Gotchas discovered:**
  - Narsese terms reject hyphens — rule atoms must use underscores (`nal_ab`, not `nal-ab`).
  - `Bag.ts` task sampling uses unseeded `Math.random`; with `isolate: false` the module-load order
    perturbs RNG streams — any bench relying on veto *timing* must pin a deterministic LCG
    (see `todo17b-nal-arm.test.ts` `pinDeterministicRNG`).
  - Load-sensitive suites (`todo16-slo`, `rl/parity-*`, `budgetgate-verification`, `todo17b-failclosed`)
    flake under full-suite load; they now live on the `test:load-sensitive` lane (P6).
  - `./config/parameter-table` export was added to `nar/package.json` (mirroring the
    `cognitive-parameters` entry); the `./agent/*` wildcard already covered the builder.

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

### Improvement Notes (non-binding; revisit at phase boundaries)

- **GPU/TS training backends (considered 2026-09-21).** PyTorch-like options for the in-house trainer (`nar/src/lm/system-one/train.ts`): **TensorFlow.js** (`tfjs-node-gpu` CUDA binding; WebGPU backend for browser/device contexts) is the only mature TS-native *training* framework; **ONNX Runtime** is inference-first (training requires Python-exported models — doesn't help author loops in TS); raw **WebGPU compute shaders** are a zero-dependency middle path (hand-written matmul/SGD kernel, fits the WASI/device story, P7). Burn/Candle/MLX rejected (not TS). Current heads are linear/logistic over a frozen backbone — GPU is pure overhead at this scale. Only earn it if Phase C bake-offs demand MLP reward models or sequence-level value heads. If adopted: parameterize `train.ts` behind a `HeadTrainerBackend` interface (`in-house-sgd` default, optional tfjs backend), falsified by identical weights digests on small problems + wall-clock parity at current scale. Deliberately *not* a plan item: the backend abstraction is a second trainer if we never need it.
- **transformers.js toolChoice limitation — RESOLVED (2026-09-21).** `localModel` (`nar/src/lm/providers.ts`)
  now wraps the transformersJS model in a `wrapLanguageModel` middleware that strips `toolChoice`
  (the AI SDK resolves an absent choice to `{type:'auto'}`, tripping the provider's unsupported-setting
  warning; transformers parses tool calls from fenced JSON, so the hint is meaningless).
- **Provider default flipped to llama.cpp (2026-09-21).** Speed-first: `lmDefaults.provider`
  (`src/config/schema.ts`) and the env-config auto-detect fallbacks (`nar/src/lm/env-config.ts`,
  `defaultLocalProvider()`) resolve to `llamacpp-embedded` when a GGUF is configured
  (`LM_LLAMACPP_MODEL` set + file exists — sync `existsSync` check), else degrade to transformers.
  `createSeNARSRegistry` gates the embedded slots on the same check so routing failover skips them
  (absent GGUF ⇒ behavior identical to the old transformers default). `senars.config.json` no longer
  pins `provider: 'transformers'` — the pin defeated the default. Evidence: 8 GB transformers cache,
  minutes-long cold loads, and a native `Napi::Error` core dump in the e2e lane.
- ~~**`@senars/nar/factory` subpath**~~ → **resolved** (session 4): the factory module was deleted
  (`nar-presets.ts` now holds the kernel presets); the undeclared subpath and its importers are gone.
- **e2e bin-lifecycle lane — DEADLOCK (not cold-load; the session-3 hypothesis was wrong).**
  `nar.run(1)` never returns inside `reasoner.step` (`nar/src/reason/reasoner.ts`) for the
  NARBuilder-assembled NAR from `createAgentFromEnv` — **independent of LM provider** (mock and warm
  transformers both hang; a bare `new NAR` with the same config runs fine). The delta lives in what
  `createAgent`/builder wiring adds beyond the bare NAR. The lane stays excluded from `test:unit`;
  `tests/e2e/bin-lifecycle.test.ts` now defaults `LM_PROVIDER ??= 'mock'` for when the deadlock is
  fixed. Fixing the deadlock is the top follow-up.

*Proposal rationale lives in TODO18.md (§1 component library, §1.5 NARBuilder); this file is the executable plan.*
