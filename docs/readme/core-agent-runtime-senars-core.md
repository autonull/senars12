### Core Agent Runtime (`@senars/core`)

The **Agent** class is the central orchestrator — a multi-engine cognitive runtime. The Agent wraps the Kernel, executing the **Agent Macro-Cycle**: `Perceive → Recall → Reason → Narrate → Consolidate → Act → Record → Announce` (`DEFAULT_MACRO_PIPELINE`) — the Kernel's 6-stage Micro-Tick runs inside "Reason".

```typescript
import { Agent, LLMCortex, createCortexFromLM, SqliteEventLog, JsonlSessionManager } from '@senars/core';
import { createAgent } from '@senars/nar/agent';
import { NAREngine } from '@senars/nar/engine';
import { NAR } from '@senars/nar';

const agent = await createAgent({
  log: new SqliteEventLog({ path: '.cache/agent.db' }),
  cortex: createCortexFromLM(lmService),
  episodicMemory,
  sessionManager: new JsonlSessionManager({ path: '.cache/sessions' }),
  builtinTools: true,
  commandParser: new MettaCommandParser().parse,
});

// NAR is the only reasoning engine; MeTTa is available as the `metta` tool
agent.registerEngine('nar', new NAREngine(nar));

// Start the agent
await agent.start();

// Chat interface (streams responses)
for await (const event of agent.chat("What is a cat?")) {
  if (event.kind === 'text-delta') console.log(event.text);
}

// Health & capabilities
agent.health();     // { status: 'healthy', cycleCount: 42, ... }
agent.capabilities(); // { engine: 'metta', supports: { chat: true, skills: true, ... } }
```

**Agent Macro-Cycle:**

| Phase | Function |
|-------|----------|
| **Perceive** | Emit `input.user` cognitive event |
| **Recall** | Retrieve working/episodic/semantic memory |
| **Reason** | Query all registered engines (NAR) — wraps the Kernel Micro-Tick |
| **Narrate** | Synthesize response via LLMCortex or raw derivations |
| **Consolidate** | Merge/decay episodic memory — runs *before* Act |
| **Act** | Parse commands, check policy, execute tools |
| **Record** | Append the turn's outcome to the event log |
| **Announce** | Emit the cycle's outward-facing events |

**Key Subsystems:**

| Subsystem | Exports | Purpose |
|-----------|---------|---------|
| **Agent** | `Agent`, `createAgent`, `AgentOptions` | Main runtime |
| **Engines** | `BaseEngine`, `NAREngine` | Reasoning backends (MeTTa is a tool, not an engine) |
| **Cortex** | `LLMCortex`, `createCortexFromLM` | LLM narrative synthesis |
| **Memory** | `MemoryService`, `InMemorySessionManager`, `JsonlSessionManager` | Working + episodic + sessions |
| **Event Log** | `InMemoryEventLog`, `SqliteEventLog` | Persistent cognitive audit trail |
| **Tools** | `ToolRegistry`, `BUILTIN_TOOLS`, `buildAgentTools` | Function calling + skills |
| **Policy** | `PolicyEngine`, `PolicyRule` | Guardrails / HITL approval |
| **Approval** | `ApprovalService`, `PendingApproval` | Human-in-the-loop |
| **Model Runner** | `ModelRunner`, `ToolCall`, `ModelEvent` | LLM orchestration |
| **Knowledge** | `KnowledgeManager` | Structured knowledge CRUD |
| **Stats** | `StatsManager`, `AgentStats` | Telemetry |
| **Lens/Protocol** | `Lens`, `GraphNodeData`, `GraphOp` | UI projection types |
| **Utils** | `makeId`, `generateId`, `clamp`, `sleep`, ... | Shared utilities |
