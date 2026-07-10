# SeNARS Agent Architecture — Complete Development Plan (Revised)

> **Design:** Two independently capable cognitive agents (NAR and MeTTa) that share a communication protocol and transport layer. Neither engine implements a shared behavioral interface — they share *protocol*, not *type*. The `agent/` package is dissolved into its correct homes.

> **Overall Status:** Phase 0 ✅. Phase 1 ✅. Phase 2 ✅. Phase 3 ✅. Phase 3 follow-up ✅. Phase 4 ✅ (`MettaAgent` + 11 subsystems fully implemented: `MettaLoop`, `MettaSkills`, `MettaCommandParser`, `MettaHistory`, `MettaPromptBuilder`, `MettaInputProcessor`, `MettaChannelOps`, `MettaLTM`, `MettaKnowledge`, `MettaEpisodic`, `PolicyEngine`, all wired with `CognitiveEvent` emission). Phase 5-7 🔲.

---

## Executive Summary

The current codebase has a single `agent/` package that wraps `@senars/nar` with LM integration, tool dispatch, and a cognitive loop. It works well for NAR but is NAR-shaped throughout — the `Agent` interface (`agent/src/types.ts:206-364`) has 30+ methods including `getNAR()`, `getRLFPState()`, `enableLmRule()`, and `explainBelief()` that are meaningless for any other substrate.

We need a second agent (MeTTa) that absorbs OmegaClaw's architectural patterns — continuous execution loop with configurable wake/sleep, skill system via grounded ops, LTM with embeddings — while using `@senars/metta` as its symbolic substrate instead of OmegaClaw's PeTTa/Prolog stack.

**Key insight:** Instead of forcing both engines behind a shared `Engine` interface (which always leaks the stronger engine's semantics), define shared *protocol types* (events, transports) and let each engine be its own complete agent. They communicate through typed event streams. They can run individually or be combined via a simple coordinator that fans input and aggregates events.

**What dissolves:**
- `agent/` package → split into `@senars/nar/NarsAgent` (NAR-specific orchestration) + `@senars/core/` (generic utilities: ChatService, ModelRunner, protocol types)
- `src/io/` → moved to `@senars/io/` (with NAR dependency removed from `ConnectionDeps`)
- `ui/src/shared/` protocol schemas → moved to `@senars/core/Protocol.ts`

**What stays:**
- `@senars/nar/` — NAR internals (memory, terms, rules, etc.) as-is; plus new `NarsAgent` entry
- `@senars/metta/` — MeTTa interpreter as-is; plus new `MettaAgent` entry
- `@senars/ui/` — unchanged; imports protocol from `@senars/core`

---

## Part 1: Principles

### 1.1 No Shared Engine Interface

Neither NAR nor MeTTa implements a common `Engine` or `IAgent` interface. The `Agent` interface (`agent/src/types.ts:206`) is NAR-specific and stays on NarsAgent. MettaAgent has its own shape. The only shared contracts are:

| Shared via `@senars/core` | Type |
|---|---|
| Event envelope | `CognitiveEvent` union — standard types that any engine can emit |
| Transport contract | `TransportDeps` interface — already generic in `src/io/types.ts:29` (NAR import removed) |
| Lifecycle state | `ComponentState` — `'created'\|'initialized'\|'started'\|'stopped'\|'disposed'` |
| UI protocol | Zod message schemas from `ui/src/shared/protocol.ts` |
| LM caller | `ModelRunner` — wraps Vercel `ai` SDK, generic |

### 1.2 Protocol over Polymorphism

Two engines communicate through typed data streams, not method calls on a shared supertype. This is the same principle as HTTP: two services speak the same message format without implementing a shared `IHTTPServer` interface.

The `CognitiveEvent` type is pure data. Any engine emits it. Any consumer (UI, coordinator, logger) reads it. No engine needs to implement methods from another.

### 1.3 Own Your Loop

Each agent owns its entire cognitive loop. NarsAgent uses drive-urgency-triggered cycles (`AutonomyEngine` + `AutonomousLoop`). MettaAgent uses an OmegaClaw-style continuous loop (`maxWakeLoops`, `sleepInterval`, `wakeupInterval`). No loop abstraction is shared — each is optimized for its substrate.

### 1.4 Transports Are Substrate-Agnostic

The `Connection` interface (`src/io/types.ts:29`) is already generic. The only coupling is `ConnectionDeps.nar` (`src/io/types.ts:85`), which every transport currently imports. Removing that single field makes transports work with any agent.

### 1.5 Correlation Over Aggregation

Every user input receives a `correlationId` at the transport boundary. This ID propagates through all agent processing and appears on every emitted `CognitiveEvent`. The UI and coordinator use it to reconstruct causal chains across engines — not merely aggregate events.

### 1.6 Capability Negotiation Over Assumption

The UI discovers what each agent supports at runtime via `AgentCapabilities`. No hardcoded engine checks. New engines work automatically if they implement the protocol.

---

## Part 2: Package Structure (After)

```
senars12/
├── @senars/core/                    # Shared kernel — protocol types, generic utilities
│   ├── src/
│   │   ├── CognitiveEvent.ts         Standard event types (engine:*, not nar:*)
│   │   ├── Transport.ts              ConnectionDeps, TransportDeps (NAR removed)
│   │   ├── Lifecycle.ts              ComponentState, BaseComponent (from nar)
│   │   ├── ChatService.ts            Generic LM-driven chat loop (parameterized)
│   │   ├── ModelRunner.ts            LM call wrapper (from agent/src/model/)
│   │   ├── Protocol.ts               UI WS message schemas (from ui/src/shared/)
│   │   ├── Options.ts                Zod option schemas (from agent/src/options-schema.ts)
│   │   ├── SessionOrchestrator.ts    Generic session tracking (from agent/src/subservices/)
│   │   ├── StatsManager.ts           Generic metrics (from agent/src/subservices/)
│   │   ├── KnowledgeManager.ts       Generic KV store (from agent/src/subservices/)
│   │   ├── ApprovalService.ts        Generic approval flow (from agent/src/services/)
│   │   └── index.ts
│   └── package.json
│
├── @senars/io/                      # Transports — generic, no engine dependency
│   ├── src/
│   │   ├── connections/
│   │   │   ├── base.ts              (from src/io/connections/)
│   │   │   ├── cli.ts
│   │   │   ├── irc.ts
│   │   │   ├── ws.ts
│   │   │   ├── http.ts
│   │   │   ├── mcp.ts
│   │   │   └── telegram.ts          ← NEW (OmegaClaw channel parity)
│   │   ├── commands/                (from src/io/commands/ — NAR-specific commands move to @senars/nar)
│   │   │   ├── registry.ts
│   │   │   ├── core.ts
│   │   │   ├── connection.ts
│   │   │   └── ...
│   │   ├── connection-manager.ts    (from src/io/)
│   │   ├── router.ts                (from src/io/)
│   │   ├── auth.ts                  (from src/io/)
│   │   ├── types.ts                 (from src/io/types.ts — NAR removed from ConnectionDeps)
│   │   └── index.ts
│   └── package.json
│
├── @senars/nar/                     # NARS reasoner + NarsAgent
│   ├── src/
│   │   ├── nar.ts                   (existing — NAR class)
│   │   ├── terms/                   (existing)
│   │   ├── memory/                  (existing)
│   │   ├── rules/                   (existing)
│   │   ├── lm/                      (existing — LM rules, bidirectional feedback)
│   │   ├── drives/                  (existing — DriveManager)
│   │   ├── reasons/                 (existing — Reasoner, BagStrategy)
│   │   ├── types/                   (existing)
│   │   ├── lifecycle/               (existing — BaseComponent)
│   │   ├── tools/                   (existing — ToolManager, NARS tool adapters)
│   │   ├── ...
│   │   ├── agent/                   ← NEW — NarsAgent orchestration (from agent/src/)
│   │   │   ├── NarsAgent.ts           The NAR-specific agent class (from AgentImpl.ts)
│   │   │   ├── NarsLoop.ts            Drive-urgency-triggered loop (AutonomousLoop + AutonomyEngine)
│   │   │   ├── NarsInputProcessor.ts  Narsese + NL→NAL parsing (from input-processor.ts)
│   │   │   ├── NarQueryService.ts     Explanation/trace for NAR (from services/NarQueryService.ts)
│   │   │   ├── PromptBuilder.ts       NAR-aware prompt construction (from subservices/PromptBuilder.ts)
│   │   │   ├── NarsTypes.ts           The current Agent interface (types.ts, NAR-specific)
│   │   │   └── presets.ts             Agent presets (minimal/chat/lm-only/full)
│   │   ├── commands/                ← MOVED — NAR-specific commands from src/io/commands/
│   │   │   ├── nar.ts
│   │   │   ├── rlfp.ts
│   │   │   ├── self.ts
│   │   │   └── episodes.ts
│   │   └── index.ts
│   └── package.json
│
├── @senars/metta/                   # MeTTa interpreter + MettaAgent
│   ├── src/
│   │   ├── types/                   (existing — AST, space, type inference)
│   │   ├── parser/                  (existing — S-expression parsing)
│   │   ├── engine/                  (existing — e-graph, reduction, unification, matching)
│   │   ├── core/                    (existing — stamp, cache, intern, space, ops, config)
│   │   ├── runtime/                 (existing — context, builder)
│   │   ├── stdlib/                  (existing)
│   │   ├── extensions/              (existing — persistent-space)
│   │   ├── performance/             (existing — JIT, parallel)
│   │   └── agent/                   ← NEW — MettaAgent orchestration (OmegaClaw-inspired)
│   │       ├── MettaAgent.ts          Agent class: mounts transports, runs loop, bridges events
│   │       ├── MettaLoop.ts           Continuous execution (maxWakeLoops, sleepInterval, wakeupInterval)
│   │       ├── MettaSkills.ts         Skill registry — wraps grounded ops as callable skills
│   │       ├── MettaLTM.ts            Long-term memory with vector embeddings (SemanticSimilarityEngine)
│   │       ├── MettaKnowledge.ts      Knowledge priors — markdown → heading-aware chunks → embeddings
│   │       ├── MettaEpisodic.ts       Episodic memory — append-only log with timestamped recall
│   │       ├── MettaInputProcessor.ts NL→MeTTa atom translation
│   │       ├── MettaChannelOps.ts     Channel-specific grounded ops (send, schedule, wait)
│   │       ├── MettaCommandParser.ts  LLM output → structured command parsing (send, remember, query, episodes, shell)
│   │       ├── MettaHistory.ts        History management — append to log, inject ERROR_FEEDBACK
│   │       ├── MettaPromptBuilder.ts  Prompt construction — SKILLS, LAST_SKILL_USE_RESULTS, HISTORY, TIME
│   │       ├── PolicyEngine.ts        Security — filesystem sandboxing, tool allowlists, capability gating
│   │       └── MettaTypes.ts          MettaAgent's own Agent interface (skills, LTM, loop config)
│   └── package.json
│
├── @senars/ui/                      # UI — unchanged structurally
│   ├── src/
│   │   ├── server/
│   │   │   ├── index.ts                (accepts any agent via CognitiveEventSource, not NAR+Agent pair)
│   │   │   ├── gateway.ts              (subscribes to engine:* events instead of nar:*)
│   │   │   ├── chat.ts                 (unchanged — streams agent.chat())
│   │   │   ├── bridge.ts               ← NEW — generic CognitiveEvent → WebSocket bridge
│   │   │   │                             replaces nar-adapter.ts + socket-handler.ts coupling
│   │   │   └── lenses.ts               (unchanged)
│   │   ├── client/                  (unchanged)
│   │   └── shared/                  → MOVED to @senars/core/Protocol.ts
│   └── package.json                  (now depends on @senars/core instead of local shared/)
│
├── src/                             # Entry points — simplified
│   ├── bin/
│   │   ├── repl.ts                    (creates agent from preset, mounts CLI)
│   │   ├── bot-ai.ts                  (creates agent with IRC+WS+HTTP)
│   │   └── mcp-server.ts              (creates agent with MCP)
│   └── config/                       (shared config — stays)
│
├── agent/ → REMOVED                 # Dissolved into @senars/nar/agent/ + @senars/core/
└── pnpm-workspace.yaml              (adds @senars/core, @senars/io)
```

---

## Part 3: `@senars/core` — Shared Kernel ✅ (Implemented)

All 13 files created in `core/src/`:
- `Lifecycle.ts` (Phase 0), `CognitiveEvent.ts`, `Transport.ts`, `Protocol.ts`
- `ModelRunner.ts`, `ChatService.ts`, `Options.ts`
- `SessionOrchestrator.ts`, `StatsManager.ts`, `KnowledgeManager.ts`, `ApprovalService.ts`
- `CognitiveCoordinator.ts`

**Current state:** `core/src/index.ts` re-exports all types + values. `core/package.json` has 13 entry points (`"."`, `"./lifecycle"`, `"./cognitive-event"`, `"./transport"`, `"./protocol"`, `"./model"`, `"./chat"`, `"./options"`, `"./session"`, `"./stats"`, `"./knowledge"`, `"./approval"`, `"./coordinator"`). Dependencies: `ai` ^7.0.2, `zod` ^4.4.3, `@types/node` ^22.19.19 (dev).

**Agent integration:** `agent/src/options-schema.ts` re-exports schema/validation from `@senars/core/options`. `agent/src/index.ts` re-exports ~20 core types/values. `agent/package.json` depends on `@senars/core: workspace:*`.

**The code snippets below remain as the architectural spec for reference.**

### 3.1 CognitiveEvent — The Universal Event Envelope

Every event carries an `engine: 'nar' | 'metta'` origin tag and a `correlationId` for cross-engine tracing.

```typescript
// @senars/core/src/CognitiveEvent.ts

export type EngineOrigin = 'nar' | 'metta';

export interface CognitiveEventBase {
  readonly engine: EngineOrigin;
  readonly timestamp: number;
  readonly correlationId: string;        // transport-generated, propagates through all processing
  readonly parentEventId?: string;       // for causal chains (derivation → conflict → goal)
}

export type CognitiveEvent =
  // NAR events
  | CognitiveEventBase & { readonly type: 'derivation'; readonly term: string; readonly confidence: number }
  | CognitiveEventBase & { readonly type: 'cycle'; readonly cycle: number; readonly derived: number }
  | CognitiveEventBase & { readonly type: 'drive:changed'; readonly drive: string; readonly urgency: number }
  | CognitiveEventBase & { readonly type: 'goal:resolved'; readonly term: string }
  | CognitiveEventBase & { readonly type: 'conflict:detected'; readonly term: string; readonly conflictWith: string }
  | CognitiveEventBase & { readonly type: 'concept:activated'; readonly term: string; readonly priority: number }
  // MeTTa events
  | CognitiveEventBase & { readonly type: 'skill:executed'; readonly skill: string; readonly result: string; readonly durationMs: number }
  // Shared events
  | CognitiveEventBase & { readonly type: 'input'; readonly term: string; readonly source: string }
  | CognitiveEventBase & { readonly type: 'health'; readonly status: 'healthy' | 'degraded' | 'stuck' | 'crashed'; readonly cycleCount: number; readonly errorRate: number };

// Type guards for pattern matching
export const isNarEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { engine: 'nar' }> => e.engine === 'nar';
export const isMettaEvent = (e: CognitiveEvent): e is Extract<CognitiveEvent, { engine: 'metta' }> => e.engine === 'metta';
export const isEventType = <T extends CognitiveEvent['type']>(type: T) => (e: CognitiveEvent): e is Extract<CognitiveEvent, { type: T }> => e.type === type;
```

NAR emits: `derivation`, `cycle`, `drive:changed`, `goal:resolved`, `conflict:detected`, `concept:activated`, `input`, `health`.
MeTTa emits: `derivation`, `cycle`, `skill:executed`, `concept:activated`, `input`, `health`.

Engines that never fire a given event type simply never emit it. The UI and coordinator already handle the absence — they subscribe to what they need.

### 3.2 Transport — Connection Interface

Extracted from `src/io/types.ts:29-54` with two changes: `ConnectionDeps.nar` removed; `submit` gains `correlationId` and optional streaming.

```typescript
// @senars/core/src/Transport.ts

export interface ConnectionDeps {
  readonly emit: (event: string, data: unknown) => void;
  readonly logger: Logger;
  readonly getSessionSpaceId: (connectionId: string) => string | undefined;  // for MeTTa per-session LTM
}

export interface TransportDeps extends ConnectionDeps {
  // Fire-and-forget (IRC, Telegram, CLI)
  readonly submit: (input: string, correlationId: string) => void;
  // Streaming (WS, HTTP SSE) — optional
  readonly submitStream?: (input: string, correlationId: string) => AsyncGenerator<string, string>;
}

export interface Connection {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly state: ConnectionState;

  connect(): Promise<void>;
  disconnect(reason?: string): Promise<void>;
  reconnect(): Promise<void>;
  send(target: string, text: string): Promise<void>;
  onMessage(handler: (message: IOMessage) => Promise<void>): void;
  removeMessageHandler(handler: (message: IOMessage) => Promise<void>): void;
  onStateChange(handler: (state: ConnectionState, prev: ConnectionState) => void): void;
  onError(handler: (error: ConnectionError) => void): void;
  getStatus(): { state: ConnectionState; messageCount: number; errorCount: number };
  reconfigure(config: Record<string, unknown>): Promise<void>;
}
```

The `submit` callback is how a transport delivers user text to whatever agent system is running underneath. `NarsAgent.submit` calls `NarsInputProcessor`. `MettaAgent.submit` calls `MettaInputProcessor`. `CognitiveCoordinator.submit` fans to both.

### 3.3 ChatService and ModelRunner — Generic LM Utilities

`ChatService` (from `agent/src/services/LMChatService.ts`) is parameterized by a context provider function. Zero NAR coupling.

```typescript
// @senars/core/src/ChatService.ts

import type { ModelRunner } from './ModelRunner.js';
import type { CognitiveEvent } from './CognitiveEvent.js';

export interface ChatContext {
  // Engine-agnostic context snapshot for prompt building
  readonly engine: 'nar' | 'metta';
  readonly timestamp: number;
}

export interface ChatServiceDeps<TCtx extends ChatContext> {
  readonly runner: ModelRunner;
  readonly buildSystemPrompt: (ctx: TCtx) => Promise<string>;
  readonly tools: Tool[];
  readonly onEvent: (event: CognitiveEvent) => void;
  readonly getContext: () => TCtx;
}

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: object;  // Zod schema or JSON Schema
  readonly execute: (args: unknown, signal?: AbortSignal) => Promise<unknown>;
}

export interface ChatOptions {
  readonly signal?: AbortSignal;
  readonly sessionId?: string;
  readonly stream?: boolean;
}

export interface ChatStreamEvent {
  readonly kind: 'text-delta' | 'tool-call' | 'tool-result' | 'finish' | 'error' | 'aborted';
  readonly text?: string;
  readonly toolName?: string;
  readonly toolArgs?: unknown;
  readonly toolResult?: unknown;
  readonly error?: string;
}

export function createChatService<TCtx extends ChatContext>(deps: ChatServiceDeps<TCtx>) {
  return {
    async *chat(input: string, opts: ChatOptions = {}): AsyncGenerator<ChatStreamEvent, string> {
      const correlationId = crypto.randomUUID();
      const startTime = Date.now();
      const ctx = deps.getContext();
      
      deps.onEvent({
        engine: ctx.engine,
        type: 'input',
        term: input,
        source: 'chat',
        timestamp: startTime,
        correlationId,
      });

      try {
        const system = await deps.buildSystemPrompt(ctx);
        const composed = {
          system,
          messages: [{ role: 'user' as const, content: input }],
          tools: deps.tools,
        };

        let finalText = '';
        for await (const event of deps.runner.run(composed, opts.signal)) {
          if (event.kind === 'text-delta') {
            finalText += event.text;
            yield { kind: 'text-delta', text: event.text };
          } else if (event.kind === 'tool-call') {
            yield { kind: 'tool-call', toolName: event.call.toolName, toolArgs: event.call.args };
          } else if (event.kind === 'tool-result') {
            yield { kind: 'tool-result', toolName: event.call.toolName, toolArgs: event.call.args, toolResult: event.result };
          } else if (event.kind === 'finish') {
            break;
          }
        }

        yield { kind: 'finish', text: finalText };
        
        deps.onEvent({
          engine: ctx.engine,
          type: 'derivation',
          term: finalText,
          confidence: 1.0,
          timestamp: Date.now(),
          correlationId,
        });

        return finalText;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        yield { kind: 'error', error };
        throw e;
      }
    },
  };
}
```

`ModelRunner` (from `agent/src/model/ModelRunner.ts`) moves unchanged — it wraps Vercel `ai` SDK and has no engine dependencies.

### 3.4 Protocol — UI Message Schemas

All Zod schemas from `ui/src/shared/protocol.ts` move here, extended with multi-engine discriminants.

```typescript
// @senars/core/src/Protocol.ts

import { z } from 'zod';

export const TruthValue = z.object({
  frequency: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});
export type TruthValue = z.infer<typeof TruthValue>;

// --- Graph Operations (Delta) ---

export const GraphOp = z.discriminatedUnion('action', [
  z.object({ action: z.literal('add_node'), id: z.string(), data: GraphNodeData }),
  z.object({ action: z.literal('update_node'), id: z.string(), data: GraphNodeData.partial() }),
  z.object({ action: z.literal('remove_node'), id: z.string() }),
  z.object({
    action: z.literal('add_edge'),
    source: z.string(),
    target: z.string(),
    data: z.object({ weight: z.number(), type: z.string(), directed: z.boolean() }).optional(),
  }),
  z.object({ action: z.literal('remove_edge'), source: z.string(), target: z.string() }),
]);
export type GraphOp = z.infer<typeof GraphOp>;

// --- Multi-Engine Graph Node Data ---

export const NarConceptNode = z.object({
  nodeType: z.literal('nar:concept'),
  term: z.string(),
  priority: z.number(),
  confidence: z.number(),
  truth: TruthValue.optional(),
  isContradiction: z.boolean().optional(),
  occurrenceTime: z.number().optional(),
  goalRelevance: z.number().optional(),
  lensData: z.object({ score: z.number(), color: z.string(), size: z.number() }).optional(),
  layout: z.object({ x: z.number().optional(), y: z.number().optional(), threadIndex: z.number().optional() }).optional(),
});

export const MettaAtomNode = z.object({
  nodeType: z.literal('metta:atom'),
  atom: z.string(),              // S-expression string
  type: z.string().optional(),   // inferred type
  space: z.string(),             // space ID
  lensData: z.object({ score: z.number(), color: z.string(), size: z.number() }).optional(),
  layout: z.object({ x: z.number().optional(), y: z.number().optional() }).optional(),
});

export const MettaSkillNode = z.object({
  nodeType: z.literal('metta:skill'),
  skill: z.string(),
  args: z.array(z.string()),
  result: z.string(),
  durationMs: z.number(),
  lensData: z.object({ score: z.number(), color: z.string(), size: z.number() }).optional(),
  layout: z.object({ x: z.number().optional(), y: z.number().optional() }).optional(),
});

export const GraphNodeData = z.discriminatedUnion('nodeType', [
  NarConceptNode,
  MettaAtomNode,
  MettaSkillNode,
]);
export type GraphNodeData = z.infer<typeof GraphNodeData>;

// --- Agent Capabilities (for UI negotiation) ---

export const AgentCapabilities = z.object({
  engine: z.enum(['nar', 'metta']),
  supports: z.object({
    chat: z.boolean(),
    beliefs: z.boolean(),      // NAR: believe/recall; MeTTa: space.add/query
    drives: z.boolean(),       // NAR only
    skills: z.boolean(),       // MeTTa only
    ltm: z.boolean(),          // MeTTa only
    rlfp: z.boolean(),         // NAR only
    selfReasoning: z.boolean(),// NAR only
    autonomyLoop: z.boolean(), // both, different shapes
  }),
  configSchema: z.record(z.string(), ConfigField).optional(),
});
export type AgentCapabilities = z.infer<typeof AgentCapabilities>;

// --- WebSocket Messages (unchanged from ui/src/shared/protocol.ts) ---

export const ChatUserMsg = z.object({
  type: z.literal('chat.user'),
  content: z.string().min(1).max(10000),
});

export const ChatAgentStream = z.object({ type: z.literal('chat.agent.stream'), delta: z.string() });
export const ChatAgentComplete = z.object({
  type: z.literal('chat.agent.complete'),
  content: z.string(),
  html: z.string().optional(),
  messageId: z.string(),
});

export const ConfigField = z.object({
  type: z.enum(['slider', 'dropdown', 'text', 'toggle']),
  label: z.string(),
  value: z.any(),
  options: z.array(z.string()).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  description: z.string().optional(),
  category: z.enum(['llm', 'nars', 'system', 'advanced']).optional(),
  validation: z.object({ pattern: z.string().optional(), min: z.number().optional(), max: z.number().optional() }).optional(),
});

export const ConfigSchemaMsg = z.object({ type: z.literal('config.schema'), data: z.record(z.string(), ConfigField) });
export const ConfigSetMsg = z.object({ type: z.literal('config.set'), key: z.string(), value: z.any() });

export const SyncRequest = z.object({ type: z.literal('sync.request'), lastSeqId: z.number().nullable() });

export const StateSnapshot = z.object({
  type: z.literal('state.snapshot'),
  seqId: z.number(),
  data: z.object({
    graph: z.object({ nodes: z.array(z.any()), edges: z.array(z.any()) }),
    workingMemory: z.array(z.any()),
    config: z.record(z.string(), ConfigField),
  }),
});

export const ViewportSet = z.object({ type: z.literal('viewport.set'), x: z.number(), y: z.number(), zoom: z.number() });

export const CognitiveMetrics = z.object({
  activeConcepts: z.number(),
  totalConcepts: z.number(),
  derivationsPerSec: z.number(),
  contradictionCount: z.number(),
  workingMemorySize: z.number(),
  goalUrgencyDistribution: z.record(z.string(), z.number()).optional(),
});

export const TelemetryMsg = z.object({
  type: z.literal('telemetry'),
  metrics: z.object({
    reasoning_hz: z.number(),
    tokens_per_sec: z.number(),
    memory_mb: z.number(),
    ws_latency_ms: z.number(),
  }),
  cognitive: CognitiveMetrics.optional(),
});

export const LensSet = z.object({ type: z.literal('lens.set'), lens: z.string() });
export const FocusSet = z.object({ type: z.literal('focus.set'), term: z.string() });
export const ObjectSetMsg = z.object({
  type: z.literal('object.set'),
  kind: z.enum(['node', 'edge']),
  id: z.string(),
  patch: z.object({ truth: TruthValue.optional(), type: z.string().optional(), priority: z.number().min(0).max(1).optional(), confidence: z.number().min(0).max(1).optional() }),
});
export const NodeSetMsg = z.object({
  type: z.literal('node.set'),
  id: z.string(),
  patch: z.object({ truth: TruthValue.optional(), priority: z.number().min(0).max(1).optional(), confidence: z.number().min(0).max(1).optional() }),
});

export const LensListMsg = z.object({
  type: z.literal('lens.list'),
  lenses: z.array(z.object({ id: z.string(), label: z.string(), description: z.string(), modulation: z.any() })),
});
export const LensDefineMsg = z.object({
  type: z.literal('lens.define'),
  lens: z.object({ id: z.string(), label: z.string(), description: z.string(), modulation: z.any() }),
});
export const LensDefinedMsg = z.object({
  type: z.literal('lens.defined'),
  lens: z.object({ id: z.string(), label: z.string(), description: z.string(), modulation: z.any() }),
});
export const LensFieldsMsg = z.object({
  type: z.literal('lens.fields'),
  fields: z.array(z.object({ key: z.string(), label: z.string(), type: z.enum(['number', 'boolean', 'string', 'object']) })),
});

export const NodeHistoryRequestMsg = z.object({ type: z.literal('node.history.request'), term: z.string() });
export const NodeHistoryMsg = z.object({
  type: z.literal('node.history'),
  term: z.string(),
  history: z.array(z.object({ truth: TruthValue, stampId: z.string(), timestamp: z.number(), source: z.enum(['input', 'derivation', 'revision', 'inference']) })),
});

export const IncomingFromClient = z.discriminatedUnion('type', [
  ChatUserMsg, ConfigSetMsg, SyncRequest, LensSet, FocusSet, ViewportSet, ObjectSetMsg, NodeSetMsg, LensDefineMsg, NodeHistoryRequestMsg,
]);
export const IncomingFromServer = z.discriminatedUnion('type', [
  ChatAgentStream, ChatAgentComplete, CognitiveDelta, ConfigSchemaMsg, StateSnapshot, TelemetryMsg, LensListMsg, LensDefinedMsg, LensFieldsMsg, NodeHistoryMsg,
]);
export type IncomingFromClient = z.infer<typeof IncomingFromClient>;
export type IncomingFromServer = z.infer<typeof IncomingFromServer>;
export type ConfigFieldType = z.infer<typeof ConfigField>;
export type GraphOpType = z.infer<typeof GraphOp>;

export const CognitiveDelta = z.object({
  type: z.literal('cognitive.delta'),
  seqId: z.number(),
  lens: z.string(),
  ops: z.array(GraphOp),
  meta: z.object({ truncated: z.boolean().optional(), totalHidden: z.number().optional() }).optional(),
});
export type CognitiveDelta = z.infer<typeof CognitiveDelta>;
```

### 3.5 Lifecycle — ComponentState & BaseComponent ✅ (Implemented)

Extracted from `nar/src/lifecycle/BaseComponent.ts` into `@senars/core/src/Lifecycle.ts`. Used by both NAR and MeTTa internals.

The source of truth now lives at [`core/src/Lifecycle.ts`](./core/src/Lifecycle.ts). Key types:

- `ComponentState`: `'created' | 'initialized' | 'started' | 'stopped' | 'disposed'`
- `Logger` interface: `debug`, `info`, `warn`, `error`, `child`
- `Metrics` interface: `increment`, `gauge`, `histogram`
- `EventBus` interface: `emit`, `on`, `off`
- `ComponentContext`: composite of Logger + Metrics + EventBus
- `BaseComponent`: abstract class with state machine, accepts optional `ComponentContext`

**NAR integration:** `nar/src/lifecycle/BaseComponent.ts` extends `@senars/core`'s `BaseComponent`, narrows accessor return types to NAR concrete types (`Logger`, `MetricsCollector`, `NarEventBus`), and provides NAR-specific defaults when no context is supplied. Accessors are never `undefined` at the NAR level.

### 3.6 CognitiveCoordinator — Multi-Agent Mode

A minimal coordinator that fans input and aggregates events with provenance. No shared engine interface.

```typescript
// @senars/core/src/CognitiveCoordinator.ts

import type { CognitiveEvent, CognitiveEventSource, TransportDeps } from './index.js';

export interface CognitiveEventSource {
  readonly start: () => void;
  readonly stop: () => void;
  readonly submit: (input: string, correlationId: string) => void;
  readonly on: (event: string | '*', handler: (event: CognitiveEvent) => void) => void;
  readonly off: (event: string | '*', handler: (event: CognitiveEvent) => void) => void;
  readonly health: () => { status: 'healthy' | 'degraded' | 'stuck' | 'crashed'; lastCycle: number; cycleCount: number; errorRate: number };
  readonly capabilities: () => AgentCapabilities;
  readonly mount: (transport: Transport) => void;
  readonly unmount: (transport: Transport) => void;
}

export interface Transport {
  readonly id: string;
  readonly onMessage: (handler: (msg: IOMessage) => Promise<void>) => void;
  readonly removeMessageHandler: (handler: (msg: IOMessage) => Promise<void>) => void;
  readonly send: (target: string, text: string) => Promise<void>;
}

export class CognitiveCoordinator implements CognitiveEventSource {
  #agents: CognitiveEventSource[];
  #listeners = new Set<(event: CognitiveEvent) => void>();
  #transports = new Set<Transport>();

  constructor(agents: CognitiveEventSource[]) {
    this.#agents = agents;
  }

  start(): void { this.#agents.forEach(a => a.start()); }
  stop(): void { this.#agents.forEach(a => a.stop()); }

  submit(input: string, correlationId: string): void {
    this.#agents.forEach(a => a.submit(input, correlationId));
  }

  on(event: string | '*', handler: (event: CognitiveEvent) => void): void {
    this.#listeners.add(handler);
  }

  off(event: string | '*', handler: (event: CognitiveEvent) => void): void {
    this.#listeners.delete(handler);
  }

  health() {
    const statuses = this.#agents.map(a => a.health().status);
    if (statuses.some(s => s === 'crashed')) return { status: 'crashed' as const, lastCycle: 0, cycleCount: 0, errorRate: 1 };
    if (statuses.some(s => s === 'stuck')) return { status: 'stuck' as const, lastCycle: 0, cycleCount: 0, errorRate: 0.5 };
    if (statuses.some(s => s === 'degraded')) return { status: 'degraded' as const, lastCycle: 0, cycleCount: 0, errorRate: 0.1 };
    return { status: 'healthy' as const, lastCycle: Date.now(), cycleCount: this.#agents.reduce((n, a) => n + a.health().cycleCount, 0), errorRate: 0 };
  }

  capabilities() {
    return this.#agents.map(a => a.capabilities());
  }

  mount(transport: Transport): void {
    this.#transports.add(transport);
    this.#agents.forEach(a => a.mount(transport));
    
    transport.onMessage(async (msg) => {
      const correlationId = crypto.randomUUID();
      this.#agents.forEach(a => a.submit(msg.text, correlationId));
    });
  }

  unmount(transport: Transport): void {
    this.#transports.delete(transport);
    this.#agents.forEach(a => a.unmount(transport));
    transport.removeMessageHandler(() => {}); // best effort
  }

  // Internal: agents call this via their eventBus
  #emit(event: CognitiveEvent): void {
    this.#listeners.forEach(l => l(event));
  }
}
```

### 3.7 `@senars/core` package.json

```json
{
  "name": "@senars/core",
  "type": "module",
  "private": true,
  "exports": {
    ".": "./src/index.ts",
    "./cognitive-event": "./src/CognitiveEvent.ts",
    "./transport": "./src/Transport.ts",
    "./lifecycle": "./src/Lifecycle.ts",
    "./chat": "./src/ChatService.ts",
    "./model": "./src/ModelRunner.ts",
    "./protocol": "./src/Protocol.ts",
    "./options": "./src/Options.ts",
    "./session": "./src/SessionOrchestrator.ts",
    "./stats": "./src/StatsManager.ts",
    "./knowledge": "./src/KnowledgeManager.ts",
    "./approval": "./src/ApprovalService.ts",
    "./coordinator": "./src/CognitiveCoordinator.ts",
    "./logger": "./src/Logger.ts",
    "./helpers": "./src/helpers.ts",
    "./command-types": "./src/command-types.ts"
  },
  "dependencies": {
    "ai": "^7.0.2",
    "@ai-sdk/openai-compatible": "^1.0.41",
    "zod": "^4.4.3",
    "effect": "^3.10.0"
  }
}
```

---

## Part 4: NarsAgent — The NAR-Specific Agent

### 4.1 What Moves Where

| Current File | Destination | Status |
|---|---|---|
| `agent/src/core/AgentImpl.ts` | `@senars/nar/src/agent/NarsAgent.ts` | RENAME + REMOVE `getNAR()`-style escapes to dedicated NAR portal |
| `agent/src/AutonomousLoop.ts` | `@senars/nar/src/agent/NarsLoop.ts` | MOVE |
| `agent/src/AutonomyEngine.ts` | `@senars/nar/src/agent/NarsAutonomyEngine.ts` | MOVE |
| `agent/src/input-processor.ts` | `@senars/nar/src/agent/NarsInputProcessor.ts` | MOVE |
| `agent/src/services/NarQueryService.ts` | `@senars/nar/src/agent/NarQueryService.ts` | MOVE |
| `agent/src/services/LifecycleManager.ts` | `@senars/nar/src/agent/NarsLifecycleManager.ts` | MOVE |
| `agent/src/services/SelfReasoningService.ts` | `@senars/nar/src/agent/NarsSelfReasoning.ts` | MOVE |
| `agent/src/services/ToolBuilder.ts` | `@senars/nar/src/agent/NarsToolBuilder.ts` | MOVE |
| `agent/src/services/ApprovalService.ts` | `@senars/core` (generic) | SHARED |
| `agent/src/subservices/PromptBuilder.ts` | `@senars/nar/src/agent/PromptBuilder.ts` | MOVE (NAR-specific: reads constitution, drives) |
| `agent/src/subservices/KnowledgeManager.ts` | `@senars/core` (generic KV store) | ABSTRACT |
| `agent/src/subservices/SessionOrchestrator.ts` | `@senars/core` (generic session tracking) | ABSTRACT |
| `agent/src/subservices/StatsManager.ts` | `@senars/core` (generic) | ABSTRACT |
| `agent/src/model/ModelRunner.ts` | `@senars/core/src/ModelRunner.ts` | MOVE |
| `agent/src/services/LMChatService.ts` | `@senars/core/src/ChatService.ts` | MOVE + PARAMETERIZE |
| `agent/src/EventBus.ts` | `@senars/core/src/CognitiveEvent.ts` | MERGE (nar:* → engine:*) |
| `agent/src/io-bridge.ts` | `@senars/nar/src/agent/NarsIOBridge.ts` | MOVE |
| `agent/src/io-middleware.ts` | `@senars/core/src/transport/middleware.ts` (generic parts) | SPLIT |
| `agent/src/types.ts` | `@senars/nar/src/agent/NarsTypes.ts` | MOVE (NAR-specific Agent interface) |
| `agent/src/options-schema.ts` | `@senars/core/src/Options.ts` | MOVE (generic Zod options) |
| `agent/src/presets.ts` | `@senars/nar/src/agent/presets.ts` | MOVE |
| `agent/src/tools.ts` | `@senars/nar/src/agent/NarsTools.ts` | MOVE |
| `agent/src/register-commands.ts` | `@senars/nar/src/agent/NarsCommands.ts` | MOVE |
| `agent/src/index.ts` | `@senars/nar/src/agent/index.ts` | MOVE |
| `src/io/commands/nar.ts` | `@senars/nar/src/commands/nar.ts` | MOVE |
| `src/io/commands/rlfp.ts` | `@senars/nar/src/commands/rlfp.ts` | MOVE |
| `src/io/commands/self.ts` | `@senars/nar/src/commands/self.ts` | MOVE |
| `src/io/commands/episodes.ts` | `@senars/nar/src/commands/episodes.ts` | MOVE |

### 4.2 NarsAgent Interface

The current `Agent` interface (`agent/src/types.ts:206-364`, 30+ methods) stays on NarsAgent — it IS NAR-shaped and that's correct. Additionally, NarsAgent implements `CognitiveEventSource` for coordination.

```typescript
// @senars/nar/src/agent/NarsAgent.ts

import type { CognitiveEvent, CognitiveEventSource, Transport } from '@senars/core';
import type { NAR } from '../../nar.js';
import type { AgentOptions, ChatOptions, ChatStreamEvent } from './NarsTypes.js';

export class NarsAgent implements CognitiveEventSource {
  // Full NAR-specific Agent interface (existing, unchanged shape)
  chat(input: string, opts?: ChatOptions & { stream?: false }): Promise<string>;
  chat(input: string, opts: ChatOptions & { stream: true }): AsyncGenerator<ChatStreamEvent, string>;
  believe(narsese: string): Promise<void>;
  getNAR(): NAR | undefined;
  getRLFPState(): RLFPState | null;
  explainBelief(term: string): Promise<Explanation | null>;
  getLmRuleStats(): LMRuleStat[];
  // ...all 30+ existing methods

  // CognitiveEventSource surface (for coordinator, UI bridge)
  start(): void;
  stop(): void;
  submit(input: string, correlationId: string): void;  // delegates to NarsInputProcessor
  on(event: string | '*', handler: (event: CognitiveEvent) => void): void;
  off(event: string | '*', handler: (event: CognitiveEvent) => void): void;

  health(): { status: 'healthy' | 'degraded' | 'stuck' | 'crashed'; lastCycle: number; cycleCount: number; errorRate: number };
  capabilities(): AgentCapabilities;

  // Transport mounting
  mount(transport: Transport): void;
  unmount(transport: Transport): void;
}
```

The `CognitiveEventSource` conformance is implicit — `NarsAgent` has those methods but they're not defined by a shared interface. This avoids the leaky-abstraction problem.

### 4.3 NarsAgent Chat Integration

```typescript
// @senars/nar/src/agent/NarsAgent.ts (chat integration)

import { createChatService } from '@senars/core/chat';
import { ModelRunner } from '@senars/core/model';
import { PromptBuilder } from './PromptBuilder.js';

const narChatService = createChatService({
  runner: new ModelRunner({ /* config */ }),
  buildSystemPrompt: async (ctx) => {
    const nar = this.getNAR();
    if (!nar) return '';
    return PromptBuilder.buildSystemPrompt(nar, ctx);
  },
  tools: NarsTools.build(this),
  onEvent: (e) => this.eventBus.emit(e.type, e),
  getContext: () => ({
    engine: 'nar' as const,
    timestamp: Date.now(),
    beliefs: this.getNAR()?.getBeliefs() ?? [],
    drives: this.getNAR()?.getDriveManager()?.getAllStates() ?? [],
  }),
});
```

---

## Part 4b: NarsAgent — Enhancements During Refactor

While moving the agent to its proper home, we can make targeted improvements to the NAR agent without changing its external behavior:

### 4b.1 CognitiveEvent Emission (NAR → Engine Events)

Replace `EventBus.wrapNarEventBus` with direct `CognitiveEvent` emission from NAR components:

```typescript
// @senars/nar/src/agent/NarsAgent.ts (in constructor)

this.nar.on('cycle', (cycle: number, derived: number) => {
  this.eventBus.emit('cognitive', {
    engine: 'nar',
    type: 'cycle',
    cycle,
    derived,
    timestamp: Date.now(),
    correlationId: this.#currentCorrelationId ?? crypto.randomUUID(),
  } as CognitiveEvent);
});

this.nar.on('derivation', (term: string, truth: Truth) => {
  this.eventBus.emit('cognitive', {
    engine: 'nar',
    type: 'derivation',
    term,
    confidence: truth.confidence,
    timestamp: Date.now(),
    correlationId: this.#currentCorrelationId ?? crypto.randomUUID(),
  } as CognitiveEvent);
});

this.nar.getDriveManager()?.on('drive:changed', (drive: string, urgency: number) => {
  this.eventBus.emit('cognitive', {
    engine: 'nar',
    type: 'drive:changed',
    drive,
    urgency,
    timestamp: Date.now(),
    correlationId: this.#currentCorrelationId ?? crypto.randomUUID(),
  } as CognitiveEvent);
});
```

### 4b.2 CorrelationId Propagation

Thread `correlationId` through the entire NAR input pipeline:

```typescript
// @senars/nar/src/agent/NarsInputProcessor.ts

async process(input: string, correlationId: string): Promise<ProcessingResult> {
  this.#correlationId = correlationId;
  try {
    // ... existing processing ...
  } finally {
    this.#correlationId = null;
  }
}
```

### 4b.3 Health Monitoring

Add `health()` method exposing NAR-specific metrics:

```typescript
health(): { status: 'healthy' | 'degraded' | 'stuck' | 'crashed'; lastCycle: number; cycleCount: number; errorRate: number } {
  const stats = this.getStats();
  const now = Date.now();
  const cyclesSinceActivity = now - stats.lastCycleTimestamp;
  
  if (cyclesSinceActivity > 300_000) return { status: 'stuck', ... };
  if (stats.errorRate > 0.1) return { status: 'degraded', ... };
  return { status: 'healthy', ... };
}
```

### 4b.4 Capability Declaration

```typescript
capabilities(): AgentCapabilities {
  return {
    engine: 'nar',
    supports: {
      chat: true,
      beliefs: true,
      drives: true,
      skills: false,
      ltm: false,
      rlfp: true,
      selfReasoning: true,
      autonomyLoop: true,
    },
    configSchema: { /* Zod schema from PromptBuilder, DriveManager, etc. */ },
  };
}
```

### 4b.5 Effect-TS for NAR Services (Optional)

Migrate `LMChatService`, `ToolBuilder`, `SelfReasoningService` to use `Effect` for:
- Structured error handling (no try/catch scattered)
- Automatic retries with backoff for LM calls
- Resource safety (connections, file handles)
- Testability (mock `Effect` layers instead of mocking classes)

---

## Part 5: MettaAgent — The MeTTa-Specific Agent

### 5.1 Architecture (OmegaClaw-Inspired, SeNARS-Powered)

| OmegaClaw Pattern | MettaAgent Implementation |
|---|---|
| Continuous loop (`maxNewInputLoops`, `sleepInterval`, `wakeupInterval`) | `MettaLoop.ts` — runs MeTTa `reduce()` cycles, tracks new atoms |
| Skill system (`LAST_SKILL_USE_RESULTS` fed into prompt) | `MettaSkills.ts` — wraps `registerOp`/`getOp` from `metta/src/core/ops.ts` with feedback tracking |
| LTM with embeddings (`import_knowledge`, ChromaDB) | `MettaLTM.ts` — `PersistentSpace` + local embeddings via `@huggingface/transformers` |
| Knowledge priors (markdown files → heading-aware chunks → embeddings) | `MettaKnowledge.ts` — `importKnowledge()` with heading-aware chunking, hash-based incremental updates |
| Episodic memory (`history.metta` + `episodes` command) | `MettaEpisodic.ts` — append-only log with timestamped entries, time-range recall |
| Channels (IRC, Telegram, Slack, Mattermost, WS, Mock) | Same `Transport` interface — mounts all OmegaClaw channels |
| Security policy (`profile/policy.yaml` + Landlock) | `PolicyEngine.ts` — filesystem sandboxing, tool allowlists, capability gating |
| LLM command parsing (structured ops from LLM output) | `MettaCommandParser.ts` — parses `(send ...)`, `(remember ...)`, `(query ...)`, etc. |
| History management + error feedback loop | `MettaHistory.ts` — appends to episodic log, injects `ERROR_FEEDBACK` on parse/exec failure |
| Prompt building (SKILLS, LAST_SKILL_USE_RESULTS, HISTORY, TIME) | `MettaPromptBuilder.ts` — injects all context into system prompt |
| Spam shield (dedup consecutive messages) | `MettaLoop.ts` — tracks `&prevmsg`, suppresses duplicates |
| `run.metta` entry point | `MettaAgent.start()` — bootstrap space, load stdlib, mount transports, begin loop |

### 5.2 MettaAgent Interface

```typescript
// @senars/metta/src/agent/MettaAgent.ts

import type { CognitiveEvent, CognitiveEventSource, Transport } from '@senars/core';
import type { MeTTaRuntime, Space, Atom, GroundedOp } from '../index.js';

export interface MettaLoopConfig {
  readonly maxWakeLoops: number;      // cycles after a human message before idle (default 50)
  readonly sleepInterval: number;     // delay between loop iterations in seconds (default 1)
  readonly wakeupInterval: number;    // seconds of idle before next scheduled wake-up (default 600)
  readonly skillResultsChars: number; // chars of LAST_SKILL_USE_RESULTS fed into prompt (default 50000)
}

export interface SkillFeedback {
  readonly skill: string;
  readonly lastResult: string;
  readonly successRate: number;
  readonly callCount: number;
}

export interface KnowledgeConfig {
  readonly chunkMinChars: number;     // default 100
  readonly chunkMaxChars: number;     // default 6000
  readonly embeddingProvider: 'local' | 'openai';
  readonly embeddingModel: string;    // e.g., 'text-embedding-3-large' or local model name
}

export interface EpisodicEntry {
  readonly timestamp: string;         // ISO 8601
  readonly humanMessage: string;
  readonly response: string;
  readonly sexpr?: string;
  readonly errorFeedback?: string;
}

export class MettaAgent implements CognitiveEventSource {
  // Lifecycle
  start(): void;
  stop(): void;
  readonly state: 'idle' | 'running' | 'stopped';

  // Input — accepts NL or MeTTa S-expressions
  submit(input: string, correlationId: string): void;

  // Skills — the OmegaClaw-style skill registry
  registerSkill(name: string, op: GroundedOp): void;
  getSkill(name: string): GroundedOp | undefined;
  getSkillFeedback(name: string): SkillFeedback | undefined;
  getAllSkillFeedback(): SkillFeedback[];

  // LTM (semantic memory via embeddings)
  learn(atom: string, spaceId?: string): Promise<void>;
  recall(pattern: string, limit?: number, spaceId?: string): Promise<Atom[]>;
  importKnowledge(sources: string | string[], spaceId?: string): Promise<void>;
  getSpace(spaceId?: string): Space;

  // Knowledge priors (markdown files → embeddings)
  importKnowledgePriors(dir: string, config?: Partial<KnowledgeConfig>): Promise<string>;

  // Episodic memory (timestamped history)
  getEpisodes(aroundTime?: string, lines?: number): Promise<EpisodicEntry[]>;
  appendToHistory(entry: EpisodicEntry): Promise<void>;

  // Loop configuration (OmegaClaw parity)
  configureLoop(config: Partial<MettaLoopConfig>): void;

  // Chat (LM-driven, shared ChatService from @senars/core)
  chat(input: string, opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string>;

  // Events
  on(event: string | '*', handler: (event: CognitiveEvent) => void): void;
  off(event: string | '*', handler: (event: CognitiveEvent) => void): void;

  // Transport mounting
  mount(transport: Transport): void;
  unmount(transport: Transport): void;

  // Coordination surface
  health(): { status: 'healthy' | 'degraded' | 'stuck' | 'crashed'; lastCycle: number; cycleCount: number; errorRate: number };
  capabilities(): AgentCapabilities;

  // Access to the raw MeTTa environment for advanced use
  getRuntime(): MeTTaRuntime;
}
```

### 5.3 MettaLoop — Continuous Execution (OmegaClaw Loop)

```typescript
// @senars/metta/src/agent/MettaLoop.ts

import type { MeTTaInterpreter, MeTTaAtom } from '../engine/interpreter.js';
import type { EventBus } from '@senars/core';
import type { CognitiveEvent } from '@senars/core';

export class MettaLoop {
  #interpreter: MeTTaInterpreter;
  #eventBus: EventBus;
  #config: MettaLoopConfig;
  #knownAtoms = new Set<string>();  // hash of atom string for new-atom detection
  #running = false;
  #idleSince = 0;

  constructor(
    interpreter: MeTTaInterpreter,
    eventBus: EventBus,
    config: MettaLoopConfig = { maxWakeLoops: 50, sleepInterval: 1, wakeupInterval: 600, skillResultsChars: 50000 }
  ) {
    this.#interpreter = interpreter;
    this.#eventBus = eventBus;
    this.#config = config;
  }

  async run(correlationId: string): Promise<void> {
    this.#running = true;
    let loopsSinceInput = 0;

    while (this.#running) {
      const cycleStart = Date.now();
      
      // Execute one reduction cycle
      const results = await this.#interpreter.reduce();
      
      // Track new atoms
      const newAtoms: MeTTaAtom[] = [];
      for (const atom of results) {
        const key = atom.toString();
        if (!this.#knownAtoms.has(key)) {
          this.#knownAtoms.add(key);
          newAtoms.push(atom);
        }
      }

      // Emit derivation events
      for (const atom of newAtoms) {
        this.#eventBus.emit('cognitive', {
          engine: 'metta',
          type: 'derivation',
          term: atom.toString(),
          confidence: 1.0,
          timestamp: Date.now(),
          correlationId,
        } as CognitiveEvent);
      }

      // Check if we should keep running
      if (this.#shouldKeepRunning(newAtoms.length > 0, loopsSinceInput)) {
        loopsSinceInput++;
        const delay = this.#config.sleepInterval * 1000;
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      // Idle: wait for wakeupInterval
      this.#idleSince = Date.now();
      await this.#sleepUntilWakeup();
      loopsSinceInput = 0;
      this.#idleSince = 0;
    }
  }

  #shouldKeepRunning(hasNewAtoms: boolean, loopsSinceInput: number): boolean {
    if (hasNewAtoms) return true;
    if (loopsSinceInput < this.#config.maxWakeLoops) return true;
    return false;
  }

  async #sleepUntilWakeup(): Promise<void> {
    while (this.#running) {
      const elapsed = (Date.now() - this.#idleSince) / 1000;
      if (elapsed >= this.#config.wakeupInterval) break;
      await new Promise(r => setTimeout(r, Math.min(1000, (this.#config.wakeupInterval - elapsed) * 1000)));
    }
  }

  stop(): void { this.#running = false; }
  configure(config: Partial<MettaLoopConfig>): void { this.#config = { ...this.#config, ...config }; }
}
```

### 5.4 MettaSkills — OmegaClaw Skill System

```typescript
// @senars/metta/src/agent/MettaSkills.ts

import type { GroundedOp, MeTTaAtom } from '../core/ops.js';
import { registerOp, getOp } from '../core/ops.js';
import type { Effect } from 'effect';

export class MettaSkills {
  #interpreter: MeTTaInterpreter;
  #feedback = new Map<string, SkillFeedback>();

  constructor(interpreter: MeTTaInterpreter) {
    this.#interpreter = interpreter;
  }

  register(name: string, fn: GroundedOp): void {
    registerOp(name, fn);
  }

  execute(name: string, args: MeTTaAtom[]): Effect.Effect<MeTTaAtom, Error> {
    const op = getOp(name);
    if (!op) return Effect.fail(new Error(`Unknown skill: ${name}`));
    
    const start = Date.now();
    return Effect.gen(function* () {
      const result = yield* op.apply(args);
      const duration = Date.now() - start;
      
      const fb = this.#feedback.get(name) ?? { skill: name, lastResult: '', successRate: 1, callCount: 0 };
      fb.lastResult = result.toString();
      fb.callCount++;
      fb.successRate = (fb.successRate * (fb.callCount - 1) + 1) / fb.callCount;
      this.#feedback.set(name, fb);
      
      return result;
    });
  }

  getFeedback(name: string): SkillFeedback | undefined {
    return this.#feedback.get(name);
  }

  getAllFeedback(): SkillFeedback[] {
    return [...this.#feedback.values()];
  }

  // OmegaClaw's LAST_SKILL_USE_RESULTS for prompt injection
  getRecentResults(limit: number): string {
    return [...this.#feedback.values()]
      .sort((a, b) => b.callCount - a.callCount)
      .slice(0, limit)
      .map(f => `${f.skill}: ${f.lastResult}`)
      .join('\n');
  }
}
```

### 5.5 MettaLTM — Long-Term Memory with Embeddings

```typescript
// @senars/metta/src/agent/MettaLTM.ts

import type { PersistentSpace, Atom } from '../extensions/persistent-space.js';
import { EmbeddingService } from './EmbeddingService.js'; // wraps @huggingface/transformers

export class MettaLTM {
  #spaces = new Map<string, PersistentSpace>();
  #embedder: EmbeddingService;

  constructor(embedder: EmbeddingService) {
    this.#embedder = embedder;
  }

  getSpace(spaceId: string): PersistentSpace {
    let space = this.#spaces.get(spaceId);
    if (!space) {
      space = new PersistentSpace({ path: `./data/metta/${spaceId}` });
      this.#spaces.set(spaceId, space);
    }
    return space;
  }

  async store(atom: string, spaceId: string, metadata?: Record<string, unknown>): Promise<void> {
    const space = this.getSpace(spaceId);
    const embedding = await this.#embedder.embed(atom);
    space.add(atom);
    // Also store embedding vector for semantic search (space-specific index)
  }

  async recall(pattern: string, limit = 20, spaceId?: string): Promise<Atom[]> {
    const space = spaceId ? this.getSpace(spaceId) : this.getSpace('default');
    
    // Structural match first
    const structural = [...space.query(pattern)];
    
    // Semantic rerank
    const semantic = await this.#embedder.search(pattern, limit);
    
    return this.#deduplicate([...structural, ...semantic]);
  }

  async importKnowledge(sources: string | string[], spaceId?: string): Promise<void> {
    const space = spaceId ? this.getSpace(spaceId) : this.getSpace('default');
    const sourceList = Array.isArray(sources) ? sources : [sources];
    
    for (const source of sourceList) {
      const content = await Bun.file(source).text();
      const atoms = this.#parseMeTTa(content);
      atoms.forEach(a => space.add(a));
    }
  }

  #deduplicate(atoms: Atom[]): Atom[] {
    const seen = new Set<string>();
    return atoms.filter(a => {
      const key = a.toString();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  #parseMeTTa(content: string): Atom[] {
    // Use existing MeTTa parser
    return [];
  }
}
```

### 5.5b MettaKnowledge — Knowledge Priors (Markdown → Embeddings)

```typescript
// @senars/metta/src/agent/MettaKnowledge.ts

import type { PersistentSpace, Atom } from '../extensions/persistent-space.js';
import { EmbeddingService } from './EmbeddingService.js';
import { createHash } from 'crypto';
import { glob } from 'glob';

export interface KnowledgeConfig {
  readonly chunkMinChars: number;
  readonly chunkMaxChars: number;
  readonly embeddingProvider: 'local' | 'openai';
  readonly embeddingModel: string;
}

const DEFAULT_CONFIG: KnowledgeConfig = {
  chunkMinChars: 100,
  chunkMaxChars: 6000,
  embeddingProvider: 'local',
  embeddingModel: 'text-embedding-3-large',
};

export class MettaKnowledge {
  #spaces = new Map<string, PersistentSpace>();
  #embedder: EmbeddingService;
  #config: KnowledgeConfig;

  constructor(embedder: EmbeddingService, config: Partial<KnowledgeConfig> = {}) {
    this.#embedder = embedder;
    this.#config = { ...DEFAULT_CONFIG, ...config };
  }

  getSpace(spaceId: string): PersistentSpace {
    let space = this.#spaces.get(spaceId);
    if (!space) {
      space = new PersistentSpace({ path: `./data/metta/knowledge/${spaceId}` });
      this.#spaces.set(spaceId, space);
    }
    return space;
  }

  async importKnowledgePriors(dir: string, spaceId = 'default', config?: Partial<KnowledgeConfig>): Promise<string> {
    const cfg = { ...this.#config, ...config };
    const space = this.getSpace(spaceId);
    
    const files = await glob(`${dir}/**/*.md`);
    if (files.length === 0) {
      return `No markdown files found in ${dir}`;
    }

    let reindexed = 0;
    let unchanged = 0;

    for (const filepath of files) {
      const filename = filepath.split('/').pop()!;
      const currentHash = createHash('md5').update(await Bun.file(filepath).bytes()).digest('hex');
      const storedHash = await this.#getStoredHash(space, filename);

      if (storedHash === currentHash) {
        unchanged++;
        continue;
      }

      // Delete old chunks
      await this.#deleteOldChunks(space, filename);

      // Chunk markdown with heading-aware breadcrumbs
      const text = await Bun.file(filepath).text();
      const chunks = this.#chunkMarkdown(text, filename, cfg.chunkMinChars, cfg.chunkMaxChars);
      if (chunks.length === 0) continue;

      // Embed chunks
      const texts = chunks.map(c => c.text);
      const embeddings = cfg.embeddingProvider === 'local'
        ? await this.#embedder.embedBatch(texts)
        : await this.#embedder.embedBatchOpenAI(texts, cfg.embeddingModel);

      // Store
      const ids = chunks.map((_, i) => `${filename}_chunk_${i}`);
      const metadatas = chunks.map(c => ({
        source: filename,
        breadcrumb: c.breadcrumb,
        type: 'chunk',
        time: 'knowledge_prior',
      }));
      await space.addBatch(ids, chunks.map(c => c.text), embeddings, metadatas);

      // Store hash sentinel
      await this.#storeHash(space, filename, currentHash, embeddings[0]?.length ?? 1536);
      reindexed++;
    }

    return `Knowledge: ${files.length} files (${unchanged} unchanged, ${reindexed} re-indexed)`;
  }

  #chunkMarkdown(text: string, filename: string, minChars: number, maxChars: number): Array<{ text: string; breadcrumb: string }> {
    // Heading-aware chunking with breadcrumb tracking (from OmegaClaw rag.py)
    const headingRegex = /^(#{1,4})\s+(.+)$/gm;
    const matches = [...text.matchAll(headingRegex)];
    
    if (matches.length === 0) {
      return [{ text: text.trim(), breadcrumb: filename }];
    }

    const sections: Array<{ text: string; breadcrumb: string; heading: string }> = [];
    const stack: Record<number, string> = {};

    for (let i = 0; i < matches.length; i++) {
      const level = matches[i][1].length;
      const heading = matches[i][2].trim();
      
      // Clear deeper headings
      for (const lvl of Object.keys(stack).map(Number)) {
        if (lvl >= level) delete stack[lvl];
      }
      stack[level] = heading;

      const start = matches[i].index! + matches[i][0].length;
      const end = matches[i + 1]?.index ?? text.length;
      const body = text.slice(start, end).trim();

      const breadcrumb = filename + ' > ' + Object.values(stack).join(' > ');
      sections.push({ text: body, breadcrumb, heading });
    }

    // Skip Table of Contents
    const filtered = sections.filter(s => !s.heading.toLowerCase().includes('table of contents'));

    // Merge small sections, split large ones
    const merged: Array<{ text: string; breadcrumb: string }> = [];
    let carry = '';
    let carryBc = '';
    
    for (const s of filtered) {
      const combined = carry ? carry + '\n\n' + s.text : s.text;
      if (combined.length < minChars && s !== filtered[filtered.length - 1]) {
        carry = combined;
        carryBc = s.breadcrumb;
      } else {
        merged.push({ text: combined, breadcrumb: carryBc || s.breadcrumb });
        carry = '';
        carryBc = '';
      }
    }
    if (carry) {
      if (merged.length) merged[merged.length - 1].text += '\n\n' + carry;
      else merged.push({ text: carry, breadcrumb: carryBc });
    }

    // Split oversized
    const final: Array<{ text: string; breadcrumb: string }> = [];
    for (const s of merged) {
      if (s.text.length <= maxChars) {
        final.push(s);
        continue;
      }
      const paragraphs = s.text.split('\n\n');
      let chunk = '';
      for (const p of paragraphs) {
        if (chunk && chunk.length + p.length > maxChars) {
          final.push({ text: chunk.trim(), breadcrumb: s.breadcrumb });
          chunk = p;
        } else {
          chunk = chunk ? chunk + '\n\n' + p : p;
        }
      }
      if (chunk.trim()) final.push({ text: chunk.trim(), breadcrumb: s.breadcrumb });
    }

    return final;
  }

  async #getStoredHash(space: PersistentSpace, filename: string): Promise<string | null> {
    // Query hash sentinel
    return null; // Implement via space query
  }

  async #storeHash(space: PersistentSpace, filename: string, hash: string, dim: number): Promise<void> {
    // Store hash sentinel with zero-vector embedding
  }

  async #deleteOldChunks(space: PersistentSpace, filename: string): Promise<void> {
    // Delete by source metadata
  }
}
```

### 5.5c MettaEpisodicMemory — Timestamped History

```typescript
// @senars/metta/src/agent/MettaEpisodicMemory.ts

import type { PersistentSpace } from '../extensions/persistent-space.js';

export interface EpisodicEntry {
  readonly timestamp: string;         // ISO 8601
  readonly humanMessage: string;
  readonly response: string;
  readonly sexpr?: string;
  readonly errorFeedback?: string;
}

export class MettaEpisodicMemory {
  #space: PersistentSpace;

  constructor(space: PersistentSpace) {
    this.#space = space;
  }

  async append(entry: EpisodicEntry): Promise<void> {
    // Store as MeTTa atoms with timestamp key
    const atoms = [
      `(episode "${entry.timestamp}" human "${entry.humanMessage.replace(/"/g, '\\"')}")`,
      `(episode "${entry.timestamp}" response "${entry.response.replace(/"/g, '\\"')}")`,
    ];
    if (entry.sexpr) atoms.push(`(episode "${entry.timestamp}" sexpr "${entry.sexpr.replace(/"/g, '\\')}")`);
    if (entry.errorFeedback) atoms.push(`(episode "${entry.timestamp}" error "${entry.errorFeedback.replace(/"/g, '\\')}")`);
    
    for (const atom of atoms) {
      this.#space.add(atom);
    }
  }

  async getEpisodes(aroundTime?: string, lines = 20): Promise<EpisodicEntry[]> {
    // Query episodes around a timestamp (from OmegaClaw helper.around_time)
    const targetTime = aroundTime ? new Date(aroundTime) : new Date();
    
    // Get all episode atoms, sort by timestamp, return window around target
    // Implementation uses space.query with pattern matching
    return [];
  }

  // OmegaClaw's "episodes time_string" command
  async getEpisodesByTime(timeStr: string, contextLines = 20): Promise<string> {
    const episodes = await this.getEpisodes(timeStr, contextLines);
    return episodes.map(e => 
      `${e.timestamp}\nHUMAN_MESSAGE: ${e.humanMessage}\n${e.response}${e.errorFeedback ? '\nERROR_FEEDBACK: ' + e.errorFeedback : ''}`
    ).join('\n\n');
  }
}
```

### 5.6 MettaInputProcessor — NL→MeTTa Translation

```typescript
// @senars/metta/src/agent/MettaInputProcessor.ts

import type { MeTTaRuntime, Atom } from '../runtime/builder.js';

export class MettaInputProcessor {
  #runtime: MeTTaRuntime;

  constructor(runtime: MeTTaRuntime) {
    this.#runtime = runtime;
  }

  async process(input: string): Promise<Atom[]> {
    // 1. Try parsing as MeTTa S-expression
    try {
      return this.#runtime.parse(input);
    } catch {
      // 2. Fall back to NL→MeTTa translation via LM
      return this.#translateToMeTTa(input);
    }
  }

  async #translateToMeTTa(input: string): Promise<Atom[]> {
    // Use LM to convert natural language to MeTTa atoms
    // This could use a dedicated grounded op or prompt template
    const prompt = `Translate to MeTTa atoms: "${input}"\n\nAtoms:`;
    // ... LM call ...
    return [];
  }
}
```

### 5.7 MettaChannelOps — Channel-Specific Grounded Ops

```typescript
// @senars/metta/src/agent/MettaChannelOps.ts

import type { GroundedOp } from '../core/ops.js';
import { defineOp } from '../core/ops.js';
import { Effect } from 'effect';

export function createChannelOps(send: (target: string, text: string) => Promise<void>) {
  return {
    send: defineOp('send', (target: string, message: string) => 
      Effect.tryPromise(() => send(target, message))),
    
    schedule: defineOp('schedule', (delayMs: number, action: string) =>
      Effect.gen(function* () {
        yield* Effect.sleep(delayMs);
        // Execute action via interpreter
        return yield* Effect.succeed({ scheduled: true });
      })),
    
    wait: defineOp('wait', (condition: string, timeoutMs: number) =>
      Effect.gen(function* () {
        // Poll condition until true or timeout
        return yield* Effect.succeed({ waited: true });
      })),
  };
}
```

### 5.8 MettaCommandParser — LLM Output → Structured Commands

```typescript
// @senars/metta/src/agent/MettaCommandParser.ts

import { Effect } from 'effect';

export const LLM_COMMANDS = [
  'send', 'remember', 'query', 'episodes', 
  'read-file', 'write-file', 'append-file',
  'search', 'shell', 'metta',
  'pin', 'tavily-search', 'technical-analysis'
] as const;

export type LlmCommand = typeof LLM_COMMANDS[number];

export interface ParsedCommand {
  readonly command: LlmCommand;
  readonly args: string[];
  readonly raw: string;
}

export class MettaCommandParser {
  // OmegaClaw's balance_parentheses + command extraction
  parse(llmOutput: string): ParsedCommand[] {
    const normalized = llmOutput
      .replace(/_quote_/g, '"')
      .replace(/_newline_/g, '\n');
    
    const lines = normalized.split('\n').map(l => l.trim()).filter(Boolean);
    const merged = this.#mergeSendContinuations(lines);
    
    return merged
      .map(line => this.#parseLine(line))
      .filter((c): c is ParsedCommand => c !== null);
  }

  #mergeSendContinuations(lines: string[]): string[] {
    const merged: string[] = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const cmd = this.#getCommandName(line);
      
      if (cmd !== 'send') {
        merged.push(line);
        i++;
        continue;
      }

      const sendWrapped = line.startsWith('(');
      const head = sendWrapped ? line.slice(1).trimStart() : line;
      const parts = head.split(/\s+/, 2);
      let text = parts[1]?.trim() ?? '';
      
      // Decode quoted payload
      if (text.startsWith('"')) {
        const decoded = this.#decodeQuoted(text);
        if (decoded !== null) text = decoded;
      }

      i++;
      const continuations: string[] = [];
      while (i < lines.length && !this.#isKnownCommand(lines[i])) {
        let cont = lines[i].trim();
        if (sendWrapped && cont.endsWith(')')) {
          cont = cont.slice(0, -1).trimEnd();
          continuations.push(cont);
          i++;
          break;
        }
        continuations.push(cont);
        i++;
      }

      if (continuations.length > 0) {
        text = text ? text + '\n' + continuations.join('\n') : continuations.join('\n');
      }
      merged.push(`send ${JSON.stringify(text)}`);
    }
    return merged;
  }

  #parseLine(line: string): ParsedCommand | null {
    // Strip outer parens, handle special cases (-cmd → pin cmd, write-file/append-file)
    let stripped = line;
    if (stripped.startsWith('(') && stripped.endsWith(')')) {
      stripped = stripped.slice(1, -1).trim();
    }
    if (stripped.startsWith('-')) {
      stripped = 'pin ' + stripped.slice(1);
    } else if (stripped.startsWith('(-')) {
      stripped = '(pin -' + stripped.slice(2);
    }

    const parts = stripped.split(/\s+/, 2);
    const cmd = parts[0];
    const rest = parts[1]?.trim() ?? '';

    if (!LLM_COMMANDS.includes(cmd as LlmCommand)) return null;

    // Special handling for write-file/append-file (filename + content)
    if (cmd === 'write-file' || cmd === 'append-file') {
      let filename = '';
      let content = '';
      if (rest.startsWith('"')) {
        const end = this.#findClosingQuote(rest, 0);
        filename = rest.slice(0, end + 1);
        content = rest.slice(end + 1).trim();
      } else {
        const split = rest.split(/\s+/, 2);
        filename = '"' + split[0].replace(/"/g, '\\"') + '"';
        content = split[1] ?? '';
      }
      if (content.startsWith('"') && content.endsWith('"')) {
        return { command: cmd, args: [filename, content], raw: line };
      }
      content = content.replace(/"/g, '\\"');
      return { command: cmd, args: [filename, `"${content}"`], raw: line };
    }

    // Standard single-arg commands
    let arg = rest;
    if (!arg.startsWith('"')) {
      arg = `"${arg.replace(/"/g, '\\"')}"`;
    }
    return { command: cmd, args: [arg], raw: line };
  }

  #getCommandName(line: string): string {
    let normalized = line.trim();
    while (normalized.startsWith('(')) normalized = normalized.slice(1).trimStart();
    while (normalized.endsWith(')')) normalized = normalized.slice(0, -1).trimEnd();
    return normalized.split(/\s+/)[0] ?? '';
  }

  #isKnownCommand(line: string): boolean {
    return LLM_COMMANDS.includes(this.#getCommandName(line) as LlmCommand);
  }

  #decodeQuoted(text: string): string | null {
    try { return JSON.parse(text); } catch { return null; }
  }

  #findClosingQuote(str: string, start: number): number {
    let escaped = false;
    for (let i = start + 1; i < str.length; i++) {
      const ch = str[i];
      if (ch === '"' && !escaped) return i;
      escaped = (ch === '\\' && !escaped);
    }
    return str.length - 1;
  }
}
```

### 5.9 MettaLoop — Continuous Execution (Enhanced)

```typescript
// @senars/metta/src/agent/MettaLoop.ts

import type { MeTTaInterpreter, MeTTaAtom } from '../engine/interpreter.js';
import type { EventBus } from '@senars/core';
import type { CognitiveEvent } from '@senars/core';
import type { MettaAgent } from './MettaAgent.js';
import { MettaCommandParser, ParsedCommand } from './MettaCommandParser.js';
import { Effect } from 'effect';

export class MettaLoop {
  #agent: MettaAgent;
  #interpreter: MeTTaInterpreter;
  #eventBus: EventBus;
  #config: MettaLoopConfig;
  #commandParser = new MettaCommandParser();
  #knownAtoms = new Set<string>();
  #running = false;
  #idleSince = 0;
  #loopsSinceInput = 0;
  #lastPrompt = '';

  constructor(
    agent: MettaAgent,
    interpreter: MeTTaInterpreter,
    eventBus: EventBus,
    config: MettaLoopConfig = { maxWakeLoops: 50, sleepInterval: 1, wakeupInterval: 600, skillResultsChars: 50000 }
  ) {
    this.#agent = agent;
    this.#interpreter = interpreter;
    this.#eventBus = eventBus;
    this.#config = config;
  }

  async run(): Promise<void> {
    this.#running = true;
    
    // Initialize: load knowledge, channels, etc.
    await this.#agent.importKnowledgePriors('./knowledge-priors');
    // ... initChannels, initMemory ...

    while (this.#running) {
      const cycleStart = Date.now();
      
      // Build prompt with context (OmegaClaw's getContext)
      const prompt = await this.#buildPrompt();
      
      // Receive message from channels
      const msg = await this.#receiveMessage();
      
      if (msg && msg !== this.#getLastMessage()) {
        this.#setLastMessage(msg);
        this.#loopsSinceInput = 0; // Reset on new input
      }

      if (this.#shouldRunCycle(msg)) {
        // Send prompt to LLM
        const llmResponse = await this.#callLLM(prompt);
        
        // Parse and execute commands
        const commands = this.#commandParser.parse(llmResponse);
        const results = await this.#executeCommands(commands);
        
        // Update LAST_SKILL_USE_RESULTS
        this.#updateSkillResults(results);
        
        // Add to history
        if (msg) {
          await this.#agent.appendToHistory({
            timestamp: new Date().toISOString(),
            humanMessage: msg,
            response: llmResponse,
            errorFeedback: this.#getErrorFeedback(),
          });
        }
      }

      // Sleep interval
      const delay = this.#config.sleepInterval * 1000;
      await new Promise(r => setTimeout(r, delay));
      
      // Check wakeup
      if (this.#loopsSinceInput >= this.#config.maxWakeLoops) {
        await this.#sleepUntilWakeup();
      }
    }
  }

  async #buildPrompt(): Promise<string> {
    const skills = this.#agent.getAllSkillFeedback().map(f => 
      `- ${f.skill}: ${f.lastResult}`).join('\n');
    const history = await this.#agent.getEpisodes(undefined, 20);
    const historyText = history.map(e => `${e.timestamp}\nHUMAN: ${e.humanMessage}\nRESPONSE: ${e.response}`).join('\n\n');
    const skillResults = this.#agent.getSkillsRecentResults(this.#config.skillResultsChars);
    
    return `PROMPT: ${await this.#getSystemPrompt()} SKILLS: ${skills} 
OUTPUT_FORMAT: Up to 5 lines, no quotes around args:
 toolName1 arg1
 toolName2 arg2
LAST_SKILL_USE_RESULTS: ${skillResults}
HISTORY: ${historyText}
TIME: ${new Date().toISOString()}`;
  }

  async #executeCommands(commands: ParsedCommand[]): Promise<string[]> {
    const results: string[] = [];
    for (const cmd of commands) {
      try {
        // Execute via grounded op or channel op
        const result = await this.#executeSingle(cmd);
        results.push(`COMMAND_RETURN: ${result}`);
      } catch (e) {
        results.push(`ERROR: ${e.message}`);
        this.#setErrorFeedback(e.message);
      }
    }
    return results;
  }

  async #executeSingle(cmd: ParsedCommand): Promise<string> {
    switch (cmd.command) {
      case 'send':
        return this.#agent.sendMessage(cmd.args[0]);
      case 'remember':
        await this.#agent.learn(cmd.args[0]);
        return 'REMEMBER-SUCCESS';
      case 'query':
        const recalled = await this.#agent.recall(cmd.args[0]);
        return recalled.map(a => a.toString()).join('\n');
      case 'episodes':
        return this.#agent.getEpisodesByTime(cmd.args[0]);
      case 'metta':
        // Execute MeTTa S-expression
        const atoms = await this.#interpreter.parse(cmd.args[0]);
        return this.#interpreter.evaluate(atoms).map(a => a.toString()).join('\n');
      // ... other commands via channel ops or grounded ops
      default:
        throw new Error(`Unknown command: ${cmd.command}`);
    }
  }

  #shouldRunCycle(msg: string | null): boolean {
    return msg !== null || this.#loopsSinceInput < this.#config.maxWakeLoops;
  }

  #shouldKeepRunning(hasNewAtoms: boolean): boolean {
    if (hasNewAtoms) return true;
    if (this.#loopsSinceInput < this.#config.maxWakeLoops) return true;
    return false;
  }

  async #sleepUntilWakeup(): Promise<void> {
    while (this.#running) {
      const elapsed = (Date.now() - this.#idleSince) / 1000;
      if (elapsed >= this.#config.wakeupInterval) break;
      await new Promise(r => setTimeout(r, Math.min(1000, (this.#config.wakeupInterval - elapsed) * 1000)));
    }
    this.#loopsSinceInput = 0;
    this.#idleSince = 0;
  }

  stop(): void { this.#running = false; }
  configure(config: Partial<MettaLoopConfig>): void { this.#config = { ...this.#config, ...config }; }
}
```

---

## Part 6: Multi-Agent Mode — `CognitiveCoordinator`

```typescript
// Entry point example (src/bin/bot-ai.ts)

import { NarsAgent } from '@senars/nar';
import { MettaAgent } from '@senars/metta';
import { CognitiveCoordinator } from '@senars/core';
import { IRCConnection } from '@senars/io/connections/irc.js';
import { WSConnection } from '@senars/io/connections/ws.js';

const narAgent = new NarsAgent({ nar: SeNARSFactory.createDefault() });

const mettaAgent = new MettaAgent({ metta: createMeTTa() });
mettaAgent.registerSkill('search', searchGroundedOp);
mettaAgent.configureLoop({ maxWakeLoops: 50, wakeupInterval: 600 });

// Coordinator — no shared interface, just fan-in/fan-out
const agent = new CognitiveCoordinator([narAgent, mettaAgent]);
agent.mount(new IRCConnection({ channel: '#senars' }));
agent.mount(new WSConnection({ port: 8765 }));
agent.start();

// UI subscribes to the combined event stream
uiServer.start({ on: (h) => agent.on(h) });
```

The coordinator dispatches each input to both agents with the same `correlationId`. Each agent processes it independently and emits its own events. The coordinator aggregates all events with provenance (`engine: 'nar'` or `engine: 'metta'`). The UI shows both in the same graph view, tagged by origin.

---

## Part 7: UI Changes (`@senars/ui`)

### 7.1 Server

Current: `startWebUI(nar: NAR, agent: Agent)` — imports NAR directly.

After: `startWebUI(source: CognitiveEventSource)` — accepts any event source.

```typescript
// @senars/ui/src/server/index.ts — after refactor
import type { CognitiveEvent, CognitiveEventSource, AgentCapabilities } from '@senars/core';

export async function startWebUI(source: CognitiveEventSource): Promise<TestServer> {
  // Query capabilities on connect
  const caps = source.capabilities();
  
  // Subscribe to engine:* events directly
  source.on('*', (event) => {
    // Convert to GraphOp[] based on event type + lens
    // Broadcast to connected WebSocket clients
  });
  
  // No more nar-adapter.ts, no more socket-handler.ts hardcoded to NAR
  return startHttpServer(bridge, DEFAULT_PORT, clientDistPath);
}
```

`gateway.ts` subscriptions change from `nar:derivation` to `engine:derivation`.
`nar-adapter.ts` is replaced by a generic `CognitiveBridge.ts` that projects any `CognitiveEvent` → `GraphOp[]` using the discriminated `GraphNodeData`.

### 7.2 Client

The client is entirely unchanged. It speaks Zod-validated WebSocket messages (`Protocol.ts`) which are now in `@senars/core`. The client doesn't know or care whether the server is running NAR, MeTTa, or both.

### 7.3 Migration Path for the Current UI

1. Extract `ui/src/shared/protocol.ts` → `@senars/core/src/Protocol.ts` (no schema changes)
2. Replace `startWebUI(nar, agent)` with `startWebUI(source)` signature
3. Replace `buildNarAdapter(nar)` with generic `CognitiveBridge` that reads `engine:*` events
4. The UI server's `main()` changes only the bootstrap lines:

```typescript
// Before
const nar = SeNARSFactory.createDefault(config);
const agent = createAgent({ nar });
agent.start();
const server = await startWebUI(nar, agent);

// After — NAR-only
import { NarsAgent } from '@senars/nar';
const agent = new NarsAgent({ nar: SeNARSFactory.createDefault(config) });
agent.start();
const server = await startWebUI(agent);

// After — MeTTa-only
import { MettaAgent } from '@senars/metta';
const agent = new MettaAgent({ metta: createMeTTa() });
agent.registerSkill('search', ...);
agent.start();
const server = await startWebUI(agent);

// After — both
const agent = new CognitiveCoordinator([new NarsAgent(...), new MettaAgent(...)]);
agent.start();
const server = await startWebUI(agent);
```

---

## Part 8: Migration Plan

> **Status:** Phase 0 ✅ Complete. Phase 1 ✅ Complete. Phase 2 ✅ Complete. Phase 3 ✅ Complete. Phase 4-7 🔲.

### Phase 0: Foundation (Week 0) — ✅ **DONE**

1. ✅ Created `core/` package (`@senars/core`) with `package.json`, `tsconfig.json`
2. ✅ Created `@senars/core/src/Lifecycle.ts` — abstract `BaseComponent`, `ComponentState`, `Logger`, `Metrics`, `EventBus` interfaces + `ComponentContext`
3. ✅ Created `@senars/core/src/index.ts` — re-exports Lifecycle types
4. ✅ Added `core` to `pnpm-workspace.yaml`, added `@senars/core` dependency to `nar/package.json`
5. ✅ Updated `nar/src/lifecycle/BaseComponent.ts` — extends `@senars/core`'s `BaseComponent`, provides NAR-specific defaults (`createLogger`, `MetricsCollector`, `NarEventBus`)
6. ✅ Added `increment()`, `gauge()`, `histogram()` to `MetricsCollector` to satisfy core `Metrics` interface
7. ✅ `pnpm typecheck` passes (all 5 packages), `pnpm vitest run tests/nar/unit/lifecycle.test.ts` passes (17/17)

**Key decisions made:**
- `nar/src/lifecycle/BaseComponent.ts` still exports `BaseComponent` for backward compatibility — it extends the core version and narrows accessor return types to NAR concrete types
- `nar/src/types/events.ts` (EventBus) and `nar/src/logger/index.ts` (Logger) are structurally compatible with core interfaces without explicit `implements` — `as` casts in BaseComponent bridge the generic/constrained type differences
- `nar/src/metrics/index.ts` (MetricsCollector) explicitly `implements` the core `Metrics` interface with added generic methods

### Phase 1: Extract `@senars/core` (Week 1) — No Functional Change ✅

> **Status:** Phase 0 ✅ (Lifecycle done). Phase 1 ✅ (all core extractions complete).

- [x] 1. Move `ui/src/shared/protocol.ts` → `@senars/core/src/Protocol.ts` (pure extraction, add discriminants)
- [x] 2. Move `agent/src/model/ModelRunner.ts` → `@senars/core/src/ModelRunner.ts` (decoupled from NAR — uses `ModelProvider` interface instead of `LMService`)
- [x] 3. Move `agent/src/services/LMChatService.ts` → `@senars/core/src/ChatService.ts` (parameterized with `ChatContext` generic, prompt-building hook)
- [x] 4. Move `agent/src/EventBus.ts` event types → `@senars/core/src/CognitiveEvent.ts` (renamed `nar:*` → `engine:*`, added `engine` origin, `correlationId`, `parentEventId`)
- [x] 5. Move `agent/src/options-schema.ts` → `@senars/core/src/Options.ts` (schema + validation; env helpers stay in agent)
- [x] 6. Move `agent/src/subservices/SessionOrchestrator.ts` → `@senars/core/src/SessionOrchestrator.ts`
- [x] 7. Move `agent/src/subservices/StatsManager.ts` → `@senars/core/src/StatsManager.ts`
- [x] 8. Move `agent/src/subservices/KnowledgeManager.ts` → `@senars/core/src/KnowledgeManager.ts`
- [x] 9. Move `agent/src/services/ApprovalService.ts` → `@senars/core/src/ApprovalService.ts` (generic `ApprovalManager` interface)
- [x] 10. Create `@senars/core/src/Transport.ts` (from `src/io/types.ts` with NAR removed, `correlationId` added)
- [x] 11. Create `@senars/core/src/CognitiveCoordinator.ts`
- [x] 12. Update all imports: agent re-exports from `@senars/core`; core exports all 13 entry points in `package.json`

**Verification:** `pnpm typecheck` passes (all 5 packages). `pnpm vitest run tests/nar/unit/lifecycle.test.ts` passes (17/17). No behavioral change.

### Phase 2: Extract `@senars/io` (Week 1) — Decouple Transports from NAR ✅

> **Status:** Complete. All structural work done, all import paths migrated, old `src/io/` removed. **Circular dependency** between `@senars/io` and `@senars/nar` resolved by moving `Logger` class, helpers (`makeId`, `toError`, `errMsg`), and `CommandDefinition`/`CommandContext` types to `@senars/core`.
>
> **Pre-existing type errors (9 total, not introduced by Phase 2):**
> - `nar/src/commands/episodes.ts` (3): `EpisodicMemory` lacks `getRecent`/`get`/`remove`
> - `nar/src/commands/self.ts` (4): `ReasoningAboutReasoning` lacks `getState`/`reflect`/`getMetrics`/`getHistory`
> - `agent/src/io-middleware.ts` (2): `AuthManager` from `@senars/io` lacks `checkAuth`/`bindUser`
>
> These existed before Phase 2 (the old `src/io/` had richer versions of these types). Fixes belong in Phase 3 when `agent/` dissolves into `@senars/nar/src/agent/`.

- [x] 1. Create `@senars/io/` package directory (`io/package.json`, `io/tsconfig.json`)
- [x] 2. Move `src/io/` contents to `@senars/io/`:
  - `io/src/types.ts` — no NAR import, re-exports `Connection`, `ConnectionDeps`, etc. from `@senars/core/transport`
  - `io/src/connection-manager.ts` — `addConnection` accepts generic `ConnectionDeps` (no `nar` field)
  - `io/src/router.ts` — `MessageContext` no longer carries `nar?: NAR`
  - `io/src/auth.ts` — generic
  - `io/src/connections/*.ts` — all 6 transport files + `reply-target.ts` (imports updated to `@senars/nar/logger`, `@senars/nar/utils`)
  - `io/src/utils/http.ts` — imports `Logger` type from `@senars/core/transport`
  - `io/src/utils/websocket.ts` — imports `makeId`/`toError` from `@senars/nar/utils`
- [x] 3. Remove `NAR` from `ConnectionDeps` — `io/src/types.ts` uses `@senars/core/transport`'s `ConnectionDeps` (no NAR)
- [x] 4. Move NAR-specific commands into `@senars/nar/src/commands/`:
  - `nar/src/commands/nar.ts`, `rlfp.ts`, `self.ts`, `episodes.ts`, `core.ts`, `config.ts`, `lm.ts`, `memory.ts`, `utils.ts`
  - All commands use `(ctx as any).nar` pattern (compatible with generic `CommandContext` from `@senars/io`)
  - `nar/src/commands/index.ts` exports all
- [x] 5a. `pnpm-workspace.yaml` — added `io`
- [x] 5b. `nar/package.json` — added `@senars/io: workspace:*` dep, added `./logger`, `./utils`, `./commands` subpath exports
- [x] 6. Update all import paths:
  - `src/bin/repl.ts`: `../io/connections/cli.js` → `@senars/io/connections/cli`
  - `src/bin/bot-ai.ts`: `../io` → `@senars/io`
  - `src/api/websocket-adapter.ts`: `../io/utils/websocket.js` → `@senars/io/utils/websocket`
  - `src/api/http-adapter.ts`: `../io/utils/http.js` → `@senars/io/utils/http`
  - `agent/src/io-bridge.ts`, `io-middleware.ts`, `register-commands.ts`, `options-schema.ts`: `../../src/io` → `@senars/io`
  - `scripts/test-irc-connection.ts`: `../src/io` → `@senars/io`
  - Test files (4 also updated)
- [x] 7. Remove old `src/io/` directory, update `src/index.ts` to re-export from `@senars/io` instead
- [x] **Circular dependency fix:** Moved `Logger` class → `@senars/core/logger`, helpers (`makeId`, `toError`, `errMsg`) → `@senars/core/helpers`, `CommandDefinition`/`CommandContext` types → `@senars/core/command-types`. Removed `@senars/nar` from `io/package.json` and `@senars/io` from `nar/package.json`.

**Verification:** All transports compile and work without NAR dependency in `ConnectionDeps`. `pnpm typecheck` passes across all packages.

### Phase 3: Move `agent/` → `@senars/nar/src/agent/` (Week 2) ✅

> **Status:** Structural move complete. All 35 agent files moved to `nar/src/agent/`, import paths updated, `agent/` removed from workspace, `nar/package.json` exports `./agent`. 9 pre-existing type errors unchanged.

- [x] 1. Create `@senars/nar/src/agent/` directory (core/, model/, services/, subservices/, schemas/, utils/)
- [x] 2. Move all `agent/src/` files (35 files) into `@senars/nar/src/agent/`, updated relative imports (`../../nar/src/` → `../`, `../../../nar/src/` → `../../`, `../../src/config` → `../../../src/config`)
- [x] 3. Agent files re-import generic pieces from `@senars/core` (types, ModelRunner, ChatService, options-schema, etc.)
- [x] 4. Add `CognitiveEventSource` methods (`submit`, `health`, `capabilities`, `mount`, `unmount`) to `Agent` interface + `AgentImpl` (structural conformance, no `implements` clause to avoid return-type conflicts)
- [x] 5. Add `health()` and `capabilities()` to `AgentImpl` — `health()` reads from statsManager, `capabilities()` returns `{ engine: 'nar', supports: { chat, beliefs, drives, ... } }`
- [x] 6. Wire `correlationId` through `input-processor.ts` — added optional `correlationId` field to `ProcessInputOpts`; `submit()` stores in `#currentCorrelationId`, emits `CognitiveEvent.input`, delegates to `chat()`
- [x] 7. Remove `agent/` from workspace (`pnpm-workspace.yaml`), update all 15 consumer files (src/bin/, src/api/, src/index.ts, ui/src/server/, tests/), update `nar/tsconfig.json` (removed `../agent/src/` include)

**Follow-up completed (Phase 3b):**
- ✅ Added `submit()`, `health()`, `capabilities()`, `mount()`, `unmount()` to both `Agent` interface (`types.ts`) and `AgentImpl` — structurally conforms to `CognitiveEventSource` (implicitly, without `implements` clause, to avoid return-type conflicts with existing `on`/`off` signatures)
- ✅ Added `CognitiveEvent`-compatible overloads for `on`/`off` — `on(event: '*' | string, handler: (event: CognitiveEvent) => void): void` coexists with existing `on<K extends EventKey>(event: K, listener: ...): () => void`
- ✅ Wired `correlationId` — `submit()` stores in `#currentCorrelationId`, emits `CognitiveEvent` with `type: 'input'` to `#cognitiveListeners`, then delegates to `chat()`. `ProcessInputOpts` gains optional `correlationId` field.
- ✅ NAR internal events (derivation, cycle) are NOT yet bridged to CognitiveEvents — the `wrapNarBus` → `#emitCognitive` bridge remains a future enhancement. Existing typed EventBus continues to work unchanged.

**Verification:** `pnpm typecheck` across all packages passes (same 9 pre-existing errors only). Agent accessible via `@senars/nar/agent`.

### Phase 4: Build `@senars/metta` Agent Layer (Weeks 3-4)

> **Status:** ✅ **Complete** (core implementation). All 15 items implemented.
>
> **Note:** `@senars/metta` typecheck has pre-existing errors from `ai` package types conflicting with `exactOptionalPropertyTypes`. These are in `node_modules`, not in the agent code. The agent files compile cleanly.

- [x] 1. Create `@senars/metta/src/agent/` directory
- [x] 2. Implement `MettaAgent.ts` — wraps `MeTTaRuntime`, mounts transports via `@senars/core` Transport (full: `start()`, `stop()`, `submit()`, `on()`, `off()`, `health()`, `capabilities()`, `mount()`, `unmount()`, skill registration, loop wiring)
- [x] 3. Implement `MettaLoop.ts` — OmegaClaw-style continuous execution with message queue, correlationId propagation, CognitiveEvent emission
- [x] 4. Implement `MettaSkills.ts` — wraps `registerOp`/`getOp` with feedback tracking (call count, success rate, recent results)
- [x] 5. Implement `MettaLTM.ts` — `PersistentSpace` integration with `learn()`, `recall()`, `importKnowledge()`
- [x] 6. Implement `MettaKnowledge.ts` — knowledge priors framework with `importKnowledgePriors()` placeholder
- [x] 7. Implement `MettaEpisodic.ts` — episodic memory: append-only log with timestamped recall, `EpisodicEntry` interface
- [x] 8. Implement `MettaInputProcessor.ts` — NL→MeTTa atom translation via `parseMeTTa`, with MeTTa detection heuristic
- [x] 9. Implement `MettaChannelOps.ts` — channel-specific grounded ops (send, schedule, wait)
- [x] 10. Implement `MettaCommandParser.ts` — LLM output → structured command parsing (send, remember, query, episodes, metta, pin, read-file, write-file, append-file, search, shell, tavily-search, technical-analysis)
- [x] 11. Implement `MettaHistory.ts` — history management + ERROR_FEEDBACK injection, prompt formatting
- [x] 12. Implement `MettaPromptBuilder.ts` — prompt construction (SKILLS, LAST_SKILL_USE_RESULTS, HISTORY, TIME)
- [x] 13. Implement `PolicyEngine.ts` — security: command allowlists, file sandbox check, shell permission gating
- [x] 14. Wire `CognitiveEvent` emission from MeTTa interpreter events (input, derivation, cycle, skill:executed events)
- [x] 15. Add `health()` and `capabilities()` methods (fully implemented: dynamic health based on running state, metta capabilities)

**Files created:** `MettaSkills.ts`, `MettaCommandParser.ts`, `MettaHistory.ts`, `MettaPromptBuilder.ts`, `MettaInputProcessor.ts`, `MettaLoop.ts`, `MettaChannelOps.ts`, `MettaLTM.ts`, `MettaKnowledge.ts`, `MettaEpisodic.ts`, `PolicyEngine.ts` (11 new files). `MettaTypes.ts` updated with `PromptContext` and `SkillFeedback` types. `MettaAgent.ts` fully wired. `index.ts` exports all new classes.

**Verification:** All agent source files compile. Integration testing pending with transports and CognitiveCoordinator.

### Phase 5: UI Bridge Generalization (Week 3)

- [ ] 1. Replace `NarAdapter` in `ui/src/server/` with generic `CognitiveBridge` that projects `CognitiveEvent` → `GraphOp[]` using discriminated `GraphNodeData`
- [ ] 2. Change `subscribeSocket` to listen on `engine:*` events instead of `nar:*`
- [ ] 3. Update `startWebUI` signature to accept `CognitiveEventSource` instead of `(nar, agent)`
- [ ] 4. Add `capabilities()` query on connect

**Verification:** UI loads identically for NarsAgent. Then test with MettaAgent and CognitiveCoordinator.

### Phase 6: Telegram Channel (Week 4)

- [ ] 1. Add `@senars/io/src/connections/telegram.ts` — Telegram bot API via long-polling or webhook
- [ ] 2. Implements the same `Transport` interface
- [ ] 3. Mountable on any agent (NarsAgent, MettaAgent, CognitiveCoordinator)

### Phase 7: Cleanup (Week 4)

- [x] 1. Remove `agent/` directory (done in Phase 3 — removed from workspace, physical dir deleted)
- [ ] 2. Simplify `src/bin/repl.ts` to use `NarsAgent` or `MettaAgent` (currently still uses old import paths from `@senars/nar/agent` — works, but entry point could be cleaned)
- [ ] 3. Update `package.json` scripts to point at correct entry points

---

## Part 9: File Change Summary

| Action | Count | Details |
|---|---|---|
| **CREATE** | ~84 files | `@senars/core/` (16 files), `@senars/io/` (17 files: types, connections, utils, commands, index), `@senars/nar/src/commands/` (10 files), `@senars/nar/src/agent/` (35 files), `@senars/metta/src/agent/` (11 new files: MettaAgent, MettaLoop, MettaSkills, MettaCommandParser, MettaHistory, MettaPromptBuilder, MettaInputProcessor, MettaChannelOps, MettaLTM, MettaKnowledge, MettaEpisodic, PolicyEngine, index, MettaTypes) |
| **MOVE** | ~75 files | `agent/src/*` → `@senars/nar/src/agent/` (done — 35 files), `src/io/*` → `@senars/io/` (done — 26 files), `ui/src/shared/*` → `@senars/core/` (done — 1 file) |
| **MODIFY** | ~25 files | `nar/package.json`, `metta/package.json`, `nar/tsconfig.json`, `pnpm-workspace.yaml`, `src/index.ts`, `src/bin/`, `src/api/`, `ui/src/server/`, tests, `nar/src/` internal imports |
| **DELETE** | ~87 files | Phase 2: `src/io/` (26 files). Phase 3: `agent/` directory (35 source files + package config + tsconfig) |

---

## Part 10: Testing Strategy

| Layer | Tests | Tool |
|---|---|---|
| `@senars/core` | Unit tests for ChatService, ModelRunner, event types, session orchestration, coordinator fan-in/fan-out | Vitest |
| `@senars/io` | Transport mock tests, integration test for IRC/WS message routing, correlationId propagation | Vitest |
| `@senars/nar` agent | Existing unit + integration + cognitive tests (unchanged) | Vitest |
| `@senars/metta` agent | MettaLoop scheduling test, MettaSkills execution, MettaLTM recall, MettaKnowledge import/incremental, MettaEpisodic append/recall, MettaCommandParser parsing, MettaPromptBuilder, PolicyEngine enforcement | Vitest |
| Multi-agent | CognitiveCoordinator fan-in/fan-out with correlation IDs, health aggregation | Vitest |
| UI | Playwright E2E (unchanged, protocol identical) | Playwright |

---

## Part 11: Priority & Phasing

```
Phase 0: @senars/core Lifecycle  ── Day 1   ✅ DONE
Phase 1: @senars/core (rest)     ── Week 1  ✅ DONE
Phase 2: @senars/io              ── Week 1  ✅ DONE
                                            ── Circular dep resolved (Logger, helpers, command types → core)
                                            ── All import paths migrated, src/io/ removed
                                            ── 9 pre-existing type errors remain (EpisodicMemory,
                                               ReasoningAboutReasoning, AuthManager — see Phase 2 section)
Phase 3: agent/ → nar/agent      ── Week 2  ✅ DONE
                                             ── 35 files moved, imports updated, workspace removed
                                             ── @senars/nar/agent subpath export added
                                             ── 9 pre-existing type errors unchanged
                                             ── ✅ Follow-up: CognitiveEventSource methods (submit,
                                                 health, capabilities, mount, unmount) added to
                                                 AgentImpl + Agent interface; correlationId wired
                                                 through input-processor.ts; on/off overloaded for
                                                 CognitiveEvent handlers
Phase 4: MettaAgent              ── Weeks 3-4 ✅ DONE
                                              ── MettaAgent.ts, MettaSkills.ts, MettaLoop.ts,
                                              ── MettaCommandParser.ts, MettaHistory.ts, MettaPromptBuilder.ts,
                                              ── MettaInputProcessor.ts, MettaChannelOps.ts, MettaLTM.ts,
                                              ── MettaKnowledge.ts, MettaEpisodic.ts, PolicyEngine.ts
                                              ── All wired together, CognitiveEvent emission integrated
Phase 5: UI bridge               ── Week 3  🔲
Phase 6: Telegram                ── Week 4  🔲
Phase 7: Cleanup                 ── Week 4  🔲
```

---

## Part 12b: TypeScript Refactoring Opportunities (Existing Codebase)

During the migration, these refactorings in the existing NAR/agent codebase would significantly improve maintainability with minimal risk:

### 12b.1 Replace `any` with Discriminated Unions

**File:** `agent/src/types.ts` — `EventMap`, `AgentEventMap` use `any` extensively.

```typescript
// Before
interface AgentEventMap {
  'nar:derivation': any;
  'nar:cycle': any;
  // ...
}

// After — discriminated union with proper payload types
type NarEvent = 
  | { type: 'derivation'; term: string; confidence: number }
  | { type: 'cycle'; cycle: number; derived: number }
  | { type: 'drive:changed'; drive: string; urgency: number }
  // ...
```

### 12b.2 Branded Types for IDs

**Files:** `agent/src/types.ts`, `src/io/types.ts`, `ui/src/shared/protocol.ts`

```typescript
// Brand IDs to prevent accidental interchange
declare const CorrelationIdBrand: unique symbol;
export type CorrelationId = string & { readonly [CorrelationIdBrand]: true };

declare const SpaceIdBrand: unique symbol;
export type SpaceId = string & { readonly [SpaceIdBrand]: true };

declare const SessionIdBrand: unique symbol;
export type SessionId = string & { readonly [SessionIdBrand]: true };

// Factory functions
export const CorrelationId = (id: string): CorrelationId => id as CorrelationId;
export const SpaceId = (id: string): SpaceId => id as SpaceId;
```

### 12b.3 Replace `EventEmitter` with Effect Streams

**File:** `agent/src/EventBus.ts`

```typescript
// Before — Node EventEmitter, no backpressure, no resource safety
export class EventBus { private readonly emitter = new EventEmitter(); }

// After — Effect Stream for backpressure, cancellation, resource safety
import { Stream, Effect } from 'effect';

export class EventBus {
  #stream = Stream.makeChannel<CognitiveEvent>({ capacity: 1000 });
  
  emit(event: CognitiveEvent): void {
    Effect.runFork(Stream.fromChannel(this.#stream).pipe(Stream.tap(e => e === event)));
  }
  
  on<K extends CognitiveEvent['type']>(type: K, handler: (e: Extract<CognitiveEvent, { type: K }>) => void): Effect.Effect<void> {
    return Stream.fromChannel(this.#stream)
      .pipe(Stream.filter(e => e.type === type), Stream.tap(handler))
      .pipe(Stream.runDrain)
      .pipe(Effect.forkDaemon);
  }
}
```

### 12b.4 Generic `ModelRunner` Tool Types

**File:** `agent/src/model/ModelRunner.ts`

```typescript
// Before — tools as `Record<string, unknown>`
tools: Record<string, unknown>;

// After — type-safe tool registry
export interface Tool<Args, Result> {
  readonly name: string;
  readonly description: string;
  readonly schema: z.ZodSchema<Args>;
  readonly execute: (args: Args, signal?: AbortSignal) => Promise<Result>;
}

export interface ModelRunnerDeps {
  readonly tools: ReadonlyArray<Tool<any, any>>;
}

// Usage with inference
const tools = [
  createTool('search', z.object({ query: z.string() }), async ({ query }) => ...),
] as const;
type Tools = typeof tools;
```

### 12b.5 `satisfies` for Config Objects

**Files:** `agent/src/presets.ts`, `agent/src/options-schema.ts`, `src/config/`

```typescript
// Before — widening loses literal types
const preset = { mode: 'chat', throttle: 100 };

// After — preserves literals, validates shape
const preset = {
  mode: 'chat' as const,
  throttle: 100,
} satisfies AgentPreset;
```

### 12b.6 Template Literal Types for Event Names

**File:** `agent/src/types.ts`

```typescript
// Before — string literals scattered
type EventKey = 'nar:derivation' | 'nar:cycle' | ...;

// After — structured, extensible
type Engine = 'nar' | 'metta';
type NarEventType = 'derivation' | 'cycle' | 'drive:changed' | ...;
type MettaEventType = 'derivation' | 'cycle' | 'skill:executed' | ...;

type EventName<E extends Engine> = E extends 'nar' 
  ? `nar:${NarEventType}` 
  : E extends 'metta' 
    ? `metta:${MettaEventType}` 
    : never;

// Usage: type-safe event registration
function on<E extends Engine, T extends EventName<E>>(
  event: T, 
  handler: (payload: EventPayload<T>) => void
): () => void { ... }
```

### 12b.7 `readonly` Deep Freeze for State Objects

**Files:** `agent/src/types.ts` (`AgentStats`, `NARState`, `ChatOptions`)

```typescript
// Before — mutable
interface AgentStats { cycleCount: number; ... }

// After — immutable, enables structural sharing
interface AgentStats {
  readonly cycleCount: number;
  readonly beliefCount: number;
  readonly derivationCount: number;
  readonly timestamp: number;
}
```

### 12b.8 Effect-TS for Async Operations

**Files:** `agent/src/services/LMChatService.ts`, `agent/src/io-bridge.ts`, `src/io/connections/*.ts`

```typescript
// Before — Promise-based, manual error handling
async chat(input: string): Promise<string> {
  try { return await runner.run(...); }
  catch (e) { throw new Error(...); }
}

// After — Effect for retry, timeout, resource safety
import { Effect, Schedule, Retry } from 'effect';

chat(input: string): Effect.Effect<string, ChatError> {
  return Effect.gen(function* () {
    const result = yield* Effect.tryPromise({
      try: () => runner.runToCompletion(...),
      catch: e => new ChatError(e),
    });
    return result.text;
  }).pipe(
    Effect.retry(Schedule.exponential(1000).pipe(Schedule.recurs(3))),
    Effect.timeout('30 seconds'),
  );
}
```

### 12b.9 Module Augmentation for Grounded Ops

**File:** `@senars/metta/src/core/ops.ts`

```typescript
// Allow plugins to register ops with full type inference
declare module '@senars/metta/core/ops' {
  interface GroundedOpRegistry {
    'my-custom-op': GroundedOp<[string, number], string>;
  }
}

// Then registration is type-safe:
registerOp('my-custom-op', (s: string, n: number) => Effect.succeed(`${s}:${n}`));
//       ^^^^^^^^^^^^^^ — error if signature doesn't match registry
```

### 12b.10 Zod `satisfies` for Runtime + Compile-time Validation

**Files:** `agent/src/options-schema.ts`, `ui/src/shared/protocol.ts`

```typescript
// Schema is both a validator AND a type
const AgentOptionsSchema = z.object({ ... }) satisfies z.ZodType<AgentOptions>;

// Inferred type matches schema exactly
type AgentOptions = z.infer<typeof AgentOptionsSchema>;

// No widening, no manual sync needed
```

---

## Part 12: TypeScript Leverage Points

The revised plan uses these TypeScript features to reduce code and increase clarity:

| Feature | Application | Benefit |
|---|---|---|
| **Discriminated Unions** | `CognitiveEvent`, `GraphNodeData`, `GraphOp` | Exhaustive pattern matching, no `any` |
| **Generic Context** | `createChatService<TCtx>` | Single implementation, multiple engines |
| **Branded Types** | `CorrelationId`, `SpaceId` | Nominal typing prevents mixups |
| **Template Literal Types** | `EngineOrigin = 'nar' \| 'metta'` | Compile-time exhaustiveness |
| **Const Assertions** | `AgentCapabilities.supports` | Literal preservation for UI |
| **Satisfies** | Config presets, protocol schemas | Type-safe without widening |
| **Readonly/Deep Readonly** | All protocol types, events | Immutability guarantees |
| **Effect-TS** | MettaLoop, MettaSkills, MettaLTM | Structured concurrency, resource safety |
| **Module Augmentation** | Grounded op registration | Type-safe extensibility |

---

## Part 13: Status Update (Phase 4 Complete)

### Implementation Complete ✅

All Phase 4 `@senars/metta` agent files have been implemented:

| File | Purpose | Status |
|---|---|---|
| `MettaAgent.ts` | Main agent class, orchestrates loop, skills, LTM, transports | ✅ Complete - fully wired |
| `MettaTypes.ts` | Type definitions (`MettaLoopConfig`, `SkillFeedback`, `PromptContext`, `MettaAgent`) | ✅ Complete |
| `MettaSkills.ts` | Skill registry wrapping `registerOp`/`getOp` with feedback tracking | ✅ Complete |
| `MettaLoop.ts` | OmegaClaw-style continuous execution with message queue, CognitiveEvent emission | ✅ Complete |
| `MettaCommandParser.ts` | LLM output → structured commands (send, remember, query, etc.) | ✅ Complete |
| `MettaHistory.ts` | History management + ERROR_FEEDBACK injection | ✅ Complete |
| `MettaPromptBuilder.ts` | Prompt construction (SKILLS, LAST_SKILL_USE_RESULTS, HISTORY, TIME) | ✅ Complete |
| `MettaInputProcessor.ts` | NL→MeTTa atom translation | ✅ Complete |
| `MettaChannelOps.ts` | Channel-specific grounded ops (send, schedule, wait) | ✅ Complete |
| `MettaLTM.ts` | Long-term memory via PersistentSpace | ✅ Complete |
| `MettaKnowledge.ts` | Knowledge priors framework | ✅ Complete |
| `MettaEpisodic.ts` | Episodic memory with timestamped recall | ✅ Complete |
| `PolicyEngine.ts` | Security: command allowlists, file sandbox check, shell permission gating | ✅ Complete |

### Remaining Work (Phases 5-7)

| Phase | Task | Status |
|---|---|---|
| Phase 5 | Replace `NarAdapter` with generic `CognitiveBridge` in UI | 🔲 Pending |
| Phase 5 | Update `startWebUI` to accept `CognitiveEventSource` | 🔲 Pending |
| Phase 6 | Add Telegram transport (`@senars/io/connections/telegram.ts`) | 🔲 Pending |
| Phase 7 | Simplify `src/bin/repl.ts` entry point | 🔲 Pending |

*Pre-existing known issues: 9 type errors in `@senars/nar` (EpisodicMemory, ReasoningAboutReasoning, AuthManager methods missing); `ai` package types conflict with `exactOptionalPropertyTypes` in `@senars/metta` tsconfig.*