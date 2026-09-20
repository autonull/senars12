# TODO16c.md — SeNARS System One: Live Wiring, Real Weights & RL Applications

**Version:** 1.1 · continues TODO16b v3.2 (all Phases 0–5, R1–R9, N1–N6, H1–H5 shipped)
**§10 addendum (v1.1):** deep-dedup/metaprogramming (Phase G), LM-ladder versatility (Phase H), end-user usability (Phase I); benchmarks 25–28; decision points DQ5–DQ6.
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
| 20 | **System One RL (no NAR)** | `todo16c-rl-manifold.test.ts` | `ManifoldRLAgent` on `GridWorldEnv` using ONLY `EmbeddingCache` + `JudgmentManifold` + `ManifoldReflex` + `JudgmentDataset` (no NAR, no RuleProcessor): beats random baseline over 50 episodes; reward labels recorded hash-only. |
| 21 | **Reflex-Value Distillation Loop** | `todo16c-rl-distill.test.ts` | Play N episodes → dataset → fit `reflex_value` head (D1 trainer) → digest-pinned head swap → bake-off parity within 2% of tabular-Q value correlation on the same grid. |
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

**Files:** `nar/src/rl/{index,q-belief-store,reward-belief-adapters,perception-action-adapters,parity-harness,selectors}.ts` (promoted from `tests/nar/rl/`), `nar/src/rl/manifold-rl-agent.ts` (new), `nar/src/rl/reflex-label-source.ts` (new), `nar/src/focus/GameFocus.ts`, `nar/src/nar.ts`, `tests/nar/rl/**` (re-pointed imports), `tests/nar/todo16c-reflex-activation.test.ts`, `tests/nar/todo16c-rl-manifold.test.ts`

- **C1 (R1+R2).** `GameFocus.step`: before the propose loop, if a bound reflex exposes `prefetch`, call it at the attend stage with `(state.stateId, cache.write(stateDigest), legalActions, manifold, budget)` — the async gap is absorbed *before* the synchronous `propose` contract; cold-table ⇒ exact incumbent behavior (Bench 18 guarantees). Live consumers: `scripts/rl-parity.ts` (the `parity:smoke` entry — today imports adapters **from tests**, see C2) and the new `scripts/rl-manifold.ts` demo bind ManifoldReflex via `NAR.attachManifoldReflex` with manifold+budget from the existing NAR accessors.
- **C2 (R3).** Promote the RL adapter layer to `nar/src/rl/` with JSDoc — required by `scripts/rl-parity.ts:24-33`, which currently imports `BanditNativeAgent`/`GridWorldNativeAgent`/`RewardBeliefAdapter` **from `../tests/nar/rl/adapters/adapters.js`** (a production script importing test code); fix the 11 broken adapter tests against current memory APIs (root-cause first: `getValue` null ⇒ concept lookup path changed — repair `QBeliefStore` against the live `Memory.getConcept` contract); environments + baselines move to `nar/src/rl/{environments,baselines}/` or remain test fixtures if that is cleaner (decision point DQ2).
- **C3 (the requested demonstration).** `ManifoldRLAgent` + `scripts/rl-manifold.ts`: state → `cache.write(stateDigest)` → one joint `judgeBatch` of `reflex_value` (teleological, per-action) + `feasibility` (mask) + `risk` (safety floor); policy = ε-greedy over manifold scores with feasibility mask and risk floor; **no NAR, no RuleProcessor, no kernel gates** — only `EmbeddingCache`, `JudgmentManifold`, `ManifoldReflex`, `JudgmentDataset`. Runs on `GridWorldEnv` with the existing `SeededRNG` (Bench 20).
- **C4 (R4+R5).** `reflex-label-source.ts`: `recordReflexOutcome(dataset, { stateDigest, action, reward, source })` wired into (a) `GameFocus` reward processing when the winning proposal came from `source: 'manifold-reflex'`, and (b) `ManifoldRLAgent` post-step. `ManifoldReflex.learn` records the label before delegating to the fallback.
- **C5.** `ManifoldUCBReflex`: UCB bonus over `reflex_value` scores using per-action visit counts (comparison policy for Bench 20/21; optional selection by config `systemOne.rl.policy: 'eps-greedy' | 'ucb'`).

**Acceptance**
- [ ] Bench 18 + 19 + 20 pass
- [ ] RL adapter tests import from `@senars/nar/rl`; `tests/nar/rl/adapters/adapters.ts` deleted
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
| DQ2 | RL environments/baselines: promote into `nar/src/rl/` (library) or keep under `tests/` as fixtures while adapters promote? | Promote adapters + harness; keep environments as test fixtures (they are only needed by tests/demo) |
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
- [ ] A1 lifecycle → factory `systemOne` passthrough
- [ ] A2 `gateRegistry.initialize` receives perceptionConfig from NAR
- [ ] A3 `NARIO.input` raw-text ingress + `addTask` adopts calibrated truth/taskType
- [ ] A4 gate consumes all 6 heads + `seedTruth` admission + ambiguity→Question + tense anchor
- [ ] A5 `LMServiceCortex` adapter + dispatcher injection + real `CognitiveContext` assembly
- [ ] A6 `SystemOneLMRuleAdapter` (no monkey-patch)
- [ ] Bench 15 + 16

### Phase B: Correctness & Dedup
- [ ] B1 `EmbeddingCache`: O(1) index, LRU, buffer free-list, no aliasing
- [ ] B2 single scorer + `heads/factory.ts`; delete `DefaultJudgmentHead` + 6 bespoke scorers
- [ ] B3 shared `telemetry.ts`
- [ ] B4 single `SystemOneConfig` (zod-inferred)
- [ ] B5 honest calibration (`fitted` marker; no `observed: predicted` no-op)
- [ ] Bench 17; all 22 todo16 suites green unmodified

### Phase C: Reflex & RL
- [ ] C1 `GameFocus` prefetch-at-attend + `createAgent` binds ManifoldReflex
- [ ] C2 promote `nar/src/rl/`; fix 11 adapter failures
- [ ] C3 `ManifoldRLAgent` (no-NAL RL demo)
- [ ] C4 `reflex-label-source.ts` wired into GameFocus + agent
- [ ] C5 `ManifoldUCBReflex`
- [ ] Bench 18 + 19 + 20

### Phase D: Real Weights
- [ ] D1 `train.ts` + script (RLCD loss = Brier; digest-pinned artifacts)
- [ ] D2 `calibration-fit.ts` + threshold lock file + manifold load
- [ ] D3 auto-flush + Approval/Shadow/clarification/RL label sources
- [ ] D4 remote manifold client/server over `/v1/systemone` shape
- [ ] Bench 21 + 22 + 24

### Phase E: Jev Patterns
- [ ] E1 `noul()` + `ConfidenceRouter` (transducer + ingress consumers)
- [ ] E2 `compositeScore` in `proposeAndJudge` ranking
- [ ] E3 `judgeCascade`
- [ ] E4 agent-trace grading → RLFP/dataset
- [ ] E5 (optional) wake gate
- [ ] Bench 23

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
- [ ] Bench 25 passes (property-equivalence old ↔ generated heads)
- [ ] Head ontology appears in exactly one source file (grep: `space:`/`levels:` literals only in `head-specs.ts`)
- [ ] One knob table; `validateSystemOneKnob` deleted; SandboxValidator routing is table-driven
- [ ] All 22 todo16 suites + A/B suites green unmodified

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
- [ ] Encoder digest present on every Tier-1 proposition; mismatch fails closed
- [ ] Spend counters observable in Prometheus after a scripted 10-call session
- [ ] `LM_OFFLINE=1` boot completes with zero network syscalls (assert via fetch mock)

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

**Phase G**
- [ ] G1 `HEAD_SPECS` + `createHead` (delete 3 makeX copies + 6 scorers + dead head class)
- [ ] G2 unified knob table (prefix routing deleted)
- [ ] G3 `ConstantManifold` merge
- [ ] G4 single embedding cache
- [ ] G5 export-audit guard
- [ ] G6 config type split + single zod source
- [ ] Bench 25

**Phase H**
- [ ] H1 encoder config + real digest composition + batched embed (Bench 26)
- [ ] H2 per-call override + domain bindings (Bench 27)
- [ ] H3 spend accounting + optional cap
- [ ] H4 offline hard-switch
- [ ] H5 label/cortex provenance fields
- [ ] H6 remediation hints
- [ ] H7 dtype/device matrix + ladder docs

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
