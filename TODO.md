# SeNARS Agent Development Plan

> **Legend:** `[x]` = completed, `[~]` = partial, `[ ]` = pending

## A. Elimination of Redundancy (Structural Cleanup First)

### A.1 Merge LMRule v1 + LMRuleV2Runner into a single unified `LMRule` class `[x]`
- In `src/nar/lm/LMRule.ts`, redesign `LMRule` to incorporate v2's typed features:
  - [x] Add optional `outputSchema: ZodSchema` field for structured output.
  - [x] Add optional `inputSchema: ZodSchema` for typed input validation.
  - [x] Add optional `validate(output): ValidationResult` method (from v2's `LMRuleV2` interface).
  - [x] Add `promptTemplate: string | ((input: unknown, context: LMContext) => string)` — accept both the v1 string template and v2's function-based template.
  - [x] Add `LMContext` type (from v2) as the standard context object passed to `apply()`.
  - [x] Add `structuredModel: LanguageModel` for AI SDK structured generation path.
  - [x] Keep circuit breaker, EventBus integration, LMClient fallback, stats tracking.
- [x] Merge v2's 5 preset rules into the v1 rule definitions in `lm-rule-factory.ts` — they are not different kinds of things.
- [x] Verify no caller depends on `LMRuleV2` or `LMRuleV2Runner` by name — remove `rule-factory-v2.ts` entirely once merged.
- [x] Delete `src/nar/lm/rule-factory-v2.ts`. The `LMRuleFactory` in `lm-rule-factory.ts` is the single factory.

### A.2 Unify three parallel LM Rule application methods in RuleProcessor `[x]`
- [x] Replace all three with a single method: `processLMRules(p1, p2?, opts?)`
- [x] When `p2` is omitted or `singlePremise` is true, each LM Rule is called with `(p1.term, p1.term)`.
- [x] When `p2` is provided and `singlePremise` is false, each LM Rule is called with `(p1.term, p2.term)`.
- [x] Update all callers (reasoner.ts, inference-controller.ts, DefaultDerivation.ts, AnytimeDerivation.ts) to use the unified method.
- [x] Remove the now-obsolete `processLMRulesExternal` and `processLMRulesSingle`.

### A.3 Extract shared routing logic from agent.ts `[x]`
- [x] `chat()`, `chatWithHistory()`, and `chatStream()` each contain a copy of the same decision chain.
- [x] Extract a single async generator `processInput(input, session, opts)` that implements the unified flow (Section B).
- [x] All three public methods become thin wrappers that call `processInput()` and format the result appropriately.
- *Note: Depends on B.1. Implemented together.*

### A.4 Simplify NlBridge to remove NL→Narsese duplication `[x]`
- [x] `NlBridge` has `nlToNarsese()` which duplicates `NLUnderstandingService.understand()`.
  - *Note: nlToNarsese still exists in nl-bridge.ts — will be removed when B.1/processInput replaces createNlInputTranslation.*
- [x] `createNarseseOutputHumanization()` middleware now calls `NLGenerationService.generate()` directly instead of going through `NlBridge.interpretDerivation()`.
- [x] Remove `createNlInputTranslation()` middleware entirely. Its function is subsumed by the unified `processInput()` routing (B.1).
- [x] Remove `NlBridge`, `NlBridgeDeps`, `createNlBridge()`, `nl-bridge.ts`. The io-bridge creates NLGenerationService directly.
- [x] Delete `src/agent/nl-bridge.ts`.

### A.5 Consolidate learn-tool / process-tool / reason-tool (NAR-internal tools) `[x]`
- [x] Audit the NAR-internal tools for overlap with the Agent's AI SDK tool set. Remove any that duplicate Agent-level functionality.
- [x] Keep only NAR-internal tools that are called by NAR's own reasoning (operations in Narsese), not by the Agent's LM tool loop.
- [x] Delete files for tools that are purely duplicated by Agent-level tools.

---

## B. Unified Input Processing Flow

### B.1 The `processInput()` routing function `[x]`
- [x] Single location in `src/agent/input-processor.ts` implementing the routing flow:
  - ParseNarsese → NAR input + run → NL reply or "Queued"
  - NL understanding → intent-based dispatch (chat, reasoning, learning, command)
  - Ambiguity handling → clarification
- [x] Wire NLUnderstandingService, NLGenerationService, NAR, ModelRunner into processInput.

### B.2 The three public methods become thin wrappers `[x]`
- [x] `chat()` → calls `processInput()`, awaits final value.
- [x] `chatWithHistory()` → calls `processInput()` with session, appends turns, trims.
- [x] `chatStream()` → yields events from `processInput()` as they arrive.

### B.3 Ambiguity handling `[x]`
- [x] When `TaskBatch.meta.ambiguities.length > 0`, return `clarify` event instead of feeding NAR.
- [x] `chat()` and `chatWithHistory()` return clarification string; `chatStream()` yields `{kind: 'clarify'}`.

### B.4 No-drive-regex path `[x]`
- [x] Delete `tryDriveStimulation()` and `DRIVE_PATTERNS`.
- [x] Drive modulation comes only from `TaskBatch.driveModulations`.
- [x] When `detectedIntent` is `'command'` and `driveModulations` present, apply to `driveManager.stimulate()`.

---

## C. Single Unified LMRule with Structured Output

### C.1 Upgrade unified LMRule to support AI SDK `generateObject` `[x]`
- [x] `structuredModel` field added to `LMRule` class with `setStructuredModel()` method.
- [x] `executeStructured(prompt, schema)` method calls `structuredModel.generateObject()`.
- [x] In `apply()`, when `structuredModel` is set AND `outputSchema` is set, calls `executeStructured()`.
- [x] Wire actual AI SDK `LanguageModel` from registry to LM Rules at initialization time (O.3 step 5).

### C.2 Map all 13 (+ 5) preset rules to zod schemas `[x]`
- [x] Added `BeliefRevisionSchema` and `QuestionGenerationSchema` to `src/nar/nl/schemas.ts`.
- [x] Added `schema: ZodSchema` to each `LMRuleDefinition` in `lm-rule-factory.ts`.
- [x] Pass `schema` to `LMRule` constructor via `outputSchema` field.
- [x] All 18 rule schemas mapped (13 original + 5 v2 presets).

### C.3 Richer context for LM Rule application `[x]`
- [x] In `RuleProcessor.processLMRulesInternal()`, assemble `ruleContext` with conceptPriority, taskTerm, secondaryTerm, taskType, relatedBeliefs, activeGoals, driveState, conflictCount, memoryPressure, totalConcepts.
- [x] Pass `ruleContext` to `lmRule.apply()` as context parameter.

### C.4 Add curiosity-driven question rule `[x]`
- [x] Add `lm-curiosity-question` rule to `lm-rule-factory.ts` with `QuestionGenerationSchema`.
- [x] Activation condition: `curiosity > 0.6` from `ctx.driveState`.

### C.5 Add LM Rule tool delegation `[x]`
- [x] In `LMRule.apply()`, after structured output: if output contains `{tool, args}`, dispatch via injected `toolDispatcher`.
- [x] Gate with `enableTools` option in `LMRuleConfig` (default false).

---

## D. Unified SystemEventBus

### D.1 Replace two-bus bridge with single SystemEventBus `[x]`
- [x] Created `src/agent/SystemEventBus.ts` with typed event keys (`nar.*`, `lm.*`, `agent.*`).
- [x] `wrapNarEventBus(narBus)` subscribes to NAR EventBus events and forwards to namespaced keys.
- [x] Agent subscribes to `SystemEventBus` directly.

### D.2 LM Rule typed events `[x]`
- [x] In `LMRule.apply()`, emit `lm.rule:applied`, `lm.rule:skipped`, `lm.rule:structured` on SystemEventBus.
- [x] Replace existing `lm.prompt` / `lm.response` / `lm.failure` events.

### D.3 Agent subscribes to SystemEventBus `[x]`
- [x] In `createAgent()`, subscribe to `SystemEventBus` for `lm.*` and `nar:*` events.
- [x] Add `on('lm.rule:applied', handler)` and `on('nar:derivation', handler)` to Agent interface.

### D.4 Agent API for LM Rule runtime control `[x]`
- [x] Add `getLmRuleStats()`, `getLmRuleExecutionLog()`, `enableLmRule()`, `disableLmRule()`, `setLmRulePriority()` to Agent.

---

## D. Unified SystemEventBus

### D.1 Replace two-bus bridge with single SystemEventBus
- Create `src/agent/SystemEventBus.ts` — single EventEmitter with namespaced event keys:
  - `nar.*` — NAR lifecycle events (`nar:derivation`, `nar:concept:activated`, `nar:goal:resolved`, `nar:conflict:detected`)
  - `lm.*` — LM Rule events (`lm.rule:applied`, `lm.rule:skipped`, `lm.rule:structured`)
  - `agent.*` — Agent events (`agent:input`, `agent:reply`, `agent:error`)
- NAR's internal `EventBus` emits raw events; `SystemEventBus` wraps and namespaces them.
- Agent subscribes to `SystemEventBus` directly — no manual forwarding between two buses.

### D.2 LM Rule typed events
- In unified `LMRule.apply()`, emit on SystemEventBus:
  - `lm.rule:applied` with `{ruleId, ruleName, primaryTerm, secondaryTerm?, tasksProduced, durationMs, timestamp, schema?}`
  - `lm.rule:skipped` with `{ruleId, ruleName, reason: 'circuit_open'|'disabled'|'activation_failed'|'single_premise_missing'}`
  - `lm.rule:structured` when structured output path used (with `{schema, output}`)
- These replace the existing `lm.prompt` / `lm.response` / `lm.failure` events with typed structured events.

### D.3 Agent subscribes to SystemEventBus
- In `src/agent/agent.ts` `createAgent()`, when `nar` is available:
  - Subscribe to `SystemEventBus` for `lm.*` events.
  - Subscribe to `nar:*` events.
- Add `on('lm.rule:applied', handler)` to Agent interface.
- Add `on('nar:derivation', handler)` to Agent interface.

### D.4 Agent API for LM Rule runtime control
- Add to Agent:
  - `getLmRuleStats(): LMRuleStats[]` — per-rule: calls, successes, failures, circuit state, avg duration.
  - `getLmRuleExecutionLog(): LMRuleExecutionEntry[]` — recent rule activations.
  - `enableLmRule(id: string): void`
  - `disableLmRule(id: string): void`
  - `setLmRulePriority(id: string, priority: number): void`

---

## E. AutonomyEngine (Proactive + Adaptive Reasoning)

### E.1 Create `src/agent/AutonomyEngine.ts` `[x]`
- [x] Single module replacing separate ProactiveEngine and CognitiveScheduler.
- [x] Proactive notifications (event-driven, no polling) — subscribe to SystemEventBus.
- [x] Adaptive background reasoning (event-driven, no fixed interval) — event-driven queue with `maxStepsPerTick`.
- [x] Methods: `start()`, `stop()`, `pause()`, `resume()`, `onNotify()`.

### E.2 Wire AutonomyEngine in REPL and Bot `[x]`
- [x] In `src/bin/repl.ts`, create `AutonomyEngine`, set `onNotify` to `console.log`.
- [x] In `src/bin/bot-ai.ts`, create `AutonomyEngine`, set `onNotify` to broadcast.
- [x] Replace `setInterval` in `agent.ts` `start()` with `autonomyEngine.start()`.

### E.3 Interrupt and resume on user input `[x]`
- [x] `processInput()` (B.1) calls `autonomyEngine.pause()` at start, `resume()` at end.

---

## F. NL Understanding Resilience

### F.1 Structured output fallback chain in NLUnderstandingService `[x]`
- [x] Fallback order: generateObject → generateText+JSON.parse → raw Narsese heuristics → null.
- [x] Each level retried per `maxRetries`.

### F.2 NL generation fallback in NLGenerationService `[x]`
- [x] Fallback order: generateObject → generateText+regex → template fallback.
- [x] Keep existing `fallbackGenerate()`.

### F.3 Translation cache persistence `[x]`
- [x] `TranslationCache.serialize()` / `deserialize()`.
- [x] Load from `TRANSLATION_CACHE_PATH` env. Auto-flush every 100 entries. TTL 1 hour.

---

## G. Constitutional Reasoning

### G.1 Pre-execution check in Agent NARS tools `[x]`
- [x] Wrap `nar_believe` and `nar_goal` with `nar.checkConstitutionViolation()`.
- [x] Add `constitutionEnforcement: boolean` to `createNARSTools()` (default true).

### G.2 Pre-commit check in LM Rules `[x]`
- [x] In `LMRule.taskFromProcessed()`, check constitution before creating Task.
- [x] Add `constitutionAware: boolean` to `LMRuleConfig` (default false).

---

## H. Adaptive Context Assembly

### H.1 Attention-weighted belief selection `[x]`
- [x] Score formula: `overlapScore * 0.4 + attentionPriority * 0.6` in `ContextAssembler.extractRelatedBeliefs()`.

### H.2 Derivation trace quality filter `[x]`
- [x] Filter `recentDerivations` to confidence > 0.5, frequency > 0.1. Deduplicate by term.

### H.3 Token budget management `[x]`
- [x] Estimate token budget from model capabilities. Prune proportionally. Default 4096.

---

## I. Session Persistence

### I.1 Wire JsonlSessionManager in REPL `[x]`
- [x] Create `JsonlSessionManager({basePath: '.cache/sessions'})`, restore on startup, snapshot before shutdown.
- [x] Add `.sessions` and `.session <key>` commands.

### I.2 Knowledge store persistence `[x]`
- [x] Serialize `knowledge` Map to JSON. Gate with `persistKnowledge: boolean` (default false).

---

## J. Full State Persistence

### J.1 NAR state serialization `[x]`
- [x] On `nar.stop()`, serialize beliefs/questions/goals/attention/drives to `state/` JSON files.
- [x] On `nar.start()`, restore if files exist. Gate with `persistState: boolean` (default false).

### J.2 LM Rule state serialization `[x]`
- [x] Serialize per-rule stats + circuit state to `state/lm-rules.json`.

### J.3 Memory persistence `[x]`
- [x] Verify `EpisodicMemory` JSONL persists across restarts. Directory created automatically in `appendToCurrentFile`.

---

## K. RLFP Integration

### K.1 Expose RLFP state via Agent API `[x]`
- [x] Add `getRLFPState()`, `resetRLFP()` to Agent.

### K.2 RLFP feedback loop `[x]`
- [x] Added `reward(reward, context)` method to `RLFPLearner` for user feedback.
- [x] Added `provideRLFPFeedback(reward, context)` to Agent API.
- [x] Added `reset()` method to `RLFPLearner` and `PreferenceCollector.clear()`.
- [x] Updated `getRLFPState()` to return actual policy data.

### K.3 RLFP-driven reasoning decisions `[ ]`
- [ ] In `NARExecution.run()`, consult `NAR.rlfp` for rule activation, step count, strategy priority.

---

## L. Self-Reasoning Exposure

### L.1 Expose NAR meta-cognition via Agent API `[x]`
- [x] Add `getSelfReasoning()`, `getReasoningQuality()` to Agent. Wire to MCP resources.

### L.2 Self-monitoring during reasoning `[x]`
- [x] Added `assessQuality()` method to `SelfAnalyzerService` returning overall, coherence, relevance, completeness scores.
- [x] Exposed `assessQuality()` through `ReasoningAboutReasoning` class.
- [x] Integrated into `NARExecution.run()` - assesses quality every 10 cycles, triggers `performSelfCorrection()` if overall quality < 0.4.

---

## M. Autonomous Goal Pursuit

### M.1 Goal decomposition via LM Rules `[x]`
- [x] `lm-goal-decomposition` rule exists in `lm-rule-factory.ts` with `GoalDecompositionSchema`, activation condition `isComplexGoal`, singlePremise=true.

### M.2 Goal persistence across sessions `[x]`
- [x] Goals saved to `state/goals.json` via J.1, restored on startup and added to TaskManager for processing.

### M.3 Goal progress tracking `[x]`
- [x] Added `getGoalProgress(goalId)` and `listActiveGoals()` to Agent API.

---

## N. Explanation & Traceability Tools

### N.1 Derivation trace API `[x]`
- [x] Add `explainBelief(term)`, `explainGoal(term)`, `traceRule(ruleId, term)` to Agent.

### N.2 NL explanation generation `[x]`
- [x] Added `explainInNaturalLanguage(term)` to Agent using `NLGenerationService.generate()`.

---

## O. Agent Interface & Type Definitions

### O.1 Unified Agent interface `[x]`
- [x] Define canonical Agent interface in `src/agent/agent.ts` with all new methods.

### O.2 Shared type definitions `[x]`
- [x] Create `src/agent/types.ts` with RLFPState, SelfReasoningState, QualityMetrics, GoalProgress, ExplanationChain, RuleTrace, LMRuleStats, LMRuleExecutionEntry, ChatOpts, StreamEvent.

### O.3 Initialization order `[x]`
- [x] Define strict startup sequence: SystemEventBus → NAR → NL services → LM Rules → Structured models → AutonomyEngine → Agent → Wire → Restore → Start.

---

## P. Evaluation

### P.1 Core scenarios `[ ]`
- [ ] 7 evaluation scenarios in `tests/conversational/scenarios/`.

### P.2 Add ProbeExpectations fields to framework.ts `[ ]`
- [ ] Add `expectLmRuleFired`, `expectBeliefCountChange`, `expectNoAgentLmCall`, `expectDriveChanged`, `expectProactiveEvent`, `expectNarDerivations`, `expectRLFPState`, `expectExplanationChain`.

### P.3 Add regression recording/playback `[ ]`
- [ ] `--record` and `--verify` flags in test runner.

---

## Q. MCP Integration

### Q.1 Agent state as MCP resources `[ ]`
- [ ] Add resources: sessions, knowledge, lm-rules/stats, lm-rules/execution-log, nar/attention, nar/state, rlfp/state, self-reasoning.

### Q.2 Agent control as MCP tools `[ ]`
- [ ] Add tools: agent_chat, agent_chat_stream, agent_believe, agent_recall, agent_know, agent_lm_rule_enable/disable, agent_explain, agent_explain_nl, agent_goal_progress.

---

## R. File Manifest

```
DELETED:
  src/nar/lm/rule-factory-v2.ts                          # A.1 — dead code, merged into lm-rule-factory.ts
  src/agent/nl-bridge.ts                                 # A.4 — subsumed by processInput routing
  tests/unit/agent/NlBridge.test.ts                      # A.4 — tests deleted module
  src/nar/tools/LearnTool.ts                             # A.5 — consolidated into Agent nar_believe tool
  src/nar/tools/ProcessTool.ts                           # A.5 — consolidated into Agent code_exec tool
  src/nar/tools/ReasonTool.ts                            # A.5 — consolidated into Agent nar_reason tool
  src/nar/tools/SearchTool.ts                            # A.5 — consolidated into Agent nar_query tool
  src/nar/tools/BraveSearchTool.ts                       # A.5 — consolidated into Agent web_search tool
  src/nar/tools/HTTPTool.ts                              # A.5 — consolidated into Agent http_fetch tool
  src/nar/tools/CalculateTool.ts                         # A.5 — consolidated into Agent calculate tool
  src/nar/tools/FileTools.ts                             # A.5 — consolidated into Agent fs_read/fs_write tools
  tests/nar/unit/tools-additional.test.ts                # A.5 — tests for deleted tools

MODIFIED (completed):
  src/nar/lm/LMRule.ts                            # A.1, C.1, C.3, C.5, D.2, G.2 — unified class, structuredModel, rich context, tool delegation, SystemEventBus events, constitutionAware
  src/nar/lm/lm-rule-factory.ts                   # A.1, C.2, C.4 — single factory with 19 rules, schemas, v2 presets, curiosity question
  src/nar/lm/index.ts                             # A.1 — removed v2 exports, added LMContext/ValidationResult/LMRuleConfigV2
  src/nar/rules/processor.ts                      # A.2, C.3 — single processLMRules(p1, p2?, opts?), rich context
  src/nar/reason/reasoner.ts                      # A.2 — use unified processLMRules()
  src/nar/reason/inference-controller.ts          # A.2 — use unified processLMRules()
  src/nar/strategies/derivation/DefaultDerivation.ts   # A.2 — use unified processLMRules()
  src/nar/strategies/derivation/AnytimeDerivation.ts   # A.2 — use unified processLMRules()
  src/nar/nl/schemas.ts                           # C.2 — added BeliefRevisionSchema, QuestionGenerationSchema
  src/agent/agent.ts                              # A.3, B.1, B.3, D.3, D.4, E.3 — processInput(), thin wrappers, ambiguity handling, SystemEventBus, LM Rule API, pause/resume
  src/agent/io-middleware.ts                      # A.4 — removed createNlInputTranslation, NlBridge import
  src/agent/io-bridge.ts                          # A.4 — removed nlBridge from BridgeOptions, createNlInputTranslation
  src/agent/index.ts                              # A.4, D.4, E.1, O.2 — removed nl-bridge re-exports, added input-processor/AutonomyEngine/types exports
  src/bin/bot-ai.ts                               # A.4, E.2 — removed nlBridge, added AutonomyEngine
  src/bin/repl.ts                                 # E.2, E.3, I.1 — AutonomyEngine, pause/resume, JsonlSessionManager
  src/nar/nl/understanding.ts                     # F.1 — structured output fallback chain
  src/nar/nl/generation.ts                        # F.2 — NL generation fallback chain
  src/nar/nl/context-assembler.ts                 # H.1, H.2, H.3 — attention weight, quality filter, token budget
  src/nar/nl/cache.ts                             # F.3 — serialize/deserialize, auto-flush, TTL
  src/nar/tools/adapters/aisdk-adapter.ts         # G.1 — constitution enforcement
  tests/nar/unit/tools.test.ts                    # A.5 — updated for remaining tools

NEW (completed):
  src/agent/SystemEventBus.ts                     # D.1 — single namespaced event bus with typed events
  src/agent/input-processor.ts                    # B.1 — unified processInput() routing, appendSessionTurns helper
  src/agent/AutonomyEngine.ts                     # E.1 — proactive notifications + adaptive reasoning
  src/agent/SessionManager.ts                     # I.1 — JsonlSessionManager with persistence
  src/agent/types.ts                              # O.2 — shared type definitions

NOT YET MODIFIED (pending):
  src/nar/nar.ts                                  # C.1 — wire structured models into rules (partial: LMRules initialized with structuredModel)
  src/nar/nar-execution.ts                        # H.2 — emit nar:reasoning:cycle events
  src/nar/nl/understanding.ts                     # F.1 — fallback chain (implemented in this session)
  src/nar/nl/generation.ts                        # F.2 — fallback chain (implemented in this session)
  src/nar/nl/context-assembler.ts                 # H.1, H.2, H.3 — attention weight, quality filter, token budget (implemented in this session)
  src/nar/nl/cache.ts                             # F.3 — serialize/deserialize (implemented in this session)
  src/nar/tools/adapters/aisdk-adapter.ts         # G.1 — constitution enforcement (implemented in this session)
  src/agent/options-schema.ts                     # O.1 — add new AgentOptions fields (done: persistKnowledge, knowledgePath)
  src/agent/config-bridge.ts                      # O.1 — pass new options through (needs update)
  src/bin/repl.ts                                 # E.2, I.1 — AutonomyEngine, JsonlSessionManager (done)
  src/api/mcp-resources.ts                        # Q.1 — NAR state, RLFP, self-reasoning
  src/api/mcp-tools.ts                            # Q.2 — explain, goal progress
  tests/conversational/framework.ts               # P.2 — new ProbeExpectations
  tests/conversational/runner.ts                  # P.3 — --record, --verify

NOT YET CREATED (pending):
  tests/conversational/scenarios/reasoning-answer.ts         # P.1
  tests/conversational/scenarios/goal-decomposition.ts       # P.1
  tests/conversational/scenarios/constitution.ts             # P.1
  tests/conversational/scenarios/drive-modulation.ts         # P.1
  tests/conversational/scenarios/proactive-notification.ts   # P.1
  tests/conversational/scenarios/rlfp.ts                     # P.1
  tests/conversational/scenarios/explanation-traceability.ts # P.1
```

## Session Summary (2026-06-15)

### Completed in this session:
- **B.4** No-drive-regex path: Removed regex-based drive patterns, drive modulation now via `TaskBatch.driveModulations` from NL understanding
- **I.2** Knowledge store persistence: Added `persistKnowledge`/`knowledgePath` options, auto-save on `stop()` and `know()`
- **J.1** NAR state serialization: Beliefs/goals/questions/attention/drives saved to `state/` JSON files on `stop()`, restored on `start()`
- **J.2** LM Rule state serialization: Per-rule stats + circuit state serialized to `state/lm-rules.json`
- **J.3** Memory persistence: Verified EpisodicMemory auto-creates directory and persists JSONL
- **K.1** RLFP state exposure: Added `getRLFPState()`, `resetRLFP()` to Agent
- **L.1** Self-reasoning exposure: Added `getSelfReasoning()`, `getReasoningQuality()` to Agent
- **N.1** Derivation trace API: Added `explainBelief()`, `explainGoal()`, `traceRule()` to Agent
- **O.1/O.2/O.3** Agent interface & types: Canonical interface in agent.ts, shared types in types.ts, strict init order in repl.ts/bot-ai.ts

### Completed in this session (continued):
- **C.1** Unified LMRule structured output: Wired AI SDK `LanguageModel` from registry to LM Rules via `setStructuredModel()`, fixed `executeStructured()` to use `generateObject()` from 'ai'
- **C.3** Richer LM Rule context: Added `driveState` (from DriveManager) and `conflictCount` (from conflict-utils) to `ruleContext` in `RuleProcessor.processLMRulesInternal()`
- **C.4** Curiosity-driven question rule: Already exists in `lm-rule-factory.ts` with `hasHighCuriosity` activation condition; now receives `driveState` in context
- **C.5** LM Rule tool delegation: Implemented in `LMRule.apply()` with `toolDispatcher` injected from NAR's `executeTool()`, gated by `enableTools` flag
- **D.2** LM Rule typed events: `LMRule.apply()` emits `lm.rule:applied`, `lm.rule:skipped`, `lm.rule:structured` on SystemEventBus
- **D.3** Agent SystemEventBus subscription: Agent subscribes to `SystemEventBus` for `lm.*` and `nar:*` events, exposes `on()`/`off()` for SystemEventMap
- **D.4** LM Rule runtime control API: Agent exposes `getLmRuleStats()`, `getLmRuleExecutionLog()`, `enableLmRule()`, `disableLmRule()`, `setLmRulePriority()`
- **E.1-E.3** AutonomyEngine: Created `src/agent/AutonomyEngine.ts`, wired in REPL and bot-ai.ts, integrated with Agent `start()`/`stop()`, pauses/resumes on user input via `processInput()`
- **F.1-F.3** NL resilience: Fallback chains implemented in understanding/generation, cache persistence with env var wiring
- **G.1** Constitutional reasoning in Agent tools: `nar_believe` and `nar_goal` tools check `nar.checkConstitutionViolation()` before execution
- **G.2** Constitutional reasoning in LM Rules: Added `constitutionAware` flag to `LMRuleConfig`, enabled for belief-modifying rules, checks in `taskFromProcessed()`
- **H.1-H.3** Adaptive context assembly: Implemented in `ContextAssembler` with attention-weighted belief selection, derivation quality filter, token budget pruning
- **K.2** RLFP feedback loop: Added `reward()` method to `RLFPLearner`, `provideRLFPFeedback()` to Agent API, `reset()` to `RLFPLearner` and `clear()` to `PreferenceCollector`
- **L.2** Self-monitoring during reasoning: Added `assessQuality()` to `SelfAnalyzerService`/`ReasoningAboutReasoning`, integrated into `NARExecution.run()` every 10 cycles, triggers self-correction if quality < 0.4
- **M.1-M.3** Autonomous goal pursuit: Goal decomposition rule wired, goals persist across sessions via state serialization, added `getGoalProgress()` and `listActiveGoals()` to Agent API
- **N.2** NL explanation generation: Added `explainInNaturalLanguage(term)` using `NLGenerationService.generate()`

### Remaining high-priority items:
- **A.5** - Actually DONE (NAR-internal tools already consolidated)

- **K.3** - RLFP-driven reasoning decisions
  - In `NARExecution.run()`, consult `NAR.rlfp.policyOptimizer` for:
    - Rule activation: use `policyOptimizer.selectStrategy(context)` to choose which LM rules to prioritize
    - Step count: scale `steps` by `policyOptimizer.config.explorationRate` (high exploration = more steps)
    - Strategy priority: use `policyOptimizer.getBestStrategy()` to order inference strategies
  - Add RLFPLearner reference to NARExecution constructor
  - Gate with `RLFP_ENABLED=true` env var

- **P.1-P.3** - Evaluation scenarios
  - **P.1**: Create 7 scenario files in `tests/conversational/scenarios/`:
    - `reasoning-answer.ts`: Multi-hop reasoning with belief derivation
    - `goal-decomposition.ts`: Complex goal → subgoals via lm-goal-decomposition
    - `constitution.ts`: Constitution violation blocked, corrected via self-correction
    - `drive-modulation.ts`: Drive changes trigger proactive reasoning
    - `proactive-notification.ts`: AutonomyEngine emits notifications on derivation/conflict
    - `rlfp.ts`: User feedback → reward → policy update → behavior change
    - `explanation-traceability.ts`: explainBelief/explainGoal/traceRule return valid chains
  - **P.2**: In `tests/conversational/framework.ts`, extend `ProbeExpectations` with:
    - `expectLmRuleFired: string[]` - rule IDs that should have fired
    - `expectBeliefCountChange: number` - delta in belief count
    - `expectNoAgentLmCall: boolean` - pure NAR path, no LM dispatch
    - `expectDriveChanged: {driveId: string; minDelta: number}`
    - `expectProactiveEvent: string` - AutonomyEngine notification type
    - `expectNarDerivations: number` - minimum derivations in run
    - `expectRLFPState: {explorationRate?: number; policyChanged?: boolean}`
    - `expectExplanationChain: {minPremises: number; minConfidence: number}`
  - **P.3**: In `tests/conversational/runner.ts`:
    - Add `--record` flag: saves actual outputs to `tests/conversational/golden/`
    - Add `--verify` flag: compares outputs against golden files
    - Use `jest --updateSnapshot`-style diff for failures

- **Q.1-Q.2** - MCP Integration
  - **Q.1**: In `src/api/mcp-resources.ts`, add resource handlers:
    - `sessions://{key}` → session history JSON
    - `knowledge://{key}` → knowledge store entry
    - `lm-rules://stats` → `getLmRuleStats()` output
    - `lm-rules://execution-log` → `getLmRuleExecutionLog()` output
    - `nar://attention` → `nar.attentionReport()`
    - `nar://state` → beliefs/goals/questions summary
    - `rlfp://state` → `getRLFPState()` output
    - `self-reasoning://quality` → `getReasoningQuality()` output
  - **Q.2**: In `src/api/mcp-tools.ts`, add tool handlers:
    - `agent_chat` → `agent.chat(input)`
    - `agent_chat_stream` → `agent.chatStream(input)` as streaming resource
    - `agent_believe` → `agent.believe(narsese)`
    - `agent_recall` → `agent.recall(query, limit)`
    - `agent_know` → `agent.know(key, value)` / `agent.knowGet(key)`
    - `agent_lm_rule_enable` / `agent_lm_rule_disable` → `enableLmRule`/`disableLmRule`
    - `agent_explain` → `agent.explainBelief(term)` / `agent.explainGoal(term)`
    - `agent_explain_nl` → `agent.explainInNaturalLanguage(term)`
    - `agent_goal_progress` → `agent.getGoalProgress(goalId)` / `agent.listActiveGoals()`
  - Wire resources/tools in `src/api/mcp-server.ts` MCP server registration
