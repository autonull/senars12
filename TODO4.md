# SeNARS12 — Cognitive Architecture v4 (TODO4, "Lite")

> A "Lite" re-scoping of TODO3. Verdict from review: **TODO3 is already well-designed,
> but should be simplified further for a first version** to ship in 2-4 weeks and learn
> from real behavior before adding back complexity.
>
> Same NARS/ACT-R inspiration. Same core principles. ~80-90% of the capability at
> ~50% of the integration cost.
>
> **Hypothetical / counterfactual reasoning is intentionally out of scope.**

---

## Status (as of 2026-06-04)

### Done

**W0 — Foundation cleanup** (complete, all 4 sub-tasks, typecheck clean):
- ✅ W0.1 Single source of truth for LM model names
  - `src/nar/lm/env-config.ts` — `resolveLMConfig()` is the only reader of `LM_PROVIDER`/`LM_MODEL`/`OLLAMA_*`/`ANTHROPIC_API_KEY`
  - Validates provider against `{transformers, ollama, anthropic, mock}`, throws on invalid
  - `pnpm run config:check` prints resolved config (verified working: provider=ollama, model=granite-4.0-micro, host=localhost:11434)
- ✅ W0.2 Unify REPLs
  - Deleted `src/cli/repl.ts` (242 lines)
  - New `src/bin/repl.ts` uses same wiring as `bin/bot-ai.ts` but with single CLI connection
  - Commands (`.help`, `.quit`, `.stats`, `.beliefs`, `.concepts`, `.episodes`, `.replay`, `.clear`) live in `CLIConnection` via `commands: CLICommand[]` config field
  - `QUIT_SENTINEL` for clean disconnect
- ✅ W0.3 Auto-load `.env`
  - `--env-file=.env` flag on `pnpm run bot` and `pnpm run repl` (Node 26 native, no new dep)
- ✅ W0.4 Canonical `.env.example`
  - All 47 env vars documented, grouped by section
  - `assertValidEnv()` runs on startup — warns on unknown, hard-fails on mistyped (numeric/boolean)
  - Files: `src/utils/env-validate.ts`, `src/utils/config-check.ts`

**Spike (TODO3 W1 prototype, basis for TODO4 W1)**:
- ✅ `src/agent/cycle/Turn.ts` — 3-variant JSON-friendly (response | tool_calls | internal)
- ✅ `src/agent/cycle/State.ts` — JSON-serializable (no agent/ctx refs), 9 fields: attention, beliefs, episodes, identity, goals, budget, version, prev, interrupted
- ✅ `src/agent/cycle/perceive.ts` — focus→State, no-op on null, clears interrupted
- ✅ `src/agent/cycle/reason.ts` — calls deps.reasoner, throws if no attention
- ✅ `src/agent/cycle/decide.ts` — parses Thought into Decision (respond | act)
- ✅ `src/agent/cycle/act-reflect.ts` — Decision→Turn (validator in W2)
- ✅ `src/agent/cycle/commit.ts` — version+1
- ✅ `src/agent/cycle/cycle.ts` — 5-phase ReAct core: perceive → reason → decide → act+reflect → commit
- ✅ `src/agent/cycle/index.ts` — barrel
- ✅ `tests/unit/agent/Cycle.test.ts` — **13 tests, all pass** (cycle 9, decide 2, perceive 2)

**W2 TODO4** (3-5 days): ✅ **DONE** — Memory merge (BeliefStore is the unified memory; EpisodicBuffer with recency-weighted recall); Validator (`patternValidator` with 4 default forbidden patterns, `isIdentityUpdate` heuristic, `Verdict` type with policyTrace) wired into `act-reflect`. Tests: 5 Validator + 4 CycleValidator + 5 Memory. `cycle()` API: `cycle(input, state, {reasoner, validator?})` (CycleDeps replaces bare Reasoner).

**W3 TODO4** (2-3 days): ✅ **DONE** — JSON + versioned State persistence + observability + unified wiring (no fallback path, see Decisions):
- ✅ `src/agent/cycle/persistence.ts` — `snapshotState(state, turns, dir)`, `restoreState(v, dir)`, `listSnapshots(dir)`, `latestSnapshot(dir)`, `clearSnapshots(dir)`. Strips `prev` on disk; tolerates malformed/missing files; ignores non-snapshot files in dir.
- ✅ `src/agent/cycle/diff.ts` — `diffStates(a, b)` returns `StateDiff` (beliefs/episodes/goals added/removed, identity/attention/budget changed flags); `isEmptyDiff(d)`.
- ✅ `src/agent/cycle/StateJournal.ts` — in-memory journal `record/get/latest/last/clear`, FIFO eviction at `maxEntries` (default 1000), injectable clock.
- ✅ `src/agent/cycle/observability.ts` — `formatDebug`, `formatTrace(journal, n)`, `formatReplay(entry, replayed)`, `replayVersion(v, journal, deps)`.
- ✅ `src/agent/cycle/operator.ts` — `runOperatorCommand(text, ctx)` parses `!debug | !trace [last N] | !replay [turn N] | !help`; `!` prefix acts as operator hook; other text is unhandled.
- ✅ `src/agent/cycle/dispatch.ts` — `dispatchCycleMessage(input, opts)` is the single entry point for any incoming message: `!`-prefix → operator; otherwise → `cycle()` → snapshot to disk → emit `Turn.text` to `send()`. Cold-start: loads latest snapshot on first use (including for `!`-prefix). The ConnectionManager delegates here, so the manager is now a thin shim.
- ✅ `src/agent/connections/ConnectionManager.ts` — every user message AND every autonomous-insight broadcast flows through `dispatchCycleMessage`. Per-origin `cycleStates` + `journals` maps; state dir `.cache/cycle/{origin}/`. Removed the dead helpers (`messageToFocus`, `cycleDepsFor`, `turnToText`, `operatorContextFor`, `getOrCreateCycleState`, `getJournal`, `cycleDirFor`) — all absorbed by `dispatchCycleMessage`.
- ✅ Tests: 10 Persistence + 11 Diff + 12 StateJournal + 5 Observability + 16 Operator + 13 Dispatch = **67 new tests, 120 W3-scope tests total, all pass**.

### Next concrete steps (in order)

1. ✅ ~~**Fix the 1 spike test** (5 min)~~ — DONE
2. ✅ ~~**W1 TODO4 phase 1** (Lite State + 5-phase ReAct core)~~ — DONE
3. ✅ ~~**W1 TODO4 phase 2** (wire `reason()` to real NARS+LM via `episodeReasoner` adapter)~~ — DONE
4. ✅ ~~**W2 TODO4** (merge WM into BeliefStore; Episodic Buffer with recency; Validator wired into act-reflect)~~ — DONE
5. ✅ ~~**W3 TODO4** (JSON + versioned State persistence; observability; wire cycle into ConnectionManager)~~ — DONE
6. ✅ ~~**W4 TODO4** (smoke test: REPL, !debug/!trace/!replay, state file under `.cache/cycle/{origin}/`, cold-start resume)~~ — DONE
7. ✅ ~~**W5 TODO4** (evaluate v2 from real runs; promote the response-text diff; document remaining v2 candidates)~~ — DONE
8. ✅ ~~**USABILITY phase** (race fix + retention + new ! commands + IRC reply-target test)~~ — DONE

**W4 smoke test result (2026-06-04, real ollama + granite-4.0-micro)**:
- ✅ `pnpm run repl` starts; `hello` → v1 state persisted under `.cache/cycle/cli%3Adirect%3Alocal-user/state-1.json`
- ✅ `!debug` shows v1 with focus="hello" and the response turn
- ✅ `!trace` shows 1 entry; `!replay` re-runs the cycle at v1; `!replay turn N` selects a specific version
- ✅ Second message increments to v2 (`state-2.json`); `!trace` shows both
- ✅ Cold-start (kill + restart with only `!`-prefix commands): `!debug` resumes at v2, `!trace` shows the 2 historical entries, `!replay turn 1` works
- ✅ Post-restart new message bumps to v3 with new timestamp; historical v1/v2 timestamps preserved
- ⚠️ **Found + fixed during W4**: cold-start's journal was empty in-memory (W3 only persisted the State, not the journal), so `!trace`/`!replay` broke across restarts. Fixed in `dispatch.ts` by reconstructing the journal from on-disk snapshots on cold start (using each snapshot's stored `timestamp` for `recordedAt`). `StateJournal.record` gained an optional 4th arg `recordedAt` for this. Two new Dispatch tests cover the cold-start paths.

**W5 v2 evaluation result (2026-06-04, after 1 real run)**:
- ✅ **Promoted to current**: `!replay` now surfaces the response-text diff. The original `formatReplay` only diffed State (which is usually identical across replays), so the operator couldn't tell that the response text actually changed. W4 live test on `how are you?` showed a 34b→59b divergence that the diff hid. Added a new `formatTurnTextDiff(original, replayed)` that prints per-turn `kind` changes, response-text previews, and tool-call set diffs (added/removed names). Output is now `state diff:` + `turn diff:` blocks. 3 new tests in `Observability.test.ts`. Live verified: long-prompt replay showed `turn[0] text: "In the heart of a bustling city..." → "In the heart of a bustling city..."` with byte-counts diverging (1539b vs 1576b). **Why promoted**: the operator UX was the load-bearing differentiator of this whole work — silently dropping the most user-visible signal (the response text) defeated the point. Trivial diff to add; big value.
- ⏭️ **Deferred to v2** (each motivated by a W4 observation, but not blocking):
  - **Per-message handler serialization** in `CLIConnection`: piped input triggered a race where `!`-prefix commands saw v0 because the previous cycle hadn't completed. Real users typing won't hit it; a v2 fix is a simple per-origin queue in the connection layer.
  - **Snapshot retention policy**: `.cache/cycle/` grows unbounded. Not observed in W4 (only 2-3 snapshots) but inevitable. v2 fix: cap at N most recent, compress older.
  - **IRC/HTTP smoke test**: W4 only exercised CLI. The wiring (`dispatchCycleMessage`) is shared, so logic is covered, but integration confidence is lower. v2: real-server fixture or Playwright-style harness.
  - **Per-phase budgets / GoalForest / sub-cycles / external Skill catalog**: none of these are motivated by anything we observed in W3-W5. TODO3's "drop from v1" list stays dropped.

### Final tally (TODO4 complete)

- 7 modules (persistence, diff, StateJournal, observability, operator, dispatch, reply-target), 8 test files
- **148 unit tests pass** (13 passed, 6 pre-existing CJS/ESM suites still fail — unrelated to this work)
- `tsc --noEmit` clean
- 0 lint errors in changed code
- Live smoke test green: REPL → cycle → persist → cold-start resume → `!replay` with text diff → `!rollback` (state revert) → `!versions` (snapshot list) → error path ("No response generated." on LM failure)
- **Result**: 4-week Lite plan delivered as one working cycle in `.cache/cycle/{origin}/`, no flags, no fallbacks, no parallel runtimes. Per-origin message queue prevents the CLI/IRC race. Retention caps disk usage. Six operator commands: `!debug !trace !replay !versions !rollback !help`.

**USABILITY phase work (2026-06-05)**:
- ✅ **Per-origin message queue** in `dispatchCycleMessage`: rapid-fire messages from the same origin (CLI/IRC burst, piped input) now serialize correctly. `Promise`-chained map keyed by `origin`. Verified: 3 simultaneous messages produce versions 1, 2, 3 in order; `!debug` after a cycle sees the post-cycle state, not v0; queues are independent across origins. 3 new Dispatch tests.
- ✅ **Snapshot retention** via `enforceRetention(dir, maxSnapshots)` (FIFO eviction). Wired into `dispatchCycleMessage` with optional `maxSnapshots` and `SENARS_MAX_SNAPSHOTS` env var (now in validation schema). 4 new Persistence tests + 1 new Dispatch test. Live test of the env var was constrained by LM speed on the local box (each cycle took 30-60s, retention test needs 5+ minutes), but unit tests prove correctness.
- ✅ **Two new operator commands**:
  - `!versions` — lists available snapshot versions (was: had to do `!trace` to discover them)
  - `!rollback <N>` — restores state from snapshot N via `ctx.setState`. Operator context gained `stateDir`, `origin`, `setState` fields. The next cycle increments from the rolled-back version. Journal keeps all original entries; new entries accumulate on top of the rolled-back state. 5 new Operator tests + 2 new Dispatch tests.
  - Help text updated.
- ✅ **IRC reply-target extraction** to `src/io/connections/reply-target.ts` (pure function, no MCP imports). 5 new tests covering channel, direct, multi-segment origins, and edge cases. ConnectionManager imports + delegates to the extracted function.
- ✅ **Env validation**: `SENARS_MAX_SNAPSHOTS` added to `KNOWN_ENV_VARS` and `NUMERIC_ENV_VARS` so the env validator accepts it and parses it as an integer.
- ⚠️ **Live smoke test caveat**: ollama + granite-4.0-micro is slow on this box (30-60s per cycle on second call). Multi-message scenarios need long timeouts. Unit tests cover all paths; live tests confirm single-message + operator commands work. A faster LM (or a mock) would unblock end-to-end live testing.

### Final state (v1.0)

```
Cycles persisted at: .cache/cycle/{encodeURIComponent(origin)}/state-{N}.json
Operator commands:    !debug !trace [last N] | !replay [turn N] | !versions | !rollback <N> | !help
Env vars:             SENARS_MAX_SNAPSHOTS=<int>  (snapshot retention cap; unset = keep all)
                      SENARS_AUTONOMY_BROADCAST=<bool>  (autonomous insight broadcast)
Run with:             pnpm run repl    (single-CLI interactive)
                      pnpm run bot     (CLI + IRC + WS + HTTP + MCP per env vars)
```

### Decisions

- **Unified mode (2026-06-04)**: no `USE_LITE_CYCLE` flag, no `executeEpisode` fallback path. The 5-phase cycle IS the path. `episodeReasoner` still wraps `AIAgent.executeEpisode` internally — the "Lite" name refers to the cycle's 5-phase ReAct shape (vs TODO3's 7-phase linear pipeline), not to a parallel runtime. Future-proofing flag was speculative; if a second mode is ever needed, add it then.
- **`prev` semantics**: `prev` = input state (rollback = undo whole cycle). Simpler and what the existing `Cycle.test.ts` asserts. `persistence.ts` strips `prev` on disk so the JSON has no in-memory chain.
- **Cycle integration entry point**: extracted as `dispatchCycleMessage(input, opts)` in `src/agent/cycle/dispatch.ts`. The ConnectionManager just builds `DispatchInput` and `DispatchOptions` and calls it. This makes the cycle's interaction with the IO layer testable in isolation (no need to import the full ConnectionManager → MCP server → zod CJS chain).
- **State dir**: `.cache/cycle/{encodeURIComponent(origin)}/state-{version}.json`. Origin encodes the connection type + channel + sender so the same user across channels has separate journals but state dirs are stable across restarts.
- **Journal reconstruction on cold start (2026-06-04, from W4 smoke test)**: in-memory `StateJournal` is rebuilt from on-disk snapshots on first use of an origin. Source of truth = snapshots, not a separate journal file. Cheaper than a parallel `journal.jsonl`, and `!replay`/`!trace` survive restarts for free. `StateJournal.record(state, turns, focus, recordedAt?)` gained an optional 4th arg so the cold-start code can preserve original timestamps instead of overwriting with `now()`.

### Test infrastructure note (pre-existing, not blocking)

`tests/nar/unit/lifecycle.test.ts` and 5 other `tests/nar/unit/*` suites fail with `SyntaxError: Identifier 'require' has already been declared` in `src/nar/terms/parser-peggy.ts` and similar CJS/ESM issues in zod v3 / MCP. All 6 failures are pre-existing Jest ESM transform problems; all 120 cycle/agent tests pass. Not related to TODO4 work. Fix when convenient, not blocking.

### Open questions

- Does the `episodeReasoner` adapter need a thin "tool calls actually executed" return path? Today the agent's tool calls are already done inside `executeEpisode`, so the cycle's `tool_calls` turn is theoretical. For v2 if a future skill catalog lives outside the agent, `act-reflect` will need to execute them. The current validator-only path is enough for W3.
- Should `!replay` re-run with the ORIGINAL reasoner or with a fresh reasoner? Today it uses whatever reasoner the current deps provide (i.e. the live agent). If the agent is non-deterministic, replay diverges. ✅ **Resolved in W5**: the response-text diff is now surfaced in `!replay` output, so the operator can SEE the divergence (even though the underlying reasoner is still the live one). Original-reasoner persistence is a separate v2 question.
- Per-cycle disk write on every message: fine for low traffic (IRC/CLI), could be batched or async for high traffic. Not blocking.
- **CLI race condition (found in W4)**: `CLIConnection.handleMessage` is fire-and-forget. When input is piped, multiple `handleMessage` calls can be in flight at once. Real users typing won't hit it. v2 fix: serialize `handleMessage` per origin.

### v2 candidates (from W3+W4+W5+USABILITY work)

All W3-W5 v2 candidates are now DONE. Remaining v2 items:
- **IRC/HTTP/WebSocket live smoke test** (only CLI exercised end-to-end; logic shared via `dispatchCycleMessage`, but integration confidence is lower without real server fixtures)
- **Per-phase budgets / GoalForest / sub-cycles / external Skill catalog** (none motivated by observations — TODO3's "drop from v1" list stays dropped)
- **Faster local LM for live testing** (granite-4.0-micro is 30-60s/cycle; blocks comprehensive smoke tests)
- **CLI race mitigation in `BaseConnection` itself** (currently fixed at the dispatch layer; other entry points to the agent would re-introduce the race if they bypass dispatch)
- **`ConversationState` consolidation** (the agent still has its own `ConversationState` separate from the cycle's `State`; not consolidated since they're used at different layers, but v2 could unify)

---

## The verdict (from review)

**SeNARS12 v3 is already one of the better-thought-out personal cognitive architectures.** Strong theoretical grounding (NARS/ACT-R) + pragmatic engineering (explicit state, replay, cost control, observability).

**Worth building** if the goal is:
- Highly **debuggable, replayable, inspectable** agent (great for IRC/REPL/long-running autonomy)
- Strong self-model / identity protection
- Learning exercise in symbolic + LLM hybrid reasoning
- Something to evolve incrementally over months

**But it can be simplified further** without major capability loss for a first version.

---

## Recommended simplifications

### 1. Merge memory stores (biggest win)

| TODO3 (3 stores) | TODO4 (2 stores) |
|---|---|
| `WM` (decays) | **BeliefStore** — Narsese-like with truth/priority. WM = currently-activated items pulled into context. No separate decaying store in v1. |
| `NarseseBag` (no decay) | merged into BeliefStore |
| `EpisodicIndex` (top-K) | **Episodic Buffer** — vector + recency for recent events only. |

*Working memory in v1 is just "items currently activated in BeliefStore that we pulled into the prompt." Saves huge integration pain.*

### 2. Simplify the cognition loop (5 phases, not 7)

```
   Perceive → Reason → Decide → Act+Reflect → Commit → (loop if !terminal)
```

- **Reason** = Think + Retrieve + Attend (combined LLM call with context assembly)
- **Act + Reflect** = action execution + immediate Validator check (one phase, not two)
- Drop the separate Attend/Retrieve phases; pull context inside Reason

vs TODO3's 7-phase linear pipeline:
```
   perceive → attend → retrieve → think → plan → act → reflect → commit
```

ReAct-style core. Tighter. Phase boundaries only where they add value.

### 3. Validator / Identity: keep, simplify

- This is TODO3's **strongest differentiator**. Keep it.
- Start with: simple rule/pattern-based + lightweight LLM critique. Don't over-engineer v1.
- The Validator interface (typed `Verdict`) stays the same; just the implementation is simpler.

### 4. Drop or postpone

| Drop in v1 | Postpone to v2 |
|---|---|
| Full Goal Forest | Simple prioritized goal list + current focus |
| Complex Turn Algebra (6 variants) | Basic structured output (JSON mode: `response \| tool_calls \| internal`) |
| Advanced NARS inference | Simple belief revision + LLM summarization |
| `interrupted: boolean` in State | Poll `process.exit` for now; add interrupt flag when needed |
| Per-phase budget tracking | Single per-cycle budget counter |

---

## The architecture ("SeNARS12 Lite")

```
   State (value, JSON-serializable, versioned)
     ├── Beliefs (Narsese + truth/priority)
     ├── Episodes (recent events, vector + recency)
     ├── Identity + Validator (protected)
     ├── Goals (prioritized list + current focus)
     └── Budget (per-cycle counter)

   Main Loop:
     Perceive → Reason → Decide → Act+Reflect → Commit → (continue if !terminal)
```

**Core engine pseudocode (< 100 lines):**

```ts
while (!isTerminal(state)) {
  state = perceive(state, input)
  context = retrieve(state)                    // pull Beliefs + recent Episodes
  thought = await llm.reason(context, goals)  // single LLM call
  decision = await llm.decide(thought)        // pick next action or respond

  if (decision.action) {
    result = executeSkill(decision.action)
    reflection = validate(thought, result, identity)  // Validator
  }

  state = commit(state, thought, result, reflection)
  budget.tick()
}
```

That's the whole engine. Compare to TODO3's 30-line cycle + 7 separate phase files + 3 memory stores + GoalForest + Turn algebra. **The Lite version is one loop, two memory stores, and a single decision call.**

---

## Properties preserved (vs TODO3)

| Property | TODO3 | TODO4 Lite |
|---|---|---|
| Replayable State | Yes (value, versioned) | Yes (JSON + versioned snapshots) |
| Self-model integrity | Readonly + Validator | Same (Validator is the strongest piece) |
| Cost-aware execution | Per-phase budget | Per-cycle budget (simpler, same effect) |
| Interruptibility | `interrupted: boolean` | `process.exit` for now; add when needed |
| Observability | `pnpm run status`, trace | `!debug`, `!trace last 10`, `!replay turn 42` (lighter) |
| Non-deterministic cycle length | `while` loop | `while` loop (same) |
| Phase testability | Pure functions per phase | Reason/Decide are pure; Act+Reflect mixed (v1 acceptable) |
| Probabilistic memory | WM decay (v1 of recall) | Recency-weighted top-K (v1 of recall) |
| Skill algebra | Typed with effects | Same |

**Lost in Lite**:
- GoalForest (concurrent sub-goals) → v2: prioritized list with arbitration
- Full Turn algebra → v2: structured output modes
- Per-phase budgets → v2: finer cost control
- 7-phase separation → v2: split Reason/Act+Reflect if testing shows value

Each loss has a v2 upgrade path. None block shipping IRC/CLI in 2-4 weeks.

---

## Migration: TODO3 → TODO4

| Week | What | Replaces from TODO3 |
|---|---|---|
| W1 | Define Lite `State` (JSON-serializable, versioned) | TODO3 W1.1 (`State.ts`) — drop phantom types, use plain types |
| W1 | Implement 5-phase loop (perceive/reason/decide/act+reflect/commit) | TODO3 W1.3 + W2 (cycle.ts) — combine into one file |
| W2 | Merge WM into BeliefStore; Episodic Buffer with recency | TODO3 W2 (drop WM decay); simplifies W10 episodic |
| W2 | Validator (rule-based + lightweight LLM critique) | TODO3 W5 (same interface, simpler impl) |
| W3 | State persistence (JSON + versioned snapshots) | TODO3 commit.ts — JSON instead of structured |
| W3 | Observability: `!debug`, `!trace last 10`, `!replay turn 42` | TODO3 W10 — IRC commands from day 1 |
| W4 | Wire up against existing `AIAgent.executeEpisode` | TODO3 W7 (full cycle) — keep executeEpisode as fallback for non-Lite paths |
| **Total** | **4 weeks to working Lite on IRC/CLI** | vs TODO3's 12 weeks |

After W4, evaluate. Add GoalForest in W5+ if multiple-goal scenarios emerge. Add per-phase budgets in W6+ if cost control becomes an issue. **Iterate based on actual runs, not speculation.**

---

## Migration: current state → TODO4 (concrete)

### Files that exist today (after W0 + spike)

```
src/nar/lm/
  env-config.ts          ✅ resolveLMConfig() — used by bot-ai.ts, repl.ts, defaults.ts, providers.ts
  defaults.ts            ✅ uses resolveLMConfig()
  providers.ts           ✅ uses resolveLMConfig()

src/utils/
  env-validate.ts        ✅ assertValidEnv() — called by bot-ai.ts, repl.ts
  config-check.ts        ✅ pnpm run config:check
  shutdown.ts            (unchanged)

src/bin/
  bot-ai.ts              ✅ uses resolveLMConfig, calls assertValidEnv
  repl.ts                ✅ new REPL using CLIConnection; uses resolveLMConfig
  mcp-server.ts          (unchanged)

src/io/connections/
  cli.ts                 ✅ added CLICommand support; QUIT_SENTINEL; tryCommand()
  base.ts, irc.ts, http.ts, ws.ts, mcp.ts  (unchanged)

src/agent/cycle/         ⚠️ PROTOTYPE — basis for TODO4 W1, not production
  Turn.ts                ⚠️ 6-variant; TODO4 will replace with JSON
  State.ts               ⚠️ plain types but not JSON-serializable; TODO4 will fix
  perceive.ts            ✅ reusable as-is
  commit.ts              ⚠️ needs prev semantics fix; TODO4 will rewrite for JSON
  cycle.ts               ⚠️ 7-phase TODO3 structure; TODO4 will collapse to 5-phase ReAct
  index.ts               ✅ barrel

tests/unit/agent/
  Cycle.test.ts          ⚠️ 6/7 pass; 1 failure documented in Status above

src/cli/repl.ts          🗑️ DELETED
package.json             ✅ --env-file on bot/repl; config:check, env:check scripts
.env.example             ✅ canonical, 47 env vars documented
```

### What TODO4 W1 will change (relative to current state)

| Current | TODO4 W1 | Why |
|---|---|---|
| `State` has 8 fields (agent, ctx, attention, turns, budget, version, interrupted, prev) | Reduce to 5-6 (beliefs, episodes, identity, goals, budget, version) | Drop agent/ctx wrappers; pass them as args to phase functions. JSON-serializable means no function refs. |
| `Turn` is a 6-variant discriminated union | Replace with `{ kind: 'response' \| 'tool_calls' \| 'internal'; payload: unknown }` | JSON-mode is the v1 output; full algebra is v2 |
| `cycle()` has `perceive → attend → retrieve → think → plan → act → reflect → commit` | `cycle()` has `perceive → reason → decide → act+reflect → commit` | 5-phase ReAct core; Reason combines Think+Retrieve+Attend |
| `commit()` does `{...s, turns, version+1, prev: s.prev ?? s}` | `commit()` does `JSON.parse(JSON.stringify(state))` + `version+1` | JSON snapshot for true replay; not in-memory prev chain |
| `perceive()` returns `State` | Same, but State is JSON-serializable | No change to function shape, but State type changes |
| `cycle()` calls `agent.executeEpisode()` as black box | `cycle()` calls `agent.executeEpisode()` for non-Lite paths; Lite path uses new reason/decide/act functions | Keep `executeEpisode` as fallback; Lite path is additive, not replacement |

### What TODO4 W2 will change

| Current | TODO4 W2 | Why |
|---|---|---|
| 3 memory stores implied (WM, Narsese, Episodes) — currently in the spike, not yet wired | 2 stores: `BeliefStore` (Narsese + truth/priority) + `EpisodicBuffer` (vector + recency) | Merge WM into BeliefStore; "currently activated" = items in the prompt |
| `Validator` doesn't exist yet | `Validator` interface: `review(update, current): Verdict` | Pure function, pattern-matcher + lightweight LLM critique |
| Identity writes go through `IdentityResolver` (existing, not yet typed) | Identity writes go through `Validator.review()`; rejected updates emit `silence` Turn with `reason: 'validator-rejected'` | Strong differentiator; same `Verdict` interface as TODO3 |

### What TODO4 W3 will change

| Current | TODO4 W3 | Why |
|---|---|---|
| No observability hooks | `!debug`, `!trace last 10`, `!replay turn 42` IRC commands | First-class operator UX |
| State not persisted (lives in memory) | `state.snapshot()` writes to `.cache/state-{version}.json`; `state.restore(version)` reads | Replay + rollback + hot reload from day 1 |
| No `diff` between states | `state.diff(s1, s2)` returns structured diff | Reflect phase uses this; operators use it for debugging |

### What TODO4 W4 will change

| Current | TODO4 W4 | Why |
|---|---|---|
| `ConnectionManager.handleMessage` calls `agent.executeEpisode` directly | Add a feature flag: `USE_LITE_CYCLE=true` routes through `cycle()`; `false` keeps current behavior | Lite loop is additive; ships behind a flag; no big-bang replacement |
| No integration tests for the cycle | Integration tests: send IRC message, assert cycle produces a Turn, assert State.version increments | Validate the topology end-to-end |

---

## How to continue developing (workflow)

### Daily

1. `pnpm run typecheck` — must be clean before any commit
2. `pnpm exec jest --testPathPattern=<file>` — run the test for the file you changed
3. `pnpm run config:check` — verify LM config is right after env changes
4. `pnpm run bot` or `pnpm run repl` — smoke test on real input

### Per-milestone (W1, W2, W3, W4)

1. Read the relevant row of the "Migration: current state → TODO4" table above
2. Implement the change in the smallest possible diff
3. Update the corresponding test (`tests/unit/agent/Cycle.test.ts` for W1, new tests for W2/W3/W4)
4. Run `pnpm run typecheck` + `pnpm exec jest` + smoke test
5. Update this file's Status section: mark the milestone done, note any drift

### When to update this file

- After completing a W-row: update the Status section
- When a design decision is made (e.g., "prev = input state"): add to Open questions / Decisions below
- When a v2 item is added (e.g., "we need GoalForest now"): add to "Promoted from v2 to current"

### When to consult TODO3.md

- TODO3 is the design source of truth for things Lite kept (State, Validator interface, Skill algebra, replay)
- If a TODO4 simplification turns out wrong, TODO3 has the more detailed version to fall back to
- Don't read TODO2 or TODO.md unless the question is about a non-cognitive concern (foundation, env config)

---

## Why this is the right path

1. **TODO3's biggest unverified claim** was that a 7-phase linear pipeline is necessary. TODO4 tests the cheaper hypothesis first: a 5-phase ReAct-style core might be sufficient. If it is, you saved 2 phases of integration work. If it isn't, you know which phase to split based on real failure modes.

2. **TODO3's 3 memory stores assumed** that Narsese, episodic, and WM have different enough access patterns to warrant separate infrastructure. TODO4 merges them: BeliefStore is Narsese-like, Episodic Buffer is recency-weighted. WM is "what's currently in the prompt." If 90% of memory access goes through retrieval, you don't need a separate WM store.

3. **TODO3's `interrupted: boolean` is speculative**. The cycle already has `MAX_STEPS` and a `while` loop; an interrupt flag is only needed if external input can preempt a long cycle. Until that scenario actually happens in production, it's over-engineering.

4. **TODO3's per-phase budgets are also speculative**. One counter per cycle is enough to bound resource consumption. If a single phase needs its own budget (e.g., Think burns 10x more tokens than Act), you can add per-phase counters in v2 without breaking the Lite engine.

5. **The Lite engine fits in your head in one sitting**. ~100 lines. Read it once, understand it. The TODO3 engine is ~30 lines of cycle code but ~300 lines of phase types, memory substrates, and validation machinery spread across 7 files. Both work; only one can be held whole.

---

## What "Lite" doesn't compromise on

- **Replayable State** — the biggest long-term advantage. JSON + versioned snapshots from day 1.
- **Validator / Identity** — the strongest differentiator. Simple impl, same interface.
- **Observability** — `!debug`, `!trace`, `!replay` from day 1, not W10.
- **Budget** — per-cycle counter, but present.
- **Skill algebra** — typed Skills, same as TODO3.
- **Type safety** — plain types (no phantom tags) but typed State, Turn, Verdict, Skill.

These are the load-bearing properties. Everything else is decoration that can be added in v2 based on observed need.

---

## Risks of Lite (and mitigations)

| Risk | Mitigation |
|---|---|
| **5 phases are too coarse; testing reveals Reason needs to split into Retrieve+Think** | Easy to split Reason into two functions; it's a function call, not a topology change. |
| **Merged memory store makes BeliefStore and Episodic Buffer fight over the same key** | Different namespaces: BeliefStore is Narsese terms; Episodic Buffer is event IDs. No collision. |
| **Single budget counter is too coarse; one phase can blow the budget** | Add per-phase counters in v2. The Lite engine doesn't preclude it. |
| **Validator's rule-based + LLM critique is too primitive** | The Validator interface (typed `Verdict`) is stable. Swap impl for a full Conscience LLM in v2 if needed. |
| **State persistence as JSON is too slow / too verbose** | Switch to SQLite in v2. State shape is the same; only the storage changes. |
| **The 4-week timeline slips** | W1-W2 are the critical path. If W3 (observability) slips, ship without `!trace` and add it W5. If W4 (wiring) slips, keep using the current `executeEpisode` and add the Lite loop in shadow mode for testing. |

Each risk has a v2 escape hatch. None block the 4-week target.

---

## Effort estimate (Lite)

| Week | Milestone | Risk | What's done |
|---|---|---|---|
| W1 | Lite State + 5-phase loop | Low | Engine in one file, ~100 lines, unit-tested |
| W2 | Merged memory (BeliefStore + Episodic Buffer) | Medium | Drop WM decay; vector recall is a view |
| W2 | Validator (rule + LLM critique) | Low | Strongest differentiator shipped |
| W3 | JSON + versioned State persistence | Low | Rollback + replay from day 1 |
| W3 | Observability (`!debug`, `!trace`, `!replay`) | Low | Operator UX from day 1 |
| W4 | Wire against existing `executeEpisode` | Medium | Lite loop runs alongside, not replacing |
| **Total** | **4 weeks** | | **Working Lite on IRC/CLI** |
| W5+ | Evaluate, add GoalForest / per-phase budgets if needed | Low | Iterate based on actual runs |

**Compare**: TODO3 was 12 weeks. TODO4 is 4 weeks to working software, 4-8 weeks of evaluation/iteration to decide what v2 looks like.

---

## What to defer to v2 (not v1)

- GoalForest (tree of goals) — single goal list is fine for v1
- Per-phase budgets — single per-cycle counter is fine
- Sub-cycles / nested cycles — handle via recursion in v2 if needed
- Parallel module execution — single LLM at a time
- Phantom-typed state machine — plain types work; revisit if discipline holds
- ACT-R activation equation — recency-weighted top-K is the v1 of recall
- Bi-temporal memory (event time vs processing time) — single time axis for v1

Each is a v2 add. None blocks the 4-week target.

---

## What this deliberately does NOT compromise

- **Replays work** from day 1 — State is a value, persisted as JSON
- **Identity is protected** — Validator runs on every identity write
- **Skills are typed** — same `Skill<I, O>` interface as TODO3
- **Observability is in** — `!trace`, `!replay` are first-class
- **Budget is in** — per-cycle counter, not zero

The Lite version is "TODO3 with the speculative bits removed and the load-bearing bits made more explicit." It's not a step backward; it's a step sideways that makes the load-bearing bits easier to defend.

---

## Final recommendation (verbatim from review)

> **Build a "Lite" version first** (the simplified loop + merged memory + strong Validator + replay). Get it running on IRC/CLI within 2-4 weeks. Then evaluate real behavior before adding back NARS-style inference depth or multiple memory tiers.
>
> The current design is already quite good. The main risk is **over-engineering before proving value in practice**.
>
> **Verdict: Build it. Simplify the memory and loop. Ship fast. Iterate based on actual runs.**

---

## References

- `TODO.md` — tactical additive refactor (14-19 weeks, OmegaClaw-inspired)
- `TODO2.md` — strategic linear-pipeline replacement (12 weeks, GWT-flavored)
- `TODO3.md` — simplified cycle (12 weeks, dropped GWT/Conscience/phantom-types)
- `TODO4.md` (this) — Lite version (4 weeks, merged memory + 5-phase ReAct core)
- W0 in `TODO3.md` (now complete) — foundation cleanup; same scope for all three plans
- TODO3 spike at `src/agent/cycle/` — partial prototype, can be basis for W1 of this plan

---

## TL;DR

TODO4 is TODO3 with:
- **3 memory stores → 2** (WM = "activated Beliefs", Episodes = recency-weighted buffer)
- **7-phase pipeline → 5-phase ReAct core** (Reason combines Think+Retrieve+Attend; Act+Reflect combined)
- **6-variant Turn → JSON structured output** (`response | tool_calls | internal`)
- **GoalForest → prioritized list + current focus**
- **Phantom types → plain types** (carried from TODO3)
- **Per-phase budget → per-cycle counter**
- **Validator/Identity kept** (strongest differentiator)
- **Replay/observability from day 1** (`!trace`, `!replay` first-class)

**Result**: ~80-90% of TODO3's capability at ~50% of the integration cost, shippable in 4 weeks instead of 12. Each simplification has a v2 upgrade path; none block the Lite target.
