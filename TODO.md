# SeNARS Agent Development Plan

## A. Elimination of Redundancy (Structural Cleanup First)

### A.1 Merge LMRule v1 + LMRuleV2Runner into a single unified `LMRule` class
- In `src/nar/lm/LMRule.ts`, redesign `LMRule` to incorporate v2's typed features:
  - Add optional `outputSchema: ZodSchema` field for structured output.
  - Add optional `inputSchema: ZodSchema` for typed input validation.
  - Add optional `validate(output): ValidationResult` method (from v2's `LMRuleV2` interface).
  - Add `promptTemplate: string | ((input: unknown, context: LMContext) => string)` — accept both the v1 string template and v2's function-based template.
  - Add `LMContext` type (from v2) as the standard context object passed to `apply()`.
  - Add `structuredModel: LanguageModel` for AI SDK structured generation path.
  - Keep circuit breaker, EventBus integration, LMClient fallback, stats tracking.
- Merge v2's 5 preset rules into the v1 rule definitions in `lm-rule-factory.ts` — they are not different kinds of things.
- Verify no caller depends on `LMRuleV2` or `LMRuleV2Runner` by name — remove `rule-factory-v2.ts` entirely once merged.
- Delete `src/nar/lm/rule-factory-v2.ts`. The `LMRuleFactory` in `lm-rule-factory.ts` is the single factory.

### A.2 Unify three parallel LM Rule application methods in RuleProcessor
- `RuleProcessor` currently has three nearly-identical methods:
  - `processLMRules(p1, p2)` — called by `process()` async generator.
  - `processLMRulesExternal(p1, p2, signal)` — called by `reasoner.step()` and `inference-controller.step()`.
  - `processLMRulesSingle(p1, signal)` — variant with `lmRule.apply(p1.term, p1.term)`.
- Replace all three with a single method:
  ```
  processLMRules(p1: RuleInput, p2?: RuleInput, opts?: {signal?: AbortSignal; singlePremise?: boolean}): AsyncGenerator<RuleResult>
  ```
- When `p2` is omitted or `singlePremise` is true, each LM Rule is called with `(p1.term, p1.term)`.
- When `p2` is provided and `singlePremise` is false, each LM Rule is called with `(p1.term, p2.term)`.
- Update all callers (reasoner.ts, inference-controller.ts, DefaultDerivation.ts, AnytimeDerivation.ts) to use the unified method.
- Remove the now-obsolete `processLMRulesExternal` and `processLMRulesSingle`.

### A.3 Extract shared routing logic from agent.ts
- `chat()`, `chatWithHistory()`, and `chatStream()` each contain a copy of the same decision chain:
  ```
  parseNarsese → nlTranslation → dispatchToLM
  ```
- Extract a single async generator `processInput(input, session, opts)` that implements the unified flow (Section B).
- All three public methods become thin wrappers that call `processInput()` and format the result appropriately:
  - `chat()` → calls `processInput()`, awaits the final value.
  - `chatWithHistory()` → calls `processInput()` with session, awaits the final value.
  - `chatStream()` → yields events from `processInput()` as they arrive.
- This eliminates the triple-maintenance problem.

### A.4 Simplify NlBridge to remove NL→Narsese duplication
- `NlBridge` has `nlToNarsese()` which duplicates `NLUnderstandingService.understand()`.
- `NlBridge` is used by:
  - `createNlInputTranslation()` middleware — intercepts NL input, translates, feeds NAR, returns summary.
  - `createNarseseOutputHumanization()` middleware — converts Narsese output to NL via `interpretDerivation()`.
- Remove `createNlInputTranslation()` middleware entirely. Its function is subsumed by the unified `processInput()` routing (B.1).
- Keep `createNarseseOutputHumanization()` middleware but have it call `NLGenerationService.generate()` directly instead of going through `NlBridge.interpretDerivation()`.
- Remove `NlBridge`, `NlBridgeDeps`, `createNlBridge()`, `nl-bridge.ts`. The io-bridge creates NLGenerationService directly.
- Delete `src/agent/nl-bridge.ts`.

### A.5 Consolidate learn-tool / process-tool / reason-tool (NAR-internal tools)
- The NAR's internal tool system (`src/nar/tools/`) has parallel implementations:
  - `LearnTool.ts`, `ProcessTool.ts`, `ReasonTool.ts`, `ExplainTool.ts`, `SearchTool.ts`, `CalculateTool.ts`, `HTTPTool.ts`, `FileTools.ts`, `TimerTool.ts`, `SleepTool.ts`, `BraveSearchTool.ts`
  - These are NAR-internal tools (different from the Agent's `aisdk-adapter.ts` tools).
  - The Agent's external tools (`nar_believe`, `nar_query`, `nar_reason` in `aisdk-adapter.ts`) overlap with `ReasonTool`, `LearnTool`, `SearchTool`.
- Audit the NAR-internal tools for overlap with the Agent's AI SDK tool set. Remove any that duplicate Agent-level functionality.
- Keep only NAR-internal tools that are called by NAR's own reasoning (operations in Narsese), not by the Agent's LM tool loop.
- Delete files for tools that are purely duplicated by Agent-level tools.

---

## B. Unified Input Processing Flow

### B.1 The `processInput()` routing function
- Single location in `src/agent/agent.ts` (or extracted to `src/agent/input-processor.ts`):

```
processInput(input, session?, opts?):
  1. parseNarsese(input)?
     ├─ YES → nar.input(term, type, truth)
     │         inline nar.run(steps)
     │         question answered? → NLGenerationService → reply
     │         otherwise → reply "Queued"
     │         (skip all LM steps)
     │
     └─ NO → NLUnderstandingService.understand(input, context)
               ├─ returns null → dispatchToLM(input, opts) (ModelRunner)
               │
               └─ returns TaskBatch →
                    detectedIntent:
                    ├─ 'chat' → dispatchToLM(input, opts) (ModelRunner, no NAR feed)
                    │
                    ├─ 'reasoning' | 'learning' | 'command' →
                    │   1. Feed NAR: beliefs → nar.believe(), questions → nar.question(),
                    │      goals → nar.goal(), driveModulations → driveManager.stimulate()
                    │   2. If ambiguities detected → return clarification question (don't feed NAR)
                    │   3. inline nar.run(steps) — NAL + LM Rules fire
                    │   4. Collect NAR state after reasoning:
                    │      - answered questions from recent derivations
                    │      - new high-confidence beliefs from LM Rules
                    │      - sub-goals created from lm-goal-decomposition
                    │   5. If significant results found:
                    │      NLGenerationService.generate(derivations, input) → NL reply
                    │   6. Else: simple confirmation
                    │
                    └─ done → yield reply
```

### B.2 The three public methods become thin wrappers
- `chat(input, opts)`:
  ```
  for await (const event of processInput(input, undefined, opts)) { /* consume */ }
  return finalEvent.value
  ```
- `chatWithHistory(input, session, opts)`:
  ```
  for await (const event of processInput(input, session, opts)) {
    appendTurn(session, ...)
  }
  trimHistory(session)
  return finalEvent.value
  ```
- `chatStream(input, session, opts)`:
  ```
  for await (const event of processInput(input, session, opts)) {
    yield event  // text-delta, tool-call, tool-result, finish
  }
  ```

### B.3 Ambiguity handling
- When `TaskBatch.meta.ambiguities.length > 0`, the unified flow returns a `clarify` event instead of feeding NAR.
- `chat()` and `chatWithHistory()` return the clarification question string.
- `chatStream()` yields a `{kind: 'clarify', question: string}` event.

### B.4 No-drive-regex path
- `tryDriveStimulation()` and `DRIVE_PATTERNS` are deleted.
- Drive modulation comes only from `TaskBatch.driveModulations` (output by LLM during NL Understanding).
- When `detectedIntent` is `'command'` and `driveModulations` is present, apply to `driveManager.stimulate()`.

---

## C. Single Unified LMRule with Structured Output

### C.1 Upgrade unified LMRule to support AI SDK `generateObject`
- In `src/nar/lm/LMRule.ts`, add:
  ```ts
  private structuredModel?: LanguageModel;
  setStructuredModel(model: LanguageModel): void;
  ```
- Add `executeStructured(prompt, schema)` method:
  ```
  generateObject({model: this.structuredModel, prompt, schema})
  ```
- In `apply()`, when `this.structuredModel` is set AND `this.outputSchema` is set:
  - Call `executeStructured()`.
  - Parse the structured output into tasks using the schema's shape.
  - Skip the `LMClient.generateText()` → `LMResponseParser` path.
- When structured model is absent or schema is unset:
  - Fall back to existing `LMClient.generateText()` → `responseProcessor` → `taskGenerator` path.

### C.2 Map all 13 (+ 5) preset rules to zod schemas
- In `src/nar/nl/schemas.ts`, ensure every LM Rule has a corresponding output schema.
- Add missing schemas:
  - `BeliefRevisionSchema`
  - `QuestionGenerationSchema` (for curiosity-driven questions)
- In `src/nar/lm/lm-rule-factory.ts`, add `schema: ZodSchema` to each `LMRuleDefinition`.
- Pass `schema` to `LMRule` constructor so `apply()` knows which schema to use.
- All rule schemas already exist in `schemas.ts` except `BeliefRevisionSchema` and `QuestionGenerationSchema`.

### C.3 Richer context for LM Rule application
- In `src/nar/rules/processor.ts`, the single unified `processLMRules()` method (A.2) should assemble:
  ```ts
  const ruleContext = {
    conceptPriority: maxPriority,
    taskTerm: p1.term.toString(),
    secondaryTerm: p2?.term.toString(),
    taskType: /* from the active task */,
    relatedBeliefs: /* top-5 beliefs matching premise terms from memory */,
    activeGoals: /* current goals from NAR */,
    driveState: /* current drive levels */,
    conflictCount: /* contradictions involving this concept */,
    memoryPressure: memory.getStatistics().memoryPressure,
    totalConcepts: memory.getStatistics().totalConcepts,
  };
  ```
- This gives LM Rules the same awareness that NLUnderstandingService gets from ContextAssembler.

### C.4 Add curiosity-driven question rule
- In `lm-rule-factory.ts`, add rule:
  ```ts
  {id: 'lm-curiosity-question', name: 'LMCuriosityQuestionRule',
   description: 'Generates questions from high-curiosity concepts',
   priority: 0.65, taskType: 'question', budget: 0.5, singlePremise: true,
   schema: QuestionGenerationSchema,
   activationCondition: (primary, secondary, ctx) => {
     const curiosity = ctx?.driveState?.curiosity ?? 0;
     return curiosity > 0.6;
   }}
  ```
- Prompt: `"Generate a Narsese question about '{{primaryTerm}}' that would expand understanding of this topic."`
- No separate timer or polling loop — activated during normal NAR reasoning when curiosity drive is high.

### C.5 Add LM Rule tool delegation
- In the unified `LMRule.apply()`, after structured output is received:
  - If the output contains `{tool: string, args: object}` instead of Narsese content, attempt to dispatch to the Agent's tool system.
  - Tool dispatch is done via an injected `toolDispatcher: (name, args) => Promise<unknown>` callback on LMRule.
  - The tool result is fed back to the LM for a second call to convert to Narsese tasks.
  - Gate with `enableTools` option in `LMRuleConfig` (default false).
- This lets LM Rules call `web_search`, `code_exec`, `http_fetch` during hypothesis generation or concept elaboration.

---

## D. Agent-LM Rule Event Bridge

### D.1 LM Rule events
- In unified `LMRule.apply()`, emit on EventBus:
  - `lm.rule:applied` with `{ruleId, ruleName, primaryTerm, secondaryTerm?, tasksProduced, durationMs, timestamp, schema?}`
  - `lm.rule:skipped` with `{ruleId, ruleName, reason: 'circuit_open'|'disabled'|'activation_failed'|'single_premise_missing'}`
  - `lm.rule:structured` when structured output path used (with `{schema, output}`)
- These replace the existing `lm.prompt` / `lm.response` / `lm.failure` events with typed structured events.

### D.2 Agent subscribes to NAR EventBus
- In `src/agent/agent.ts` `createAgent()`, when `nar` is available:
  - Subscribe to `nar.eventBus` for `lm.rule:*` events.
  - Forward as `AgentEventBus` events: `agent:lm-rule:applied`, `agent:lm-rule:skipped`.
  - Subscribe to `nar:derivation`, `nar:concept:activated`, `nar:goal:resolved`, `nar:conflict:detected`.
  - Forward as `agent:nar:*` events.
- Add `on('agent:lm-rule:applied', handler)` to Agent interface.
- Add `on('agent:nar:derivation', handler)` to Agent interface.

### D.3 Agent API for LM Rule runtime control
- Add to Agent:
  - `getLmRuleStats(): LMRuleStats[]` — per-rule: calls, successes, failures, circuit state, avg duration.
  - `getLmRuleExecutionLog(): LMRuleExecutionEntry[]` — recent rule activations.
  - `enableLmRule(id: string): void`
  - `disableLmRule(id: string): void`
  - `setLmRulePriority(id: string, priority: number): void`

---

## E. Proactive Notification (Event-Driven, No Polling)

### E.1 Create src/agent/ProactiveEngine.ts
- Constructor takes `AgentEventBus`, `NLGenerationService`, configuration.
- Subscribes to:
  - `agent:nar:derivation` — new derivations with confidence > threshold.
  - `agent:lm-rule:applied` — significant LM Rule activations (goal decomposition, hypothesis generation).
  - `agent:nar:goal-resolved` — goals that were achieved.
- For each significant event, generates NL notification via `NLGenerationService.generate()`.
- Rate-limited: 1 notification per `cooldownMs` (env `PROACTIVE_COOLDOWN_MS`, default 30s).
- Threshold: `confidenceThreshold` (env `PROACTIVE_CONFIDENCE_THRESHOLD`, default 0.7).
- Exposes `onNotify(callback: (msg: string) => void)`.
- Env gate: `SENARS_AUTONOMY_BROADCAST=true`.

### E.2 Wire ProactiveEngine in REPL and Bot
- In `src/bin/repl.ts`, create `ProactiveEngine`, set `onNotify` to `console.log`.
- In `src/bin/bot-ai.ts`, create `ProactiveEngine`, set `onNotify` to broadcast to active connections.

---

## F. Adaptive Background Reasoning (Event-Driven, No Fixed Interval)

### F.1 Create src/agent/CognitiveScheduler.ts
- Constructor takes `NAR`, `AgentEventBus`, configuration.
- Subscribe to forwarded NAR events (D.2):
  - `agent:nar:derivation` → enqueue 1 step.
  - `agent:nar:concept-activated` → enqueue 1 step if queue empty.
  - `agent:lm-rule:applied` → enqueue 1 step to integrate LM Rule results.
  - `task:added` from NAR EventBus directly → enqueue 1-3 steps (goal=3, question=2, belief=1).
- Process queue with `maxStepsPerTick` (env `MAX_STEPS_PER_TICK`, default 3).
- Fall back to idle step every `idleIntervalMs` when queue empty (env `IDLE_REASONING_INTERVAL_MS`, default 10s).
- Methods: `start()`, `stop()` (returns `() => void`), `pause()`, `resume()`.
- Replace `setInterval` in `agent.ts` `start()` with `scheduler = new CognitiveScheduler(...).start()`.

### F.2 Interrupt and resume on user input
- `processInput()` (B.1) calls `scheduler.pause()` at start, `scheduler.resume()` at end.
- On resume, enqueue an immediate reasoning step to integrate any new NAR state from the user's input.

---

## G. NL Understanding Resilience

### G.1 Structured output fallback chain in NLUnderstandingService
- `understand()` fallback order:
  1. AI SDK `generateObject` with structured model (cloud:quality or local:quality).
  2. AI SDK `generateText` with quality model, requesting JSON matching `TaskBatchSchema`, then `JSON.parse`.
  3. Raw Narsese parser heuristics: `"X is Y"` → `(X --> Y).`, `"is X Y?"` → `(X --> Y)?`, etc.
  4. Return null → caller treats as chat intent.
- Each fallback level is attempted with retries per the existing `maxRetries` param.

### G.2 NL generation fallback in NLGenerationService
- `generate()` fallback order:
  1. AI SDK `generateObject` with structured model.
  2. AI SDK `generateText` with prompt requesting `GenerationOutputSchema` fields as plain text, then regex extraction.
  3. Template fallback: `"Based on reasoning: {best.term} (f={f}, c={c})"`.
- Keep existing `fallbackGenerate()` for the last-resort path.

### G.3 Translation cache persistence
- `TranslationCache.serialize(): string` and `TranslationCache.deserialize(json)`.
- Load from `TRANSLATION_CACHE_PATH` env on service construction.
- Auto-flush every 100 new entries via internal counter.
- TTL eviction on read (default 1 hour).

---

## H. Event-Driven Reasoning via NAR Execution

### H.1 Connect CognitiveScheduler to NARExecution
- `CognitiveScheduler` should not call `nar.run()` directly for each event.
- Instead, batch pending reasoning steps and call `nar.execution.run(count)` less frequently.
- Minimum batch interval: 500ms (to avoid overwhelming the NAR cycle).
- This means events are collected into a buffer, flushed every `batchIntervalMs`.

### H.2 NARExecution LM Rule events
- In `src/nar/nar-execution.ts`, after each cycle's `reasoner.step()`, emit `nar:reasoning:cycle` with `{cycleCount, derived, durationMs, lmRulesFired: number}`.
- This gives the CognitiveScheduler visibility into how many LM Rules actually fired, for adaptive scheduling.

---

## I. Constitutional Reasoning

### I.1 Pre-execution check in Agent NARS tools
- In `src/nar/tools/adapters/aisdk-adapter.ts`, wrap `nar_believe` and `nar_goal`:
  - Parse the statement, call `nar.checkConstitutionViolation()` via injected NAR reference.
  - On violation, return `{error: "Constitution violation: <clause>", status: "rejected"}`.
- Add `constitutionEnforcement: boolean` parameter to `createNARSTools()` (default true).

### I.2 Pre-commit check in LM Rules
- In unified `LMRule.taskFromProcessed()`, before creating the Task:
  - If a constitution reference is available (injected reference to `nar`), call `nar.checkConstitutionViolation()` on the proposed term.
  - On violation: log `lm.rule:constitution-violation` event, return no-op task.
- Add `constitutionAware: boolean` to `LMRuleConfig` (default false).

---

## J. Adaptive Context Assembly

### J.1 Attention-weighted belief selection
- In `ContextAssembler.extractRelatedBeliefs()`, combine keyword overlap with `nar.attentionReport()` priority.
- Score formula: `overlapScore * 0.4 + attentionPriority * 0.6`.
- Add `useAttentionWeighting: boolean` to `ContextAssemblerOpts` (default true).

### J.2 Derivation trace quality filter
- Filter `recentDerivations` to confidence > 0.5 and frequency > 0.1.
- Deduplicate by term string (highest confidence wins).
- Add `minDerivationConfidence` and `minDerivationFrequency` to opts.

### J.3 Token budget management
- Estimate token budget from model capabilities in registry.
- Prune sections proportionally: constitution > instructions > session context > derivations > goals > beliefs.
- Add `tokenBudget: number` to opts (default 4096).

---

## K. Session Persistence

### K.1 Wire JsonlSessionManager in REPL
- `src/bin/repl.ts`: create `JsonlSessionManager({basePath: '.cache/sessions'})`, call `restore()` on startup.
- Use `sessionManager.getOrCreate('repl:default')` as primary session.
- Call `sessionManager.snapshot()` before shutdown.
- Add `.sessions` command (list all keys), `.session <key>` to switch.

### K.2 Knowledge store persistence
- Serialize `knowledge` Map to `<basePath>/knowledge.json` on `stop()`.
- Load on `createAgent()` when file exists.
- Gate with `persistKnowledge: boolean` in `AgentOptions` (default false).

---

## L. Evaluation

### L.1 Add scenarios to tests/conversational/scenarios/
- `reasoning-answer.ts` — NL question → NAR reasoning → answer from NAR via NLGenerationService.
- `goal-decomposition.ts` — complex NL goal → `lm-goal-decomposition` fires → sub-goals in NAR.
- `constitution.ts` — attempt to violate constitution via NL → `nar_believe` returns error.
- `drive-modulation.ts` — NL drive intent → `driveModulations` changes drive state.
- `proactive-notification.ts` — seed beliefs → run reasoning → ProactiveEngine emits event.
- `lm-rule-observability.ts` — NAR reasoning → `agent:lm-rule:applied` received by Agent.
- `structured-fallback.ts` — run with `local:compact`, verify output still produced.
- `curiosity-question.ts` — high curiosity drive → `lm-curiosity-question` fires → new question in NAR.

### L.2 Add ProbeExpectations fields to framework.ts
- `expectLmRuleFired: string[]` — verify specific LM Rule IDs were invoked.
- `expectBeliefCountChange: number` — verify exact delta in NAR belief count.
- `expectNoAgentLmCall: boolean` — verify response came from NL Generation, not ModelRunner.
- `expectDriveChanged: {driveId: string; minDelta: number}` — verify drive level changed by at least delta.
- `expectProactiveEvent: string` — verify ProactiveEngine emitted specific event type.
- `expectNarDerivations: boolean` — verify NAR produced derivations.

### L.3 Add regression recording/playback
- `--record` flag: write `tests/conversational/recordings/{scenario}-{provider}-{date}.json` with inputs, responses, LM Rule execution log.
- `--verify` flag: replay recorded inputs, compare responses via embedding cosine similarity (threshold env `REGRESSION_SIMILARITY`, default 0.85).

---

## M. MCP Integration

### M.1 Agent state as MCP resources
- In `src/api/mcp-resources.ts`:
  - `agent://sessions/{key}/history`
  - `agent://knowledge`
  - `agent://lm-rules/stats`
  - `agent://lm-rules/execution-log`
  - `agent://nar/attention`

### M.2 Agent control as MCP tools
- In `src/api/mcp-tools.ts`:
  - `agent_chat(text, sessionKey?)` → `agent.chat()`.
  - `agent_chat_stream(text, sessionKey?)` → streaming via MCP.
  - `agent_believe(narsese)` → `agent.believe()`.
  - `agent_recall(query?, limit?)` → `agent.recall()`.
  - `agent_know(key, value?)` → get/set knowledge.
  - `agent_lm_rule_enable(id)` / `agent_lm_rule_disable(id)`.

---

## N. File Manifest

```
DELETED:
  src/agent/nl-bridge.ts                          # A.4 — subsumed by unified flow
  src/nar/lm/rule-factory-v2.ts                   # A.1 — merged into LMRule.ts + lm-rule-factory.ts
  src/nar/lm/LMRule.ts                            # A.1 — rewritten as unified class
  src/agent/agent.ts                              # A.3 — rewritten: processInput() core + thin wrappers

MODIFIED:
  src/nar/lm/lm-rule-factory.ts                   # A.1, C.2, C.4, C.5 — single factory, all rules, schemas
  src/nar/rules/processor.ts                      # A.2, C.3 — single processLMRules(), richer context
  src/nar/nar.ts                                  # A.1, C.1 — wire structured models into rules
  src/nar/nar-execution.ts                        # H.2 — emit nar:reasoning:cycle events
  src/nar/nl/schemas.ts                           # C.2 — add BeliefRevisionSchema, QuestionGenerationSchema
  src/nar/nl/understanding.ts                     # G.1 — fallback chain
  src/nar/nl/generation.ts                        # G.2 — fallback chain
  src/nar/nl/context-assembler.ts                 # J.1, J.2, J.3 — attention weight, token budget
  src/nar/nl/cache.ts                             # G.3 — serialize/deserialize
  src/nar/tools/adapters/aisdk-adapter.ts         # I.1 — constitution enforcement
  src/nar/reason/reasoner.ts                      # A.2 — use unified processLMRules()
  src/nar/reason/inference-controller.ts          # A.2 — use unified processLMRules()
  src/nar/strategies/derivation/DefaultDerivation.ts   # A.2 — use unified processLMRules()
  src/nar/strategies/derivation/AnytimeDerivation.ts   # A.2 — use unified processLMRules()
  src/agent/io-bridge.ts                          # A.4 — remove createNlInputTranslation
  src/agent/io-middleware.ts                      # A.4 — remove createNlInputTranslation, simplify createNarseseOutputHumanization
  src/agent/index.ts                              # A.4 — remove nl-bridge exports
  src/bin/repl.ts                                 # E.2, K.1 — ProactiveEngine, JsonlSessionManager
  src/bin/bot-ai.ts                               # E.2 — ProactiveEngine
  src/api/mcp-resources.ts                        # M.1
  src/api/mcp-tools.ts                            # M.2
  tests/conversational/framework.ts               # L.2 — new ProbeExpectations
  tests/conversational/runner.ts                  # L.3 — --record, --verify

NEW:
  src/agent/input-processor.ts                    # B.1 — unified processInput() routing
  src/agent/ProactiveEngine.ts                    # E.1
  src/agent/CognitiveScheduler.ts                 # F.1, H.1
  tests/conversational/scenarios/reasoning-answer.ts         # L.1
  tests/conversational/scenarios/goal-decomposition.ts       # L.1
  tests/conversational/scenarios/constitution.ts             # L.1
  tests/conversational/scenarios/drive-modulation.ts         # L.1
  tests/conversational/scenarios/proactive-notification.ts   # L.1
  tests/conversational/scenarios/lm-rule-observability.ts    # L.1
  tests/conversational/scenarios/structured-fallback.ts      # L.1
  tests/conversational/scenarios/curiosity-question.ts       # L.1
```
