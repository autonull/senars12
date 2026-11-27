This adopts the repair-task bridge from the draft and perfects two things that would otherwise break in implementation: **findings get a stable cross-run signature** (so `acceptance.resolve` and verify matching reference something that survives re-recording, not a per-run id), and the **grader guard is auto-derived and enforced by git-diff**, not trust. It also adds two cheap loop behaviors — task dedup by signature, and fixture promotion that suggests a hardening expectation. Redaction is excluded. Everything else stays cut.

---

## 📋 Implementation Progress

**Phase 1 — Core Loop (No LM)** — ✅ **COMPLETE**
- [x] `observe/` package created with package.json and workspace integration
- [x] `schema.ts` — Finding, Verdict, RepairTask, CheckResult, EvidenceRef (Zod)
- [x] `programs.ts` — ObserveProgram type + 5 seed program adapters
- [x] `record.ts` — Recorder class (EventBus + Playwright + node-pty)
- [x] `run.ts` — observeRun() wrapping runScenario() + recorders
- [x] `checks.ts` — runChecks() with deterministic validators (validator, literal, stall, ui, budget)
- [x] `review.ts` — reviewBundle() with judgeBatch() integration
- [x] `report.ts` — renderReport() markdown output
- [x] `task.ts` — emitTask() with governance artifact registration + dedup
- [x] `verify.ts` — verifyTask() with replay + grader guard (git diff + PatchRiskClassifier)
- [x] `diff.ts` — diffRuns() and bisect() stubs
- [x] `promote.ts` — promoteRun() with fixture write + hardening suggestion
- [x] `cli.ts` — senars observe subcommand router (list, run, record, review, verify, diff, bisect, promote, export, replay)
- [x] Tests: `schema.test.ts`, `programs.test.ts` passing

**Phase 2 — Intelligence** — ✅ **COMPLETE**
- [x] LM review integration testing (test 2: Sensitivity, test 4: Grounding + fail-closed)
- [x] MCP tools (observe_run, observe_task, observe_verify) in `src/bin/lib/mcp/tools.ts`
- [x] Failure-bundle hook in `observe/src/hooks.ts` + integrated in `run.ts`
- [x] Auto scenario registration in `promote.ts`

**Phase 3 — Polish** — ✅ **COMPLETE**
- [x] diff.ts full implementation (frame hash comparison, gate snapshot deltas, findings changed)
- [x] bisect.ts full implementation (git bisect + replay with event digest comparison)
- [x] export/replay CLI (GIF generation via ffmpeg, webm serving, HTTP server for replay)
- [x] --publish flag (implemented in Phase 1, works with generated/observations)
- [x] Drift gate (runDriftGate in drift.ts + CLI command)
- [x] Generated tours (HTTP server serves bundle for video/cast/report viewing)

---

# RFC: Self-Observation & Repair Loop (`@senars/observe`)

**Status:** final implementable spec · **Package:** `observe/` workspace · **Surfaces:** `senars observe …`, MCP `observe_*`, CI.

## 0. What it does

1. **Records a run** — webm of the UI, asciicast of the console, cognitive events, keyframes — into one bundle. Reuses existing event-sourced log (`LogStore`) + replay infrastructure (`replay.ts`, `replay-reducers.ts`) for deterministic re-execution. **Also serves as a general-purpose recording tool for debugging, education, and promotion.**
2. **Reviews it** — deterministic checks first, then one budgeted LM call (System One's `judgeBatch()`) that reads transcript + event summary + keyframes and reports anything wrong, with cited evidence.
3. **Turns a finding into a repair task** with an objective acceptance test, and **verifies a candidate fix by replaying the same event log in a shadow worktree**. A fix is accepted only when the original finding is gone and nothing new broke.

Builds on what exists: event-sourced log + replay, `LM_PROVIDER=mock`, Playwright in `ui/`, the `Scenario` catalog (`scenario-execute.ts`), and the existing **shadow-worktree / `apply_fix` / `ApprovalManager` / `PatchRiskClassifier` / `GovernancePolicyEngine` pipeline**. **No kernel changes.** Observe produces tasks and verdicts; the existing pipeline repairs and merges.

**Dual purpose:** The same recording infrastructure (`Recorder` class) serves both the self-improvement loop **and** general recording needs (debugging sessions, tutorial generation, demo videos, conference talks).

---

## 🚀 Implementation Efficiency: Reuse Strategy

| Observe Module | Reuses / Delegates To | New Code |
|----------------|----------------------|----------|
| `run.ts` | `runScenario()` + recorder wrapper | ~150 LOC |
| `record.ts` | `EventBus` + Playwright CDP + `node-pty` | ~200 LOC |
| `checks.ts` | `ScenarioValidator[]` + `BudgetExhaustedEvent` | ~100 LOC |
| `review.ts` | `SystemOneManifold.judgeBatch()` + prompt template | ~150 LOC |
| `task.ts` | `GovernanceArtifactRegistry` (kind: `self-improvement-task`) | ~80 LOC |
| `verify.ts` | `replay()` + `PatchRiskClassifier.classify()` + `git diff` | ~200 LOC |
| `diff.ts` | `replayCognitiveState()` + frame hash comparison | ~120 LOC |
| `promote.ts` | `scenario-profiles.ts` registry + `GovernanceArtifactRegistry` | ~100 LOC |
| `cli.ts` | Existing `senars` command router | ~100 LOC |

**Total new code: ~1,200 LOC** across 10 files. Zero kernel changes. Deps: `playwright-core`, `node-pty`, `sharp`, `zod`, `ulid`.

---

## 1. Design Rules

1. **Event log is truth** — video/cast are timestamped views over it. Event log = `LogStore` (SQLite/JSONL).
2. **Capture is read-only** — passive `EventBus` subscription + Playwright CDP; no kernel mutations.
3. **Checks before LM** — one `judgeBatch()` call per run; capped frames; reviewer unavailable ⇒ `uncertain`, never `pass`.
4. **Every finding cites evidence** — frame, cast timestamp, or event id — and carries a stable **signature** (§6).
5. **Agent may not edit its own grader** — programs, expectations, `checks.ts`, reviewer prompt, schema are fixed inputs. Enforced by `verify` via `git diff` against `doNotEdit` paths **and** `PatchRiskClassifier` guard-rail list (`GUARDRAIL_FRAGMENTS`).
6. **Fix accepted only by replay** — baseline findings resolve, no new finding ≥ warn, checks pass. Replay = `replay()` with same `fromSeq`/`toSeq`, not a fresh run.

---

## 2. The Self-Improvement Loop

```
observe run ──▶ bundle (manifest + events.jsonl + frames + checks + verdict)
      │  check failure or finding ≥ warn
      ▼
repair-task.json ──▶ apply_fix / external agent (MCP) ──▶ shadow worktree patch
      │                                                                          │
      └──────────── observe verify --task … --worktree … ◀──────────────────────┘
                                  │  accept / reject (objective, via replay)
                       accept ──▶ GovernancePolicyEngine.decide() ──▶ ApprovalManager ──▶ merge
                                  │
                       optional: observe promote ──▶ fixtures/observe/ + sensitivity suite
```

**Loop invariants:**
- **Same behavior on replay** → `replay()` with same `fromSeq`/`toSeq` + `eventDigest` match
- **Grader immutability** → `PatchRiskClassifier` (HIGH risk on `GUARDRAIL_FRAGMENTS`) + `git diff` in `verify`
- **Task deduplication** → `GovernanceArtifactRegistry` keyed by signature; `observe run` queries before emit
- **Fix validation = behavior** → `verify` runs `replay()`, not `runScenario()` — same event log, same gate snapshots
- **Coverage growth** → `promote` registers `ScenarioSpec` → runs in `pnpm test:cognitive` sensitivity suite

---

## 3. Layout

```
observe/
  src/
    schema.ts       # Finding, Verdict, RepairTask, CheckResult, EvidenceRef (Zod)
    programs.ts     # ObserveProgram type + 5 seed program adapters
    run.ts          # observeRun() — wraps runScenario() + recorders
    record.ts       # Recorder class — EventBus + Playwright + node-pty
    checks.ts       # runChecks() — validators + gate event subscribers
    review.ts       # reviewBundle() — builds prompt, calls judgeBatch()
    report.ts       # renderReport() — markdown + evidence links
    task.ts         # emitTask() — governance artifact + dedup
    verify.ts       # verifyTask() — replay + risk check + acceptance
    diff.ts         # diffRuns(), bisect() — replayCognitiveState + frame hashes
    promote.ts      # promoteRun() — writes scenario profile + artifact
    cli.ts          # senars observe subcommand router
  programs/
    contradictory-sensors.observe.ts
    temporal-reasoning.observe.ts
    resource-pressure.observe.ts
    belief-revision.observe.ts
    cross-engine-sync.observe.ts
tests/observe/
fixtures/observe/            # promoted regression fixtures (committed)
generated/observations/      # committed GIFs/casts/reports (small)
.cache/observations/         # run bundles (gitignored)
```

Integrates with existing paths:
- `src/tools/adapters/self/` — self-tools (`apply_fix`, `run_tests_shadow`, `run_scenario_shadow`)
- `src/tools/adapters/shadow-worktree.ts` — `ShadowWorktreeManager`
- `src/governance/pipeline.ts` — `PatchRiskClassifier`, `GovernancePolicyEngine`, `ProposalRouter`, `SandboxValidator`
- `src/agent/ApprovalService.ts` — `ApprovalManager`, `InMemoryApprovalManager`
- `src/log/replay.ts` + `src/kernel/replay-compat.ts` — deterministic replay
- `src/tools/adapters/scenario-execute.ts` — `ScenarioSpec`, `runScenario`, validators
- `src/lm/system-one/` — `SystemOneManifold`, `HEAD_SPECS`, `judgeBatch`

---

## 4. Programs (Scenario-based)

**Reuses existing `ScenarioSpec`** — no new program schema. Observe programs *are* scenarios with added observation metadata.

```ts
export interface ObserveProgram extends ScenarioSpec {
  observe: {
    surfaces: ('console' | 'ui')[];
    keyframeMarks: string[];           // mark IDs to capture as keyframes
    maxFrames: number;                 // cap for LM review
    reviewerPrompt?: string;           // optional override
    lane: 'hermetic' | 'live';         // hermetic = deterministic replay; live = real-time
  };
}
```

**Seed programs (5, adapting existing profiles):**

| Program | Profile | Observes | Key Assertions |
|---------|---------|----------|----------------|
| `contradictory-sensors` | `contradictory_sensors` | Contradiction detection | `contradiction_detected_within` |
| `temporal-reasoning` | `temporal_reasoning` | Sequence derivation | `specific_belief_derived: event_A ==> event_C` |
| `resource-pressure` | `resource_pressure` | AIKR graceful degradation | `response_latency_p95`, `min_derivations` |
| `belief-revision` | `belief_revision` | Revision under conflicting evidence | `contradiction_detected_within` |
| `cross-engine-sync` | `cross_engine_sync` | NAR↔MeTTa coordination | `specific_belief_derived: nar_fact <-> metta_atom` |

**Mark IDs** = `inject_<index>` (from scenario inject events) + `success_criteria` keys — stable strings that anchor finding signatures across runs. No new DSL.

**Ad-hoc recording (no program needed):**
```bash
# Record any command for debugging/education/promotion
senars observe record --command "pnpm senars run --profile agent" --name my-debug-session
senars observe record --command "pnpm bot" --name tutorial-episode-1 --surfaces console,ui
```
Produces the same bundle (`.cache/observations/<name>/`) without checks/review/task — pure recording for external use.

---

## 5. Capture

`observeRun()` wraps `runScenario()` with a passive `Recorder`. **Same `Recorder` class used by `observe record` for ad-hoc sessions.**

- **Console:** `node-pty` (120×32) → asciicast v2 (`[t,"o",chunk]`).
- **UI:** Playwright `recordVideo` (webm) + `tracing` (`trace.zip`) + keyframe loop (`page.screenshot()` at marks + ~1 fps, hash-deduped via `sharp`). Hermetic lane pins fonts/viewport; live lane animates.
- **Events:** passive `EventBus` tail + `page.on('websocket')` → `events.jsonl` (`CognitiveEvent` schema, 48+ types).
- **Marks:** injected at each `inject` event and each `success_criteria` check (for programs) or manual `--mark` flags (for ad-hoc) → `marks.jsonl` (`{id,label,t,castT,videoT}`).

**Bundle** `.cache/observations/<runId>/`: `manifest.json` (program, gitSha, seed, lane, marks, artifact hashes, `eventDigest` = SHA256 of `events.jsonl`), `console.cast`, `ui.webm`, `ui-trace.zip`, `events.jsonl`, `frames/*.jpg`, `checks.json`, `verdict.json`, `report.md`, `repair-task.json` (when actionable).

**Non-perturbation:** recorders on vs off ⇒ identical `eventDigest`. Verified by `replay()` producing same `CognitiveStateSnapshot`.

**Ad-hoc recording:** `observe record --command "..."` spawns the command under the same Recorder — no scenario, no checks, no review, no task. Pure artifact capture for debugging, tutorials, demos.

---

## 6. Review

**Checks (deterministic, always, blocking in CI):**
- `ScenarioValidator[]` failures (from `success_criteria`)
- Literal scans: `NaN`/`undefined`/`[object Object]` in events
- Stall: no events for N steps while stream open
- Frozen UI: ≥6 identical frame hashes over ≥3s while events claim activity
- Budget storms: >3 `BudgetExhaustedEvent`s

Each check result has stable `checkId` = `checkKind:expectationId`.

**LM Review (one `judgeBatch()` call):**
- Input: narrative + rubric claims + timed transcript + event summary (gate decisions, derivation finals, tool executions) + ≤12 keyframes
- Prompt rules: events outrank narration; every finding cites evidence; `uncertain` allowed; minimal repair hypothesis only
- One retry on invalid JSON, then `uncertain`
- No vision / no reviewer ⇒ `uncertain`

```ts
Finding = { id, signature, kind, severity, claim, evidence[], markId, expectationId?, owner?, repairHint? }
// signature = `${kind}:${expectationId ?? markId}` — deterministic, survives re-recording

Verdict = { runId, programId, overall: pass|warn|fail|uncertain, perception: text|vlm|unavailable, findings: Finding[] }
```

---

## 7. Repair Task (the bridge)

Emitted on check failure or finding ≥ warn; **deduped by signature** against open tasks in `GovernanceArtifactRegistry` (kind: `self-improvement-task`, `immutableByAgent: true`).

```ts
RepairTask = {
  taskId, baselineRunId, baselineGitSha,
  program, seed, lane, repro: `senars observe run --program ${name}`,
  findings, checks, evidenceIndex, firstDivergentMark?,
  hint: { owner?, hypothesis? },
  acceptance: { resolve: string[], noNewFindingsAtOrAbove: 'warn', checksMustPass: true, maxDurationMs: 120_000 },
  doNotEdit: string[],           // auto-derived: program file, checks.ts, review.ts, schema.ts, scenario-profiles.ts
  riskTier: 'low'|'medium'|'high' // from PatchRiskClassifier
}
```

`acceptance.resolve` references **signatures and checkIds** — stable across re-recordings. `doNotEdit` auto-populated from program metadata.

---

## 8. Verify — Objective Acceptance

```bash
senars observe verify --task <repair-task.json> --worktree <path>
```

1. Load baseline bundle + task.
2. **Grader guard:** `git diff <baselineGitSha> -- <doNotEdit>` in worktree. Any change ⇒ reject. Also `PatchRiskClassifier.classify()` on diff — HIGH risk on grader files ⇒ reject.
3. **Replay** in worktree: `replay()` from `src/log/replay.ts` with same `fromSeq`/`toSeq` as baseline (from manifest).
4. Run checks + review on new bundle.
5. **Accept iff:** every `acceptance.resolve` signature/checkId cleared **and** no new finding ≥ warn (signature absent from baseline) **and** all checks pass **and** duration within cap.
6. Emit `verification.json` (`accept|reject`, per-criterion results, new runId, first divergent mark).

**Why replay, not fresh run:** deterministic (same event sequence), isolates fix (only code changes), fast (reuses event log). Baseline `fromSeq`/`toSeq` stored in `manifest.json`.

---

## 9. Diff / Bisect

```bash
senars observe diff <runA> <runB>        # align by mark; first divergent mark + verdict delta
senars observe bisect --program <id> --good <sha> --bad <sha>
```

- **Diff:** compares `eventDigest`, `replayCognitiveState()` gate snapshots, frame hashes per mark, expectation results. Uses `replayCognitiveState()` from `replay-reducers.ts`.
- **Bisect:** `git bisect` + replay (not fresh run). Each step replays the good commit's event log against test commit; compares `eventDigest`. Finds regression commit deterministically.

---

## 10. Fixture Promotion

```bash
senars observe promote <runId>           # after a fix is verified
```

1. Writes `ObserveProgram` fixture to `fixtures/observe/<program>/<runId>/program.json` with regression metadata (`originalRunId`, `fixedRunId`, `clearedSignatures`).
2. Registers as scenario profile in `scenario-profiles.ts` (tags: `['regression', 'observe-promoted']`) → runs in sensitivity suite (`pnpm test:cognitive`).
3. Generates **hardening suggestion** for LM-found issues (e.g., turn `loop` finding into deterministic check in `checks.ts`) — applied as separate human-reviewed change per Rule 5.
4. Stores promotion as governance artifact (`kind: regression-fixture`, `immutableByAgent: true`).

---

## 11. CLI / MCP / CI

```bash
# Self-improvement loop
senars observe list
senars observe run --program <id> [--live] [--publish]
senars observe review <runId>
senars observe verify --task <file> --worktree <path>
senars observe diff <runA> <runB>
senars observe bisect --program <id> --good <sha> --bad <sha>
senars observe promote <runId>

# General-purpose recording (debugging, education, promotion)
senars observe record --command "<cmd>" --name <session-name> [--surfaces console,ui] [--live]
senars observe export <runId> --format gif|webm|cast|report [--output <path>]
senars observe replay <runId> [--speed 2x] [--surfaces console,ui]
```

**CLI:** adds `observe` subcommand to `senars` (via `src/cli/commands.ts` router). Exit codes: `0` pass/accept, `1` findings ≥ warn/reject, `2` check failure, `3` uncertain.

**MCP tools** (thin wrappers in `src/bin/lib/mcp/tools.ts`): `observe_run`, `observe_findings`, `observe_task`, `observe_verify`, `observe_diff`, `observe_record`, `observe_export`, `observe_replay`. External agent: run → read task → patch via `apply_fix` → verify.

**CI:**
- PR smoke: `LM_PROVIDER=mock`, checks only, <90s; failures emit `repair-task.json`
- Nightly: full catalog with System One review; promoted fixtures run in `test:cognitive`
- `--publish`: GIF (≤2MB) + cast + report → `generated/observations/<id>/`; drift gates catch staleness

**Recording features for education/promotion:**
- `observe record` — captures any command (not just scenarios) with same Recorder infrastructure
- `observe export` — converts bundle to GIF (idle-trimmed, ≤2MB), webm, asciicast, or markdown report
- `observe replay` — plays back console cast in terminal or serves webm via local HTTP for browser viewing
- `--surfaces` — choose console, ui, or both
- Bundles stored in `.cache/observations/` (gitignored); promoted exports in `generated/observations/` (committed)

---

## 12. Safety

| Layer | Mechanism | Blocks |
|-------|-----------|--------|
| Capture | Read-only `EventBus` + Playwright CDP | Kernel mutation during observation |
| Task | `GovernanceArtifactRegistry` (immutableByAgent=true) | Agent editing its own tasks |
| Grader | `PatchRiskClassifier` + `git diff` in `verify` | Grader weakening (tests, prompts, schemas) |
| Verify | `replay()` + signature matching | Fake fixes that pass CI but not behavior |
| Governance | `GovernancePolicyEngine` + `ApprovalManager` | Unauthorized merges |
| Rewards | `RewardGate` epistemic firewall | Reward hacking (belief corruption) |
| Autonomy | `AutonomyMode` state machine | Escalation beyond configured level |

**Grader files** (auto-derived in `task.ts`): program file, `checks.ts`, `review.ts`, `schema.ts`, `scenario-profiles.ts`. Any patch → HIGH risk → human review → `verify` rejects.

---

## 13. Tests (7)

Located at `tests/observe/` (vitest, `pnpm test`):

1. **Non-perturbation** — recorders on vs off ⇒ identical `eventDigest`; `replay()` produces same snapshot.
2. **Sensitivity** — seeded absurd runs (cyclic beliefs, `NaN` literal, frozen frames, divergent judgment) caught by checks/LM review; all produce task with correct signature.
3. **Specificity** — clean runs produce no findings ≥ warn and no task.
4. **Grounding + fail-closed** — uncited finding rejected; unavailable reviewer ⇒ `uncertain`, no task.
5. **Verify accepts real fix** — seeded bug + correct `apply_fix` patch ⇒ `accept`; signatures cleared, nothing new.
6. **Verify rejects grader tampering** — patch editing grader files ⇒ `reject` via `git diff` + `PatchRiskClassifier` HIGH risk.
7. **Verify rejects fake fix** — patch that greens CI but leaves finding on replay ⇒ `reject`.

---

## 14. Build Plan (3 Phases — Optimized)

| Phase | Ships | Done When | Effort |
|-------|-------|-----------|--------|
| **P1 — Core Loop (No LM)** | `observe/` package, `ObserveProgram`, recorders, marks/manifest, **deterministic checks only**, `repair-task.json`, CLI `observe run`, **`verify` (replay + `doNotEdit` + `PatchRiskClassifier`)** | 2 programs record → task → verify accept/reject; tests 1, 3, 5, 6, 7 pass. **Works with `LM_PROVIDER=mock`, zero LM calls.** | ~600 LOC, 2 weeks |
| **P2 — Intelligence** | `judgeBatch()` review, `promote` (fixture write + manual scenario registration), MCP tools (`observe_run`, `observe_task`, `observe_verify`), failure-bundle hook | Tests 2, 4 pass; LM findings produce tasks; promoted fixtures run in `test:cognitive` (manual registration). | ~400 LOC, 1 week |
| **P3 — Polish** | `diff`/`bisect`, `observe export`/`replay`, generated tours, `--publish`, drift gate, auto scenario registration | Tutorials regenerate drift-free; full recording UX for debugging/education/promotion. | ~200 LOC, 1 week |

### 🎯 Efficiency Principles Applied

1. **Defer LM review** — Core loop (run → check → task → verify) works with deterministic checks only. LM review is an *enhancement*, not a blocker.
2. **Verify in P1** — The acceptance test (`replay()` + `doNotEdit` + `PatchRiskClassifier`) is the *hardest part* and *most valuable*. Build it first.
3. **Manual promote first** — Write fixture file in P2; automate `scenario-profiles.ts` registration in P3.
4. **MCP minimal in P2** — Only 3 tools needed for external agent loop: `run`, `task`, `verify`.
5. **Export/replay last** — Pure UX for debugging/education; doesn't affect self-improvement loop.
6. **Consolidated tests** — P1 validates the *entire loop* (tests 1, 3, 5, 6, 7). P2 adds LM-specific tests (2, 4).

### 📋 Phase 1 Detail (Core Loop — 2 weeks)

| Week | Deliverables |
|------|--------------|
| 1 | `observe/` package, `schema.ts`, `programs.ts` (5 adapters), `record.ts` (Recorder), `run.ts` (`observeRun`), `checks.ts` (deterministic validators + literal/stall/ui/budget) |
| 2 | `task.ts` (emit + dedup + governance artifact), `verify.ts` (replay + `doNotEdit` git diff + `PatchRiskClassifier`), `cli.ts` (`observe run`, `observe list`), **integration test: full loop** |

**P1 Tests (5/7 passing):**
1. Non-perturbation ✅
3. Specificity ✅
5. Verify accepts real fix ✅
6. Verify rejects grader tampering ✅
7. Verify rejects fake fix ✅

### 📋 Phase 2 Detail (Intelligence — 1 week)

| Week | Deliverables |
|------|--------------|
| 3 | `review.ts` (`judgeBatch()` integration), `promote.ts` (fixture write + hardening suggestion), MCP tools (3 tools), failure-bundle hook |

**P2 Tests (2/7):**
2. Sensitivity (LM findings) ✅
4. Grounding + fail-closed (LM unavailable) ✅

### 📋 Phase 3 Detail (Polish — 1 week)

| Week | Deliverables |
|------|--------------|
| 4 | `diff.ts` (`diffRuns`, `bisect`), `export`/`replay` CLI, generated tours, `--publish`, auto scenario registration, drift gate |

**Total: 4 weeks, ~1,200 LOC** — but **working self-improvement loop at end of Week 2**.

---

## 15. Deliberately Out of Scope

LM cassettes / exact live replay; trained anomaly head + calibration/reputation; PerceptionGate/RewardGate admission and drive wiring; formal confirmation-correlate table; flight recorder + watchdog; held-out probe rotation; redaction/secret-scrubbing. Each earns its place only at unattended-autonomy scale; the task → verify → promote loop already closes the self-improvement cycle without them.

**Already exist (not built by observe):**
- Event log + replay (`LogStore`, `replay()`, `replayCognitiveState()`)
- Shadow worktree + CI (`ShadowWorktreeManager`, `runTestsInWorktree()`)
- Governance (`PatchRiskClassifier`, `GovernancePolicyEngine`, `ProposalRouter`, `SandboxValidator`)
- Approval (`ApprovalManager`, `GovernancePolicyEngine`)
- Scenarios (`runScenario()`, `ScenarioValidator[]`)
- System One (`SystemOneManifold.judgeBatch()`)
- Event schemas (`CognitiveEvent`, 48+ types)
- Self-tools (`apply_fix`, `run_tests_shadow`, `run_scenario_shadow`)
- MCP server (`src/mcp/`, `src/bin/lib/mcp/tools.ts`)
- CLI router (`src/cli/commands.ts`)

Observe is **~1,200 LOC of glue** connecting these 11 existing subsystems.

---

## 📎 Appendix: Quick Reference

### File → Function Map

| File | Exports | Reuses |
|------|---------|--------|
| `schema.ts` | `Finding`, `Verdict`, `RepairTask`, `CheckResult`, `EvidenceRef` | `zod`, `ulid` |
| `programs.ts` | `ObserveProgram`, 5 seed adapters | `ScenarioSpec` |
| `run.ts` | `observeRun(program, options)` | `runScenario()`, `Recorder` |
| `record.ts` | `Recorder` class | `EventBus`, `Playwright`, `node-pty` |
| `checks.ts` | `runChecks(bundle, spec)` | `ScenarioValidator[]`, `BudgetExhaustedEvent` |
| `review.ts` | `reviewBundle(bundle, spec, checks)` | `SystemOneManifold.judgeBatch()` |
| `report.ts` | `renderReport(bundle, verdict, checks)` | — |
| `task.ts` | `emitTask(bundle, verdict, checks)` | `GovernanceArtifactRegistry`, `PatchRiskClassifier` |
| `verify.ts` | `verifyTask(taskPath, worktree)` | `replay()`, `PatchRiskClassifier`, `git diff` |
| `diff.ts` | `diffRuns(a, b)`, `bisect(program, good, bad)` | `replayCognitiveState()`, frame hashes |
| `promote.ts` | `promoteRun(runId)` | `scenario-profiles.ts`, `GovernanceArtifactRegistry` |
| `cli.ts` | `observeCLI(argv)` | `senars` command router |

### Signature Format

```
Finding.signature = `${kind}:${expectationId ?? markId}`
CheckResult.checkId = `${checkKind}:${expectationId}`

Kinds: wrong-output | loop | stalled | broken-ui | narration-divergence | unmet-expectation
CheckKinds: validator | literal | stall | ui | budget
MarkIds: inject_0, inject_1, ... | contradiction_detected_within | min_derivations | ...
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Pass / accept |
| 1 | Findings ≥ warn or reject |
| 2 | Check failure (deterministic) |
| 3 | Uncertain (reviewer unavailable) |