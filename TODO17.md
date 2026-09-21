# TODO17.md — SeNARS Arcade: Multi-Game Substrate, Real-LM Decisions & Open SOTA Parity

**Version:** 1.1 · continues TODO16c v1.4 (all phases shipped: live wiring, trained/calibrated heads, RL-on-manifold, LM ladder, usability) · **v1.1:** implementation-growth items G1–G5 + traceability matrix (§10)
**Lineage:** TODO16c.md (System One end-to-end) · TODO16b.md (System One architecture)
**Philosophy:** *The Judgment Manifold already proved it can drive RL without NAL. Now it must play in public — many games at once, a real language model deciding in real time, and every claim scored against the open-source state of the art with controls the community itself publishes.*

**Core Principle:** *Close the spectator gap. Every demo arm runs on the same kernel-gated harness; every parity claim is a falsifiable benchmark; no proprietary API is required anywhere.*

---

## 0. Context — Verified Gaps for a Complete Multi-Game Demo (2026-09-20)

Deep review of the multi-game path after TODO16c. Every item cites a verified anchor; the observable failure is what a demo would expose.

### 0.1 Multi-game substrate gaps

| # | Gap | Verified anchor | Observable failure |
|---|-----|-----------------|--------------------|
| W1 | **No production FocusBag scheduler.** Nothing steps GameFocuses from the bag; tick bindings allocate budget for a *single* focus. Weight rebalancing exists (SchedulerAdapter) but the drive loop is caller-owned | `nar/src/focus/FocusBag.ts:15-77` (no step); `nar/src/tick/bindings.ts:168-169` | Multi-game NARs only exist inside scripts/tests; there is no runtime to point a demo at |
| W2 | **Reflex-vs-reflex arbitration is first-wins.** `GameFocus.step` loops reflexes and `break`s after the first reflex that proposes; the Negotiator arbitrates reflex-vs-NAL only | `nar/src/focus/GameFocus.ts:182-314` (break :312) | Binding two reflexes to one game silently ignores the second; no cross-reflex competition |
| W3 | **Global ActionGate contamination.** Every GameFocus constructor escalates the *global* autonomy mode to `sandbox-execute` and unions its game's legal actions into a shared allowlist | `nar/src/focus/GameFocus.ts:60-63` | Game A's actions authorize in game B; one game's construction changes kernel-wide autonomy |
| W4 | **No NAR-level game registration API.** `attachManifoldReflex` requires a pre-built GameFocus; nothing inserts a game's focus into a FocusBag | `nar/src/nar.ts:441-486` | Composing N games + M reflexes each is bespoke plumbing repeated per script |

### 0.2 Decision-layer gaps

| # | Gap | Verified anchor | Observable failure |
|---|-----|-----------------|--------------------|
| W5 | **No real-LM reflex.** Per-tick decisions are local manifold heads (measured: 0 LM calls/tick, F3); the LM only enters at Tier-2 synthesis | `nar/src/lm/system-one/manifold-reflex.ts` | The "a real language model decides in real time" demo does not exist |
| W6 | **Remote manifold speaks only the SeNARS-internal wire shape** (`{contextEmbedding, queries}`) — it cannot consume the open one-pass decision models of the community (kev, von, openjev-sglang, simple-jev), which speak the `{state, questions}` System One shape | `nar/src/lm/system-one/http-manifold.ts` | No interop with open SOTA; parity claims would be hand-run, not harness-run |
| W7 | **`judgeCascade` has zero live consumers** — two-stage judgment is exported but unused | `nar/src/lm/system-one/policy.ts` (E3 note) | Large action spaces (Tetris placement fan-out) have no staged-scoring path |
| W8 | **No confidence-band escalation consumer.** The review band of `ConfidenceRouter` dead-ends | `policy.ts` + `GameFocus.ts` | Low-confidence decisions either act anyway or fall back — never escalate to a stronger policy (the PlayJev handover pattern) |
| W9 | **No Brier-vs-outcome game harness.** Bake-off parity exists for heads only; no per-tick decision calibration against realized game outcomes | `scripts/rl-manifold.ts` | Demo claims are return-only; calibration is not measured where decisions happen |

### 0.3 Content gaps

| # | Gap | Verified anchor | Observable failure |
|---|-----|-----------------|--------------------|
| W10 | **Only two games exist** (BanditGame, GridWorldGame). No fan-out-enumerable game, no game-theoretic baseline, no tick-renderable classics | `nar/src/game/` | A "selection of games" demo has nothing to select |

### 0.4 Open-source state of the art (parity targets — all community code, no proprietary APIs)

From the September 2026 awesome-jev surveys (Anil-matcha/awesome-jev-by-typesafe · valentynkit/awesome-jev-typesafe · cobanov/awesome-jev). SeNARS adopts **patterns and open code only** — the hosted TypeSafe API is out of scope.

| Community project | What it proves | SeNARS parity target |
|---|---|---|
| **kev** (jaredpalmer/kev) | Qwen2.5-0.5B + LoRA readout head answers many typed questions in one prefill; trains <2 h on a laptop; **held-out ECE 0.065**; speaks the System One wire format | Calibration: trained game heads ≤ 0.07 held-out ECE; same one-batch-per-decision structure |
| **minojev** (zeredy879/minojev) | Frozen Qwen3-1.7B + ~0.8 M decision head: calibrated Choice/Boolean/Score in one forward pass, zero decoded tokens, ECE 0.024 | Stretch target: ECE ≤ 0.03 on game heads; zero-token decision path (heads are closed-form, already zero-token) |
| **von** (wfzyx/von) | Non-autoregressive decision model, **<15 ms local** | Latency: local manifold arm decision P50 ≤ 15 ms |
| **PlayJev** (OmniJev/PlayJev) | 0.8 B one-pass-per-move beats random across 10 games; **confidence gates handover to a search program** | Performance: every arm ≥ random on every game; handover consumer (E2) |
| **jev-tetris** (thelau/jev-tetris) | Deterministic code enumerates every placement; model scores all; ships a **shuffled-probability control and a regex baseline that outscored the model** | Tetris fan-out design; demo controls are mandatory (E5) |
| **jev-plays-pokemon-red** (valentynkit) | Every battle-turn prediction **Brier-scored against emulator RAM ground truth** | Brier-vs-outcome harness (E1) |
| **typesafe-snake** (sorrycc) | Code owns legal moves; model picks one per tick | Snake demo shape |
| **JevForge / NanoJev** | Auditable data construction → train → fixed eval → serve, with public artifacts | Distillation flywheel already matches; demo closes the loop |
| **jevcal** (abhixhek) | Fit confidence thresholds on labeled data → lock file | Already implemented (TODO16c D2) |

---

## 1. Architectural Additions (no invariants relaxed)

1. **`FocusScheduler`** (`nar/src/focus/focus-scheduler.ts`) — the production multi-focus drive loop: each tick, sample GameFocuses by weight (`FocusBag`), allocate per-focus budgets (`allocateBudget`), `await focus.step(budget)` under a wall-clock deadline (AIKR cooperative yield), feed step reports to the existing `SchedulerAdapter` so focus weights self-tune. Standalone module; scripts and the demo are its first consumers.
2. **Best-of-reflexes arbitration** (`GameFocus.step`) — collect proposals from *all* bound reflexes; merge per action as `max(value × confidence)` with per-reflex provenance; Negotiator arbitrates the merged set vs NAL; LearningEvents delivered to every reflex that proposed the winning action (and to vetoed proposers). Single-reflex behavior is byte-identical (merge over one set = the set).
3. **Scoped ActionGate authorization** — game actions authorize as `game:<focusId>:<action>` with a per-focus autonomy scope; the global autonomy mode and shared allowlist are untouched by game construction. Bare names remain valid for non-game callers (additive).
4. **`NAR.attachGame(game, {id?, reflexes?, weight?})` / `detachGame(id)`** — creates the GameFocus (scoped gates), binds reflexes, wires the prefetch context when System One is enabled, inserts the focus into the FocusBag, returns a handle. Multi-game composition becomes one call per game.
5. **`LMReflex implements Reflex`** (`nar/src/lm/system-one/lm-reflex.ts`) — real-LM per-tick decisions: prefetch-stage `proposeAndJudge` with a **generated GBNF action grammar** enumerating the legal-action set; manifold judges the LM's ranked candidates (`reflex_value`/`feasibility`/`risk`); sync `propose` reads the warm table; cold/failure ⇒ fallback reflex. Labels recorded via `recordReflexOutcome` (the LM arm feeds the distillation flywheel).
6. **Open one-pass bridge** (`nar/src/lm/system-one/open-systemone-manifold.ts` + `systemone-wire.ts`) — translation layer between SeNARS `JudgmentQuery`s and the community `{state, questions}` wire shape (Choice/Score/Boolean). Responses re-enter **untrusted** at the `LLM_PRIOR` ceiling (existing D4 semantics); digest/provenance stamped with the replica's model id.
7. **Brier-vs-outcome harness** (`nar/src/eval/brier-harness.ts`) — per-tick records (arm, game, stateId, chosen action, distribution, observed outcome) → per-arm Brier, isotonic ECE on realized outcomes, return curves → `.reports/arcade.{json,md}`.
8. **Search handover consumer** — `ConfidenceRouter` review band escalates to the game's heuristic baseline (minimax for TicTacToe) instead of acting; `systemone_handover_total` telemetry.

All additions sit *behind* the kernel gates: perception admission, action authorization, reward firewall, budget accounting unchanged.

---

## 2. Master Falsification Benchmarks (29–35)

Naming per repo convention (`tests/nar/todo17-*.test.ts`). No mocks for kernel objects; real `Truth`, `Bag`, gates, manifold, `EmbeddingCache` only. LM legs use the mock provider in CI and the cached real model (`LM_LLAMACPP_MODEL`) when present; live replica legs skip when their endpoint env is unset (Bench 16 skip pattern).

| # | Benchmark | Test file | Obligation |
|---|-----------|-----------|------------|
| 29 | **Scheduler Fairness** | `todo17-scheduler.test.ts` | Two focuses at weights w1:w2 receive cycle share within ±10% over 500 ticks (weighted sampling honored); a zero-weight focus receives 0 cycles; wall-clock deadline yields partial progress (AIKR) instead of starving; step reports reach `SchedulerAdapter` and rebalance weights (productive focus gains weight). |
| 30 | **Arbitration & Gate Isolation** | `todo17-arbitration.test.ts` | (a) Second reflex's strictly-better proposal wins; both the winner and the vetoed proposer receive LearningEvents; single-reflex suites unchanged (byte-identical). (b) Game A's namespaced actions are unauthorized in game B's scope; game construction leaves the global autonomy mode and allowlist untouched; kernel-wide sabotage-gate tests pass unmodified. |
| 31 | **Game Determinism & Baselines** | `todo17-games.test.ts` | For each of Snake/Tetris/2048/TicTacToe: same seed ⇒ identical trajectory; `legalActions` never contains an instantly-terminal move unless the state is terminal; heuristic baseline ≥ random over 200 seeded episodes per game; Tetris enumerates every reachable placement (tucks included) with a cap + documented truncation. |
| 32 | **Real-LM Reflex Realtime** | `todo17-lm-reflex.test.ts` | GBNF-constrained LM arm: 100% legal actions over 500 decisions (mock provider in CI; real `llamacpp-embedded` leg when `LM_LLAMACPP_MODEL` set); decision latency P50 ≤ 100 ms with ≤10 legal actions (embedded leg); LM failure/timeout ⇒ fallback reflex served, zero crash, breaker note; `lm_spend_*` and `systemone-judgment` counters advance per decision; dataset labels recorded with `vecRef`. |
| 33 | **Open One-Pass Wire Bridge** | `todo17-open-replica.test.ts` | Translation round-trip against a fixture server speaking the community `{state, questions}` shape: classify→Choice→top+distribution; evaluate→Score/Boolean→score; malformed response ⇒ fail-closed (breaker, Tier-3 degrade); re-entry ceiling 0.5 (`LLM_PRIOR`) asserted; `cortexModelId` carries the replica id; live leg smoke when `OPEN_REPLICA_ENDPOINT` set. |
| 34 | **Arcade Harness & Controls** | `todo17-arcade.test.ts` | Harness records per-tick predictions with observed outcomes; per-arm Brier/ECE computed; **controls fail loudly**: shuffled-probability arm degrades ECE vs honest arm, random arm's advantage signal ≈ 0 (harness measures real signal); handover path fires in the review band and is counted; cognitive mode (`E7`): belief seeding produces NAL derivations and at least one negotiated veto over 200 seeded ticks, veto carries a recorder-verified justification, panel data emitted per tick; report written to `.reports/arcade.{json,md}`. |
| 35 | **SOTA Parity Table** | `todo17-parity.test.ts` | The falsifiable parity claims of §0.4: (a) calibration — **the test trains the game heads itself in-suite** from the harness dataset (synthetic fixture in CI; real flywheel dataset on model-cached machines) via the TODO16c D1 pipeline, then asserts held-out ECE ≤ 0.07 (kev reference); stretch ≤ 0.03 (minojev); (b) latency — local manifold arm P50 ≤ 15 ms (von reference); (c) performance — every demo arm ≥ random on every game (100 seeded episodes); manifold arm within documented tolerance of the heuristic on ≥2 games; Tetris fan-out beats uniform-placement; (d) structure — exactly one batched judgment call per decision (call-count instrumentation) = one-prefill parity. Model-gated legs skip when the model is absent; the table is re-emitted into `.reports/`. |

---

## 3. Phased Rollout

Each phase gates on `pnpm typecheck`, `pnpm lint`, and the touched suites. `systemOne.enabled: false` behavior remains byte-identical throughout.

### Phase A — Multi-Game Substrate (P0) *“many games, one kernel”*

**Files:** `nar/src/focus/focus-scheduler.ts` (new), `nar/src/focus/{FocusBag,GameFocus}.ts`, `nar/src/kernel/KernelActionGate.ts`, `nar/src/nar.ts`, `tests/nar/todo17-{scheduler,arbitration}.test.ts`

- **A1 (W1).** `FocusScheduler({bag, hz, deadlineMs})`: per tick — weighted focus sample → `allocateBudget` → `await focus.step(budget)` with cooperative yield; step reports piped to `SchedulerAdapter` (existing domain learner) for weight tuning **and to `SelfMetaGame.recordFocusStepReport`** (meta-game observes the bag); per-tick budget charged through the BudgetGate (existing `nal-step` op, per-focus scopeId; `createScope` per step renews counters — scope map is keyed by focusId, bounded by bag capacity).
- **A2 (W2).** Best-of-reflexes merge in `GameFocus.step` (Architecture #2); provenance preserved on `ActionProposal.source`; LearningEvents fanned to every proposing reflex; `markEpisodeEnd`/veto tracking unchanged.
- **A3 (W3).** Scoped action authorization: GameFocus authorizes `game:<focusId>:<action>`; KernelActionGate gains an additive scoped-autonomy check (game scopes inherit `sandbox-execute` without mutating the global mode); allowlist per scope; global path untouched.
- **A4 (W4).** `NAR.attachGame`/`detachGame` (Architecture #4); prefetch context wired automatically when System One enabled; handles exposed for the demo. **Lifecycle hygiene:** `attachGame` registers the GameFocus into `SelfMetaGame.gameFocuses` when a meta-game is present; `detachGame` removes the focus from the FocusBag, deletes its BudgetGate scope (`deleteScope`), and drops its scoped allowlist entries (no per-game residue).

**Acceptance**
- [x] Bench 29 + 30 pass
- [x] Existing focus-game-reflex suites (kernel-slice1, m35-gridworld-validation, meta-game-sandbox) pass unmodified
- [x] `systemOne.enabled: false` game loops byte-identical (global autonomy mode/allowlist untouched by scoped gates)

### Phase B — Games & Baselines (P0) *“the selection”*

**Files:** `nar/src/game/{SnakeGame,TetrisGame,Game2048,TicTacToe}.ts` (new), `tests/nar/rl/baselines/{snake,tetris,2048,tictactoe}.ts` (fixtures consuming `Game`), `tests/nar/todo17-games.test.ts`, `nar/src/game/index.ts`

- **B1.** `SnakeGame`: seeded apple spawn (Bag-7-style bag of spawn cells), legal = 4 moves minus instant self-collision, terminal on wall/self; fixed board size.
- **B2 (W7).** `TetrisGame`: deterministic placement enumeration (`legalPlacements(state)` incl. tucks/spins, cap N with documented truncation); bag-7 shapes; seeded. **The first live `judgeCascade` consumer**: when placements exceed the cap, stage-1 coarse-ranks all placements in one batch, stage-2 fine-scores (`reflex_value`) only the top-K (decision DQ2).
- **B3.** `Game2048`: 4 moves, seeded spawn (2/4 weighted), terminal when no legal move.
- **B4.** `TicTacToe`: legal = empty cells; deterministic board hash; **minimax baseline ships with the game** (perfect play; the game-theoretic parity anchor).
- **B5.** Heuristic baselines per game (snake: flood-fill survival; 2048: corner/monotonicity greedy; tetris: lines-cleared + holes weight; ttt: minimax) — test fixtures, not library code, per the DQ2 precedent (baselines stay fixtures).
- **B6.** All games are `EpisodeGame`-compatible, no LM deps, ASCII-renderable (render helper shared with the demo).

**Acceptance**
- [x] Bench 31 passes
- [x] Each game's heuristic ≥ random over 200 seeded episodes
- [x] Zero new dependencies

### Phase C — Real-LM Reflex (P0) *“the language model decides, live”*

**Files:** `nar/src/lm/system-one/{lm-reflex,action-grammar}.ts` (new), `nar/src/nar.ts` (wiring via `attachGame` options), `tests/nar/todo17-lm-reflex.test.ts`

- **C1 (W5).** `LMReflex` (Architecture #5): prefetch builds a `CognitiveContext` (serialized perception features + top beliefs via the `lm/context.ts` helper) and calls `dispatcher.proposeAndJudge(context, synthesisQuery, [reflex_value, feasibility, risk], budget)`; the synthesis query carries a **generated GBNF grammar** enumerating the legal actions (`"up"|"down"|"left"|"right"` / `"place:r2:c3:rot1"` …) — the LM can only answer with a legal action. **Hot-path note:** generated grammar text is cached per legal-action-set signature (deterministic games repeat action sets heavily); `runInGrammarScope` passes generated text through untransformed, so the cache is a plain `Map` keyed by the action-set signature.
- **C2.** Failure semantics: LM error/timeout/breaker-open ⇒ fallback reflex's proposals served; propose stays synchronous (table read); the only `await` is at prefetch.
- **C3.** Labels: `recordReflexOutcome(dataset, {stateDigest, action, reward, source: 'lm-reflex', embedding})` — the LM arm is a first-class distillation source.
- **C4.** Accounting: per-decision `systemone-judgment` charge (B7 path) + H3 spend counters; per-call model override honored (`systemOne.cortex.model`).
- **C5.** Model default: `LM_PROVIDER=llamacpp-embedded` with the cached GGUF (`Qwen3.5-0.8B-Q4_0.gguf`); `LM_DTYPE` for speed; mock provider for CI.

**Acceptance**
- [x] Bench 32 passes (CI leg with mock; embedded leg model-gated, `LM_LLAMACPP_MODEL`)
- [x] `systemOne.enabled: false` ⇒ LMReflex never constructed (`attachLMReflex`/`attachGame({lmReflex})` bail when System One is off)
- [ ] Decision P50 documented in `.reports/` on model-cached machines (P50 asserted in the embedded leg; arcade report emission pending the lm-arm run)

### Phase D — Open One-Pass Replica Bridge (P1) *“interop with the community's decision models”*

**Files:** `nar/src/lm/system-one/{systemone-wire,open-systemone-manifold}.ts` (new), `scripts/open-replica-fixture-server.ts` (CI fixture), `tests/nar/todo17-open-replica.test.ts`, `src/config/schema.ts`

- **D1 (W6).** Translation (Architecture #6): classify(space) → `Choice{criteria: space}`; evaluate(levels) → `Score{legend: levels}`; binary anchors → `Boolean`/Noul; state = perception JSON text; response → propositions at `LLM_PRIOR` ceiling, `cortexModelId: '<replica>:<version>'`.
- **D2.** `createOpenSystemOneManifold({endpoint, embeddingCache, timeoutMs?})` — reuses the D4 transport discipline (zod both sides, fail-closed, breaker, health reducer); config `systemOne.manifold.provider: 'open-systemone'`.
- **D3.** Reference replicas (all open-source, self-hosted by the demo runner): **kev** (default — released weights + training code + published ECE 0.065 = the auditable parity target), **von** (latency reference), `openjev-sglang`/`simple-jev` (alternates). No hosted proprietary API in any plan item.
- **D4.** Fixture server replicating the wire contract for CI (offline-deterministic); live legs behind `OPEN_REPLICA_ENDPOINT` (skipped when unset).

**Acceptance**
- [x] Bench 33 passes
- [x] Zero proprietary endpoints in code/tests; live legs env-gated only (`OPEN_REPLICA_ENDPOINT`)
- [x] Untrusted ceiling (`seedTruth(LLM_PRIOR)` ≤ 0.5) + provenance (`open:<model>`) asserted in the round-trip

### Phase E — Arcade Demo & Parity Harness (P0 demo, P1 parity) *“the awesome demo”*

**Files:** `scripts/arcade.ts` (new), `nar/src/eval/brier-harness.ts` (new), `.reports/`, `tests/nar/todo17-{arcade,parity}.test.ts`, `docs/arcade.md`, `package.json` (`pnpm arcade`)

- **E1 (W9).** Brier harness (Architecture #7): per-tick (arm, game, stateId, action, distribution/score, observed outcome); per-arm Brier + isotonic ECE + return curves; `.reports/arcade.{json,md}`. **DRY obligation:** reuse the calibration metrics — `identityECE`/`brierWithAbstain` (`calibration-fit.ts:90-96`) and the isotonic calibrator — via a shared export (or extraction into `calibration-fit.ts`); the harness must not add a third Brier implementation alongside `train.ts` and `calibration-fit.ts`.
- **E2 (W8).** Search handover: review-band decision (router: p < τ_act, ≥ τ_review) escalates to the game's heuristic baseline (minimax for ttt) for that tick; `systemone_handover_total{game}`; counts surfaced in the report. Block band ⇒ skip tick (AIKR yield), never a forced bad move.
- **E3.** `scripts/arcade.ts` — the demo: N games in one FocusBag (A1 scheduler), one arm per game (or per run), arms = `manifold | lm | replica | heuristic | random`; per tick renders the ASCII board plus a one-line decision record (model, latency, confidence, handover?); `--games snake,tetris,2048,tictactoe,gridworld,bandit --arms lm,manifold --episodes N --seed S`; Tetris uses the placement fan-out (B2 cascade consumer: stage-1 coarse rank over all placements, stage-2 fine `reflex_value` on top-K when placements > cap). **Arm availability is fail-closed per arm:** an arm whose subsystem is missing (no LM model, no replica endpoint, System One disabled ⇒ no manifold arm) is skipped with an explicit report note — never silently substituted by another arm.
- **E4.** Parity table (Bench 35) — §0.4 targets emitted into the report; call-count instrumentation proves one batched judgment per decision (one-prefill parity).
- **E5.** Controls (tetris lesson): random + heuristic arms always rendered; shuffled-probability control asserted in the harness (Bench 34).
- **E6.** `docs/arcade.md` + README pointer (System One section).
- **E7 (optional mode).** `--mode cognitive` — SeNARS reasoning visible in gameplay: (a) belief seeding — inject the game's rules/state-transitions as Narsese beliefs into the focus (Self-Concept-Vocabulary pattern) so the Negotiator's NAL veto has domain content; (b) thought-stream panel — per tick, render derivation chains (`getNALDerivations` / recorder records: premises → rule → conclusion → truth), the negotiation verdict (reflex value vs NAL truth, winner + `vetoedBy`), veto flashes, judgment distribution bars, focus-weight drift, and handover markers — all from existing streams (`logGameTrace` data + `nar.explain`/recorder), no new cognitive machinery; (c) derivation recorder enabled in this mode so every veto is a verifiable record. Default arms remain pure (mode is opt-in).

**Acceptance**
- [x] Benches 34 + 35 pass
- [x] `pnpm arcade` runs six games with offline arms; offline legs (heuristic, random) run in CI (`arcade-benches` job); manifold arm runs offline; lm/replica arms fail-closed-skip with notes
- [x] `.reports/arcade.{json,md}` written with per-arm Brier/ECE/return + handover counts (parity table numbers asserted by Bench 35; full table emission inside arcade.md pending E4 follow-up)

### Phase F — Hardening & Docs (P2)

- **F1.** CI: `arcade-benches` job — todo17 suites (offline legs) + the offline `pnpm arcade` smoke (heuristic/random arms).
- **F2.** Determinism/flake policy: seeded arms everywhere; load-sensitive timing legs in dedicated jobs (TODO16c §11 precedent).
- **F3.** Docs reconciliation: `docs/system-one-guide.md` cross-link, README export-index rows (`FocusScheduler`, `LMReflex`, `open-systemone` manifold, games).
- **F4 (optional, DQ4).** Promote `FocusScheduler` into `NARExecution.run` as the default game-drive loop if the standalone module proves insufficient.

---

## 4. Decision Points (need your call)

| # | Question | Default proposal |
|---|----------|------------------|
| DQ1 | Reference replica to pin for parity claims: **kev** (ECE 0.065, released weights+training code) vs **von** (<15 ms) vs `openjev-sglang`? | kev — the strongest *auditable* calibration target; von cited for latency |
| DQ2 | Tetris scoring shape: one `evaluate` per placement in a single judgeBatch (existing head semantics) vs the community's multi-`Choice` + weighted aggregation? | Evaluate-per-placement, one batch; cascade stage-2 only when placements exceed the cap (consumes W7) |
| DQ3 | Review-band handover target: heuristic baseline (per game) vs abstain/skip-tick? | Heuristic escalation (PlayJev pattern); abstain for games without a heuristic |
| DQ4 | Scheduler placement: standalone `FocusScheduler` (scripts/demo first) vs integrated into `NARExecution.run` now? | Standalone first; F4 revisits after the demo |
| DQ5 | Should `LMReflex` and the manifold arm compete on the same game (best-of-reflexes merge) or run as separate arms only? | Separate arms for clean attribution; competition is a Bench 30 concern, not a demo default |

---

## 5. Configuration Additions

```jsonc
// NARConfig additions (zod-validated, additive)
{
  "gameScheduler": { "enabled": false, "hz": 10, "deadlineMs": 50 },   // A1 (off by default — scripts opt in)
  "systemOne": {
    // existing sections unchanged...
    "handover": { "reviewAction": "escalate-baseline" | "abstain" | "act", "minBaselineConfidence": 0.5 },  // E2
    "lmReflex": { "grammarActions": true, "maxCandidates": 3 },                                           // C1
    "manifold": { "provider": "local" | "http" | "open-systemone" }                                       // D2 (adds enum value)
  }
}
```

New Prometheus counters: `systemone_arcade_decisions_total{arm,game}`, `systemone_handover_total{game}`, `systemone_lm_decision_latency_ms{game}`, `arcade_brier{arm,game}`.

---

## 6. Risk Register

| Risk | Mitigation | Anchor |
|------|------------|--------|
| Best-of-reflexes merge changes existing single-reflex semantics | Merge over one proposal set = the set (identity); kernel-slice1/m35 suites pinned unchanged in Bench 30 | `GameFocus.ts:182-314` |
| Scoped ActionGate weakens kernel guarantees | Namespacing is *additive restriction* (game scope ⊂ global); sabotage-gate and autonomy tests unmodified; global mode untouched | A3 |
| LM per-tick latency spikes break realtime feel | Local embedded model by default; prefetch absorbs the async gap; breaker + Tier-3/fallback degrade; `LM_DTYPE` q4 | C2, F3 bench |
| Replica wire shape drifts across versions | Pin the replica version in config; fixture server pins the contract in CI; live legs env-gated | D4 |
| Tetris placement enumeration explodes | Deterministic cap + documented truncation; cascade stage-2 confines fine scoring to top-K | B2, DQ2 |
| Parity claims vs published numbers are apples-to-oranges | Parity is asserted on *our* harness over *our* seeds with published numbers as thresholds only; report states this caveat | E4 |
| Handover masks manifold errors (always escalating) | Handover counted + rate-capped; report surfaces handover ratio per game; `escalate` requires the baseline's own confidence floor | E2, DQ3 |
| Scope creep into Appendix-B frontier items | Sensory manifold, SSM cortex, vision-based games (PlayJev-style frames) remain **out of scope** — text/state observations only |

---

## 7. Rollback Procedure (per phase)

| Phase | Trigger | Action |
|-------|---------|--------|
| A | Bench 29/30 fail or existing reflex suites regress | Scheduler is a standalone module (delete + scripts revert to manual loops); merge reverts to first-wins; scoped gates revert to legacy authorize (namespace becomes alias) |
| B | Bench 31 fail | Games are additive files; delete |
| C | Bench 32 fail | `lmReflex` config off ⇒ LMReflex never constructed; fallback reflex is the incumbent behavior |
| D | Bench 33 fail | `'open-systemone'` provider removed from the enum; D4 `'http'` path unaffected |
| E | Bench 34/35 fail or demo regression | Harness + handover are additive; `handover.reviewAction: 'act'` restores pre-E2 behavior |
| F | CI flake regression | Drop the arcade job; suites remain locally runnable |

---

## 8. Master Checklist

### Phase A: Multi-Game Substrate
- [x] A1 `FocusScheduler` (weighted sampling, budgets, deadline, SchedulerAdapter feed)
- [x] A2 best-of-reflexes arbitration + LearningEvent fan-out (all proposers learn)
- [x] A3 scoped ActionGate (`game:<focusId>:<action>`, per-scope autonomy/allowlist; `KernelActionGate.parseScopedOperation`)
- [x] A4 `NAR.attachGame`/`detachGame` (+ `attachLMReflex`, `getFocusBag`)
- [x] Bench 29 + 30

### Phase B: Games & Baselines
- [x] B1 SnakeGame  B2 TetrisGame (hard-drop placement fan-out, cap 64, documented truncation)  B3 Game2048  B4 TicTacToe (+exported memoizable `minimax`)
- [x] B5 heuristic baselines (fixtures: flood-fill snake, lines+holes tetris, corner-greedy 2048, minimax ttt)  B6 determinism + `clone()` lookahead + `renderGame` helper
- [x] Bench 31

### Phase C: Real-LM Reflex
- [x] C1 `LMReflex` + generated GBNF action grammar (per-action-set cache) + `proposeAndJudge` path
- [x] C2 fail-degrade semantics  C3 label recording (vecRef sidecar)  C4 budget plumbed (per-call charge via dispatcher)  C5 model defaults (embedded leg env-gated)
- [x] Bench 32

### Phase D: Open One-Pass Bridge
- [x] D1 wire translation (classify→choice, evaluate→score, boolean→0/1)  D2 `createOpenSystemOneManifold` (fail-closed, breaker, zod both sides)  D3 replica provenance pin (`open:<model>`, fixture model `kev:1.0`)  D4 fixture server (`scripts/open-replica-fixture-server.ts`) + env-gated live leg
- [x] Bench 33

### Phase E: Arcade & Parity
- [x] E1 Brier harness (reuses `identityECE`/isotonic from calibration-fit — no third Brier impl)  E2 search handover (GameFocus option, act/review/block bands)  E3 `scripts/arcade.ts` + `pnpm arcade`  E4 parity claims asserted in Bench 35  E5 controls (shuffled/random in Bench 34; random+heuristic always rendered by arcade)  E6 docs (`docs/arcade.md` + README rows)  E7 cognitive mode (`--mode cognitive`: belief seeding, thought-stream panel, recorder-verified veto justifications — see §11.4)
- [x] Bench 34 + 35

### Phase F: Hardening
- [x] F1 CI job (`arcade-benches`: todo17 suites + offline arcade smoke)
- [x] F2 determinism (seeded arms everywhere; timing legs env-gated in dedicated skips)
- [x] F3 docs reconciliation (README export-index rows for games/arcade, `docs/arcade.md`)
- [ ] F4 (optional) scheduler promotion — deferred per DQ4 (standalone first)

---

## 9. Definition of Done

```text
FocusBag (N GameFocuses, self-tuning weights via SchedulerAdapter)
   └─▶ FocusScheduler (weighted sample → allocateBudget → step under deadline)
         └─▶ GameFocus (scoped ActionGate)
               ├─ PERCEPTION  game.observe() → gate → tasks
               ├─ ATTEND      prefetch: LMReflex (GBNF action grammar → LM proposes →
               │              manifold judges) · ManifoldReflex (local heads) · open-replica arm
               ├─ PROPOSE     best-of-reflexes merge → Negotiator (NAL veto)
               ├─ ACT         authorized 'game:<focusId>:<action>' → game.step
               ├─ REWARD      RewardGate firewall → labels (vector sidecar)
               └─ HANDOVER    review band → heuristic/minimax escalation (counted)
                     │
        scripts/arcade.ts: six games · arms manifold|lm|replica|heuristic|random
                     │
        brier-harness.ts → per-arm Brier/ECE + return curves → .reports/arcade.md
                     │
        Bench 35 parity table: ECE ≤ 0.07 (kev ref) · P50 ≤ 15 ms (von ref)
                            · all arms ≥ random · one batched judgment per decision
```

> TODO16c gave System One a body, nerves, and trained tissue. TODO17 puts it in the arcade: many games on one attention economy, a real open language model choosing moves in real time, the community's best open decision models running on the same harness, and every claim Brier-scored against what actually happened — with the controls the open-source community taught us to never demo without.

**Suggested build order** (focused-day estimates; A → B → C → E-parity-of-D interleaved):

| Order | Phase | Effort | Gate |
|-------|-------|--------|------|
| 1 | A (A1–A4) | 2.5d | Bench 29 + 30 + existing reflex suites green |
| 2 | B (B1–B6) | 2d | Bench 31 |
| 3 | C (C1–C5) | 2d | Bench 32 (CI leg) |
| 4 | D (D1–D4) | 1.5d | Bench 33 |
| 5 | E (E1–E7) | 2.5d | Benches 34 + 35; `pnpm arcade` |
| 6 | F (F1–F4) | 1d spread | CI green; `.reports/` emitted |

**Parallelizable:** B independent of A (games are pure); D independent of C (bridge vs reflex); E1 harness can start once B lands.

---

## 10. Addendum (v1.1) — Implementation Growth & Traceability

Second-pass audit findings: the demo phases leave the supporting implementation measurably stronger in five places (G-items, wired into phases), plus the audit matrix every TODO16-era plan carries.

### 10.1 Growth items (wire into phases)

| # | Growth | Anchor | Phase |
|---|--------|--------|-------|
| G1 | **GameFocus stage refactor** — extract the ~160-line `step` into named stages aligned with the kernel's 11-stage micro-tick (`perceive/attend/propose/negotiate/authorize/act/validate/learn`), each stage returning its report slice; the cognitive-mode panel and OTel spans then consume stage boundaries instead of inline locals | `nar/src/focus/GameFocus.ts:158-317` | A2 |
| G2 | **Episode-level schema induction** — after each episode, `SchemaInductor` runs over the game's derivation chains + rewards; promoted schemas ("corner-keeping → survival") become focus beliefs the Negotiator weighs next episode — the cognitive mode grows knowledge while playing, closing the arcade into the learning loop | `nar/src/learning` (`SchemaInductor`), TODO17 E7 | E7 |
| G3 | **Multi-game session resume** — `FocusBag.serialize`/`deserialize` + game seeds recorded per episode; `arcade.ts --resume` restores weights/episodes mid-tournament (the state-persistence precedent, applied to the bag) | `nar/src/focus/FocusBag.ts:55-76` | E3 |
| G4 | **Shared-embedding discipline across arms** — manifold, LM, and replica arms share ONE `EmbeddingCache` (G4/TODO16c invariant); perception digests are canonicalized (stable JSON key ordering) so identical states across arms hit the same cache entry instead of triple-writing | `nar/src/lm/system-one/embedding-cache.ts` | E3 |
| G5 | **Arcade OTel spans** — each game tick emits a span per stage (G1 boundaries) with arm/game attributes; the demo becomes a distributed trace of cognition, watchable in any OTel UI | `nar/src/tick` (`initOtel`, span attributes), TODO17 E7 | F3 |

Growth rollback: all five are additive (G1 is behavior-preserving — Bench 29/30/31 re-run as the gate; G2 output is advisory beliefs only, never enforced).

### 10.2 Traceability matrix (audit: no gap without a home, no item without a bench)

| Gap | Phase items | Benchmark | Test artifact |
|-----|-------------|-----------|---------------|
| W1 no scheduler | A1 | 29 | `todo17-scheduler.test.ts` |
| W2 first-wins reflexes | A2 | 30 | `todo17-arbitration.test.ts` |
| W3 ActionGate contamination | A3 | 30 | `todo17-arbitration.test.ts` |
| W4 no attach API | A4 | 29, 30 | both Phase-A suites |
| W5 no real-LM reflex | C1–C5 | 32 | `todo17-lm-reflex.test.ts` |
| W6 wire-shape interop | D1–D4 | 33 | `todo17-open-replica.test.ts` |
| W7 cascade unused | B2, **v1.4 `PlacementCascadeReflex`** | 31, 35(d) | `todo17-games.test.ts`, `todo17-parity.test.ts` |
| W8 dead review band | E2 | 34 | `todo17-arcade.test.ts` |
| W9 no outcome calibration | E1 | 34, 35(a) | `todo17-arcade.test.ts`, `todo17-parity.test.ts` |
| W10 two games only | B1–B6 | 31 | `todo17-games.test.ts` |
| E7 cognitive mode | E7 | 34 (veto clause) | `todo17-arcade.test.ts` |
| Growth G1–G5 | A2, E3, E7, F3 | 29–31 re-run (G1), 34 (G4 shared-cache assert) | respective suites |

**Completeness rule (inherited):** no plan item without a gap ID or explicit rationale; no gap ID without a phase item; no phase item without an acceptance checkbox and benchmark. This matrix is the audit — any future discovery appends a row here first.

---

## 11. Progress Addendum (v1.2 — 2026-09-20, implementation session)

Phases A–F implemented and committed (Benches 29–35 green; `pnpm typecheck`/`pnpm lint` clean; focus-game-reflex + kernel-gates suites unmodified).

### 11.1 What landed

| Phase | Commits | Notes |
|---|---|---|
| A | `FocusScheduler` (weighted SeededRNG sampling, `allocateBudget`, wall-clock deadline via `Promise.race` → `yielded`, SchedulerAdapter + meta-game report feed); best-of-reflexes merge in `GameFocus.step` (**all** proposers learn — covers winner + arbitration-vetoed proposers); scoped ActionGate (`KernelActionGate.setScopeAutonomy/addScopedOperation/removeScope`, ops `game:<focusId>:<action>`, scope refresh per step from current legalActions); `NAR.attachGame/detachGame` + `getFocusBag` + lifecycle hygiene (`releaseScope`) | DQ4 honored (standalone scheduler); single-reflex behavior identity-proven in Bench 30 |
| B | `SnakeGame` (bag-7 apple spawn), `TetrisGame` (rot×column hard-drop fan-out, cap 64, per-game `legalPlacements`), `Game2048`, `TicTacToe` (+ exported memoizable `minimax`), `clone()` on all four for baseline lookahead, `renderGame` helper, baselines as fixtures (`tests/nar/rl/baselines/{snake,tetris,2048,tictactoe}.ts`) | Tetris tuck enumeration intentionally limited to slide-then-drop; documented in code + Bench 31 |
| C | `LMReflex` + `actionGrammar` (per-action-set GBNF cache), `NAR.attachLMReflex`, `attachGame({lmReflex})`, config `systemOne.lmReflex`, Bench 32 (+ env-gated embedded leg) | C4 spend counters: per-call charge flows through the dispatcher's existing `systemone-judgment` path; dedicated `lm_spend_*` arcade counters **not** added (see below) |
| D | `systemone-wire.ts` (zod `{state, questions}` contract), `createOpenSystemOneManifold` (canonical embedding state text, LLM_PRIOR ceiling asserted via `seedTruth` at consumers — D4 passthrough semantics), fixture server, Bench 33 (+ live leg) | `manifold.provider` enum gained `'open-systemone'` |
| E | `BrierHarness` (`identityECE` now exported from calibration-fit — DRY honored; isotonic ECE via `createIsotonicCalibrator`), review-band handover in GameFocus (`handover` option: act/review/block), `scripts/arcade.ts` + `pnpm arcade`, `docs/arcade.md`, Benches 34+35 | Arcade cognitive arms drive a real `GameFocus` (kernel-gated) with `RecordingReflex` confidence capture |

### 11.2 Deviations from plan (documented, falsifiable)

1. **Bench 30 LearningEvent fan-out**: implemented as *all proposers learn* (superset of the plan's winner+vetoed-proposers clause). Arbitration "vetoed" proposers receive the same outcome event; Bench 30 asserts both receive events.
2. **Bench 31 instant-terminal invariant**: Tetris top-out and TicTacToe opponent replies make legal moves legitimately terminal, so the test asserts the game-honest invariant — a legal action never trips the *illegal-move* guard (`info.reason !== 'illegal'`). Snake/2048 additionally exclude self-collision/no-op moves from `legalActions`.
3. **Bench 35(a)** trains on a synthetic in-suite fixture (per plan for CI); the real flywheel dataset leg is the same code path on model-cached machines. Stretch ECE ≤ 0.03 recorded but not enforced.
4. **§5 Prometheus counters** (`systemone_arcade_decisions_total`, `systemone_handover_total{game}`, `systemone_lm_decision_latency_ms`, `arcade_brier`) not added — handover/latency/Brier are surfaced via the BrierHarness report instead. Adding real counters is cheap follow-up work once the demo's metric names stabilize.
5. **E7 cognitive mode** (belief seeding, thought-stream panel, derivation recorder) **not implemented** — the only remaining P1 demo item. Hooks are in place (`GameFocus` veto tracking + `logGameTrace` already emit the raw streams the panel would render).

### 11.3 Remaining work (facilitation notes)

- **G1 GameFocus stage refactor**: `GameFocus.step` was restructured (proposal collection merged, early returns) but not yet split into named 11-stage methods; Bench 29/30/31 remain the re-run gate.
- **G2 schema induction / G3 session resume / G5 OTel spans**: unstarted. G3 hooks exist (`FocusBag.serialize/deserialize` + per-episode seeds already recorded by the arcade loop).
- **G4 shared-embedding discipline**: enforced inside the arcade's cognitive arms (one `EmbeddingCache` per arm construction, shared across manifold/LM/replica within an arm); a cross-arm canonical-digest assertion could be added to Bench 34 if arms are ever run concurrently.
- **F4 scheduler promotion**: revisit only if a second consumer needs the drive loop inside `NARExecution.run`.

### 11.5 Progress Addendum (v1.4 — 2026-09-21, W7 cascade consumer + prefetch bug fix)

- **W7 closed — `PlacementCascadeReflex`** (`nar/src/lm/system-one/cascade-reflex.ts`, the live `judgeCascade` consumer): stage-1 coarse-ranks the whole legal-action set in ONE batch (`feasibility`, one-prefill parity preserved — Bench 35d unaffected); stage-2 fine-scores only the top-K (`reflex_value`) when the set exceeds K (DQ2 cap-gate). Synchronous `propose` reads the consume-once prefetch table with incumbent fallback for uncovered actions (ManifoldReflex semantics). The arcade's tetris manifold arm uses it; other arms keep plain `ManifoldReflex`. Bench 31 gained the W7 clause: ≤K ⇒ one batch; >K ⇒ batches `[N, K]` with stage-2 confined to top-K; tetris + cascade inside a kernel-gated GameFocus actually places pieces.
- **Latent prefetch bug fixed** (`GameFocus.prefetchForReflexes`): the embedding pointer passed to reflex prefetch was an un-awaited `Promise` (`embeddingCache.write(...)` is async), so every manifold/LM prefetch silently failed ("Embedding not found" swallowed by the cold-table catch) and cognitive arms were always running on their fallback reflex. Now awaited. Falsified in-situ: the arcade manifold arm now produces real manifold-driven ticks (previously 0 recorded ticks on veto-heavy runs were fallback-driven). Benches 29–35 re-run green after the fix.

**Remaining after v1.4:** G1 (stage refactor), G2/G3/G5, F4 — all optional growth items; no W-gaps or P0/P1 demo items outstanding.

### 11.6 Progress Addendum (v1.5 — 2026-09-21, G3 session resume)

G3 closed. **`nar/src/eval/session-state.ts`** (new): `ArcadeSession` (version, seed, games, arms, targetEpisodes, per-`arm/game` completed counts, optional `bagWeights` for scheduler-driven runs), `loadSession` (fail-open on missing/corrupt → caller starts fresh with a note), `saveSession`, `isResumable` (strict config match — a mismatched seed/games/arms/episode-target is never merged). **Arcade `--resume`** (`--session PATH`, default `.reports/arcade-session.json`): skips completed episodes per arm/game, persists progress after every episode, and notes resume state. Episode seeds are derived as `seed + episodeIndex`, so skipping completed episodes leaves remaining trajectories byte-identical (verified: partial resume replays only the missing episode). Bench 34 gained the session-state clause (roundtrip, corruption fail-open, config-mismatch rejection). `bagWeights` is populated by scheduler-driven consumers via `FocusBag.serialize()` — the arcade (no bag) leaves it unset.

**Remaining after v1.5:** G1 (stage refactor), G2 (schema induction), G5 (OTel spans), F4 — optional growth items.

### 11.4 Progress Addendum (v1.3 — 2026-09-21, E7 cognitive mode)

E7 implemented (the last P1 demo item). Bench 34 gained the cognitive-mode clause (all six clause groups green).

- **NAL veto path repaired**: `Focus.buildDerivationIndex` previously could never match (the operation branch required `getPredicate` on an operation term — always `undefined` — and demanded a term be both operation- and implication-kind, which is impossible). It now indexes (a) operation terms by their `^action` operator atom and (b) implication/inheritance terms by their antecedent/subject atom. Derivation truth comes from the concept's stored belief truth (`FocusConcept.truth`, newly persisted in `addConcept`) instead of activation — this is what makes seeded "bad action" beliefs veto-eligible (`f<0.3, c≥0.8`). Old callers see no change (derivation shape is additive: optional `premise` field).
- **`nar/src/focus/belief-seeding.ts`** (new): `seedBelief(focus, {narsese, truth, priority})` parses Narsese into a `FocusTask` belief; `actionRuleBelief(action, consequence, truth)` builds `(<action> ==> <consequence>)` rules. `GameFocus.seedRule`/`seedBelief` delegate (E7 Self-Concept-Vocabulary pattern).
- **`GameFocus` cognitive option**: `cognitive: true` enables (a) per-tick `TickPanelEntry` panel log (`getPanelLog()`: proposals, NAL derivations, negotiation decision, handover flag, reward, focus weight — covering executed, vetoed, handover, block, and abstain ticks) and (b) veto justification records (`getVetoJustifications()`): one-step `DerivationRecord` per veto (premises = the seeded rule term, ruleId `deduction`, conclusion truth = f²/c² of the premise) that passes the standalone verifier (`verifyRecord(record, {strict: true})`) — Bench 34 asserts every justification verifies.
- **Arcade `--mode cognitive`**: seeds honest per-game domain rules (gridworld: `(0 ==> wall_bump)` f0.1 c0.95 — the start cell's top row), prints the `[panel]` thought-stream line per tick and veto/justification stats per episode; non-cognitive runs unchanged.
- **Facilitation notes for follow-ups**: the veto path is generic — G2 schema induction can promote repeated veto patterns into beliefs via the same seeding API; `getVetoStats().vetoRate` is actually vetos-per-episode (value >1 possible) — rename or divide by episode length if it is ever surfaced in a report.
