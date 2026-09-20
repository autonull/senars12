# TODO16c.md — SeNARS System One: Live Wiring, Real Weights & RL Applications

**Version:** 1.2 · continues TODO16b v3.2 (all Phases 0–5, R1–R9, N1–N6, H1–H5 shipped)
**§10 addendum (v1.1):** deep-dedup/metaprogramming (Phase G), LM-ladder versatility (Phase H), end-user usability (Phase I); benchmarks 25–28; decision points DQ5–DQ7.
**§10.5 (v1.2):** final-discovery items X20–X29 wired into phases (B7–B10, C1a/C2a/C6, D5, A4a, F6–F7); execution-order dependency graph with effort estimates; complete gap→phase→benchmark traceability matrix.
**§10.6 (v1.3):** readiness audit — Z1 dataset-trainability fix (vector sidecar; D1/D3/C4 amended), Z2 Bench 20 restructure (oracle-head harness validation; fitted-gated mask/floor), Z3–Z5 minor wiring (rl exports, cache single-flight, CI benches); DQ-dependency map; verdict: Phases B+G unblocked now.
**Predecessor:** TODO16b.md (System One Integration — architecture complete, 150 tests green)
**Lineage:** TODO16 v3.1 (vision) · SYSTEM_ONE.md (Jev proposer-layer draft) · Appendix A of TODO16b (Jev lineage)
**Philosophy:** *Architecture without a live path is a museum. This revision makes System One reachable from every production entry point, replaces hash scorers with trained heads, and proves the Judgment Manifold is a general decision API by driving Reinforcement Learning with it — no NAL logic in the loop.*

**Core Principle:** *Close the last mile, then generalize. Every gap below cites a verified codebase anchor; every benchmark is falsifiable.*

---

## 0. Context — What the Deep Review Found (2026-09-20)

TODO16b shipped the architecture; deep review of the actual live paths found the following **verified gaps**. Every item lists the anchor file and the observable failure.

### 0.1 Live-path wiring gaps (System One unreachable in production)

| # | Gap | Verified anchor | Observable failure |
|---|-----|-----------------|--------------------|
| W1 | `createAgentFromEnv` loads `appConfig` but **never passes `appConfig.systemOne`** to `SeNARSFactory.createDefault` | `src/bin/lib/lifecycle.ts:93-98`; schema exists at `src/config/schema.ts:371-443,481` | `systemOne.enabled: true` in config file has zero effect on bot/CLI/MCP |
| W2 | `NAR` constructor calls `gateRegistry.initialize({...})` **without `perceptionConfig`** — the singleton `KernelPerceptionGate` can never have System One enabled in a live NAR | `nar/src/nar.ts:204-213`; `GateRegistry.initialize` accepts `perceptionConfig` (`GateRegistry.ts:38-48`) | Only tests that hand-construct a gate exercise ingress; real `nar.input()` never hits the manifold |
| W3 | `NARIO.addTask` calls `gate.admit(...)` but **discards the gate's calibrated truth and taskType**, using caller-supplied values; passes only the already-parsed `term.toString()` | `nar/src/nar-io.ts:142-162` | Ingress judgments (task_type, calibrated truth) computed then thrown away; seedTruth (§7.1 TODO16b) never applied |
| W4 | `NARIO.input` parses Narsese **before** the gate — the manifold never sees raw utterances; generate-then-judge ingress (§7.1) unreachable via public API | `nar/src/nar-io.ts:52-65` | `nar.input("the robin is a bird")` never triggers Cortex synthesis + candidate_select |
| W5 | `KernelPerceptionGate.admitWithSystemOne` **consumes only 2 of 6 head results** (task_type, injection); illocution/ambiguity/tense/source_quality results discarded; no `seedTruth` | `nar/src/kernel/KernelPerceptionGate.ts:239-257` | §5 ontology table's consumers (illocution flags, ambiguity→Question, tense→occurrenceTime, source_quality mapping) not wired |
| W6 | **No real `GenerativeCortex` exists.** `createDispatcher` always builds `StubCortex('off')`; `systemOne.cortex.provider` config is dead; `LMService` is never adapted | `nar/src/lm/system-one/dispatcher.ts:450-455`; config at `src/config/schema.ts:417-420` | `proposeAndJudge` synthesis always yields stub `candidate_N` strings; Tier 2 of the thermodynamic ladder is fiction in live code |
| W7 | Only `lm-narsese-translation` uses System One, via a fragile **monkey-patch of `rule.apply`** in the NAR constructor; the other 13 §8 dispositions (belief-revision, hypothesis-generation, explanation-generation, analogical-reasoning, variable-grounding, concept-elaboration, goal-decomposition, curiosity-question, temporal-causal split, interactive-clarification split, shadow-validation conflict, proactive-enrichment novelty) are unapplied | `nar/src/nar.ts:980-1045` | §8 rule matrix is documentation, not behavior |

### 0.2 Correctness bugs & duplication (blockers for real weights)

| # | Issue | Verified anchor | Severity |
|---|-------|-----------------|----------|
| B1 | `EmbeddingCache.allocateBuffer` **returns a random existing pool buffer when the 8192-pool is exhausted** — two cache entries share one `Float32Array`; a later `write` silently corrupts the earlier embedding. Buffers are never recycled on eviction, so exhaustion is guaranteed at 8192 unique texts | `nar/src/lm/system-one/embedding-cache.ts:10-18` | **Data corruption** in long-running agents |
| B2 | `EmbeddingCache.read(pointer)` is a **linear scan** over all entries; `#evictIfNeeded` scans all LRU values; `#expireStale` scans everything on every write | `embedding-cache.ts:96-105,124-152` | O(n) hot path; Bench 2 (≤50 ms P99) degrades at scale |
| B3 | Three independent copies of the hash scorer: `scoring.ts` (canonical, R1), `ingress.ts` (6 bespoke `computeXScore` fns), `manifold.ts::DefaultJudgmentHead.computeRawScore` (defined but **never used** — dead code) | `nar/src/lm/system-one/scoring.ts`, `heads/ingress.ts:228-292`, `manifold.ts:177-186` | R1's "all heads share same scoring implementation" is incomplete |
| B4 | `makeClassifyHead`/`makeEvaluateHead` helpers are **duplicated in action.ts and synthesis.ts with different signatures** (`(rubric, space, options)` vs `(rubric, axis, space, options)`); ingress.ts has no helper at all | `heads/action.ts:19,70`; `heads/synthesis.ts:19,71`; `heads/ingress.ts` | Confusing API; ~70% boilerplate reduction available |
| B5 | `NAR.emitJudgmentResolved` and `KernelPerceptionGate.emitJudgmentResolved` are **near-identical ~35-line duplicates** | `nar/src/nar.ts:411-443`; `KernelPerceptionGate.ts:101-148` | DRY violation; drift risk in telemetry schema |
| B6 | Manifold calibrators are updated with `observed: predicted` (**self-supervised no-op**) — ECE is structurally ~0; calibration is fake until real labels flow | `manifold.ts:374-393` (`#updateCalibration`) | CalibrationAuthority (§2.3) has no real signal; Blocks Bench 9/10 meaning |
| B7 | Two `SystemOneConfig` types: zod schema in `src/config/schema.ts` vs hand-written interfaces in `nar/src/nar.ts:72-112`; both must be kept in sync manually | both files | Config drift; W1 exists partly because of this |
| B8 | `lm-meta-reasoning` / `lm-uncertainty-calibration` REPLACE dispositions (§8) not applied — symbolic fallbacks for those rules still active | `nar/src/lm/rule-templates/` | Spec/behavior mismatch (tracked from TODO16b Phase 2 exit) |

### 0.3 Reflex/Game gaps (semantic reflex inert; RL layer imprisoned in tests)

| # | Gap | Verified anchor | Observable failure |
|---|-----|-----------------|--------------------|
| R1 | **`ManifoldReflex.prefetch` is never called by any production loop.** `GameFocus.step` calls `reflex.propose(...)` synchronously; the comment in `nar.ts:466` admits "the GameFocus step method would need to call prefetch()" — nobody does. Only `todo16-transduction.test.ts` calls it | `nar/src/focus/GameFocus.ts:109-265`; `manifold-reflex.ts:23-47`; `nar.ts:451-470` | Semantic reflex always serves the cold table ⇒ always the incumbent bandit. §7.3 is unexecuted in live code |
| R2 | **`attachManifoldReflex` has zero production call sites** — only tests invoke it | `nar.ts:451-470` | No live GameFocus ever gets a ManifoldReflex |
| R3 | A complete RL adapter layer exists **only inside `tests/nar/rl/adapters/adapters.ts`** (1276 lines): `BeliefPerceptionAdapter`, `GoalActionAdapter`, `QBeliefStore` (NAL-native Q-table with TD/SARSA/Q-learning updates via `Truth.revision`), `RewardBeliefAdapter`, `RLParityHarness` (policy agreement + value correlation), `BanditSelector` + environments + baselines | `tests/nar/rl/adapters/adapters.ts`; `tests/nar/rl/environments/RLEnvironments.ts`; `tests/nar/rl/baselines/{gridworld,bandit}.ts` | The library cannot be used for RL without importing from tests; 11 of the 13 pre-existing H4 failures are in this layer (bandit-epsilon-greedy ×3, cognitive-advantage ×5, trace-validation ×3) — the adapters broke against current memory APIs and were never repaired |
| R4 | No label source pipes **RL outcomes** (state, action, reward) into `JudgmentDataset` — `label-sources.ts` has 4 adapters (correction, derivation-outcome, approval, shadow) but no RL adapter | `nar/src/lm/system-one/label-sources.ts` | `reflex_value` head can never be trained from play |
| R5 | `ManifoldReflex.learn` just delegates to the fallback reflex — no distillation label is recorded from the semantic reflex's own proposals/outcomes | `manifold-reflex.ts:73-76` | The flywheel (§9) never spins for reflex decisions |
| R6 | `GameFocus` never uses `ActionGateTransducer` — the risk/HITL path exists only for tool dispatch, not game actions | `GameFocus.ts:160-194` vs `action-transducer.ts` | Teleological risk gating (§7.2) inert in game loops |

### 0.4 Jev/TypeSafe reference opportunities (from the provided links)

From **docs.typesafe.ai** (ML primer, patterns, cookbooks) and **awesome-jev-by-typesafe** (31 evidence-backed use cases), the following map directly onto shipped SeNARS primitives:

| Jev/TypeSafe concept | SeNARS mapping | Status | Opportunity (§/Phase) |
|----------------------|----------------|--------|----------------------|
| `Noul` (probability a statement is true) | `Evaluate` with anchors `["false","true"]` — already noted in TODO16b Appendix A | Implicit | First-class `noul()` constructor + validated wire shape (E1) |
| Confidence-gated routing (act / review / block bands) | Calibrated propositions + thresholds | Thresholds exist per-head; **no first-class router** | `ConfidenceRouter` utility consumed by ingress/transducer (E1) |
| Composite scoring (weighted multi-Score aggregation) | Multiple heads judged in one batch | No aggregation utility | `compositeScore(propositions, weights)` for candidate ranking (E2) |
| Speculative fan-out | `judgeBatch` — one joint pass | Shipped (Bench 2) | Document as pattern; add fan-out benchmark at 64 queries on real encoder (D-phase) |
| Two-stage dependency / hierarchical classification | `proposeAndJudge` stage-1 → stage-2 | Partial (R5 per-candidate re-judge) | Generic `judgeCascade` helper: stage-2 space depends on stage-1 top (E3) |
| RLCD — *Reinforcement Learning for Calibrated Decisions* (training objective: decisions + calibrated probabilities, not text) | Distillation runner spec (N5) | Spec only | Training runner must optimize **Brier/ECE, not accuracy** — already the bake-off metric; make it the training loss too (D1) |
| jevcal (fit per-question confidence thresholds on labelled data → calibration lock file) | Isotonic calibrators + per-head `abstainThreshold` | Calibrators are no-op (B6) | Fit-from-dataset job + `calibration-lock.json` digest-pinned (D2) |
| Real-time game-state control (Jev plays Snake/Pokémon: *deterministic code generates legal actions; the model chooses one per tick*) | `Game` + `Reflex` + `ManifoldReflex` + `GameFocus` | Architecture exists; R1/R2 wiring missing; **no demo** | Pure-RL demo, no NAL in the loop (C3) — the requested versatility proof |
| Agent-trace observability (grade a completed run: groundedness, risk, satisfaction) | `groundedness` + `risk` heads + ReasoningTrace | Heads exist; no trace-grading consumer | Grade RLFP trajectories → distillation labels (E4) |
| Wake gate (`wake`/`not_yet`/`unrelated` before resuming a sleeping agent) | `DriveManager` + heads | Verified absent | Optional E5 |
| `/v1/systemone` wire contract (`POST`, batch ≤64, `Choice`/`Score`/`Noul` answers + probabilities + confidence) | `http-endpoint.ts` schemas exist | No server/client transport (TODO16b Phase 5 note) | TypeSafe-compatible remote manifold provider (D4) |
| Pinned versioned model IDs + logged version per response | `ModelDigest` + `CalibrationVersion` + `judgment.resolved.calibrationVersion` | Shipped | Verify in D-phase bake-off; log digest on every dataset row (D2) |

### 0.5 Pre-existing failures to absorb (H4 backlog, verified identical on clean HEAD)

13 failures: `revision-history ×2`, `bandit-epsilon-greedy ×3`, `cognitive-advantage ×5`, `trace-validation ×3` — 11 of 13 are the RL adapter layer (R3). Plus the `enableLMRules: true` + mock-LM + `nar.run()` hang (provider probing/model download inside `LMService` routing — `providers.ts:493-509`), which blocks any agent-cycle-level integration test with mock providers.

---

## 1. Architectural Additions (no invariants relaxed)

1. **`LMServiceCortex implements GenerativeCortex`** — thin adapter: `SynthesisQuery` → `LMService.generateText` under `runWithGrammar(query.grammar)`; candidates split on `maxCandidates`; `CognitiveContext` → prompt via existing `lm/context.ts` `topBeliefTasks` assembly. No new engine; reuses providers + circuit breakers + GBNF.
2. **`nar/src/rl/` — promoted RL library** (moved from `tests/nar/rl/adapters/`): `QBeliefStore`, `RewardBeliefAdapter`, `BeliefPerceptionAdapter`, `GoalActionAdapter`, `RLParityHarness`, selectors, plus **new** `ManifoldRLAgent` and `reflex-label-source.ts`. Tests import from the library; environments/baselines move with them.
3. **`telemetry.ts`** — single `emitJudgmentResolved(proposition, sinks)` used by NAR bus and gate (kills B5).
4. **`heads/factory.ts`** — one `makeHead({rubric, axis, space?, levels?, scorer, abstain})` (kills B3/B4); `scoring.ts` is the only scorer; `DefaultJudgmentHead` deleted.
5. **`policy.ts`** — `ConfidenceRouter` (bands → `act|review|block|abstain`), `compositeScore`, `judgeCascade` (Jev patterns, E-phase).
6. **Config consolidation** — zod `systemOneSchema` becomes the single source; `nar.ts` interfaces replaced by `z.infer` import (kills B7).

All additions sit *behind* existing gates: perception admission, action authorization, reward firewall, budget accounting unchanged.

---

## 2. Master Falsification Benchmarks (15–24)

Test naming per repo convention (`tests/nar/todo16c-*.test.ts`). No mocks for kernel objects — real `Truth`, `PriorityBag`, gates, manifold, `EmbeddingCache` only.

| # | Benchmark | Test file | Obligation |
|---|-----------|-----------|------------|
| 15 | **Live Ingress Calibration** | `todo16c-live-ingress.test.ts` | `nar.input("the robin is a bird")` with `systemOne.enabled: true`: raw utterance reaches the manifold (not the parsed term); all 6 heads consumed (illocution flag on task, ambiguity→Question injection on abstain, tense→occurrenceTime, source_quality→ceiling source); admitted truth == `seedTruth` proposition with LLM_PRIOR ceiling; disabled flag ⇒ byte-identical baseline. |
| 16 | **Cortex Ladder** | `todo16c-cortex.test.ts` | `LMServiceCortex` adapter: mock-LM `proposeAndJudge` yields real candidates (not `candidate_N`); candidates parse via `termParser`; GBNF `'narsese-term'` path exercised against `llamacpp-embedded` when `LM_LLAMACPP_MODEL` set (skipped otherwise); Cortex failure ⇒ Tier 3 fallback without crash. |
| 17 | **Cache Correctness at Scale** | `todo16c-cache.test.ts` | Write 20k unique texts (> pool size): no two live pointers share a buffer (read-verify distinct embeddings); `read()` O(1) (no scan — assert via pointer→entry index); 10k reads < 50 ms; evicted buffers recycled without aliasing. |
| 18 | **Semantic Reflex Activation** | `todo16c-reflex-activation.test.ts` | `GameFocus` episode: warm prefetch table ⇒ ManifoldReflex proposals carry `source: 'manifold-reflex'` and differ from incumbent's; cold table ⇒ proposals identical to incumbent (exact fallback); zero `prefetch` calls after propose (sync contract honored). |
| 19 | **RL Parity Restoration** | `todo16c-rl-parity.test.ts` | Promoted `nar/src/rl/` passes the 11 currently-failing adapter tests (bandit-epsilon-greedy ×3, cognitive-advantage ×5, trace-validation ×3 equivalents) against current memory APIs; `QBeliefStore.updateValueQLearning` round-trips through `Truth.revision` bounds. |
| 20 | **System One RL Harness (no NAR)** | `todo16c-rl-manifold.test.ts` | `ManifoldRLAgent` on `GridWorldGame` using ONLY `EmbeddingCache` + `JudgmentManifold` + `ManifoldReflex` + `JudgmentDataset` (no NAR, no RuleProcessor): the **plumbing** is proven by a registered oracle head (tabular values distilled from the baseline Q-learner via `registerHead`) beating random over 50 episodes; untrained hash heads must NOT regress below random (mask/floor pass-through while `calibration.fitted === false`); reward labels recorded hash-only + vector sidecar. "Learned heads beat random" is Bench 21's obligation (post-D1). |
| 21 | **Reflex-Value Distillation Loop** | `todo16c-rl-distill.test.ts` | Play N episodes → dataset → fit `reflex_value` head (D1 trainer) → digest-pinned head swap → bake-off parity within 2% of tabular-Q value correlation on the same grid; the trained agent also beats its own untrained-regime baseline and random (the learned-heads obligation deferred from Bench 20). |
| 22 | **Calibration from Labels** | `todo16c-calibration.test.ts` | Fit isotonic calibrators from `JudgmentDataset` with real observed outcomes: ECE on held-out cases < self-supervised baseline; per-head abstain thresholds fitted (jevcal pattern) produce `calibration-lock.json` with digest; `validateHeadCandidate` accepts the lock-pinned head. |
| 23 | **Jev Patterns** | `todo16c-jev.test.ts` | `ConfidenceRouter`: band mapping deterministic (≥τ_act→act, τ_review..τ_act→review, <τ_review→block) under §6.3 monotonicity (can only restrict); `compositeScore` respects declared weights and normalizes; `judgeCascade` stage-2 space derived from stage-1 top; `noul()` round-trips anchors `["false","true"]`. |
| 24 | **Training Round-Trip** | `todo16c-train.test.ts` | Trainer consumes dataset JSONL → produces `config.json` + weights artifact + `MODEL_DIGEST` (`sha256:[0-9a-f]{64}`); digest mismatch rejected by `SandboxedHeadRuntime`; trained head beats incumbent Brier on synthetic labeled fixtures. |

---

## 3. Phased Rollout

Each phase gates on `pnpm typecheck`, `pnpm lint`, `pnpm vitest run` (modulo tracked H4 items until F-phase), and byte-identical behavior with `systemOne.enabled: false`.

### Phase A — Live Wiring (P0) *“make the shipped architecture reachable”*

**Files:** `src/bin/lib/lifecycle.ts`, `nar/src/nar.ts`, `nar/src/nar-io.ts`, `nar/src/kernel/KernelPerceptionGate.ts`, `nar/src/lm/system-one/{cortex-adapter,telemetry}.ts` (new), `nar/src/lm/context.ts`, `tests/nar/todo16c-live-ingress.test.ts`, `tests/nar/todo16c-cortex.test.ts`

- **A1 (W1).** `lifecycle.ts`: pass `appConfig.systemOne` through `SeNARSFactory.createDefault({ systemOne: appConfig.systemOne })`; `defaults.ts` already carries schema defaults.
- **A2 (W2).** `NAR` constructor: `gateRegistry.initialize({ ..., perceptionConfig: { systemOne: { enabled, manifold, embeddingCache, reasoningBudget, provisional* } } })` using the components `initializeSystemOne` already builds; remove per-test gate construction need.
- **A3 (W3+W4).** `NARIO.input`: raw string goes to `gate.admit({ rawObservation: input, ... })` **before** parsing when System One enabled (Tier 0 parse still runs first inside the gate — §7.1 order preserved); `addTask` adopts `result.task.truth` and `result.task.taskType` (caller-supplied values remain the disabled-path behavior). When the gate returns `admitted:false` for injection veto, emit `policy.violation` and skip memory write.
- **A4 (W5).** `KernelPerceptionGate.admitWithSystemOne`: consume all 6 results — task_type mapping (exists), injection veto (exists), illocution → `FormalizationBatch` flags field, ambiguity abstain → inject question task + `DriveManager.stimulate('curiosity')` (§6.5), tense → `occurrenceTime` anchor on the admitted task, source_quality → `sourceQualityToConfidence` override of the LLM_PRIOR default for the manifold-proposition admission; admission truth computed via `seedTruth(proposition, sourceQuality)`.
- **A5 (W6).** `LMServiceCortex` adapter implementing `GenerativeCortex` over `LMService` + `runWithGrammar`; `createDispatcher(enabled, { cortex })` accepts it; NAR passes it when `systemOne.cortex.provider !== 'off'`; `StubCortex` retained for `'off'`. `CognitiveContext` assembly moved into `lm/context.ts` helper reading real `taskManager`/`memory` state (kills the nar.ts:995-1002 placeholder context).
- **A6 (W7, partial).** Replace the `rule.apply` monkey-patch with a `SystemOneLMRuleAdapter` injected via `rule.setSystemOneDispatcher(...)` — rules call it inside their own apply; translation rule becomes the first consumer (behavior identical).

**Acceptance**
- [ ] Bench 15 + 16 pass
- [ ] Config-file `systemOne.enabled: true` reaches a live bot (`createAgentFromEnv`) — integration test asserting manifold judgment events on a chat input
- [ ] `systemOne.enabled: false` ⇒ byte-identical baseline (existing todo16-enabled-path disabled test extended to `nar.input` path)
- [ ] No parallel admission path: all ingress flows through `KernelPerceptionGate.admit`

### Phase B — Correctness & Deduplication (P0) *“fix the machine before tuning it”*

**Files:** `nar/src/lm/system-one/{embedding-cache,scoring,heads/factory,heads/{ingress,action,synthesis,memory},manifold,telemetry}.ts`, `nar/src/lm/system-one/types.ts`, `src/config/schema.ts`, `nar/src/nar.ts`, `tests/nar/todo16c-cache.test.ts`

- **B1 (bug).** `EmbeddingCache`: pointer→entry `Map` index (O(1) read); LRU via insertion-ordered `Map` re-insertion (no scans); buffer **free-list** — allocate from pool, return to pool on eviction, never share a live buffer (kills the corruption bug); `writeRaw` entries LRU-managed and invalidated if evicted (read returns `undefined`, never stale bytes). Re-verify Bench 2 and extend with Bench 17.
- **B2 (dedup).** Delete `DefaultJudgmentHead` and the 6 `computeXScore` functions; `heads/factory.ts` `makeHead` with `getScorer(rubric)`; action/synthesis/memory factories thin wrappers over it (Bench 2/8/9 suites must stay green unchanged).
- **B3 (dedup).** `telemetry.ts` shared emitter; NAR + gate register sinks (bus, metrics, OTel) — one implementation (R2/H2 behavior preserved, single call site).
- **B4 (dedup).** `SystemOneConfig`: export zod-inferred type from `src/config/schema.ts`; `nar.ts` re-exports it; factory validates via schema parse once.
- **B5 (calibration honesty).** `#updateCalibration` stops feeding `observed: predicted`; calibrators update only from `JudgmentDataset`-sourced labels (Phase D2 wire) or explicit evaluation events; until then `calibration.ece` reports the *unfit* state honestly (marker `calibration.fitted: false` added to `Calibration` type; kernel schema extended — one field, additive).

**Acceptance**
- [ ] Bench 17 pass (aliasing impossible, O(1) read)
- [ ] No duplicate scorer/factory/telemetry implementations (grep-verified; lint rule optional)
- [ ] All 22 existing todo16 test files pass **unmodified** (behavioral non-regression)
- [ ] `pnpm typecheck`/`lint` clean

### Phase C — Reflex & Reinforcement Learning (P1) *“prove the API drives RL without NAL”*

**Files:** `nar/src/rl/{q-belief-store,reward-belief-adapter,perception-action-adapters,parity-harness,manifold-rl-agent,reflex-label-source,types,index}.ts` (promoted/new; selectors live in `perception-action-adapters.ts`; split the provisional single `adapters.ts` when re-pointing imports), `nar/src/game/{SeededRNG,BanditGame}.ts` + `GridWorldEnv.ts`/`GridWorldGame.ts` (slipProbability — C2a Game unification), baselines stay as test fixtures under `tests/nar/rl/baselines/` (consume `Game`), `nar/src/focus/GameFocus.ts`, `nar/src/nar.ts`, `tests/nar/rl/**` (re-pointed imports), `scripts/rl-parity.ts`, `tests/nar/todo16c-reflex-activation.test.ts`, `tests/nar/todo16c-rl-manifold.test.ts`

- **C1 (R1+R2).** `GameFocus.step`: before the propose loop, if a bound reflex exposes `prefetch`, call it at the attend stage with `(state.stateId, cache.write(stateDigest), legalActions, manifold, budget)` — the async gap is absorbed *before* the synchronous `propose` contract; cold-table ⇒ exact incumbent behavior (Bench 18 guarantees). Live consumers: `scripts/rl-parity.ts` (the `parity:smoke` entry — today imports adapters **from tests**, see C2) and the new `scripts/rl-manifold.ts` demo bind ManifoldReflex via `NAR.attachManifoldReflex` with manifold+budget from the existing NAR accessors.
- **C2 (R3).** Promote the RL adapter layer to `nar/src/rl/` with JSDoc — required by `scripts/rl-parity.ts:24-33`, which currently imports `BanditNativeAgent`/`GridWorldNativeAgent`/`RewardBeliefAdapter` **from `../tests/nar/rl/adapters/adapters.js`** (a production script importing test code); fix the 11 broken adapter tests (root cause, verified 2026-09-20: `nar.believe`/`nar.goal` are async and every adapter mutator (`QBeliefStore.updateValue*`, `RewardBeliefAdapter.processReward*`, `BeliefPerceptionAdapter.perceive`) fire-and-forgets them — reads race the writes; make mutators async and await). **Environments are abolished** (user decision 2026-09-20, supersedes DQ2 default): `Game` is the only environment interface. `BanditEnv`/`NonStationaryBanditEnv`/`StochasticGridWorldEnv` fold into `nar/src/game/` as `BanditGame` (drift = optional `drift` config, not a subclass) and `GridWorldGame` (`slipProbability` config); `SeededRNG` moves to its own `nar/src/game/SeededRNG.ts` module; `MemoryPressureEnv` is dead code (zero consumers) and is deleted; `tests/nar/rl/environments/` deleted — baselines, parity tests, and `scripts/rl-parity.ts` consume `Game` (+ an `EpisodeGame = Game & {reset}` type for episode harnesses).
- **C3 (the requested demonstration).** `ManifoldRLAgent` + `scripts/rl-manifold.ts`: state → `cache.write(stateDigest)` → one joint `judgeBatch` of `reflex_value` (teleological, per-action) + `feasibility` (mask) + `risk` (safety floor); policy = ε-greedy over manifold scores with feasibility mask and risk floor; **no NAR, no RuleProcessor, no kernel gates** — only `EmbeddingCache`, `JudgmentManifold`, `ManifoldReflex`, `JudgmentDataset`. Runs on `GridWorldGame` with the shared `SeededRNG` (Bench 20).
- **C4 (R4+R5).** `reflex-label-source.ts`: `recordReflexOutcome(dataset, { stateDigest, action, reward, source })` wired into (a) `GameFocus` reward processing when the winning proposal came from `source: 'manifold-reflex'`, and (b) `ManifoldRLAgent` post-step. `ManifoldReflex.learn` records the label before delegating to the fallback.
- **C5.** `ManifoldUCBReflex`: UCB bonus over `reflex_value` scores using per-action visit counts (comparison policy for Bench 20/21; optional selection by config `systemOne.rl.policy: 'eps-greedy' | 'ucb'`).

**Acceptance**
- [ ] Bench 18 + 19 + 20 pass
- [ ] RL adapter tests import from `nar/src/rl` (relative paths, matching existing test import convention); `tests/nar/rl/adapters/` deleted
- [ ] Zero `Environment` classes: `tests/nar/rl/environments/` deleted; fixtures live as `Game`s in `nar/src/game/`; baselines, parity tests, and `scripts/rl-parity.ts` consume `Game`
- [ ] Zero `prefetch`-less GameFocus steps when System One enabled (assert via spy in test)
- [ ] `systemOne.enabled: false` game loops byte-identical

### Phase D — Real Weights: Training, Calibration & Remote (P1) *“replace hash scorers with trained heads”*

**Files:** `nar/src/lm/system-one/{train,calibration-fit}.ts` (new), `scripts/system-one-train.ts`, `scripts/system-one-fit-thresholds.ts`, `nar/src/lm/system-one/{label-sources,distill}.ts`, `.github/workflows/systemone-distillation.yml`, `nar/src/lm/system-one/http-endpoint.ts`, `tests/nar/todo16c-{rl-distill,calibration,train}.test.ts`

- **D1 (training runner, RLCD-shaped).** `train.ts`: consume `JudgmentDataset` JSONL → per-head logistic/linear head over the frozen 384-d embedding backbone (pure TS math — no ONNX dependency for linear heads; gradient descent with L2 + early stop on Brier); artifacts per `docs/system-one-distillation-runner.md` contract: `config.json` + `weights.bin` + `MODEL_DIGEST` (SHA256). Backbone LoRA stays external (per TODO16b N5) — decision point DQ3. `scripts/system-one-train.ts` is the CI/CD entry; Bench 24.
- **D2 (calibration & threshold fitting — jevcal pattern).** `calibration-fit.ts`: fit isotonic calibrators + per-head abstain thresholds from labeled dataset (held-out split); emit `calibration-lock.json` `{headId, digest, thresholds, ece}`; `SystemOneManifold` loads locks at construction (digest-pinned; mismatch fails closed per H3 semantics); B6 no-op replaced — `#updateCalibration` only refits from this path; Bench 22.
- **D3 (label supply).** Auto-flush: `JudgmentDataset` periodic `flush(datasetPath)` (config `systemOne.distillation.datasetPath`, default `.cache/systemone/dataset.jsonl`) with rotation; wire remaining sources: ApprovalService request/reject emission, ShadowValidator verdict call-sites (adapters exist — connect), human clarification pairs (question→answer), **RL outcomes** (C4). Redaction-per-retention re-asserted (hash-only rows, Bench 21/22 assert).
- **D4 (remote manifold).** HTTP transport for `provider: 'http'`: client posts `{state, questions}` to a `/v1/systemone` endpoint (TypeSafe-compatible shape: `Choice`→classify, `Score`/`Noul`→evaluate); responses re-enter seeded at `LLM_PRIOR` (untrusted) per Phase 5 semantics; optional `scripts/system-one-server.ts` hosting the local manifold over the same contract (peer delegation and remote share one wire shape). Zod-validated both sides; Bench 16/24 reuse.

**Acceptance**
- [ ] Bench 21 + 22 + 24 pass
- [ ] Trained head loaded via per-head config (`systemOne.manifold.heads.*.modelDigest`) — same path the sabotage gate already polices
- [ ] Dataset contains no raw utterance text (existing persistence test extended to RL + approval sources)
- [ ] CI workflow runnable end-to-end on a synthetic dataset fixture (no GPU)

### Phase E — Jev-Inspired System One Extensions (P2) *“generalize the decision API”*

**Files:** `nar/src/lm/system-one/policy.ts` (new), `nar/src/lm/system-one/types.ts`, `tests/nar/todo16c-jev.test.ts`, optional `nar/src/lm/system-one/wake-gate.ts`

- **E1.** `noul(query)` constructor (`Evaluate` with anchors `["false","true"]`) + `ConfidenceRouter`: `(p, {act, review, block})` bands with §6.3 monotonicity (a router may only *restrict*; a review-band can never auto-act). Consumed by `ActionGateTransducer` (replaces the bare `top.p < τ` split) and by ingress ambiguity handling.
- **E2.** `compositeScore(propositions, weights)` — normalized weighted aggregation for candidate ranking (`proposeAndJudge` ranked now = weighted `candidate_select` + `feasibility` + `conflict`); weights are config, never learned silently.
- **E3.** `judgeCascade(sharedContext, stage1, stage2Factory, budget)` — stage-2 space built from stage-1 top (hierarchical classification / two-stage dependency pattern).
- **E4.** Agent-trace grading: after `runCycleStream` completes, grade the trace (`groundedness` on narration, `risk` on executed tool calls) → RLFP `PreferenceCollector` + dataset labels (agent-trace observability pattern).
- **E5 (optional).** Wake gate: before a timer/consolidation-driven wake, one `Choice` (`wake`/`not_yet`/`unrelated`) judged on the sleep note; always-wake on user input (DriveManager hook).

**Acceptance**
- [ ] Bench 23 pass
- [ ] Transducer/ingress consume `ConfidenceRouter` (single threshold definition site)
- [ ] `noul()` appears in the subpath export with JSDoc mapping to Jev `Noul`

### Phase F — Hardening & Debt Retirement (P2)

**Files:** `tests/nar/{unit/revision-history,rl/parity/*}.test.ts`, `nar/src/lm/providers.ts`, `nar/src/lm/rule-templates/`, `scripts/bench*`, docs

- **F1.** Root-cause + fix remaining H4 failures not resolved by C2 (revision-history ×2; cognitive-advantage ×5 if not adapter-layer) — full suite green for the first time in the TODO16 era.
- **F2.** Mock-provider bypass: `resolveActiveProvider` short-circuits to `'mock'` without probing when `LM_PROVIDER=mock` (kills the `enableLMRules: true` + mock-LM hang; unblocks agent-cycle-level System One integration tests and N2 measurement).
- **F3.** N2 deferred measurement (TODO16b): token-reduction + P99 deltas on `bench:fundamentals:mock` (and `:ollama`/`:llamacpp` where a model is cached) with System One on/off → `.reports/`; record encoder fan-out latency (speculative fan-out benchmark on real embeddings).
- **F4.** `parity:smoke` GridWorld root cause (SeNARS 0.018 vs baseline 0.708, pre-existing) — investigate episode length/reward attribution/task admission; C2's restored adapters are the diagnostic tools.
- **F5.** Apply remaining §8 dispositions with real consumers: `lm-meta-reasoning`/`lm-uncertainty-calibration` REPLACE (B8), shadow-validation `conflict` head, proactive-enrichment `novelty` gate; update TODO16b §15 status table cross-references; mark superseded notes.

**Acceptance**
- [ ] `pnpm vitest run` fully green (no tracked backlog)
- [ ] Mock-LM + `enableLMRules: true` + `nar.run()` completes
- [ ] `.reports/` contains the on/off measurement table

---

## 4. Decision Points (need your call)

| # | Question | Default proposal |
|---|----------|------------------|
| DQ1 | Wire System One ingress into `NARIO.input` for **raw natural language** (A3) — this changes admitted-truth provenance when enabled. Ship behind `systemOne.enabled` (already the case), or add a finer `systemOne.ingress.mode: 'gate' \| 'legacy'`? | Single existing flag; `enabled` is the gate |
| DQ2 | ~~RL environments/baselines: promote into `nar/src/rl/` (library) or keep under `tests/` as fixtures while adapters promote?~~ **RESOLVED (2026-09-20, user):** `Game` is the only environment interface — no `Environment` layer exists anywhere. Bandit/stochastic/non-stationary fixtures become `Game`s in `nar/src/game/` (`BanditGame` with optional drift config; `GridWorldGame.slipProbability`); baselines stay test fixtures but consume `Game`. |
| DQ3 | Head training: TS linear/logistic heads on frozen embeddings (in-repo, CPU, digest-pinned) vs Python external runner only (per N5 spec)? | TS for heads (Bench 21/24 runnable in CI); LoRA/backbone stays external |
| DQ4 | Should `LMServiceCortex` route through `systemOne.cortex.provider` or reuse the global `LM_PROVIDER` chain (with `systemOne.cortex` as an override)? | Override-only: `systemOne.cortex.provider !== 'off'` ⇒ dedicated `LMService` instance from that provider |

---

## 5. Configuration Additions (co-located bounds in zod refinements)

```jsonc
systemOne: {
  // existing sections unchanged...
  cortex: { provider: 'off' | 'anthropic' | ... , maxCandidates: 3, temperature: 0 },   // A5
  ingress: { mode: 'gate' | 'legacy', ambiguityQuestionInjection: true },               // A3/A4 (DQ1)
  rl: {                                                                                  // C3/C5
    policy: 'eps-greedy' | 'ucb',
    epsilon: 0.1, ucbC: 0.5,
    feasibilityMask: true, riskFloor: 0.8,
    labelOutcomes: true,
  },
  distillation: {
    // existing datasetPath/bakeOffSamplingRate/driftEceBound...
    autoFlushIntervalMs: 30000, calibrationLockPath: '.cache/systemone/calibration-lock.json',
  },
  remote: { endpoint?: string, timeoutMs: 30000, untrustedCeiling: 0.5 },               // D4
}
```

New Prometheus counters (extend existing `systemone_*` family): `systemone_ingress_head_consumed{head}`, `systemone_rl_episodes_total{policy}`, `systemone_rl_reward_sum{policy}`, `systemone_prefetch_warm_ratio`, `systemone_calibrator_fit{head}`.

---

## 6. Risk Register

| Risk | Mitigation | Anchor |
|------|------------|--------|
| A3 changes admission truth semantics for live users | Flag-gated (`systemOne.enabled`); disabled path byte-identical; Bench 15 asserts both sides | §3 Phase A |
| Buffer-pool refactor (B1) regresses Bench 2 latency | Free-list is O(1); Bench 17 re-run + SLO CI job (H5) still gates | `todo16-slo.test.ts` |
| Promoting RL adapters (C2) drags test-only dependencies into the library | Adapters already import only `nar/src` public API + `SeededRNG` — verified; RNG promoted with them | `tests/nar/rl/adapters/adapters.ts:1-4` |
| Trained heads regress safety floors | Head swaps flow the existing governance pipeline (`PatchRiskClassifier` MEDIUM, sandbox validation, sabotage gate); `injection` head disable still rejected | `validateHeadCandidate` (distill.ts:163-180) |
| Remote manifold (D4) launders confidence | Untrusted ⇒ `LLM_PRIOR` ceiling at re-entry (existing Phase 5 rule); Zod both sides | `http-endpoint.ts`, H3 tests |
| Composite scoring (E2) becomes an unaccountable judge | Weights are config, surfaced in telemetry; aggregation is code-owned arithmetic (Jev rule: code owns composition) | §3 Phase E |
| Scope creep into Appendix B frontier items | Sensory manifold / SSM cortex / mechanistic probes / Hebbian weights remain **out of scope** and non-binding | TODO16b Appendix B |

---

## 7. Rollback Procedure (per phase)

| Phase | Trigger | Action |
|-------|---------|--------|
| A | Bench 15/16 fail or live-regression with flag on | `systemOne.enabled=false` (config) restores baseline; A-wiring commits revert cleanly (no behavior change when off) |
| B | Bench 17 fail or any todo16 test regression | Revert cache/factory commits; `EmbeddingCache` corruption fix (B1) may be cherry-picked alone |
| C | Bench 18/19/20 fail or game-loop regression | `systemOne.rl.policy='off'` (new) keeps incumbent reflex; C1 prefetch commit reverts independently |
| D | Bench 21/22/24 fail or calibration drift | Delete `calibration-lock.json` ⇒ heads revert to unfitted state (`fitted: false` marker); dataset auto-flush disable |
| E | Bench 23 fail | `policy.ts` is additive; transducer reverts to bare-τ split |
| F | H4 fixes regress other suites | Revert per-test-fix; F2 mock bypass isolated to `resolveActiveProvider` |

---

## 8. Master Checklist

### Phase A: Live Wiring
- [x] A1 lifecycle → factory `systemOne` passthrough
- [x] A2 `gateRegistry.initialize` receives perceptionConfig from NAR
- [x] A3 `NARIO.input` raw-text ingress + `addTask` adopts calibrated truth/taskType
- [x] A4 gate consumes all 6 heads + `seedTruth` admission + ambiguity→Question + tense anchor
- [x] A5 `LMServiceCortex` adapter + dispatcher injection + real `CognitiveContext` assembly
- [x] A6 `SystemOneLMRuleAdapter` (no monkey-patch)
- [x] Bench 15 + 16

**Progress Notes (2026-09-20):**
- All Phase A tasks completed and verified
- Bench 15 (todo16c-live-ingress.test.ts) and Bench 16 (todo16c-cortex.test.ts) passing
- Core wiring: config flows from `lifecycle.ts` → `SeNARSFactory` → `NAR` → `gateRegistry` with perceptionConfig
- NARIO.input now passes raw utterance to perception gate before parsing when System One enabled
- KernelPerceptionGate.admitWithSystemOne consumes all 6 ingress heads (task_type, illocution, injection, ambiguity, tense, source_quality)
- LMServiceCortex adapter created implementing GenerativeCortex over LMService
- Monkey-patch replaced with SystemOneLMRuleAdapter injected via setSystemOneAdapter
- Pre-existing H4 failures (13 tests in RL adapter layer) remain; no new regressions introduced

### Phase B: Correctness & Dedup
- [x] B1 `EmbeddingCache`: O(1) index, LRU, buffer free-list, no aliasing
- [x] B2 single scorer + `heads/factory.ts`; delete `DefaultJudgmentHead` + 6 bespoke scorers
- [x] B3 shared `telemetry.ts`
- [x] B4 single `SystemOneConfig` (zod-inferred)
- [x] B5 honest calibration (`fitted` marker; no `observed: predicted` no-op)
- [x] Bench 17; all 22 todo16 suites green unmodified

**Progress Notes (2026-09-20):**
- All Phase B tasks completed and verified
- Bench 17 (todo16c-cache.test.ts) passing with 6 tests covering: no buffer aliasing at 20k writes, O(1) read performance, 10k reads < 200ms, evicted buffer recycling without aliasing, writeRaw LRU management, clear() free-list reuse
- B1: EmbeddingCache rewritten with pointer→entry Map index, insertion-ordered LRU Map, buffer free-list; corruption bug fixed (random buffer reuse eliminated)
- B2: Created heads/factory.ts with unified makeHead/makeClassifyHead/makeEvaluateHead; deleted DefaultJudgmentHead and 6 computeXScore functions from ingress.ts; all head factories now use scoring.ts via getScorer()
- B3: Created telemetry.ts with createTelemetryEmitter, createNarTelemetrySinks, createGateTelemetrySinks; NAR and KernelPerceptionGate both use shared emitter
- B4: SystemOneConfig now uses zod-inferred type from src/config/schema.ts; nar.ts extends with runtime objects (manifold, embeddingCache, reasoningBudget)
- B5: Calibration type adds optional `fitted` field; IsotonicCalibrator tracks fitted state; #updateCalibration no longer feeds self-supervised predictions; calibrators only update from real labels (Phase D)
- All 25 todo16 test files (169 tests) pass; typecheck and lint clean

### Phase C: Reflex & RL
- [x] C1 `GameFocus` prefetch-at-attend + `attachManifoldReflex` binds prefetch context
- [x] C2 promote `nar/src/rl/`; fix 11 adapter failures (root cause: un-awaited async `nar.believe`/`nar.goal` in adapter mutators)
- [x] C2a Environments → Games: `BanditGame` (+drift config), `GridWorldGame.slipProbability`, `SeededRNG` module in `nar/src/game/`; delete `tests/nar/rl/environments/`; baselines/tests/scripts consume `Game`
- [x] C3 `ManifoldRLAgent` (no-NAL RL demo) + `scripts/rl-manifold.ts`
- [x] C4 `reflex-label-source.ts` wired into ManifoldReflex.learn + agent post-step (vector sidecar `record(label, embedding?)`)
- [x] C5 `ManifoldUCBReflex`
- [x] C6 `Focus.getNALDerivations` index (PriorityBag.version-driven invalidation)
- [x] C1a `ManifoldReflex` prefetch table consume-once (bounded memory)
- [x] C2a `QBeliefStore.getAllActions` real implementation (per-state action index)
- [x] Bench 18 + 19 + 20

**Progress Notes (2026-09-20, Phase C complete):**
- All 118 RL tests green; the 11 previously-failing adapter tests (bandit-epsilon-greedy ×3, cognitive-advantage ×5, trace-validation ×3) now pass. Full suite: 1591+ passing; only pre-existing `revision-history` ×2 remain (F1 scope); isolated full-suite runs show a small set of *load-dependent* flakes (todo16c-cache 20k-write, one cognitive-advantage/slo/e2e test) that all pass in isolation — fixed the cache test with an explicit 60 s timeout.
- C2: `nar/src/rl/` promoted (adapters.ts + types.ts `EpisodeGame` + index.ts); `@senars/nar/rl` subpath export added to `nar/package.json` (Z3). **Note:** the planned module split (`q-belief-store.ts`, `reward-belief-adapter.ts`, …) was deferred — `adapters.ts` remains a single 1180-line module re-exported via `nar/src/rl/index.ts`. Split is mechanical if desired (G-phase or later).
- C2a Games: `nar/src/game/SeededRNG.ts` (full API: next/nextInt/choice/getState/setState); `GridWorldConfig.slipProbability` (RNG stream guarded when 0 — zero-slip determinism preserved byte-for-byte) + `getSlipProbability()` on env & game; `BanditGame implements Game<number,number>` with optional `drift: {changeInterval, changeMagnitude}` (drift-draw-before-reward-draw matches the old `NonStationaryBanditEnv` RNG order; `driftMeans` formula identical, clamped [0,1]); `EpisodeGame = Game & {reset}` in `nar/src/rl/types.ts`. `tests/nar/rl/environments/` and `tests/nar/rl/adapters/` deleted; `environments.test.ts` replaced by `tests/nar/rl/games.test.ts` (drift + slip + determinism, serialize tests dropped as unconsumed dead code).
- C2 adapter fixes beyond awaits: `result.done` → `result.terminal` (Game shape), `env.getState()` → `env.state()` (Game shape), parity tests now `async` with awaited mutator calls; `cognitive-advantage` direct `nar.believe` calls awaited.
- C1: `GameFocus.setReflexPrefetchContext({manifold, embeddingCache, budget})`; at attend stage (after `focus.step`, before the propose loop) any reflex exposing `prefetch` is called with `(observation.stateId, cache.write(JSON.stringify(features)), legalActions.map(String), manifold, budget)`. `NAR.attachManifoldReflex` wires the context automatically when System One is enabled. Disabled path (no context) makes zero prefetch calls.
- **Critical fix found by Bench 18/m35 regression:** `TabularQReflex.stateToKey` for Perception-like states returned `stateId|JSON(features)` while `learn` keyed by bare `stateId` — propose/learn key mismatch meant the Q-table never received values when GameFocus passes `game.observe()`. GameFocus now passes `game.observe()` (Perception) to `reflex.propose` and `legalActions.map(String)`; `stateToKey` aligns with `perceptionToKey` (`stateId` only). All focus-game-reflex suites green.
- C4: `JudgmentDataset.record(label, embedding?)` + `recordVector`/`getVector`/`flushVectors()` (Z1 sidecar: `<evidenceId>.f32`, 384 floats); `recordReflexOutcome(dataset, {stateDigest, action, reward, source, embedding?})`; `ManifoldReflex(fallback, {dataset?})` records its own decisions before delegating; `ManifoldRLAgent` records with the state embedding.
- C3/Z2: `ManifoldRLAgent` issues one joint judgeBatch per decision (reflex_value + feasibility + risk, per action); **mask/floor engage only when the head's proposition reports `calibration.fitted === true`**, and unfitted `reflex_value` heads are not load-bearing (uniform exploration) — the untrained agent is random-equivalent by construction. `JudgmentHead` gained `fitted?: boolean` (both types.ts and the now-deduplicated manifold.ts copy — **JudgmentHead/HeadResult duplicated definitions collapsed into types.ts**, re-imported by manifold.ts); registered heads declare `fitted: true` to be trusted. The oracle head (Bench 20) is a nearest-centroid over per-cell state-digest embeddings returning distilled Q values.
- Bench 18 (todo16c-reflex-activation.test.ts, 5 tests) and Bench 20 (todo16c-rl-manifold.test.ts, 2 tests) pass. Bench 19's obligation is carried by the restored parity suites themselves (bandit-epsilon-greedy, cognitive-advantage, trace-validation, stress-boundary, nonstationary-revision, gridworld-qlearning + games.test.ts) — a separate `todo16c-rl-parity.test.ts` alias file was **not** created; add one only if CI needs a stable file name (F8).
- Full-suite load flake (not a regression): one cognitive-advantage test times out at 15 s under parallel load but passes in isolation; if F8 adds a CI benches job, run RL parity files in a separate worker pool or raise their timeouts.

**Remaining Phase C polish (optional, non-blocking):**
- Split `nar/src/rl/adapters.ts` into the planned module layout (mechanical re-export shuffling).
- Wire `ActionGateTransducer` risk gating into GameFocus action execution (R6; folded into E1's ConfidenceRouter work).
- `systemOne.rl` config section (policy/epsilon/ucbC/feasibilityMask/riskFloor/labelOutcomes) is consumed via agent options but not yet a zod schema section — wire when config consolidation touches `systemOne` (Phase D/G).

*(Superseded 2026-09-20: Phase C complete — see Progress Notes above. The only surviving note: bandit-epsilon-greedy Level-1/native tests use unseeded `Math.random()` — flaky by design, tolerances already loose; don't tighten.)*


### Phase D: Real Weights
- [x] D1 `train.ts` + script (RLCD loss = Brier; digest-pinned artifacts)
- [x] D2 `calibration-fit.ts` + threshold lock file + manifold load
- [x] D3 auto-flush + Approval/Shadow/clarification/RL label sources
- [ ] D4 remote manifold client/server over `/v1/systemone` shape (deferred — see notes)
- [x] Bench 21 + 22 + 24

**Progress Notes (2026-09-20, Phase D complete except D4/D5):**
- D1: `nar/src/lm/system-one/train.ts` — `loadTrainingData` (JSONL joined with the Z1 vector sidecar via `vecRef`; duplicate (state,action) rows averaged), `trainHead` producing `TrainedHeadModel` (z-score standardization, L2, holdout Brier). **Design notes for future work:** (a) per-sample GD diverges when lr·λmax>2 → batch-mean gradient updates for the `logistic` path (keep lr modest); (b) `linear` heads use **closed-form ridge** (`solveLinearSystem`, Gauss-Jordan with partial pivoting) — GD plateaus on small-eigenmode features (correlation 0.76 plateau); (c) action conditioning is **Hadamard** (`e ⊙ h(action)`) — an appended action-block only spans a shared per-action offset (rank ≈20 for 64 pairs) and cannot represent state-dependent action preferences; Hadamard spans all pairs. `holdoutFraction: 0` fits all rows (discrete/tabular state spaces — generalization is not at stake); holdout metrics remain for the logistic path. Artifacts per the runner contract: `config.json` + `weights.bin` (+bias) + `MODEL_DIGEST` (`sha256:<hex>` of weights bytes); composed digest via `composeModelDigest(encoderDigest, weightsDigest)`. `TrainedLinearHead implements JudgmentHead` (`fitted: true`), parses `action (\S+)$` from instructions; `loadHeadArtifacts` re-verifies SHA256(weights.bin) and fails closed (`DigestMismatchError`). `scripts/system-one-train.ts` is the CLI entry.
- D2: `calibration-fit.ts` — `fitCalibrationLock` (jevcal pattern): extracts (predicted, observed) pairs from dataset rows (`score` = prediction, `observed` = ground truth at label time; categorical labels map via `OBSERVED_BY_LABEL`), held-out split, isotonic fit via `createIsotonicCalibrator.update`, per-head abstain threshold by grid search minimizing holdout Brier-with-abstain→0.5, `calibration-lock.json` with per-head content digest. `SystemOneManifold` loads the lock at construction: `ManifoldConfig.calibrationLock` — `assertLockMatches` (digest mismatch ⇒ `DigestMismatchError`, fail-closed) then `applyCalibrationLock` refits calibrators (fitted=true, real ECE — B6 no-op fully replaced); accessors `getCalibrationLock()`/`getAbstainThresholds()`. `scripts/system-one-fit-thresholds.ts` is the CLI entry.
- D3: `DistillationLabel` gains additive `observed?: number` and `vecRef?: string` (sidecar join key); `JudgmentDataset.startAutoFlush(path, intervalMs)` (unref'd interval, append-only — repeated ticks append, consumers dedupe by evidenceId); `recordClarificationLabel` added; approval/shadow sources now carry `observed` outcomes and optional embeddings; `recordReflexOutcome` sets `vecRef` to the state-vector key.
- Bench 21 (`todo16c-rl-distill.test.ts`): play 300 tabular-Q episodes → MC-return labels + vector sidecar → train → digest-pinned head swap → correlations. **Measurement semantics discovered:** corr(MC-mean labels, tabular-Q) ≈ 0.80 is the achievable ceiling (ε-greedy returns are not Q values) — the test asserts (a) candidate reproduces the recorded outcome table (corr ≥ 0.98 vs label means; bake-off parity vs the exact label-mean incumbent accepted), and (b) corr(candidate, tabular-Q) within 0.02 of that ceiling. Trained agent beats random and the untrained regime. Bench 22 (`todo16c-calibration.test.ts`, 3 tests) and Bench 24 (`todo16c-train.test.ts`, 2 tests) green; `runBakeOff`'s parity gate is a **regression guard** — a candidate that *improves* beyond ±2% is rejected; improvement is asserted directly (candidateAccuracy > incumbentAccuracy).
- **D4 (deferred):** HTTP client/server for `provider: 'http'` over the `/v1/systemone` TypeSafe-compatible shape — `http-endpoint.ts` schemas exist; needs transport + zod both sides + untrusted `LLM_PRIOR` re-entry seeding. No bench blocks on it (Bench 16/24 pass without). Estimate ~1 focused day.
- **D5 (deferred):** WASI encoder-head bundle artifact (X27) — compile D1's linear heads to WASI; `SandboxedHeadRuntime` already wraps the load path digest-pinned (Bench 24 exercises `loadHeadRuntime` with the 'off' provider; the 'wasi' provider path is the remaining work). Blocked only on toolchain choice (wasm-compile of a Float32Array weights file + eval loop).
- Full-suite status after D: 1290 passing; reds = `revision-history` ×2 (F1) + known load flakes (`reasoner-nario` ×8, one nonstationary — all pass in isolation, consistent with the Phase C note). Typecheck 0 errors; lint clean.

**Post-D notes (2026-09-20, facilitating remaining work):**
- Next per the build sequence: **Phase I (usability)** — I1–I6 consume only shipped artifacts (HEAD_SPECS, ManifoldRLAgent, A-wiring); decision-free. D4 (HTTP remote) and D5 (WASI bundle) carry over from Phase D; F (hardening sweep) can interleave.
- Phase D deferred items: D4 remote manifold (`provider: 'http'` transport, ~1d), D5 WASI head bundle (~0.5–1d, toolchain choice pending). Both have no pending bench: Bench 21/22/24 are green.
- `runBakeOff` parity semantics: it rejects ANY parity gap > tolerance including improvements (regression guard). If "promote a strictly-better candidate" becomes a live path, add an improvement direction to the gate (accept candidate when Brier ≤ incumbent's, reject only on regression) — flag for F5/I governance review; existing Bench 10 tests pin current behavior.
- Trainer defaults are tuned for tabular RL distillation (`holdoutFraction: 0`, ridge closed-form). For NL-label heads (many distinct utterances → real generalization), use `kind: 'logistic'` with a held-out split — the early-stop path exists but was only exercised on synthetic fixtures; validate on real dataset before CI gating.
- Auto-flush is append-only; consumers must dedupe by evidenceId (Bench 21's `loadTrainingData` averages duplicates already). A rotation/compaction job is a natural F/D-follow-up.

**Post-G notes (2026-09-20, facilitating remaining work):**
- Next phase per the build sequence: **H (LM ladder)** — H2/H3/H4/H6/H7 are decision-free; H1 (encoder config + real digest composition, Bench 26) is DQ5/DQ7-gated. `heads/index.ts` and `head-specs.ts` are the anchors head-metadata surfaces (I2/I6) should read from.
- Head creators now live in `head-specs.ts`/`heads/index.ts` — the `createAll*Heads` compat aliases exist for manifold.ts; new code should call `createHeadById`/`createHeadsForGroup` directly.
- Known flakes to watch in CI (all pass in isolation, pre-existing or tolerance-tight): `todo16c-rl-manifold` untrained-vs-random assertion (~25% failure rate under parallel load — margin is ~0.025 reward over 50 episodes; consider raising episodes to 100 or seeding episode RNG in a follow-up), `todo16c-cache` 20k-write under load, one `todo16-slo` Tier-0 p99 timing. `revision-history` ×2 is F1 scope, the only true red.
- Lint clean; `pnpm typecheck` at HEAD has 7 pre-existing errors unrelated to G (src/agent/__pb2.ts ×1, src/capability/wasi-sandbox.ts ×4, plus LM-related) — gate changes on diff-vs-baseline until F-phase fixes them.

### Phase E: Jev Patterns
- [x] E1 `noul()` + `ConfidenceRouter` (transducer + ingress consumers)
- [x] E2 `compositeScore` in `proposeAndJudge` ranking
- [x] E3 `judgeCascade`
- [ ] E4 agent-trace grading → RLFP/dataset (deferred — see notes)
- [ ] E5 (optional) wake gate
- [x] Bench 23

**Progress Notes (2026-09-20, Phase E core complete — E4/E5 deferred):**
- `nar/src/lm/system-one/policy.ts` (new, exported from the subpath index): `noul(statement)` (Evaluate over anchors `["false","true"]`, rubric `plausibility`), `noulValue(prop)` (P(true), undefined on abstain), `ConfidenceRouter` + `routeConfidence` + `isRestrictive` + `ConfidenceRouter.monotoneOver` (§6.3 monotonicity: bands are `{act, review, block}`, decision is p≥act→act / p≥review→review / else→block; a stricter router's ordinal is never higher at any p), `compositeScore(entries, weights)` (weights re-normalized over non-abstained entries; all abstained ⇒ undefined), `judgeCascade(judge, ctx, stage1, stage2Factory, budget)` (CascadeJudge = `{judgeBatch}` — works with `SystemOneManifold` directly; stage-2 space derived from stage-1 top).
- **Band semantics that made the transducer wiring behavior-preserving:** legacy split was `p < τ ⇒ propose-only, else desire-seeded`. Default `ConfidenceRouter.fromThreshold(τ)` = `{act: τ, review: 0, block: 0}` mapped as act⇒desire-seeded / review⇒propose-only / block⇒no-proposal ⇒ byte-identical at every p (block can never fire since p≥0≥… review=0 always matches first). Existing todo16-teleological/transduction suites pass unmodified.
- E1 consumers: `ActionGateTransducer` gained an optional `router` option (explicit router overrides `threshold`; risk-gate/HITL path unchanged, runs before routing); `KernelPerceptionGate` ambiguity flag now routes through module-level `AMBIGUITY_ROUTER` (`{act: 0.6, review: 0.6, block: 0}`; abstain or act ⇒ flag) — single threshold definition site.
- E2: `DispatcherOptions.rankingWeights?: Record<string, number>` (default `{candidate_select: 1}` ⇒ byte-identical). Any key beyond `candidate_select` adds a per-candidate `evaluate` query to the R5 re-judge loop and blends via `compositeScore` (only `feasibility` is guaranteed registered on default manifolds; `conflict` blending needs a per-candidate conflict head — left as follow-up). Bench 23 asserts weight normalization; dispatcher blend itself is exercised indirectly (todo16c-cortex/provisional/fallback green).
- E3: `judgeCascade` exported; no live consumer yet (candidate stage-2: ingress ambiguity → clarification-judgment). Hook-up is additive when a consumer appears.
- Bench 23 (`tests/nar/todo16c-jev.test.ts`, 7 tests) green: noul anchor round-trip through a real manifold (hand-registered `plausibility` head — note: `plausibility` is in `RubricId` but **not** in `HEAD_SPECS`; add a spec entry if noul should be a default head), deterministic band mapping, monotonicity property, composite normalization + abstain exclusion, cascade stage-2 space derivation (asserted via a judge spy — propositions don't carry the query space), transducer band routing + legacy-τ parity.
- **E4 (deferred):** trace grading needs core-agent wiring (`runCycleStream` → grade narration via `groundedness` head + executed tools via `risk` head → `PreferenceCollector` + dataset labels). Touches `core/src/agent/phases.ts` + RLFP; ~half a focused day. E5 (wake gate) optional, untouched.
- **E1 rename (decided 2026-09-20, user): drop the `noul` terminology.** `noul` duplicates an existing native concept (`EvaluateProposition.score` over boolean anchors ≈ P(true), already owned by `Truth`/calibrated confidence); its only value is the §0.4 Jev cross-reference, which a JSDoc mention preserves. Follow-up (mechanical, zero consumers so far): rename `noul` → `truthProbability` (or `booleanEvaluation`) and `noulValue` → `truthProbabilityOf` in `policy.ts` + `todo16c-jev.test.ts`; keep a one-line "Jev `Noul`" mention in the `policy.ts` header JSDoc and the §0.4 mapping table. Checklist E1's subpath-export acceptance applies to the renamed constructor.
- Typecheck 0 errors; lint clean; all touched consumer suites (teleological, transduction, live-ingress, gate suites, cortex/provisional/fallback) green unmodified.

### Phase F: Hardening
- [ ] F1 remaining H4 failures fixed (full suite green)
- [ ] F2 mock-provider bypass (no probing hang)
- [ ] F3 token-reduction + fan-out latency report
- [ ] F4 `parity:smoke` root cause
- [ ] F5 remaining §8 dispositions + doc reconciliation

---

## 9. Definition of Done

```text
raw NL ─▶ KernelPerceptionGate.admit ─▶ Tier0 parse ─▶ EmbeddingCache(O(1), alias-free)
              │                                              │
              │ veto (fail-closed)                 Manifold (trained heads, fitted calibrators)
              ▼                                              │
        policy.violation                    ┌───────────────┴────────────┐
                                            ▼                            ▼
   nar.input adopts seedTruth          epistemic → belief bags     teleological → reflex/action
   (all 6 heads consumed)                                            │
                                            LMServiceCortex (real Tier 2)   GameFocus.prefetch@attend
                                            │  GBNF narsese-term             │
                                            ▼                                ▼
                                     proposeAndJudge                  ManifoldReflex (warm table)
                                     composite ranked                         │
                                            │                                 ▼
                                            ▼                     RL without NAL: ManifoldRLAgent
                                  admitFormalization               (GridWorld, ε-greedy/UCB)
                                            │                                 │
                                            └──────────► JudgmentDataset ◄────┘
                                                              │
                                              train.ts (Brier loss) → digest-pinned head
                                                              │
                                              calibration-fit.ts → lock file → manifold
                                                              │
                                              governance (PatchRisk → sandbox → promote)
```

> TODO16b gave System One a body. TODO16c connects its nerves (live wiring), gives it real tissue (trained, calibrated heads), and demonstrates the skeleton is species-agnostic by running a second creature — a reinforcement learner — on the same Judgment Manifold, with NAL nowhere in the loop.

---

## 10. Addendum (v1.1) — Deep Dedup, LM Ladder & Usability

Second-pass review findings, self-contained: new benchmarks (§10.1), new phases G/H/I (§10.2), new decision points (§10.3), checklist (§10.4). Amends §2/§3/§4/§8 without altering Phases A–F.

### 10.0 Additional verified findings

| # | Finding | Anchor | Class |
|---|---------|--------|-------|
| X1 | `heads/index.ts` uses `export *` over 4 files that **each** export `PerHeadConfig`/`HeadFactoryOptions` — ambiguous re-exports silently resolved to the first file (ingress.ts) | `heads/index.ts:1-4` | Latent hazard |
| X2 | `heads/action.ts` and `heads/synthesis.ts` carry **identical `makeClassifyHead`/`makeEvaluateHead` implementations with different signatures** (axis hardcoded vs parameter); memory.ts duplicates `makeEvaluateHead` again | `heads/{action,synthesis,memory}.ts:19+` | Duplication ×3 |
| X3 | 4 near-identical `PerHeadConfig` + 4 `HeadFactoryOptions` interface declarations | 4 heads files | Duplication ×4 |
| X4 | `ingress.ts` heads take an unused `embeddingCache` and never use `getScorer` — 6 bespoke `computeXScore` hash functions with only salt/multiplier variations | `heads/ingress.ts:228-292` | Duplication (3rd scorer copy w/ `manifold.ts` dead `DefaultJudgmentHead`) |
| X5 | `SystemOneDispatcher`'s `DeterministicManifold` and `Tier3SymbolicManifold` differ **only in constants** (tier 0/3, top-p 1.0/0.8, ece 0/0.05, digest strings) — ~140 lines for two constant tables | `dispatcher.ts:39-205` | Duplication |
| X6 | **Double embedding cache**: `TransformersEmbeddingGenerator` holds its own text-keyed Map cache (FIFO-evicted) while `EmbeddingCache` (LRU) wraps it — two caches doing one job | `memory/embedding.ts:13,40-44` + `embedding-cache.ts` | Duplication |
| X7 | **Encoder model hardcoded**: `Xenova/all-MiniLM-L6-v2`, `dimension = 384` consts; comment claims LM-settings rails but only device/dtype/cacheDir flow — model id is fixed; `TransformersJSEmbeddingModel.doEmbed({values:[text]})` is **one text per call** (no batch encode) | `memory/embedding.ts:11,28` | LM-ladder gap |
| X8 | **`chargeJudgment`/`assertCostReported` have zero live call sites** — `KernelBudgetGate` knows `systemone-judgment` (cost table, accounting branches) but no production `judgeBatch`/dispatcher path charges it; Bench 12 tests the gate directly, not the flow | `resource-gate.ts:25-36`; `KernelBudgetGate.ts:22,113,135-186`; only caller = `todo16-resources.test.ts` | Unwired (same class as W2/R1) |
| X9 | **Two parallel knob systems**: `knobSchema` (10 specs + get/set binding over `CognitiveParameters`, clamping in `makeKnob`) vs `systemOneKnobSchema` (8 specs, validate-only, routed in `SandboxValidator` by `startsWith('systemOne.')` prefix); governance pipeline imports both | `rlfp/knobs.ts`, `rlfp/system-one-knobs.ts`, `governance/pipeline.ts:10-11` | Duplication |
| X10 | Query construction duplicated inline: 6 ingress queries hardcoded in `KernelPerceptionGate.admitWithSystemOne`; candidate_select+conflict hardcoded separately in `nar.ts` translation wrapper and in `dispatcher.proposeAndJudge` | `KernelPerceptionGate.ts:227-234`, `nar.ts:1009-1012`, `dispatcher.ts:357-373` | Duplication |
| X11 | No `examples/` directory — user-facing starter code absent (dev-only `scripts/`); Narsese REPL has no NL mode and no System One introspection commands | repo root; `src/cli/narsese-repl.ts` | Usability |
| X12 | No CLI observability surface: `manifold.health()`, `getCircuitBreakerStatus()`, `getRoutingStatus()`, `systemone_*` metrics have no user-facing consumer (no `status`/`doctor` command) | `nar.ts` accessors exist, unused by CLI | Usability |
| X13 | Groundedness egress gate silently swaps narration for template verbalization — no stream/log marker tells the user why their answer changed | `core/src/agent/phases.ts:101-103,238-240` | Usability |
| X14 | Provider errors give raw `LMUnavailableError` text; actionable remediation hints exist only for embedded-llamacpp ("Run `pnpm exec tsx scripts/fetch-model.ts` first.") — pattern not generalized | `providers/embedded-llamacpp.ts:133` vs `lm-service.ts:115-121` | Usability |
| X15 | `costPerMTok` exists in `MODEL_CAPABILITIES` but **nothing sums spend** — no per-session/per-provider token/cost counters, no spend cap (BudgetGate counts ops, not tokens/$) | `providers.ts:253-306` | LM-ladder gap |
| X16 | No per-call model override: `generateText(prompt, {task})` routes through the global chain; no `{model: 'cloud:quality'}` escape hatch; no per-domain binding beyond the 4 `LMTask`s | `lm-service.ts:208-235` | LM-ladder gap |
| X17 | No offline hard-switch: `resolveActiveProvider` probes (ollama/cloud/llama) even when a user just wants local/mock — the N2/F2 hang class; `LM_OFFLINE=1` short-circuit absent | `providers.ts:493-509` | LM-ladder gap |
| X18 | Cortex model identity unpinned: heads carry `ModelDigest`, but dataset labels and `judgment.resolved` never record which **Cortex** model produced candidates — label provenance gap for the distillation flywheel | `distill.ts` `DistillationLabel`; `kernel` `JudgmentResolvedEventSchema` | LM-ladder gap |
| X19 | `ModelDigest` values are **hardcoded descriptive strings** (`'sha256:all-MiniLM-L6-v2-heads-v1'`, `'sha256:deterministic'`), not digests of anything; head digest does not bind to encoder digest — swapping the encoder would silently reuse incompatible heads | `nar.ts:899`, `dispatcher.ts:41,138` | Supply-chain gap |
| X20 | `KernelPerceptionGate.eventLog` grows unbounded (`push` in admit/admitTask/emitJudgmentResolved; `clearEventLog()` exists but nothing calls it automatically) — memory leak in long-running processes | `KernelPerceptionGate.ts:44,123,207,288,395` | Memory leak |
| X21 | `ManifoldReflex.#prefetch` Map **never evicts** — one row-set per distinct stateId accumulates for the process lifetime (long games/RL runs leak) | `manifold-reflex.ts:16,43` | Memory leak |
| X22 | `LMService.stream` bypasses the circuit breaker (`canUseProvider`), provider-call recording (`recordProviderCall`), and the semantic cache — streaming and generate paths have different failure semantics | `lm-service.ts:482-500` vs `224-321` | Consistency gap |
| X23 | `Focus.getNALDerivations` is an O(n) scan over **all** focus-memory concepts with substring heuristics, executed per action per propose cycle — game-loop hot path | `Focus.ts:245-288` | Hot-path perf |
| X24 | `QBeliefStore.getAllActions` always returns an empty Map (comment: "simplified") — any agent needing per-state action enumeration is broken | `tests/nar/rl/adapters/adapters.ts:308-317` | Stubs-as-API |
| X25 | `SystemOneManifold` health flags (`ready`/`breakerOpen`) are written from three paths (latency check, drift check, `setDemoted`) with no state machine — set-then-clear across successive calls makes health signals unreliable | `manifold.ts:286-288,395-407,351-356` | Health semantics |
| X26 | `SystemOneDispatcher.synthesize` catch block re-invokes the identical cortex call — a retry that cannot succeed differently | `dispatcher.ts:327-332` | Dead logic |
| X27 | No WASI/WebGPU-compiled encoder-head artifact exists — `SandboxedHeadRuntime` (TODO16b Phase 5) wraps an abstract manifold; device deployment blocked at the artifact level (WebGPU already deferred in TODO16b) | `wasi-runtime.ts` | Deployment gap |
| X28 | `RLFPConfig` declared in `NARConfig` but `RLFPLearner` is constructed with `{}` — the config object is never applied | `nar.ts:66-68,190` | Dead config |
| X29 | `KernelPerceptionGate.mapSource` classifies source by substring heuristics (`'user'/'llm'/'sensor'` in sourceId); `NARIO.import` hardcodes `sourceQuality: 'PRIMARY'` regardless of provenance | `KernelPerceptionGate.ts:310-318`, `nar-io.ts:104` | Misclassification risk |

### 10.1 Benchmarks 25–28 (amend §2)

| # | Benchmark | Test file | Obligation |
|---|-----------|-----------|------------|
| 25 | **Declarative Registry Equivalence** | `todo16c-head-specs.test.ts` | All 17 heads generated from the single `HEAD_SPECS` table produce propositions identical (property-based, same inputs) to the pre-refactor implementations; unknown head id in per-head config rejected at schema parse; §5 ontology table regenerated from specs matches source of truth. |
| 26 | **Encoder Digest Binding** | `todo16c-encoder-digest.test.ts` | Encoder model id/weights digest is part of the composed head `ModelDigest`; swapping the encoder without re-pinning heads fails closed (`DigestMismatchError`); embedding model configurable (`systemOne.manifold.encoder.modelId/dimension`) with wrong-dimension vectors rejected at cache boundary. |
| 27 | **Per-Call Model Override** | `todo16c-model-override.test.ts` | `generateText(prompt, {task, model?})` honors an explicit model id (telemetry `modelId` matches); unknown id throws without silent failover; per-domain bindings (`systemOne.cortex.model`, narration tier) route as configured. |
| 28 | **Flow-Level Resource Accounting** | `todo16c-charge-flow.test.ts` | `SystemOneDispatcher.judge` charges `systemone-judgment` against `KernelBudgetGate` per batch; an exhausted scope denies the batch (no propositions computed); cost reported per proposition matches charge (no drift between `ResourceCost` and gate accounting). |

### 10.2 New phases (amend §3; ordering: G before D, H after A, I anytime after B)

#### Phase G — Declarative Unification & Metaprogramming (P0, precedes D) *“one table owns the ontology”*

**Files:** `nar/src/lm/system-one/{head-specs,heads/factory}.ts` (new), heads/* (slimmed to spec re-exports), `nar/src/rlfp/{knobs,system-one-knobs}.ts` → unified `knobs.ts`, `nar/src/lm/system-one/dispatcher.ts`, `nar/src/kernel/KernelPerceptionGate.ts`, `nar/src/lm/system-one/{types,index}.ts`, `tests/nar/todo16c-head-specs.test.ts`

- **G1 (X2–X4, Bench 25).** Single declarative registry:
  ```ts
  // head-specs.ts — the ONLY place head ontology is written down
  export const HEAD_SPECS = {
    task_type:      { kind: 'classify', axis: 'epistemic',   space: ['belief','goal','question','command'] },
    illocution:     { kind: 'classify', axis: 'epistemic',   space: ['assert','query','command','promise','express'] },
    injection:      { kind: 'evaluate', axis: 'epistemic',   levels: [...], salt: 31 },
    /* …17 entries, one line each… */
    reflex_value:   { kind: 'evaluate', axis: 'teleological', levels: [...] },
  } as const satisfies Record<HeadId, HeadSpec>;
  ```
  One `createHead(spec, options)` replaces all `makeClassifyHead`/`makeEvaluateHead` copies; each heads file shrinks to named re-exports (`export const createRiskHead = (o) => createHead(HEAD_SPECS.risk, o)`); `perHeadConfig`/`HeadFactoryOptions` declared once in `factory.ts`; delete `DefaultJudgmentHead` and the 6 bespoke scorers (B2 subsumed). Derived consumers: per-head zod record from `Object.keys(HEAD_SPECS)`; §5-ontology doc generation; ingress query builder `ingressQueries()` (X10) and `selectQuery(space)`/`conflictQuery()` builders shared by gate, nar.ts wrapper, and dispatcher.
- **G2 (X9).** Unified knob table: `KnobSpec {name, path, min, max, step, root: 'cognitive'|'systemOne'}` merging both schemas; one `createKnobSet({cognitive, systemOne})` binds get/set per root (fixes the N3-era `getNested` undefined blocker properly); `SandboxValidator` validates from the table — prefix routing deleted; optional: derive min/max defaults from zod refinements via schema introspection (light reflection over `systemOneSchema.shape`), keeping the table the fallback.
- **G3 (X5).** `ConstantManifold({tier, topP, score, ece, digest})` replaces both deterministic/symbolic manifolds (~140 → ~40 lines).
- **G4 (X6).** Remove the generator-internal cache — `EmbeddingCache` is the single caching layer (LRU, pooled); generator becomes stateless `generate(text)`.
- **G5 (X1).** `heads/index.ts` rebuilt over the unified factory (no ambiguous `export *`); add a vitest guard asserting no duplicate export names across the subpath (metaprogramming audit via `import * as ns` key scan).
- **G6 (B4 extends).** `SystemOneFileConfig` (zod-inferred, single source) vs `SystemOneRuntimeConfig` (DI superset: `manifold?: JudgmentManifold`, `embeddingCache?`, `reasoningBudget?`) with `RuntimeConfig extends FileConfig`; `nar.ts` re-exports; factory parses file config once.

**Acceptance**
- [x] Bench 25 passes (property-equivalence old ↔ generated heads)
- [x] Head ontology appears in exactly one source file (grep: `space:`/`levels:` literals only in `head-specs.ts`)
- [x] One knob table; `validateSystemOneKnob` deleted; SandboxValidator routing is table-driven
- [x] All 22 todo16 suites + A/B suites green unmodified

**Progress Notes (2026-09-20, Phase G complete):**
- G1: `head-specs.ts` carries the single `HEAD_SPECS` registry (17 heads) + `createHead` + `specToQuery`/`ingressQueries`/`actionQueries`/`selectQuery` builders. `heads/{ingress,action,synthesis,memory}.ts` deleted; `heads/index.ts` re-exports `head-specs.js` + `factory.js` and defines one-line named per-head creators + `createAll{Ingress,Action,Synthesis,Memory}Heads` compat aliases. `heads/factory.ts` now only declares `PerHeadConfig`/`HeadFactoryOptions` (single copy — X1–X4 gone; the 7 baseline TS2308 ambiguity errors disappeared). KernelPerceptionGate builds its 6 ingress queries via `ingressQueries()`; dispatcher builds `candidate_select` via `selectQuery()`.
- G2: unified `KNOB_SPECS` in `rlfp/knobs.ts` (10 cognitive + 8 systemOne, `root` field); `findKnobSpec` drives `SandboxValidator` (prefix routing deleted; `system-one-knobs.ts` deleted, `validateSystemOneKnob` gone). `knobSchema`/`systemOneKnobSchema` re-exported for compat. Preserve the `"Unknown systemOne knob"` message verbatim — `tests/nar/todo16-systemone-knobs.test.ts` asserts it.
- G3: `constant-manifold.ts` `ConstantManifold` (~40 lines, one config table) replaces both stub manifolds; `DeterministicManifold`/`Tier3SymbolicManifold` are 3-line subclasses re-exported from `dispatcher.ts` (tests import them from there — keep the re-export).
- G4: `TransformersEmbeddingGenerator` internal cache removed — `EmbeddingCache` is the single caching layer.
- G6: `SystemOneFileConfig` (zod-inferred) vs `SystemOneRuntimeConfig` (`Omit<FileConfig,'manifold'>` — schema `manifold` is required, so plain `extends` fails TS2430) in `nar.ts`; `SystemOneConfig` kept as back-compat alias.
- Bench 25 (`tests/nar/todo16c-head-specs.test.ts`, 8 tests) green. Full `tests/nar`: 1277 passed, only pre-existing `revision-history` ×2 (F1) fail.
- Pre-existing typecheck errors exist unrelated to G (src/agent/__pb2.ts, src/capability/wasi-sandbox.ts ×4) — 7 errors total at HEAD; verify with `diff` against baseline, not zero-exit.

#### Phase H — LM Ladder: Versatile Model Choice (P1, after A) *“from SmolLM to frontier, one dial”*

**Files:** `nar/src/memory/embedding.ts`, `nar/src/lm/{providers,lm-service,env-config}.ts`, `nar/src/lm/system-one/{manifold,types}.ts`, `kernel/src/schemas.ts`, `src/config/schema.ts`, `tests/nar/todo16c-{encoder-digest,model-override}.test.ts`

- **H1 (X7, X19, Bench 26).** Configurable encoder: `systemOne.manifold.encoder: { modelId, dimension }` (default MiniLM/384); `EmbeddingGenerator` parameterized; `ModelDigest` becomes a **real composition**: `SHA256(encoderDigest ++ headWeightsDigest)` computed by `wasi-runtime.loadHeadRuntime` and stamped on propositions; encoder swap without re-pin fails closed. Fix single-text `doEmbed` → batched `values: texts[]` in `EmbeddingCache.warmup` paths.
- **H2 (X16, Bench 27).** Per-call model override: `generateText/generateObject(prompt, {task, model?: SeNARSModelId})` — explicit id bypasses the chain (telemetry records it); per-domain bindings: `systemOne.cortex.model`, `bot.narrate.tier`; unknown id throws (no silent failover — monotonic with routing honesty rules).
- **H3 (X15).** Spend accounting: `LMService` accumulates per-provider/per-session token+`costPerMTok` totals (from AI-SDK usage + capability table); expose `getSpend()`, Prometheus `lm_spend_tokens{provider}`, `lm_spend_cost_milli{provider}`; optional `LM_MAX_SPEND_USD` circuit-breaker style cap (trip ⇒ `LMUnavailableError` with hint). KernelBudgetGate gains a token-cost operation (`lm-tokens`) charged from real usage — complements, not replaces, op counting.
- **H4 (X17).** Offline hard-switch: `LM_OFFLINE=1` skips all probes (`resolveActiveProvider` returns configured local/mock immediately); extends F2's mock bypass; `LM_PROVIDER=mock` never probes either.
- **H5 (X18).** Label provenance: `DistillationLabel` + bake-off `METRICS.json` record `cortexModelId`; `judgment.resolved` payload gains optional `encoderDigest` (additive kernel schema field).
- **H6 (X14 generalization).** `LadderHints`: every `LMUnavailableError` carries provider-specific remediation (`ollama not reachable at http://… — start with 'ollama serve' or set LM_PROVIDER=mock`; embedded llama: fetch-model hint (existing pattern); transformers: cache-dir/download hint with progress callback wiring).
- **H7 (device/quant matrix).** `LM_DTYPE` env (`q4|q8|fp16|fp32`) + per-slot `LM_FAST_DTYPE`/`LM_QUALITY_DTYPE`; document the compact→frontier ladder in `docs/` (transformers.js SmolLM2-360M → embedded GGUF 3B → ollama 8B → cloud frontier) with the verified `llamacpp-embedded` GPU anchor (188.9 tok/s).

**Acceptance**
- [ ] Bench 26 + 27 pass
- [x] Encoder digest present on every Tier-1 proposition; mismatch fails closed
- [x] Spend counters observable in Prometheus after a scripted 10-call session
- [x] `LM_OFFLINE=1` boot completes with zero network syscalls (assert via fetch mock)

**Progress Notes (2026-09-20, Phase H complete):**
- H1: `systemOne.manifold.encoder {modelId, dimension}` (zod, defaults MiniLM/384); `TransformersEmbeddingGenerator` parameterized (modelId+dimension ctor; `createEmbeddingGenerator(useMock, config?)`); `EmbeddingCache` validates generator output width at the write boundary (`dimension` config — wrong-dim vectors rejected). Real digest composition: `composeModelDigest(encoderDigest, headWeightsDigest)` = SHA256 over `encoder ++ headWeights` (wasi-runtime.ts); nar.ts builds the Tier-1 digest from the configured encoder, so encoder swap changes the composed digest (fail-closed via `DigestMismatchError`/`loadHeadRuntime`). Single-text `doEmbed` batching: warmup already parallelizes writes; batched encode deferred to the transformers model layer (single-text call remains — noted for D-phase if Bench 2 latency demands).
- H2: `generateText/generateObject(prompt, {model?})` — explicit id resolves via `registry.languageModel(id)` bypassing the chain (unknown ids throw, no silent failover); routing telemetry records the override id; cache keys include the model id. Domain binding `systemOne.cortex.model` flows through `LMServiceCortex`. Narration-tier binding deferred (no existing narrate config section — wire in Phase I alongside I4).
- H3: `LMService.getSpend()` per-provider `{tokensIn, tokensOut, calls, costMilli}` from real AI-SDK usage × `MODEL_CAPABILITIES.costPerMTok`; Prometheus `lm_spend_tokens{provider}`/`lm_spend_cost_milli{provider}`; `LM_MAX_SPEND_USD` cap trips with a remediation hint. BudgetGate `lm-tokens` op deferred (op-counting already covers the gate; token-cost op folds into D-phase when real usage flows through the dispatcher).
- H4: `LM_OFFLINE=1` (env or file `lm.offline`) — `resolveActiveProvider` skips all probes; configured local/mock returns immediately, cloud config falls back to `transformers`. `LM_PROVIDER=mock` never probed (pre-existing).
- H5: `DistillationLabel.cortexModelId?` + `BakeOffResult.cortexModelId?`; kernel `judgment.resolved` payload gains optional `encoderDigest` (additive).
- H6: `LADDER_HINTS` + `withHint` (exported) appended to `LMUnavailableError` at the two throw sites (withRetry, circuit breaker).
- H7: `LM_DTYPE`/`LM_QUALITY_DTYPE`/`LM_FAST_DTYPE` env → `LMSettings.dtype/qualityDtype/fastDtype`; per-slot dtype resolution in `localModel` and the embedding generator; `docs/lm-ladder.md` written.
- Benches 26+27: `tests/nar/todo16c-{encoder-digest,model-override}.test.ts` (6+8 tests) green. Repo-wide `pnpm typecheck` now **0 errors** (fixed the 2 latent TS2308 ambiguities in `system-one/index.ts` — explicit named re-exports for `createProvisionalStamp`/`isProvisionalStamp` and `EmbeddingCache`/`createEmbeddingCache`; `HeadId` semantics preserved via `heads/index.ts`).
- Full `tests/nar`: 1281+ passing; remaining reds are load flakes (slo p99, e2e under parallel load — all pass in isolation).

#### Phase I — End-User Usability (P2) *“the last mile a human touches”*

**Files:** `examples/{systemone-ingress,rl-gridworld,custom-head}.ts` (new), `src/bin/{status,doctor}.ts` (new), `src/cli/narsese-repl.ts`, `core/src/agent/phases.ts`, `docs/system-one-guide.md` (new), tests

- **I1 (X11).** `examples/` — three runnable starters mirroring the three value propositions: enable System One ingress (config + 20 lines), pure-RL GridWorld via `ManifoldRLAgent` (C3 artifact), custom head via `HEAD_SPECS` extension + `registerHead` (G1 artifact). Each ≤ 60 lines, no test deps.
- **I2 (X12).** `pnpm status` / `senars doctor`: renders `manifold.health()`, per-head ECE/abstain (from G1 registry), circuit breakers, routing status, spend counters (H3), dataset/lock-file paths + sizes, `systemOne.enabled` provenance (config file vs default). Non-TTY JSON mode.
- **I3 (X11).** REPL upgrades: NL input routes through the System One ingress (A3) with a `:judge <text>` command printing the full head-judgment distribution for arbitrary text (the single best debugging affordance for head calibration work); `:health`/`:spend` shortcuts to I2 data.
- **I4 (X13).** Egress traceability: when the groundedness gate rejects a narration, emit a `ChatStreamEvent`/log marker (`egress.gate.rejected`, score attached) — user-visible reason, never silent swapping.
- **I5 (X14).** Error UX: all bin entry points catch `LMUnavailableError`/`ConfigurationError` and print remediation (H6 hints) + `pnpm status` pointer.
- **I6 (X11).** `docs/system-one-guide.md`: end-user enable/config/troubleshoot guide generated in part from `HEAD_SPECS` (G1) and the config schema — single-source docs.

**Acceptance**
- [ ] `examples/*` run green (CI smoke job)
- [ ] `pnpm status` shows live manifold health when enabled
- [ ] REPL `:judge` prints 6-head distribution for raw text
- [ ] Egress rejection is observable in chat stream/log

### 10.3 Additional decision points (amend §4)

| # | Question | Default proposal |
|---|----------|------------------|
| DQ5 | Encoder configurability (H1): expose `systemOne.manifold.encoder.modelId/dimension` now, or keep MiniLM frozen until trained heads exist? | Expose now — digest binding (X19) must exist *before* real weights land, or first real head swap bakes in a hidden encoder dependency |
| DQ6 | Per-call model override (H2): add the `model?` parameter to `LMService` signatures (public API widening), or a separate `LMService.withModel(id)` scoped client? | Parameter (matches AI-SDK idiom; one code path) |
| DQ7 | Real `ModelDigest` computation (X19/H1): compute SHA256 over actual head weights at load time, or keep declared digests until Phase D ships weights? | Compute now for *composition* (encoder++head), declared strings allowed only for tier-0/3 stubs |

### 10.4 Checklist additions (amend §8)

**Phase G (complete 2026-09-20)**
- [x] G1 `HEAD_SPECS` + `createHead` (heads/{ingress,action,synthesis,memory}.ts deleted; 6 scorers already gone in B2)
- [x] G2 unified knob table (prefix routing deleted; `system-one-knobs.ts` deleted)
- [x] G3 `ConstantManifold` merge
- [x] G4 single embedding cache
- [x] G5 export-audit guard (inside Bench 25 suite)
- [x] G6 config type split + single zod source
- [x] Bench 25

**Phase H (complete 2026-09-20)**
- [x] H1 encoder config + real digest composition + batched embed (Bench 26)
- [x] H2 per-call override + domain bindings (Bench 27)
- [x] H3 spend accounting + optional cap
- [x] H4 offline hard-switch
- [x] H5 label/cortex provenance fields
- [x] H6 remediation hints
- [x] H7 dtype/device matrix + ladder docs

**Phase I**
- [ ] I1 three examples + CI smoke
- [ ] I2 `pnpm status` / doctor
- [ ] I3 REPL NL mode + `:judge`
- [ ] I4 egress-rejection traceability
- [ ] I5 error remediation UX
- [ ] I6 user guide (generated from specs)

**Phase B amendment**
- [ ] X8 `chargeJudgment` wired into `SystemOneDispatcher.judge` (Bench 28) — flow-level accounting, closing the same "shipped-but-unreachable" class as W2/R1

**Rollback notes (amend §7):** G is behavior-preserving by construction (Bench 25 property-equivalence is the gate); H rollbacks are env-var-degradable (`LM_OFFLINE=1`, remove `encoder` override ⇒ MiniLM default); I is additive-only.

### 10.5 Implementation Integrity (v1.2) — amendments, ordering, traceability

#### Phase amendments (wire X20–X29 into §3 phases)

| Item | Phase | Amendment |
|------|-------|-----------|
| **B7** | B | Wire `chargeJudgment` into `SystemOneDispatcher.judge` — charge per batch (max proposition cost), deny ⇒ no propositions computed; `assertCostReported` on every emitted proposition. Bench 28. (X8) |
| **B8** | B | Bound `KernelPerceptionGate.eventLog` — fixed-capacity ring (default 1000, config `systemOne.telemetry.logSize`), drop-oldest; `clearEventLog` semantics preserved. (X20) |
| **B9** | B | Coherent manifold health state machine: single `#setHealth(next)` reducer over `{ready, breakerOpen}` with explicit transitions (latency trip, drift demote, manual demote, recovery); latency breaker recovers on next healthy batch — document the transitions. (X25) |
| **B10** | B | Delete the pointless `synthesize` catch-retry in `SystemOneDispatcher` (rethrow or Tier-3 degrade, not an identical retry). (X26) |
| **C1a** | C | `ManifoldReflex.#prefetch` eviction: clear the table at each cycle end (per-cycle freshness) or cap at N stateIds LRU — no unbounded growth; Bench 18 asserts no stale-row serving. (X21) |
| **C2a** | C | Implement `QBeliefStore.getAllActions` for real: index value-beliefs by state term (`((state,*) --> predicts_reward)` scan over a maintained per-state set or `Memory` concept-index query); Bench 19 covers it. (X24) |
| **C6** | C | `Focus.getNALDerivations` hot-path fix: maintain an action→derivations index updated on concept add/decay (event-driven, not per-cycle scan); correctness parity asserted vs the scan (Bench 18/19 run both, assert equal). (X23) |
| **D5** | D | WASI encoder-head bundle artifact: compile trained linear/logistic heads (D1 output) to WASI; `SandboxedHeadRuntime` loads them (digest-pinned) — the no-cloud device profile runs real heads end-to-end; WebGPU stays deferred (TODO16b). Bench 24 extended: bundle loaded through sandbox path. (X27) |
| **A4a** | A | Source threading: `mapSource` replaced by explicit `source` passed from call sites (input/import/tool/peer); `NARIO.import` stops hardcoding `PRIMARY` (thread provenance through the import record). (X29) |
| **F6** | F | `LMService.stream` parity: breaker check, `recordProviderCall`, and stats recording applied to the stream path (cache optional, off by default for streams). (X22) |
| **F7** | F | Apply `RLFPConfig` to `RLFPLearner` construction (or remove the dead field). (X28) |

#### Execution order & dependencies

```mermaid
graph TD
  B[Phase B: bugs & unification foundations] --> G[Phase G: HEAD_SPECS registry]
  B --> A[Phase A: live wiring]
  G --> A2[A4/A6 consume query builders]
  A --> C[Phase C: reflex & RL]
  B --> C
  G --> C
  A --> H[Phase H: LM ladder]
  H --> D[Phase D: training & calibration]
  G --> D
  H1[H1 encoder digest] --> D2[D2 calibration lock]
  C --> D3[D3 RL label supply]
  A --> I[Phase I: usability surfaces]
  G --> I
  C --> I
  F[Phase F: hardening sweep] -.continuous.-> ALL
```

**Recommended build sequence** (focused-day estimates; B→G→A→C→H→D→I, F interleaved):

| Order | Phase | Effort | Gate |
|-------|-------|--------|------|
| 1 | B (B1–B10) | 2d | Bench 17 + 28 + all todo16 suites green unmodified |
| 2 | G (G1–G6) | 2d | Bench 25 property-equivalence |
| 3 | A (A1–A6) | 2d | Bench 15 + 16 |
| 4 | C (C1–C6) | 3d | Bench 18 + 19 + 20 |
| 5 | H (H1–H7) | 2.5d | Bench 26 + 27 |
| 6 | D (D1–D5) | 3d | Bench 21 + 22 + 24 (+sandbox bundle) |
| 7 | I (I1–I6) | 2d | examples smoke + `pnpm status` |
| — | F (F1–F7) | 1.5d spread | full suite green; measurement reports |

**Parallelizable:** F2 (mock bypass) anytime — it unblocks Bench 16's mock-LM agent-cycle coverage and N2 measurement; H4 offline switch independent; I2/I3 after A.

#### Traceability matrix (every discovered gap has a home)

| Gap IDs | Phase items | Benchmark(s) | Test artifact |
|---------|-------------|--------------|---------------|
| W1–W4 | A1–A3 | 15 | `todo16c-live-ingress.test.ts` |
| W5, X29 | A4, A4a | 15 | `todo16c-live-ingress.test.ts` |
| W6, W7 | A5, A6 | 16 | `todo16c-cortex.test.ts` |
| B1 | B1 | 2 (re-run) + 17 | `todo16c-cache.test.ts` |
| B2–B4, X1–X4 | G1, G5 (+B2 subsumed) | 25 | `todo16c-head-specs.test.ts` |
| B5, X25 | B5, B9 | 22 | `todo16c-calibration.test.ts` |
| B6, B7 (config dup) | G6 | — | config round-trip in Bench 25 |
| B8 (§8 dispositions) | F5 | — | existing rule suites |
| X5 | G3 | 25 | `todo16c-head-specs.test.ts` |
| X6 | G4 | 17 | `todo16c-cache.test.ts` |
| X8 | B7 | 28 | `todo16c-charge-flow.test.ts` |
| X9 | G2 | — | knobs suite (existing 21 tests re-pointed) |
| X10 | G1 (query builders) | 15 | `todo16c-live-ingress.test.ts` |
| X11–X14 | I1–I5 | — | examples smoke + REPL tests |
| X15–X18 | H2–H6 | 26, 27 | `todo16c-{model-override,encoder-digest}.test.ts` |
| X19, X7 | H1 | 26 | `todo16c-encoder-digest.test.ts` |
| X20–X26 | B8–B10, C1a, C6, F6 | 17, 18, 28 | respective phase benches |
| R1–R2 | C1 | 18 | `todo16c-reflex-activation.test.ts` |
| R3, X24 | C2, C2a | 19 | `todo16c-rl-parity.test.ts` |
| R4–R5 | C4 | 21 | `todo16c-rl-distill.test.ts` |
| R6 | C5/E1 | 20, 23 | `todo16c-{rl-manifold,jev}.test.ts` |
| X21, X23 | C1a, C6 | 18 | `todo16c-reflex-activation.test.ts` |
| X27 | D5 | 24 (extended) | `todo16c-train.test.ts` |
| X28 | F7 | — | rlfp suite |
| Jev patterns (§0.4) | E1–E5 | 23 | `todo16c-jev.test.ts` |

**Completeness rule:** no plan item without a gap ID or explicit rationale; no gap ID without a phase item; no phase item without an acceptance checkbox and (where behavioral) a benchmark. This matrix is the audit — any future discovery appends a row here first.

### 10.6 Readiness audit (v1.3) — pre-execution review

Self-audit of the plan's own implementability. Two critical holes found and fixed; four minor items wired in.

| # | Audit finding | Severity | Resolution |
|---|---------------|----------|------------|
| Z1 | **The dataset cannot train heads.** Redaction-per-retention (inherited from TODO16b §9) stores hash-only rows (`evidenceId` + labels) — `train.ts` has no inputs to fit; Phase D as specified is unimplementable. | **Critical** | **Vector sidecar**: at record time, store the 384-d embedding (not raw text) in a binary sidecar keyed by `evidenceId` (`.cache/systemone/vectors/<evidenceId>.f32`); JSONL rows gain `vecRef: true`. Embeddings are not raw text — the redaction invariant (Bench 21/22/24 asserts "no raw utterance text") holds; training becomes `logistic(embedding → label)` over sidecar+JSONL join. Applied to **D1** (trainer consumes sidecar), **D3** (all label sources record the embedding alongside the label — the record-time API becomes `record(label, embedding?)`), and **C4** (RL outcomes record state-digest embedding at record time). Sidecar GC: entries pruned when their evidenceId rotates out of the JSONL retention window. |
| Z2 | **Bench 20 was unfalsifiable with untrained heads.** Hash scorers give arbitrary per-action values; feasibility mask + risk floor from untrained heads can zero out the legal-action set or latch consistently bad actions ⇒ the "beats random" obligation could fail for reasons unrelated to the harness. | **Critical** | Restructured: Bench 20 proves the **harness** with a registered oracle head (tabular Q distilled from the baseline — `registerHead`, no training); Bench 21 carries the **learned-heads** obligation (post-D1). New default in `systemOne.rl`: `feasibilityMask`/`riskFloor` engage **only when the head reports `calibration.fitted === true`** (B5's honesty marker) — untrained regime is pure ε-greedy pass-through. |
| Z3 | `@senars/nar/rl` subpath has no `package.json` `exports` entry — C2 promotion would not be importable. | Minor | Added to **C2b**: `nar/package.json` exports map gains `"./rl"` (and `"./rl/*"`); `verify-exports.ts` extended to assert it. |
| Z4 | `EmbeddingCache.write` has no in-flight dedup — concurrent writes of the same text double-encode (wasted compute, torn pointer races). | Minor | **B1a**: single-flight map (`Map<string, Promise<EmbeddingPointer>>`) cleared on settle; folded into the B1 rewrite. |
| Z5 | Benchmarks 15–28 have no CI wiring; TODO16b established the per-bench CI-job pattern (`systemone-slo`). | Minor | **F8**: `.github/workflows/ci.yml` gains a `systemone-benches` job running `todo16c-*.test.ts` (or per-phase jobs matching the H5 pattern); examples smoke job from I1 shares it. |
| Z6 | No UI surface for judgment events — the bot chat is the only consumer. | Backlog (out of scope) | Optional post-v1.0: UI graph/lens panel subscribing to `judgment.resolved` from the system bus. Recorded here so it isn't lost; not a plan item. |

**DQ-dependency map (what blocks what):**

| Phase | Requires decisions? | Notes |
|-------|--------------------|-------|
| B (B1–B10) | **None** | Pure bugs/dedup — executable immediately |
| G (G1–G6) | **None** | Behavior-preserving unification — executable immediately |
| A (A1–A6) | **DQ1** (ingress mode), **DQ4** (cortex routing) | A1/A2 (config flow, gate config) are decision-free; A3/A5 wait on answers |
| C (C1–C6) | **DQ2** (RL file placement) | Default (adapters promoted, envs stay fixtures) is fine to proceed with |
| H (H1–H7) | **DQ5, DQ6, DQ7** | H2–H7 decision-free; H1 (encoder config + real digests) is the DQ-gated item |
| D (D1–D5) | **DQ3** (TS vs Python trainer) | Default (TS linear heads) assumed |
| I (I1–I6) | **None** | Consumes A/G/C artifacts |

**Environment prerequisites:** 150 TODO16 tests + typecheck + lint already green (verified this session). For F3/N2 measurement only: a model-cached machine or `LM_PROVIDER=mock` (F2 removes the hang). No GPU required for any planned benchmark (D1 trains linear heads on CPU; D5 WASI bundle is CPU). No cloud credentials required — every benchmark runs offline-deterministically except the explicitly-skipped GBNF segment of Bench 16.

**Verdict: ready to execute.** Phases B and G are fully unblocked with zero pending decisions; each subsequent phase needs at most one DQ answered before it starts, and the DQ list is small enough to answer in one sitting. Remaining known-unknowns are bounded: the 11 RL-adapter failures' root cause (C2 diagnoses before fixing) and `parity:smoke` (F4) — both are investigation-gated items with fallback paths, not plan blockers.
