# Agent Rewrite Plan: Thin Coordinator Over NAR Cognitive Architecture

## Diagnosis

The current `agent.ts` (737-line `createAgent`) reimplements a second cognitive architecture
on top of NAR, which **already** provides memory, attention, goals, beliefs, self-analysis,
working memory, metacognition, and LM integration. This creates a duplicate layer that is
harder to maintain, diverges from NAR's native semantics, and obscures the real role of an
Agent: **coordinating NARS + LM in an autonomous cognitive loop**.

The `src/agent/services/` folder was already deleted (commit `69dc3dd`) after we realized it
was a duplicate of `src/nar/cognitive/`. The current files are a reintroduction of the same
concepts. We need to finish the job.

## Target Architecture

```
┌──────────────────────────────────────────────────────────┐
│  AGENT (thin coordinator, ~150 lines)                   │
│                                                          │
│  start() → runs NAR's native cycle                       │
│  chat()   → LM perceives → NAR reasons → LM explains     │
│  believe() → delegates to NAR                             │
│  recall()  → delegates to EpisodicMemory                  │
│                                                          │
│  Owns ONLY: session management, tool adapter, NL bridge  │
├──────────────────────────────────────────────────────────┤
│  NAR (full cognitive kernel)                             │
│  ┌────────┬───────────┬────────────┬─────────────────┐  │
│  │ Memory │ Working   │ Episodic   │ Self-analysis   │  │
│  │ +Focus │ Memory    │ Memory     │ (RAR, Optimizer │  │
│  │ +Bag   │ (scratch) │ (disk)     │  Observer)      │  │
│  ├────────┴───────────┴────────────┴─────────────────┤  │
│  │ LM Integration                                     │  │
│  │  ┌───────────┬──────────────┬──────────────────┐  │  │
│  │  │ LM Rules  │ NL↔Narsese  │ Proactive        │  │  │
│  │  │ (infer.)  │ Translation  │ Enrichment       │  │  │
│  │  └───────────┴──────────────┴──────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## Phase 1: Delete Duplicate Files

These files replicate NAR-native capabilities. Delete them and ensure no importers remain.

| File | Replaces With |
|------|---------------|
| `src/agent/GoalManager.ts` (164 lines) | `nar.goal()`, `nar.getGoals()`, `nar.input()` |
| `src/agent/MetaCritic.ts` (87 lines) | `nar.getSelfAnalyzer()?.performSelfCorrection()`, `nar.getSelfAnalyzer()?.performMetaCognitiveReasoning()` |
| `src/agent/Drives.ts` (97 lines) | `nar.getSelfAnalyzer()?.performSelfCorrection()` (curiosity/coherence/competence are built into NAR's ObserverService) |
| `src/agent/EpisodeWorkingMemory.ts` (126 lines) | `nar.workingMemory` (NAR's built-in scratchpad) |
| `src/agent/WMManager.ts` (43 lines) | NAR handles its own working memory lifecycle via `Memory.focus` + `attentionModel` |
| `src/agent/SystemPrompt.ts` (109 lines) | `ContextBuilder` from `src/nar/nl/context.ts` |

**Checklist:**
- [ ] Delete each file
- [ ] Remove all exports from `src/agent/index.ts`
- [ ] Remove all imports from `src/agent/agent.ts`
- [ ] Update test files (no longer import deleted classes)

---

## Phase 2: Refactor `agent.ts` to Thin Coordinator

Current: 737 lines, reimplements every cognitive subsystem.
Target: ~150 lines, pure coordinator.

### What `agent.ts` Should Own

1. **Session management** — `ConversationSession`, `SessionManager` (keep unchanged)
2. **NL Bridge** — `nl-bridge.ts` wraps NAR's `NLTranslator` + `ResultInterpreter` (keep)
3. **External tools** — web search, code exec, file system, HTTP (keep)
4. **Agent-specific tools** — `know`, `recall`, `agent_instruct`, `get_session_info` (keep in tools.ts)
5. **Model runner** — `ModelRunner` wraps LM for the tool-call loop (keep; NAR has no equivalent)
6. **Event bus** — `AgentEventBus` for external listeners (keep; NAR's event bus is internal)

### What `agent.ts` Should Delegate (not duplicate)

These all exist in NAR already — delegate directly:

```
Agent.chat() → Agent.start() runs NAR cycle
  │
  ├─ input is Narsese? → nar.input(term, type, truth)
  │
  ├─ input is NL?
  │   ├─ nlBridge.nlToNarsese(nl) → nar.input(...)
  │   └─ (or) ModelRunner.run(composed)
  │       └─ tools include: NAR tools + external tools + agent tools
  │
  ├─ nar.run(steps)    ← NAR reasons (LM Rules fire automatically)
  │
  └─ nar.self?.performSelfCorrection()  ← metacognition built-in

Agent.start()  → nar.start()   (NAR's own cycle)
Agent.stop()   → nar.stop()
```

### New `AgentOptions` Shape

```ts
export interface AgentOptions {
  nar: NAR;                          // required — no Agent without NAR
  lmClient?: LMClient;               // optional — enables NL + tool use
  systemInstructions?: string;
  workspaceRoot?: string;
  externalTools?: {
    webSearch?: {apiKey?: string};
    codeExec?: {maxTimeout?: number; maxOutputBytes?: number};
    fs?: {maxReadSize?: number};
  };
  approvalManager?: ApprovalManager;
}
```

**Checklist:**
- [ ] Rewrite `createAgent()` — remove `GoalManager`, `MetaCritic`, `Drives`, `WMManager`, `EpisodeWorkingMemory`
- [ ] Wire `buildContext()` to `ContextBuilder.build()` directly
- [ ] Rewrite `start()` → delegates to `nar.start()`, subscribes to NAR events
- [ ] Rewrite `stop()` → delegates to `nar.stop()`
- [ ] Keep `chat()`, `chatWithHistory()`, `chatStream()` — these are the UX-facing methods
- [ ] Keep `recall()` → delegates to `episodicMemory`
- [ ] Keep `believe()` → delegates to `nar.input()`
- [ ] Remove `know()/knowGet()/knowList()` → use NAR beliefs
- [ ] Remove `getGoals()/addGoal()/getActiveGoal()` → use `nar.getGoals()`
- [ ] Remove `getMetaScore()` → use `nar.getSelfAnalyzer().getMonitorState()`
- [ ] Remove `getRecentDerivations()` → use `nar.memory` directly

---

## Phase 3: LM Integration Points (already exist in NAR)

Reinforce these as the canonical paths:

| Purpose | Mechanism | Location |
|---------|-----------|----------|
| NL → Narsese | `NLTranslator.translate(nl)` → regex + LM fallback | `src/nar/nl/translator.ts` |
| Narsese → NL | `ResultInterpreter.interpret()` | `src/nar/nl/interpreter.ts` |
| Tool orchestration | `ModelRunner` (manages LM tool-call loop) | `src/agent/model/ModelRunner.ts` |
| LM-augmented inference | `LMRule.apply()` — fires during `nar.run()` | `src/nar/lm/LMRule.ts` |
| Concept enrichment | `ProactiveEnricher.runEnrichmentCycle()` | `src/nar/lm/enrichment.ts` |
| Bidirectional feedback | `BidirectionalFeedbackLoop.processHypothesis()` | `src/nar/lm/feedback.ts` |
| Clarification | `generateClarificationWithLM()` | `src/nar/nl/clarification.ts` |
| Classification | `classify(input)` (NL intent) | `src/nar/nl/classifier.ts` |
| Explanation/tracing | `nar.traceAPI.explain()`, `nar.traceAPI.trace()` | `src/nar/query/trace.ts` |
| Summarization | `nar.getSelfAnalyzer().systemAnalysis()` | `src/nar/self/ReasoningAboutReasoning.ts` |

### The Autonomous Loop (NAR self module)

The NAR's `ReasoningAboutReasoning` service already runs periodically:

```
nar.start()
  → ReasoningAboutReasoning.start()
    → periodicInterval (every REASONING_INTERVAL_MS)
      → performMetaCognitiveReasoning()
        → SelfAnalyzerService.analyzeReasoningPatterns()
        → SelfOptimizer.identifyOptimizations()
        → SelfOptimizer.applyOptimizations()
      → performSelfCorrection()
        → identifyIssues()  (contradictions, inefficiencies, resources)
        → applyCorrections()
          → memory consolidation, priority rebalancing, rule optimization
```

The Agent should **not duplicate this**. It should simply call `nar.start()` and observe
events via NAR's event bus.

---

## Phase 4: File Manifest After Rewrite

### Keep (unchanged or minor edits)

| File | Purpose |
|------|---------|
| `src/agent/index.ts` | Re-export barrel |
| `src/agent/chat-history.ts` | Format conversation turns for LM |
| `src/agent/ConversationSession.ts` | Turn history data structure |
| `src/agent/SessionManager.ts` | Persist/load sessions |
| `src/agent/nl-bridge.ts` | Wraps NAR's NL translator + interpreter |
| `src/agent/options-schema.ts` | Zod validation for options |
| `src/agent/presets.ts` | Factory presets (simplify after rewrite) |
| `src/agent/config-bridge.ts` | Map config objects to AgentOptions |
| `src/agent/register-commands.ts` | IRC/CLI command registration |
| `src/agent/io-*.ts` | IRC/REPL connection middleware |
| `src/agent/model/ModelRunner.ts` | LM tool-call loop (LM ← → tools) |
| `src/agent/model/ToolDispatcher.ts` | Execute tool calls |
| `src/agent/AgentEventBus.ts` | External event listeners |
| `src/agent/tools.ts` | Agent-specific tools (know, recall, session) |

### Delete

| File | Lines | Reason |
|------|-------|--------|
| `src/agent/GoalManager.ts` | 164 | Duplicates `nar.goal()` + `nar.getGoals()` |
| `src/agent/MetaCritic.ts` | 87 | Duplicates NAR self-analysis |
| `src/agent/Drives.ts` | 97 | Duplicates NAR ObserverService |
| `src/agent/EpisodeWorkingMemory.ts` | 126 | Duplicates `nar.workingMemory` |
| `src/agent/WMManager.ts` | 43 | No-op after deletion |
| `src/agent/SystemPrompt.ts` | 109 | Duplicates `ContextBuilder` |
| `src/agent/dashboard.ts` | — | UI concern, not agent logic |

### Delete (test files)

| File | Reason |
|------|--------|
| `tests/unit/agent/GoalManager.test.ts` | Tested class deleted |
| `tests/unit/agent/Cognition.test.ts` | Tests MetaCritic + Drives |
| `tests/unit/agent/Drives.test.ts` | Tested class deleted |
| `tests/unit/agent/WMManager.test.ts` | Tested class deleted |

### Refactor (heavily)

| File | Action |
|------|--------|
| `src/agent/agent.ts` | 737 → ~150 lines, thin coordinator |
| `src/agent/index.ts` | Remove deleted exports |

---

## Phase 5: Migration Order

Do this in strict sequence to avoid broken intermediate states.

```
Step 1: DELETE GoalManager, MetaCritic, Drives, EpisodeWorkingMemory, WMManager, SystemPrompt
Step 2: REMOVE their exports from index.ts
Step 3: DELETE their test files
Step 4: REWRITE agent.ts
        - Strip all deleted-class references
        - Wire buildContext → ContextBuilder
        - Wire start/stop → nar.start/nar.stop
        - Wire metacognition → nar.getSelfAnalyzer()
        - Wire working memory → nar.workingMemory
Step 5: SIMPLIFY presets.ts to match new AgentOptions
Step 6: UPDATE agent tests to new shape
        - Remove tests for deleted features
        - Test that Agent delegates to NAR correctly
Step 7: VERIFY bin/repl.ts and bin/bot-ai.ts still work
Step 8: RUN full test suite
```

---

## Key Principles Going Forward

1. **NAR owns cognition.** Memory, attention, goals, beliefs, self-analysis, curiosity,
   coherence, competence — all live in `src/nar/`. The Agent never reimplements them.

2. **Agent owns UX.** Session management, connection handling (IRC/REPL), NL bridging,
   and the LM tool-call loop. These are external-facing concerns that don't belong in NAR.

3. **LM is a plugin to NAR.** `LMRule` instances fire during `nar.run()` to augment
   inference. `ProactiveEnricher` queries the LM to enrich memory. `NLTranslator` and
   `ResultInterpreter` translate at the edges. The ModelRunner orchestrates the LM for
   tool use. These all use the same `LMClient` interface.

4. **The autonomous loop lives in NAR.** `nar.start()` activates `ReasoningAboutReasoning`
   periodic self-analysis, `ProactiveEnricher` cycles, and `Memory.consolidate()`. The Agent
   just calls `nar.start()` once and listens to events.

5. **Test behavior, not implementation.** Agent tests should verify that NAR receives the
   right inputs and the right outputs flow back. Don't test NAR internals through the Agent.
