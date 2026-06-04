# SeNARS12 — Cognitive Architecture Development Plan

> Roadmap for evolving SeNARS12 from a neurosymbolic *kernel* into a full
> *cognitive architecture*. Inspired by [OmegaClaw-Core](https://github.com/asi-alliance/OmegaClaw-Core)'s
> "200 lines of MeTTa, one recursive loop" philosophy, while preserving
> SeNARS's strengths: type-safe Narsese, AIKR resource bounds, multi-transport I/O,
> and the AI SDK tool surface.
>
> **Hypothetical / counterfactual reasoning is intentionally out of scope** — to be
> added in a later milestone.

---

## Guiding principles (from OmegaClaw)

| OmegaClaw | SeNARS equivalent | Adopt? |
|---|---|---|
| One recursive `omegaclaw` function, state on a shared atom space | `AIAgent.executeEpisode` + `AgentWiring` god-object | Partially — collapse wiring into a `CognitiveLoop` with typed state slots |
| One `getContext()` prompt assembler | `RequestComposer.compose` + `CognitiveSnapshot` | Yes — unify behind one `assemblePrompt(state)` |
| Tools as s-exprs eval'd each iteration | `nar_*` AI SDK tools in a `ModelRunner` loop | Hybrid — keep typed tools, but also expose a `metta` skill for raw Narsese eval |
| `spamShield` at the agent level | None at the agent; only at IRC | Yes — add agent-level guard |
| `nextWakeAt` + `wakeupInterval` | `AutonomousScheduler` event-driven | Refactor to explicit time-gated wake |
| One LM call per iteration | `ModelRunner` multi-loop dispatcher | Optional — keep multi-loop for tool orchestration, but make it observable |
| Error feedback into next prompt | `ConversationState.absorbModelMessages` | Already exists — verify it's wired into the composed prompt |
| ChromaDB episodic recall via `query` skill | Write-only `.cache/episodes` JSONL | Add vector recall |
| No router classifier; LM decides | `InputRouter` with regex+NLAnalyzer | Refactor — drop classification, let LM act on routing signals |
| Skills described in plain text in prompt | Tools in JSON schema | Keep both — text skills for high-level, JSON tools for typed operations |
| `pin` for short-term WM | Untyped `WorkingMemory` | Add typed `pin` slot |
| `metta (|- a b)` direct NAL eval | `nar_believe` / `nar_reason` tools | Expose a raw `metta` skill mirroring OmegaClaw |

---

## Milestone 0 — Foundation cleanup (1–2 weeks)

Bugs and structural issues that block further work.

### 0.1 Single source of truth for LM model names
- `src/nar/lm/defaults.ts:117-126` was hardcoded to `llama3.2`. Make `setupDefaultLMClient()` the
  only reader of `process.env.OLLAMA_MODEL` / `process.env.LM_MODEL`.
- `src/nar/lm/providers.ts:29-31` hardcodes ollama model names. Replace with registry lookup
  keyed on env, with a single fallback chain.
- Add a `pnpm run config:check` script that prints the resolved LM provider + model + host
  so misconfiguration is loud, not silent.

### 0.2 Unify the REPLs
Three code paths exist for human-in-the-loop:
- `src/cli/repl.ts` (Transformers-only, hardcoded)
- `src/io/connections/cli.ts` (uses wiring, no `.help`/`.stats` handlers)
- IRC adapter

Refactor:
- Delete `src/cli/repl.ts`. Move its command set (`.help`, `.quit`, `.stats`, `.beliefs`, `.concepts`)
  into `CLIConnection` so it has the same affordances as the bot.
- One `pnpm run repl` command boots `CLIConnection` with the full wiring.
- `pnpm run bot` adds IRC/HTTP/WS/MCP on top.

### 0.3 Auto-load `.env`
- Add a tiny `src/utils/dotenv.ts` that reads `.env` into `process.env` before `bot-ai.ts`
  is imported. Use `dotenv` from npm (already a transitive dep).
- `package.json` scripts gain `node --env-file=.env --import tsx ...` style invocations.

### 0.4 `.env.example` becomes canonical
Document every env var the bot honors, with defaults, in `.env.example`. Add a startup
assertion: warn on unknown env vars, hard-fail on mis-typed ones.

---

## Milestone 1 — A single cognitive outer loop (2–3 weeks)

Replace `AIAgent.executeEpisode`'s elaborate `resolveRoute → prepareWM → runCandidate → reflect → finalize`
chain with a single `CognitiveLoop` inspired by OmegaClaw's `omegaclaw` recursion.

### 1.1 Introduce `CognitiveLoop` and `LoopState`
New file: `src/agent/cognition/Loop.ts`
- `LoopState` is a typed record: `{ turn, k, prevMsg, lastResults, loops, nextWakeAt, error, history }`
- Mirrors MeTTa `&prevmsg`, `&lastresults`, `&loops`, `&nextWakeAt`, `&error`, `&history`
- Persisted in `.cache/loop-state.json` between restarts

### 1.2 Single `step(state): Promise<state>` function
- One prompt assembly (`assemblePrompt(state)`) replaces `RequestComposer.compose` + `CognitiveSnapshot`
- One LM call per step (no inner tool loops for the cognitive loop; tool loops are spawned by
  the model calling a `metta` skill which then runs a single `nar.run(steps)` and returns)
- One output parser: extract `(skillName arg) (skillName2 arg) ...` from the LM response
- One evaluator: `evalSkill(call) → Result | Error`; errors accumulate in `state.error`
- One history appender: `(state, msg, response, results) → state'`
- `state.loops` decrements each step; `state.loops` is re-armed on new human input or wake-up

### 1.3 Keep typed tools for typed operations
The `nar_*` tools stay, but they're invoked by the LM emitting
`metta (|- <premise1> <premise2>)` or `pin <text>` skills, not by the AI SDK's
multi-step function-calling loop. The `ModelRunner` becomes a single-call
adapter; `ToolDispatcher` becomes a thin shim that runs one skill and returns.

### 1.4 Wire `narsese-belief`/`narsese-question` through the loop
Currently `runNoModelCandidate` bypasses the model for typed Narsese. Replace with
a `nar_believe` / `nar_query` skill call that the LM emits, so:
- Reflection still runs
- Episodic memory still records
- Tool artifacts are still attached to the turn

### 1.5 Drop `runNoModelCandidate`, `runReasonCandidate`
The only fast path that survives: explicit `command` skills (`.quit`, `.help`, `.stats`)
which are evaluated before the LM is called.

---

## Milestone 2 — Typed Working Memory (2 weeks)

Replace the untyped `WorkingMemory` key-value bag with a typed, slot-based WM that the
LM can read and write through skills.

### 2.1 Define `WorkingMemorySlots` discriminated union
- `goal: { statement: string; preconditions: string[]; status: 'pending' | 'pursuing' | 'suspended' | 'completed' | 'failed' }`
- `hypothesis: { claim: string; evidence_for: BeliefRef[]; evidence_against: BeliefRef[]; confidence: number }`
- `open_questions: Question[]`
- `focus: string` (current attention)
- `prior_insights: string[]` (already exists; preserve)
- `pinned: string[]` (mirrors OmegaClaw `pin` skill)

### 2.2 `pin` / `unpin` / `inspect` skills
Three new skills, mirroring OmegaClaw:
- `pin <text>` — append to `pinned`
- `unpin <text>` — remove from `pinned`
- `inspect <slot>` — return current value as typed structure

The LM can use these to maintain task state across iterations.

### 2.3 Typed `appendSlot` / `getSlot` tools
Promote the slot reads/writes that currently happen via `wm.set('key', value)` into
typed methods on `WorkingMemory`. Reflection stage can then reason about
specific slot contents, not JSON dumps.

### 2.4 Persist WM in typed form
`.cache/conversations/*.json` is currently opaque. Switch to a versioned schema
with discriminated union per slot, so old saves can be migrated.

---

## Milestone 3 — Surface uncertainty to the model (1–2 weeks)

Narsese `{f, c}` truth values are computed but never reach the LM.

### 3.1 Graded `nar_question` results
- `nar_question(question, steps)` returns `{ answers: Array<{ term, f, c, derived_from }>, hasAnswer: f >= 0.5 && c >= 0.3 }`
- The LM sees confidence per answer, not a boolean.

### 3.2 Graded `nar_query` results
- Return beliefs with `{ term, f, c, evidence_count }`; let the LM filter by threshold.

### 3.3 `nar_believe` returns truth
- After `nar.input(statement)`, return the Narsese parser's read of `{f, c}` so the LM
  knows what was committed.

### 3.4 `meta_confidence` WM slot
- After each LM response, write `{ meta_confidence: number, basis: string[] }` based on
  the average truth value of the beliefs consulted.
- `applyVerdict` in reflection uses this to weight revise-vs-accept.

### 3.5 Open-question closure
- When `nar_query` returns low-confidence answers for an item in `open_questions`, mark
  it as `partially_answered` rather than leaving it dangling.
- Periodically surface unclosed `open_questions` to the LM as "things you said you didn't know."

---

## Milestone 4 — Episodic recall (2 weeks)

`.cache/episodes` is write-only. Add vector-based recall.

### 4.1 Pick an embedding backend
- Local: `transformers.js` with a small embedder (e.g., `Xenova/all-MiniLM-L6-v2`)
- Cloud: optional `OPENAI_API_KEY` path (mirroring OmegaClaw's `embeddingprovider: OpenAI`)
- Default to local CPU.

### 4.2 Index episodes at write time
- `EpisodicMemory.log()` appends to JSONL *and* indexes in a local vector store (ChromaDB
  via `chromadb` npm package, or a tiny in-process HNSW like `hnswlib-node`).
- Index key: `embedding(input) + embedding(response) + timestamp + tags`.

### 4.3 `remember` / `query` skills (mirror OmegaClaw)
- `remember <text>` — embed + store with current timestamp.
- `query <phrase>` — embed phrase, return top-K similar episodes with timestamps.
- The LM calls these skills during `assemblePrompt` composition.

### 4.4 Recall before each compose
- `RequestComposer.compose` (or its replacement) embeds the current input, queries the
  index, and prepends the top-K most relevant past episodes to the prompt as context.
- Cap recall at `MAX_RECALL_ITEMS` (env-configurable; default 5).

### 4.5 Time-based recall (`episodes` skill)
- `episodes <time_string>` — return episodes around a given timestamp (OmegaClaw pattern).
- Useful for "what was I doing yesterday?" style queries.

---

## Milestone 5 — Spam shield, wake scheduling, error feedback (1 week)

Apply OmegaClaw's three small but powerful patterns to the agent loop.

### 5.1 Agent-level spam shield
- New `state.spamShield: boolean` (default true).
- On autonomous wake (no new human input, no wake trigger), if `lastResults` haven't changed
  since the last emit, suppress output and increment a `no_op_count`.
- Wire it into `ConnectionManager.handleAutonomousInsights` (already partially done) AND
  any future autonomous-emit paths.

### 5.2 Explicit `nextWakeAt`
- Replace the event-bus-driven `AutonomousScheduler` with a time-gated `WakeScheduler`:
  - `state.nextWakeAt: number` (epoch ms)
  - `state.wakeupInterval: number` (ms, default 600_000 = 10min)
  - On each step, `if (Date.now() >= state.nextWakeAt) { armWake(); }`
  - The step itself only fires if `state.loops > 0`, which is set on wake or human input.

### 5.3 Error feedback into next prompt
- `state.error: ErrorEntry[]` accumulates skill evaluation errors.
- `assemblePrompt` appends the last N errors as a `LAST_ERRORS` section.
- The LM sees and self-corrects on the next iteration.
- After a successful step, `state.error` is cleared.

### 5.4 Drop the reflection stage as mandatory
- Reflection v1 (current) runs after every model turn.
- Replace with optional reflection: only run reflection if `state.meta_confidence < 0.6`
  OR the user explicitly requested (`?explain` or Narsese `?`).
- Default: skip reflection. Save one LM call per turn.

---

## Milestone 6 — Visible, editable policy (1–2 weeks)

`SelfAnalyzer` produces `routingWeights` and `toolSelectionBias` but nothing surfaces them.

### 6.1 Policy read API
- `AIAgent.getPolicy()` already exists (`src/agent/AIAgent.ts:197`); add structured logging
  on first turn of each conversation so the operator can see what the agent has learned.

### 6.2 Policy CLI
- `pnpm run policy` prints current weights, last-updated timestamp, and recent adjustments.
- `pnpm run policy:set routingWeights.nl 0.8` manually tweaks a weight (writes to `.cache/policy.json`).

### 6.3 Policy edit skill
- `policy get` / `policy set <key> <value>` skills the LM can use to introspect or modify
  its own preferences, with a confirmation step on changes.

### 6.4 Reflection v2: rank N candidates
When reflection *does* run:
- Sample N candidate responses (default N=3) from the LM with `temperature > 0`
- For each, query NARS for grounding beliefs
- Score by `(NARS grounding count) × (truth) × (self-eval LM rank)`
- Commit the top one, log the runners-up
- This is the OmegaClaw "let the LM do it" philosophy with a Narsese tie-breaker

---

## Milestone 7 — Agent-level identity and persistence (1 week)

`IdentityResolver` exists but is barely wired.

### 7.1 Self-model on bootstrap
- On `initLoop`, inject seed beliefs: `(I --> senars-bot).`, `(senars-bot --> agent).`, etc.
- Persist self-model in `.cache/identity.nars` (Narsese text file).

### 7.2 Self-model skills
- `who_am_i` — returns the agent's identity beliefs.
- `remember_fact <narsese>` — adds a self-model belief with high confidence.
- The agent can introspect and edit its own identity.

### 7.3 Cross-session memory
- Today: each conversation is a separate `ConversationState`. Beliefs are shared via NARS,
  but episodic memory is per-conversation.
- Tomorrow: a single `Self` namespace in NARS that the agent seeds with autobiographical facts.

---

## Milestone 8 — Goal lifecycle (2 weeks)

A typed `Goal` primitive that can be spawned, pursued, suspended, resumed, completed, failed.

### 8.1 `Goal` type
```ts
type Goal = {
  id: string;
  statement: Narsese;
  preconditions: Narsese[];
  effects: Narsese[];
  status: 'pending' | 'pursuing' | 'suspended' | 'completed' | 'failed';
  spawnedAt: number;
  deadline?: number;
  progress: { steps: number; beliefs_added: number; tools_called: number };
};
```

### 8.2 Goal stack
- `state.goalStack: Goal[]` — replaces ad-hoc `ctx.workingMemory` focus.
- New top-level `spawn_goal`, `suspend_goal`, `complete_goal`, `fail_goal` skills.

### 8.3 Plan mode
- When the LM is pursuing a multi-step goal, the loop stays alive (`state.loops` re-armed)
  until the goal is `completed` or `failed`.
- The agent can work on a goal across multiple IRC messages without re-deriving the plan.

### 8.4 Long-horizon tasks
- `pnpm run goal "research X and write a summary"` — spawns a goal, exits REPL,
  the agent continues working in the background, and posts the result to IRC.

---

## Milestone 9 — Observability and operator UX (1 week)

### 9.1 `pnpm run status` CLI
Prints: connection states, last N turns (input → route → tools → response → truth), NARS
concept count, episodic recall hit rate, policy weights.

### 9.2 Trace export
- `state.trace: ReasoningTrace` is already in code (`src/agent/cognition/ReasoningTrace.ts`).
- Add `pnpm run trace:export <episodeId>` that dumps a single episode's trace to a
  readable markdown file.

### 9.3 Hot reload
- Watch `src/` and restart the agent on changes; preserve `state` (loop state, NARS bag,
  episodic memory) across restarts.

### 9.4 IRC operator commands
- `!status`, `!beliefs`, `!trace <id>`, `!policy` — gated by auth (already have
  `authSecret` support).

---

## Milestone 10 — Goal: full cognitive architecture (rollup)

After the above, SeNARS12 should have:
- A single recursive cognitive loop (OmegaClaw-shaped, but with TypeScript types)
- Typed working memory with goal/hypothesis/question slots
- Narsese truth values surfaced to the LM
- Episodic recall via vector search
- Spam shield + explicit wake scheduling + error feedback
- Visible and editable policy
- Persistent self-model
- Goal lifecycle with plan mode
- Operator observability

This is the architecture we sketched in the analysis: a kernel plus an interpreter
that owns the deliberation loop, with the LM driving declaratively via skills.

---

## Open questions / decisions to make

1. **Embedding backend**: transformers.js (local, no API key) vs OpenAI (cloud, costs money).
   Default to local with `OPENAI_EMBEDDING_MODEL` override.

2. **Reflection: keep or drop?**: OmegaClaw has no reflection stage. We have one. Decision:
   make it conditional on `meta_confidence < threshold` (Milestone 5.4).

3. **Should `nar_question` keep returning boolean `hasAnswer`?**: No — replace with graded
   confidence (Milestone 3.1).

4. **Should the AI SDK tool surface stay?**: Yes, for typed operations like `nar_believe`.
   But also expose raw `metta` skill for LM-driven Narsese eval (OmegaClaw pattern).

5. **Where does the LLM-driven Narsese eval live?**: New `src/nar/skills/metta.ts` —
   takes a Narsese string, parses, evaluates via NARS, returns the diff.

6. **CLI/IRC code path merger**: deletion or coexistence? Decision: delete
   `src/cli/repl.ts` and put its commands in `CLIConnection`.

7. **State persistence file format**: JSON (current) vs SQLite. Decision: keep JSON for
   the loop state; add SQLite for episodic memory index (via `better-sqlite3` + HNSW).

---

## Effort estimate (rough)

| Milestone | Weeks | Risk |
|---|---|---|
| 0 — Foundation cleanup | 1–2 | Low |
| 1 — Single cognitive loop | 2–3 | High — biggest refactor |
| 2 — Typed Working Memory | 2 | Medium |
| 3 — Surface uncertainty | 1–2 | Low |
| 4 — Episodic recall | 2 | Medium — new dep |
| 5 — Spam shield, wake, error feedback | 1 | Low |
| 6 — Visible policy | 1–2 | Low |
| 7 — Identity & persistence | 1 | Low |
| 8 — Goal lifecycle | 2 | Medium |
| 9 — Observability | 1 | Low |
| **Total** | **14–19 weeks** | |

---

## References

- [OmegaClaw-Core](https://github.com/asi-alliance/OmegaClaw-Core) — `omegaclaw` recursion,
  `getContext` prompt assembly, `spamShield`, `nextWakeAt`, `pin`/`metta` skills,
  ChromaDB episodic recall, s-expr skill format.
- SeNARS analysis findings — see commit history of this conversation for the full critique.
- SeNARS12 codebase — `src/agent/`, `src/nar/`, `src/io/`.
