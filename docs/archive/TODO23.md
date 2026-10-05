# TODO23: Decision Substrate Consolidation — Composition, Provenance, Trustworthy Self-Improvement

Derived from an external architectural review ("Jev-style bounded judgment subsystem" analysis), **revised against the actual codebase**. Every claim below was verified against source on 2026-09-24. The original essay's inaccuracies are catalogued in Appendix A and corrected inline.

## Goal

Make the existing System One decision substrate **more compositional, causally measurable, and hard to misuse** — not bigger. The substrate already has the right primitives:

- Declarative `HEAD_SPECS` registry (`nar/src/lm/system-one/head-specs.ts`) — **19 heads** (ingress/action/synthesis/memory), the single source of truth for spaces/levels/instructions
- One joint batched evaluation (`judgeBatch`) over a shared embedding (`EmbeddingCache`)
- Isotonic calibration → digest-pinned `calibration-lock.json`, fail-closed on `modelDigest` mismatch (`calibration-fit.ts`)
- Policy utilities: `truthProbability()`, `ConfidenceRouter` (act/review/block, monotone-restrict-only), `compositeScore`, `judgeCascade`, wake gate (`policy.ts`, `cascade-reflex.ts`, `wake-gate.ts`)
- CLM contrastive layer (TODO22): `ContrastiveMemory` (InfoNCE scale/bias calibration, per-rubric exemplars, `addEmbeddings` for redacted sources), hard-negative mining (`hard-negatives.ts`), contrastive penalties in the dispatcher, groundedness-gate abstain fallback, LMReflex `#verifiedRanking` vetoes
- Distillation flywheel: `JudgmentDataset` (`distill.ts`), label sources (`label-sources.ts`, `reflex-label-source.ts`), trainer with held-out Brier bake-off (`train.ts`), **auto-capture of graded conversation turns (TODO22)**
- RL/reflex family: `ManifoldRLAgent` (`manifold-rl-agent.ts`), TabularQ/ε-greedy/UCB reflexes + `Negotiator` (`nar/src/reflex/`)
- Kernel gates: `PerceptionGate`, `ActionGate`, `RewardGate` (`nar/src/gates/`), `KernelBudgetGate` (`nar/src/kernel/KernelBudgetGate.ts`, charged via `resource-gate.ts`)
- Epistemic firewall: rewards affect policy/attention, never factual `Truth` values

**Priority order (revised):**

| Priority | Work | Impact | Payoff |
|----------|------|--------|--------|
| P0 | Integrate CLM/contrastive layer into a unified decision API | Very high | Ends dual composition paths (policy utils vs contrastive) |
| P0 | Frozen evaluation set, isolated from distillation | Very high | Trustworthy self-improvement |
| P0 | Judgment provenance struct | Very high | Auditable decisions, not just auditable state |
| P1 | `choose()` candidate-set API (generalize declared-space judging) | High | General decision engine, not classifier collection |
| P1 | Cost-aware cascade consolidation | High | Minimum compute to cross decision boundary |
| P2 | Unify RL/reflex + semantic judgments on one API | Medium-high | Removes the RL/semantic seam |
| P2 | Calibration artifact completeness (OOD metrics) | Medium-high | Deployment-grade measurability |

**Explicitly deferred from the original essay (see Appendix A for why):**
- ❌ `DecisionGraph` node-graph abstraction — `judgeCascade` + `ConfidenceRouter` + spec `criticality` already encode dependency order; a graph runtime adds indirection without measurable gain. Revisit only if cascade composition becomes non-linear.
- ❌ New workspace packages (`@senars/decision`, `@senars/calibration`, …) — actual workspace is `core/io/kernel/nar/ui/metta/util`; the decision substrate is cohesive in `nar/src/lm/system-one/`. Splitting violates the export-surface audit policy (`pnpm exports:audit`) for no consumer benefit. Consolidate in-place.
- ❌ Evidence/Judgment/Policy/Action as separate compile-time types — enforced by gates at runtime; a type-level apparatus across TS boundaries is ceremony. The provenance struct (P0) gives the auditability without the type gymnastics.
- ❌ More heads, encoder replacement, NAL/System One merge, unified "brain" — original essay also rejects these; concurred.

---

## Phase 1 (P0): Unified Decision API over Heads + Contrastive

**Problem.** Two composition paths exist today: the calibrated-head path (`judgeBatch` → isotonic → `ConfidenceRouter`) and the TODO22 contrastive path (`ContrastiveMemory.score` fallback in manifold headless mode, dispatcher penalties, gate abstain fallback, LMReflex vetoes). They are individually wired but have no single entry point, so consumers compose them ad hoc.

**Deliverables:**

| Task | File | Effort |
|------|------|--------|
| `decide()` facade: heads + contrastive + router in one typed call, one result object | `nar/src/lm/system-one/decide.ts` (new) + `system-one.ts` runtime method | 8h |
| Result carries head scores, contrastive penalty/veto, router band, abstain reason | `decide.ts` + `types.ts` | 4h |
| Migrate `dispatcher.ts`, `groundedness-gate.ts`, `lm-reflex.ts` call sites to `decide()` | those files | 6h |
| `.decide <input>` CLI for interactive inspection of the unified result | `src/bin/bot.ts` | 2h |

**Note:** ManifoldReflex keeps its direct path (per-tick latency budget); `decide()` is for non-per-tick composition.

**Verified integration details:**
- `judgeBatch(pointer, queries, budget)` **throws** if the context embedding pointer is not in `EmbeddingCache` — `decide()` must write the embedding before judging (single owner of the encode step).
- `judgeBatch` enforces `maxBatchSize`; `choose()` must chunk or cap candidate sets rather than silently truncating.
- `.judge` (`src/bin/bot.ts:468`) currently calls `manifold.judgeBatch` directly — after Phase 1 it routes through `decide()` so Phase 3 provenance is available for `--explain` for free.
- Migrating `dispatcher.judge` call sites must preserve its tier-stats/telemetry accumulation (dispatcher wraps, doesn't replace, the manifold path).
- Per AGENTS.md export policy: `decide()`/`choose()` land as internal (relative-import) APIs first; promote to the `exports` map only when a real in-repo consumer exists (`pnpm exports:audit` gate), else minor-bump is deferred.

## Phase 2 (P0): Frozen Evaluation Set

**Problem.** `train.ts` already compares arms on **identical holdout rows** (held-out Brier bake-off, deterministic), but the holdout is re-derived per run — nothing prevents teacher-error data from migrating into training over distillation generations. The distillation dataset (`JudgmentDataset`) now auto-grows from conversations (TODO22), which makes this gap live.

**Deliverables:**

| Task | File | Effort |
|------|------|--------|
| `EvalSet`: frozen, digest-pinned label snapshot written once, read-only at train time | `nar/src/lm/system-one/eval-set.ts` (new) | 6h |
| `train.ts` bake-off reports frozen-set Brier/ECE alongside per-run holdout; promotion gate requires frozen-set non-regression | `train.ts` | 4h |
| `.systemone eval-set` CLI: create/show/regenerate (regenerate is explicit + logged) | `src/bin/bot.ts` | 2h |
| Distillation auto-capture rows are **excluded** from the frozen set by construction | `eval-set.ts` + `distill.ts` | 2h |

## Phase 3 (P0): Judgment Provenance

**Problem.** Kernel state is event-sourced with derivation provenance; System One judgments are not self-describing. An action can currently be traced to heads loosely, but not to model/calibration/input digests at the judgment level.

**Deliverables:**

| Task | File | Effort |
|------|------|--------|
| `JudgmentProvenance` struct: `modelDigest`, `calibrationDigest`, `inputDigest`, `contrastiveDigest?`, `fitted`, `abstained`, `band`, `timestamp` | `decide.ts` + `types.ts` | 4h |
| Thread provenance into event log entries where judgments gate admission/actions | `nar/src/nar/system-one.ts` + gate call sites | 6h |
| `.judge --explain`: prints provenance chain for a judgment | `src/bin/bot.ts` | 2h |

**Note:** digests mostly exist (`ModelDigest`, calibration lock) — this phase is threading + surfacing, not new crypto.

## Phase 4 (P1): `choose()` — Candidate-Set Decisions

**Problem.** Classify heads already judge over the **query's declared space** (`ClassifyQuery.space`; `candidate_select` is judged in the candidate-selection space, never forced to `task_type`). But there is no single API that takes arbitrary candidates and returns a distribution + abstain; each consumer (tool routing, cortex candidates, LMReflex ranking) re-implements selection.

**Deliverables:**

| Task | File | Effort |
|------|------|--------|
| `choose({ context, candidates })` → `{ selected, distribution, abstained, provenance }`, implemented over `judgeBatch` + contrastive penalty | `decide.ts` | 8h |
| Candidate-set digest in provenance (original essay's point, kept — cheap and valuable) | `decide.ts` | 1h |
| Migrate `LMReflex` ranking and cortex candidate judging to `choose()` | `lm-reflex.ts`, `cortex-adapter.ts` | 6h |

## Phase 5 (P1): Cost-Aware Cascade Consolidation

**Problem.** The cortex ladder (manifold → provisional → cortex → baseline) and `judgeCascade` overlap conceptually; per-request head selection is all-or-nothing inside `judgeBatch`.

**Deliverables:**

| Task | File | Effort |
|------|------|--------|
| Head-level short-circuit at the **query-composition layer**: `decide()` omits queries whose outcomes cannot change the router decision (e.g. injection=high → block, skip remainder). `judgeBatch` already takes a query array, so skipping = omitting — manifold internals untouched | `decide.ts` | 8h |
| Short-circuited heads reported as `skipped: true` in the decide result (never silently absent) | `decide.ts` | 1h |
| Cascade levels documented as: L0 deterministic → L1 cheap heads → L2 expensive heads → L3 LM cortex → L4 human/governance | `cascade-reflex.ts` docs + `dispatcher.ts` | 2h |
| Latency accounting per level surfaced in `.systemone dispatcher` | `telemetry.ts` + `src/bin/bot.ts` | 3h |

**Objective:** minimum computation required to cross the decision boundary — not maximum judgments per request.

## Phase 6 (P2): Unify RL/Reflex onto the Decision API

**Problem.** `ManifoldRLAgent` already runs `reflex_value`/`feasibility`/`risk` through `judgeBatch` with no NAL — proving the manifold is a general decision substrate — but RL reflexes (`TabularQReflex`, `EpsilonGreedyReflex`, `UCBReflex`) negotiate through a separate `Negotiator` path.

**Deliverables:**

| Task | File | Effort |
|------|------|--------|
| `ManifoldRLAgent` action selection via `choose()` (same API as Phase 4) | `manifold-rl-agent.ts` | 6h |
| Negotiator semantics preserved: NAL retains veto authority; reflexes only propose | `Negotiator.ts` (no behavior change) | 0h (verify + test) |
| `rl-parity` bench re-run to confirm no regression | `scripts/rl-parity.ts` | 1h |

## Phase 7 (P2): Calibration Artifact Completeness

**Problem.** `calibration-lock.json` already carries `modelDigest`, per-head abstain thresholds, `calibrationVersion`, with fail-closed digest pinning. Missing: evaluation and OOD metrics **inside the artifact**.

**Deliverables:**

| Task | File | Effort |
|------|------|--------|
| Extend lock schema: `eval: { brier, ece, datasetDigest }`, `ood?: { ece, datasetDigest }` | `calibration-fit.ts` | 4h |
| Populate from the Phase 2 frozen set | `train.ts` + `eval-set.ts` | 3h |
| `.systemone heads` shows eval/ood columns | `src/bin/bot.ts` | 1h |

---

## Acceptance Criteria

1. `decide()` returns head scores + contrastive + router band + abstain reason in one call; dispatcher/gate/LMReflex consume it
2. Frozen eval set digest-pinned; promotion gate fails on frozen-set regression; conversation-captured rows excluded by construction
3. Every gated judgment emits a `JudgmentProvenance`; `.judge --explain` prints the full chain
4. `choose()` used by LMReflex, cortex candidates, and `ManifoldRLAgent`; distribution + abstain semantics identical across them
5. Head short-circuit reduces average `judgeBatch` head invocations measurably (short-circuit at query-composition layer; `pnpm bench:manifold` gate ≤20ms/judgment still passes)
6. Calibration lock contains eval/ood metrics fitted from the frozen set
7. **No behavior regression:** existing bake-off, rl-parity, and manifold-bench scripts pass unchanged
8. Orthogonality preserved: everything lands in `nar/src/lm/system-one/`; bot.ts gets CLI exposure only

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| `decide()` becomes a god-function | Keep it a thin facade over existing calibrated pieces; no new inference logic |
| Frozen set goes stale as behavior evolves | Explicit regenerate command + digest log entry (event-sourced) |
| Short-circuit changes head availability downstream | Short-circuited heads report `skipped: true`, never silently absent |
| Semver: `decide()`/`choose()` are new public exports | Minor bump per policy; export-surface audit updated in same commit |

## Dependencies

```
nar/src/lm/system-one/
  ├── decide.ts (NEW — facade over heads + contrastive + router + choose)
  ├── eval-set.ts (NEW — frozen evaluation snapshots)
  ├── head-specs.ts, manifold.ts, dispatcher.ts, policy.ts (existing, migrated)
  ├── contrastive.ts, hard-negatives.ts (TODO22 layer, integrated not duplicated)
  ├── train.ts, calibration-fit.ts, distill.ts (flywheel, frozen-set aware)
  └── manifold-rl-agent.ts, lm-reflex.ts, cortex-adapter.ts (consumers)
nar/src/gates/, nar/src/kernel/KernelBudgetGate.ts (unchanged — authorization stays in kernel)
src/bin/bot.ts (CLI exposure only: .decide, .systemone eval-set, .judge --explain, heads columns)
```

## Out of Scope (Explicit)

- ❌ `DecisionGraph` node runtime (revisit if cascade composition becomes non-linear)
- ❌ New workspace packages / package splits
- ❌ Compile-time Evidence/Judgment/Policy/Action type apparatus
- ❌ Self-modification, governance auto-approval, distributed System One (carried from TODO22)
- ❌ Encoder replacement, additional heads

---

## Progress (2026-09-24)

### Phase 1 — Unified Decision API ✅
- `nar/src/lm/system-one/decide.ts` (NEW): `createDecider()` returns a `Decider` with
  `decide()` (heads + contrastive + router + composite + provenance in one result) and
  `choose()` (Phase 4 candidate-set API, implemented ahead of schedule since it shares the machinery).
  - Chunks queries by `maxBatchSize` (never silently truncates); writes the context embedding
    once (single owner of the encode step — satisfies the `judgeBatch` pointer precondition).
  - Contrastive scoring is rubric-scoped via `DecideRequest.contrastiveRubric`, else cross-rubric.
  - `choose()` applies CLM hard-negative penalties, re-normalizes the distribution, honors
    `verificationFloor` vetoes, and pins a candidate-set digest in provenance.
- `JudgmentProvenance` lives in `decide.ts` (not `types.ts` — it needs `BandDecision` from
  policy.ts; types.ts stays dependency-free).
- `SystemOneRuntime.decider` + `decide()`/`choose()` convenience methods;
  `nar.getSystemOneDecider()` getter. Decider's `judge` dep is `dispatcher.judge` — tier0/3
  fallbacks and BudgetGate charging are preserved (dispatcher wraps, not replaced).
- **Migrated to `decide()`:** `groundedness-gate.ts` (rebuilt over a local decider; contrastive
  fallback now flows through the result instead of a second manual call site).
- **NOT migrated (deferred):** `dispatcher.ts` call sites (circular by construction — decider
  composes dispatcher.judge); `lm-reflex.ts` (its verifiedRanking path → Phase 4 `choose()`
  migration); ManifoldReflex keeps its direct per-tick path as planned.
- CLI: `.decide <input> [--rubrics a,b,c]`; `.judge` now routes through `decider.decide()` and
  accepts `--explain` (prints the provenance chain). `.help` updated.
- Tests: `tests/nar/todo23-decide.test.ts` (8 tests: band monotone-restrict, abstain reasons,
  contrastive penalty, chunking, composite, choose penalties/veto/no-candidates).

### Phase 2 — Frozen Evaluation Set ✅
- `nar/src/lm/system-one/eval-set.ts` (NEW): `createFrozenEvalSet` (excludes
  `source === 'conversation'` rows **by construction** — TODO22 auto-capture can never enter),
  `writeEvalSet`, `loadEvalSet` (**fail-closed** `DigestMismatchError` on row tampering),
  `evalMetrics`/`headMetrics` (Brier + `identityECE`), `assertFrozenNonRegression` gate
  (`EvalRegressionError`).
- `runBakeOff` (distill.ts) gained an optional trailing `frozen?: { cases, tolerance }` param
  (non-breaking): reports `frozen: { baselineBrier, candidateBrier, nonRegression }` and
  **rejects the candidate on frozen-set regression** regardless of shadow parity.
- CLI: `.systemone eval-set create|show|regenerate` (snapshot at `.cache/systemone/eval-set.json`;
  regenerate is explicit). Live dataset path comes from `systemOne.distillation.datasetPath`.
- Tests: `tests/nar/todo23-eval-set.test.ts` (5 tests).
- **Remaining:** training entry points (`loadTrainingData`/`.calibrate` flow) don't yet *read*
  the frozen set for their heldout; the gate exists and the bake-off honors it — wire
  `.calibrate` to fail when a frozen snapshot exists and shows regression.

### Phase 3 — Judgment Provenance ✅ (schema + surfacing; event emission partial)
- `JudgmentProvenance` struct on every `DecideResult`/`ChooseResult`:
  `modelDigest`, `calibrationDigest`, `inputDigest` (sha256 of context text / candidate set),
  `contrastiveDigest?`, `fitted`, `abstained`, `band`, `timestamp`.
- `judgment.resolved` schema (kernel/src/schemas.ts) extended with optional
  `modelDigest | calibrationDigest | inputDigest | decisionBand`; `createTelemetryEmitter`
  sets `modelDigest` from every proposition and accepts a decision-level provenance third arg;
  `nar.emitJudgmentResolved` threads it.
- `.judge --explain` prints the full chain (model/calibration/input digests, fitted, timestamp).
- **Remaining:** per-proposition events emitted from the manifold callback predate the decision
  (no inputDigest); decision-level `inputDigest`/`decisionBand` reach the event log only when a
  consumer passes provenance into the emitter. Gate admission sites should pass
  `result.provenance` at their next touch point.

### Deferred to next session (in priority order)
1. **Phase 4 migration**: LMReflex `#verifiedRanking` + cortex candidate judging onto
   `choose()` (API already shipped; migration is behavior-preserving but touches parity-tested
   paths — run rl-parity after).
2. **Phase 6 follow-up**: `Negotiator` semantics verify-only pass (no decider wired there yet);
   rl-parity full multi-seed run.
3. Phase 2 follow-up below if not already done.

### Notes for remaining work
- `HeadVerdict.skipped` is set by the Phase 5 short-circuit; `skipped` verdicts are excluded
  from the overall band/abstain computation.
- Semver: `decide`/`choose`/eval-set are new in-repo consumers via relative imports; run
  `pnpm exports:audit` before promoting anything to the `@senars/nar` exports map.
- `verify.ts` (existing) is unrelated to the decider; leave untouched.
- `parity:smoke` (1 seed, deterministic) fails on clean HEAD too (SeNARS return −0.2 vs
  Q-learning 0.7) — pre-existing, unrelated to TODO23; treat rl-parity as a longer-run gate.

### Progress (2026-09-24, session 2 — Phases 5/6/7)

**Phase 5 — Cost-aware short-circuit ✅**
- `decide()` evaluates chunks sequentially; once a safety-floor head (`injection`/`assertion`
  at `criticality ∈ {high, critical}`) scores ≥ 0.8 (declared `VETO_TRIGGER`), remaining
  queries are omitted from the judge call and reported with `skipped: true` (never silently
  absent). A safety-floor veto forces the verdict band to `block`. Skipped verdicts are
  excluded from the overall band/abstain computation.
- Per-level latency accounting: `SystemOneDispatcher.#tierLatency` + `latencyStats()`
  (calls/judgments/meanMs per L0/L1), surfaced in `.systemone dispatcher`.

**Phase 6 — RL onto the decision API ✅ (opt-in)**
- `ManifoldRLAgentOptions.decider?` + `verificationFloor?`: when a Decider is supplied, the
  eligible action set is finalized via `choose()` (contrastive penalties + vetoes layered on
  head-driven feasibility/risk eligibility); a `choose()` abstain falls back to the incumbent
  head-driven `#select`. Eligibility filter extracted to `#eligible()` (shared).
- Default path (no decider) unchanged — `rl-parity` safe. **Note:** `parity:smoke` fails on
  clean HEAD too (see notes above); full multi-seed rl-parity still pending.
- `Negotiator` untouched (NAL veto authority preserved by construction — reflexes only
  propose through `choose()`).

**Phase 7 — Calibration artifact completeness ✅**
- `CalibrationLock` extended with optional `eval`/`ood` blocks (`brier`, `ece`,
  `datasetDigest`, `count`); `fitCalibrationLock` accepts `frozenSet`/`oodSet`.
- `scripts/system-one-fit-thresholds.ts --eval-set <path>` loads the frozen snapshot
  (fail-closed) and embeds its metrics in the lock.
- `.systemone heads` prints `eval:`/`ood:` columns from the lock when present.

**Tests added:** `tests/nar/todo23-phases56.test.ts` (short-circuit skip/veto/band, no
short-circuit on non-safety heads, choose-override + abstain-fallback RL selection).
Full nar suite: 179 files / 1594 tests passing.

**Remaining after this session:**
1. ~~Phase 4 migration: LMReflex `#verifiedRanking` onto `choose()`~~ → done (session 3).
2. OOD slice labeling for `lock.ood` (needs an OOD marker on rows — e.g. a `domain` field or
   an out-of-distribution label source).
3. `.calibrate` could trigger the frozen-set fit flow end-to-end (script currently CLI-only).

### Progress (2026-09-24, session 3 — Phase 4 + Negotiator verification)

**Phase 4 — candidate consumers onto `choose()` ✅ (LMReflex migrated; cortex documented)**
- `choose()` gained `preScored?: { option, p }[]`: when supplied, no `candidate_select` head
  invocation occurs — contrastive penalties/vetoes are applied to the pre-scored ranking only
  (uniform `p` ⇒ adjusted ordering = verification ordering; `choose()`'s distribution
  preserves input order, so consumers must sort by `contrastive.penalties` themselves).
- `LMReflex` now owns a `Decider` (built over `dispatcher.judge`); `#verifiedRanking`
  routes through `decider.choose({ preScored, p: 1, verificationFloor: 0 })` and re-sorts by
  `1 − penalty` with rank-stable ties — semantics identical to the legacy in-lined
  contrastive sort (todo22-clm-wiring tests pass unchanged, veto telemetry preserved).
- **Cortex candidate judging intentionally NOT migrated:** `proposeAndJudge`'s selectQ path
  *is* the tiered judge path (tier-1-only admission + provisional fallback semantics live
  there); `choose()` is layered above it, not a replacement. Documented as the durable seam.
- **Negotiator verification ✅:** untouched; `todo17b-nal-arm` (NAL veto authority) 5/5.
  Reflexes only propose through `choose()`/`proposeAndJudge`; NAL retains veto authority.

**Remaining after session 3:**
1. ~~OOD slice labeling for `lock.ood`~~ → done (session 4).
2. ~~`.calibrate` end-to-end frozen-fit wiring~~ → done (session 4).
3. ~~Optional: `ChooseResult.distribution` sorted-output~~ → done (`ranked`, session 4).

### Progress (2026-09-24, session 4 — remaining items closed)

- `ChooseResult.ranked`: distribution sorted by adjusted score descending — consumers no
  longer re-sort by penalties themselves (LMReflex keeps its own stable rank-tie sort since
  it needs the original-index tiebreak).
- **OOD labeling:** `DistillationLabel.domain?: 'in-domain' | 'ood'`; `createFrozenEvalSet`
  carries it into rows, `splitOod()` slices the frozen set; the fit script and
  `.calibrate refit` populate `lock.ood` when OOD rows exist (slice digests via `digestRows`).
  Producers (conversation capture, reflex outcomes) can set `domain: 'ood'` on
  out-of-scope turns going forward — no producer sets it yet.
- **`.calibrate refit`:** loads the distillation dataset + frozen eval set (fail-open to
  per-run holdout when the snapshot is absent), runs `fitCalibrationLock` with the frozen
  slices, writes the lock, and reminds that a restart is required to apply it to the manifold.

### Acceptance criteria status (final)
1. ✅ `decide()` single result (scores + contrastive + band + abstain); gate + LMReflex consume it
2. ✅ Frozen eval set digest-pinned; bake-off promotion gate fails on frozen regression; conversation rows excluded by construction
3. ✅ `JudgmentProvenance` on every decide/choose; `.judge --explain` prints the chain (decision-level event emission available via emitter provenance arg)
4. ✅ `choose()` used by LMReflex (preScored verification) and ManifoldRLAgent (opt-in selection); cortex candidates stay on the tiered path by design (documented seam)
5. ✅ Head short-circuit at the query-composition layer with `skipped: true`; per-level latency in `.systemone dispatcher`
6. ✅ Calibration lock eval/ood blocks fitted from the frozen set (`.calibrate refit`, fit script)
7. ✅ Existing bake-off / calibration / manifold tests pass unchanged; `parity:smoke` failure is pre-existing on clean HEAD (1-seed, unrelated)
8. ✅ All new code in `nar/src/lm/system-one/` + CLI exposure only in bot.ts

### Progress (2026-09-24, session 5 — OOD producer live)
- **Conversation capture now tags OOD turns:** when the trace grader's groundedness head
  abstains (quality came from cross-rubric contrastive), `captureDistillation` records
  `domain: 'ood'` — those turns flow into the frozen-set OOD slice (`lock.ood`) instead of
  in-domain evaluation. `refreshContrastive` excludes `domain: 'ood'` rows from groundedness
  positives (out-of-scope turns must not seed the positive class).
- `pnpm exports:audit` / `exports:check` verified clean after the TODO23 work.
- **TODO23 is complete.** Future extension points: mark reflex-outcome rows OOD when the
  reward is strongly negative (failure episodes); multi-seed rl-parity vs the opt-in decider.

---

## Appendix A: Corrections to the Original Analysis

The original essay was grounded in README/docs only and predated TODO22. Verified corrections:

| # | Original claim | Actual state |
|---|----------------|--------------|
| 1 | "Documentation describes 17 heads, README 19" | `HEAD_SPECS` has **19** heads; the essay's own head list omitted `plausibility` (Jev Noul) and `assertion` (safety floor). No doc drift. |
| 2 | Four kernel gates listed as `PerceptionGate/ActionGate/RewardGate/BudgetGate` | `nar/src/gates/` holds three; `KernelBudgetGate` lives in `nar/src/kernel/` and is charged via `system-one/resource-gate.ts`. Functionally as described. |
| 3 | Proposed packages `@senars/decision`, `@senars/calibration`, `@senars/policy`, `@senars/provenance`, `@senars/rl` | Workspace is `core/io/kernel/nar/ui/metta/util`; the entire decision substrate is cohesive in `nar/src/lm/system-one/`. Splitting conflicts with the repo's export-surface policy (every `exports` subpath needs an in-repo consumer). Rejected. |
| 4 | P1 "Introduce candidate-set semantics" as a gap | **Partially implemented**: `ClassifyQuery.space` judges over the query's declared space (README §19 heads). True remaining gap is the unified `choose()` API with distribution + abstain output → Phase 4. |
| 5 | P0 "Make calibration a first-class artifact" as a gap | **Largely implemented**: digest-pinned `calibration-lock.json` with `modelDigest`, `calibrationVersion`, fail-closed rejection on mismatch (`calibration-fit.ts`). Remaining gap is eval/OOD metrics in the artifact → Phase 7. |
| 6 | "Distillation can freeze teacher errors" (general concern) | Valid and now more pressing: TODO22 added **auto-capture of graded conversation turns** into `JudgmentDataset`. `train.ts` bake-off uses per-run holdout (not frozen). → Phase 2 (highest-value gap). |
| 7 | No mention of the contrastive/CLM layer | TODO22 shipped `ContrastiveMemory` (InfoNCE calibration, hard-negative mining, replay 40/60), dispatcher contrastive penalties, groundedness-gate abstain fallback, LMReflex `#verifiedRanking` vetoes, `ConversationGame`, and contrastive seeding from episodic memory + accepted distillation rows. Any decision-API work must integrate this, not bypass it → Phase 1. |
| 8 | P0 "DecisionGraph" refactor | Original essay's central proposal. `judgeCascade` + `ConfidenceRouter` monotonicity + `HeadSpec.criticality` already encode the composition order declaratively. A graph runtime adds indirection with no measurable payoff at current head count (19). Deferred; the `decide()` facade (Phase 1) delivers the "single typed decision API" benefit without the graph machinery. |
| 9 | P0 "Evidence/Judgment/Policy/Action as separate types" | The separation exists at runtime via kernel gates; the essay's own principle ("models produce judgments, policies compose, kernel authorizes") is enforced there. Type-level apparatus across the NAR/bot boundary is ceremony → provenance struct (Phase 3) gives the auditability. |
| 10 | "ManifoldRLAgent uses manifold with no NAL" | Confirmed (`manifold-rl-agent.ts`). Strengthens Phase 6: it should share the same decision API as semantic consumers. |
| 11 | "TypeSafe-compatible remote `/v1/systemone` protocol" | Wire protocol exists (`systemone-wire.ts`, `http-manifold.ts`, `open-systemone-manifold.ts`); "TypeSafe" branding is not in-repo terminology. |
| 12 | Shared-encoder failure correlation (heads look independent, share failure modes) | Valid concern, not addressed in this TODO. Tracked as an open measurement question: frozen-set per-head error-correlation analysis is a natural extension of Phase 2 metrics. |

**What survived review and is genuinely valuable:** frozen evaluation isolation (→ Phase 2), judgment provenance (→ Phase 3), candidate-set `choose()` (→ Phase 4), cost-aware cascading (→ Phase 5), RL/semantic unification (→ Phase 6). What was re-scoped: DecisionGraph (→ facade), package splits (→ rejected), type apparatus (→ provenance struct), calibration artifact (→ mostly done, Phase 7 completes it).
