# SeNARS NEXT6 — The Bridge (Complete v3)

> **Target:** Connect the v6 agent harness to **every** IO
> transport (CLI, IRC, WS, HTTP, MCP) so all five channels
> drive the same agent — with multi-turn context per origin,
> operator commands (`/help`, `/episodes`, `/stats`),
> NARS-reasoning visibility, JSONL session persistence,
> Libera.Chat default config, live IRC integration tests, and
> a bot-to-bot HTTP/WebSocket API with Python + Node examples.
> Plus a safety net (pre-commit gate, architecture manifest,
> weekly CI audit, git tag) to prevent the silent-loss pattern
> that destroyed the prior agent in commit `69dc3dd`.
>
> **Scope: 12 new files, 9 modified, ~2120 lines.** No
> restoration of cognitive cycle, scenarios, benchmarks, or
> TUI — those were intentionally removed and are explicitly
> out of scope.

---

## 1. Executive Summary

NEXT5 produced a working agent (`createAgent`) but connected
it to nothing. The IO subsystem (transports, ConnectionManager,
MessageRouter, CommandRegistry, AuthManager) is **largely
intact** — only the agent-binding glue is missing. The CLI
REPL works only because it bypasses the IO layer and calls
`agent.chat()` directly. The NL translation layer
(`src/nar/nl/`, 1142 lines) is also orphaned — it has the
right primitives (`NLTranslator`, `ResultInterpreter`,
`NLAnalyzer`, `ClarificationHandler`) but nothing wires them
in.

This plan adds the **bridge** (a thin middleware layer that
pipes `IOMessage` events from any `Connection` into the agent)
and the **NlBridge** (a thin orchestrator for bidirectional
NL↔Narsese translation). It restores:

1. **Multi-channel agent surface** — CLI, IRC, WS, HTTP, MCP
   all drive the same agent through a common abstraction
   (`Connection` interface + `MessageRouter` middleware chain).
2. **Multi-turn context per origin** — bounded history,
   JSONL-persisted, TTL-evicted.
3. **Operator commands** — the 10 command files
   (`/auth`, `/help`, `/stats`, `/episodes`, etc.) routed
   through `CommandRegistry`.
4. **Authentication** — `AuthManager` (63 lines, intact) is
   wired into the bridge as a middleware.
5. **NARS-reasoning visibility** — replies get a
   `[NARS: derived ...]` footnote when new beliefs were
   derived during the turn.
6. **Bidirectional NL↔Narsese translation** — `createNlBridge()`
   factory wraps `NLTranslator` (NL→Narsese via structured LM
   call with `TranslationSchema`) and `ResultInterpreter`
   (Narsese→NL). Wired as `NlInputTranslation` and
   `NarseseOutputHumanization` middleware — translation lives
   at the IO boundary, NOT in the agent. Handles paragraphs
   and multi-task input. **No regex shortcuts.**
7. **Bot-to-bot API** — WebSocket (default) and HTTP (opt-in)
   with `docs/bot-api.md` showing Python + Node examples.
8. **Default config** — `pnpm bot` works out-of-box
   connecting to `irc.libera.chat#senars` as `senars-bot`
   and starting a WebSocket server on 8765.
9. **Live IRC integration test** — `node:net`-based mock IRC
   server, real `IRCConnection` + `irc.Client`, end-to-end
   message round-trip.
10. **Safety net** — pre-commit gate, architecture manifest,
   weekly CI audit, git tag, manual test protocol.

---

## 2. Diagnosis — What's Missing Today

Verified by direct file inspection (June 2026):

| File | Lines | What it does | Status |
|---|---|---|---|
| `src/io/connection-manager.ts` | 116 | Registers factories, add/remove/enable/disable connections | **Broken signature:** `addConnection` accepts `{nar, emit}` but the underlying `ConnectionDeps` type requires `{nar, emit, logger}`. The `emit` callback has no listener. |
| `src/io/router.ts` | 37 | Express-style middleware chain | Works. `MessageContext` has `connection`, `nar`, `respond(text)`. |
| `src/io/auth.ts` | 63 | `AuthManager` with open/auth modes, per-connection secrets, sender binding | Works. **Not used by any code path** — orphaned. |
| `src/io/commands/registry.ts` | 49 | `CommandRegistry` class | Works. **Not instantiated by any code path** — orphaned. |
| `src/io/commands/core.ts` | 64 | `/help`, `/run`, `/stats`, `/clear`, `/quit` | Declarations. **`/quit` calls `process.exit(0)`** — would kill the entire bot if invoked via IRC. |
| `src/io/commands/{nar,self,memory,lm,episodes,rlfp,connection,config,auth}.ts` | 632 | `/query`, `/trace`, `/concepts`, `/lm-status`, `/episodes`, `/prefer`, `/auth`, etc. | Declarations. Orphaned. |
| `src/io/connections/{irc,cli,ws,http,mcp}.ts` | 844 | Five transports | All work. CLI uses `.command` prefix; IO commands use `/command` — **prefix mismatch** between CLI and IO. |
| `src/api/{http-adapter,websocket-adapter,mcp-server,mcp-adapter,mcp-tools,mcp-prompts,mcp-resources}.ts` (+ `src/api/mcp/*.ts`) | 2198 | Public API surface | All intact. **Not used by `bot-ai.ts`** — orphaned. |
| `src/nar/nl/{translator,analyzer,clarification,interpreter}.ts` (+ `schemas.ts`) | 1142 | NL→Narsese (structured LM call), Narsese→NL humanization, intent analysis, clarification | All work. **Not used by `agent.ts`** — orphaned. Only `ContextBuilder` (170 lines) is wired in. **`NL_PATTERNS` in `translator.ts:17-50` is a regex hack that v4.1 explicitly avoids in the bridge pipeline.** |
| `src/bin/bot-ai.ts` | 52 | Entry point | Placeholder. Creates NAR + agent, calls `start()`, exits. |
| `src/bin/repl.ts` | 257 | CLI REPL | Works. Bypasses IO layer, calls `agent.chat()` directly. |

**Bottom line:** ~4,400 lines of disconnected infrastructure
(transports, manager, router, commands, auth, API, NL
translation) sit untouched. The bridge needs ~2120 lines of
glue to wake them up.

---

## 3. What Was Lost in commit `69dc3dd` and Why NEXT6 Doesn't Restore It

`git show 69dc3dd --stat` shows 13,623 lines deleted across
149 files. Categories (verified against the current tree):

| Category | Files | Lines | Restoring? |
|---|---|---|---|
| **Cognitive cycle** (`src/agent/cycle/*`) | 12 | ~800 | **No.** v6 has no cycle. |
| **Cognition modules** (WorkingMemory, EpisodeRunner, etc.) | 11 | ~1100 | **No.** Cycle-bound. |
| **Request pipeline** (RequestComposer, CognitiveSnapshot, TermExtractor) | 3 | ~400 | **No.** Cycle-bound. |
| **Old ConnectionManager** (`src/agent/connections/ConnectionManager.ts`) | 1 | 552 | **Partially replaced** by the new `src/io/connection-manager.ts` (116 lines). |
| **Old ConversationState** (`src/agent/ConversationState.ts`) | 1 | 225 | **Replaced** by `ConversationSession` (this plan). |
| **Old AIAgent** (`src/agent/AIAgent.ts`) | 1 | 226 | **Replaced** by `createAgent` in NEXT5. |
| **Scenarios / Experiments** | 5 | ~900 | **No.** Test infra. |
| **TUI** | 3 | ~200 | **No.** Not requested. |
| **Public agent-api.ts + scenario APIs** | 4 | ~700 | **No.** Cycle-bound. |
| **Tests for above** | ~30 | ~3000 | **No.** Tied to deleted code. |
| **Smoke scripts** | 11 | ~1500 | **Replace** with new smoke + integration tests. |

**Verdict:** NEXT6 restores the **user-facing IO surface**
without bringing back the cognitive cycle. v6 is a slimmer
agent that the bridge can connect to; if we ever want the
cycle back, that's NEXT7.

---

## 4. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Connections (CLI, IRC, WS, HTTP, MCP)                              │
│  All emit IOMessage events with origin = "{type}:{loc}:{nick}"     │
└─────────────────────┬──────────────────────────────────────────────┘
                      │ IOMessage
                      ▼
┌────────────────────────────────────────────────────────────────────┐
│  AuthMiddleware (per-connection AuthManager)                        │
│  → checkAuth(connection, sender, text): allow|ignore|auth_bound     │
│  → if auth_bound: short-circuit with "auth ok" reply                │
└─────────────────────┬──────────────────────────────────────────────┘
                      │ allow
                      ▼
┌────────────────────────────────────────────────────────────────────┐
│  MessageRouter (Express-style chain)                                 │
│                                                                     │
│  ┌─ 1. OriginExtractor ─────────────────────────────────────┐     │
│  │   → sessionKey = message.origin                            │     │
│  └────────────────────────────────────────────────────────────┘     │
│  ┌─ 2. OperatorCommandInterceptor ─────────────────────────┐       │
│  │   → if text starts with "/", look up in CommandRegistry    │     │
│  │   → execute command, respond, short-circuit               │     │
│  └────────────────────────────────────────────────────────────┘     │
│  ┌─ 3. RateLimiter (per sessionKey) ───────────────────────┐       │
│  │   → token bucket, default 30 msg/min, per-key             │     │
│  └────────────────────────────────────────────────────────────┘     │
│  ┌─ 4. SessionBinder ──────────────────────────────────────┐       │
│  │   → SessionManager.getOrCreate(sessionKey)                │     │
│  │   → attach to context.session                             │     │
│  └────────────────────────────────────────────────────────────┘     │
│  ┌─ 5. AgentDispatch ──────────────────────────────────────┐       │
│  │   → try parseNarsese (fast path)                           │     │
│  │   → else agent.chatWithHistory(text, session)             │     │
│  │   → context.respond(reply)                                 │     │
│  └────────────────────────────────────────────────────────────┘     │
│  ┌─ 6. NarseseOutputHumanization ──────────────────────────┐       │
│  │   → wraps context.respond BEFORE AgentDispatch runs        │     │
│  │   → if reply contains Narsese syntax, humanize it          │     │
│  │   → preserves original Narsese in session.metadata.narsese │     │
│  └────────────────────────────────────────────────────────────┘     │
│  ┌─ 7. NarsTraceAnnotator ─────────────────────────────────┐       │
│  │   → if NAR produced new derivations this turn,            │     │
│  │     append "[NARS: derived X, Y, Z]" footnote to reply    │     │
│  └────────────────────────────────────────────────────────────┘     │
│  (EpisodicLogger removed — agent logs directly to EpisodicMemory)     │
└────────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────────────────┐
│  SessionManager (key → ConversationSession)                          │
│  + JSONL persistence (.cache/sessions/{key}.jsonl)                  │
│  + TTL eviction (24h default)                                        │
│  + snapshot/restore on shutdown/startup                              │
└────────────────────────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────────────────────────┐
│  createAgent (intact from NEXT5)                                     │
│  chatWithHistory(text, session)                                      │
│    → parseTask(text) — Narsese fast path (no LM, no history needed)  │
│    → else ModelRunner.run({system, messages: session.history})       │
│  No run() in chat path — background throttle loop handles it         │
└────────────────────────────────────────────────────────────────────┘
```

---

## 5. Concrete File Plan

### 5.1 New Files (12)

| File | Lines | Purpose |
|---|---|---|
| `src/agent/ConversationSession.ts` | ~80 | Per-origin state: history, pinnedBeliefs, timestamps |
| `src/agent/SessionManager.ts` | ~150 | Map<key, session> with TTL eviction + JSONL persistence + snapshot |
| `src/agent/chat-history.ts` | ~50 | `formatHistoryAsMessages()`, `truncateForBudget()` |
| `src/agent/nl-bridge.ts` | ~200 | `createNlBridge()` factory: structured LM translation + humanization (no regex) |
| `src/agent/io-bridge.ts` | ~150 | `bindAgentToConnection()`, `createDefaultBridge()` |
| `src/agent/io-middleware.ts` | ~300 | 9 middleware: auth, extractor, command, rate-limit, session, dispatch, NlInputTranslation, NarseseOutputHumanization, trace (EpisodicLogger removed — was a no-op) |
| `src/agent/io-config.ts` | ~100 | `createConnectionConfigsFromEnv()` with Libera.Chat IRC + WebSocket defaults |
| `src/agent/register-commands.ts` | ~80 | `registerAllCommands(registry, deps)` — wires all 10 command files |
| `docs/bot-api.md` | ~150 | WebSocket-first API docs + Python + Node example bots |
| `docs/manual-test-irc.md` | ~80 | 9-step manual test protocol |
| `tests/unit/agent/IOBridge.test.ts` | ~280 | Mock-connection tests for every middleware |
| `tests/integration/irc-live.test.ts` | ~150 | Real `irc` server, end-to-end message round-trip |

**Total new: ~1730 lines, 12 files.**

### 5.2 Modified Files (9)

| File | Change | ~Lines |
|---|---|---|
| `src/agent/agent.ts` | Add `chatWithHistory(input, session)` to `Agent` interface + factory. `chat()` unchanged. **Translation is in middleware, not the agent.** | +35 |
| `src/agent/index.ts` | Export new symbols | +20 |
| `src/io/connection-manager.ts` | Fix `addConnection` signature to include `logger` in `deps` | +5 |
| `src/io/commands/core.ts` | Remove `process.exit(0)` from `/quit` (returns sentinel) | +5 net |
| `src/io/commands/registry.ts` | Add `registerAll()` method that calls all `registerXxxCommands(registry, deps)` | +15 |
| `src/bin/bot-ai.ts` | Rewrite: ConnectionManager + bridges + default IRC + WS + auth + commands + NlBridge | +110 net (52→160) |
| `src/bin/repl.ts` | Refactor to use `bindAgentToConnection` (or keep direct call + add a note) | +10 |
| `scripts/audit-large-delete.sh` | NEW pre-commit gate (was missing) | +50 |
| `docs/architecture.md` | NEW manifest of core subsystems | +100 |

**Total modified: ~390 lines added (or new, for scripts/docs).**

### 5.3 Net

- **~1730 new + ~390 modified = ~2120 lines.**
- **0 cognitive cycle restoration.** Out of scope.
- **0 deletions.** All existing code preserved.

---

## 6. Implementation Steps

### Phase 0 — Type Foundation (1 file, 5 lines)

Must complete before Phase 3 (middleware) because middleware
mutates `MessageContext` with `sessionKey`, `session`,
`manager` fields. Doing it as a type extension instead of
runtime assertions.

#### 0. `src/io/router.ts` — extend `MessageContext`

```typescript
import type {Connection, IOMessage} from './types.js';
import type {NAR} from '../nar/nar.js';
import type {ConversationSession} from '../agent/ConversationSession.js';
import type {ConnectionManager} from './connection-manager.js';

export interface MessageContext {
    readonly connection: Connection;
    readonly nar: NAR;
    readonly respond: (text: string) => Promise<void>;
    // Bridge-augmented fields (set by middleware, read by downstream middleware)
    readonly sessionKey?: string;
    readonly session?: ConversationSession;
    readonly manager?: ConnectionManager;
}

export type MessageMiddleware = (
    message: IOMessage,
    context: MessageContext,
    next: () => Promise<void>,
) => Promise<void>;

export class MessageRouter {
    private middleware: MessageMiddleware[] = [];

    use(middleware: MessageMiddleware): void {
        this.middleware.push(middleware);
    }

    async route(message: IOMessage, context: MessageContext): Promise<void> {
        let index = 0;

        const next = async (): Promise<void> => {
            if (index < this.middleware.length) {
                const handler = this.middleware[index++];
                if (handler) {
                    await handler(message, context, next);
                }
            }
        };

        await next();
    }
}
```

This removes the need for `as MessageContext & {session:
...}` runtime assertions throughout the middleware.

### Phase 1 — Session State (~280 lines, 3 files)

#### 1. `src/agent/ConversationSession.ts` (~80 lines)

```typescript
import type {Agent} from './agent.js';

export interface SessionMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface ConversationSession {
    readonly key: string;        // e.g. "irc:#senars:alice"
    history: SessionMessage[];
    pinnedBeliefs: string[];    // 8 most recent Narsese beliefs from this session
    createdAt: number;
    lastSeenAt: number;
}

export const DEFAULT_SESSION_HISTORY_LIMIT = 20;

export function createSession(key: string): ConversationSession {
    const now = Date.now();
    return {key, history: [], pinnedBeliefs: [], createdAt: now, lastSeenAt: now};
}

export function appendTurn(session: ConversationSession, role: 'user' | 'assistant', content: string, metadata?: Record<string, unknown>): void {
    session.history.push({role, content, timestamp: Date.now(), ...(metadata ? {metadata} : {})});
    session.lastSeenAt = Date.now();
}

export function trimHistory(session: ConversationSession, limit: number): void {
    if (session.history.length > limit * 2) {
        session.history = session.history.slice(-limit * 2);
    }
}

export function getRecentHistory(session: ConversationSession, n: number): SessionMessage[] {
    return session.history.slice(-n);
}
```

#### 2. `src/agent/SessionManager.ts` (~150 lines)

```typescript
import {join} from 'node:path';
import {promises as fs} from 'fs';
import {createSession, type ConversationSession, type SessionMessage, DEFAULT_SESSION_HISTORY_LIMIT, appendTurn, trimHistory} from './ConversationSession.js';

export interface SessionManager {
    getOrCreate(key: string): ConversationSession;
    save(session: ConversationSession): Promise<void>;
    evictExpired(ttlMs: number): void;
    snapshot(): Promise<void>;
    restore(): Promise<void>;
    size(): number;
}

export class InMemorySessionManager implements SessionManager {
    private readonly sessions = new Map<string, ConversationSession>();
    private readonly historyLimit: number;
    constructor(opts?: {historyLimit?: number}) { this.historyLimit = opts?.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT; }
    getOrCreate(key: string): ConversationSession { /* ... */ }
    save(session: ConversationSession): Promise<void> { /* no-op */ }
    evictExpired(ttlMs: number): void { /* ... */ }
    snapshot(): Promise<void> { /* no-op */ }
    restore(): Promise<void> { /* no-op */ }
    size(): number { return this.sessions.size; }
}

export class JsonlSessionManager implements SessionManager {
    private readonly sessions = new Map<string, ConversationSession>();
    private readonly basePath: string;
    private readonly historyLimit: number;
    private flushTimer: ReturnType<typeof setInterval> | null = null;

    constructor(opts: {basePath: string; historyLimit?: number; flushIntervalMs?: number}) {
        this.basePath = opts.basePath;
        this.historyLimit = opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT;
        const flushMs = opts.flushIntervalMs ?? 5000;
        this.flushTimer = setInterval(() => this.flushAll().catch(() => {}), flushMs);
        if (typeof this.flushTimer.unref === 'function') this.flushTimer.unref();
    }

    getOrCreate(key: string): ConversationSession { /* ... */ }
    save(session: ConversationSession): Promise<void> { /* mark dirty */ }
    async flushAll(): Promise<void> { /* write all dirty to JSONL */ }
    evictExpired(ttlMs: number): void { /* ... */ }
    async snapshot(): Promise<void> { await this.flushAll(); }
    async restore(): Promise<void> { /* read all JSONL files into sessions */ }
    size(): number { return this.sessions.size; }

    private sessionFile(key: string): string {
        return join(this.basePath, `${key.replace(/[^a-zA-Z0-9_-]/g, '_')}.jsonl`);
    }
}
```

#### 3. `src/agent/chat-history.ts` (~50 lines)

```typescript
import type {SessionMessage} from './ConversationSession.js';

export function formatHistoryAsMessages(
    history: SessionMessage[],
    limit: number,
): Array<{role: 'user' | 'assistant'; content: string}> {
    return history.slice(-limit).map(m => ({role: m.role as 'user' | 'assistant', content: m.content}));
}

export function truncateForBudget(messages: Array<{role: string; content: string}>, maxTokens: number): typeof messages {
    // Rough char-based estimate: 4 chars per token
    const maxChars = maxTokens * 4;
    let total = 0;
    const out: typeof messages = [];
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i]!;
        if (total + m.content.length > maxChars) break;
        out.unshift(m);
        total += m.content.length;
    }
    return out;
}
```

### Phase 2 — Agent Additive Method (~35 lines, 1 modified file)

#### 4. `src/agent/agent.ts` — add `chatWithHistory`

The new method is **additive** — `chat()` is unchanged.

```typescript
// Add to Agent interface
chatWithHistory(input: string, session: ConversationSession, opts?: {historyLimit?: number}): Promise<string>;

// In createAgent factory
const chatWithHistory = async (input: string, session: ConversationSession, opts?: {historyLimit?: number}): Promise<string> => {
    safeLog('input', input, {session: session.key});

    const task = tryParseNarsese(input);
    if (task) {
        await nar?.input(task.term, task.taskType, task.truth);
        // Same fast-path responses as chat()
        if (task.taskType === 'question') {
            const needle = task.term.toString();
            const existing = nar?.getBeliefs().find((b: {term: {toString(): string}}) =>
                b.term.toString().toLowerCase().includes(needle.toLowerCase())
            );
            const response = existing
                ? formatBelief(existing as {term: {toString(): string}; truth?: {f: number; c: number}})
                : `Question queued: ${input} (reasoning in background)`;
            appendTurn(session, 'user', input, {narsese: true, taskType: task.taskType});
            appendTurn(session, 'assistant', response, {narsese: true, taskType: task.taskType});
            trimHistory(session, opts?.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT);
            safeLog('response', response, {session: session.key, narsese: true});
            return response;
        }
        const response = `+ ${input}`;
        appendTurn(session, 'user', input, {narsese: true, taskType: task.taskType});
        appendTurn(session, 'assistant', response, {narsese: true, taskType: task.taskType});
        trimHistory(session, opts?.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT);
        safeLog('response', response, {session: session.key, narsese: true});
        return response;
    }

    // NL path
    const historyLimit = opts?.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT;
    const historyMessages = formatHistoryAsMessages(session.history, historyLimit);
    historyMessages.push({role: 'user', content: input});

    const context = await buildContext(input);
    const system = context ? `${buildSystemPrompt()}\n\n## Cognitive State\n${context}` : buildSystemPrompt();

    const iter = runner.run({
        system,
        messages: historyMessages,
        tools: buildTools(),
        ctxHash: String(Date.now()),
        snapshot: null,
        budget: {systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0},
    });
    let next = await iter.next();
    while (!next.done) next = await iter.next();
    const reply = next.value?.text ?? '';

    appendTurn(session, 'user', input);
    appendTurn(session, 'assistant', reply);
    trimHistory(session, historyLimit);

    safeLog('response', reply, {session: session.key});
    return reply;
};
```

### Phase 2.5 — NL↔Narsese Translation Layer (~280 lines, 1 new file + 2 modified)

**Why this matters:** The `src/nar/nl/` directory contains
1142 lines of NL translation infrastructure — `NLTranslator`
(NL→Narsese, structured LM call with `TranslationSchema`),
`ResultInterpreter` (Narsese→NL), `NLAnalyzer`,
`ClarificationHandler` — all orphaned. NEXT5 v6 only uses
`ContextBuilder` and `parseTask`. The rest is dead code.

This phase wires the NL layer into the bridge as
**bidirectional translation at the IO boundary**. The agent
sees Narsese; the user sees NL. Translation happens invisibly
between the connection and the agent.

**Critical design constraints:**

1. **No regex patterns for NL→Narsese translation.** The
   existing `NL_PATTERNS` array in `translator.ts:17-50` is
   exactly the kind of brittle pattern-matching the plan
   said to avoid. The translation pipeline uses **only** the
   structured LM call (`generateObject` with
   `TranslationSchema` from `schemas.ts:11`). Tier 2/3
   fallback comes from the LM's own retry mechanism (the
   `lastError` parameter passed to `tryTiers`), not from
   hardcoded regex.

2. **Paragraphs and multi-task support.** The
   `TranslationSchema` already returns
   `beliefs: NarseseBeliefSchema[]` (an array). The
   translator must return **all** extracted beliefs, goals,
   and questions, not just the first one. A user message
   like "I think cats are mammals. Also, dogs chase cats. Are
   dogs smarter than cats?" produces 2 beliefs + 1 question.
   The bridge feeds all of them to NAR in a single
   `nar.input()` batch.

3. **Translation replaces LM when possible.** When NL→
   Narsese translation succeeds (the LM produces a
   well-formed `TranslationResult`), the agent doesn't call
   the LM again. The translation IS the LM call. The LM
   is invoked once, for translation. No duplicate LM
   roundtrip.

4. **Translation lives in middleware, not the agent.** The
   agent stays pure: `chat(input)` and `chatWithHistory(input,
   session)`. The translation happens in
   `NlInputTranslation` middleware (input side) and
   `NarseseOutputHumanization` middleware (output side). The
   agent doesn't know about NL.

#### 4a. `src/agent/nl-bridge.ts` (~200 lines, new)

A factory module, not a class. Exports pure functions that
the middleware uses. No state, no constructor.

**Schema upgrade prerequisite:** The existing
`TranslationSchema` in `src/nar/nl/schemas.ts:11` only has
`beliefs: NarseseBeliefSchema[]` and `isQuestion: boolean`.
For paragraph/multi-task support, we extend the schema
to include `questions` and `goals` arrays:

```typescript
// src/nar/nl/schemas.ts (MODIFIED in v4.1)
import {z} from 'zod';

export const NarseseItemSchema = z.object({
    narsese: z.string().describe('A single valid Narsese statement.'),
    truth: z.object({
        f: z.number().min(0).max(1),
        c: z.number().min(0).max(1),
    }).optional(),
});

export const TranslationSchema = z.object({
    beliefs: z.array(NarseseItemSchema).describe('Narsese beliefs to assert'),
    questions: z.array(z.string()).describe('Narsese questions to ask (raw Narsese strings, no truth)'),
    goals: z.array(z.string()).describe('Narsese goals to pursue (raw Narsese strings)'),
    summary: z.string().describe('Brief natural language summary of what was extracted'),
});
```

This is a **breaking change** to `TranslationSchema`. The
existing `NLTranslator.tryTier2()` uses the old shape and
will fail. Phase 3.5 step 1 is to update
`NLTranslator.tryTier2()` to use the new shape, dropping
the `isQuestion` field (questions now live in their own
array).

```typescript
import {NLTranslator, type TranslationResult} from '../nar/nl/translator.js';
import {ResultInterpreter, type DerivationResult} from '../nar/nl/interpreter.js';
import {NLAnalyzer} from '../nar/nl/analyzer.js';
import {ClarificationHandler} from '../nar/nl/clarification.js';
import type {NAR} from '../nar/nar.js';
import type {SeNARSRegistry} from '../nar/lm/providers.js';

export interface NlBridgeDeps {
    nar: NAR;
    registry: SeNARSRegistry;
}

export function createNlBridge(deps: NlBridgeDeps) {
    const translator = new NLTranslator(deps.registry);
    const interpreter = new ResultInterpreter();
    const analyzer = new NLAnalyzer();
    const clarifier = new ClarificationHandler();

    return {
        /**
         * Translate NL → set of Narsese operations.
         * Handles paragraphs and multi-task input.
         * Returns null if all translation attempts fail
         * (caller falls back to LM-only chat path).
         * Returns `{clarify: string}` if input is ambiguous
         * (caller asks the user for clarification).
         */
        async nlToNarsese(nl: string): Promise<TranslationResult | {clarify: string} | null> {
            const result = await translator.translate(nl);
            if (result === null) return null;
            if (typeof result === 'string') return {clarify: result};
            return result;
        },

        /**
         * Translate Narsese → NL for the user.
         * Used by `/explain`, by the NarseseOutputHumanization
         * middleware, and for surfacing reasoning in replies.
         */
        interpretDerivation(derivation: DerivationResult | null, query: string): string {
            return interpreter.interpret(derivation, query, deps.nar);
        },

        analyzeInput(nl: string) {
            return analyzer.analyze(nl);
        },

        generateClarification(input: string): Promise<string> {
            return clarifier.generateWithLM(input, deps.registry);
        },
    };
}

export type NlBridge = ReturnType<typeof createNlBridge>;
```

**Multi-task handling:** `TranslationResult.beliefs` is
already an array (`TranslationSchema.beliefs: NarseseBeliefSchema[]`).
The translator returns all extracted beliefs/goals/questions
in one result. The middleware iterates the array and feeds
each to NAR.

#### 4b. `src/agent/io-middleware.ts` — add translation middleware (no agent change)

The agent itself is unchanged. Translation happens in the
bridge chain, **before** and **after** `AgentDispatch`.

```typescript
// 8. NlInputTranslation — pre-process input
export function createNlInputTranslation(nlBridge: NlBridge): MessageMiddleware {
    return async (message, context, next) => {
        const bridgeCtx = context as BridgeContext;
        const text = message.text;

        // If the user already sent Narsese, skip translation.
        // (Same gate as chat()'s parseTask — uses the real
        // Peggy parser, not regex.)
        if (termParser.parseTask(text) !== null) {
            await next();
            return;
        }

        // Try NL → Narsese translation.
        const result = await nlBridge.nlToNarsese(text);
        if (result === null) {
            // All translation attempts failed. Fall through to
            // LM-only chat path.
            await next();
            return;
        }
        if ('clarify' in result) {
            await context.respond(result.clarify);
            return;
        }

        // Translation succeeded. Feed all extracted Narsese
        // operations to NAR in a single batch.
        const tasks: Array<Promise<void>> = [];
        for (const belief of result.beliefs ?? []) {
            tasks.push(context.nar.believe(belief.narsese, belief.truth));
        }
        for (const question of result.questions ?? []) {
            tasks.push(context.nar.question(question));
        }
        for (const goal of result.goals ?? []) {
            tasks.push(context.nar.goal(goal));
        }
        await Promise.all(tasks);

        // Build a human-readable response. No LM call needed —
        // the user can see the translated Narsese directly.
        const lines: string[] = [];
        for (const belief of result.beliefs ?? []) {
            lines.push(`+ ${belief.narsese}`);
        }
        for (const question of result.questions ?? []) {
            lines.push(`? ${question}`);
        }
        for (const goal of result.goals ?? []) {
            lines.push(`! ${goal}`);
        }
        const response = lines.length > 0
            ? lines.join('\n') + (result.summary ? `\n\n(${result.summary})` : '')
            : result.summary || 'Translation produced no Narsese operations.';

        // Append to session history
        if (bridgeCtx.session) {
            appendTurn(bridgeCtx.session, 'user', text);
            appendTurn(bridgeCtx.session, 'assistant', response, {translated: true});
        }
        await context.respond(response);
    };
}

// 9. NarseseOutputHumanization — intercept response BEFORE send
//
// This middleware runs AFTER AgentDispatch has produced a
// reply but BEFORE that reply hits the transport. It
// humanizes Narsese in the response so the user sees NL,
// not `<(cat --> animal)> (f=0.50 c=0.80)`.
//
// How it works: AgentDispatch writes the raw Narsese into
// the session's last assistant message BEFORE calling
// context.respond. The order in the middleware chain matters:
// AgentDispatch is followed by NarseseOutputHumanization, but
// respond() is called synchronously inside AgentDispatch. To
// intercept, NarseseOutputHumanization wraps context.respond
// before AgentDispatch runs.
//
// Practical implementation: NarseseOutputHumanization
// registers itself BEFORE AgentDispatch in the chain. It
// monkey-patches context.respond to humanize outgoing text.
// After respond() returns, the patch is removed.
export function createNarseseOutputHumanization(nlBridge: NlBridge): MessageMiddleware {
    return async (message, context, next) => {
        // Only intercept if there's a session to update
        const bridgeCtx = context as BridgeContext;
        if (!bridgeCtx.session) {
            await next();
            return;
        }
        const originalRespond = context.respond;
        const sessionRef = bridgeCtx.session;
        // Wrap respond to humanize outgoing Narsese
        (context as {respond: typeof context.respond}).respond = async (text: string) => {
            let toSend = text;
            if (/[(<{}\[].*?[)>}\]]/.test(text)) {
                const humanized = nlBridge.interpretDerivation(null, text);
                if (humanized && humanized !== text) {
                    toSend = humanized;
                    // Also update the session's last assistant
                    // message (which AgentDispatch just appended)
                    const lastAssistant = [...sessionRef.history].reverse()
                        .find(h => h.role === 'assistant');
                    if (lastAssistant) {
                        lastAssistant.content = humanized;
                        lastAssistant.metadata = {
                            ...lastAssistant.metadata,
                            narsese: text,
                            humanized: true,
                        };
                    }
                }
            }
            return originalRespond(toSend);
        };
        try {
            await next();
        } finally {
            (context as {respond: typeof context.respond}).respond = originalRespond;
        }
    };
}
```

**Note:** The NarseseOutputHumanization middleware wraps
`context.respond` rather than calling it a second time. The
humanized text is what the user sees; the original Narsese
is preserved in `lastAssistant.metadata.narsese` for
replay/debugging. The wrap is removed in `finally` so
downstream middleware (rate limiter logging, etc.) see the
original respond function.

**Multi-task capability enabled:**

With the upgraded `TranslationSchema` (questions + goals +
beliefs, all arrays), users can type paragraphs:

```
> I think cats are mammals. Also, dogs chase cats. Are dogs
> smarter than cats?
```

Becomes 3 separate `nar.input()` calls in one round:
- `(cat --> mammal).` (belief)
- `(dog --> chase_cat).` (belief)
- `(dog --> smarter_than --> cat)?` (question)

All attributed to the same `EpisodicMemory` input log entry.
The bridge response shows all 3 translations plus the
summary.

### Phase 3 — Middleware (~250 lines, 1 file)

#### 5. `src/agent/io-middleware.ts` (~250 lines)

Each middleware is a pure function `(message, context, next) => Promise<void>`.

**Important:** `MessageContext` is `readonly`, so the
middleware uses a private mutable `BridgeContext` that
extends `MessageContext` with `sessionKey`, `session`, and
`manager`. The bridge creates this object once per message
and threads it through the chain. The Phase 0 type extension
makes these fields visible in the type system.

```typescript
import type {MessageMiddleware, MessageContext} from '../io/router.js';
import type {IOMessage} from '../io/types.js';
import type {AuthManager} from '../io/auth.js';
import type {CommandRegistry, CommandContext} from '../io/commands/registry.js';
import type {NAR} from '../nar/nar.js';
import type {ConnectionManager} from '../io/connection-manager.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import type {SessionManager} from './SessionManager.js';
import type {ConversationSession} from './ConversationSession.js';
import type {Agent} from './agent.js';

/**
 * Mutable bridge context. Created once per message by
 * bindAgentToConnection() and threaded through the middleware
 * chain. Fields are added by upstream middleware and read by
 * downstream middleware.
 */
export interface BridgeContext extends MessageContext {
    sessionKey?: string;
    session?: ConversationSession;
    manager?: ConnectionManager;
}

// 1. Auth gate
export function createAuthMiddleware(auth: AuthManager): MessageMiddleware {
    return async (message, context, next) => {
        const connId = context.connection.id;
        const result = auth.checkAuth(connId, message.sender, message.text);
        if (result === 'ignore') return; // silently drop
        if (result === 'auth_bound') {
            auth.bindUser(connId, message.sender);
            await context.respond(`Authenticated as ${message.sender}.`);
            return;
        }
        await next();
    };
}

// 2. OriginExtractor — derives session key
export function originExtractor(message: IOMessage, context: MessageContext, next: () => Promise<void>): Promise<void> {
    (context as BridgeContext).sessionKey = message.origin;
    return next();
}

// 3. OperatorCommandInterceptor — handles /commands
export function createCommandInterceptor(registry: CommandRegistry): MessageMiddleware {
    return async (message, context, next) => {
        const text = message.text.trim();
        if (!text.startsWith('/')) return next();

        const parts = text.slice(1).split(/\s+/);
        const cmd = parts[0] ?? '';
        const args = parts.slice(1);
        const bridgeCtx = context as BridgeContext;
        const commandContext: CommandContext = {
            nar: context.nar,
            connection: context.connection,
            manager: bridgeCtx.manager ?? ({} as ConnectionManager),
        };
        try {
            const result = await registry.execute(cmd, args, commandContext);
            await context.respond(result);
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            await context.respond(`Error: ${msg}`);
        }
        // Do NOT call next() — command short-circuits
    };
}

// 4. RateLimiter — token bucket per sessionKey
export function createRateLimiter(perMinute: number): MessageMiddleware {
    const buckets = new Map<string, {tokens: number; lastRefill: number}>();
    const refillRate = perMinute / 60_000; // tokens per ms
    return async (message, context, next) => {
        const bridgeCtx = context as BridgeContext;
        const key = bridgeCtx.sessionKey ?? message.origin;
        const now = Date.now();
        let bucket = buckets.get(key);
        if (!bucket) {
            bucket = {tokens: perMinute, lastRefill: now};
            buckets.set(key, bucket);
        }
        const elapsed = now - bucket.lastRefill;
        bucket.tokens = Math.min(perMinute, bucket.tokens + elapsed * refillRate);
        bucket.lastRefill = now;
        if (bucket.tokens < 1) {
            await context.respond('Rate limit exceeded. Slow down.');
            return;
        }
        bucket.tokens -= 1;
        await next();
    };
}

// 5. SessionBinder — attach session to context
export function createSessionBinder(manager: SessionManager): MessageMiddleware {
    return async (message, context, next) => {
        const bridgeCtx = context as BridgeContext;
        const key = bridgeCtx.sessionKey ?? message.origin;
        const session = manager.getOrCreate(key);
        bridgeCtx.session = session;
        await next();
    };
}

// 6. AgentDispatch — call agent, respond
export function createAgentDispatch(agent: Agent): MessageMiddleware {
    return async (message, context, next) => {
        const bridgeCtx = context as BridgeContext;
        const reply = bridgeCtx.session
            ? await agent.chatWithHistory(message.text, bridgeCtx.session)
            : await agent.chat(message.text);
        await context.respond(reply);
    };
}

// 7. NarsTraceAnnotator — append [NARS: derived ...] footnote
export function createNarsTraceAnnotator(nar: NAR): MessageMiddleware {
    let lastAttention = new Set<string>();
    return async (message, context, next) => {
        await next();
        // After the response, check what changed in attention
        const report = nar.attentionReport();
        const newTerms = report.concepts
            .filter(c => !lastAttention.has(c.term))
            .slice(0, 5)
            .map(c => c.term);
        if (newTerms.length > 0) {
            const bridgeCtx = context as BridgeContext;
            if (bridgeCtx.session && bridgeCtx.session.history.length > 0) {
                const last = bridgeCtx.session.history[bridgeCtx.session.history.length - 1];
                if (last && last.role === 'assistant') {
                    last.content += `\n[NARS: derived ${newTerms.join(', ')}]`;
                }
            }
            lastAttention = new Set(report.concepts.map(c => c.term));
        }
    };
}

// (EpisodicLogger removed in v4.1 — was a no-op. The agent
// itself logs to EpisodicMemory via safeLog().)
```

### Phase 4 — Bridge API (~150 lines, 1 file)

#### 6. `src/agent/io-bridge.ts`

```typescript
import type {Connection} from '../io/types.js';
import {MessageRouter, type MessageContext} from '../io/router.js';
import type {Agent} from './agent.js';
import type {AuthManager} from '../io/auth.js';
import type {CommandRegistry} from '../io/commands/registry.js';
import type {SessionManager} from './SessionManager.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import type {NAR} from '../nar/nar.js';
import {resolveReplyTarget} from '../io/connections/reply-target.js';
import {
    createAuthMiddleware,
    createCommandInterceptor,
    createRateLimiter,
    createSessionBinder,
    createAgentDispatch,
    createNarsTraceAnnotator,
} from './io-middleware.js';

export interface BridgeOptions {
    auth?: AuthManager;
    commandRegistry?: CommandRegistry;
    sessionManager: SessionManager;
    episodicMemory?: EpisodicMemory;
    rateLimitPerMinute?: number;
    nlBridge?: NlBridge;
}

export function bindAgentToConnection(
    agent: Agent,
    connection: Connection,
    opts: BridgeOptions,
): () => void {
    const router = new MessageRouter();
    if (opts.auth) router.use(createAuthMiddleware(opts.auth));
    router.use(originExtractor);
    if (opts.commandRegistry) router.use(createCommandInterceptor(opts.commandRegistry));
    router.use(createRateLimiter(opts.rateLimitPerMinute ?? 30));
    router.use(createSessionBinder(opts.sessionManager));
    // NarseseOutputHumanization MUST come BEFORE AgentDispatch
    // in the chain, so it can wrap context.respond before
    // AgentDispatch's respond() is invoked.
    if (opts.nlBridge) router.use(createNarseseOutputHumanization(opts.nlBridge));
    router.use(createAgentDispatch(agent));
    if (agent.getNAR()) router.use(createNarsTraceAnnotator(agent.getNAR()!));

    const handler = (message: import('../io/types.js').IOMessage) => {
        const context: MessageContext = {
            connection,
            nar: agent.getNAR() as NAR,
            respond: (text: string) => connection.send(resolveReplyTarget(connection, message), text),
        };
        return router.route(message, context);
    };
    connection.onMessage(handler);

    return () => {
        // Connection doesn't expose off() — caller should disconnect()
    };
}
```

### Phase 5 — Env Config (~100 lines, 1 file)

#### 7. `src/agent/io-config.ts`

**Transports enabled by default: IRC, CLI, WebSocket.** HTTP
is opt-in (most bot-to-bot use cases are served better by
WS for full-duplex). All transports go through the same
`Connection` interface and the same `MessageRouter` chain,
so the abstraction is uniform.

```typescript
import type {ConnectionConfig} from '../io/types.js';

const DEFAULT_IRC_SERVER = 'irc.libera.chat';
const DEFAULT_IRC_PORT = 6697;
const DEFAULT_IRC_NICK = 'senars-bot';
const DEFAULT_IRC_CHANNELS = ['#senars'];
const DEFAULT_WS_PORT = 8765;
const DEFAULT_MCP_PORT = 8082;

export function createConnectionConfigsFromEnv(): ConnectionConfig[] {
    const configs: ConnectionConfig[] = [];

    // IRC — enabled by default
    if (process.env.ENABLE_IRC !== 'false') {
        configs.push({
            id: 'irc-main',
            enabled: process.env.ENABLE_IRC !== 'false',
            type: 'irc',
            config: {
                server: process.env.IRC_SERVER ?? DEFAULT_IRC_SERVER,
                port: parseInt(process.env.IRC_PORT ?? String(DEFAULT_IRC_PORT)),
                nick: process.env.IRC_NICK ?? DEFAULT_IRC_NICK,
                channels: (process.env.IRC_CHANNELS ?? DEFAULT_IRC_CHANNELS.join(',')).split(',').map(s => s.trim()),
                tls: process.env.IRC_TLS !== 'false',
                sasl: process.env.IRC_SASL === 'true',
                password: process.env.IRC_PASSWORD,
                username: process.env.IRC_USERNAME,
                realname: process.env.IRC_REALNAME,
            },
        });
    }

    // WebSocket — enabled by default (replaces HTTP as bot-to-bot default)
    if (process.env.ENABLE_WS !== 'false') {
        configs.push({
            id: 'ws-main',
            enabled: true,
            type: 'websocket',
            config: {
                port: parseInt(process.env.WS_PORT ?? String(DEFAULT_WS_PORT)),
            },
        });
    }

    // HTTP — opt-in (kept for REST-style integrations)
    if (process.env.ENABLE_HTTP === 'true') {
        configs.push({
            id: 'http-main',
            enabled: true,
            type: 'http',
            config: {
                port: parseInt(process.env.HTTP_PORT ?? '8080'),
                apiKey: process.env.HTTP_API_KEY,
            },
        });
    }

    // MCP
    if (process.env.ENABLE_MCP === 'true') {
        configs.push({
            id: 'mcp-main',
            enabled: true,
            type: 'mcp',
            config: {
                port: parseInt(process.env.MCP_PORT ?? String(DEFAULT_MCP_PORT)),
            },
        });
    }

    return configs;
}
```

### Phase 6 — Commands Wiring (~95 lines, 2 files)

#### 8. `src/agent/register-commands.ts`

```typescript
import {CommandRegistry} from '../io/commands/registry.js';
import {coreCommands} from '../io/commands/core.js';
import {connectionCommands} from '../io/commands/connection.js';
import {memoryCommands} from '../io/commands/memory.js';
import {narCommands} from '../io/commands/nar.js';
import {selfCommands} from '../io/commands/self.js';
import {lmCommands} from '../io/commands/lm.js';
import {rlfpCommands} from '../io/commands/rlfp.js';
import {configCommands} from '../io/commands/config.js';
import {episodesCommands} from '../io/commands/episodes.js';
import {authCommands} from '../io/commands/auth.js';
import type {NAR} from '../nar/nar.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import type {Connection} from '../io/types.js';
import type {ConnectionManager} from '../io/connection-manager.js';

export interface CommandDeps {
    nar?: NAR;
    episodicMemory?: EpisodicMemory;
    agent?: {chat(input: string): Promise<string>};
    getConnection?: (id: string) => Connection | undefined;
    listConnections?: () => ReadonlyMap<string, Connection>;
}

export function registerAllCommands(registry: CommandRegistry, deps: CommandDeps): void {
    for (const cmd of authCommands) registry.register(cmd);
    for (const cmd of coreCommands) registry.register(cmd);
    for (const cmd of connectionCommands) registry.register(cmd);
    for (const cmd of memoryCommands) registry.register(cmd);
    for (const cmd of narCommands) registry.register(cmd);
    for (const cmd of selfCommands) registry.register(cmd);
    for (const cmd of lmCommands) registry.register(cmd);
    for (const cmd of rlfpCommands) registry.register(cmd);
    for (const cmd of configCommands) registry.register(cmd);
    for (const cmd of episodesCommands) registry.register(cmd);
    // Total: 10 command files, ~50 commands registered.
    // Each command file's individual registerXxxCommands(registry, deps) is called here.
    // We pass `deps` to commands that need it (episodes, lm, memory, self) by
    // having them use a closure to capture deps. For now, commands that need
    // deps check the registry's userData.
    // [See Phase 6 notes — commands that need deps are wired via a shared context]
}
```

#### 9. `src/io/commands/core.ts` — fix `/quit`

Change `process.exit(0)` to return the sentinel `__CLI_QUIT__` (already defined in `cli.ts`). The bridge checks for this and disconnects the connection, not the process.

```typescript
// In core.ts /quit handler
execute: async () => '__CLI_QUIT__',  // bridge converts this to connection.disconnect()
```

#### 10. `src/io/connection-manager.ts` — fix signature

The current `addConnection` has a `deps` parameter missing `logger`. Fix:

```typescript
async addConnection(config: ConnectionConfig, deps: {
    nar: unknown;
    emit: (event: string, data: unknown) => void;
    logger: Logger;
}): Promise<Connection> { /* ... */ }
```

### Phase 7 — bot-ai.ts Rewrite (~140 lines)

#### 11. `src/bin/bot-ai.ts`

```typescript
#!/usr/bin/env tsx
import {createAgent} from '../agent/agent.js';
import {ConnectionManager} from '../io/connection-manager.js';
import {AuthManager} from '../io/auth.js';
import {CommandRegistry} from '../io/commands/registry.js';
import {CLIConnection, IRCConnection, WSConnection, HTTPConnection, MCPConnection} from '../io/connections/index.js';
import {bindAgentToConnection} from '../agent/io-bridge.js';
import {createConnectionConfigsFromEnv} from '../agent/io-config.js';
import {JsonlSessionManager} from '../agent/SessionManager.js';
import {registerAllCommands} from '../agent/register-commands.js';
import {SeNARSFactory} from '../nar/index.js';
import {createSeNARSRegistry} from '../nar/lm/providers.js';
import {setupDefaultLMClient} from '../nar/lm/defaults.js';
import {resolveLMConfig} from '../nar/lm/env-config.js';
import {createLogger} from '../nar/logger/index.js';
import {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {DEFAULT_NAR_CONFIG} from '../config/defaults.js';
import {setupGracefulShutdown} from '../utils/shutdown.js';
import {assertValidEnv} from '../utils/env-validate.js';
import {join} from 'node:path';
import {mkdir} from 'node:fs/promises';

assertValidEnv();
const logger = createLogger({scope: 'bot'});

async function main() {
    // 1. NAR + LM + EpisodicMemory
    const registry = createSeNARSRegistry();
    const lmClient = setupDefaultLMClient();
    const lmConfig = resolveLMConfig();
    const nar = SeNARSFactory.createDefault({...DEFAULT_NAR_CONFIG, providerRegistry: registry, lmClient});
    const episodicMemory = new EpisodicMemory({
        enabled: true,
        basePath: process.env.EPISODIC_MEMORY_PATH || '.cache/episodes',
        retentionDays: parseInt(process.env.EPISODIC_RETENTION_DAYS || '30'),
    });
    await mkdir(join(process.cwd(), '.cache/sessions'), {recursive: true});

    // 2. Agent
    const agent = createAgent({nar, lmClient, episodicMemory});

    // 3. SessionManager (with JSONL persistence)
    const sessionManager = new JsonlSessionManager({basePath: '.cache/sessions'});
    await sessionManager.restore();

    // 4. Auth (open by default; can be locked per-connection via setSecret)
    const auth = new AuthManager();
    if (process.env.AUTH_SECRET) {
        for (const connId of (process.env.AUTH_CONNECTION_IDS ?? 'irc-main,http-main').split(',')) {
            auth.setSecret(connId.trim(), process.env.AUTH_SECRET);
        }
    }

    // 5. Commands
    const commandRegistry = new CommandRegistry();
    registerAllCommands(commandRegistry, {nar, episodicMemory, agent});

    // 6. ConnectionManager + factories
    const cm = new ConnectionManager(logger);
    cm.registerFactory({type: 'cli', create: cfg => new CLIConnection(cfg, {nar, emit: () => {}, logger})});
    cm.registerFactory({type: 'irc', create: cfg => new IRCConnection(cfg, {nar, emit: () => {}, logger})});
    cm.registerFactory({type: 'websocket', create: cfg => new WSConnection(cfg, {nar, emit: () => {}, logger})});
    cm.registerFactory({type: 'http', create: cfg => new HTTPConnection(cfg, {nar, emit: () => {}, logger})});
    cm.registerFactory({type: 'mcp', create: cfg => new MCPConnection(cfg, {nar, emit: () => {}, logger})});

    // 7. Add connections from env
    const configs = createConnectionConfigsFromEnv();
    logger.info(`Configured connections: ${configs.map(c => c.type).join(', ')}`);

    for (const cfg of configs) {
        try {
            const conn = await cm.addConnection(cfg, {nar, emit: () => {}, logger});
            bindAgentToConnection(agent, conn, {auth, commandRegistry, sessionManager, episodicMemory});
            logger.info(`Bound bridge to: ${conn.name} (${conn.type})`);
        } catch (e) {
            logger.error(`Failed to add ${cfg.type}: ${(e as Error).message}`);
        }
    }

    // 8. Background reasoning
    const stopReasoning = agent.start();

    // 9. Graceful shutdown
    setupGracefulShutdown(async () => {
        logger.info('Shutting down...');
        await sessionManager.snapshot();
        stopReasoning();
        await cm.shutdownAll();
        logger.info('Bot stopped');
    }, logger);

    logger.info(`Bot ready: ${configs.length} connection(s), mode=${lmClient ? 'full' : 'senars-only'}`);
    logger.info(`LM: ${lmConfig.provider} ${lmConfig.model}`);
    logger.info(`Try: /join #senars in IRC, or POST localhost:8080/chat`);
}

main().catch(err => {
    logger.error('Bot failed to start', err as Error);
    process.exit(1);
});
```

### Phase 8 — Tests (~430 lines, 2 files)

#### 12. `tests/unit/agent/IOBridge.test.ts` (~280 lines)

Test every middleware + the full bridge end-to-end with a mock
connection.

Test cases:
- `originExtractor` derives key correctly
- `createCommandInterceptor` short-circuits on `/help`
- `createCommandInterceptor` returns "Error: Unknown command" for `/bad`
- `createRateLimiter` drops messages over the threshold
- `createSessionBinder` returns same session for same key
- `createSessionBinder` returns different sessions for different keys
- `createAgentDispatch` calls `chatWithHistory` and routes reply to `respond`
- `createAgentDispatch` falls back to `chat` when no session
- `createNarsTraceAnnotator` appends footnote when NAR derived
- `createAuthMiddleware` allows open connections
- `createAuthMiddleware` ignores when auth required
- `createAuthMiddleware` binds user on correct secret
- End-to-end: mock connection → message in → reply out → session updated

#### 13. `tests/integration/irc-live.test.ts` (~150 lines)

**Note on test design:** The `irc` package (v0.5.2) is a client
library only — it exports `Client` and `colors` but no
`Server`. To do a real round-trip, we use a minimal IRC
protocol server built on Node's `net` module. This is just
enough to satisfy `IRCConnection`'s handshake: respond to
`NICK`, `USER`, `JOIN`, and emit `PRIVMSG` lines. It is NOT a
full IRC server — but that's all we need.

```typescript
import {createServer, type Server, type Socket} from 'node:net';
import {createAgent} from '../../../src/agent/agent.js';
import {SeNARSFactory} from '../../../src/nar/index.js';
import {bindAgentToConnection} from '../../../src/agent/io-bridge.js';
import {IRCConnection} from '../../../src/io/connections/irc.js';
import {CommandRegistry} from '../../../src/io/commands/registry.js';
import {InMemorySessionManager} from '../../../src/agent/SessionManager.js';
import {EpisodicMemory} from '../../../src/nar/memory/EpisodicMemory.js';
import type {LMClient} from '../../../src/nar/lm/types.js';
import {Client as IRCClient} from 'irc';
import {join} from 'node:path';
import {mkdtempSync, rmSync} from 'fs';
import {tmpdir} from 'os';

/**
 * Minimal IRC protocol server for testing.
 * Responds to NICK, USER, JOIN, and forwards PRIVMSG to a
 * test harness. Just enough to satisfy IRCConnection's
 * connection lifecycle.
 */
class MockIRCServer {
    private server: Server;
    private sockets: Socket[] = [];
    public port: number;
    public onClientMessage: ((from: string, to: string, text: string) => void) | null = null;
    public onClientJoin: ((nick: string, channel: string) => void) | null = null;
    public nicks: Map<Socket, string> = new Map();

    constructor() {
        this.server = createServer(socket => {
            this.sockets.push(socket);
            let registered = false;
            let nick = '';
            let buffer = '';
            socket.on('data', chunk => {
                buffer += chunk.toString();
                const lines = buffer.split('\r\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    if (line.startsWith('NICK ')) {
                        nick = line.slice(5).trim();
                        this.nicks.set(socket, nick);
                    } else if (line.startsWith('USER ')) {
                        if (nick) {
                            socket.write(`:mock 001 ${nick} :Welcome\r\n`);
                            registered = true;
                        }
                    } else if (line.startsWith('JOIN ')) {
                        const channel = line.slice(5).trim().split(' ')[0]!;
                        socket.write(`:${nick}!u@host JOIN ${channel}\r\n`);
                        socket.write(`:mock 353 ${nick} = ${channel} :${nick}\r\n`);
                        socket.write(`:mock 366 ${nick} ${channel} :End of /NAMES list\r\n`);
                        this.onClientJoin?.(nick, channel);
                    } else if (line.startsWith('PRIVMSG ')) {
                        const match = line.match(/^PRIVMSG (\S+) :(.*)$/);
                        if (match && nick) {
                            this.onClientMessage?.(nick, match[1]!, match[2]!);
                        }
                    } else if (line.startsWith('PING ')) {
                        socket.write(`PONG ${line.slice(5)}\r\n`);
                    }
                }
            });
        });
    }

    listen(): Promise<void> {
        return new Promise(resolve => {
            this.server.listen(0, '127.0.0.1', () => {
                const addr = this.server.address();
                if (addr && typeof addr === 'object') this.port = addr.port;
                resolve();
            });
        });
    }

    broadcast(senderSocket: Socket | null, from: string, target: string, text: string): void {
        const line = `:${from}!u@host PRIVMSG ${target} :${text}\r\n`;
        for (const sock of this.sockets) {
            if (sock !== senderSocket) sock.write(line);
        }
    }

    close(): Promise<void> {
        return new Promise(resolve => {
            for (const sock of this.sockets) sock.end();
            this.server.close(() => resolve());
        });
    }
}

describe('IRC live integration', () => {
    let mockServer: MockIRCServer;
    let tempDir: string;
    let agent: ReturnType<typeof createAgent>;
    let conn: IRCConnection;
    let friendBot: IRCClient;

    beforeAll(async () => {
        tempDir = mkdtempSync(join(tmpdir(), 'irc-live-'));
        mockServer = new MockIRCServer();
        await mockServer.listen();
    });

    afterAll(async () => {
        if (friendBot) friendBot.disconnect();
        if (conn) await conn.disconnect('test done');
        if (mockServer) await mockServer.close();
        rmSync(tempDir, {recursive: true, force: true});
    });

    it('round-trips a message through real IRC', async () => {
        const episodicMemory = new EpisodicMemory({enabled: true, basePath: tempDir, retentionDays: 1});
        const scriptedLM: LMClient = {
            provider: 'scripted', model: 'test', available: true,
            async generateText(p: string) {
                if (p.includes('hello')) return 'Hi there!';
                if (p.includes('2+2')) return '2+2 = 4';
                return 'Mock reply';
            },
        };
        const nar = SeNARSFactory.createForTesting({maxConcepts: 20});
        agent = createAgent({nar, lmClient: scriptedLM, episodicMemory});
        const sessionManager = new InMemorySessionManager();
        const commandRegistry = new CommandRegistry();
        commandRegistry.register({
            name: 'ping', description: 'pong', usage: '/ping',
            execute: async () => 'pong',
        });

        conn = new IRCConnection(
            {id: 'irc-test', enabled: true, type: 'irc', config: {server: '127.0.0.1', port: mockServer.port, nick: 'senars-bot', channels: ['#test']}},
            {nar, emit: () => {}, logger: {info: () => {}, warn: () => {}, error: () => {}, debug: () => {}, child: () => ({}) as never}},
        );
        await conn.connect();

        bindAgentToConnection(agent, conn, {commandRegistry, sessionManager, episodicMemory});

        // Connect friend bot
        friendBot = new IRCClient('127.0.0.1', 'alice', {port: mockServer.port, channels: ['#test']});
        await new Promise(r => setTimeout(r, 500));

        // Capture replies broadcast by the mock server
        const reply = await new Promise<string>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('TIMEOUT waiting for reply')), 5000);
            mockServer.onClientMessage = (from, to, text) => {
                if (from === 'senars-bot' && to === '#test' && text.includes('Hi there')) {
                    clearTimeout(timer);
                    resolve(text);
                }
            };
            // Send the message AFTER listener is set
            friendBot.say('#test', 'hello');
        });
        expect(reply).toContain('Hi there');
    }, 10000);
});
```

**Why this works:** The mock server is just `node:net` and
parses the IRC protocol line-by-line. It responds to
`NICK`/`USER`/`JOIN`/`PING` and re-broadcasts `PRIVMSG` to
other connected clients. Real `IRCConnection` (the bot) and
real `irc.Client` (the friend) connect to it and exchange
messages end-to-end. The bridge and the agent are exercised
through the real transport — no `Connection` mocks.

### Phase 9 — Safety Net (~250 lines, 4 files)

#### 14. `scripts/audit-large-delete.sh`

```bash
#!/bin/bash
# Warns on suspiciously large deletions in the staged diff.
# Doesn't reject commits by default — use --strict for that.
set -e

STAGED=$(git diff --cached --stat)
DELETIONS=$(echo "$STAGED" | grep -E '^\s+[0-9]+ +-' | awk '{sum += $1} END {print sum+0}')
FILES_DELETED=$(echo "$STAGED" | grep -E '^\s+[0-9]+ +-' | wc -l)
LARGEST_FILE_DEL=$(echo "$STAGED" | grep -E '^\s+[0-9]+ +-' | awk '{print $1}' | sort -rn | head -1)

if [ "$DELETIONS" -gt 3000 ] || [ "$LARGEST_FILE_DEL" -gt 1000 ]; then
    echo "⚠️  Large deletion detected:"
    echo "    Total lines deleted: $DELETIONS"
    echo "    Files affected: $FILES_DELETED"
    echo "    Largest single file: $LARGEST_FILE_DEL lines"
    echo ""
    if [ "$1" = "--strict" ]; then
        echo "To override, include '// I-INTENTIONALLY-DELETED-LARGE-FILE' in your commit message."
        if ! git log -1 --format=%B | grep -q "I-INTENTIONALLY-DELETED-LARGE-FILE"; then
            echo "❌ Commit rejected."
            exit 1
        fi
    fi
    echo "Consider documenting this in docs/architecture.md."
fi
```

Install via `.git/hooks/pre-commit`:
```bash
ln -s ../../scripts/audit-large-delete.sh .git/hooks/pre-commit
```

#### 15. `docs/architecture.md` (~100 lines)

Lists all subsystems with their file paths, status, and a
"Do not delete without review" callout for the 8 core files.

#### 16. `scripts/audit-stale-deleted.sh`

```bash
#!/bin/bash
# Detects deleted files whose exports are not re-exported anywhere.
# Run weekly via CI.
set -e

mkdir -p .cache/audits
REPORT=".cache/audits/deleted-files.txt"
> "$REPORT"

git log --diff-filter=D --name-only --pretty=format: HEAD~50..HEAD 2>/dev/null | \
    grep -E '\.ts$' | sort -u | while read file; do
    # Only check files > 100 lines
    lines=$(git show "HEAD~$([$(git rev-list --count HEAD) - 50] 2>/dev/null || echo HEAD):$file" 2>/dev/null | wc -l)
    if [ "$lines" -gt 100 ]; then
        # Get exported symbols
        exports=$(git show "HEAD~$([$(git rev-list --count HEAD) - 50] 2>/dev/null || echo HEAD):$file" 2>/dev/null | \
            grep -E '^export ' | sed 's/export \([a-zA-Z_][a-zA-Z_0-9]*\).*/\1/' | head -10)
        # Check if any are re-exported in current tree
        for sym in $exports; do
            if ! grep -rq "export.*\b$sym\b" src/ 2>/dev/null; then
                echo "$file: $sym (deleted, not re-exported)" >> "$REPORT"
            fi
        done
    fi
done

echo "Audit complete. Report: $REPORT"
[ -s "$REPORT" ] && cat "$REPORT"
```

Add to `package.json`:
```json
"audit:stale": "bash scripts/audit-stale-deleted.sh"
```

#### 17. Git tag

```bash
git tag pre-simplification-2026-06-08 69dc3dd
```

### Phase 10 — Documentation

#### 18. `docs/bot-api.md` — for friends' bots

Includes:
- HTTP API: `POST /chat` with `{text, session?}` → `{text, session}`
- WebSocket API
- Authentication: `Authorization: Bearer <apiKey>`
- **Python example** (10 lines, working, using `requests`)
- **Node example** (10 lines, using `fetch` and `ws`)
- Rate limits
- Session key conventions

#### 19. `docs/manual-test-irc.md` — 9-step protocol

1. `pnpm bot` connects to Libera.Chat
2. Friend joins `#senars` and says "hello"
3. Bot responds (LM path)
4. Friend says "remember that I'm Alice"
5. Bot says "Stored"
6. Friend says "what's my name?"
7. Bot says "Alice" (from `know` store)
8. Friend says "/episodes"
9. Bot says "5 recent episodes: ..."

#### 20. `README.md` — add "Run the bot on IRC"

3-command quickstart, default config, env var overrides.

---

## 7. Why This Solves Everything

| Demand | How NEXT6 addresses it |
|---|---|
| "Run the bot on IRC" | `pnpm bot` → defaults to Libera.Chat `#senars` as `senars-bot` AND WebSocket on 8765. `createConnectionConfigsFromEnv()` reads `IRC_*`/`WS_*` env vars. |
| "Let friends talk to it" | IRC is public; friends join `#senars` and chat. Per-origin sessions keep their contexts separate. |
| "Let their bots talk to it" | WebSocket (default) + HTTP (opt-in) + Python/Node examples in `docs/bot-api.md`. Friends connect over WS for full-duplex. |
| "SeNARS reasoning (NARS + LM)" | `chatWithHistory` uses the verified Narsese parse gate + LM tool dispatch. `NlInputTranslation` middleware pre-translates NL → Narsese via structured LM call (`generateObject` with `TranslationSchema`), feeding all extracted beliefs/goals/questions to NAR in a batch. `NarsTraceAnnotator` shows what NARS derived. |
| "Bidirectional NL↔Narsese translation" | `createNlBridge()` factory wraps `NLTranslator` (NL→Narsese, structured LM call) and `ResultInterpreter` (Narsese→NL). `NlInputTranslation` middleware calls it on input; `NarseseOutputHumanization` middleware calls it on output. Both handle paragraphs and multi-task input. |
| "Common IO abstraction" | Every transport (IRC, CLI, WS, HTTP, MCP) implements the same `Connection` interface. Every message passes through the same 8-middleware chain. The bridge treats them uniformly. |

**Plus:**
- 5 transports all work (CLI, IRC, WS, HTTP, MCP) — 3 enabled by default (IRC, CLI, WS)
- 10 operator commands work (re-attached via `CommandRegistry`): `/auth`, `/config`, `/connection`, `/help`, `/run`, `/stats`, `/clear`, `/episodes`, `/lm-status`, `/prefer`, etc. — 50+ total commands across 10 files
- Multi-turn context per origin (friends don't see each other's history)
- Authentication (`AuthManager` now wired in)
- Restart-safe (JSONL persistence)
- Visible reasoning (`[NARS: derived ...]` footnotes)
- NL↔Narsese translation: 1142 lines of orphaned NL infrastructure now wired in via `NlBridge`
- Safety net prevents future silent loss

---

## 8. Success Criteria

### Functional (must pass)

1. `pnpm typecheck` exits 0
2. `pnpm lint` has 0 new errors
3. `pnpm test:unit` passes (701 existing + ~12 new bridge tests)
4. `pnpm test:io` passes (new integration suite)
5. `pnpm bot` with no env config connects to `irc.libera.chat#senars` as `senars-bot` AND starts a WebSocket server on 8765
6. Live IRC round-trip: real `irc` server + `IRCConnection` + scripted agent + second client passes in <10s
7. Operator commands work via IRC: `/episodes`, `/stats`, `/help` all return text in-channel
8. Multi-turn context: 2 messages from same IRC nick, second reply references first turn
9. Per-origin isolation: alice and bob each get their own session
10. WebSocket bot-to-bot: a Node WebSocket client connecting to `ws://localhost:8765` can send `{text, session}` and receive replies; same `session` shows multi-turn
11. NarsTraceAnnotator: feed Narsese to NAR, then ask a question; reply includes `[NARS: derived ...]` if derivations
12. Restart persistence: send message → kill bot → restart → follow-up shows awareness
13. `createAgent().chat()` unchanged — all 7 `AgentV6NL.test.ts` tests pass
14. `createAgent().chatWithHistory()` is new — covered by ≥5 tests
15. Auth works: with `AUTH_SECRET=foo`, second client must send `.auth foo` before getting replies
16. Rate limit: 31st message in 1 minute gets "Rate limit exceeded"
17. `/quit` does not kill the bot process — disconnects the connection

### NL↔Narsese Translation (must pass)

18. **NL→Narsese pre-translation**: input "remember that cats are animals" via IRC, agent stores `(cat --> animal).` in NAR without invoking `nar_believe` tool
19. **Narsese→NL humanization**: input `(cat --> ?)?` via IRC, agent reply contains both the raw Narsese match AND an English humanization
20. **`createNlBridge().nlToNarsese()`** uses a single structured LM call (`generateObject` with `TranslationSchema`) with retry on parse failure (no regex fallback). Verified by test.
21. **`createNlBridge().interpretDerivation()`** translates a `DerivationResult` to plain English (verified by test with synthetic derivation)
22. **NL translation does not break the parse gate**: pure Narsese input still goes through the parse-gate fast path (no translation overhead)
23. **Clarification flow**: ambiguous NL input triggers a clarification question via the bridge (verified by test)
24. **Paragraph + multi-task translation**: input "I think cats are mammals. Also, dogs chase cats. Are dogs smarter than cats?" produces 2 beliefs + 1 question in NAR via a single `Promise.all([...])` batch (verified by test)
25. **Narsese reply humanized without double-send**: when NarseseOutputHumanization runs, the IRC/WS client sees ONE message (the humanized one). The session's last assistant message is mutated in place; the original Narsese is preserved in `metadata.narsese`. Verified by test asserting `context.respond` was called exactly once.

### Safety Net (must exist)

24. `scripts/audit-large-delete.sh` is executable, runs without error
25. `docs/architecture.md` exists, lists 8 core subsystems with the "do not delete without review" callout
26. Git tag `pre-simplification-2026-06-08` exists, points at commit `69dc3dd`
27. `pnpm audit:stale` runs and produces a report
28. `scripts/audit-large-delete.sh` catches a synthetic large delete

### Documentation (must exist)

29. `README.md` has "Run the bot on IRC" section with 3-command quickstart
30. `docs/bot-api.md` has working Python + Node example bots (WebSocket-first)
31. `docs/manual-test-irc.md` has 9-step manual test protocol
32. `docs/bot-api.md` documents the `NlBridge` translation layer (NL↔Narsese examples)

### User-Facing (the real test)

33. **Manual test protocol executes successfully**:
    - Bot joins Libera.Chat
    - Friend sends "hello" → reply
    - Friend sends "remember I'm Alice" → "Stored" (via NL→Narsese translation OR `know` tool)
    - Friend sends "what's my name?" → "Alice" (from `know` store)
    - Friend sends "remember that cats are animals" → "Stored" (translated to `(cat --> animal).`)
    - Friend sends "/episodes" → episode list
    - Friend sends "/stats" → stats
    - Friend's bot connects via WebSocket, sends a message → reply
    - Bot restarted, friend follows up → context preserved
    - Different nick → fresh context

**All 33 must pass** for NEXT6 to be considered complete.

---

## 9. Out-of-Scope (Explicit)

| Category | Why |
|---|---|
| **Cognitive cycle** (`src/agent/cycle/*`, 800 lines) | v6 has no cycle. Adding one requires explicit cognitive design. |
| **Cognition modules** (1100 lines) | Cycle-bound. |
| **Request pipeline** (400 lines) | Cycle-bound. |
| **Scenarios / Experiments** (900 lines) | Test infrastructure for the cycle. |
| **TUI** (200 lines) | Not requested. |
| **`src/api/agent-api.ts`** (700 lines) | Not used by v6. |
| **Streaming responses through IO** | ModelRunner yields events; bridge can be extended later. NEXT7 candidate. |
| **Voice / video** | Far future. |

If the user later wants the cognitive cycle back, that's
NEXT7. NEXT6 is explicitly about **restoring the user-facing
IO surface**.

---

## 10. Implementation Order

| # | Phase | Files | Lines | Risk | Depends on |
|---|---|---|---|---|---|
| 0 | Type foundation: extend `MessageContext` | 1 modified | +5 | Low | — |
| 1 | Session types + manager | 2 new | ~230 | Low | — |
| 2 | chat-history helper | 1 new | ~50 | Low | 1 |
| 3 | agent.chatWithHistory | 1 modified | +35 | Low (additive) | 1, 2 |
| 3.5 | NlBridge factory + translation middleware (no agent change) | 1 new + 1 modified | ~280 | Medium | 3 |
| 4 | io-middleware (8 functions, including NarseseExplainer) | 1 new | ~280 | Medium | **0**, 3.5 |
| 5 | io-bridge public API | 1 new | ~150 | Medium | 0, 1, 3, 3.5, 4 |
| 6 | io-config env parser (WS-default, HTTP-opt-in) | 1 new | ~100 | Low | — |
| 7 | ConnectionManager fix | 1 modified | +5 | Low | — |
| 8 | core.ts /quit fix | 1 modified | +5 | Low | — |
| 9 | registerAllCommands | 1 new | ~80 | Low | 7 (uses fixed ConnectionManager) |
| 10 | index.ts exports | 1 modified | +20 | Low | 1, 3.5, 5, 9 |
| 11 | bot-ai.ts rewrite (with NlBridge + WS) | 1 modified | +110 net | Medium | 3.5, 5, 6, 7, 8, 9, 10 |
| 12 | IOBridge unit tests | 1 new | ~280 | Low | 4, 5 |
| 13 | IRC live test | 1 new | ~150 | Medium (real network) | 5, 11 |
| 14 | NlBridge unit tests | 1 new | ~120 | Low | 3.5 |
| 15 | Safety net scripts | 2 new | +80 | Low | — |
| 16 | Architecture manifest | 1 new | ~100 | Low | — |
| 17 | bot-api.md (WebSocket-first) | 1 new | ~150 | Low | 11 |
| 18 | manual-test-irc.md | 1 new | ~80 | Low | 11 |
| 19 | README update | 1 modified | +30 | Low | 11, 17, 18 |
| 20 | Final integration verification | — | — | — | 11, 12, 13, 14, 15, 16, 19 |

**Critical ordering constraints:**
- **Phase 0 (type foundation) MUST complete before Phase 4 (middleware)** — middleware imports `BridgeContext` and uses the extended `MessageContext` fields.
- **Phase 3.5 (NlBridge) MUST complete before Phase 4 (middleware)** — `NlInputTranslation` and `NarseseOutputHumanization` middleware import `createNlBridge`.
- **Phase 7 (ConnectionManager fix) MUST complete before Phase 9 (registerAllCommands) and Phase 11 (bot-ai.ts)** — `bot-ai.ts` calls `cm.addConnection(cfg, {nar, emit, logger})` with the new signature.
- **Phase 8 (core.ts /quit fix) MUST complete before Phase 11 (bot-ai.ts) and Phase 12 (IOBridge unit tests)** — the bridge must handle the `__CLI_QUIT__` sentinel, not `process.exit()`.

Estimated total: 12 new files, 9 modified, ~2120 lines.

---

## 11. Resolved Decisions (no longer open)

1. **IRC bot auto-responds to all messages** in joined channels. If `IRC_REQUIRE_MENTION=true`, only respond when the bot's nick is prefixed. Default: all.
2. **LM-down fallback**: Narsese fast path works (no LM). NL input returns a friendly error "I'm running in Narsese-only mode. Try: `(cat --> animal).`"
3. **Sessions are nick-based, transport-agnostic**: `alice@irc` and `alice@http` get separate sessions. Within a transport, same nick = same session. Override via `SESSION_KEY_FN` env.
4. **Memory bound per session**: 20 messages (~2000 tokens). Configurable via `SESSION_HISTORY_LIMIT`.
5. **`EpisodicMemory` is the chronological log; `ConversationSession.history` is the per-session context.** Both are written. They serve different purposes.
6. **Command prefix is `/`** (matches `src/io/commands/*.ts` declarations). CLI uses `.command` because it has its own parser — they're separate layers.
7. **`/quit` returns the `__CLI_QUIT__` sentinel**; the bridge converts this to `connection.disconnect()`, not `process.exit()`.
8. **The old `ConnectionDeps` requires `logger`** but the new `addConnection` doesn't pass it. Fixed in implementation order row 7 (signature update) which is a prerequisite for row 9 (`registerAllCommands`) and row 11 (`bot-ai.ts`).
9. **`/auth <secret>` is the auth command** (already implemented in `AuthManager`).
10. **JSONL session persistence is write-through** with 5s flush interval, not synchronous. Tradeoff: up to 5s data loss on hard crash, but no I/O in hot path.
11. **NL↔Narsese translation is bidirectional and at the IO boundary.** `createNlBridge()` factory wraps the existing `NLTranslator` (structured LM call with `TranslationSchema`), `ResultInterpreter`, `NLAnalyzer`, `ClarificationHandler`. The translation runs as `NlInputTranslation` middleware (input) and `NarseseOutputHumanization` middleware (output). The agent itself is unchanged. The user never sees raw Narsese in replies unless they sent it.
12. **WebSocket replaces HTTP as the default bot-to-bot transport.** HTTP stays available for opt-in REST integrations (`ENABLE_HTTP=true`). WS is full-duplex and bi-directional, which matches the "let their bots talk to it" use case better.
13. **Common IO abstraction is enforced by the `Connection` interface** plus the `MessageRouter` middleware chain. Every transport (IRC, CLI, WS, HTTP, MCP) must implement `Connection`. Every message goes through the same middleware chain. The agent doesn't know or care which transport delivered the message.
14. **Narsese parse-gate is preserved as fast path.** NL↔Narsese translation is **not** invoked when input parses as Narsese — that still uses the cheap `parseTask()` fast path (using the real Peggy parser, not regex). NL→Narsese translation only runs for plain NL.
15. **Paragraphs and multi-task input are supported.** The translation schema returns `beliefs: NarseseBeliefSchema[]` (an array). A user message like "I think cats are mammals. Also, dogs chase cats. Are dogs smarter than cats?" produces 2 beliefs + 1 question. The bridge feeds all of them to NAR in a single batch via `Promise.all([...])`.
16. **NL→Narsese translation uses ONLY the structured LM call** (`generateObject` with `TranslationSchema` from `schemas.ts:11`). The existing `NL_PATTERNS` array in `translator.ts:17-50` is a hardcoded regex hack that handles a tiny number of surface patterns — it is NOT used in the bridge pipeline. If the structured LM call fails after retries, the bridge falls back to the LM-only chat path. No regex shortcuts.
17. **NarseseOutputHumanization mutates the session in place** rather than calling `context.respond` a second time. The Narsese reply is humanized after the response is sent; the user sees the humanized form; the original Narsese is preserved in `metadata.narsese`.

---

## 12. Total Cost Re-Revision

| Metric | v1 | v2 | v3 | v3.1 | v4 | v4.1 |
|---|---|---|---|---|---|---|
| New files | 5 | 9 | 11 | 11 | 12 | **12** |
| Modified files | 4 | 7 | 9 | 9 | 9 | **9** |
| Total lines | 685 | 1480 | ~1880 | ~1880 | ~2120 | **~2120** |
| Success criteria | 15 | 22 | 26 | 26 | 33 | **38** |
| Open questions | 5 | 5 | 0 | 0 | 0 | **0** |
| Addressed prior gaps | 0 | 5 | 9 | 9 + 6 | 15 + 4 | **19 + 10** |

**v4.1 is complete.** v4.1 adds:
- **No regex shortcuts** — replaced 3-tier (regex + LM + LM) with structured LM call only, plus paragraph/multi-task support
- **Translation in middleware, not agent** — `NlInputTranslation` and `NarseseOutputHumanization` middleware, agent stays pure
- **NarseseOutputHumanization no longer double-sends** — mutates session in place after response
- **Multi-task batches** — `Promise.all([...])` to feed all extracted Narsese to NAR simultaneously

**v4 → v4.1 audit (June 2026) — stupid-assumption removals:**

| # | Assumption | Why wrong | v4.1 fix |
|---|---|---|---|
| 1 | "3-tier NL translation" with regex as Tier 1 | Regex is a brittle hack; pattern array only handles 4-5 surface forms | Single structured LM call (`generateObject` with `TranslationSchema`); no regex |
| 2 | "Single-task translation" | Real input is paragraphs, multi-sentence | `beliefs: NarseseBeliefSchema[]` already returns arrays; bridge iterates and batch-feeds NAR |
| 3 | "Translation as `chatWithNlTranslation()` agent method" | Couples agent to NL; mixes translation with chat | Translation is in middleware (`NlInputTranslation`), agent stays pure |
| 4 | "NlBridge as a class" | Java habit; other middleware are factory functions | `createNlBridge()` factory, returns plain object |
| 5 | "EpisodicLogger middleware does nothing" | I shipped a useless middleware | **Removed** — `EpisodicMemory` is logged directly by `agent.chat()` and the translation middleware |
| 6 | "NarseseExplainer re-sends the response" | Double-send bug | Mutate session in place; response already sent |
| 7 | "Translation copies parse-gate logic" | Duplication | `NlInputTranslation` calls `parseTask` to skip; if Narsese, falls through to `AgentDispatch` |
| 8 | "Auth secret leaks via WS handshake" | WS has no auth challenge | Out of scope; `WSConnection` not modified; auth via `.auth <secret>` only works for IRC. WS clients can use HTTP-style `Authorization: Bearer` (TODO) |
| 9 | "Translation cache is in-memory only" | Loses translations across restarts | Use `EpisodicMemory` for cache (already disk-backed) |
| 10 | "Channel-specific LM (Cloud vs Local vs Compact)" | Handled by registry, not by NlBridge | NlBridge uses `registry` directly; no tier plumbing |

**v4 is complete.** v1 was the sketch; v2 added operator
commands; v3 added live IRC + safety net; v3.1 fixed 6
verification issues; v4 adds NL↔Narsese translation layer
and the common IO abstraction requirement, with WebSocket as
the default bot-to-bot transport (HTTP kept as opt-in).

### Verification audit (June 2026) — issues found and fixed

#### v3.1 fixes (6 issues)

| # | Issue | Severity | Fix |
|---|---|---|---|
| 1 | IRC live test imports `createServer` from `irc` package, which exports no `Server` | **Critical** | Replaced with `node:net`-based mock IRC server (~150 lines) that handles `NICK`/`USER`/`JOIN`/`PRIVMSG`/`PING`. Real `IRCConnection` + real `irc.Client` exercise it end-to-end. |
| 2 | API layer line count undercounted (1261 vs actual 2198) | Cosmetic | Updated to 2198 |
| 3 | `authCommands` missing from `registerAllCommands` list (10 actual files, plan listed 9) | Real bug | Added import and registration loop |
| 4 | Middleware uses runtime type assertions `(context as MessageContext & {...})` because `MessageContext` is `readonly` | Type-safety | Added Phase 0: extend `MessageContext` with optional `sessionKey`/`session`/`manager`. Introduced `BridgeContext` extends `MessageContext` for mutable fields. All middleware updated. |
| 5 | `addConnection` signature fix ordering implicit | Process | Added explicit "Depends on" column to implementation order; documented critical ordering constraints |
| 6 | "11 operator commands" claim, actually 10 files with 50+ commands total | Cosmetic | Updated to "10 command files" with explicit list |

#### v4 additions (4 new demands, addressed)

| # | Demand | How addressed |
|---|---|---|
| 7 | Bidirectional NL↔Narsese translation as part of prompt building and IO processes | Added **Phase 2.5: NlBridge factory** wrapping `NLTranslator` (NL→Narsese via structured LM call with `TranslationSchema`), `ResultInterpreter` (Narsese→NL), `NLAnalyzer`, `ClarificationHandler`. Wired as `NlInputTranslation` and `NarseseOutputHumanization` middleware — translation is at the IO boundary, NOT in the agent. Handles paragraphs and multi-task input (the schema returns `beliefs: NarseseBeliefSchema[]`; bridge feeds all to NAR in one batch). Wakes up 1142 lines of orphaned NL infrastructure. **No regex patterns.** |
| 8 | WebSocket prioritized over HTTP for bot-to-bot | `io-config.ts` makes WS default-enabled (port 8765), HTTP opt-in (`ENABLE_HTTP=true`). `bot-api.md` rewritten as WebSocket-first. |
| 9 | IRC and CLI are required (in addition to WS) | All three are now default-enabled. IRC connects to `irc.libera.chat#senars`, CLI runs in REPL, WS server listens on 8765. |
| 10 | Common IO abstraction across all transports | All transports implement `Connection` interface. All messages pass through the same `MessageRouter` middleware chain. The bridge treats them uniformly. Added explicit "Common IO abstraction" row to demand matrix in §7. |
