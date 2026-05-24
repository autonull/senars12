# What We're Building: SeNARS + Real LM Cognitive Synergy

SeNARS is a **cognitive architecture** that couples two fundamentally different reasoning systems:

- **NARS** (Non-Axiomatic Reasoning System): sound logical inference under uncertainty — deduction, induction, abduction, revision. It can prove `(robin --> animal)` from `(bird --> animal)` + `(robin --> bird)`. But it has **zero world knowledge**. It doesn't know what a bird is, what properties robins have, or how to translate natural language.

- **LLM** (via Transformers.js): massive world knowledge, natural language understanding, concept elaboration, hypothesis generation. It knows birds have feathers, robins are small and sing, and can generate novel Narsese statements. But it has **no reasoning guarantees** — it's statistical, not logical.

The **synergy** is a bidirectional cycle:

```
NARS concepts + beliefs
    ↓  (priority-gated activation)
LM rules fire on high-priority concepts
    ↓  (generateText → real Narsese output)
LM-derived beliefs injected back into memory
    ↓  (NARS inference on new beliefs)
More concepts, higher priority on relevant ones
    ↓  (cycle continues)
```

NARS provides the skeleton (logical inference). The LM provides the flesh (world knowledge, language, creativity).

## What the Ultimate Demo Looks Like

```
Input:   (bird --> animal).
         (robin --> bird).
         (swim --> ability)!
         (search_food)!

NARS alone:
  ⊢ (robin --> animal)           ✓ deduction
  ⊢ (animal --> bird)            ✓ induction  
  ⊢ (animal <-> bird)            ✓ similarity

LM rules fire with REAL Transformers.js:
  ⊢ (bird --> feathered_thing)   ✓ concept elaboration (LM knows birds have feathers)
  ⊢ (robin --> songbird)         ✓ world knowledge (LM knows robins)
  ⊢ (animal --> living_being)    ✓ LM elaborates on animal
  ⊢ (swim --> (fish --> ability)) ✓ goal decomposition
  ⊢ (search_food --> (peck & hunt)) ✓ LM decomposes goals

Priority gating:
  High-priority concepts (bird, animal) → LM enhancement
  Low-priority noise → skipped

Goal satisfaction:
  checkGoalSatisfaction("search_food") → found belief f>0.8
```

**This is something neither system can do alone.** NARS can't elaborate. The LM can't reason logically. Together they form a complete cognitive cycle.

## Why the Pipeline Infrastructure is Blocking This

The architecture is designed and implemented. The reasoner, LM rules, scheduler, REPL — all exist. But the **pipeline between them is unobservable and fragile**, preventing the demo from running end to end.

Every attempt to run the full demo hits the same wall: the system appears to hang, and nobody can see why.

Current symptoms:
- `nar.run(2)` with two simple inheritance statements takes >60s
- No feedback on whether LM rules fired, were skipped, or timed out
- No way to tell if the bottleneck is the model, the concurrency, the rules, or the reasoner loop
- LM becomes `available: false` silently — derived rules vanish without trace

The infrastructure in AI5 isn't just "nice to have" — it's the **prerequisite** for the demo. Without it, we can't:

1. **Prove LM rules are contributing** — are we seeing NARS-only inference or real LM synergy?
2. **Tune performance** — is 18s per premise pair a model problem or a concurrency problem?
3. **Verify priority gating** — are low-priority concepts correctly skipping LM enhancement?
4. **Debug goal satisfaction** — why didn't `(robin --> animal)` appear after 2 inference steps?
5. **Demonstrate the demo** — the whole point is watching the cycle in action

## What AI5 Delivers

| Capability | Why it Matters for the Demo |
|---|---|
| Structured logging across LM pipeline | See exactly where time goes — model vs queue vs overhead |
| Sequential/batched LM rule execution | Make model predictable — 6 rules × 3s = 18s, not "infinite" |
| AbortSignal propagation | Kill stuck calls without killing process |
| REPL diagnostic commands | `.rules` shows rule stats, `.trace` shows per-step timing, `.lm-debug` shows queue depth |
| Stats on TransformersLMClient | totalCalls, avgDuration, timeouts, queueHighWater — know the client state |
| Temporal tracing | Build a flame chart of where every millisecond goes |

Without these, the demo is a coin flip — sometimes it works, more often it hangs. With them, we can **watch the cognitive cycle happen in real time**, tune it, and prove that real LM-derived Narsese is flowing through the NARS inference engine.

## ✅ AI5 Complete — What Was Delivered

All infrastructure changes are implemented, tested, and verified. The pipeline is now fully observable.

| Capability | Files Changed | Status |
|---|---|---|
| Structured logging across LM pipeline | `processor.ts`, `nar-execution.ts`, `defaults.ts` | ✅ Every rule firing/skipping/timeout logged with duration |
| Sequential LM rule execution | `processor.ts:128-155` — replaced `Promise.all` with `for...of` | ✅ Rules fire one at a time; no more silent queue pileup |
| AbortSignal propagation | `types.ts` → `LMRule.ts` → `defaults.ts` → `processor.ts` → `reasoner.ts` → `nar-execution.ts` | ✅ Full chain: run → reasoner → rules → LM client |
| REPL diagnostic commands | `repl.ts` — added `.rules`, `.trace`, `.lm-debug`; updated `.lm` and `.help` | ✅ `.rules` shows execution log, `.trace` shows flame chart, `.lm-debug` shows client internals |
| Stats on TransformersLMClient | `types.ts` (LMClientStats), `defaults.ts`, `mock-client.ts` | ✅ totalCalls, avgDuration, timeouts, queueHighWater via `getStats()` |
| Temporal tracing (PhaseTimer) | `src/nar/trace/phase-timer.ts` (new), `nar-execution.ts` integration | ✅ Flame chart output: per-phase timing breakdown |
| LM activity feedback on input | `repl.ts` handleNarsese | ✅ After each belief input: "lm: 2 rules fired, 11 skipped" |

## Realtime Demo Output (pipe mode, testing with Transformers.js)

```
[rules:processor] LM rule firing {"ruleId":"lm-narsese-translation","p1":"(bird --> animal)"}
[lm:transformers] Transformers.js initialized
[rules:processor] LM rule complete {"ruleId":"lm-narsese-translation","duration":8445,"tasksProduced":1}
[rules:processor] LM rule firing {"ruleId":"lm-explanation-generation","p1":"(bird --> animal)"}
[rules:processor] LM rule complete {"ruleId":"lm-explanation-generation","duration":1943,"tasksProduced":1}
[rules:processor] LM rule firing {"ruleId":"lm-meta-reasoning", ...
```

Every rule call is visible, timed, and accountable. No more silent hangs.

## The Files That Matter (Updated)

| File | Role in the Demo |
|------|------------------|
| `src/cli/repl.ts` | Entry point — pipe Narsese in, see synergy out |
| `src/nar/lm/defaults.ts:58` | TransformersLMClient — the local model that makes this real (no API key) |
| `src/nar/lm/rules.ts:96-109` | 13 LM rules — each a different cognitive operation |
| `src/nar/rules/processor.ts:128-155` | processLMRules — NOW sequential, observable, abortable |
| `src/nar/reason/reasoner.ts:114-146` | deriveFromSecondary — AbortSignal propagated |
| `src/nar/nar-execution.ts:22-45` | run loop — PhaseTimer tracing + AbortSignal |
| `src/nar/trace/phase-timer.ts` | NEW — flame chart temporal tracing module |
| `src/agent/CognitiveContext.ts` | checkGoalSatisfaction — goal-driven behavior |
| `tests/lm-synergy-demo.txt` | 12-line input that triggers the full cycle |
