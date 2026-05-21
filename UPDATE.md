# Agent Unification & Architecture Consolidation Plan

## Vision

Create a single, elegant `Agent` class that serves as the **unified entry point** for all message processing across REPL, IRC, WebSocket, HTTP, and MCP connections. The Agent should:

1. **Own the full pipeline** - No duplicate message processing paths
2. **Manage connections** - Direct integration with ConnectionManager
3. **Maintain conversation state** - Single source of truth via ConversationStateManager
4. **Support background reasoning** - Optional AgenticLoop as background task scheduler
5. **Provide neurosymbolic integration** - Seamless NARS + LM reasoning

---

## Design Decisions Summary

### Decision 1: Migration Strategy → **C (Rename Bot → Agent)**
- Bot has the full pipeline we want
- Rename Bot → Agent, then add ConnectionManager integration
- Preserves sophisticated pipeline while adding connection management
- Old Agent/Bot deleted, not deprecated

### Decision 2: ChatResponder → **Eliminate**
- Redundant with LMResponder pipeline stage
- All LM responses flow through pipeline
- Delete `src/agent/ChatResponder.ts`

### Decision 3: ResponseInterpreter → **Fold into DirectiveProcessor**
- DirectiveProcessor already exists as pipeline stage
- Does everything ResponseInterpreter does (plus loop-back logic)
- Delete `src/agent/ResponseInterpreter.ts`
- Enhance DirectiveProcessor if needed

### Decision 4: SkillCatalog → **Keep but deprecate**
- Only used for metadata (descriptions), not execution
- Not critical path
- Mark for future removal or integration

### Decision 5: CommandRegistry → **Single shared instance**
- Commands are infrastructure (like NAR itself)
- CommandProcessor stage uses the registry
- Internal code can call commands directly from registry
- One registry, multiple consumers

### Decision 6: AgenticLoop → **Background task scheduler (A)**
- NOT a message processor
- Schedules periodic reasoning, LM enrichment, memory consolidation
- External messages all go through `Agent.processMessage()`
- Becomes optional Agent module

### Decision 7: processMessage() signature → **A (IOMessage + ChannelContext)**
```typescript
processMessage(msg: IOMessage, ctx: ChannelContext): Promise<ChannelResponse>
```
- IOMessage is immutable input
- ChannelContext provides response channel
- Matches Bot's pattern, makes testing easy
- Works for REPL, IRC, WS, HTTP, MCP

### Decision 8: Configuration → **B (Modular)**
```typescript
AgentConfig = CoreConfig + PipelineConfig + ConnectionConfig[] + OptionalModules
```
- Core config: NAR, profile (required)
- Pipeline config: reasoning behavior (sensible defaults)
- Connection configs: optional, add dynamically
- Matches component architecture

---

## Phase 1: Core Agent Consolidation

### 1.1 Remove Redundant Classes

**Delete:**
- ❌ `src/agent/Bot.ts` → Folded into unified Agent
- ❌ `src/agent/ConversationManager.ts` → Replaced by ConversationStateManager
- ❌ `src/agent/ChatResponder.ts` → Replaced by LMResponder pipeline stage
- ❌ `src/agent/ResponseInterpreter.ts` → Folded into DirectiveProcessor

**Keep & Enhance:**
- ✅ `src/agent/Agent.ts` → Becomes the unified entry point (renamed from Bot)
- ✅ `src/agent/ConversationStateManager.ts` → Primary conversation state
- ✅ `src/agent/ConversationState.ts` → State structure
- ✅ `src/agent/BotProfile.ts` → Bot identity
- ✅ `src/agent/SkillCatalog.ts` → Metadata registry (deprecated)

### 1.2 New Agent Architecture

```typescript
export class Agent {
  // Core components (required)
  readonly nar: NAR;
  readonly pipeline: MessagePipeline;
  readonly conversationManager: ConversationStateManager;
  readonly connectionManager: ConnectionManager;
  readonly authManager: AuthManager;
  readonly commands: CommandRegistry;
  
  // Optional modules
  readonly agenticLoop?: AgenticLoop;        // Background task scheduler
  readonly episodicMemory?: EpisodicMemory;
  
  // Configuration
  readonly config: AgentConfig;               // Modular config
  readonly profile: BotProfile;
  
  // Single entry point
  async processMessage(
    msg: IOMessage,
    ctx: ChannelContext
  ): Promise<ChannelResponse>;
}
```

### 1.3 Pipeline Stages (Final List)

1. `InputNormalizer` - Normalize input encoding, whitespace
2. `AuthChecker` - Validate authentication
3. `InputClassifier` - Detect intent (chat/reason/query/narsese/command)
4. `NLAnalyzerStage` - Deep natural language analysis
5. `CommandProcessor` - Execute commands (if input is command)
6. `SeNARSProcessor` - NARS reasoning with LM rules
7. `ReasoningTriggerStage` - Adaptive reasoning depth
8. `LMResponder` - Generate natural language responses
9. `DirectiveProcessor` - Extract and execute directives
10. `ResponseComposer` - Compose final response
11. `ResponseFormatter` - Format for channel (IRC/WS/HTTP/etc)
12. `StatePersistor` - Persist conversation state

---

## Phase 2: Connection Integration

### 2.1 Unified Connection Handling

**All connections use identical pipeline:**
- CLI/REPL → Connection adapter → Agent.processMessage()
- IRC → Connection adapter → Agent.processMessage()
- WebSocket → Connection adapter → Agent.processMessage()
- HTTP → Connection adapter → Agent.processMessage()
- MCP → Connection adapter → Agent.processMessage()

### 2.2 Message Flow

```
User Input
    ↓
Connection Adapter (cli/irc/ws/http/mcp)
    ↓
IOMessage { id, source, sender, text, timestamp }
    ↓
Agent.processMessage(msg, ctx)
    ↓
MessagePipeline
    ├── InputNormalizer
    ├── AuthChecker
    ├── InputClassifier
    ├── SeNARSProcessor (NARS + LM rules)
    ├── LMResponder (response generation)
    ├── DirectiveProcessor (extract actions)
    └── ResponseComposer
    ↓
ChannelResponse { text, actions, metadata }
    ↓
Connection.send(target, text)
```

---

## Phase 3: Neurosymbolic Integration

### 3.1 NARS + LM Rules (Preserved)

**12 built-in LM rules** from `src/nar/lm/rules.ts`:
- Narsese translation
- Belief revision
- Goal decomposition
- Hypothesis generation
- Analogical reasoning
- Meta-reasoning
- Uncertainty calibration
- Schema induction
- Temporal-causal modeling
- Variable grounding
- Concept elaboration
- Interactive clarification

### 3.2 NL Translation Pipeline

**Multi-tier approach:**
1. Pattern matching (fast, common phrases) - 15 built-in parsers
2. LM translation (fallback, complex input)
3. Interactive clarification (when ambiguous)

### 3.3 Context Building for LM

LMResponder builds rich context from:
- Attention report (active concepts)
- Related beliefs
- Link structure
- Recent derivations
- Goals and questions
- Working memory state
- Episodic recall (if enabled)

---

## Phase 4: Background Reasoning

### 4.1 AgenticLoop as Background Scheduler

**AgenticLoop responsibilities:**
- ✅ Run NARS derivation steps on idle cycles
- ✅ Trigger LM enrichment (proactive concept elaboration)
- ✅ Memory consolidation
- ✅ Self-analysis (detect reasoning gaps)
- ✅ Episodic logging
- ❌ NOT message processing (removed)

**AgenticLoop becomes:**
```typescript
class AgenticLoop {
  constructor(agent: Agent, config: AgenticLoopConfig)
  
  start(): void;   // Start background task scheduler
  stop(): void;    // Stop scheduler
  
  // No more setMessageHandler, pushMessage
  // These are removed - messages go through Agent.processMessage()
}
```

### 4.2 Wake Cycle Activities

Configurable wake/sleep cycles:
- Wake interval: default 60s
- Reasoning steps per wake: default 5
- LM enrichment: enabled/disabled
- Memory consolidation: enabled/disabled

---

## Phase 5: Configuration Structure

### 5.1 Modular Configuration

```typescript
interface AgentConfig {
  // Core (required)
  nar: NARConfig;
  profile: BotProfile;
  
  // Pipeline (sensible defaults)
  pipeline: {
    stages?: PipelineStageConfig[];
    maxLoops: number;              // Default: 2
    enableLoopBack: boolean;       // Default: true
    loopBackOn: ('believe' | 'question' | 'tool_call')[];
    stageTimeoutMs: number;        // Default: 30000
  };
  
  // Conversation
  conversation: {
    maxHistory: number;            // Default: 20
    summaryThreshold: number;      // Default: 30
    maxArtifacts: number;          // Default: 50
  };
  
  // Reasoning
  reasoning: {
    autoTrigger: boolean;          // Default: true
    triggerThreshold: number;      // Default: 0.5
    maxStepsPerTrigger: number;    // Default: 3-5 (adaptive)
    adaptiveDepth: boolean;        // Default: true
  };
  
  // LM integration
  lm: {
    enabled: boolean;              // Default: true
    streaming: boolean;            // Default: false
    rules: LMRuleConfig[];         // Default: all 12 rules enabled
    enrichment: {
      enabled: boolean;            // Default: true
      intervalMs: number;          // Default: 60000
    };
  };
  
  // Optional: AgenticLoop
  agenticLoop?: {
    enabled: boolean;              // Default: false
    wakeupIntervalMs: number;      // Default: 60000
    reasoningStepsPerWake: number; // Default: 5
  };
  
  // Optional: Connections (can add dynamically)
  connections?: ConnectionConfig[];
}
```

### 5.2 Default Configurations

**Minimal REPL config:**
```typescript
const replConfig: AgentConfig = {
  nar: { /* NARS config */ },
  profile: { name: 'SeNARS', personality: '...' },
  pipeline: { /* defaults */ },
  conversation: { /* defaults */ },
  reasoning: { /* defaults */ },
  lm: { enabled: false },  // Optional
  // No agenticLoop, no connections
};
```

**Full multi-connection config:**
```typescript
const fullConfig: AgentConfig = {
  nar: { /* NARS config */ },
  profile: { name: 'SeNARS', personality: '...' },
  pipeline: { /* defaults */ },
  conversation: { /* defaults */ },
  reasoning: { /* defaults */ },
  lm: { enabled: true, streaming: true },
  agenticLoop: {
    enabled: true,
    wakeupIntervalMs: 60000,
    reasoningStepsPerWake: 5
  },
  connections: [
    { type: 'irc', config: { /* ... */ } },
    { type: 'websocket', config: { /* ... */ } },
    { type: 'http', config: { /* ... */ } }
  ]
};
```

---

## Phase 6: Implementation Steps

### Step 1: Prepare Ground Truth ✅
- [x] Read all current Agent.ts and Bot.ts code
- [x] Identify all methods/properties used externally
- [x] Document migration path

### Step 2: Create Unified Agent
- [ ] Create `src/agent/Agent.ts` (new, unified)
  - [ ] Rename current Bot → Agent
  - [ ] Integrate ConnectionManager
  - [ ] Integrate CommandRegistry
  - [ ] Integrate AuthManager
  - [ ] Add AgenticLoop as optional module
- [ ] Delete old files:
  - [ ] `src/agent/Bot.ts`
  - [ ] `src/agent/ConversationManager.ts`
  - [ ] `src/agent/ChatResponder.ts`
  - [ ] `src/agent/ResponseInterpreter.ts`

### Step 3: Update Entry Points
- [ ] Update `src/bin/bot.ts`:
  ```typescript
  import {Agent} from '../agent/Agent.js';
  const agent = new Agent({...});
  ```
- [ ] Update `src/cli/repl.ts`:
  ```typescript
  import {Agent} from '../agent/Agent.js';
  const agent = new Agent({...});
  ```
- [ ] Update `src/agent/AgenticLoop.ts`:
  - Remove message processing
  - Convert to background task scheduler
- [ ] Update all tests

### Step 4: Update Pipeline Stages
- [ ] Ensure all 12 stages work with unified Agent
- [ ] Integrate NLAnalyzerStage
- [ ] Enhance ReasoningTriggerStage
- [ ] Add rule success tracking (foundational)
- [ ] Improve error handling

### Step 5: Test & Validate
- [ ] All existing tests pass
- [ ] REPL works identically
- [ ] IRC connection works
- [ ] WebSocket connection works
- [ ] HTTP connection works
- [ ] MCP server works
- [ ] Background reasoning works (if enabled)

---

## Success Criteria

1. ✅ **Single entry point**: All input flows through `Agent.processMessage(msg, ctx)`
2. ✅ **No redundancy**: Each capability implemented once
3. ✅ **Identical behavior**: REPL and connections use same pipeline
4. ✅ **Backward compatible**: Existing code works with minimal changes
5. ✅ **Extensible**: Easy to add custom stages, tools, rules
6. ✅ **Performant**: No unnecessary overhead from consolidation
7. ✅ **Testable**: All functionality covered by tests

---

## Risk Mitigation

**Risk**: Breaking existing integrations  
**Mitigation**: Comprehensive test suite, run before/after each phase

**Risk**: Losing functionality in consolidation  
**Mitigation**: Feature checklist, verify each feature post-consolidation

**Risk**: Performance regression  
**Mitigation**: Benchmark REPL and connection response times before/after

**Risk**: Configuration complexity  
**Mitigation**: Sensible defaults, progressive enhancement, minimal config required

---

## Timeline

- **Phase 1-2**: Core consolidation (2-3 days)
- **Phase 3-4**: Integration & enhancement (2-3 days)
- **Phase 5-6**: Testing & validation (2-3 days)

**Total**: 6-9 days for full consolidation

---

## Notes

- This plan prioritizes **working software** over perfect architecture
- Each phase produces a runnable, testable system
- Rollback possible after each phase
- Focus on vertical slice: Bot/Agent functionality first
- Background reasoning and self-optimization are secondary
- **Key insight**: Bot has the pipeline, Agent has the connections → merge into unified Agent

---

## Future Enhancements (Post-Consolidation)

### Self-Optimization Foundation
- Track rule success rates per concept type
- Adjust rule priorities dynamically (exponential moving average)
- Detect ineffective rule patterns
- Constitution evolution

### Advanced Features
- Multi-agent collaboration
- Distributed reasoning
- Persistent knowledge graphs
- Advanced episodic memory with retrieval

These are **out of scope** for initial consolidation but the architecture should support them.
