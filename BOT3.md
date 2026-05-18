# SeNARS Bot Plan — Phase 3: REPL, IRC & Agent Overhaul

## Goal

Deliver a complete, ergonomic, dual-mode CLI that works identically for **interactive TTY** users and **piped stdin/stdout** automation (AI coding agents, CI, scripts). All BOT.md/BOT2.md commands and subsystems must be fully wired and testable.

**Additionally**: Replace Agent's middleware-based message handling with a unified `processMessage()` system that all channels (REPL, IRC, WS, HTTP, MCP) and the AgenticLoop use. Enhance NAR with `WorkingMemory` as a first-class memory tier. Enable both reactive (channel-driven) and autonomous (self-initiated) behavior.

## Problem Statement

### REPL Gaps

Three REPL implementations exist with overlapping, incomplete functionality:

| REPL | TTY | Pipe | Commands | LM | Status |
|------|-----|------|----------|----|--------|
| `repl-ink.tsx` | Ink/React | Broken | Hardcoded stubs | No ChatResponder | ❌ |
| `repl.ts` | readline | Works | Core only | No ChatResponder | ⚠️ |
| `repl-blessed.ts` | blessed | Partial | Hardcoded stubs | No ChatResponder | ⚠️ |

### IRC Gaps

| Capability | REPL | IRC | BOT2.md Spec | Status |
|-----------|------|-----|-------------|--------|
| ChatResponder (LM responses) | ❌ | ❌ | §1.4 | Missing from both |
| SkillCatalog in prompt | ❌ | ❌ | §1.3 | Missing from both |
| WorkingMemory (.pin/.recall) | ❌ | ❌ | §1.2 | Missing from both |
| ResponseInterpreter (action extraction) | ❌ | ❌ | §1.4 | Missing from both |
| LastResults (multi-cycle context) | ❌ | ❌ | §1.13 | Missing from both |
| ResponseFormatter (IRC 400-char limit) | N/A | ❌ | §1.10 | Missing |
| BotProfile (join message, personality) | N/A | ❌ | §1.8 | Missing |
| ChannelBehavior (per-channel policy) | N/A | ❌ | §1.8 | Missing |
| ConversationManager (per-user context) | N/A | ❌ | §1.9 | Missing |
| DegradationManager (LM fallback) | ❌ | ❌ | §1.11 | Missing from both |

### AgenticLoop Gaps

The existing `AgenticLoop` (src/agent/AgenticLoop.ts) has infrastructure but is incomplete:

| Capability | Status | Gap |
|-----------|--------|-----|
| MessageQueue | Exists | Channels never push messages into it |
| setMessageHandler | Exists | bot.ts never wires Agent.router to it |
| start() | Exists | bot.ts never calls it |
| wakeupSequence | Stub | Only runs nar.run(), no LM enrichment, self-analysis, consolidation |
| EpisodicMemory logging | Partial | Only logs input, not responses |
| AgenticLoop ↔ Agent | Disconnected | Loop has its own NAR ref, Agent has its own — not shared |

**Root cause**: `Agent.setupMiddleware()` has 4 hardcoded middleware layers that each channel duplicates or partially implements. The AgenticLoop uses a separate NAR instance. Replace with a single `processMessage()` entry point that both channels and the loop use.

## Design Principles

1. **Pipe-first**: Pipe mode is the canonical interface; TTY decorates it with UI chrome
2. **Unified message handling**: One `processMessage()` replaces middleware — all channels and AgenticLoop call it
3. **NAR owns WorkingMemory**: WorkingMemory is a memory tier on NAR, not a separate Agent component
4. **Registry-driven**: Zero hardcoded command handling — all dot-commands flow through `CommandRegistry`
5. **Channel-aware**: Responses are formatted per-channel (IRC 400-char, WS full markdown, CLI plain text)
6. **Deterministic pipe output**: Same input → same output (no timestamps, no random IDs in pipe mode)
7. **Non-blocking init**: NAR initializes in background; pipe mode queues input until ready
8. **Reactive + autonomous**: Channels drive reactive responses; AgenticLoop drives self-initiated work

## Scope

| Component | Spec | Status | Action |
|-----------|------|--------|--------|
| `ChatResponder` | BOT.md §Current | Exists | Wire into Agent, inject SkillCatalog/LastResults |
| `SkillCatalog` | BOT2.md §1.3 | Exists | Wire into ChatResponder + REPL help |
| `WorkingMemory` | BOT2.md §1.2 | Exists | Move to NAR as memory tier |
| `LastResults` | BOT2.md §1.13 | Exists | Wire into ChatResponder + REPL `.last` |
| `ResponseInterpreter` | BOT2.md §1.4 | Exists | Wire into Agent message flow, configurable extraction |
| `DegradationManager` | BOT2.md §1.11 | Exists | Wire into Agent init + status |
| `ResponseFormatter` | BOT2.md §1.10 | Exists | Wire into Agent per-channel formatting |
| `BotProfile` | BOT2.md §1.8 | Exists | Wire into IRC join + all channel greetings |
| `ChannelBehavior` | BOT2.md §1.8 | Exists | Wire per-connection policies |
| `ConversationManager` | BOT2.md §1.9 | Exists | Wire per-user context for IRC + WS |
| `ScenarioRunner` | BOT2.md §2.2 | Pending | Wire commands when available |
| `EpisodicMemory` | BOT.md §Phase 3 | Exists | Wire into AgenticLoop + `.episodes` command |
| `AgenticLoop` | BOT.md §Phase 4 | Exists (incomplete) | Wire to Agent.processMessage(), enhance wakeup |
| `MessageQueue` | BOT.md §Phase 4 | Exists | Wire channels to push messages |

## Architecture

```
Agent (config-driven, owns all subsystems)
├── nar: NAR (includes workingMemory as memory tier)
├── chatResponder: ChatResponder
├── responseInterpreter: ResponseInterpreter (configurable extraction)
├── degradationManager: DegradationManager
├── responseFormatter: ResponseFormatter
├── botProfile: BotProfile
├── channelBehaviors: Map<connectionId, ChannelBehavior>
├── conversationManager: ConversationManager
├── commands: CommandRegistry
├── manager: ConnectionManager
├── lastResults: LastResults
└── processMessage(text, ChannelContext) → Promise<ChannelResponse>
    │
    └── Unified pipeline (replaces middleware):
        1. Auth check
        2. Classify input → command | belief | question | goal | chat
        3. Route to handler
        4. Format response per-channel
        5. Record in LastResults + ConversationManager
        6. Return ChannelResponse

AgenticLoop (owns the autonomous cycle)
├── queue: MessageQueue (channels push IOMessages here)
├── agent: Agent (shared reference)
├── episodicMemory: EpisodicMemory
├── config: AgenticLoopConfig
│
├── runLoop()
│   ├── drain queue → agent.processMessage() for each
│   ├── if idle: wakeupSequence()
│   │   ├── nar.run(reasoningSteps)
│   │   ├── LM enrichment (if enabled)
│   │   ├── memory consolidation
│   │   ├── self-analysis (SelfAnalyzer)
│   │   ├── episodic memory pattern check
│   │   └── pending benchmark/experiment check
│   └── sleep → recurse
│
└── Channels → queue.push(message) → loop processes

Channel adapters (one per connection type):
├── REPLPipeAdapter    — stdin/stdout line protocol
├── REPLTTYAdapter     — Ink React UI (no queue, direct processMessage)
├── IRCAdapter         — IRC with 400-char chunking, join messages, address detection
├── WSAdapter          — WebSocket with full markdown
├── HTTPAdapter        — HTTP request/response
└── MCPAdapter         — MCP tool/resource protocol
```

### Agent Configuration

**File**: `src/agent/Agent.ts` — **MODIFY**

```typescript
interface AgentConfig {
  nar: NAR;
  logger?: Logger;
  chatResponder?: ChatResponderConfig | false;  // default: ChatResponderConfig
  skillCatalog?: boolean;                        // default: true
  responseInterpreter?: ResponseInterpreterConfig | false;  // default: {mode: 'explicit'}
  degradationManager?: boolean;                  // default: true
  responseFormatter?: boolean;                   // default: true
  botProfile?: BotProfileConfig;                 // default: {name: 'SeNARS'}
  conversationManager?: boolean;                 // default: true
  lastResults?: LastResultsConfig;               // default: {maxRecent: 5}
}

class Agent {
  constructor(config: AgentConfig);

  async processMessage(text: string, ctx: ChannelContext): Promise<ChannelResponse>;
  getSnapshot(): StatusSnapshot;
  // ... existing methods (getNAR, getCommands, addConnection, etc.)
}
```

All subsystems have sensible defaults. Pass `false` to disable.

### Unified Message Pipeline

`processMessage()` replaces `setupMiddleware()`. The pipeline:

```
processMessage(text, ctx)
  ├── 1. Auth: checkAuth(ctx.connectionId, ctx.sender, text)
  ├── 2. Classify: classifyInput(text) → command | belief | question | goal | chat
  ├── 3. Route:
  │   ├── command → commands.execute(name, args, {nar, connection, manager, workingMemory: nar.workingMemory})
  │   ├── belief → nar.input(text) + nar.run(3)
  │   ├── question → nar.question(text) + nar.run(5)
  │   ├── goal → nar.goal(text) + nar.run(3)
  │   └── chat → chatResponder.respond(text) → responseInterpreter.interpret()
  ├── 4. Format: responseFormatter.forChannel(ctx.connectionType, response)
  ├── 5. Record: lastResults.record(), conversationManager.addResponse()
  └── 6. Return: ChannelResponse
```

### NAR with WorkingMemory

**File**: `src/nar/nar.ts` — **MODIFY**

`WorkingMemory` becomes a memory tier on NAR alongside Focus, Concepts, Archive:

```
NAR Memory
├── WorkingMemory (pinned values, fast access, no decay)
├── Focus (high-attention concepts)
├── Concepts (active knowledge)
└── Archive (decayed/low-priority)
```

NAR exposes: `nar.workingMemory.pin()`, `nar.workingMemory.recall()`, etc.
Commands access via `ctx.nar.workingMemory`.

### ResponseInterpreter (Configurable)

**File**: `src/agent/ResponseInterpreter.ts` — **NEW**

Extraction is configurable — doesn't auto-believe arbitrary Narsese-like text:

```typescript
interface ResponseInterpreterConfig {
  extractionMode: 'none' | 'explicit' | 'narsese' | 'all';
  // 'none' — never extract
  // 'explicit' — only extract from marked patterns: [BELIEVE: ...], [TOOL: ...]
  // 'narsese' — extract Narsese at line boundaries (more aggressive)
  // 'all' — extract anything that looks like an action

  trustedSources?: string[];        // LM outputs from specific models
  directivePatterns?: RegExp[];     // Custom extraction patterns
}
```

Default: `'explicit'` mode — only extracts from marked patterns like `[BELIEVE: (cat --> animal).]`.

### AgenticLoop Integration

**File**: `src/agent/AgenticLoop.ts` — **MODIFY**

```typescript
class AgenticLoop {
  constructor(
    agent: Agent,              // shared Agent, not separate NAR
    episodicMemory?: EpisodicMemory,
    config?: AgenticLoopConfig
  );

  start(): void;
  stop(): void;
  pushMessage(message: IOMessage): void;   // channels call this

  private async runLoop(): Promise<void>;
  private async processMessages(messages: IOMessage[]): Promise<void>;
  private async wakeupSequence(): Promise<void>;
}
```

**Key changes**:
- Constructor takes `Agent` (shared), not separate `NAR`
- `processMessages()` calls `agent.processMessage()` instead of custom handler
- `wakeupSequence()` enhanced:

```
wakeupSequence():
  1. nar.run(config.reasoningStepsPerWake)
  2. LM enrichment (LMRule, if enabled)
  3. memory consolidation (nar.consolidate())
  4. self-analysis (agent.getSelfAnalyzer()?.analyzeReasoningGaps())
  5. episodic memory pattern check (episodicMemory?.getEpisodes(last24h))
  6. pending benchmark/experiment check (ScenarioRunner/ExperimentRunner if available)
  7. Log wakeup activity to episodic memory
```

**Channel → AgenticLoop wiring** (in bot.ts):

```typescript
// IRC channel
ircConnection.onMessage(async (message) => {
  const ioMessage: IOMessage = {id: ..., source: 'irc', sender: nick, text: ..., timestamp: Date.now()};
  agenticLoop.pushMessage(ioMessage);
});

// WS channel
wsConnection.onMessage(async (message) => {
  agenticLoop.pushMessage(message);
});

// HTTP channel
httpServer.onRequest(async (req) => {
  agenticLoop.pushMessage(req.message);
});

// MCP channel
mcpServer.onMessage(async (message) => {
  agenticLoop.pushMessage(message);
});
```

**REPL exception**: REPL doesn't use AgenticLoop — it calls `agent.processMessage()` directly (interactive, not autonomous).

### Channel Adapter Pattern

Each channel adapter:
1. Receives raw messages from its connection
2. Creates `IOMessage` and pushes to `AgenticLoop.queue` (or calls `agent.processMessage()` directly for REPL)
3. `AgenticLoop` drains queue → calls `agent.processMessage(text, channelContext)`
4. Response formatted via `agent.responseFormatter.forChannel(type)`
5. Sent back via the connection's `respond()` function

## Pipe Mode Protocol

### Line Protocol

```
Input (stdin):
(cat --> animal).
What is a cat?
.run 5
.pin species cat
.quit

Output (stdout):
> (cat --> animal).
< Added: (cat --> animal). (derived 2)
> What is a cat?
< SeNARS: A cat is a type of animal.
> .run 5
< Ran 5 step(s), derived 3 belief(s)
> .pin species cat
< Pinned species = cat
> .quit
< Goodbye.
```

### Prefixes

| Prefix | Stream | Meaning |
|--------|--------|---------|
| `> ` | stdout | Echoed input |
| `< ` | stdout | System response |
| `! ` | stderr | Error |
| `# ` | stdout | Structured metadata (JSON, `--json` mode only) |

### JSON Mode (`--json`)

```json
# {"type":"belief","input":"(cat --> animal).","beliefs":5,"tasks":0,"derivations":8,"turn":1}
# {"type":"chat","input":"What is a cat?","lm":"available","turn":2}
# {"type":"command","input":".run 5","result":"Ran 5 step(s), derived 3 belief(s)","turn":3}
```

### CLI Flags

| Flag | Mode | Effect |
|------|------|--------|
| `--json` | pipe | Emit `# ` metadata lines |
| `--quiet` | pipe | Suppress `> ` input echo |
| `--no-init` | pipe | Suppress startup message |
| `--timeout <ms>` | pipe | Exit after N ms of idle (CI use) |
| `--max-turns <n>` | pipe | Exit after N inputs (CI use) |

### Edge Cases

- **Multi-line buffering**: Incomplete Narsese (open `(` without `)`) or JSON (open `{` without `}`) buffered until closing character. Blank line flushes buffer. 10s timeout discards buffer.
- **SIGPIPE**: Exit cleanly with code 0
- **Empty lines**: Silently ignored
- **Binary input**: Detected and rejected with `! Binary input not supported`
- **EOF without `.quit`**: Treated as `.quit`, exit code 0
- **Init in progress**: Input queued, processed after Agent ready

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Clean exit (`.quit`, EOF, or `--timeout`/`--max-turns`) |
| 1 | Runtime error |
| 2 | Invalid input (recoverable, continues processing) |

## TTY Mode

Ink-based UI (refactored from `repl-ink.tsx`, driven by `Agent`):

- **Header**: title, LM status, degradation state
- **Message area**: color-coded Narsese, tables for stats, scrollable
- **Input bar**: tab completion (commands + terms), up/down history, syntax hint
- **Status bar**: beliefs, tasks, attention, WM keys, turn count, processing indicator

## IRC Enhancements

### ResponseFormatter for IRC

**File**: `src/agent/ResponseFormatter.ts` — **NEW** (BOT2.md §1.10)

```typescript
class ResponseFormatter {
  forIRC(text: string): string[] {
    const cleaned = stripMarkdown(text);
    return splitIntoChunks(cleaned, 400);
  }
  forWS(text: string): string { return text; }
  forCLI(text: string): string { return text; }
}
```

### BotProfile for IRC

**File**: `src/agent/BotProfile.ts` — **NEW** (BOT2.md §1.8)

```typescript
class BotProfile {
  name = 'SeNARS';
  joinMessage = 'SeNARS online. Tell me facts (.) or ask questions (?). Type .help for commands.';
}
```

**IRC integration**: On channel join, send `BotProfile.joinMessage`.

### ChannelBehavior for IRC

**File**: `src/agent/ChannelBehavior.ts` — **NEW** (BOT2.md §1.8)

```typescript
class ChannelBehavior {
  maxResponseLength: number = 400;
  perUserContext: boolean = true;
  showReasoning: boolean = false;
  responseMode: 'conversational' | 'narsese' | 'hybrid' = 'conversational';
}
```

### ConversationManager for IRC

Per-user conversation context (BOT2.md §1.9).

### IRC Address Detection

1. **Direct PM**: Always process.
2. **Channel message**: Only process if message starts with bot nick (`SeNARS: ...`). Nick prefix is stripped before processing.

### IRC Message Flow (After)

```
IRC message → IRCAdapter
  ├── shouldProcess() → PM: always, channel: only if @bot mentioned
  ├── stripNickPrefix() → clean text
  ├── BotProfile: join message on channel join
  ├── ChannelBehavior: apply policies
  ├── ConversationManager: per-user context
  ├── AgenticLoop.pushMessage() → queue → agent.processMessage()
  ├── ResponseFormatter.forIRC() → 400-char chunks
  └── ircConnection.send() → flood-protected delivery
```

## Implementation Plan

### 3.1: NAR WorkingMemory Integration

**File**: `src/nar/nar.ts` — **MODIFY**

Add `workingMemory: WorkingMemory` as a field. Constructor creates it. Exposes pin/recall/unpin.

### 3.2: OutputFormatter Interface + PipeOutput

**File**: `src/cli/OutputFormatter.ts` — **NEW**
**File**: `src/cli/PipeOutput.ts` — **NEW**

### 3.3: Agent Subsystems

**Files**: `src/agent/ResponseFormatter.ts`, `BotProfile.ts`, `ChannelBehavior.ts`, `ConversationManager.ts`, `DegradationManager.ts`, `ResponseInterpreter.ts` — all **NEW**

### 3.4: ChatResponder Modifications

**File**: `src/agent/ChatResponder.ts` — **MODIFY**

Add optional params: `skillCatalog`, `lastResults`, `degradationManager`.

### 3.5: Agent Unified Pipeline

**File**: `src/agent/Agent.ts` — **MODIFY**

Replace `setupMiddleware()` with `processMessage()`. Add `AgentConfig` constructor.

### 3.6: AgenticLoop Integration

**File**: `src/agent/AgenticLoop.ts` — **MODIFY**

Constructor takes `Agent` (not separate NAR). `processMessages()` calls `agent.processMessage()`. Enhanced `wakeupSequence()`.

### 3.7: Wire Commands

| Module | Gap | Fix |
|--------|-----|-----|
| `config.ts` | Stub | Wire `nar.setConfig()` / `nar.getConfig()` |
| `scenario.ts` | `.pin/.recall/.unpin` | Access via `ctx.nar.workingMemory` |
| `memory.ts` | Missing `.concepts <filter>` | Add filter |

**New**: `src/io/commands/episodes.ts` — `.episodes [n]`

### 3.8: IRC Adapter

**File**: `src/io/adapters/irc-adapter.ts` — **NEW**

### 3.9: Wire bot.ts

**File**: `src/bin/bot.ts` — **MODIFY**

```typescript
// Create shared Agent with all subsystems
const agent = new Agent({
  nar,
  chatResponder: {registry: createSeNARSRegistry()},
  responseInterpreter: {extractionMode: 'explicit'},
  botProfile: {name: 'SeNARS'},
});
await agent.start();

// Create AgenticLoop with shared Agent
const agenticLoop = new AgenticLoop(agent, episodicMemory);

// Wire channels to AgenticLoop
ircConnection.onMessage((msg) => agenticLoop.pushMessage(msg));
wsConnection.onMessage((msg) => agenticLoop.pushMessage(msg));
httpServer.onRequest((req) => agenticLoop.pushMessage(req.message));

// Set message handler for loop to process through Agent
agenticLoop.setMessageHandler(async (msg) => {
  const ctx = {
    connectionId: msg.source,
    connectionType: msg.source as ChannelType,
    sender: msg.sender,
    respond: (text) => agent.getConnection(msg.source)?.send(msg.sender, text),
  };
  const response = await agent.processMessage(msg.text, ctx);
  // Format per-channel
  const formatted = agent.responseFormatter.forChannel(ctx.connectionType, response.text);
  await agent.getConnection(msg.source)?.send(msg.sender, formatted);
});

// Start autonomous loop
agenticLoop.start();
```

### 3.10: TTYOutput (Ink)

**File**: `src/cli/TTYOutput.tsx` — **NEW**

### 3.11: Unified Entry Point

**File**: `src/cli/repl.ts` — **MODIFY**

REPL calls `agent.processMessage()` directly (no AgenticLoop).

### 3.12: Cleanup

**Remove**: `src/cli/repl-ink.tsx`, `src/cli/repl-blessed.ts`

**Update** `package.json`:
```json
{
  "scripts": {
    "repl": "NODE_NO_WARNINGS=1 tsx src/cli/repl.ts",
    "repl:ink": "NODE_NO_WARNINGS=1 tsx src/cli/repl.ts",
    "repl:pipe": "NODE_NO_WARNINGS=1 tsx src/cli/repl.ts --json"
  },
  "bin": { "senars": "./dist/cli/repl.js" }
}
```

## File Change Summary

| File | Action | Description |
|------|--------|-------------|
| `src/nar/nar.ts` | **MODIFY** | Add workingMemory field |
| `src/agent/Agent.ts` | **MODIFY** | Config constructor, processMessage() replaces middleware |
| `src/agent/AgenticLoop.ts` | **MODIFY** | Takes Agent, enhanced wakeup, processMessages via agent |
| `src/agent/ChatResponder.ts` | **MODIFY** | Add SkillCatalog, LastResults, DegradationManager |
| `src/agent/ResponseFormatter.ts` | **NEW** | Per-channel formatting |
| `src/agent/BotProfile.ts` | **NEW** | Bot identity, join messages |
| `src/agent/ChannelBehavior.ts` | **NEW** | Per-channel policies |
| `src/agent/ConversationManager.ts` | **NEW** | Per-user conversation context |
| `src/agent/ResponseInterpreter.ts` | **NEW** | Configurable action extraction |
| `src/agent/DegradationManager.ts` | **NEW** | LM fallback |
| `src/io/adapters/irc-adapter.ts` | **NEW** | IRC + Agent integration |
| `src/cli/OutputFormatter.ts` | **NEW** | REPL output interface |
| `src/cli/PipeOutput.ts` | **NEW** | Pipe mode formatter |
| `src/cli/TTYOutput.tsx` | **NEW** | Ink UI |
| `src/cli/repl.ts` | **MODIFY** | Unified entry point |
| `src/cli/repl-ink.tsx` | **REMOVE** | Replaced |
| `src/cli/repl-blessed.ts` | **REMOVE** | Redundant |
| `src/io/commands/config.ts` | **MODIFY** | Wire to nar.setConfig/getConfig |
| `src/io/commands/scenario.ts` | **MODIFY** | Use nar.workingMemory |
| `src/io/commands/episodes.ts` | **NEW** | .episodes command |
| `src/io/commands/memory.ts` | **MODIFY** | Add .concepts filter |
| `src/bin/bot.ts` | **MODIFY** | Wire Agent + AgenticLoop + IRC adapter |
| `package.json` | **MODIFY** | Update scripts, add senars bin |
| `tests/cli/repl-pipe.test.ts` | **NEW** | Pipe mode tests |
| `tests/agent/agent-process.test.ts` | **NEW** | processMessage() tests |
| `tests/agent/agentic-loop.test.ts` | **NEW** | AgenticLoop integration tests |
| `tests/io/irc-adapter.test.ts` | **NEW** | IRC adapter tests |
| `tests/cli/repl-commands.test.ts` | **MODIFY** | Update for unified CLI |

## Execution Order

| Step | Component | Dependencies | Parallel? |
|------|-----------|-------------|-----------|
| 1 | NAR WorkingMemory | None | Yes |
| 2 | OutputFormatter + PipeOutput | None | Yes |
| 3 | ResponseFormatter + BotProfile + ChannelBehavior | None | Yes |
| 4 | ConversationManager + DegradationManager | None | Yes |
| 5 | ChatResponder modifications | None | Yes |
| 6 | ResponseInterpreter | None | Yes |
| 7 | Agent unified pipeline (processMessage) | 1-6 | After 1-6 |
| 8 | AgenticLoop integration | 7 | After 7 |
| 9 | Command wiring (config, episodes, scenario) | 7 | After 7 (parallel with 8) |
| 10 | IRC adapter | 3, 4, 7 | After 3, 4, 7 |
| 11 | bot.ts wiring | 7, 8, 10 | After 7, 8, 10 |
| 12 | TTYOutput (Ink) | 7 | After 7 (parallel with 8-11) |
| 13 | Unified repl.ts | 7, 12 | After 7, 12 |
| 14 | Remove old REPLs | 13 | After 13 |
| 15 | Tests | All | After 14 |

Steps 1-6 are independent. Steps 8, 9, 10, 12 can run in parallel after step 7.

## Pipe Mode Testing Protocol

```bash
# Basic belief + reasoning
echo -e "(cat --> animal).\n.run 5\n.stats\n.quit" | npm run repl:pipe

# JSON mode
echo -e "(cat --> animal).\n.stats\n.quit" | npm run repl:pipe -- --json | grep '^# ' | jq

# Working memory
echo -e ".pin species cat\n.recall species\n.unpin\n.quit" | npm run repl:pipe

# CI: timeout after 30s
echo -e ".run 100\n.quit" | npm run repl:pipe -- --timeout=30000

# CI: max 10 turns
echo -e ".run 1\n.run 1\n.run 1\n.quit" | npm run repl:pipe -- --max-turns=10
```

## Backward Compatibility

| Script | Mode | Notes |
|--------|------|-------|
| `npm run repl` | TTY | Same as before, but functional |
| `npm run repl:ink` | TTY | Alias |
| `npm run repl:pipe` | Pipe + JSON | New |
| `senars` (bin) | Auto-detected | New |

## Reactive vs Autonomous Behavior

| Mode | Trigger | Path | Example |
|------|---------|------|---------|
| **Reactive** | Channel message | IRC/WS/HTTP/MCP → AgenticLoop.queue → agent.processMessage() | User asks "What is a cat?" on IRC |
| **Reactive** | REPL input | stdin → agent.processMessage() (direct, no loop) | User types `(cat --> animal).` in REPL |
| **Autonomous** | AgenticLoop wakeup | timer → wakeupSequence() → nar.run() + self-analysis + consolidation | Bot reasons about beliefs while idle |
| **Autonomous** | AgenticLoop idle drain | queue empty → idle counter → wakeup | Bot runs self-analysis after 50 idle turns |

## IRC After This Plan

| Capability | Before | After |
|-----------|--------|-------|
| LM-powered responses | ❌ | ✅ ChatResponder |
| Skill awareness in LM | ❌ | ✅ SkillCatalog in prompt |
| Multi-cycle reasoning | ❌ | ✅ LastResults in prompt |
| Per-user context | ❌ | ✅ ConversationManager |
| Response length limits | ⚠️ | ✅ 400-char chunking |
| Join message | ❌ | ✅ BotProfile.joinMessage |
| WorkingMemory commands | ❌ | ✅ .pin/.recall/.unpin |
| Action extraction | ❌ | ✅ ResponseInterpreter (configurable) |
| LM degradation | ❌ | ✅ DegradationManager fallback |
| Addressed messages | ❌ | ✅ PM: always, channel: @nick only |
| AgenticLoop integration | ❌ | ✅ Messages flow through shared Agent |
