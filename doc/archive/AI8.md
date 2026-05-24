# AI8.md: Eliminate Defensive Fallbacks & Type Unsafety

## Motivation

The codebase has pervasive defensive fallbacks that silently fabricate values
(`Truth.NEUTRAL`, `Stamp.createInput()`) instead of trusting type contracts.
This masks real bugs — if a `Task` has no `stamp` or `truth`, the correct
response is to crash early, not invent a value and proceed as if nothing
happened.

22 RED findings and 70+ YELLOW findings were identified in the audit
(see conversation). This document codifies the fix.

---

## Principle: Fail Fast, Not Silent

| ❌ Before | ✅ After |
|---|---|
| `belief?.stamp ?? Stamp.createInput()` | `belief.stamp` (required, trust the type) |
| `truth ?? Truth.NEUTRAL` | `truth` (required, don't default) |
| `task.stamp?.depth ?? 0` | `task.stamp.depth` (stamp is non-nullable) |
| `(memory as any).getGoals?.()` | `memory.getGoals()` (add method or crash) |
| `catch (e) { log(e) }` | `catch (e) { log(e); throw e; }` or return `Result.Err` |

Rationale:
- A `Task` whose stamp is `undefined` is an **invalid task** — it should never
  enter the inference loop. If it does, the constructor or input parser is
  broken. Fabricating a stamp hides that.
- A belief whose truth is `undefined` is an **invalid belief** — reasoning with
  `Truth.NEUTRAL` produces meaningless derivations that pollute memory.
- An `as any` cast that accesses `.getGoals()` on `Memory` is calling a method
  that doesn't exist. Every call returns `undefined`. Every fallback `?? []`
  makes the strategy a silent no-op.

There are legitimate exceptions (see §Exceptions).

---

## Phase 0: Types — Make Required Fields Actually Required

### 0.1 Task.stamp — remove optionality

**Current state:** `Task.stamp` is typed as required (`stamp: Stamp`) but
accessed with `?.` everywhere. Some code fabricates stamps via
`Stamp.createInput()`. Some code stores `stamp?: Stamp` internally.

**Fix:**

1. **Audit `Task` type definition** — ensure `stamp` is non-nullable
   (`readonly stamp: Stamp`, not `stamp?: Stamp`).
2. **Remove all `stamp?.` access** — replace with `stamp.` (crash if
   undefined, which exposes the real bug).
3. **Remove all `stamp ?? Stamp.createInput()`** — if a Task enters the
   system without a stamp, the caller is broken. Fix the caller.
4. **Remove all `stamp ?? Stamp.createInputWithId(...)`** — same.

Files to change:

| File | Line(s) | What |
|---|---|---|
| `src/nar/types/core.ts` | audit | Ensure `Task.stamp` is non-nullable |
| `src/nar/reason/inference-controller.ts` | 211 | `belief?.stamp ?? Stamp.createInput()` → `belief.stamp` |
| `src/nar/reason/inference-controller.ts` | 222, 227 | `task.stamp?.depth`, `task.stamp?.id` → `.depth`, `.id` |
| `src/nar/reason/reasoner.ts` | 146, 151, 168, 172 | `stamp?.depth`, `stamp?.id` → `.depth`, `.id` |
| `src/nar/query/trace.ts` | 169, 212 | `task.stamp?.id` → `task.stamp.id` |
| `src/nar/lm/enrichment.ts` | 122 | `belief.stamp ?? Stamp.createInputWithId('qa')` → `belief.stamp` |
| `src/nar/lm/feedback.ts` | 64 | `belief.stamp ?? Stamp.createInputWithId('context')` → `belief.stamp` |
| `src/nar/rules/processor.ts` | 31 | `StampFactory.derive([...]) ?? StampFactory.createInput()` → if `derive` returns undefined, crash (depth exceeded) or handle explicitly |

### 0.2 Truth — make required on Belief

**Current state:** `Truth` is often optional (`truth?: Truth`). Many paths
silently fall back to `Truth.NEUTRAL`.

**Fix:**

1. Make `Truth` a required field on belief bags (concept's top belief should
   always have truth).
2. Remove `truth ?? Truth.NEUTRAL` everywhere.
3. Where a concept has no belief and no truth exists, **skip derivation**
   rather than inventing neutral truth.

Files to change:

| File | Line(s) | What |
|---|---|---|
| `src/nar/reason/inference-controller.ts` | 174, 209 | `?? Truth.NEUTRAL` → access directly; if absent, skip |
| `src/nar/reason/reasoner.ts` | 71, 117 | `?? Truth.NEUTRAL` → access directly; if absent, skip |
| `src/nar/cognitive/derivation-strategies.ts` | 19, 39 | `?? Truth.NEUTRAL` → access directly |
| `src/nar/rules/processor.ts` | 155, 214, 286 | `?? Truth.NEUTRAL` → access directly |
| `src/nar/reason/strategies/index.ts` | 109 | `concept?.beliefBag.peek()?.truth ?? Truth.NEUTRAL` → guard + direct access |
| `src/nar/lm/enrichment.ts` | 120 | `belief.truth ?? Truth.NEUTRAL` → `belief.truth` |
| `src/nar/lm/parser.ts` | 37, 42, 72, 94 | Remove triple fallback chain |
| `src/nar/lm/LMRule.ts` | 144, 150 | `?? Truth.NEUTRAL` → access directly |
| `src/nar/lm/rules.ts` | 40, 48 | `?? Truth.NEUTRAL` → access directly |
| `src/nar/stream/pipeline.ts` | 44, 68, 212 | `?? Truth.NEUTRAL` → access directly; if absent, skip |
| `src/nar/cognitive/Observer.ts` | 151, 176-196 | `b.truth?.c ?? 0`, `b.truth?.f` → access directly |
| `src/nar/lm/enrichment.ts` | 128 | `t.truth?.f ?? 0` → `t.truth.f` |
| `src/nar/lm/feedback.ts` | 121, 127 | `t.truth?.f ?? 0` → `t.truth.f` |

### 0.3 Task type consistency — with semantic distinction

**Current state:** `Task.truth` is typed as `truth?: Truth` uniformly, but
semantics differ by task type:

| Task type | Truth | Rule |
|---|---|---|
| `belief` | Required | Always has truth (frequency + confidence) |
| `goal` | Required | Always has truth (desire strength) |
| `question` | `null` | Questions are queries, not statements — no truth value |

**Fix:**

1. Keep `Task.truth` as `Truth | null` — questions legitimately have null
   truth.
2. Add a runtime assertion helper for belief/goal paths:
   ```typescript
   function assertBeliefTruth(task: Task): Truth {
     if (task.type !== 'question' && !task.truth) {
       throw new Error(`Bug: ${task.type} task missing truth: ${task.term}`);
     }
     return task.truth!;
   }
   ```
3. Replace `truth ?? Truth.NEUTRAL` in belief paths with
   `assertBeliefTruth(task)`. This crashes early with a clear message
   instead of silently polluting memory with neutral-truth derivations.
4. For question tasks, allow `truth === null` — do not derive from
   questions as premises (they have no truth to reason with).

**Impact on the fix sites in §0.2:** All `truth ?? Truth.NEUTRAL` sites
that operate on belief bags (`concept.beliefBag.peek()?.truth`) remain
correct — beliefs always have truth. The fix is to crash if a belief
lacks truth, not to substitute neutral. Sites operating on arbitrary
`Task.truth` must check `task.type` first.

### 0.4 Budget consistency

**Current state:** `Budget` created ad-hoc in `createBeliefTask` and
`createDerivedTask` via `createBudget(priority)` — losing durability, quality,
and other budget dimensions.

**Fix:**

1. Tasks should carry budget from their source (premise tasks → derived tasks
   inherit budget). Remove ad-hoc `createBudget()` calls.
2. If budget must be created fresh, use the concept's budget as base, not
   `createBudget(priority)`.

---

## Phase 1: Eliminate `as any` Property Access

### 1.1 Cognitive architecture type casts

Fix every `(x as any).property` that accesses something the type system says
doesn't exist. Add the missing method/property to the interface if it should
exist, or use the correct existing method.

| File | Line | Code | Fix |
|---|---|---|---|
| `cognitive/attention-models.ts` | 8 | `(ctx.memory as any).config?.primeBoost` | Move `primeBoost` to `MemoryConfig` and expose via `memory.getConfig().primeBoost` or add `memory.getPrimeBoost()` |
| `cognitive/attention-models.ts` | 23 | `(concept as any).links` | Use `concept.getLinks()` if available, or add `Concept.links` accessor |
| `cognitive/attention-models.ts` | 47 | `(memory as any).getFocus?.()?.getActiveGoals?.()` | Add `Memory.getActiveGoals(): Goal[]` or remove the feature if no goal tracking exists |
| `cognitive/sampling-strategies.ts` | 42 | `(memory as any).getGoals?.() ?? []` | Add `Memory.getGoals(): Goal[]` method |
| `cognitive/lm-selectors.ts` | 34 | `(r as any).category ?? 'general'` | Add `category` to `LMRule` interface |
| `cognitive/controller.ts` | 105 | `(this.currentParams.strategies as any)[key].type` | Properly typed setter |
| `cognitive/registry.ts` | 34 | `(s as any).metadata` | Already filtered, but add proper typing |
| `cognitive/optimizer.ts` | 244-265 | `(nar as any)` throughout | Replace with proper `NAR.reconfigure()` API (see §1.2) |
| `factory.ts` | 141 | `(nar as any).rlfp` | Add proper setter to `NAR` |
| `reason/strategies/index.ts` | 17 | `(strategy as any).metadata` | Accept that `Strategy` interface now has optional `metadata` |

### 1.2 Add proper `NAR.reconfigure()` API

Replace the optimizer's hot-patching with a public method:

```typescript
// nar.ts
class NAR {
  reconfigure(params: CognitiveParameters): void {
    if (!this.cognitiveController) {
      throw new Error('NAR was not created with cognitive architecture enabled');
    }
    this.cognitiveController = new CognitiveController(
      this.config.strategyRegistry!,
      this.memory,
      this.processor,
      this._metricsCollector,
      this.rlfp,
      params,
      this.config.adaptationInterval
    );
    // Swap execution's controller reference
    this.execution = new NARExecution(
      this.memory, this.taskManager, this.reasoner,
      this.config, this.rlfp, this.cognitiveController
    );
  }

  setRLFP(rlfp: RLFPLearner): void {
    this.rlfp = rlfp;
  }
}
```

Then `CognitiveOptimizer.applyConfig()` becomes:
```typescript
this.nar.reconfigure(trialParams);
this.nar.run(10);
```

### 1.3 Processor stamp derive fallback

`processor.ts:31` — `StampFactory.derive([p1.stamp, p2.stamp]) ?? StampFactory.createInput()`

If depth exceeds `DEPTH_MAX`, derive should either:
- Return the stamp with depth capped rather than undefined
- The caller should check depth before deriving, not fabricate a new stamp

---

## Phase 2: Eliminate Silent Catch Blocks

### 2.1 Truly empty catches

| File | Line | Code | Fix |
|---|---|---|---|
| `self/SelfAnalyzer.ts` | 304-305 | `.catch(() => {})` | Log error at minimum, or return error result |
| `tools/guided.ts` | 20-22 | `catch { return false; }` | Log error, return `{ success: false, error: message }` |

### 2.2 Log-only catches that should rethrow or return error

Review every `catch (e) { logger.warn(...) }` (or similar) block in:
- `rules/processor.ts` (rule error → event bus — document as acceptable if events are monitored)
- `reason/strategies/index.ts` (CompositeStrategy failing — remove try/catch, let crash)
- `lm/enrichment.ts` (4 instances)
- `lm/feedback.ts` (2 instances)
- `lm/dynamic-rules.ts`
- `lm/LMRule.ts`
- `memory/serialization.ts` (3 instances)

For each, decide: is this an expected failure mode (accept fallback) or a bug
(shoud rethrow)? Mark with comments.

### 2.3 CompositeStrategy error swallowing

`reason/strategies/index.ts:136-138` — `catch (error) { logger.warn(...) }`
- A strategy that throws is broken. Remove the try/catch, let it crash.
- Or, if robustness is required, collect errors and surface them to the
  caller (don't silently continue with partial results).

---

## Phase 3: Remove Phantom Method Calls

### 3.1 `GoalBiasedSampling` — `memory.getGoals()`

`SamplingStrategy.sample(memory, count)` receives a `Memory` instance. If
goal-biased sampling needs goal information, either:
- Add `getGoals(): Goal[]` to the `Memory` interface, or
- Pass goals as part of `AttentionContext` or a separate parameter

Current code silently calls `(memory as any).getGoals?.()` which always
returns `undefined`. Fix by making this an actual interface method.

### 3.2 `GoalRelevanceAttention` — `memory.getFocus()`

Same pattern. Either add `getActiveGoals()` to `Memory` or remove the feature
if no goal tracking infrastructure exists. Don't call phantom methods.

### 3.3 `SpreadingActivation` — `concept.links`

Concept has `getLinks()` method. Use it instead of `(concept as any).links`.

### 3.4 `LMRule.diverse` category access

`(r as any).category ?? 'general'` — either add `category` to `LMRule`
interface, or remove the diverse selector if categories aren't a real concept.

---

## Phase 4: Fix Constructor Default Dependencies

### 4.1 Memory.attentionModel — make required, not defaulted

```typescript
// memory.ts — instead of optional + fallback
constructor(config: MemoryConfig, attentionModel: AttentionModel) {
  this.attentionModel = attentionModel;
  ...
}
```

Update call sites to always pass one. `NAR.createAttentionModel()` already
resolves one — just don't allow `undefined` through.

### 4.2 RLFPLearner dependencies — make required

```typescript
// RLFPLearner.ts — don't silently create defaults
constructor(config: { rewardModel: RewardModel; preferenceCollector: PreferenceCollector }) {
  this.rewardModel = config.rewardModel;
  this.preferenceCollector = config.preferenceCollector;
}
```

### 4.3 Lifecycle BaseComponent — require shared singletons

```typescript
// BaseComponent.ts — make logger/metrics/eventBus required
constructor(context: { logger: Logger; metrics: MetricsCollector; eventBus: EventBus }) {
```

---

## Phase 5: Strengthen Stamp Type

### 5.1 Make `stamp.id` non-optional

The `Stamp.id` field should be a required `string` (never undefined). If a
stamp has no id, it's not a valid stamp. Currently `stamp.id` is checked with
`?.` throughout.

### 5.2 Remove `stamp: Stamp.createInput()` from derivation paths

Derived tasks should carry stamps derived from their premises. Never fabricate
a fresh input stamp for a derived task — that loses provenance.

### 5.3 Rename `Stamp.createInput()` ambiguity

`Stamp.createInput()` is used both for:
- Creating stamps for actual external input (legitimate)
- Creating fallback stamps when real stamp is missing (illegitimate)

Consider renaming or separating these paths so the fallback usage stands out.

---

## Phase 6: Remove Truth.NEUTRAL from Inference Paths

### 6.1 Derivation strategies

`derivation-strategies.ts` creates `p2` with `truth: secondary.truth ?? Truth.NEUTRAL`.
If a secondary task has no truth, it shouldn't be used for inference. Skip it.

### 6.2 Processor truth function fallback

`processor.ts:155`: `truthFn(p1.truth, p2.truth) ?? Truth.NEUTRAL`
- If a truth function returns undefined, that's a bug in the truth function.
  Don't mask it with neutral.

### 6.3 CreateDerivedTask in inference-controller

`createDerivedTask` maps `result.truth` directly. If `RuleResult.truth` is
optional, make it required. If a rule produces a result without truth, the
rule is broken.

---

## Phase 7: Audit & Fix Remaining Patterns

### 7.1 Destructuring with `?? {}`

```typescript
// rules/shared.ts:36
const {s1, p1, s2, p2} = extractInhPair(inh1, inh2) ?? {};
// terms/unifier.ts:81
s = unify(next, nextB, s ?? {}, enableOccursCheck);
```

If the function returns undefined, crash — don't silently substitute an empty
object.

Also applies to `nal-extended.ts:176,216` — same `extractInh(inh1) ?? {}` pattern.

### 7.2 `(this as any).field = value` in reconfigure

`inference-controller.ts:63-65`: Assign to `readonly` private fields via
`(this as any)`. Either:
- Make fields writable (remove `readonly`)
- Add a proper setter
- Recreate the controller instead of mutating

### 7.3 `JSON.stringify` deep comparison in adapt()

`controller.ts:70`: `JSON.stringify(newParams.strategies) !== JSON.stringify(this.currentParams.strategies)`
- Order-dependent, fragile. Use `fast-deep-equal` or structured comparison.

---

## Exceptions (Legitimate Defaults)

These patterns are acceptable and should remain:

1. **Parser fallbacks**: LM parser producing `truth ?? defaultTruth ?? Truth.NEUTRAL`
   is acceptable — the parser sits at the system boundary where input is
   inherently unreliable. The triple chain should be collapsed to a single
   fallback with explicit documentation.

2. **Configuration defaults**: `config.xxx ?? default` — setting default values
   for optional config fields is the correct pattern.

3. **Factory functions**: `createTask` and `createSecondaryTask` providing
   sensible defaults for optional parameters is legitimate — these are
   construction helpers, not inference-path fallbacks.

4. **LM client fallback chain**: `catch (error) { tryNextProvider() }` — the
   retry/fallback pattern for external LM calls is correct (network failures
   are an expected failure mode).

5. **Tool error results**: `catch (e) { return errorResult(e) }` — tools
   returning error results instead of throwing is the correct pattern.

6. **System-boundary `as any` casts**: LM provider adapters
   (`lm/defaults.ts`, `lm/providers.ts`), PEG parser output
   (`parser-peggy.ts`), serialization (`serialization.ts`), and similar
   boundary code where data enters from untyped sources. These should have
   a `// system boundary — untyped input` comment.

7. **Pub-sub event listener errors** (`events.ts:77-79`): Event bus
   listener errors are intentionally isolated per the observer pattern.
   The correct fix is to emit an error event, not crash the bus. Document
   with comment.

---

## Audit Coverage Map

Every finding from the codebase audit is accounted for below.

**RED = must fix. YELLOW = address per category.**

### RED findings (22) — all covered

| # | File:Line | Pattern | Plan § |
|---|---|---|---|
| 1 | `inference-controller.ts:211` | `stamp ?? Stamp.createInput()` | §0.1 |
| 2 | `enrichment.ts:122` | `stamp ?? Stamp.createInputWithId('qa')` | §0.1 |
| 3 | `feedback.ts:64` | `stamp ?? Stamp.createInputWithId('context')` | §0.1 |
| 4 | `processor.ts:31` | `StampFactory.derive() ?? createInput()` | §1.3 |
| 5 | `inference-controller.ts:174` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 6 | `inference-controller.ts:209` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 7 | `reasoner.ts:71` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 8 | `reasoner.ts:117` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 9 | `strategies/index.ts:109` | `?.truth ?? Truth.NEUTRAL` | §0.2 |
| 10 | `derivation-strategies.ts:19` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 11 | `derivation-strategies.ts:39` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 12 | `enrichment.ts:120` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 13 | `pipeline.ts:44` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 14 | `pipeline.ts:68` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 15 | `pipeline.ts:212` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 16 | `optimizer.ts:244` | `(nar as any).cognitiveController = ...` | §1.2 |
| 17 | `optimizer.ts:265` | `(nar as any).input(task)` | §1.2 |
| 18 | `attention-models.ts:8` | `(memory as any).config` | §1.1, §3 |
| 19 | `attention-models.ts:23` | `(concept as any).links` | §1.1, §3.3 |
| 20 | `attention-models.ts:47` | `(memory as any).getFocus?.()` | §1.1, §3.2 |
| 21 | `sampling-strategies.ts:42` | `(memory as any).getGoals?.()` | §1.1, §3.1 |
| 22 | `SelfAnalyzer.ts:304` | `.catch(() => {})` | §2.1 |
| 23 | `guided.ts:20` | `catch { return false; }` | §2.1 |
| 24 | `inference-controller.ts:222` | `task.stamp?.depth` (required) | §0.1 |
| 25 | `inference-controller.ts:227` | `task.stamp?.id` (required) | §0.1 |
| 26 | `reasoner.ts:146` | `stamp?.depth` (required) | §0.1 |
| 27 | `reasoner.ts:151` | `stamp?.id` (required) | §0.1 |
| 28 | `reasoner.ts:168` | `stamp?.id ?? ''` (required) | §0.1 |
| 29 | `reasoner.ts:172` | `stamp?.depth ?? 0` (required) | §0.1 |
| 30 | `trace.ts:169` | `task.stamp?.id` (required) | §0.1 |
| 31 | `trace.ts:212` | `task.stamp?.id` (required) | §0.1 |

### YELLOW findings covered by plan phases

| # | File:Line | Pattern | Plan § |
|---|---|---|---|
| 32 | `processor.ts:122-124` | Rule error caught, event emitted | §2.2 — document as acceptable |
| 33 | `processor.ts:155` | `truthFn() ?? Truth.NEUTRAL` | §6.2 |
| 34 | `processor.ts:214,286` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 35 | `LMRule.ts:144,150` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 36 | `rules.ts:40,48` | `truth ?? Truth.NEUTRAL` | §0.2 |
| 37 | `parser.ts:37,42,72,94` | Triple fallback chain | §0.2 |
| 38 | `strategies/index.ts:136-138` | Log-only catch | §2.3 |
| 39 | `enrichment.ts:82-83,104-105,140-142,181-183` | Log-only catches | §2.2 |
| 40 | `feedback.ts:81-83,106-108` | Log-only catches | §2.2 |
| 41 | `dynamic-rules.ts:178-180` | Log-only catch | §2.2 |
| 42 | `LMRule.ts:76-82` | Log-only catch | §2.2 |
| 43 | `serialization.ts:69-71,105-107,138-140` | Log-only catches | §2.2 |
| 44 | `memory.ts:103` | `new SimpleAttention()` default | §4.1 |
| 45 | `nar.ts:517-518` | Double fallback to SimpleAttention | §4.1 |
| 46 | `RLFPLearner.ts:31,33` | Default deps created silently | §4.2 |
| 47 | `BaseComponent.ts:27-29` | Triple default creation | §4.3 |
| 48 | `inference-controller.ts:63-65` | `(this as any).field =` | §7.2 |
| 49 | `factory.ts:141` | `(nar as any).rlfp =` | §1.2 (NAR.setRLFP()) |
| 50 | `controller.ts:105` | `(strategies as any)[key]` | §1.1 |
| 51 | `controller.ts:70` | `JSON.stringify` comparison | §7.3 |
| 52 | `registry.ts:34` | `(s as any).metadata` | §1.1 |
| 53 | `strategies/index.ts:17` | `(strategy as any).metadata` | §1.1 |
| 54 | `inference-controller.ts:218` | `truth?.f ?? 0.5` | §0.2 |
| 55 | `reasoner.ts:142` | `truth?.f ?? 0.5` | §0.2 |
| 56 | `derivation-strategies.ts:43,47,54` | `result.truth?.f ?? 0` | §0.2 |
| 57 | `Observer.ts:151` | `b.truth?.c ?? 0` | §0.2 |
| 58 | `enrichment.ts:128` | `t.truth?.f ?? 0` | §0.2 (add to file list) |
| 59 | `feedback.ts:121,127` | `t.truth?.f ?? 0` | §0.2 (add to file list) |
| 60 | `shared.ts:36` | `extractInhPair() ?? {}` | §7.1 |
| 61 | `unifier.ts:81` | `s ?? {}` | §7.1 |
| 62 | `nal-extended.ts:176,216` | `extractInh() ?? {}` | §7.1 (add to file list) |
| 63 | `lm-selectors.ts:34` | `(r as any).category` | §1.1 |

### YELLOW findings — accepted exceptions (documented only)

These are at system boundaries where untyped data enters. They should be
documented with comments but not refactored.

| # | File:Line | Pattern | Rationale |
|---|---|---|---|
| 64 | `lm/defaults.ts:122,207` | `(modelInstance as any).doGenerate()` | LM provider SDKs have untyped APIs |
| 65 | `lm/providers.ts:7` | `ollama as any` | Third-party library, no types |
| 66 | `model-registry.ts:99-105` | `catch → try next` | LM fallback chain is expected |
| 67 | `router.ts:95-101` | `catch → retry` | LM retry is expected |
| 68 | `parser-peggy.ts:45-49` | `(result as any).term` | Parser output is inherently dynamic |
| 69 | `serialization.ts:66` | `(term as any).symbol` | Serialization deals with untyped data |
| 70 | `rule-builder.ts:28` | `(t as any).isVariable` | Variable detection on untyped terms |
| 71 | `LearnTool.ts:43` | `'belief' as any` | String literal for API boundary |
| 72 | `RLFPLearner.ts:114` | `s.data as any` | Trajectory data is dynamic |
| 73 | `logger/index.ts:114` | `(parent as any).emit` | Dynamic parent reference |
| 74 | `events.ts:77-79` | `catch { console.error }` | Pub-sub listener errors are isolated |
| 75 | `api.ts:151-153` | `catch → return null` | Parsing failure at query boundary |
| 76 | `serialize.ts:45-48` | `catch → return null` | Deserialization failure at boundary |
| 77 | `SelfAnalyzer.ts:259-266` | `catch → error result` | Returns error, doesn't swallow |
| 78 | `SelfAnalyzer.ts:273-275` `:172-174` | `catch → error result` | Same pattern |

---

## Implementation Order

| Phase | What | Files | Verification |
|---|---|---|---|
| **0** | Types: make stamp/truth required, fix access patterns | `types/core.ts`, `inference-controller.ts`, `reasoner.ts`, `trace.ts`, `enrichment.ts`, `feedback.ts` | `stamp?.` → `stamp.` everywhere; TypeScript catches missing stamps |
| **1** | Types: remove `Truth.NEUTRAL` fallbacks | `inference-controller.ts`, `reasoner.ts`, `derivation-strategies.ts`, `processor.ts`, `strategies/index.ts`, `pipeline.ts`, `lm/enrichment.ts` | No `truth ?? Truth.NEUTRAL` remains in inference paths |
| **2** | Architecture: fix `as any` casts in cognitive | `attention-models.ts`, `sampling-strategies.ts`, `lm-selectors.ts`, `controller.ts`, `registry.ts` | Add missing interface methods; all cognitive code type-checks without `any` |
| **3** | Architecture: add `NAR.reconfigure()` | `nar.ts`, `optimizer.ts` | Optimizer calls `nar.reconfigure()` instead of `(nar as any).xxx = ...` |
| **4** | Error handling: fix empty catches | `SelfAnalyzer.ts`, `guided.ts` | Empty `catch {}` blocks gone |
| **5** | Error handling: audit log-only catches | `lm/enrichment.ts`, `lm/feedback.ts`, `strategies/index.ts` | Every catch either rethrows or has a documented reason |
| **6** | Phantom methods: add real interfaces | `Memory.getGoals()`, `Memory.getActiveGoals()`, `Concept.getLinks()` usage | No `(memory as any).getGoals?.()` — real method calls |
| **7** | Constructors: make deps required | `memory.ts`, `RLFPLearner.ts`, `BaseComponent.ts` | No silent `new SimpleAttention()` defaults |
| **8** | Remaining: destructuring, `JSON.stringify`, `(this as any)` | `shared.ts`, `unifier.ts`, `inference-controller.ts`, `controller.ts` | All cleanup items resolved |

---

## Success Criteria

1. **Zero `Truth.NEUTRAL` fallbacks in inference paths** — searched with
   `rg "Truth\.NEUTRAL" src/nar/` should only return results in:
   - Parser boundary (`lm/parser.ts`)
   - Factory helpers (`types/core.ts`)
   - Test files

2. **Zero `stamp ?? Stamp.createInput`** — `Stamp.createInput()` should only
   appear in actual input construction paths.

3. **Zero `(x as any).method?.()`** — all method calls are on real interfaces.

4. **Zero empty `catch {}` blocks** — every catch either rethrows, returns
   error result, or has an explicit `// expected: ...` comment.

5. **Zero `(this as any).field = value`** in reconfigure — use proper setters.

6. `tsc` compiles cleanly (already does, but should stay clean with *more*
    strictness, not less).

---

## Implementation Progress (May 23, 2026)

### Phase 0: COMPLETE ✓
All defensive fallbacks removed from inference paths:
- `Task.stamp` — removed `stamp?.` optional chaining in 4 files, removed `Stamp.createInput()` fallbacks
- `Task.truth` — removed `truth ?? Truth.NEUTRAL` from all inference paths
- Added `assertBeliefTask()` runtime assertion helper
- System boundary fallbacks (parser, tools, IO) documented with `// system boundary` comments

**Files modified:** inference-controller.ts, reasoner.ts, trace.ts, stamp.ts, processor.ts, derivation-strategies.ts, pipeline.ts, enrichment.ts, feedback.ts, parser.ts, rules.ts, LMRule.ts, input.ts, nar-io.ts, LearnTool.ts, ReasonTool.ts, guided.ts, strategies/index.ts, Observer.ts

### Phase 1: ~90% DONE
Eliminated `(x as any)` property access in cognitive architecture:
- Fixed `attention-models.ts` (3 casts: config, links, getFocus)
- Fixed `sampling-strategies.ts` (getGoals)  
- Fixed `lm-selectors.ts` (category) — added `category` to `LMRuleConfig`/`LMRule`
- Fixed `controller.ts` (strategies setter)
- Fixed `registry.ts` (metadata access)
- Fixed `strategies/index.ts` (metadata assignment)
- Added methods: `Focus.getActiveGoals()`, `Memory.getGoals()`, `Memory.getConfig()`

**Still remaining:** `NAR.reconfigure()` + `NAR.setRLFP()` needed for `optimizer.ts` and `factory.ts`

### Phases 2-7: NOT STARTED
- Phase 2: Fix log-only catches (lm/dynamic-rules, lm/enrichment, lm/feedback, lm/LMRule, serialization)
- Phase 3: Phantom method calls (mostly resolved by Phase 1 method additions)
- Phase 4: Constructor default deps (memory.ts, RLFPLearner.ts, BaseComponent.ts)
- Phase 5: Strengthen Stamp type (derive() caps at DEPTH_MAX — done in Phase 0.1)
- Phase 6: Remove Truth.NEUTRAL from inference paths (done in Phase 0)
- Phase 7: Audit remaining patterns (shared.ts, unifier.ts, nal-extended.ts, controller.ts)
