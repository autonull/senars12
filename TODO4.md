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
