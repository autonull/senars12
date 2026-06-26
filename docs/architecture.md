# SeNARS Architecture

> Core subsystems manifest. **Do not delete without review.**

This document is a safety net against the silent-loss pattern that destroyed the prior agent in commit `69dc3dd`. The
eight subsystems below are the load-bearing pillars of the v6 harness. If a refactor removes or replaces any of them,
update this file in the same commit and call it out in the commit message.

## Core Subsystems (Do Not Delete Without Review)

### 1. Agent (`src/agent/agent.ts`, `src/agent/index.ts`)

The `createAgent()` factory. Public surface: `chat`, `chatWithHistory`,
`believe`, `know*`, `recall`, `start/stop`. Owns the reasoning throttle and the LM/NAR dispatch loop. v6 (NEXT5) —
additive, must stay.

### 2. NAR (`src/nar/nar.ts`, `src/nar/factory.ts`)

The reasoning kernel. `SeNARSFactory.createDefault()` and
`SeNARSFactory.createForTesting()` are the only sanctioned construction paths. Methods `believe`, `question`, `goal`,
`ask`, `run`,
`getBeliefs`, `attentionReport` are part of the public NAR surface.

### 3. IO Bridge (`src/agent/io-bridge.ts`, `src/agent/io-middleware.ts`)

The middleware chain that connects any `Connection` to the agent. v6 (NEXT6) — wires IRC, CLI, WS, HTTP, MCP into a
single `MessageRouter`.
`bindAgentToConnection()` is the entry point.

### 4. Connection Layer (`src/io/connections/*.ts`, `src/io/connection-manager.ts`)

Five transports: `CLIConnection`, `IRCConnection`, `WSConnection`,
`HTTPConnection`, `MCPConnection`. All implement `Connection`. Managed by `ConnectionManager` via factories.

### 5. Session Layer (`src/agent/ConversationSession.ts`, `src/agent/SessionManager.ts`)

Per-origin conversation state with TTL eviction and JSONL persistence.
`JsonlSessionManager` and `InMemorySessionManager` are both required (the former for restart-survival, the latter for
tests).

### 6. NL Bridge (`src/agent/nl-bridge.ts`, `src/nar/nl/*.ts`)

Bidirectional NL ↔ Narsese translation. The 1142 lines of NL infrastructure in `src/nar/nl/` (NLTranslator,
ResultInterpreter, NLAnalyzer, ClarificationHandler) are wrapped by `createNlBridge()` and exposed as middleware, not as
agent methods.

### 7. Episodic Memory (`src/nar/memory/EpisodicMemory.ts`)

The chronological log. JSONL files by date. Backed by disk; survives restarts. Used by `/episodes` and as context for
the LM.

### 8. Command Registry (`src/io/commands/registry.ts`, `src/io/commands/*.ts`)

Operator commands (`/help`, `/stats`, `/episodes`, `/auth`, etc.) — 50+ commands across 10 files. Wired through the
bridge as
`createCommandInterceptor` middleware.

## Bridges Between Layers

| Bridge           | File                                   | Notes                                           |
|------------------|----------------------------------------|-------------------------------------------------|
| Agent ↔ LM       | `src/agent/model/ModelRunner.ts`       | Tool-calling LM loop                            |
| Agent ↔ NAR      | `src/agent/agent.ts` (tryParseNarsese) | Direct NAR input for Narsese; LM path otherwise |
| IO ↔ Agent       | `src/agent/io-bridge.ts`               | Middleware chain                                |
| NL ↔ Narsese     | `src/agent/nl-bridge.ts`               | Translation at IO boundary, not in agent        |
| Sessions ↔ Agent | `src/agent/agent.ts` (chatWithHistory) | History-aware dispatch                          |

## Out of Scope (NEXT6)

The following are explicitly **not** part of v6 and were intentionally left out of the bridge:

- Cognitive cycle (`src/agent/cycle/*`, ~800 lines)
- Cognition modules (WorkingMemory, EpisodeRunner, ~1100 lines)
- Request pipeline (~400 lines)
- Scenarios / Experiments (~900 lines)
- TUI (~200 lines)
- Voice / video

Restoration of any of these is a NEXT7+ task.

## File Counts

| Layer                                   | Files     | Lines (approx) |
|-----------------------------------------|-----------|----------------|
| Agent (v6)                              | 8         | ~700           |
| NAR + LM                                | 50+       | ~6000          |
| IO (transports + commands + middleware) | 25        | ~2500          |
| Bridge (NEW in NEXT6)                   | 8         | ~1200          |
| Tests                                   | 38 suites | 716 tests      |
