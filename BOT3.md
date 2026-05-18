# SeNARS Bot Plan — Phase 3: Remaining Work

## Status: Core Implemented, Gaps Remain

All major infrastructure from the original BOT3.md is implemented and wired:
- NAR WorkingMemory, Agent `processMessage()` pipeline, AgenticLoop, IRC adapter, REPL (pipe + TTY), all subsystems

This document covers **remaining bugs, simplifications, UX gaps, and stubs** to reach the ideal architecture.

---

## Critical Bugs

### 1. Pipe mode: response text never written (`repl.ts:205-206`)

```typescript
// Current (broken):
if (response.text) {
}
```

The `respond` callback in the context writes `< ${t}` to stdout, so responses DO arrive via that path. But the empty block is dead code noise and the turn counter on line 211 is incremented *after* this block, creating confusion about whether the response was consumed. **Fix**: remove the empty block.

### 2. bot.ts: all channels hardcoded as `'irc'` (`bot.ts:93`)

```typescript
// Current (broken):
connectionType: 'irc' as const,
```

WS, HTTP, and MCP messages all get IRC-formatted responses (400-char chunking). **Fix**: derive `connectionType` from `msg.source` via a source-to-type map.

### 3. bot.ts: IRC adapter never created (`bot.ts:173`)

```typescript
// Current (broken):
if (type === 'irc' && 'IRCConnection' in connection) {
```

`connection` is a `Connection` interface — it has `type: string`, not `IRCConnection` property. The `as any` cast masks the type error. **Fix**: `connection.type === 'irc'`.

### 4. Agent.ts: ChannelBehavior hardcoded to `'irc'` (`Agent.ts:99`)

```typescript
// Current (broken):
const channelBehavior = new ChannelBehavior('irc');
```

All channels use IRC defaults for response formatting. **Fix**: derive behavior from `ctx.connectionType` at format time, or store `Map<ChannelType, ChannelBehavior>`.

### 5. REPL TTY mode: SIGINT double-exits (`repl.ts:115-118`)

```typescript
process.on('SIGINT', () => {
    rl.close();
    process.exit(0);  // ← fires immediately
});

rl.on('close', () => {
    console.log('\nGoodbye!');
    process.exit(0);  // ← fires again because rl.close() triggers this
});
```

Also, `process.exit(0)` bypasses `setupGracefulShutdown()`, so NAR/Agent state is not cleaned up. **Fix**: remove `process.exit(0)` from SIGINT handler; let `rl.close()` → `close` handler → graceful shutdown chain handle it.

### 6. AgenticLoop: unsafe `as any` cast (`AgenticLoop.ts:138`)

```typescript
const selfAnalyzer = nar.getSelfAnalyzer();
if (selfAnalyzer && 'analyzeReasoningGaps' in selfAnalyzer) {
    await (selfAnalyzer as any).analyzeReasoningGaps();
}
```

`nar.getSelfAnalyzer()` returns `ReasoningAboutReasoning | undefined`, not `SelfAnalyzer`. The `'in'` check + cast is a type safety band-aid. **Fix**: either wire `SelfAnalyzer` properly into NAR or remove this block.

---

## Architectural Simplifications

### 7. ResponseFormatter: unify into single `format()` method

**Current**: separate `formatForIRC()`, `formatForWS()`, `formatForCLI()` — callers must know which to call.

**Ideal**:
```typescript
class ResponseFormatter {
    format(channelType: ChannelType, text: string): string | string[] {
        const cleaned = channelType === 'irc' ? this.stripMarkdown(text) : text;
        const limit = CHANNEL_LIMITS[channelType] ?? 8000;
        return channelType === 'irc' ? this.chunk(cleaned, limit) : cleaned;
    }
}
```

Eliminates the `ChannelBehavior` instance indirection.

### 8. ChannelBehavior: convert to static lookup

**Current**: class instance with per-type defaults, re-exported from `BotProfile.ts` (confusing indirection).

**Ideal**:
```typescript
export const CHANNEL_DEFAULTS: Record<ChannelType, ChannelBehaviorConfig> = {
    irc:  { maxResponseLength: 400,  perUserContext: true, showReasoning: false, responseMode: 'conversational' },
    ws:   { maxResponseLength: 4000, perUserContext: true, showReasoning: false, responseMode: 'hybrid' },
    http: { maxResponseLength: 8000, perUserContext: true, showReasoning: true,  responseMode: 'hybrid' },
    cli:  { maxResponseLength: 8000, perUserContext: true, showReasoning: true,  responseMode: 'hybrid' },
};
```

No class needed. `ResponseFormatter` reads from this directly. Remove re-export from `BotProfile.ts`.

### 9. IRCAdapter: remove redundant conversation methods

**Current**: `getUserContext()`, `addUserMessage()`, `addResponseMessage()` — duplicates what `Agent.processMessage()` already does via `ConversationManager`.

**Ideal**: Remove these three methods. The adapter's job is address detection, nick stripping, and IRC-specific formatting — not conversation management.

### 10. IRCAdapter: wire `handleChannelJoin()`

**Current**: defined but never called. `onStateChange` callback in `setupListeners()` is empty.

**Ideal**: Call from `onStateChange` when state transitions to `'connected'`:
```typescript
ircConnection.onStateChange((state, prev) => {
    if (state === 'connected' && prev !== 'connected') {
        for (const ch of this.config.channels) this.handleChannelJoin(ch);
    }
});
```

### 11. Agent.ts: extract dummy connection helper

**Current** (`Agent.ts:258-272`): 15-line inline dummy connection object.

**Ideal**:
```typescript
private createFallbackConnection(ctx: ChannelContext): Connection {
    return { id: ctx.connectionId, name: ctx.connectionType, type: ctx.connectionType, /* ... */ };
}
```

### 12. AgenticLoop: remove dead code (`AgenticLoop.ts:166-183`)

```typescript
const narAny = nar as any;
if (narAny.scenarioRunner) { ... }
if (narAny.experimentRunner) { ... }
```

NAR doesn't have `scenarioRunner` or `experimentRunner` properties. Entire block is dead code. **Fix**: remove it.

### 13. TTYOutput.tsx: dead code — delete

**Current**: Ink/React component with 132 lines. Not used anywhere — `repl.ts` uses `readline`-based TTY mode, not Ink. Also has bugs:
- `handleInput()` is never called — no `<TextInput>` component
- `agent.getSnapshot()` called 3x per render (line 122-126) causes re-render loops
- No actual text input handling

**Fix**: Delete the file. If Ink UI is desired later, it should be integrated properly with `useInput` + `TextInput`.

### 14. DegradationManager: `checkLMHealth()` is a no-op (`DegradationManager.ts:14-18`)

```typescript
checkLMHealth(): LMStatus {
    if (Date.now() - this.lastCheck < this.checkIntervalMs) return this.lmStatus;
    return this.lmStatus;  // ← both branches return the same thing
}
```

**Fix**: either implement actual health check (ping the LM endpoint) or remove the method.

---

## UX / Pipe Protocol Gaps

### 15. Pipe mode: `--quiet` flag logic inverted (`repl.ts:187-189`)

```typescript
if (this.options.quiet) {
    process.stdout.write(`> ${text}\n`);  // ← echoes input when quiet!
}
```

`--quiet` should *suppress* input echo, not enable it. **Fix**: `if (!this.options.quiet)`.

### 16. PipeOutput: `formatResponse()` returns empty string in JSON mode (`PipeOutput.ts:37-40`)

```typescript
formatResponse(text: string): string {
    const formatted = this.formatter.formatResponse(text);
    if (this.formatter.shouldOutputJson()) return '';  // ← silently drops response
    return formatted;
}
```

In JSON mode, the response text is silently dropped. The JSON metadata line should carry the response. **Fix**: return the JSON-formatted response instead of empty string.

### 17. Pipe mode: buffer timeout too aggressive (`repl.ts:159-165`)

10-second timeout discards buffered multiline input with a stderr warning. For long Narsese expressions or multi-line JSON, this is too aggressive. **Fix**: increase to 30s or make configurable via `--buffer-timeout`.

### 18. Pipe mode: timeout variable misnamed (`repl.ts:130-135`)

```typescript
let lastOutputTime = Date.now();  // ← actually tracks last INPUT, not output
```

The variable is set on every line received (line 140), so it's really "last input time". **Fix**: rename to `lastInputTime`.

### 19. Pipe mode: `.quit` handled differently in TTY vs pipe

Pipe mode (line 191-195) intercepts `.quit`/`.exit` before sending to `agent.processMessage()`. TTY mode sends them through the agent pipeline. Works but inconsistent. **Fix**: TTY mode should also intercept `.quit`/`.exit` for clean shutdown.

### 20. PipeOutput: channel type hardcoded to `'cli'` (`PipeOutput.ts:26`)

```typescript
this.formatter = new OutputFormatter('cli', config.options ?? {});
```

Should be `'pipe'` to distinguish from TTY CLI mode. **Fix**: use `'pipe'` or make configurable.

### 21. TTY mode: banner not suppressible (`repl.ts:77-78`)

```typescript
console.log('SeNARS CLI - Interactive terminal interface');
console.log('Type .help for commands, .quit to exit\n');
```

No way to suppress. `--no-init` only affects pipe mode. **Fix**: respect `--no-init` in TTY mode too.

### 22. TTY mode: no tab completion, no history navigation

Current TTY mode uses bare `readline` with no tab completion or up/down arrow history. **Fix**: integrate `HistoryManager` (once navigation methods are added) and add tab completion for dot-commands.

---

## Incomplete Commands (Stubs)

### 23. auth.ts: implement real authentication

**Current**: `.auth` returns usage string, no secret validation.

**Ideal**: Compare against `AuthManager` secrets, bind user on success.

### 24. config.ts: implement `.config.set` and `.config.reset`

**Current**: Both return "not yet implemented".

**Ideal**:
- `.config.set <key> <value>` → `nar.setConfig(key, value)`
- `.config.reset [key]` → `nar.resetConfig(key)`

### 25. scenario.ts: implement `.scenario` subcommands

**Current**: `.scenario`, `.scenario.run`, `.scenario.list`, `.scenario.run-batch` all return stubs.

**Ideal**: Wire to `ScenarioRunner` — `run(id)`, `list()`, `runBatch(ids)`.

### 26. benchmark.ts: implement `.bench` and `.bench.compare`

**Current**: Both return stubs.

**Ideal**:
- `.bench run [suite]` → run benchmark suite via `ScenarioRunner`
- `.bench compare <id1> <id2>` → compare results via `RegressionTracker`

### 27. history.ts: add navigation methods

**Current**: `loadHistory()`, `saveHistory()`, `add()` — missing up/down arrow support.

**Ideal**: Add `getPrevious()`, `getNext()`, `resetIndex()`.

---

## Command Collisions

### 28. Duplicate `.self` command

Both `self.ts` (line 11) and `scenario.ts` (line 173) register `.self`. The `CommandRegistry` will use whichever is registered last, silently shadowing the other. **Fix**: remove `.self` from `scenario.ts` — it belongs in `self.ts`.

### 29. Duplicate `.self-analyze` vs `.self.analyze`

`scenario.ts` registers `.self-analyze` (line 183) while `self.ts` registers `.self.analyze` (line 22). These are different command names but serve the same purpose. **Fix**: consolidate to `.self.analyze` in `self.ts`, remove from `scenario.ts`.

---

## Type Safety Issues

| Location | Issue | Fix |
|----------|-------|-----|
| `AgenticLoop.ts:138` | `(selfAnalyzer as any).analyzeReasoningGaps()` | Wire SelfAnalyzer properly or remove |
| `AgenticLoop.ts:167-181` | `(narAny.scenarioRunner as any).getPendingScenarios?.()` | Remove dead code |
| `bot.ts:183` | `ircConnection: connection as any` | Fix type guard (bug #3) |
| `ConnectionManager.ts:40` | `deps as Parameters<...>` hides missing `logger` | Pass logger in deps |
| `memory.ts:50-56` | `cAny.beliefBag?.toArray?.()` — `any` cast | Use proper type |
| `ResponseInterpreter.ts:47-48` | `parsed.term` may be undefined when `parsed.valid` is true | Add null check |
| `Agent.ts:188` | `config.id as string` — id is already `string` | Remove cast |

---

## Performance Concerns

| Location | Issue | Impact |
|----------|-------|--------|
| `ChatResponder.ts:92-119` | `buildSystemPrompt()` calls 4 NAR methods on every response | High — every LM call |
| `SkillCatalog.ts:97-117` | `getSkillsForPrompt()` iterates 4 Maps on every LM call | Medium |
| `Agent.ts:337-344` | `getSnapshot()` creates new object every call | Low |

These are acceptable for current scale but should be cached if throughput becomes a concern.

---

## Missing Tests

| File | Coverage |
|------|----------|
| `tests/cli/repl-pipe.test.ts` | Pipe mode: belief, question, command, .pin/.recall, JSON output, --quiet, --max-turns, --timeout, buffer timeout, SIGPIPE |
| `tests/cli/repl-commands.test.ts` | Unified CLI: all dot-commands with real NAR |
| `tests/agent/response-formatter.test.ts` | IRC chunking, markdown stripping, per-channel formatting |
| `tests/agent/response-interpreter.test.ts` | All extraction modes: none/explicit/narsese/all |

---

## Minor

| Item | Fix |
|------|-----|
| `package.json` | Add `"repl:ink": "NODE_NO_WARNINGS=1 tsx src/cli/repl.ts"` script |
| `ResponseFormatter.addProvenance()` | Implement or remove `_beliefs` param |
| `SkillCatalog.getSkillsText()` | Skip empty sections (tools/commands headers with no content) |
| `LastResults.ts:14` | Turn counter increments on `record()`, not per message — inconsistent if called multiple times per message |
| `MessageQueue.ts:20-31` | Race window: `push()` between length check and Promise creation leaves message unclaimed |
| `IRCConnection.ts:92` | `scheduleJoin()` re-joins channels already joined by `irc` library's `options.channels` |
| `ResponseInterpreter.ts:99` | Narsese pattern too broad — matches false positives in natural language |
| `ResponseInterpreter.ts:107-111` | Tool call pattern matches natural language like "I will explain(this concept)" |
| `display.ts` | Exports `box()`, `OutputRenderer`, `k` — not imported anywhere. Delete or integrate. |

---

## Implementation Order

| Step | Component | Depends On | Effort |
|------|-----------|------------|--------|
| 1 | ChannelBehavior → static lookup, ResponseFormatter → unified `format()` | None | Small |
| 2 | Fix bugs 1-6 (repl.ts, bot.ts, Agent.ts, AgenticLoop.ts) | 1 | Small |
| 3 | Simplifications 9-14 (IRCAdapter, Agent helper, dead code, TTYOutput, DegradationManager) | 1 | Small |
| 4 | UX gaps 15-22 (pipe mode fixes, TTY mode improvements) | 1-2 | Medium |
| 5 | Command collisions 28-29 (remove duplicates) | None | Tiny |
| 6 | Type safety fixes (table above) | 1-3 | Small |
| 7 | Stub commands 23-27 (auth, config, scenario, benchmark, history) | None | Medium |
| 8 | Missing tests | 1-7 | Medium |
| 9 | Minor items | None | Small |

Steps 1, 5, 7, 9 are independent. Steps 2-3 depend on 1. Step 4 depends on 1-2. Step 6 depends on 1-3. Step 8 depends on 1-7.
