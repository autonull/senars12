# Agent Layer — Complete Plan for an Interactive SeNARS-Powered Cognitive Agent

Legend: **[CRASH]** = will break at runtime | **[RISK]** = production hazard | **[DEBT]** = tech debt | **[FEAT]** = capability gap

---

## Phase 1 — Stop the Crashes

These must be fixed before the agent is usable in any real environment.

### 1.1 `io-bridge.ts:62` — Unsafe `as NAR` cast  [CRASH]

`agent.getNAR()` returns `NAR | undefined` but is forced to `NAR` with `as NAR`. When NAR is absent, `context.nar` is `undefined` at runtime. Middleware like `createNlInputTranslation` (line 162) accesses `context.nar.believe()` and throws.

**Fix:** Remove the cast. Change `MessageContext.nar` in `src/io/router.ts` from `NAR` to `NAR | undefined`. Guard all middleware access to `context.nar`.

### 1.2 `io-middleware.ts:55` — `{} as ConnectionManager` crashes commands  [CRASH]

```ts
manager: bridgeCtx.manager ?? ({} as ConnectionManager),
```

When `BridgeOptions.manager` isn't set, every `/command` handler receives an empty object. Calling `manager.list()` or `manager.shutdownAll()` throws `TypeError`.

**Fix:** Make `CommandContext.manager` typed as `ConnectionManager | undefined`. Guard command handlers with early returns.

### 1.3 `SessionManager.ts:197-200` — Unhandled rejection poisons flush queue  [CRASH]

A single `writeSession()` rejection propagates through `this.writeQueue`, crashing `flushAll()` and preventing all subsequent session writes.

**Fix:**

```ts
await this.writeQueue;
this.writeQueue = this.writeSession(session)
    .then(() => { this.dirty.delete(key); })
    .catch(err => {
        this.dirty.delete(key);
        logger.error('session flush failed', err, {key});
    });
```

### 1.4 `io-bridge.ts:69-71` — No-op cleanup leaks handlers  [RISK]

```ts
return () => {
    // Connection doesn't expose off() — caller should disconnect()
};
```

**Fix:** Add `removeMessageHandler` to the `Connection` interface. The cleanup function should unregister the handler. This matters for hot-reload, testing, and connection lifecycle.

### 1.5 `cli/agent.ts:35-37` — Agent created, never used  [DEBT]

```ts
const agent = createAgent({nar, lmClient, episodicMemory});
void agent;
```

**Fix:** Either wire up an interactive stdin REPL loop, or remove the file.

---

## Phase 2 — Interactive Conversation Quality

These are the features that turn a functioning-but-brittle system into a genuinely interactive cognitive agent.

### 2.1 Thread AbortSignal from connection → agent → LM  [FEAT]

Currently `ModelRunner.run()` accepts an `AbortSignal` but no path from connection through `agent.chat()` exposes it. If a user sends a new message while the previous LM call is still running, both compete.

**Fix:** Add an optional `AbortSignal` parameter to `Agent.chat()` and `Agent.chatWithHistory()`. Thread it from the bridge middleware (use a per-session AbortController). On new message, abort the previous inflight call for the same session.

### 2.2 Stream LM tokens to the user  [FEAT]

`chat()` waits for the full LM response before returning. For interactive use (especially over WebSocket/IRC), the user waits in silence for potentially 10+ seconds.

**Short-term:** `ModelRunner.run()` is already an `AsyncGenerator` yielding `ModelEvent` (`text-delta`, `tool-call`, etc.). The bridge middleware `createAgentDispatch` could consume these events and push deltas to the connection incrementally.

**Fix:** Add a `chatStream()` method to the Agent interface that returns `AsyncGenerator<string>` (text-only, tool internals hidden). Wire through the bridge.

### 2.3 Feed NAR background derivations into LM context  [FEAT]

The agent runs `nar.run(steps)` every 60 seconds in the background, but the LM never sees what NAR derived. The cognitive context snapshot at the start of `chat()` is stale for long conversations.

**Fix:** After each background `nar.run()`, collect new derivations and inject them into the next LM system prompt. Options:

- Accumulate a `recentDerivations` buffer in the Agent. Add it to the `ContextBuilder` output.
- Or use the existing WorkingMemory tools — wire them into `buildTools()` so the LM can explicitly query recent derivations.

### 2.4 Wire WorkingMemory tools into the agent  [FEAT]

`createWorkingMemoryTools()` exists (9 tools: `set_focus`, `set_goal`, `set_hypothesis`, `add_evidence`, `mark_open_question`, `record_derivation`, `get_slot`, `clear_slot`, `snapshot_working_memory`) but is never called in `agent.ts:buildTools()`.

**Fix:** Create a `WorkingMemory` instance per session (or per episode) in the Agent. Wire it into `buildTools()` via `createWorkingMemoryTools()`. This gives the LM structured episode-scoped memory.

### 2.5 Deduplicate overlapping tools  [DEBT]

- `nar_query` (NARSTools) and `search_memory` (GeneralTools) both query NAR memory via `nar.queryTerm()`. Same behavior, different names.
- `nar_get_beliefs` (NARSTools) overlaps with `nar_query` — both return beliefs.

**Fix:** Consolidate. Keep the more specific tools (`nar_query`, `nar_get_beliefs`) and remove `search_memory`. Or make `search_memory` search episodic memory only, which is what its name suggests.

### 2.6 Add self-correction feedback to LM context  [FEAT]

`SelfAnalyzerService.performSelfCorrection()` runs but its output is discarded. The `AgentPolicy` (routing weights, tool selection bias, prompt budget) is only used to set the reasoning interval, never shown to the LM.

**Fix:** After each self-correction cycle, inject policy changes into the next LM system prompt. E.g., *"Note: Self-analysis suggests reducing tool-call frequency (toolSelectionBias=0.3)."*

### 2.7 Consolidate session key derivation  [DEBT] [RISK]

Three different key strategies exist:

| Location | Strategy | Example key |
|---|---|---|
| `io-middleware.ts:22` (originExtractor) | `message.origin` | `"irc:#channel:nick"` |
| `io-middleware.ts:29` (auth) | `message.sender` | `"nick"` |
| `io-middleware.ts:77,99` (rate-limit, session) | `sessionKey ?? origin` | `"irc:#channel:nick"` |

Auth binds to `sender` but sessions key on `origin`. These can diverge.

**Fix:** Extract a single `resolveSessionKey(message, connection)` function. Both auth and session binding use the same key. Make it configurable per connection type.

### 2.8 Restore sessions on boot (already done in bot-ai.ts, verify pattern)  [FEAT]

`bot-ai.ts:56` calls `await sessionManager.restore()` — good. But verify that:
- Sessions are restored before the first message arrives.
- Episodic memory also restores (check `EpisodicMemory` for persistence support).

### 2.9 Update `lastSeenAt` on session access, not just writes  [BUG]

`SessionManager.getOrCreate()` never updates `lastSeenAt`. Only `appendTurn()` does. If a session is read but not written (e.g., streaming response, or eviction check), it can be evicted while active.

**Fix:** Touch `lastSeenAt` in `getOrCreate()` whenever the session already existed.

---

## Phase 3 — Error Resilience & Observability

### 3.1 Add a top-level error boundary middleware  [FEAT]

No middleware wraps `await next()` in try/catch. A single thrown exception (e.g., LM timeout, NAR crash, undefined property) collapses the entire pipeline and leaves the user hanging.

**Fix:** Add `createErrorBoundary()` middleware as the outermost layer in `io-bridge.ts`:

```ts
router.use(createErrorBoundary());
```

It catches errors, logs with full context (message, connection, session), and responds with a user-friendly error message.

### 3.2 Thread a logger through the agent  [FEAT]

The Agent has no logger. `safeLog` swallows all episodic memory errors silently. There's no structured way to trace agent decisions.

**Fix:** Add `logger` to `AgentOptions`. Use it in:
- `safeLog` catch handler
- ModelRunner: log tool calls, errors, tokens
- Bridge middleware: log routing decisions
- SessionManager: log flush errors

### 3.3 Emit `agent:*` lifecycle events  [FEAT]

Events defined in `src/nar/types/events.ts` but never emitted:
- `agent:process:start` / `agent:process:complete` — around each `chat()` / `chatWithHistory()`
- `agent:suspend` / `agent:resume` — on `stop()` / `start()`

**Fix:** Add an event emitter (or use the NAR's event bus) to the Agent. Emit at lifecycle boundaries.

### 3.4 Track LM token usage and latency  [FEAT]

`AISDKAdapter.doGenerate()` hardcodes `usage: {inputTokens: 0, outputTokens: 0, totalTokens: 0}`.

**Fix:** Track actual tokens when available from the underlying LM. Add a stats accumulator on the Agent. Expose via `agent.getStats()`.

### 3.5 Non-leaking tools — prevent LM from dumping full NAR state  [FEAT]

Tools like `nar_get_beliefs`, `nar_get_attention`, `nar_reason` can return very large responses (thousands of beliefs). This burns through the LM's context window and costs money.

**Fix:** Hard cap tool results at a reasonable size (e.g., 20 entries, with a `truncated` boolean flag). Add a `maxToolResultTokens` to `ModelRunner`.

---

## Phase 4 — Polishing the Tool Ecosystem

### 4.1 Wire WorkingMemory into the agent buildTools  [FEAT]

From Phase 2.4 — implementation details:

```ts
// agent.ts:buildTools()
const wm = new WorkingMemory({defaultTTL: 5 * 60_000});
Object.assign(tools, createWorkingMemoryTools(wm));
```

The WorkingMemory should be per-session or per-episode, not global.

### 4.2 Add an `agent_instruct` tool  [FEAT]

The LM has no way to update its own system prompt or instructions at runtime. Add:

```ts
agent_instruct: tool({
    description: 'Update the agent\'s system instructions for the remainder of this session.',
    inputSchema: z.object({
        instructions: z.string().describe('New or additional instructions.'),
        mode: z.enum(['append', 'replace']).optional().default('append'),
    }),
    execute: async ({instructions, mode}) => {
        // append to session-level instructions
    },
})
```

### 4.3 Add session awareness tools  [FEAT]

The LM can't introspect the current session:

```ts
get_session_info: tool({
    description: 'Get current session metadata: message count, age, pinned beliefs.',
    execute: async () => ({
        messageCount: session.history.length,
        createdAt: session.createdAt,
        pinnedBeliefs: session.pinnedBeliefs,
    }),
})
```

### 4.4 Tool result humanization middleware  [FEAT]

When the LM calls `know` / `calculate` / `nar_believe`, the raw `{success: true, key: "foo"}` is the tool result fed back to the LM. But the human user never sees this unless the LM happens to mention it in its text response.

**Fix:** The bridge middleware can intercept tool-call events from `ModelRunner` (via streaming) and optionally send a brief confirmation to the user *before* the LM's full response.

---

## Phase 5 — Prompt & Cognition Improvements

### 5.1 Structured system prompt with dynamic sections  [FEAT]

Currently `buildSystemPrompt()` is just constitution + `systemInstructions`. Make it a composed template:

```
## Constitution
{constitution}

## Instructions
{systemInstructions}

## Cognitive State
{narContext}

## Recent Derivations
{recentDerivations}

## Self-Correction Notes
{selfCorrectionNotes}
```

Each section is conditionally included. This makes the LM's context cleaner and more predictable.

### 5.2 Add cognitive state diffing between turns  [FEAT]

The `ContextBuilder.build()` runs on every `chat()` call, but the NAR state may not have changed much. Instead of dumping the full state each time, compute a diff from the previous snapshot:

- New beliefs since last interaction
- Attention changes (concepts that gained/lost focus)
- Derived answers to pending questions

This keeps the LM context window from filling with repeated state.

### 5.3 Pull `ReAct`/chain-of-thought into the system prompt  [FEAT]

The LM has many tools but no guidance on how to use them in sequence. Add a reasoning strategy prompt:

```
When responding to the user:
1. If the question requires NAR reasoning, use nar_believe + nar_reason + nar_query.
2. Store facts using the know tool so they persist across sessions.
3. Use calculate for math before answering.
4. If uncertain, use nar_query to check existing knowledge.
```

This dramatically improves tool-use quality.

---

## Phase 6 — Configuration & Setup

### 6.1 Schema-validate AgentOptions  [FEAT]

`AgentOptions` is a plain interface with no validation. Invalid `maxLoops` (negative? 0?), missing `lmClient` when expected — all caught at runtime with cryptic errors.

**Fix:** Use `zod` to validate `AgentOptions` at construction. Clear error messages for misconfiguration.

### 6.2 Add agent presets  [FEAT]

Different use cases need different agent configurations. Add presets:

| Preset | NAR | LM | Tools | Episodic Memory |
|---|---|---|---|---|
| `minimal` | Yes | No | NAR only | No |
| `chat` | Yes | Yes | All + Agent | Yes |
| `lm-only` | No | Yes | Agent only | Optional |
| `full` (default) | Yes | Yes | All + WM | Yes |

### 6.3 Add `senars.config.json` support for agent settings  [FEAT]

Currently agent settings are hardcoded in `bot-ai.ts` and `repl.ts`. Add config file support:

```jsonc
{
  "agent": {
    "maxLoops": 5,
    "reasoningIntervalMs": 60000,
    "systemInstructions": "Be concise.",
    "sessionHistoryLimit": 20,
    "rateLimitPerMinute": 30,
    "enableNlTranslation": true,
    "enableNarseseHumanization": true
  }
}
```

---

## Phase 7 — Testing

### 7.1 Add tests for uncovered paths  [DEBT]

| Missing test for | File |
|---|---|
| `chatWithHistory` with Narsese input | agent tests |
| `chatWithHistory` with LM path + session history | agent tests |
| `createNlInputTranslation` middleware | IOBridge tests |
| `createNarseseOutputHumanization` middleware | IOBridge tests |
| `createNarsTraceAnnotator` middleware | IOBridge tests |
| `JsonlSessionManager.restore()` with real files | SessionManager tests |
| `JsonlSessionManager.flushAll()` with write errors | SessionManager tests |
| `truncateForBudget` edge cases | chat-history tests |
| Agent working without NAR but with episodic memory | agent tests |
| `buildTools()` with all tool sources combined | tools tests |

### 7.2 Remove stale integration script  [DEBT]

`scripts/test-agent-integration.ts` imports `AIAgent`, `ConversationState`, `Capabilities` which no longer exist. Remove or rewrite.

---

## Phase 8 — Tech Debt Cleanup

### 8.1 Dynamic import on hot path  [DEBT]

`io-middleware.ts:143` uses `await import('../nar/terms/index.js')` on every NL-translated message. Change to static import.

### 8.2 Bare `fs` → `node:fs`  [DEBT]

`SessionManager.ts:2` and test files use bare `fs`. Align to project `node:fs` convention.

### 8.3 Inline `import()` type expression  [DEBT]

`io-bridge.ts:30` uses inline `import()` for a type. Change to top-level `import type`.

### 8.4 `BridgeContext` property redundancy  [DEBT]

`BridgeContext` re-declares `MessageContext` properties as mutable (dropping `readonly`). If `MessageContext` changes, `BridgeContext` silently diverges. Either remove the redundancy or extract a shared base.

### 8.5 Unused `_deps` in `registerAllCommands`  [DEBT]

Remove or implement the `CommandDeps` parameter.

### 8.6 Undocumented `limit * 2` in `trimHistory`  [DEBT]

Document the pre-buffer design or make the multiplier configurable.

### 8.7 Barrel missing `buildAgentTools`  [DEBT]

Export `buildAgentTools` and `AgentToolDeps` from `agent/index.ts` if they're public API.

---

## Architecture Diagram (Target State)

```
Connection (IRC/WS/HTTP/MCP)
    │ onMessage
    ▼
MessageRouter (middleware chain)
    │ originExtractor   ← resolveSessionKey(message)
    │ createAuth         ← key matches session
    │ errorBoundary      ← catches all
    │ commandInterceptor ← /commands
    │ rateLimiter
    │ sessionBinder
    │ nlInputTranslation
    │ agentDispatch  ──┐
    │ narsTrace         │
    │ nlHumanization    │
    ▼                   ▼
Agent.chatWithHistory()
    │
    ├► tryParseNarsese() → NAR.input()
    │
    └► dispatchToLM()
        │
        ├► buildSystemPrompt()
        │    ├ constitution
        │    ├ instructions
        │    ├ NAR context snapshot
        │    ├ recent derivations buffer
        │    └ self-correction notes
        │
        └► ModelRunner.run()
             │
             ├► LM call (via AISDKAdapter)
             │    └ text-based tool format in system prompt
             │
             ├► for each tool call:
             │    ├ dispatchToolCalls()
             │    └ feed result back to LM
             │
             └► yield events:
                  ├ text-delta → stream to connection
                  ├ tool-call  → optional human feedback
                  └ finish     → return full response
```

---

## Iteration Plan

### Iteration 1: Reliability Foundation

**Goal:** The agent starts, doesn't crash, and handles failures gracefully. No silent corruption or unobservable failures.

**Acceptance criteria:**
- Agent starts with NAR-only, LM-only, both, or neither
- A missing NAR or ConnectionManager never causes a crash
- Session persistence survives disk write failures
- All errors produce a user-visible message + a logged trace
- `/commands` work correctly with or without a ConnectionManager
- Auth and session binding use a single, consistent key
- `lastSeenAt` prevents false session eviction

**Ordered task list:**

```
Step 1:  router.ts — make MessageContext.nar optional (NAR | undefined)
         io-bridge.ts — remove the `as NAR` cast
         io-middleware.ts — guard all context.nar accesses (lines 53, 162)
         Tests: agent works without NAR (already exists — verify passes)

Step 2:  io-middleware.ts — fix `{} as ConnectionManager`
         io/types.ts — make ConnectionManager optional in CommandContext
         io/commands/* — guard calls against undefined manager
         Tests: /help works without manager

Step 3:  SessionManager.ts — fix writeQueue rejection chain
         Add logger to SessionManager (or use console.error)
         Tests: inject write failure, verify queue survives

Step 4:  io/bridge.ts + io/types.ts — add removeMessageHandler to Connection
         Update cleanup function to unregister handler
         Verify cleanup works in tests

Step 5:  io-middleware.ts — create errorBoundary middleware
         Wire as outermost middleware in io-bridge.ts
         Tests: inject throw in downstream middleware, verify caught

Step 6:  utils/session-key.ts — extract resolveSessionKey()
         io-middleware.ts — auth + session use same function
         Remove originExtractor redundancy

Step 7:  SessionManager.ts — touch lastSeenAt in getOrCreate()
         Tests: verify eviction respects active sessions

Step 8:  cli/agent.ts — wire stdin REPL or remove

Step 9:  agent.ts — add logger to AgentOptions, wire into safeLog
         Verify: silent catch now logs
```

---

### Iteration 2: Interactive Conversation

**Goal:** The agent streams responses, can be interrupted, and maintains coherent multi-turn conversations with cognitive state awareness.

**Acceptance criteria:**
- `chatStream()` returns an `AsyncGenerator` of text deltas
- New message aborts previous inflight LM call for the same session
- `WorkingMemory` tools are available to the LM
- Background NAR derivations are visible to the LM
- Self-correction notes appear in the LM prompt
- Overlapping tools are deduplicated

```
Step 1:  Agent + agent.ts — add chatStream(session, signal) method
         ModelRunner.run() already yields events — expose them
         io-middleware — createAgentDispatch consumes stream, pushes to connection

Step 2:  Agent — add abortSignal parameter to chat()/chatWithHistory()
         io-bridge — per-session AbortController, abort on new message

Step 3:  agent.ts — wire WorkingMemory into buildTools()
         WorkingMemory per session (keyed by sessionKey)
         Tests: LM can call set_focus, verify in session

Step 4:  agent.ts — accumulate recentDerivations buffer in background tick
         ContextBuilder or buildSystemPrompt includes them

Step 5:  agent.ts — collect self-correction output, inject into prompt

Step 6:  nar/tools/adapters — remove search_memory, keep nar_query
         Verify existing tests still pass
```

---

### Iteration 3: Observability & Hardening

**Goal:** The agent is observable, has usage metrics, and won't leak context or blow up on large tool results.

```
Step 1:  Agent — add EventEmitter, emit agent:process:start/complete
         Emit around chat()/chatWithHistory()
         Emit agent:suspend/resume on stop()/start()

Step 2:  AISDKAdapter — track token usage (fall back to 0 when unavailable)
         Agent — accumulate stats, expose via getStats()

Step 3:  ModelRunner — cap tool result size at 20 entries + truncated flag
         Configurable via maxToolResultTokens

Step 4:  Add tests for uncovered paths (see Phase 7 table)
```

---

### Iteration 4: Smarter Cognition

**Goal:** The agent uses its tools strategically, can update its own instructions, and doesn't waste context on repeated state.

```
Step 1:  agent.ts — structured system prompt with dynamic sections (5.1)
         Pull ReAct/strategy guidance into prompt (5.3)

Step 2:  agent.ts — cognitive state diffing between turns (5.2)
         Track previous snapshot, only send delta

Step 3:  tools.ts — add agent_instruct tool (4.2)
         Tools: add get_session_info tool (4.3)

Step 4:  io-middleware — tool result humanization middleware (4.4)
```

---

### Iteration 5: Configuration & Polish

**Goal:** Easy to configure, validate at startup, presets for common use cases.

```
Step 1:  zod schema for AgentOptions (6.1)

Step 2:  Agent presets: minimal, chat, lm-only, full (6.2)

Step 3:  Config file support (6.3)

Step 4:  Tech debt cleanup (Phase 8)
         - Dynamic import → static import
         - Bare fs → node:fs
         - Inline import type → top-level import type
         - BridgeContext redundancy
         - registerAllCommands unused _deps
         - trimHistory documentation
         - Barrel exports

Step 5:  Stale script removal (7.2)
```

---

## Verification Checklist (Run After Each Iteration)

- [ ] `pnpm typecheck` — 0 errors
- [ ] `pnpm test:unit` — all 38 test suites pass
- [ ] `pnpm start` — agent boots without crash (no env needed)
- [ ] Agent with `{nar}` only: Narsese input accepted, LM path returns "no LM configured"
- [ ] Agent with `{lmClient}` only: NL input processed, Narsese input falls back correctly
- [ ] Agent with both: tool-calling loop produces correct results
- [ ] Bridge with `{sessionManager}` only: session created, history tracked, no crash on commands
- [ ] After `agent.start()` + `agent.stop()`: no dangling interval, no memory leak
