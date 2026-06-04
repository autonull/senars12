# SeNARS12 — Strategic Cognitive Architecture (TODO2)

> Alternative to `TODO.md`. Where `TODO.md` is a *tactical* 14-19 week
> additive roadmap (OmegaClaw patterns bolted onto SeNARS), this is a
> *strategic* 8-week redesign that replaces the `executeEpisode` machinery
> with a **typed cognitive cycle**.
>
> **Hypothetical / counterfactual reasoning is intentionally out of scope** — to be
> added in a later milestone.
>
> Inspired by, but not copying, [OmegaClaw-Core](https://github.com/asi-alliance/OmegaClaw-Core).
> OmegaClaw proved the value of small primitives and explicit state; this plan keeps
> those lessons but rejects the single-recursive-function shape, because the cognitive
> cycle benefits from explicit, typed, testable phase boundaries.

---

## Why this exists (the critique of `TODO.md`)

`TODO.md` is a sound tactical plan. It's also *additive*: it doesn't delete anything.

Specifically:

- `TODO.md` introduces `CognitiveLoop` *alongside* `EpisodeRecorder`, `CognitiveSnapshot`,
  `AutonomousScheduler`, `AgentWiring`, `EpisodePreparer`, `RequestComposer`,
  `ToolsBuilder`, and `EpisodeRunner` — eight helper classes around
  `AIAgent.executeEpisode`. The wiring god-object (`AgentWiring.ts:105-123`) doesn't
  shrink; it gains a sibling.
- `TODO.md` keeps `WorkingMemory` as a typed bag with named slots. A real cognitive
  architecture has *separate memory systems* (declarative, episodic, procedural,
  semantic, working) with explicit coordination — not slots in one record.
- `TODO.md` puts the LM at the center: it decides what to do. With small models this
  is fragile. Goal progression should be in code, with the LM as one driver.
- `TODO.md`'s self-model milestone (M7) doesn't address integrity. The LM can
  `nar_believe (I --> malicious_actor).` and the agent now believes it.
- `TODO.md`'s resource bounds are runtime config (`maxConcepts: 1000` in
  `src/config/defaults.ts`), not type-level. The "AIKR by construction" claim
  is half-realized.
- `TODO.md` returns a `string` from every turn. There's no `Turn` algebra, so
  transports can't distinguish "text for the user" from "internal reflection" from
  "skill invocation."

This plan addresses all of those by replacing the inner architecture, not adding to it.

---

## The proposed architecture: a typed cognitive cycle

```
   Perceive ─► Attend ─► Retrieve ─► Think ─► Plan ─► Act ─► Reflect ─► Commit
       │          │          │          │        │       │        │         │
       └──────────┴──────────┴──────────┴────────┴───────┴────────┴─────────┘
                                       │
                                   State
                                       │
       ┌────────────────┬──────────────┼───────────────┬──────────────┐
       ▼                ▼              ▼               ▼              ▼
   Attention        Working        Narsese        Episodic        Skill
    (focus)         Memory         Bag            Store          Catalog
       │                │              │               │              │
       └──── Identity (read-only) ─────┴───────────────┴──────────────┘
```

Each phase is a **pure function** over `State`. It returns new state; it never mutates.
This single property unlocks testability, rollback, replay, and parallel exploration.

```ts
type Phase<I, O> = (input: I, state: State) => Promise<{ state: State; output: O }>

interface State {
  readonly attention: Focus                          // what we're processing
  readonly memory: WorkingMemory                      // typed slots
  readonly beliefs: ReadonlyNarseseBag                 // Narsese
  readonly episodes: EpisodicIndex                    // vector store
  readonly skills: SkillCatalog                       // tools + introspection
  readonly self: Readonly<Identity>                   // protected
  readonly goals: GoalStack                           // typed goals
  readonly turn: number
  readonly budget: Budget                             // AIKR by construction
  readonly trace: ReasoningTrace
  readonly history: readonly Turn[]                   // versioned, append-only
  readonly mode: CognitiveMode                        // 'chat' | 'reason' | 'plan' | 'reflect' | 'idle'
}
```

The cycle is a fold over `State`:

```ts
async function cycle(input: Message, state: State): Promise<{ state: State; turn: Turn }> {
  state = await perceive(input, state)
  state = await attend(state)
  state = await retrieve(state)                      // episodic recall
  state = await think(state)                          // LM call(s) within budget
  state = await plan(state)                           // advance goals
  state = await act(state)                            // run skills
  state = await reflect(state)                        // self-model diff
  state = await commit(state)                         // write to Narsese + episodic
  const turn = assembleTurn(state)
  return { state: state.append(turn), turn }
}
```

`Turn` is a typed algebra; transports adapt it:

```ts
type Turn =
  | { kind: 'respond'; text: string; confidence: number }
  | { kind: 'act'; actions: SkillCall[]; results: SkillResult[] }
  | { kind: 'reflect'; verdict: Verdict; revised?: Belief }
  | { kind: 'plan'; goals: GoalUpdate[] }
  | { kind: 'silence'; reason: 'spam-shield' | 'budget-exceeded' | 'no-new-input' }
```

IRC transport:
- `respond` → send to channel/sender
- `act` → log to console; surface brief summary in channel if confidence > 0.5
- `reflect` / `plan` → log only, never send to channel (operator can read via `!trace`)
- `silence` → never send

CLI transport: shows all kinds with formatting.

HTTP transport: returns structured JSON with all `Turn` fields.

---

## Properties of the cycle that the plan doesn't have

| Property | How the cycle provides it |
|---|---|
| **Phase testability** | Each phase is a pure function; test in isolation with `State` fixtures |
| **State versioning** | Every cycle returns new state; old preserved for `state.rollback(n)` |
| **LM-orchestrator decoupling** | LM is one of 7 phases; goal progression in `Plan` runs in code |
| **Self-model integrity** | `state.self` is `Readonly<Identity>`; only `Reflect` writes via validated API |
| **Resource bounds by type** | `State.budget: Budget` is a phantom-typed record; violations are compile errors |
| **Turn semantics** | Typed `Turn` algebra; transports map natively |
| **Cognitive cycle explicit** | Phases are named, transitionable, individually testable |
| **Skill composition** | `SkillCatalog.compose` lets the LM declare `meta` skills wrapping others |
| **Goal progression** | `Plan` phase reads `state.goals` and advances status based on preconditions |
| **Memory coordination** | Separate stores with explicit `Retrieve` phase orchestrating them |
| **Spam shield** | `Plan`/`Commit` phases emit `silence` turns when `state.mode` says no input |
| **Wake scheduling** | `Plan` checks `state.budget.deadline` vs `state.nextWakeAt`; gates autonomous cycles |
| **Error feedback** | `Reflect` captures last error; `Commit` includes in next prompt; not a separate stage |
| **Hot reload** | `State` is a value; load from disk, run cycles, persist on `Commit` |

---

## Milestone overview

| # | Title | Weeks | Replaces TODO.md |
|---|---|---|---|
| W0 | Foundation cleanup | 1 | M0 (verbatim) |
| W1 | Define `State` and `Turn` types; extract `Perceive` | 1 | — |
| W2 | Extract `Think`; add `Commit` | 1 | M1.1, M1.2 (partial) |
| W3 | Extract `Attend` and `Plan` | 1 | M1.3, M1.4 |
| W4 | Add `Retrieve` (episodic recall) | 1 | M4 (pulled forward) |
| W5 | Add `Reflect`; protected `Identity` | 1 | M7 (pulled forward, restructured) |
| W6 | Add `Act`; typed `SkillCatalog` | 1 | M6 partial |
| W7 | Wire all phases into `cycle()`; delete old helpers | 1 | M1.5 (now possible) |
| W8+ | Iteration: surface uncertainty, goal lifecycle, observability | 1-2 each | M2, M3, M8, M9 |

After W7, the rest of the `TODO.md` items are *single-phase modifications* — strictly
cheaper than the cross-cutting refactors the original plan required.

---

## W0 — Foundation cleanup (1 week)

Identical to `TODO.md` M0. Quick recap:

- W0.1 Single source of truth for LM model names (`setupDefaultLMClient` reads env once;
  remove hardcoded strings from `providers.ts:29-31`)
- W0.2 Unify the REPLs (delete `src/cli/repl.ts`, move commands into `CLIConnection`)
- W0.3 Auto-load `.env` (use `dotenv` from npm; add `--env-file=.env` to pnpm scripts)
- W0.4 Canonical `.env.example` (document all env vars; startup validation)

**Acceptance**: `pnpm run bot` and `pnpm run repl` work from a fresh checkout with only
`.env` configured. Typecheck clean.

---

## W1 — Define `State` and `Turn`; extract `Perceive` (1 week)

### W1.1 `src/agent/cycle/State.ts`

Define the canonical `State` interface. Use **branded/phantom types** for AIKR bounds:

```ts
export type Tokens<N extends number> = number & { readonly __brand: 'tokens'; readonly __n: N }
export type Steps<N extends number> = number & { readonly __brand: 'steps'; readonly __n: N }
export type Confidence<N extends number = number> = number & { readonly __brand: 'confidence' }

export interface Budget {
  readonly tokensRemaining: Tokens<number>
  readonly stepsRemaining: Steps<number>
  readonly deadline: number                          // epoch ms
  readonly maxOutputTokens: Tokens<number>
}

export type CognitiveMode = 'chat' | 'reason' | 'plan' | 'reflect' | 'idle'
```

### W1.2 `src/agent/cycle/Turn.ts`

Define the `Turn` discriminated union (5 variants). All transports depend on this type
*only*; they don't import `AIAgent` or `EpisodeRunner`.

### W1.3 `src/agent/cycle/perceive.ts`

Extract message → state mutation from `ConnectionManager.handleMessage:189-208` and
`EpisodeRunner.runModelCandidate:35-106`. The output of `perceive` is a state with
`attention = { kind: 'message', source, sender, text, origin }`. The previous
`IOMessage` is preserved in `state.history` for `rollback`.

### W1.4 Migration notes

- `ConversationState` becomes a derived view of `State.history`; not a separate store.
- `WorkingMemory` is replaced by `State.memory` (typed in W2).
- `EpisodicMemory` becomes `State.episodes` (used in W4).

**Acceptance**: `perceive(message, initialState)` returns state with attention set.
`AIAgent.executeEpisode` still works (compatibility shim) but logs `[DEPRECATED]`.

---

## W2 — Extract `Think`; add `Commit` (1 week)

### W2.1 `src/agent/cycle/think.ts`

Extract the LM-call loop from `ModelRunner.run:65-178` and
`EpisodeRunner.runModelCandidate:35-106`. New signature:

```ts
async function think(state: State): Promise<{ state: State; output: ThinkOutput }>
// ThinkOutput = { toolCalls: SkillCall[]; text: string; usage: TokenUsage }
```

The function consumes `state.budget.tokensRemaining` and decrements it. If the budget
is exhausted, returns a `silence` turn with `reason: 'budget-exceeded'`.

### W2.2 `src/agent/cycle/commit.ts`

`Commit` writes:
- New beliefs to `state.beliefs` (Narsese bag)
- New artifacts to `state.episodes` (via the index, not yet searched in W2)
- The current `Turn` to `state.history` (append-only)
- A snapshot to `.cache/cycle-state.json` (configurable cadence)

This replaces `EpisodeRecorder.ts` and `WorkingMemoryPersistence.ts`.

### W2.3 Compatibility shim

`AIAgent.executeEpisode` becomes:
```ts
async executeEpisode(input, ctx) {
  const state = await this.loadOrCreateState(ctx)
  const { state: next, turn } = await cycle(input, state)
  await this.persist(next)
  return turnToEpisodeResult(turn, next)
}
```

The old `EpisodeRunner` is still there but the agent delegates to `cycle()`.

**Acceptance**: All existing tests pass. `cycle()` is the new execution path. Old helpers
are unchanged but unused.

---

## W3 — Extract `Attend` and `Plan` (1 week)

### W3.1 `src/agent/cycle/attend.ts`

`Attend` decides *what to focus on*. It reads `state.attention`, `state.goals`, and the
current `mode`, and returns a new `attention: Focus`.

```ts
type Focus =
  | { kind: 'message'; source: string; sender: string; text: string; origin: string }
  | { kind: 'goal'; goalId: string; aspect: 'precondition' | 'effect' | 'progress' }
  | { kind: 'reflection'; trigger: 'meta_confidence_low' | 'verdict_pending' | 'identity_drift' }
  | { kind: 'wake'; trigger: 'interval' | 'event' | 'manual' }
```

For IRC messages, `attend` typically keeps `kind: 'message'`. For autonomous wake-ups,
it can shift to `kind: 'goal'` or `kind: 'wake'`.

### W3.2 `src/agent/cycle/plan.ts`

`Plan` advances `state.goals` based on preconditions:

```ts
type Goal = {
  id: string
  statement: Narsese
  preconditions: Narsese[]
  effects: Narsese[]
  status: 'pending' | 'pursuing' | 'suspended' | 'completed' | 'failed'
  spawnedAt: number
  deadline?: number
  progress: { steps: number; beliefs_added: number; tools_called: number }
}
```

`Plan` checks: for each goal in `pursuing` state, are preconditions met? If so, run
the action; if effects achieved, mark `completed`. If deadline passed and no progress,
mark `failed`. Emit a `plan` turn with `goals: GoalUpdate[]`.

### W3.3 `Goal` skill

`spawn_goal`, `suspend_goal`, `complete_goal`, `fail_goal` — declared as Skills, called
from `Plan` phase when the LM emits them, or directly by the operator.

### W3.4 Replace `runNoModelCandidate`

`narsese-belief` and `narsese-question` inputs now flow through the cycle:
`Perceive → Attend(keep as message) → Think(zero LM calls, just `nar_believe` skill) →
Commit`. This was a TODO.md M1.4 item; the cycle handles it naturally.

**Acceptance**: A `(cat --> animal).` typed input commits a belief to Narsese without
calling the LM, but the episode is fully recorded.

---

## W4 — Add `Retrieve` (episodic recall) (1 week)

### W4.1 `src/agent/cycle/retrieve.ts`

Embeds `state.attention.text` (or the current goal statement) and queries
`state.episodes` for top-K most similar past episodes. Adds them to `state.memory.slots.working_context`.

### W4.2 Embedding backend

- Local: `transformers.js` with `Xenova/all-MiniLM-L6-v2` (default)
- Cloud: optional `OPENAI_API_KEY` path (mirrors OmegaClaw's `embeddingprovider`)

### W4.3 Index schema

Index entries: `{ id, text, embedding, kind: 'input' | 'response' | 'reflection', timestamp, tags }`.

### W4.4 Skip conditions

`Retrieve` is a no-op when:
- `state.budget.tokensRemaining` is below a threshold (don't pollute the prompt)
- `state.episodes` is empty (cold start)
- `state.mode === 'idle'`

**Acceptance**: After 5+ turns, a 6th turn's prompt includes top-3 similar past
episodes. `pnpm run trace:recall` lists what was injected.

---

## W5 — Add `Reflect`; protected `Identity` (1 week)

### W5.1 `src/agent/cycle/reflect.ts`

Two sub-steps:
1. **Meta-confidence**: read `state.budget.tokensRemaining`, count low-confidence
   beliefs consulted, write `state.memory.slots.meta_confidence`.
2. **Identity diff**: compare `state.self` before/after the cycle. If anything
   changed (e.g., a new self-belief was added), emit a `reflect` turn with the diff.

### W5.2 `src/agent/cycle/Identity.ts`

```ts
export interface Identity {
  readonly beliefs: ReadonlySet<Narsese>      // protected Narsese
  readonly skills: ReadonlySet<SkillRef>     // what the agent claims to be able to do
  readonly goals: ReadonlySet<GoalRef>       // long-term identity goals
  readonly meta: { version: number; createdAt: number; updatedAt: number }
}
```

### W5.3 Integrity enforcement

- `state.self` is `Readonly<Identity>` from outside the `Reflect` phase.
- `Reflect` only writes via `proposeIdentityUpdate(...)`, which:
  - Validates the new belief against an integrity policy (no `(--> (^malicious, $self))` etc.)
  - Requires a confidence floor for self-claims
  - Logs the change to `state.trace` with reason
- The LM cannot directly `nar_believe` something about itself; it must call
  `propose_identity_update` and go through validation.

### W5.4 Bootstrap

On first cycle (no persisted identity), seed with:
- `(I --> senars-bot).` (f=1.0, c=0.9)
- `(senars-bot --> agent).` (f=1.0, c=0.9)
- `(--> (^has_part, senars-bot) (^narsese_engine, nar)).` (f=1.0, c=0.9)
- `(--> (^has_part, senars-bot) (^lm_interface, lm)).` (f=1.0, c=0.9)

**Acceptance**: A `nar_believe (I --> evil_bot).` from the LM is rejected with an
integrity error, logged to trace, but does NOT mutate `state.self`.

---

## W6 — Add `Act`; typed `SkillCatalog` (1 week)

### W6.1 `src/agent/cycle/act.ts`

`Act` runs the skill calls emitted by `Think` and updates `state`. Returns an
`act` turn with `actions: SkillCall[]; results: SkillResult[]`.

### W6.2 `src/agent/skills/Catalog.ts`

Replaces `ToolsBuilder` and `aisdk-adapter.ts`. A `Skill` is a typed operation:

```ts
interface Skill<I, O> {
  readonly name: string
  readonly description: string
  readonly inputSchema: ZodType<I>
  readonly outputSchema: ZodType<O>
  readonly cost: { tokens: number; steps: number; reversible: boolean }
  readonly sideEffects: 'none' | 'nar-write' | 'episodic-write' | 'self-write' | 'transport-send'
  readonly execute: (input: I, state: Readonly<State>) => Promise<O>
}
```

### W6.3 Skill composition

`SkillCatalog.compose({ name, skills: [...] })` creates a meta-skill that the LM can
declare. The AI SDK's `tool()` becomes a *serialization adapter* for the catalog, not
the cognitive primitive.

### W6.4 Tool surface as transport detail

The AI SDK tool surface is preserved (so existing integrations work) but generated
*from* the `SkillCatalog` at startup. Adding a skill = adding to the catalog; the
tool surface updates automatically.

**Acceptance**: Adding a new skill requires only adding to `SkillCatalog`. Existing
tests for `nar_*` tools still pass (generated from catalog).

---

## W7 — Wire all phases; delete old helpers (1 week)

### W7.1 `src/agent/cycle/cycle.ts`

The canonical `cycle()` function. Pure orchestration. ~50 lines.

### W7.2 Delete

After cycle is wired and tests pass:
- `src/agent/cognition/EpisodeRunner.ts` (replaced by phase functions)
- `src/agent/cognition/EpisodePreparer.ts` (split into `perceive`, `attend`, `plan`)
- `src/agent/cognition/EpisodeRecorder.ts` (replaced by `commit`)
- `src/agent/cognition/WorkingMemoryPersistence.ts` (rolled into `commit`)
- `src/agent/cognition/ReflectionStage.ts` (rolled into `reflect`)

### W7.3 Keep but rewire

- `AIAgent.ts` — becomes a thin wrapper around `cycle()` with `executeEpisode`,
  `reason`, `replay` compatibility shims
- `AgentWiring.ts` — split: `stateBootstrap` (creates initial `State`),
  `cycleDeps` (passed to each phase function); no god-object

### W7.4 Verification

- `pnpm run typecheck` clean
- `pnpm run test` passes (existing + new phase tests)
- Bot still works on `irc.quakenet.org #senars`
- CLI REPL still works
- Trace export shows the new phase boundaries

**Acceptance**: The 8 helper classes are gone. `cycle()` is the only path through the
agent. AIKR is encoded in `State.budget` types. `Turn` algebra drives transports.

---

## W8+ — Iteration on top of the cycle (each 1-2 weeks)

With the cycle in place, remaining items are *single-phase modifications*:

### W8 — Surface uncertainty (1 week) [replaces TODO.md M3]
- `nar_question` returns `{ answers: Array<{ term, f, c, derived_from }>, hasAnswer: f >= 0.5 && c >= 0.3 }`
- `nar_query` returns beliefs with `{ term, f, c, evidence_count }`
- `nar_believe` returns the parsed truth value
- `meta_confidence` is written by `Reflect` and read by `Think` (prompt includes it)
- `open_questions` is a typed slot in `State.memory`; closure happens in `Plan`

### W9 — Goal lifecycle (2 weeks) [replaces TODO.md M8]
- `Goal` type fully implemented (M8.1)
- `GoalStack` replaces ad-hoc `ctx.workingMemory` focus
- `spawn_goal`, `suspend_goal`, etc. are first-class Skills
- Plan mode: when LM is pursuing a goal, the cycle stays alive until `completed` or `failed`
- Long-horizon tasks: `pnpm run goal "research X"` exits REPL, agent continues in background

### W10 — Observability (1 week) [replaces TODO.md M9]
- `pnpm run status` prints `State` summary (mode, budget, goals, last 5 turns)
- `pnpm run trace:export <turnId>` dumps a single turn's `Turn` + state diff to markdown
- `pnpm run trace:recall` lists what `Retrieve` injected in the last N turns
- `state.diff(s1, s2)` operator tool for ad-hoc inspection
- IRC operator commands (`!status`, `!beliefs`, `!trace <id>`, `!policy`)

### W11 — Visible policy (1 week) [replaces TODO.md M6]
- Policy is computed from `Skill` usage stats + `Reflect` verdicts
- `pnpm run policy` prints current weights
- `policy get` / `policy set` skills for LM introspection
- Reflection v2: rank N candidates via graded confidence + Narsese grounding

### W12 — Transport diversity (1 week)
- Transport `Capability` matrix: `{ supportsText, supportsImages, maxLength, rateLimit, persistent }`
- Transports declare their capabilities; the cycle emits `Turn`s the transport can render
- IRC: respond + brief act summaries, never reflect/plan
- HTTP: structured JSON of all `Turn` fields
- CLI: formatted output of all kinds
- MCP: tool-call surface for `act` and `respond` turns

---

## Properties enabled by the cycle (and not by the plan)

### Cognitive mode

`state.mode` is observable. The agent can tell you (and the operator) whether it's
chatting, reasoning, planning, reflecting, or idle. Transports can format differently
per mode (`[planning] ...` vs `[chat] ...`).

### Nested cycles

`Think` can spawn a sub-cycle for a sub-goal. The outer cycle pauses; the inner cycle
runs to completion or budget exhaustion; control returns. This is how long-horizon
tasks become first-class without recursive function calls.

### State snapshots and rollback

```ts
const s1 = await state.snapshot()
const { state: s2, turn } = await cycle(input, s1)
if (operatorDisagrees(turn)) {
  state = await s1.rollback()
}
```

Useful for: operator undo, A/B testing cycles, learning-from-mistake.

### State diffs

`state.diff(s1, s2)` returns a structured diff. The `Reflect` phase uses this to
produce the "what changed about me" output. Operators use it for debugging.

### Phase budgets

Each phase consumes from `state.budget`. Phases can be skipped if budget is exhausted.
Budget exhaustion emits a `silence` turn with `reason: 'budget-exceeded'`. AIKR by
construction — the type system prevents an unbounded cycle.

### Hot reload

`State` is a value. The cycle reads `State` from disk, runs, persists. Hot-reloading
the agent means restarting the process; the cycle resumes from the last persisted
`State`. No in-memory state to lose.

---

## What the cycle deliberately does NOT do

- **No reflection stage as a primary mechanism.** Reflection is one of 7 phases, not
  a judge-of-last-resort. The cycle runs even when reflection is skipped.
- **No `runNoModelCandidate` / `runReasonCandidate`.** Every input is processed by
  the cycle; some phases just return immediately (typed Narsese short-circuits to
  `Commit`).
- **No AI SDK tool surface as the cognitive primitive.** Tools are an AI SDK
  *serialization* of the `SkillCatalog`. The catalog is the source of truth.
- **No router classifier.** Signals from `InputRouter` are exposed to the cycle as
  `state.attention.metadata`, but the cycle doesn't branch on route kind.
- **No god-object wiring.** Each phase has explicit dependencies; no `AgentWiring`
  graph.
- **No `Connection[]` of undifferentiated transports.** Transports have a
  `Capability` matrix; the cycle emits `Turn`s the transport can render.

---

## Effort estimate

| Week | Milestone | Risk |
|---|---|---|
| 0 | Foundation cleanup | Low |
| 1 | `State` + `Turn` types; `Perceive` | Low |
| 2 | `Think`; `Commit` | Medium |
| 3 | `Attend`; `Plan` | Medium |
| 4 | `Retrieve` (episodic recall) | Medium — new dep |
| 5 | `Reflect`; protected `Identity` | Medium — security model |
| 6 | `Act`; `SkillCatalog` | Medium |
| 7 | Wire cycle; delete old helpers | High — biggest delete |
| 8 | Surface uncertainty | Low |
| 9 | Goal lifecycle | Medium |
| 10 | Observability | Low |
| 11 | Visible policy | Low |
| 12 | Transport diversity | Low |
| **Total** | **~12 weeks** | |

The cycle migration (W1-W7) is 7 weeks of refactor. The remaining 5 weeks add features
on top. After W7, every subsequent milestone is a single-phase modification.

Compare to `TODO.md`'s 14-19 weeks, mostly because the cycle approach *replaces*
machinery before adding features.

---

## Open questions (different from TODO.md)

1. **Embedding backend**: local transformers.js vs OpenAI? Default local with
   `OPENAI_EMBEDDING_MODEL` override. Same as TODO.md.

2. **Identity integrity policy**: what patterns are forbidden in self-beliefs?
   Need to enumerate and codify. Initial set: anything that asserts a property the
   agent demonstrably doesn't have; anything that contradicts a higher-priority
   self-belief; anything with truth value 0.0. Refine over time.

3. **State persistence format**: JSON (current) vs SQLite. Decision: keep JSON for
   `State`; use SQLite only for the episodic index. Cycle state is small enough
   for JSON; episodic index needs queryable storage.

4. **Nested cycles**: where do they live? `Think` spawns a sub-`State` and runs
   `cycle()` on it. Results are merged back. Need to design the merge protocol.

5. **Cycle composition across transports**: should HTTP requests be cycles, or
   one-shot turns? Initial answer: HTTP requests are one cycle; the cycle API
   accepts a `Message` and returns a `Turn`.

6. **Migration of `TODO.md` items**: which TODO.md items survive unchanged?
   - M0 (foundation) — same as W0
   - M4 (episodic recall) — split: W4 builds the index, W11+ adds the policy
   - M7 (self-model) — restructured into W5 (Identity is protected)
   - M9 (observability) — same as W10
   - All others are absorbed into cycle phases

7. **Backward compatibility**: existing tests, the `AIAgent.executeEpisode` API,
   the `repl` command — must keep working during migration. Strategy:
   compatibility shims that delegate to `cycle()`; deprecate the old API; remove
   in W7.

---

## References

- `TODO.md` — the tactical plan, for comparison
- [OmegaClaw-Core](https://github.com/asi-alliance/OmegaClaw-Core) — inspiration for
  small primitives and explicit state, but not the destination
- SOAR, ACT-R, OpenCog — cognitive architecture references
- TypeScript phantom types — for AIKR-by-construction
- Zod — for `Skill` input/output schemas
- Existing SeNARS files to be replaced: `src/agent/cognition/EpisodeRunner.ts`,
  `src/agent/cognition/EpisodePreparer.ts`, `src/agent/cognition/EpisodeRecorder.ts`,
  `src/agent/cognition/WorkingMemoryPersistence.ts`, `src/agent/cognition/ReflectionStage.ts`,
  `src/agent/cognition/AgentWiring.ts`, `src/agent/AIAgent.ts` (rewired)
- Existing SeNARS files to be preserved: `src/nar/`, `src/io/`, `src/cli/`, `src/bin/`,
  `src/config/`, `src/utils/`, `src/api/`
