This adopts the repair-task bridge from the draft and perfects two things that would otherwise break in implementation: **findings get a stable cross-run signature** (so `acceptance.resolve` and verify matching reference something that survives re-recording, not a per-run id), and the **grader guard is auto-derived and enforced by git-diff**, not trust. It also adds two cheap loop behaviors — task dedup by signature, and fixture promotion that suggests a hardening expectation. Redaction is excluded. Everything else stays cut.

---

# RFC: Self-Observation & Repair Loop (`@senars/observe`)

**Status:** final implementable spec · **Package:** `observe/` workspace · **Surfaces:** `senars observe …`, MCP `observe_*`, CI.

## 0. What it does

1. **Records a run** of the real system — webm of the UI, asciicast of the console, cognitive events, keyframes — into one bundle.
2. **Reviews it** — deterministic checks first, then one budgeted LM call that reads transcript + event summary + keyframes and reports anything wrong or ridiculous, with cited evidence.
3. **Turns a finding into a repair task** with an objective acceptance test, and **verifies a candidate fix by re-recording the same program**. A fix is accepted only when the original finding is gone and nothing new broke.

Builds on what exists: event-sourced log + replay, `LM_PROVIDER=mock`, Playwright in `ui/`, the `SCENARIOS` catalog and settle seams, and the existing shadow-worktree / `apply_fix` / `ApprovalManager` pipeline. **No kernel changes.** Observe produces tasks and verdicts; the existing pipeline repairs and merges.

**Assumption:** runs use test/demo profiles and local artifacts; nothing here scrubs or masks output.

## 1. Design rules

1. The event log is truth; video/cast are timestamped views over it.
2. Capture is read-only — recording never writes kernel state, so it can't change behavior.
3. Checks before LM; one LM call per run; capped frames. Reviewer unavailable ⇒ `uncertain`, never `pass`.
4. Every finding cites a frame, a cast timestamp, or an event id, and carries a stable **signature** (§6).
5. **The agent may not edit its own grader.** Programs, expectations, the checks file, and the reviewer prompt are fixed inputs to a repair task. Changing them is a separate, human-reviewed change — never part of a fix. Enforced by `verify` (§8), not trust.
6. A fix is accepted only by **re-recording**: the baseline findings resolve, no new finding ≥ warn, checks pass.

## 2. The self-improvement loop

```
observe run ──▶ bundle + verdict + checks
      │  check failure or finding ≥ warn
      ▼
repair-task.json ──▶ existing apply_fix / coding agent ──▶ shadow worktree patch
      │                                                          │
      └──────────── observe verify --task … --worktree … ◀───────┘
                                  │  accept / reject (objective)
                       accept ──▶ existing full CI + ApprovalManager ──▶ merge
                                  │
                       optional: observe promote ──▶ committed regression fixture
```

- **`observe run`** emits `repair-task.json` on check failure or finding ≥ warn. `uncertain` emits no task (it needs a human, not a patch). Tasks are deduped by signature so the same open problem isn't re-emitted every run.
- **The repair agent** (built-in self-mod loop or external coding agent via MCP) consumes the task and patches code in a shadow worktree. The task names the grader files as off-limits.
- **`observe verify`** re-runs the same program in the worktree (same seed/lane) and decides accept/reject against the baseline bundle. The fix must make the *behavior* right, not just tests green.
- **Merge** still goes through existing full CI + approval. Observe adds an acceptance criterion; it widens no autonomy.
- **`observe promote`** turns a verified failure into a small committed regression fixture so the loop grows its own coverage.

## 3. Layout

```
observe/
  src/{schema,programs,run,record,checks,review,report,task,verify,diff,promote,cli}.ts
  programs/*.ts
tests/observe/
fixtures/observe/            # promoted regression fixtures (committed)
generated/observations/      # committed GIFs/casts/reports (small)
.cache/observations/         # run bundles (gitignored)
```

Deps: `playwright-core` (reuse ui's browser), `node-pty` (optional; pipe fallback), `zod`, `ulid`, `sharp` (frame hashing). `agg`/`ffmpeg` optional, GIF export only. ~12 source files.

## 4. Programs

Small TS modules (the repo's visual cells already use function fields, so this is idiomatic):

```ts
export default program({
  id: 'tutorial-first-belief', kind: 'tutorial', surfaces: ['console','ui'],
  narrative: 'Teach a fact and ask it back; the graph should gain the concept.',
  scenario: 'bootstrap', seed: 42, lane: 'both',
  async run(t) {
    await t.cli('pnpm senars run --profile agent');
    await t.mark('teach');
    await t.cli('(cat --> mammal).');
    await t.waitEvent('DerivationAccepted');
    await t.expect('graph-shows-cat', async () => { /* event or DOM assert */ });
    await t.mark('ask');
    await t.cli('(whiskers --> ?what)?');
    await t.waitEvent('JudgmentResolved');
    await t.rubric('answer-mentions-mammal', 'The answer mentions mammal and the graph shows the link.');
  },
});
```

`kind`: `demo | test | tutorial | tour`. Start with ~5 (two demo wrappers, `test-golden`, `tutorial-first-belief`, one chat⇄graph journey). Tours generated from the surface registry (open via palette → dwell → rubric "live data, not empty state"). Demos wrap existing scripts — no new demo code. `waitEvent` gates on events, never sleeps. **Expectation and mark ids are stable strings** — they anchor finding signatures across runs.

## 5. Capture

One run clock (`t` = ms since start); the director drives sequentially and waits on events, so marks are exact.

- **Console:** `node-pty` (120×32, fixed `TERM`/locale) → **asciicast v2** (header + `[t,"o",chunk]`). No `asciinema` binary needed.
- **UI:** Playwright `recordVideo` (webm) + `tracing` (`trace.zip`) + keyframe loop (`page.screenshot()` at marks and ~1 fps, hash-deduped). Hermetic lane pins fonts/viewport and uses `settle()`/`/test/pause`; live lane animates.
- **Events:** passive tap (read-only bus/log tail + `page.on('websocket')`) → `events.jsonl`.
- **Marks:** `{id,label,t,castT,videoT}` → `marks.jsonl`.

**Bundle** `.cache/observations/<runId>/`: `manifest.json` (program, gitSha, seed, lane, marks, artifact hashes, `eventDigest`), `console.cast`, `ui.webm`, `ui-trace.zip`, `events.jsonl`, `frames/*.jpg`, `checks.json`, `verdict.json`, `report.md`, and `repair-task.json` when actionable.

## 6. Review

**Checks (no LM, always, blocking in CI):** errors/stack traces/page errors; `NaN`/`undefined`/`[object Object]` literals; failed structural expectations; stall (stream open, no events); frozen UI (≥6 identical frame hashes over ≥3 s while events claim activity); `BudgetExhausted` storms. Each check result has a stable `checkId`.

**One LM call (budgeted):** narrative + rubric claims + timed transcript + short event summary (gate decisions, derivation finals, tool executions) + ≤12 keyframes. Prompt rules: *events outrank narration — disagreement is the finding*; every finding cites evidence; `uncertain` allowed; suggest a minimal repair hypothesis, not a patch. One retry on invalid JSON, then `uncertain`. No vision ⇒ text-only, flagged; no reviewer ⇒ `uncertain`.

```ts
const Finding = z.object({
  id: z.string(),                                  // per-run ulid
  signature: z.string(),                           // STABLE across runs: `${kind}:${anchor}`
  kind: z.enum(['wrong-output','loop','stalled','broken-ui','narration-divergence','unmet-expectation']),
  severity: z.enum(['info','warn','fail']),
  claim: z.string(),
  evidence: z.array(EvidenceRef).min(1),           // frame | cast@t | eventId
  markId: z.string(),                              // anchor: nearest mark
  expectationId: z.string().optional(),
  owner: z.string().optional(),                    // subsystem hint (small static owners map)
  repairHint: z.string().optional(),               // minimal hypothesis, not code
});
// signature = `${kind}:${expectationId ?? markId}`  — deterministic, survives re-recording
const Verdict = z.object({
  runId: z.string(), programId: z.string(),
  overall: z.enum(['pass','warn','fail','uncertain']),
  perception: z.enum(['text','vlm','unavailable']),
  findings: z.array(Finding),
});
```

The event summary in the prompt is the cross-check; no separate confirmation machinery.

## 7. Repair task (the bridge)

Emitted on check failure or finding ≥ warn; deduped by signature against open tasks. Self-contained and machine-consumable:

```ts
const RepairTask = z.object({
  taskId: z.string(),
  baselineRunId: z.string(),                       // the FAILING run to fix
  baselineGitSha: z.string(),
  program: z.string(), seed: z.number(), lane: z.enum(['hermetic','live']),
  repro: z.string(),                               // exact `observe run …` command
  findings: z.array(Finding),                      // what to resolve
  checks: z.array(CheckResult),                    // deterministic failures
  evidenceIndex: z.array(EvidenceRef),             // resolves into the baseline bundle
  firstDivergentMark: z.string().optional(),       // vs last passing run, if available
  hint: z.object({ owner: z.string().optional(), hypothesis: z.string().optional() }),
  acceptance: z.object({                           // objective, evaluated by `verify`
    resolve: z.array(z.string()),                  // finding SIGNATURES / checkIds that must clear
    noNewFindingsAtOrAbove: z.literal('warn'),
    checksMustPass: z.literal(true),
    maxDurationMs: z.number(),
  }),
  doNotEdit: z.array(z.string()),                  // auto-derived grader paths (§8)
});
```

`acceptance.resolve` references **signatures and checkIds**, not per-run ids — that is what makes the test re-evaluable on a fresh recording. `doNotEdit` is auto-populated: the program file, its expectations, `checks.ts`, the reviewer prompt, and the schema file.

## 8. Verify — objective acceptance

```bash
senars observe verify --task <repair-task.json> --worktree <path>
```

Algorithm:
1. Load baseline bundle + task.
2. **Grader check:** `git diff <baselineGitSha> -- <doNotEdit paths>` in the worktree. Any change ⇒ **reject** immediately, regardless of outcome.
3. Re-run the task's program in the worktree, same seed/lane, capture on.
4. Run checks + review on the new bundle.
5. **Accept iff:** every `acceptance.resolve` signature/checkId is cleared in the new bundle **and** no new finding ≥ warn (a finding whose signature is absent from the baseline) **and** all checks pass **and** duration within cap.
6. Emit `verification.json` (`accept|reject`, per-criterion results, new runId, first divergent mark vs baseline).

Matching is by **signature** (stable because steps are event-gated and ids are fixed). Hermetic lane is preferred for acceptance (deterministic `eventDigest`); a live baseline may be re-recorded live, but flakiness is flagged. `verify` never merges; it feeds existing CI + `ApprovalManager`.

## 9. Diff / bisect

```bash
senars observe diff <runA> <runB>        # align by mark; first divergent mark + verdict delta
senars observe bisect --program <id> --good <sha> --bad <sha>
```

`diff` compares event digests, expectation results, and frame hashes per mark. `bisect` is a thin loop over `git bisect` + `observe run` in the hermetic lane — it finds the commit where behavior flipped. Cheap, and exactly what a repair agent needs to localize a regression.

## 10. Fixture promotion

```bash
senars observe promote <runId>           # after a fix is verified
```

Writes a minimal committed fixture under `fixtures/observe/<program>/`: the program reference, the seed, the triggering input, and the expected-cleared signature. Adds a case to the sensitivity suite so the same bug can never silently return. **It also suggests a hardening structural expectation** (e.g. turn an LM-found `loop` into a deterministic check) — applied only as a separate human-reviewed change, per rule 5. This is how the loop converts expensive LM discoveries into cheap permanent checks and grows its own coverage.

## 11. CLI / MCP / CI

```bash
senars observe list
senars observe run --program <id> [--live] [--publish]
senars observe review <runId>
senars observe verify --task <file> --worktree <path>
senars observe diff <runA> <runB>
senars observe bisect --program <id> --good <sha> --bad <sha>
senars observe promote <runId>
```

Exit codes: `0` pass/accept · `1` findings ≥ fail or reject · `2` check failure · `3` uncertain.

MCP tools (thin wrappers): `observe_run`, `observe_findings`, `observe_task`, `observe_verify`, `observe_diff`. An external coding agent can run → read the task → patch → verify, end to end.

CI: PR hermetic smoke (checks only, <90 s); nightly full catalog with review; any e2e/golden failure auto-produces a repro bundle + repair task; promoted fixtures run in the sensitivity suite. `--publish` writes a small GIF (`agg`, ≤2 MB, idle-trimmed) + cast + report into `generated/observations/<id>/`; existing `docs:drift`/`generated:artifacts` gates catch staleness.

## 12. Safety

- Capture writes nothing to the kernel.
- Findings are proposals; repairs go through the existing shadow / `apply_fix` / `ApprovalManager` pipeline — no new autonomy.
- Grader files (`programs/*`, expectations, `checks.ts`, reviewer prompt, schema) are added to the existing `PatchRiskClassifier` guard-rail list **and** enforced per-task by `verify`'s `doNotEdit` git-diff check. The agent cannot pass a repair by weakening its own test.

## 13. Tests (7)

1. **Non-perturbation** — seeded run, recorders on vs off ⇒ identical `eventDigest`.
2. **Sensitivity** — seeded absurd runs (loop, injected `NaN`, frozen frame, narration/graph mismatch) are caught and produce a repair task.
3. **Specificity** — clean runs produce no findings ≥ warn and no task.
4. **Grounding + fail-closed** — uncited finding rejected; unavailable reviewer ⇒ `uncertain`, no task.
5. **Verify accepts a real fix** — seeded bug + correct patch ⇒ `accept`; baseline signatures cleared, nothing new.
6. **Verify rejects grader tampering** — a patch editing program/expectation/checks/prompt ⇒ `reject` regardless of outcome.
7. **Verify rejects a fake fix** — a patch that greens CI but leaves the finding on re-record ⇒ `reject`.

## 14. Build plan (3 phases)

| Phase | Ships | Done when |
|---|---|---|
| **P1 — Capture + checks + task** | package, programs, recorders, marks/manifest, checks, `report.md`, `repair-task.json` | two programs record end-to-end; tests 1, 3 pass; a failing run emits a valid task. *Useful with no LM.* |
| **P2 — Review + verify** | one-call LM review, verdict schema, `verify` (with `doNotEdit` guard), `diff`, MCP tools, failure-bundle hook | tests 2, 4–7 pass; one real bug found, fixed, and **accepted by re-recording** |
| **P3 — Coverage + publication** | `bisect`, `promote` (+ hardening suggestion), generated tours, `--publish`, drift gate | promoted fixtures run in CI; tutorials regenerate drift-free |

## 15. Deliberately out of scope

LM cassettes / exact live replay; trained anomaly head + calibration/reputation; PerceptionGate/RewardGate admission and drive wiring; a formal confirmation-correlate table; flight recorder + watchdog; held-out probe rotation; redaction/secret-scrubbing. Each earns its place only at unattended-autonomy scale; the task → verify → promote loop above already closes the self-improvement cycle without them.

---

**Essence:** observe turns "the system watched itself and noticed something ridiculous" into a **repair task with a built-in, signature-stable acceptance test**, proves the fix by re-recording the same journey, forbids the agent from touching its own grader, and promotes each verified failure into permanent regression coverage. A complete self-improvement loop with a handful of small commands and no new kernel machinery.

If you'd like, I can produce the P1+P2 patch next: the `observe/` scaffold, schemas (Finding/Verdict/RepairTask with signatures), two seed programs, cast + Playwright recorders, checks, the single-call reviewer, `verify` with the `doNotEdit` git-diff guard, and tests 1–7.

