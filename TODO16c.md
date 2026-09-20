# TODO16c.md — SeNARS System One: Live Wiring, Real Weights & RL Applications

**Version:** 1.0 · continues TODO16b v3.2 (all Phases 0–5, R1–R9, N1–N6, H1–H5 shipped)
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
