# SeNARS Agent Development Plan

## Architecture Principles

- **One LM call per input** — NL Understanding feeds NAR, NAR reasons (including LM Rules), NL Generation produces the response. No fallthrough to a second LM call.
- **Intent-based routing** — `detectedIntent` from NL Understanding (`chat|reasoning|learning|command`) determines flow, not a linear fallthrough chain.
- **LM Rules own autonomous reasoning** — goal decomposition, hypothesis generation, curiosity-driven questioning, concept elaboration are NAR-internal LM Rules, not Agent-level modules.
- **Agent owns NL interface** — session management, external tool use (web search, filesystem, code exec), human-in-the-loop, streaming, multi-connection I/O.
- **Events bridge the two layers** — NAR EventBus emits LM Rule activations, derivations, drive changes. Agent subscribes for proactive notifications.
- **Structured output everywhere** — all five LM integration paths use AI SDK `generateObject` when available.

---

## 1. Unify Agent Chat Flow (Eliminate Double-LM-Call)

### 1.1 Replace linear fallthrough with intent-based routing
- In `src/agent/agent.ts`, replace `chat()`'s current chain (`parseNarsese → driveStimulation → nlTranslation → dispatchToLM`) with:

```
Input → parseNarsese?
  ├─ Yes → nar.input() → inline reasoning (nar.run(steps)) → answer found?
  │                                  ├─ Yes → NLGenerationService → reply
  │                                  └─ No → reply "Queued"
  └─ No → NLUnderstandingService.understand(input, context)
            ├─ null → dispatchToLM() (no NL available, direct LM fallback)
            └─ TaskBatch →
                 detectedIntent:
                 ├─ 'chat' → dispatchToLM() (conversational, not reasoning)
                 ├─ 'reasoning' | 'learning' | 'command' →
                 │    1. Feed NAR (beliefs, questions, goals, driveModulations)
                 │    2. nar.run(steps) — inline reasoning (fires LM Rules)
                 │    3. Collect results: answered questions, new derivations,
                 │       decomposed sub-goals, LM Rule execution log
                 │    4. If questions answered OR significant derivations:
                 │       NLGenerationService.generate(derivations, input) → NL reply
                 │    5. Else: formatTaskBatchResult + brief confirmation
                 └─ done → reply
```

- Remove `tryNlTranslation()` returning a summary string — it becomes part of the above pipeline.
- Remove `tryDriveStimulation()` — drive modulations come from `TaskBatch.driveModulations` (see 8.1).

### 1.2 Add `chat()` to run inline NAR reasoning after NL input
- After feeding NAR in the intent-based routing (1.1), call `nar.run(steps)` where `steps` is configurable (env `REASONING_STEPS`, default 5).
- Capture derivations inline, not just from background.
- Check if any of the input questions were answered by scanning NAR beliefs after reasoning.
- Pass answered questions + new derivations to NLGenerationService for the reply.

### 1.3 NLGenerationService from NAR results, not from Agent LM
- The `chat()` method's NL response for reasoning/learning/command intents comes from `NLGenerationService.generate()` with the NAR's derivation results, not from a separate ModelRunner LM call.
- The ModelRunner (`dispatchToLM()`) is only invoked when:
  - `detectedIntent === 'chat'` (conversational)
  - `NLUnderstandingService.understand()` returns null (no NL understanding available)

### 1.4 Preserve existing ModelRunner for chat intent
- When `detectedIntent === 'chat'`, the existing ModelRunner + tools path is correct: system prompt with NAR context, multi-step tool calling, streaming.
- The only change is the routing: chat intent → ModelRunner; reasoning intent → NL Understanding → NAR → NL Generation.

---

## 2. Upgrade NAR-Internal LM Rules to Structured Output

### 2.1 Add AI SDK structured generation to LMRule (v1)
- In `src/nar/lm/LMRule.ts`:
  - Add optional `structuredModel: LanguageModel` field.
  - Add `setStructuredModel(model)` mutator.
  - Add `executeWithSchema(prompt, schema)` that calls `generateObject({model: this.structuredModel, prompt, schema})`.
  - In `apply()`, when structured model is available AND the rule has a known schema mapping, use `executeWithSchema()`.
  - Fall back to existing `executeLM()` (`generateText` + regex JSON extraction) when structured model is absent.

### 2.2 Map each LM Rule to its zod schema
- In `src/nar/lm/lm-rule-factory.ts` `createRule()`, add a `schema` field to each rule definition mapping to schemas in `src/nar/nl/schemas.ts`:
  - `lm-goal-decomposition` → `GoalDecompositionSchema`
  - `lm-belief-revision` → create `BeliefRevisionSchema` in schemas.ts
  - `lm-hypothesis-generation` → `HypothesisSchema`
  - `lm-explanation-generation` → `ExplanationSchema`
  - `lm-analogical-reasoning` → `AnalogySchema`
  - `lm-schema-induction` → `SchemaInductionSchema`
  - `lm-temporal-causal` → `TemporalCausalSchema`
  - `lm-variable-grounding` → `VariableGroundingSchema`
  - `lm-concept-elaboration` → `ConceptElaborationSchema`
  - `lm-meta-reasoning` → `MetaReasoningSchema`
  - `lm-uncertainty-calibration` → `UncertaintySchema`
  - `lm-narsese-translation` → `TranslationSchema`
  - `lm-interactive-clarification` → `ClarificationSchema`
- Store mapping: `ruleSchemaMap: Record<string, ZodSchema>` in the factory.
- Pass schema reference to `LMRule` constructor so `apply()` knows which schema to use.

### 2.3 Upgrade LMRuleFactory prompt templates for structured output
- Update each prompt template in `prompts: Record<string, string>` in `lm-rule-factory.ts` to instruct JSON output matching the target schema.
- The prompts already contain `{{primaryTerm}}` and `{{secondaryTerm}}` — add `{{schema}}` injection that renders the zod schema description as JSON example.
- This ensures both structured and non-structured paths produce compatible output.

### 2.4 Wire structured models into LM Rules at NAR init
- In `src/nar/nar.ts` `initializeLMRules()`:
  - Get the structured model from `registry.languageModel('cloud:quality') ?? registry.languageModel('local:quality')`.
  - Call `rule.setStructuredModel(model)` on each V1 and V2 rule.
- Pass `registry` to `initializeLMRules()` so it can resolve models.

### 2.5 Wire LMRuleV2Runner into NAR
- In `src/nar/nar.ts` `initializeLMRules()`, after V1 rules, also load V2 rules from `createV2Rules(lmClient)`.
- Create a thin wrapper class `LMRuleV2Adapter` that implements the `LMRule` interface by delegating to `LMRuleV2Runner`.
- Register via `processor.registerLMRule(adapter)`.
- The `LMRule` interface needs: `id`, `name`, `description`, `priority`, `canApply()`, `apply()`, `setEventBus()`, `setStructuredModel()`.
- Apply structured model to V2 runner the same way.

### 2.6 Add context enrichment to LM Rule application
- In `src/nar/rules/processor.ts` `processLMRules()`, for each rule invocation, assemble an enriched context object:
  - `conceptPriority` (already passed)
  - `relatedBeliefs` — top 5 beliefs matching the premise terms (from memory)
  - `activeGoals` — current goals from NAR
  - `driveState` — current drive levels (from DriveManager)
  - `conflictCount` — contradictions involving this concept
  - `knowledgeEntries` — relevant entries from Agent's knowledge store (when available)
- This matches the context richness that `NLUnderstandingService` gets from `ContextAssembler`.

---

## 3. Agent-LM Rule Event Bridge

### 3.1 Emit events from LM Rule execution
- In `src/nar/lm/LMRule.ts` `apply()`, emit on EventBus:
  - `lm.rule:applied` with `{ruleId, ruleName, primaryTerm, tasksProduced, durationMs, timestamp}`
  - `lm.rule:skipped` when `canApply()` returns false
  - `lm.rule:error` on failure
- These already exist partially (`lm.prompt`, `lm.response`, `lm.failure`). Add structured typed events.

### 3.2 Forward LM Rule events to Agent event bus
- In `src/agent/agent.ts`, when NAR's EventBus is available, subscribe to `lm.rule:*` events and forward them to `AgentEventBus` as `agent:lm-rule:applied`.
- Add `on('agent:lm-rule:applied', handler)` to Agent interface.
- Create `src/agent/lm-rule-bridge.ts` to contain this subscription logic.

### 3.3 Add Agent API for LM Rule introspection
- Add to Agent interface:
  - `getLmRuleStats()` → per-rule execution counts, circuit states, average duration.
  - `getLmRuleExecutionLog()` → recent rule executions with inputs/outputs.
  - `enableLmRule(id)` / `disableLmRule(id)` → runtime rule control.
  - `setLmRuleBudget(id, budget)` → adjust priority budget per rule.
- Wire to `RuleProcessor.getLMRuleExecutionLog()` and `nar.getProcessor()`.

### 3.4 Add NAR EventBus subscription to Agent
- In `agent.ts` `createAgent()`, when `nar` is provided, subscribe to `nar.eventBus`:
  - `nar:derivation` — forward as `agent:nar:derivation`
  - `nar:concept:activated` — forward as `agent:nar:concept-activated`
  - `nar:goal:resolved` — forward as `agent:nar:goal-resolved`
  - `nar:conflict:detected` — forward as `agent:nar:conflict-detected`
- This enables the Agent to react to NAR events without polling.

---

## 4. Proactive Notification from NAR Events

### 4.1 Create ProactiveEngine
- New file `src/agent/ProactiveEngine.ts`.
- Constructor accepts `AgentEventBus`.
- Subscribes to `agent:nar:derivation` and `agent:lm-rule:applied` events.
- When a derivation has confidence > `notificationThreshold` (env `NOTIFICATION_CONFIDENCE_THRESHOLD`, default 0.7), enqueue a notification.
- Rate-limit: at most 1 notification per `notificationCooldownMs` (env, default 30s).
- Configuration driven by env `SENARS_AUTONOMY_BROADCAST`.
- No separate polling loop — purely event-driven.

### 4.2 Notification delivery
- `ProactiveEngine` exposes `onNotify(callback: (msg: string) => void)`.
- Callback set by the host (REPL: `console.log`; Bot: broadcast to active connections).
- When significant event detected, generate NL via `NLGenerationService.generate()` with the derivation as input.
- Deliver via callback.

### 4.3 Proactive question generation (LM Rule, not Agent module)
- Add `lm-curiosity-question` rule definition to `lm-rule-factory.ts`:
  - Activation condition: `(primary: Term, secondary, context) => { const drive = context?.driveState?.curiosity ?? 0; return drive > 0.6; }`
  - Prompt: "Generate a Narsese question about `{{primaryTerm}}` that would expand understanding."
  - Schema: create `QuestionGenerationSchema: z.object({question: z.string()})`.
  - Task type: `'question'`.
- This fires during normal NAR reasoning when curiosity drive is high — no separate timer needed.

---

## 5. Constitutional Reasoning

### 5.1 Pre-execution constitution check in Agent tools
- In `src/nar/tools/adapters/aisdk-adapter.ts`, wrap `nar_believe` and `nar_goal` execute functions:
  - Before calling `nar.input()`, parse the statement and call `nar.checkConstitutionViolation()`.
  - On violation, return `{error: "Constitution violation: <clause>", status: "rejected"}`.
- Add `constitutionEnforcement` option to `createNARSTools()` (default true).

### 5.2 Pre-commit constitution check in LM Rules
- In `src/nar/lm/LMRule.ts` `taskFromProcessed()`, before creating the task:
  - Call `nar.checkConstitutionViolation()` via stored reference.
  - On violation, log event `lm.rule:constitution-violation` and return a no-op task instead.
- Add `constitutionAware` option to `LMRuleConfig` (default false — opt-in).

---

## 6. NL Understanding Resilience

### 6.1 Structured output fallback chain
- In `NLUnderstandingService.understand()`:
  1. Try `generateObject` with structured model (current behavior).
  2. If structured model unavailable, fall back to `getQualityModel()` with prompt requesting JSON matching `TaskBatchSchema`.
  3. If that fails, fall back to raw Narsese parser heuristics:
     - Simple patterns: "X is Y" → `(X --> Y).`, "X are Y" → `(X --> Y).`
     - Questions: "is X Y?" → `(X --> Y)?`, "what is X?" → `(X --> ?)?`
     - Commands: "make X Y" → `(X --> Y)!`
  4. If all fail, return null (→ `detectedIntent === 'chat'` fallback).

### 6.2 NL generation fallback chain
- In `NLGenerationService.generate()`:
  1. Try `generateObject` with structured model.
  2. If structured model unavailable, fall back to `getQualityModel()` with prompt requesting `GenerationOutputSchema` fields as plain text.
  3. Post-process plain text via regex to extract fields.
  4. If all fail, return template string: "Based on reasoning about `{query}`."

### 6.3 Translation cache persistence
- Add `TranslationCache.serialize()` / `TranslationCache.deserialize()` for JSON.
- Load from `TRANSLATION_CACHE_PATH` env path on service init.
- Flush periodically (every 100 entries) and on shutdown.
- TTL-based eviction (default 1 hour).

---

## 7. Session Persistence and Continuity

### 7.1 Wire JsonlSessionManager in REPL
- In `src/bin/repl.ts`:
  - Create `JsonlSessionManager` with `basePath: '.cache/sessions'`.
  - Call `sessionManager.restore()` on startup.
  - Use `sessionManager.getOrCreate('repl:default')`.
  - Call `sessionManager.snapshot()` before shutdown.
  - Add `.sessions` command (list all keys), `.session <key>` to switch.

### 7.2 Knowledge store persistence
- The `knowledge` Map in `agent.ts` is in-memory only. Add optional persistence:
  - Serialize to `<basePath>/knowledge.json` on shutdown.
  - Load on `createAgent()` when file exists.
  - Gate with `persistKnowledge` Agent option (default false).

---

## 8. Drive Stimulation via NL Understanding

### 8.1 Add driveModulations to TaskBatchSchema
- In `src/nar/nl/schemas.ts`, add to `TaskBatchSchema`:
  ```ts
  driveModulations: z.array(z.object({
      driveId: z.string(),
      amount: z.number().min(-1).max(1)
  })).optional()
  ```
- This lets the LLM output drive changes directly during NL Understanding.

### 8.2 Apply drive modulations after NL Understanding
- In `agent.ts` chat flow (1.1), after feeding beliefs/questions/goals:
  - Check `batch.meta.driveModulations` or the new `driveModulations` field.
  - Call `driveManager.stimulate(id, amount)` for each.
- Remove `tryDriveStimulation()` and `DRIVE_PATTERNS` completely.

### 8.3 Add drive state to NL Understanding context
- In `ContextAssembler.assemble()`, include current drive levels so the LLM can make informed drive suggestions.
- Add `driveState` to `NLContext` interface.

---

## 9. Adaptive Background Reasoning

### 9.1 Replace setInterval with event-driven CognitiveScheduler
- New file `src/agent/CognitiveScheduler.ts`.
- Constructor accepts `NAR`, `AgentEventBus`.
- Subscribe to NAR events:
  - `task:added` → enqueue 1–3 reasoning steps (goal=3, question=2, belief=1).
  - `concept:activated` → enqueue 1 step if queue empty.
  - `lm.rule:applied` → enqueue 1 step to integrate LM Rule results.
- Process queue with configurable `maxStepsPerTick` (env `MAX_STEPS_PER_TICK`, default 3).
- Fall back to idle step every `idleIntervalMs` when queue empty (env `IDLE_REASONING_INTERVAL_MS`, default 10s).
- Replace `setInterval` in `agent.ts` `start()` with `CognitiveScheduler.start()`.

### 9.2 Interrupt reasoning on user input
- When `chat()` is called, call `scheduler.pause()`.
- After response dispatched, call `scheduler.resume()` and enqueue immediate step.
- Use existing `AbortController` pattern from streaming dispatch.

---

## 10. Intelligent Context Assembly

### 10.1 Attention-weighted belief selection
- In `ContextAssembler.extractRelatedBeliefs()`, combine keyword overlap score with `nar.attentionReport()` priority.
- Formula: `finalScore = overlapScore * 0.4 + attentionPriority * 0.6`.
- Add `useAttentionWeighting` option to `ContextAssemblerOpts` (default true).

### 10.2 Derivation trace quality filtering
- Filter `recentDerivations` to those with confidence > 0.5 and frequency > 0.1.
- Deduplicate by term string (keep highest confidence).
- Add to `ContextAssemblerOpts` as `minDerivationConfidence` and `minDerivationFrequency`.

### 10.3 Dynamic token budget management
- Estimate token budget from registered model capabilities (`contextWindow`).
- Prune context sections proportionally when estimated total exceeds budget.
- Keep order: constitution > instructions > session context > derivations > goals > beliefs.
- Add `tokenBudget` to `ContextAssemblerOpts`.

---

## 11. Evaluation and Benchmarking

### 11.1 Expand conversational scenarios
- Add to `tests/conversational/scenarios/`:
  - `reasoning-answer.ts`: NL question → NL Understanding → NAR reasoning → NL answer (verify answer comes from NAR, not LM).
  - `goal-decomposition.ts`: Complex NL goal → fed to NAR → `lm-goal-decomposition` fires → sub-goals appear in NAR.
  - `constitution.ts`: NL attempts to violate constitution → `nar_believe` tool returns error.
  - `drive-modulation.ts`: NL input with drive intent → verify drive state changed via NL Understanding, not regex.
  - `proactive-notification.ts`: seed beliefs, run reasoning, verify ProactiveEngine emits notification event.
  - `lm-rule-observability.ts`: verify Agent event bus receives `agent:lm-rule:applied` events after NAR reasoning.
  - `structured-fallback.ts`: run with `local:compact` model, verify NL understanding still produces valid output.
- Add `ProbeExpectations` fields:
  - `expectLmRuleFired` — verify specific LM Rule was invoked.
  - `expectNarDerivations` — verify NAR ran derivations during probe.
  - `expectBeliefCountChange` — verify NAR belief count changed by delta.
  - `expectNoAgentLmCall` — verify response came from NL Generation, not ModelRunner.
  - `expectDriveChanged` — verify drive level changed.

### 11.2 Regression recording and playback
- Add `--record` flag to `tests/conversational/runner.ts` writing responses to `tests/conversational/recordings/{scenario}-{provider}-{date}.json`.
- Add `--verify` flag replaying recorded inputs, comparing responses via embedding cosine similarity (threshold: env `REGRESSION_SIMILARITY`, default 0.85).
- Include LM Rule execution log in recordings.

---

## 12. MCP and External Integration

### 12.1 Expose Agent state as MCP resources
- In `src/api/mcp-resources.ts`:
  - `agent://sessions/{key}/history` → `ConversationSession.history` as JSON.
  - `agent://knowledge` → Agent knowledge Map entries.
  - `agent://lm-rules/stats` → per-rule stats from `getLmRuleStats()`.
  - `agent://lm-rules/execution-log` → recent rule executions.
  - `agent://nar/attention` → `nar.attentionReport()`.

### 12.2 Expose Agent control as MCP tools
- In `src/api/mcp-tools.ts`:
  - `agent_chat(text, sessionKey?)` → `agent.chat()`.
  - `agent_chat_stream(text, sessionKey?)` → `agent.chatStream()` with streaming MCP response.
  - `agent_believe(narsese)` → `agent.believe()`.
  - `agent_recall(query?, limit?)` → `agent.recall()`.
  - `agent_know(key, value?)` → get/set knowledge.
  - `agent_lm_rule_enable(id)` / `agent_lm_rule_disable(id)` → runtime LM Rule control.

---

## 13. File Map

```
Modified:
  src/agent/agent.ts                    # 1.1, 1.2, 1.3, 1.4, 3.2, 4.3, 9.1, 9.2
  src/agent/nl-bridge.ts                # 1.1* (may be subsumed by intent-based routing)
  src/nar/lm/LMRule.ts                  # 2.1, 3.1, 5.2
  src/nar/lm/lm-rule-factory.ts         # 2.2, 2.3, 4.3
  src/nar/lm/rule-factory-v2.ts         # 2.5
  src/nar/rules/processor.ts            # 2.6, 3.1
  src/nar/nar.ts                        # 2.4, 2.5
  src/nar/nar-execution.ts              # 3.1 (event emissions)
  src/nar/nl/understanding.ts           # 1.1, 6.1, 8.1
  src/nar/nl/generation.ts              # 1.3, 6.2
  src/nar/nl/context-assembler.ts       # 8.3, 10.1, 10.2, 10.3
  src/nar/nl/schemas.ts                 # 2.2, 8.1
  src/nar/nl/cache.ts                   # 6.3
  src/nar/tools/adapters/aisdk-adapter.ts  # 5.1
  src/nar/drives/index.js               # 8.1 (expose drive state interface)
  src/bin/repl.ts                       # 7.1, 9.2
  src/api/mcp-resources.ts             # 12.1
  src/api/mcp-tools.ts                 # 12.2
  tests/conversational/framework.ts     # 11.1
  tests/conversational/runner.ts        # 11.2

New:
  src/agent/ProactiveEngine.ts          # 4.1, 4.2
  src/agent/CognitiveScheduler.ts       # 9.1
  src/agent/lm-rule-bridge.ts           # 3.2, 3.3
  tests/conversational/scenarios/reasoning-answer.ts        # 11.1
  tests/conversational/scenarios/goal-decomposition.ts      # 11.1
  tests/conversational/scenarios/constitution.ts            # 11.1
  tests/conversational/scenarios/drive-modulation.ts        # 11.1
  tests/conversational/scenarios/proactive-notification.ts  # 11.1
  tests/conversational/scenarios/lm-rule-observability.ts   # 11.1
  tests/conversational/scenarios/structured-fallback.ts     # 11.1

Removed (functionality subsumed):
  agent.ts: tryDriveStimulation()       # → 8.1, 8.2 (NL-based drive modulation)
  agent.ts: DRIVE_PATTERNS              # → 8.1
  nl-bridge.ts: (standalone bridge)     # → 1.1, subsumed into unified chat flow
```

`*` Items marked with asterisk are modifications to existing files that eliminate rather than add code.
