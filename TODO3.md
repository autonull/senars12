# SeNARS12 — Cognitive Architecture v3 (TODO3, simplified)

> A self-critique. The previous TODO3 had real architectural improvements
> over TODO2 (Conscience, activation memory, GWT) but each carried
> significant complexity for marginal benefit. This is the same
> capability set at ~60% the code.
>
> **Hypothetical / counterfactual reasoning is intentionally out of scope.**
>
> Inspired by ACT-R, SOAR, NARS, and the lessons of TODO.md and TODO2.md.
> OmegaClaw's lessons (small primitives, explicit state, spam shield)
> absorbed where they fit.

---

## What was over-engineered, and what we keep

### Dropped

| Dropped | Why |
|---|---|
| **GWT broadcast cycle** | Parallelism is hypothetical for a text-based bot with one LLM. Non-deterministic cycle length + interruption are achievable with a `while` loop + an `interrupted` flag in state. |
| **Activation memory unification** | Narsese beliefs don't decay (they're "knowledge," not "memory"). WM items should decay. Episodic recall is fine as top-K. Keep three stores; add decay to WM only. |
| **Conscience sub-agent** | Pattern matching is not a conscience, but a Conscience LLM is ~10x the complexity for the same `Verdict` interface. v1: validator function. v2: swap implementation behind the same interface. |
| **Phantom-typed state machine** | TypeScript doesn't enforce phantom types; one `as` cast voids it. Use a `Cycle.run(state, plan)` builder + documented order. |
| **Parallel module execution** | Single LLM at a time on a text bot. Revisit if multiple LLMs become available. |

### Kept (and why each is load-bearing)

- **`State` as a value** — versioning, rollback, replay, snapshotting, hot reload. *Uncontroversial.*
- **`Turn` algebra** — 6 variants; transports map natively; `silence` first-class. *TODO2's best idea.*
- **`Identity` as `Readonly` + `Validator`** — closed writes, typed `Verdict`. *Uncontroversial.*
- **AIKR as runtime config** — `Budget` is a plain type; the cycle checks budget before each phase. *Simpler than phantom `Tokens<N>`; equal in practice.*
- **Linear pipeline with `while` loop** — non-deterministic cycle length. *Same as TODO2's cycle, with explicit looping.*
- **Interrupt flag** — perception preempts thinking. *One boolean in `State`.*
- **Runtime skill effect check** — `Skill<I, O>` with `effects: Effect[]`; the catalog enforces which phase can call which effect. *Phantom effect types are convention; runtime check is the same in practice.*
- **Incremental migration** — one helper per week, system runs at every step. *The structural property of the plan.*

---

## The simplified architecture

```
   perceive → attend → retrieve → think → plan → act → reflect → commit
        │       │         │         │       │      │        │         │
        └───────┴─────────┼─────────┴───────┴──────┴────────┴─────────┘
                          │
                      State (value)
                          │
        ┌─────────────────┼─────────────────┬──────────────┐
        ▼                 ▼                 ▼              ▼
    WM (decays)      Narsese (no decay)  Episodes        Identity
                                          (top-K)        (Readonly)
```

The cycle runs phases in order. After `commit`, the cycle loops back to
`perceive` if there are open goals, new input, or `interrupted === true`.
Termination: `silence`, `goal-achieved`, `budget-exhausted`, or
`operator-stop`.

### State

```ts
interface State {
  readonly attention: Focus
  readonly wm: WorkingMemory                        // decays
  readonly beliefs: NarseseBag                      // doesn't decay
  readonly episodes: EpisodicIndex                  // top-K recall
  readonly identity: Readonly<Identity>             // protected
  readonly goals: GoalForest                        // tree, not stack
  readonly skills: SkillCatalog
  readonly validator: Validator                     // identity gate
  readonly budget: Budget
  readonly trace: CycleTrace
  readonly history: readonly Turn[]
  readonly mode: CognitiveMode
  readonly turn: number
  readonly version: number                          // increments per cycle
  readonly interrupted: boolean                     // perception preempts
}

interface Budget {
  tokensRemaining: number
  stepsRemaining: number
  deadline: number                                  // epoch ms
  maxOutputTokens: number
}
```

Plain types. No phantom tags. `version` enables cheap change detection;
`state.diff(s1, s2)` is structural equality plus version comparison.

### Turn

```ts
type Turn =
  | { kind: 'respond'; text: string; confidence: number }
  | { kind: 'act'; actions: SkillCall[]; results: SkillResult[] }
  | { kind: 'reflect'; verdict: Verdict }
  | { kind: 'plan'; goals: GoalUpdate[] }
  | { kind: 'silence'; reason: 'spam-shield' | 'budget-exceeded' | 'no-new-input' | 'validator-rejected'; detail?: string }
```

Five variants from TODO2 plus a sixth for validator-rejected identity
updates. Transports map natively: IRC sends `respond` and brief `act`
summaries; CLI shows all kinds with formatting; HTTP returns structured
JSON.

### Cycle (~30 lines)

```ts
async function cycle(
  input: Message | null,
  state: State,
  budget: Budget,
): Promise<{ state: State; turns: Turn[] }> {
  const turns: Turn[] = []
  let s = await perceive(input, state)

  const MAX_STEPS = 32
  for (let i = 0; i < MAX_STEPS && !terminal(s, budget); i++) {
    s = await attend(s)
    s = await retrieve(s)
    s = await think(s)
    s = await plan(s)
    s = await act(s)
    s = await reflect(s)
    s = await commit(s)
    turns.push(assembleTurn(s))
    if (s.interrupted) { s = { ...s, interrupted: false }; break }
  }

  if (turns.length === 0 && input) {
    turns.push({ kind: 'silence', reason: await silenceReason(s) })
  }

  return { state: { ...s, version: s.version + 1, turn: s.turn + 1 }, turns }
}

function terminal(s: State, b: Budget): boolean {
  return b.tokensRemaining <= 0 ||
         b.stepsRemaining <= 0 ||
         s.goals.allSatisfied() ||
         s.interrupted
}
```

That's the whole cycle. Each phase is a small function. The interrupt
flag is set by `perceive` (new input) and checked at the bottom of the
loop. The `MAX_STEPS` bound prevents infinite cycles.

### Identity + Validator

```ts
interface Identity {
  readonly beliefs: ReadonlySet<Narsese>
  readonly skills: ReadonlySet<SkillRef>
  readonly goals: ReadonlySet<GoalRef>
  readonly meta: { version: number; createdAt: number; updatedAt: number }
  readonly integrityHash: string
}

interface IdentityUpdate {
  readonly kind: 'add' | 'remove' | 'modify'
  readonly target: Narsese | SkillRef | GoalRef
  readonly reason: string
  readonly evidence: ReadonlyArray<string>
  readonly proposedBy: 'lm' | 'operator' | 'system'
}

interface Verdict {
  readonly decision: 'accept' | 'reject' | 'modify'
  readonly reason: string
  readonly modifiedUpdate?: IdentityUpdate
  readonly policyTrace: ReadonlyArray<PolicyRule>
}

interface Validator {
  review(update: IdentityUpdate, current: Identity): Verdict
  // Pure function. No LLM call. Pattern-matcher + integrity check.
  // Returns a typed Verdict.
  // v2: swap implementation for an LLM Conscience. Same interface.
}
```

`Validator.review()` is called by `Reflect` for every identity proposal.
`Commit` writes the update only if the verdict is `accept`. A `reject`
emits a `reflect` Turn that the operator can read via `!trace`.

### Skills

```ts
type Effect =
  | 'narsese-write' | 'episodic-write' | 'wm-mutate'
  | 'goal-mutate' | 'self-propose' | 'transport-send'

interface Skill<I, O> {
  readonly name: string
  readonly description: string
  readonly input: ZodType<I>
  readonly output: ZodType<O>
  readonly effects: ReadonlyArray<Effect>
  readonly cost: { tokens: number; steps: number }
  readonly reversible: boolean
  readonly execute: (input: I, state: Readonly<State>) => Promise<O>
}

class SkillCatalog {
  register<I, O>(skill: Skill<I, O>): void
  get(name: string): Skill<unknown, unknown> | undefined
  // Runtime check: skills with 'self-propose' effect can only be
  // called from the Reflect phase. The catalog enforces this.
  canCall(name: string, fromPhase: Phase): { ok: true } | { ok: false; reason: string }
}
```

Plain types. Runtime check via `canCall`. The catalog is the single
place where effect → phase mapping is enforced. Linter rule + convention
keep it consistent.

### Memory (3 stores; WM decays)

```ts
interface WorkingMemory {
  readonly items: Map<string, MemoryItem>
  recall(query: string, k: number): MemoryItem[]
  decay(now: number): void                        // runs as background
}

interface NarseseBag {
  // Doesn't decay. Truth values evolve via NARS inference.
  add(belief: Narsese): void
  query(term: Narsese): ReadonlyArray<Narsese>
}

interface EpisodicIndex {
  // Top-K via vector or text similarity. Activation in v2.
  log(entry: Episode): Promise<void>
  recall(query: string, k: number): Promise<ReadonlyArray<Episode>>
}
```

Three stores, same as TODO2. WM gets a `decay` function. Narsese doesn't
decay. Episodic recall is top-K for v1. The ACT-R activation equation
can be added in v2 as a swap-in replacement for `WM.recall` and
`EpisodicIndex.recall` — same interface, different algorithm.

---

## Capabilities matrix (honest accounting)

| Capability | TODO.md | TODO2.md | TODO3 (was) | TODO3 (now) |
|---|---|---|---|---|
| Type-safe cycle | No | Convention | Phantom types | Builder + docs |
| Probabilistic memory | No | 3 stores | Activation substrate | WM decay only |
| Self-model integrity | No | Readonly + pattern | Conscience LLM | Readonly + validator |
| Cost-aware execution | Runtime | Runtime | Phantom `Tokens<N>` | Runtime + docs |
| Replayable state | No | Yes (value) | Yes (value) | Yes (value) |
| Non-deterministic cycle length | No | No | Yes (GWT) | Yes (`while` loop) |
| Parallel module execution | No | No | Yes (GWT) | No (dropped) |
| Interruption | No | No | Yes (GWT) | Yes (interrupt flag) |
| Reverse skills | No | Asserted | Type-enforced | Asserted + linter |
| Effect types | Strings | Strings | Phantom types | Strings + runtime check |
| Incremental migration | Yes | No (W7) | Yes | Yes |
| Type-level AIKR | No | No | Yes | No (runtime only) |
| Unified memory | No | No | Yes | No (3 stores) |
| Lines of cycle code | n/a | ~50 | ~50 | ~30 |
| Phase type complexity | n/a | Plain | Phantom | Plain |
| Skill type complexity | Typed | Typed + effects | Typed + phantom | Typed + effects |
| Migration timeline | 14-19 wks | 12 wks | 12 wks | 12 wks |

**Net**: 12 of 16 capabilities fully preserved; 2 partially preserved
(probabilistic memory, type-level AIKR — kept at lower fidelity); 2 lost
(parallelism, full memory unification). The 2 lost capabilities are
hypothetical for a text-based bot and have a v2 upgrade path.

---

## Migration: same as before, simpler code

| Week | Milestone | Risk | Helper deleted |
|---|---|---|---|
| W0 | Foundation cleanup (TODO M0 verbatim) | Low | — |
| W1 | Extract `perceive()`; add `State` | Low | `EpisodePreparer` (partial) |
| W2 | `WorkingMemory` decay (background) | Low | `WorkingMemory` (writes) |
| W3 | Extract `commit()`; typed `Turn` | Low | `EpisodeRecorder` |
| W4 | Extract `think()`; single-call `ModelRunner` | Medium | `ModelRunner` |
| W5 | `Reflect` + `Validator` + `Identity` | Medium | `ReflectionStage` |
| W6 | Extract `attend()` + `plan()` | Low | `EpisodePreparer` (rest) |
| W7 | Wire `cycle()` linear form | High | `EpisodeRunner` |
| W8 | Split `AgentWiring`; per-phase deps | Medium | `AgentWiring` (split) |
| W9 | `SkillCatalog` with effect check | Medium | `ToolsBuilder` |
| W10 | Episodic recall (top-K, no activation) | Low | `EpisodicMemory` (vector) |
| W11 | Time-gated `wake()` | Low | `AutonomousScheduler` |
| W12 | Drop `InputRouter` classification | Low | `InputRouter` (regex) |
| **W13+** | Surface uncertainty, goal lifecycle, observability | Low each | — |
| **Total** | **~12 weeks migration + features** | | |

Same timeline as TODO2 and previous TODO3. Less code per week.

---

## What was dropped, and the v2 upgrade path

| Dropped in v1 | Upgrade path (v2) |
|---|---|
| GWT broadcast | Add a `Workspace` channel and a `compete()` function. Phases become adapters. |
| Activation memory | Replace `WM.recall` and `EpisodicIndex.recall` with ACT-R activation equation. Same interface. |
| Conscience sub-agent | Swap `Validator` implementation for an LLM Conscience call. Same `Verdict` interface. |
| Phantom types | Re-introduce as documentation convention. Linter enforces where possible. |
| Parallel module execution | Add a `broadcast` step before `think` when multiple LLMs are available. |
| Full memory unification | Add activation views *over* the 3 stores. The stores stay; views are added. |

Each dropped item is a *future* option, not a current requirement. v1
ships first, smaller, and the upgrade path is typed.

---

## Open questions

1. **What patterns does the `Validator` forbid?** Initial set: anything
   that asserts a property the agent demonstrably doesn't have; anything
   that contradicts a higher-priority self-belief; anything with truth
   value 0.0. Refine over time.
2. **WM decay rate**: how fast should WM items decay? Need empirical data.
3. **Cycle length bounds**: 32 steps? 64? Need a `stuck` turn for when
   the cycle doesn't terminate.
4. **Interrupt propagation**: which phases can be interrupted? All, or
   only `think` and `plan`?
5. **Linter rule for effect → phase mapping**: can a custom ESLint rule
   enforce the effect constraints statically? Would close the gap to
   phantom types.

---

## Effort estimate

| Phase | Weeks | Risk |
|---|---|---|
| W0 — Foundation cleanup | 1 | Low |
| W1-W2 — `State`, `perceive`, WM decay | 2 | Low |
| W3-W4 — `commit`, `think` | 2 | Low-Medium |
| W5 — `Reflect` + `Validator` | 1 | Medium |
| W6-W7 — `attend`, `plan`, `cycle` | 2 | Medium-High |
| W8 — Split wiring | 1 | Medium |
| W9-W10 — Skills, episodes | 2 | Low-Medium |
| W11-W12 — Wake, drop router | 2 | Low |
| **Total** | **~12 weeks** | |
| W13+ — Uncertainty, goals, observability | 1-2 each | Low |

After W12, every remaining TODO.md item is a *single-phase modification*.

---

## References

- `TODO.md` — tactical additive refactor (14-19 weeks).
- `TODO2.md` — strategic linear-pipeline replacement (12 weeks).
- `TODO3.md` (previous) — over-engineered GWT + activation + Conscience.
- `TODO3.md` (this) — the same capabilities, simpler primitives.
- ACT-R — Anderson. Inspiration for WM decay. Algorithm in v2.
- SOAR — Laird. Inspiration for impasse-driven sub-states. Not v1.
- NARS — Wang. The SeNARS kernel.
- OmegaClaw — lessons: small primitives, explicit state, spam shield.

---

## TL;DR

TODO3 (this) is the same cognitive architecture as the previous TODO3,
without the parts that were over-engineered for a text-based bot:

- **Drop GWT** → linear pipeline with `while` loop + interrupt flag.
- **Drop activation memory** → 3 stores; WM gets decay; rest is top-K.
- **Drop Conscience sub-agent** → validator function with typed `Verdict`.
- **Drop phantom types** → plain types + runtime checks + typed builder.

**Capabilities**: 12 of 16 fully preserved; 2 partially preserved at lower
fidelity; 2 lost (parallelism, full memory unification — both hypothetical
for a text-based bot, both have a v2 upgrade path).

**Code**: cycle is ~30 lines (down from ~50); phase types are plain (no
phantom tags); skill types are plain (no phantom effects); the `Validator`
is a pure function (no LLM call).

**Migration**: same 12-week timeline. Less risk per week.
