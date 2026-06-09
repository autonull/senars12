# SeNARS Agent v6 — The Harness

> **Target:** A minimal agent harness that connects a Language Model
> to NAR's cognitive engine. The LM decides everything. The agent
> provides tools, context, and lifecycle — nothing more. It parses
> input as Narsese first (cheap, deterministic); if not Narsese, it
> delegates to the LM which has full access to NAR via tools.
> Reasoning is async and throttleable. The agent responds even while
> reasoning is paused.

---

## 1. Executive Summary

NEXT4 (round 3) proposed "dispatch by trailing punctuation" — the
agent reads the Narsese output's terminal character and calls the
right NAR method. That's a hack disguised as architecture. The
real question is: **why is the agent interpreting Narsese at all?**

The LM already has `nar_believe`, `nar_goal`, `nar_question` as
tools. If the input is Narsese, feed it to NAR directly (no LM
needed — it's already formal). If it's natural language, the LM
decides what to do with NAR's tools. The agent doesn't need a
dispatch model. It needs a **parse gate** and a **tool harness**.

**v6 (the harness) replaces dispatch with delegation:**

- **Parse gate:** `parseTask(input)` — if valid Narsese, feed NAR
  directly. Zero LM cost. Deterministic.
- **Tool harness:** If not Narsese, send to LM with NAR tools.
  The LM decides: believe, goal, question, search, reason —
  whatever it needs.
- **No intent routing.** No regex classification. No correction
  detection. The LM handles all of this through conversation
  context and tool use.
- **Throttleable reasoning.** NAR's inference runs async from the
  agent. The agent always responds (via LM). Reasoning power is
  controlled by a throttle (0% = paused, 100% = full).
- **Unified memory.** EpisodicMemory is the single history system.
  No separate ConversationEntry, pinned list, or episode log.
- **`know(key, value)`** — explicit key/value knowledge store,
  distinct from `believe` (NAR inference) and `recall` (episodic
  search).

**Total: 5 files, ~620 lines.** Agent-owned: 3 files, ~310 lines.
NAR gets minimal changes (`parseTask` + `nar_goal` + `nar_get_goals`
tools, and the `nar_believe` truth-format fix).

---

## 2. Architecture

### 2.1 The Flow

```
User Input
    │
    ▼
parseTask(input)          ← Peggy grammar, returns {term, taskType, truth}
    │
    ├─── valid Narsese ──→ nar.input(term, taskType, truth)  →  respond
    │
    └─── not Narsese ───→ LM with tools                      →  respond
                              │
                              ├── nar_believe(narsese)
                              ├── nar_goal(narsese)
                              ├── nar_question(narsese)
                              ├── nar_reason(steps)
                              ├── nar_get_beliefs()
                              ├── nar_get_attention()
                              ├── know(key, value)
                              ├── know_get(key)
                              ├── recall(query, limit)
                              ├── search_beliefs(pattern)
                              └── ... (tools call NAR, agent logs)
```

### 2.2 Principles

1. **LM decides, agent executes.** The agent never interprets
   intent. It provides tools and context. The LM chooses which
   tools to call.
2. **Narsese is fast path.** If input parses as valid Narsese,
   skip the LM entirely. Feed NAR directly.
3. **Reasoning is async.** The agent's `chat()` never waits for
   NAR inference. It responds immediately via the LM. Background
   reasoning runs on a throttle.
4. **Memory is unified.** One EpisodicMemory for all interactions.
   No duplicate logs, no separate history buffers.
5. **Graceful degradation.** Every dependency is optional. No LM?
   Narsese still works. No NAR? LM still responds. No episodic
   memory? Agent runs in-memory only.

---

## 3. What Stays (NAR — Minimal Change)

### 3.1 NAR Public API — Untouched

The agent uses NAR's public API directly. Verified in NEXT4.md
and re-verified here. No wrappers, no facades.

Key methods used by the agent:

```
nar.input(input, type?, truth?)   → Promise<void>
nar.believe(input, truth?)        → Promise<void>
nar.goal(input, truth?)           → Promise<void>
nar.question(input)               → Promise<void>
nar.run(steps?)                   → Promise<number>
nar.getBeliefs(filter?)           → Task[]
nar.getGoals(filter?)             → Task[]
nar.getQuestions()                → Task[]
nar.attentionReport()             → {concepts, total}
nar.getConstitution()             → Task[]
nar.getStatistics()               → stats
nar.listConcepts()                → Concept[]
nar.clearMemory()                 → void
nar.getSelfAnalyzer()             → ReasoningAboutReasoning | undefined
nar.getRLFP()                     → RLFPLearner | undefined
nar.getLMClient()                 → LMClient | undefined
```

Opt-in features guarded with `?.`:
- `nar.getSelfAnalyzer()` — undefined unless `enableSelf: true`
- `nar.getRLFP()` — undefined unless explicitly set

### 3.2 One NAR Change: `parseTask()`

The Peggy grammar already parses `{term, punctuation, truthValue,
taskType}` from the `Task` rule (lines 6-20 of `narsese.peggy`).
But `TermParser.parse()` strips this and returns only the `Term`.

**Add `parseTask()` to `TermParser`:**

```typescript
// src/nar/terms/parser-peggy.ts

interface ParseTaskResult {
    valid: true;
    term: Term;
    taskType: 'belief' | 'question' | 'goal' | 'command';
    truth?: Truth;
}

parseTask(input: string): ParseTaskResult | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    try {
        const result: unknown = peggyParse(trimmed, {termFactory: this.termFactory});
        const r = result as Record<string, unknown>;

        if (!r.term || !r.punctuation) return null;

        // TaskType is 'belief' | 'goal' | 'question' | 'command' (src/nar/types/core.ts:29).
        // '@' is quest-variable syntax, not a task punctuation — it never appears here.
        const puncToType: Record<string, ParseTaskResult['taskType']> = {
            '.': 'belief', '?': 'question', '!': 'goal', ';': 'command',
        };

        // Grammar returns truthValue as raw {frequency, confidence} numbers;
        // nar.input() requires a Truth instance (see parseWithTruth in this file).
        const rawTruth = r.truthValue as {frequency: number; confidence: number} | undefined;
        const truth = rawTruth
            ? Truth.create(rawTruth.frequency, rawTruth.confidence)
            : undefined;

        return {
            valid: true,
            term: r.term as Term,
            taskType: puncToType[r.punctuation as string] ?? 'belief',
            truth,
        };
    } catch {
        return null;
    }
}
```

**Why this goes in NAR, not the agent:** Parsing is NAR's
responsibility. The agent should not know Narsese grammar. It
asks "is this Narsese?" and gets a yes/no + the parsed task.

**Also export from `src/nar/terms/index.ts`:**

```typescript
export {termParser, TermParser, ParseError} from './parser-peggy.js';
export type {ParserResult, ParseTaskResult} from './parser-peggy.js';
```

### 3.3 Add Missing NAR Tools

The existing `createNARSTools()` has `nar_believe`, `nar_question`,
`nar_reason`, and various readers — but is missing `nar_goal` and
`nar_get_goals`. Add both:

```typescript
// src/nar/tools/adapters/aisdk-adapter.ts — additions to createNARSTools()

nar_believe: tool({
    description: 'Add a belief to NARS knowledge base in Narsese format',
    inputSchema: z.object({
        statement: z.string().describe('Narsese statement, e.g., "(cat --> animal)."'),
        truth: z.object({
            frequency: z.number().min(0).max(1).optional(),
            confidence: z.number().min(0).max(1).optional(),
        }).optional(),
    }),
    execute: async ({statement, truth}) => {
        const fullStatement = truth?.frequency !== undefined && truth?.confidence !== undefined
            ? `${statement.replace(/\.$/, '')} %${truth.frequency};${truth.confidence}%`
            : statement;
        await nar.input(fullStatement, 'belief');
        return {success: true, statement: fullStatement, timestamp: Date.now()};
    },
}),

nar_goal: tool({
    description: 'Add a goal to NARS in Narsese format. Goals drive procedural inference.',
    inputSchema: z.object({
        statement: z.string().describe('Narsese goal statement, e.g., "(call_mom)!"'),
    }),
    execute: async ({statement}) => {
        await nar.input(statement, 'goal');
        return {success: true, statement, timestamp: Date.now()};
    },
}),

nar_get_goals: tool({
    description: 'Get current goals from NARS memory',
    inputSchema: z.object({
        limit: z.number().min(1).max(100).optional().default(10),
    }),
    execute: async ({limit = 10}) => {
        const goals = nar.getGoals().slice(0, limit);
        return {goals, count: goals.length};
    },
}),
```

**Truth format fix:** the existing `nar_believe` tool formats truth
as `${statement} :|: truth=${truth.frequency}` — that produces
invalid Narsese that the parser cannot reparse. The corrected form
uses the standard `%f;c%` suffix (matching what `parseWithTruth`
already accepts at `src/nar/terms/parser-peggy.ts:82`).

**`nar_believe` does NOT call `nar.run()`** — it queues the belief
for the background throttle loop. `nar_question` and `nar_reason`
DO call `nar.run()` internally for immediate results. The LM
chooses which behavior it needs.

### 3.3 ModelRunner — Untouched

`src/agent/model/ModelRunner.ts` (207 lines). Generic LM adapter
with tool-call loop. No changes needed.

### 3.4 ToolDispatcher — Untouched

`src/agent/model/ToolDispatcher.ts` (104 lines). Pure function
that executes tool calls. No changes needed.

### 3.5 EpisodicMemory — Untouched

`src/nar/memory/EpisodicMemory.ts` (168 lines). Agent-owned,
NAR-namespaced. No changes needed.

### 3.6 ContextBuilder — Untouched (Used As-Is)

`src/nar/nl/context.ts` (170 lines). The agent calls
`ContextBuilder.build(nar, input, ctx, opts)` with configurable
flags. No changes needed.

### 3.7 FeedbackLearner & RLFP — Optional Integration

The agent optionally wires NAR's RLFP learner (when enabled) to
the existing `FeedbackLearner`, so that user-driven corrections
flow into preference learning:

```typescript
// In createAgent():
const feedback = new FeedbackLearner();
if (nar?.getRLFP?.()) feedback.setRLFP(nar.getRLFP()!);
```

**Correction detection is delegated to the LM.** When the user
says "no, cats are mammals", the LM sees conversation history
(via context builder / EpisodicMemory) and naturally calls
`nar_believe` with corrected Narsese. To feed that correction
into the feedback system, callers (or a future revision) can
expose a thin wrapper:

```typescript
// Optional helper exposed by the agent for callers that
// detect corrections explicitly (e.g., a future REPL command).
function onCorrection(originalNL: string, originalNarsese: string, correctedNarsese: string) {
    feedback.onCorrection(originalNL, originalNarsese, correctedNarsese);
    nar?.getRLFP()?.addPreference(correctedNarsese, originalNarsese);
}
```

The agent itself does NOT call `onCorrection` from `chat()` /
`believe()` / `know()`. The v6 design invariant: **the agent
never interprets intent, including corrections.** The LM
handles them.

**This is opt-in.** If `enableRLFP` is not set, `nar.getRLFP()`
returns `undefined` and `FeedbackLearner` runs without preference
learning. The agent degrades gracefully.

---

## 4. Agent Files

```
src/agent/
├── agent.ts                  (~200 lines) createAgent — the harness
├── tools.ts                  (~100 lines) tool definitions for the LM
├── model/
│   ├── ModelRunner.ts        (~207 lines) KEEP — generic LM adapter
│   └── ToolDispatcher.ts     (~104 lines) KEEP — tool execution
└── index.ts                  (~10 lines)  exports
```

**Total: ~620 lines across 5 files.** Agent-owned: ~310 lines
(agent.ts + tools.ts + index.ts).

---

## 5. `agent.ts` — The Harness

```typescript
// src/agent/agent.ts (~200 lines)

import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {EpisodicMemory, EpisodeType} from '../nar/memory/EpisodicMemory.js';
import {termParser, type ParseTaskResult} from '../nar/terms/index.js';
import {ContextBuilder, type ContextOpts} from '../nar/nl/context.js';
import {createNARSTools, createGeneralTools, createWorkingMemoryTools} from '../nar/tools/adapters/index.js';
import {ModelRunner} from './model/ModelRunner.js';
import {buildAgentTools} from './tools.js';

export interface AgentOptions {
    nar?: NAR;
    lmClient?: LMClient;
    episodicMemory?: EpisodicMemory;
    systemInstructions?: string;
    context?: ContextOpts;
    maxLoops?: number;
}

export interface Agent {
    chat(input: string): Promise<string>;
    believe(narsese: string): Promise<void>;
    know(key: string, value: string): void;
    knowGet(key: string): string | undefined;
    knowList(): Array<{key: string; value: string}>;
    recall(query?: string, limit?: number): Promise<Array<{timestamp: number; type: string; content: string}>>;
    start(): () => void;
    stop(): void;
    setThrottle(percent: number): void;
    getThrottle(): number;
    getNAR(): NAR | undefined;
    getEpisodicMemory(): EpisodicMemory | undefined;
}

export function createAgent(opts: AgentOptions = {}): Agent {
    const {
        nar,
        lmClient,
        episodicMemory,
        systemInstructions,
        context: contextOpts = {},
        maxLoops = 5,
    } = opts;

    const contextBuilder = new ContextBuilder();
    const runner = new ModelRunner({lmClient, maxLoops});
    const knowledge = new Map<string, string>();

    // Throttle state
    let throttle = 100;
    let reasoningHandle: ReturnType<typeof setInterval> | null = null;

    // ── System Prompt ──────────────────────────────────────────

    function buildSystemPrompt(): string {
        const parts: string[] = [];
        const constitution = nar?.getConstitution();
        if (constitution?.length) {
            parts.push('## Constitution\n' + constitution.map(b => b.term.toString()).join('\n'));
        }
        if (systemInstructions) parts.push(systemInstructions);
        return parts.join('\n\n') || 'You are SeNARS — a neurosymbolic cognitive kernel.';
    }

    // ── Context ────────────────────────────────────────────────

    const defaultContextOpts: ContextOpts = {
        attention: true,
        beliefs: true,
        goals: true,
        ...contextOpts,
    };

    async function buildContext(input: string): Promise<string> {
        if (!nar) return '';
        const parts: string[] = [];

        // NAR state (attention, beliefs, goals)
        const narContext = contextBuilder.build(nar, input, undefined, defaultContextOpts);
        if (narContext) parts.push(narContext);

        // Recent episodes (if episodic memory available).
        // Note: EpisodicMemory.getEpisodes returns up to `limit` episodes
        // scanning the latest date file(s) first; it is not a strictly
        // global "5 most recent" guarantee across all history, but for
        // the agent's context window this is sufficient.
        if (episodicMemory) {
            const episodes = await episodicMemory.getEpisodes({limit: 5});
            if (episodes.length) {
                const lines = episodes.map(e => {
                    const preview = e.content.length > 80 ? e.content.slice(0, 79) + '...' : e.content;
                    return `  - [${e.type}] ${preview}`;
                });
                parts.push(`Recent interactions:\n${lines.join('\n')}`);
            }
        }

        return parts.join('\n\n');
    }

    // ── Tools ──────────────────────────────────────────────────

    function buildTools(): Record<string, unknown> {
        const tools: Record<string, unknown> = {};
        if (nar) {
            Object.assign(tools, createNARSTools(nar));
            Object.assign(tools, createGeneralTools({nar, episodicMemory}));
        }
        Object.assign(tools, buildAgentTools({
            know: (k: string, v: string) => { knowledge.set(k, v); safeLog('input', v, {kind: 'knowledge', key: k}); },
            knowGet: (k: string) => knowledge.get(k),
            knowList: () => [...knowledge.entries()].map(([key, value]) => ({key, value})),
            recall: async (query?: string, limit?: number) => recall(query, limit),
        }));
        return tools;
    }

    // ── Logging ────────────────────────────────────────────────

    function safeLog(type: EpisodeType, content: string, metadata?: Record<string, unknown>) {
        episodicMemory?.log(type, content, metadata).catch(() => {});
    }

    // ── Parse Gate ─────────────────────────────────────────────

    function tryParseNarsese(input: string): ParseTaskResult | null {
        return termParser.parseTask(input);
    }

    // ── LM Dispatch ────────────────────────────────────────────

    async function dispatchToLM(input: string): Promise<string> {
        const context = await buildContext(input);
        const system = context
            ? `${buildSystemPrompt()}\n\n## Cognitive State\n${context}`
            : buildSystemPrompt();

        const composed = {
            system,
            messages: [{role: 'user' as const, content: input}],
            tools: buildTools(),
            ctxHash: String(Date.now()),
            snapshot: null,
            budget: {systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0},
        };

        const iter = runner.run(composed as never);
        let next = await iter.next();
        while (!next.done) next = await iter.next();
        return next.value?.text ?? '';
    }

    // ── Narsese Response Formatting ────────────────────────────

    function formatBelief(b: {term: {toString(): string}; truth?: {f: number; c: number}}): string {
        const truth = b.truth
            ? ` (f=${b.truth.f.toFixed(2)} c=${b.truth.c.toFixed(2)})`
            : '';
        return `${b.term.toString()}${truth}`;
    }

    // ── Public API ─────────────────────────────────────────────

    async function chat(input: string): Promise<string> {
        safeLog('input', input);

        // Fast path: Narsese parses → feed NAR directly (no inference)
        const task = tryParseNarsese(input);
        if (task) {
            await nar?.input(task.term, task.taskType, task.truth);

            // Questions: check existing beliefs for answer
            if (task.taskType === 'question') {
                const needle = task.term.toString();
                const existing = nar?.getBeliefs().find(b =>
                    b.term.toString().toLowerCase().includes(needle.toLowerCase())
                );
                const response = existing
                    ? formatBelief(existing as {term: {toString(): string}; truth?: {f: number; c: number}})
                    : `Question queued: ${input} (reasoning in background)`;
                safeLog('response', response, {narsese: input, taskType: task.taskType});
                return response;
            }

            // Beliefs/goals: respond immediately, background processes later
            const response = `+ ${input}`;
            safeLog('response', response, {narsese: input, taskType: task.taskType});
            return response;
        }

        // Slow path: natural language → LM with tools
        const response = await dispatchToLM(input);
        safeLog('response', response);
        return response;
    }

    async function believe(narsese: string): Promise<void> {
        const task = tryParseNarsese(narsese);
        if (task) {
            await nar?.input(task.term, task.taskType, task.truth);
        } else {
            await nar?.believe(narsese);
        }
        safeLog('belief_added', narsese);
        // No nar.run() — background loop handles inference via throttle
    }

    function know(key: string, value: string): void {
        knowledge.set(key, value);
        safeLog('input', value, {kind: 'knowledge', key});
    }

    function knowGet(key: string): string | undefined {
        return knowledge.get(key);
    }

    function knowList(): Array<{key: string; value: string}> {
        return [...knowledge.entries()].map(([key, value]) => ({key, value}));
    }

    async function recall(query?: string, limit = 10): Promise<Array<{timestamp: number; type: string; content: string}>> {
        if (!episodicMemory) return [];
        const episodes = await episodicMemory.getEpisodes({limit});
        const q = query?.toLowerCase();
        return (q ? episodes.filter(e => e.content.toLowerCase().includes(q)) : episodes)
            .map(e => ({timestamp: e.timestamp, type: e.type, content: e.content}));
    }

    // ── Throttle & Lifecycle ───────────────────────────────────

    function start(): () => void {
        if (!nar) return () => {};

        // Guard against duplicate intervals
        if (reasoningHandle) stop();

        const self = nar.getSelfAnalyzer();
        if (self) self.start();

        reasoningHandle = setInterval(async () => {
            if (throttle === 0) return;
            const steps = Math.max(1, Math.round(5 * (throttle / 100)));
            await nar.run(steps).catch(() => {});
            if (self) await self.performSelfCorrection().catch(() => {});
        }, 60_000);

        if (typeof reasoningHandle.unref === 'function') reasoningHandle.unref();
        return stop;
    }

    function stop(): void {
        if (reasoningHandle) {
            clearInterval(reasoningHandle);
            reasoningHandle = null;
        }
        nar?.getSelfAnalyzer()?.stop();
    }

    function setThrottle(percent: number): void {
        throttle = Math.max(0, Math.min(100, percent));
    }

    return {
        chat,
        believe,
        know,
        knowGet,
        knowList,
        recall,
        start,
        stop,
        setThrottle,
        getThrottle: () => throttle,
        getNAR: () => nar,
        getEpisodicMemory: () => episodicMemory,
    };
}
```

### 5.1 Design Notes

**`chat()` is 2 paths, not 5:**
1. Parse gate → Narsese → `nar.input()` (instant, no LM)
2. Not Narsese → LM with tools (LM decides everything)

**No correction detection.** The LM sees conversation history
(via context builder or EpisodicMemory) and handles corrections
naturally: "no, cats are mammals" → LM calls `nar_believe`.

**No intent routing.** The LM has tools. It decides what to do.
The agent doesn't classify anything.

**`know()` is synchronous.** It's an in-memory Map. Episodic
logging is fire-and-forget. No await needed.

**`believe()` uses `parseTask()` first.** If the input is valid
Narsese, it extracts the term and task type properly. Falls back
to `nar.believe()` for raw strings.

---

## 6. `tools.ts` — LM Tool Definitions

```typescript
// src/agent/tools.ts (~100 lines)

import {z} from 'zod';
import {tool} from 'ai';

interface AgentToolDeps {
    know: (key: string, value: string) => void;
    knowGet: (key: string) => string | undefined;
    knowList: () => Array<{key: string; value: string}>;
    recall: (query?: string, limit?: number) => Promise<Array<{timestamp: number; type: string; content: string}>>;
}

export function buildAgentTools(deps: AgentToolDeps): Record<string, unknown> {
    return {
        know: tool({
            description: 'Store a key-value pair in persistent knowledge. Use for explicit facts the user wants remembered.',
            inputSchema: z.object({
                key: z.string().describe('A short, descriptive key (e.g., "project-goals", "user-preferences")'),
                value: z.string().describe('The knowledge to store'),
            }),
            execute: ({key, value}) => {
                deps.know(key, value);
                return {stored: true, key};
            },
        }),

        know_get: tool({
            description: 'Retrieve a value by key from the knowledge store.',
            inputSchema: z.object({
                key: z.string().describe('The key to look up'),
            }),
            execute: ({key}) => {
                const value = deps.knowGet(key);
                return value !== undefined ? {found: true, key, value} : {found: false, key};
            },
        }),

        know_list: tool({
            description: 'List all stored knowledge entries.',
            inputSchema: z.object({}),
            execute: () => {
                return {entries: deps.knowList()};
            },
        }),

        recall: tool({
            description: 'Search episodic memory for past interactions. Returns matching episodes with timestamps.',
            inputSchema: z.object({
                query: z.string().optional().describe('Search query to filter episodes (case-insensitive substring match)'),
                limit: z.number().optional().default(10).describe('Maximum number of episodes to return'),
            }),
            execute: ({query, limit}) => deps.recall(query, limit),
        }),
    };
}
```

### 6.1 Why Separate File

The tool definitions are pure Zod schemas + thin wrappers around
agent methods. Keeping them in `tools.ts` instead of `agent.ts`:
- Agent stays focused on lifecycle and dispatch
- Tools are independently testable
- Easy to add/remove tools without touching agent logic

### 6.2 NAR Tools (from existing adapters)

The LM also gets these from `createNARSTools()`:

| Tool | Purpose |
|------|---------|
| `nar_believe` | Add a Narsese belief |
| `nar_goal` | Add a Narsese goal |
| `nar_question` | Ask a Narsese question (runs inference immediately) |
| `nar_reason` | Run NAR inference for N steps |
| `nar_get_beliefs` | List current beliefs |
| `nar_get_goals` | List current goals |
| `nar_get_questions` | List pending questions |
| `nar_get_attention` | Attention distribution report |

**Note:** `nar_question` and `nar_reason` call `nar.run()` internally
for immediate results. `nar_believe` and `nar_goal` do not — they
queue input for the background reasoning loop. The LM chooses
which behavior it needs.

And from `createGeneralTools()`:

| Tool | Purpose |
|------|---------|
| `search_memory` | Search NAR beliefs by pattern |
| `calculate` | Evaluate math expressions |
| `get_recent_episodes` | Retrieve recent episodes |

---

## 7. Memory Model

### 7.1 Three Dimensions

| Verb | System | What it stores | When written |
|------|--------|---------------|-------------|
| `believe` | NAR working memory | Structured Narsese for inference | User input parses as Narsese, or LM calls `nar_believe` |
| `know` | Agent in-memory Map | Named key/value pairs | Explicit user request or LM calls `know` tool |
| `recall` | EpisodicMemory (disk) | Chronological interaction log | Automatic on every `chat()` call |

### 7.2 No Conflict

- `believe` ≠ `know`: Belief is probabilistic knowledge for NAR's
  inference engine. Know is explicit, named, user-driven storage.
- `believe` ≠ `recall`: Belief is structured Narsese. Recall is
  natural-language search over interaction history.
- `know` ≠ `recall`: Know is named key/value. Recall is
  chronological and searchable by content.

### 7.3 EpisodicMemory as Single History

Every `chat()` call logs:
- `episodicMemory.log('input', input)` — user's message
- `episodicMemory.log('response', response)` — agent's response
- `episodicMemory.log('belief_added', narsese)` — when NAR receives a belief
- `episodicMemory.log('tool_call', toolName)` — when LM calls a tool (optional)

The context builder can pull recent episodes for the LM's context
window. No separate `history: ConversationEntry[]`.

---

## 8. Context System

### 8.1 Configurable

```typescript
interface AgentOptions {
    context?: ContextOpts;  // passed to ContextBuilder.build()
}

// Default: attention + beliefs + goals enabled
const defaultContextOpts: ContextOpts = {
    attention: true,
    beliefs: true,
    goals: true,
};
```

### 8.2 Rich by Default

The system prompt includes:
1. **Constitution beliefs** (if `nar.getConstitution()` returns any)
2. **Custom system instructions** (from `opts.systemInstructions`)
3. **Cognitive state snapshot** (from `ContextBuilder.build()`):
   - Attention focus (top concepts by priority)
   - Related beliefs (terms extracted from user input)
   - Active goals

### 8.3 Token Budget

`ContextBuilder` has a `tokenBudget` option (default 2000 chars).
Consumers can override:

```typescript
const agent = createAgent({
    nar,
    lmClient,
    context: {attention: true, beliefs: true, tokenBudget: 4000},
});
```

---

## 9. Throttle & Lifecycle

### 9.1 Throttle

```typescript
agent.setThrottle(100);  // full speed: nar.run(5) every 60s
agent.setThrottle(50);   // half speed: nar.run(2 or 3) every 60s
agent.setThrottle(0);    // paused: no nar.run() calls
agent.getThrottle();     // → 50
```

Steps per tick: `Math.max(1, Math.round(5 * (throttle / 100)))`

### 9.2 Decoupled from Agent

```
┌─────────────────────────────────────────────────┐
│  Agent (chat)          │  Background Reasoning   │
│                        │                         │
│  chat("cats are mammals")                        │
│    → LM calls nar_believe                        │
│    → respond immediately                         │
│    → (nar.run() NOT called — queued)             │
│                        │                         │
│                        │  60s later:             │
│                        │  nar.run(3)             │
│                        │  CognitiveController    │
│                        │  SelfCorrection         │
│                        │                         │
│  chat("what is a cat") │                         │
│    → parse → question queued                     │
│    → check existing beliefs → answer?            │
│    → respond immediately                         │
│                        │  (reasoning may be      │
│                        │   paused at throttle=0) │
└─────────────────────────────────────────────────┘
```

**The agent never calls `nar.run()`.** Background reasoning
is the only thing that processes the inference queue. The LM
has `nar_question` and `nar_reason` tools if it needs immediate
results — those tools call `run()` internally, but the agent
doesn't.

This means:
- Beliefs/goals: queued, processed by background loop
- Questions: check existing beliefs, queue if no answer
- LM can call `nar_reason` for immediate inference (tool decision)
- Agent is always responsive, never blocks on inference

### 9.3 Self-Analysis

If `nar.getSelfAnalyzer()` exists (opt-in via `enableSelf: true`):
- `agent.start()` calls `self.start()`
- Each reasoning tick calls `self.performSelfCorrection()`
- `agent.stop()` calls `self.stop()`

If not available, the agent logs a warning once and continues.

---

## 10. `index.ts` — Exports

```typescript
export {createAgent} from './agent.js';
export type {Agent, AgentOptions} from './agent.js';
export {ModelRunner} from './model/ModelRunner.js';
export {dispatchToolCalls} from './model/ToolDispatcher.js';
export type {ToolCall, ToolDispatchResult} from './model/ToolDispatcher.js';
```

---

## 11. REPL — Updated Commands

### 11.1 New Command Set

```
.help            Show this help
.quit            Exit the REPL
.stats           NAR and LM statistics
.beliefs         List NAR beliefs (with truth values)
.concepts        List NAR concepts (with priority)
.attention       Attention focus report
.episodes [n]    List recent n episodes (default 10)
.know [key] [v]  Get/set/list knowledge
.recall [query]  Search episodic memory
.throttle [n]    Get/set reasoning throttle (0-100%)
.status          Agent + NAR + LM status
.clear           Clear screen
```

### 11.2 Command Implementations

```typescript
// .know — three modes
.know                → list all knowledge
.know project-goals  → get value for key
.know project-goals "Build a cognitive agent" → store value

// .recall — search episods
.recall cats         → episodes containing "cats"
.recall              → last 10 episodes

// .throttle — get or set
.throttle            → show current throttle
.throttle 50         → set to 50%
.throttle 0          → pause reasoning

// .status — comprehensive
.status →
  Throttle: 50%
  NAR: 42 concepts, 128 beliefs, 3 goals
  LM: anthropic/claude-sonnet (12 calls, avg 340ms)
  EpisodicMemory: 256 episodes, .cache/episodes
  Knowledge: 5 entries
```

### 11.3 Updated `repl.ts`

```typescript
// Changes from v4:
// 1. Import createAgent instead of AIAgent
// 2. Add .know, .recall, .throttle, .status, .attention commands
// 3. Remove old .episodes format (use agent.recall() instead)
// 4. Add .know [key] [value] command

const agent = createAgent({nar, lmClient, episodicMemory});

const buildCommands = (nar, agent, lmClient): CLICommand[] => [
    // ... existing: help, quit, stats, beliefs, concepts, clear
    {
        name: 'attention', description: 'Attention focus report',
        execute: () => {
            const attn = nar.attentionReport();
            const lines = [`\n--- Attention (${attn.total} total) ---`];
            for (const c of attn.concepts.slice(0, 20)) {
                lines.push(`  ${c.term} (p=${c.priority.toFixed(2)})`);
            }
            return lines.join('\n');
        },
    },
    {
        name: 'episodes', description: 'List recent episodes',
        execute: async (args) => {
            const limit = parseInt(args) || 10;
            const episodes = await agent.recall(undefined, limit);
            const lines = [`\n--- ${episodes.length} Recent Episode(s) ---`];
            for (const e of episodes) {
                const preview = e.content.length > 60 ? e.content.slice(0, 59) + '...' : e.content;
                lines.push(`  [${e.type}] ${preview}`);
            }
            return lines.join('\n');
        },
    },
    {
        name: 'know', description: 'Get/set/list knowledge',
        execute: (args) => {
            const parts = args.trim().split(/\s+/);
            if (!parts[0]) {
                const entries = agent.knowList();
                if (!entries.length) return '\n  (empty)';
                const lines = [`\n--- ${entries.length} Knowledge Entry/Entries ---`];
                for (const {key, value} of entries) {
                    const preview = value.length > 60 ? value.slice(0, 59) + '...' : value;
                    lines.push(`  ${key}: ${preview}`);
                }
                return lines.join('\n');
            }
            if (parts.length === 1) {
                const value = agent.knowGet(parts[0]);
                return value !== undefined ? `${parts[0]}: ${value}` : `Key not found: ${parts[0]}`;
            }
            const key = parts[0];
            const value = parts.slice(1).join(' ');
            agent.know(key, value);
            return `Stored: ${key}`;
        },
    },
    {
        name: 'recall', description: 'Search episodic memory',
        execute: async (args) => {
            const episodes = await agent.recall(args.trim() || undefined);
            const lines = [`\n--- ${episodes.length} Episode(s) ---`];
            for (const e of episodes) {
                const preview = e.content.length > 60 ? e.content.slice(0, 59) + '...' : e.content;
                lines.push(`  [${e.type}] ${preview}`);
            }
            return lines.join('\n');
        },
    },
    {
        name: 'throttle', description: 'Get/set reasoning throttle',
        execute: (args) => {
            const n = parseInt(args);
            if (isNaN(n)) return `Throttle: ${agent.getThrottle()}%`;
            agent.setThrottle(n);
            return `Throttle set to ${agent.getThrottle()}%`;
        },
    },
    {
        name: 'status', description: 'Agent and NAR status',
        execute: () => {
            const stats = nar.getStatistics();
            const lmStats = lmClient.getStats?.();
            const lines = [
                `\n--- Agent Status ---`,
                `Throttle: ${agent.getThrottle()}%`,
                `\n--- NAR ---`,
                `Concepts: ${stats.totalConcepts}`,
                `Tasks: ${stats.totalTasks}`,
                `\n--- LM ---`,
                `Provider: ${lmClient.provider ?? 'unknown'}`,
                `Model: ${lmClient.model ?? 'unknown'}`,
            ];
            if (lmStats) {
                lines.push(`Calls: ${lmStats.totalCalls} (${lmStats.successfulCalls} ok, ${lmStats.failedCalls} fail)`);
                lines.push(`Avg: ${lmStats.averageDuration.toFixed(0)}ms`);
            }
            const knowledge = agent.knowList();
            lines.push(`\n--- Knowledge ---`, `${knowledge.length} entries`);
            return lines.join('\n');
        },
    },
];
```

---

## 12. Entry Points

### 12.1 `src/bin/repl.ts`

- `new AIAgent(...)` → `createAgent(...)`
- Add `.know`, `.recall`, `.throttle`, `.status`, `.attention` commands
- Update `.episodes` to use `agent.recall()`

### 12.2 `src/bin/bot-ai.ts`

```typescript
const agent = createAgent({nar, lmClient, episodicMemory});
// Bot integration: wire agent.chat() to message handlers
```

### 12.3 `src/cli/agent.ts`

```typescript
const agent = createAgent({nar, lmClient, episodicMemory});
// Library export: consumers call agent.chat(), agent.know(), etc.
```

---

## 13. Tests

### 13.1 `tests/unit/agent/AgentV6.test.ts`

```typescript
describe('Agent (v6 harness)', () => {
    // Parse gate
    it('feeds Narsese directly to NAR without LM');
    it('parses belief (.), goal (!), question (?) correctly');
    it('rejects invalid Narsese and falls back to LM');

    // LM dispatch
    it('sends natural language to LM with tools');
    it('LM can call nar_believe via tools');
    it('LM can call know via tools');
    it('LM can call recall via tools');

    // Memory
    it('know() stores and retrieves key/value pairs');
    it('knowList() returns all entries');
    it('believe() logs to episodic memory');
    it('recall() searches episodic memory');

    // Throttle
    it('setThrottle() clamps to 0-100');
    it('start()/stop() manage reasoning interval');
    it('reasoning skips when throttle=0');

    // Context
    it('builds context with attention and beliefs by default');
    it('respects custom context options');

    // System prompt
    it('includes constitution beliefs when available');
    it('includes custom system instructions');
    it('falls back to default prompt');

    // Graceful degradation
    it('works without LM (Narsese only)');
    it('works without NAR (LM only)');
    it('works without episodic memory');
});
```

### 13.2 `tests/unit/agent/AgentV6Tools.test.ts`

```typescript
describe('Agent tools', () => {
    it('know tool stores and retrieves');
    it('know_get tool returns found/not-found');
    it('know_list tool returns all entries');
    it('recall tool searches episodes');
});
```

### 13.3 `tests/unit/terms/ParseTask.test.ts`

```typescript
describe('termParser.parseTask()', () => {
    it('parses (cat --> animal). as belief');
    it('parses (cat --> ?)? as question');
    it('parses (call_mom)! as goal');
    it('parses with truth values: (cat --> animal). %0.9;0.8%');
    it('returns null for natural language');
    it('returns null for empty input');
    it('returns null for invalid Narsese');
});
```

### 13.4 Test Setup

```typescript
// Scripted LM for tests (no network)
const scriptedLM: LMClient = {
    provider: 'scripted',
    model: 'test',
    available: true,
    async generateText(prompt) {
        if (prompt.includes('hello')) return 'Hi there!';
        return 'Mock response.';
    },
};

// In-memory EpisodicMemory (no filesystem)
const episodicMemory = new EpisodicMemory({
    enabled: true,
    basePath: '/tmp/test-episodes-' + Date.now(),
    retentionDays: 1,
});
```

---

## 14. Migration

### 14.1 Delete

| File | Reason |
|------|--------|
| `src/agent/routing.ts` | Replaced by `termParser.parseTask()` |
| `src/agent/services/metrics.ts` | NAR has its own metrics (`getStatistics()`, `getMetricsCollector()`) |
| `tests/unit/agent/InputRouter.test.ts` | Tested routing.ts (deleted) |
| `src/nar/nl/index.ts` exports of `classify` and `NLAnalyzer` | Becomes dead code once `routing.ts` is gone. The `classify` and `NLAnalyzer` re-exports must be removed from `src/nar/index.ts:99`. Internal modules (`classifier.ts`, `analyzer.ts`) may stay — they have other consumers — but the public re-export dies. |

### 14.2 Rewrite

| File | Change |
|------|--------|
| `src/agent/agent.ts` | Class with 10 handlers → factory function, 2 dispatch paths |
| `src/agent/index.ts` | Updated exports |
| `tests/unit/agent/ModelRunner.test.ts` | **Pre-existing bug fix:** line 4 imports `ComposedRequest`/`ReasoningArtifact` from non-existent `src/agent/types.js`. Update import to `'../../../src/agent/model/ModelRunner.js'` (those types are exported from there) |
| `tests/unit/agent/AIAgentV4.test.ts` | Rewrite as `AgentV6.test.ts` |
| `tests/unit/agent/AIAgentV4Chat.test.ts` | Rewrite as `AgentV6Tools.test.ts` |
| `tests/unit/agent/ReplyTarget.test.ts` | Verify it does not depend on `AIAgent`/`agent.ts` internals. If it only uses `src/io/`, no change needed; if it imports from `src/agent/`, refactor to use the new factory function |

### 14.3 Create

| File | Purpose |
|------|---------|
| `src/agent/tools.ts` | LM tool definitions (know, know_get, know_list, recall) |

### 14.4 Update

| File | Change |
|------|--------|
| `src/nar/terms/parser-peggy.ts` | Add `parseTask()` method (+~30 lines) |
| `src/nar/terms/index.ts` | Export `ParseTaskResult` type |
| `src/nar/tools/adapters/aisdk-adapter.ts` | Add `nar_goal` + `nar_get_goals` tools, fix `nar_believe` truth format (+~30 lines) |
| `src/nar/index.ts` | Remove `classify` and `NLAnalyzer` from re-exports (line 99) |
| `src/bin/repl.ts` | `AIAgent` → `createAgent`, add new commands |
| `src/bin/bot-ai.ts` | `AIAgent` → `createAgent` |
| `src/cli/agent.ts` | `AIAgent` → `createAgent` |

### 14.4 Behavior Changes

This rewrite is **not a pure refactor** — there are intentional
behavior changes that existing tests and downstream consumers
must be aware of:

| Change | Old (v4) | New (v6) | Tests to update |
|--------|----------|----------|-----------------|
| `handleBelief` runs inference synchronously | `await this.nar?.run(5)` immediately after input (`agent.ts:77`) | Beliefs are queued; inference runs on the throttle-controlled background interval | Any test asserting on synchronous inference results from `believe()` must move to `nar_reason` tool or wait for the background tick |
| Question response on no match | `"No answer for: <needle>"` | `"Question queued: <input> (reasoning in background)"` | Tests asserting on the old "No answer" string |
| Episodic memory logging | Mixed: class field `history: ConversationEntry[]` + EpisodicMemory | EpisodicMemory only — class field removed | Tests that read `agent.history` or `ConversationEntry` |
| `route()`, `classify`, `NLAnalyzer` | Used to dispatch input | Removed from agent (parse gate + LM tools) | Tests that imported these symbols |
| Correction detection | Regex-based (none in v4, but planned in NEXT4 r3) | LM handles naturally via conversation context | Tests with hard-coded correction flows |
| `nar_believe` tool truth format | `${stmt} :|: truth=${f}` (invalid Narsese) | `${stmt} %f;c%` (valid Narsese, parseable by `parseWithTruth`) | Tests that re-parse stored beliefs |

### 14.5 Keep Unchanged

| File | Lines | Reason |
|------|-------|--------|
| `src/agent/model/ModelRunner.ts` | 207 | Generic, reusable |
| `src/agent/model/ToolDispatcher.ts` | 104 | Pure function, correct |

### 14.6 Net Change

- **Deleted:** routing.ts (102), metrics.ts (30), InputRouter.test.ts (49) = ~181 lines; `classify`/`NLAnalyzer` re-exports from `src/nar/index.ts:99` (2 lines)
- **Rewritten:** agent.ts (222 → ~200), index.ts (5 → ~10), ModelRunner.test.ts (import fix)
- **Created:** tools.ts (~100), ParseTask.test.ts (~40)
- **Updated:** parser-peggy.ts (+~30), aisdk-adapter.ts (+~30), nar/index.ts (-2), repl.ts (minor), bot-ai.ts (minor), cli/agent.ts (minor)
- **Net:** ~660 lines total, agent-owned ~310 lines

---

## 15. Success Criteria

1. **`src/agent/`** — 5 files (agent.ts, tools.ts, model/ModelRunner.ts, model/ToolDispatcher.ts, index.ts). Agent-owned ≤ 350 lines.
2. **NAR** — additions: `parseTask()` in `parser-peggy.ts` (+~30 lines); `nar_goal` + `nar_get_goals` tools, and `nar_believe` truth-format fix in `aisdk-adapter.ts` (+~30 lines). No other changes.
3. **`pnpm run typecheck`** — passes.
4. **`pnpm run lint`** — 0 new errors.
5. **`pnpm run test:unit`** — passes.
6. **`pnpm run repl`** — banner, `.help`, all new commands, Narsese input, NL chat, correction via LM, exit.
7. **Parse gate works** — `(cat --> animal).` feeds NAR directly (no LM call).
8. **Agent never calls `nar.run()` in chat/believe** — grep `src/agent/` for `nar\.run\(` returns only inside `start()`'s setInterval (the throttle-controlled background loop).
9. **LM tools work** — "remember that cats are mammals" → LM calls `nar_believe`.
10. **`know()` works** — `.know project-goals "Build agent"` → `.know project-goals` returns value.
11. **`recall()` works** — episodes are logged and searchable.
12. **Throttle works** — `.throttle 0` pauses reasoning, `.throttle 100` resumes.
13. **No `route()` in agent** — grep `src/agent/` for `route(` returns 0 matches.
14. **No intent classification in agent** — grep for `classify`, `NLAnalyzer`, `Route` in agent files returns 0.
15. **No regex correction detection** — grep for `CORRECTION_PATTERN`, `no.*actually` in agent files returns 0.
16. **Graceful degradation** — agent works with any subset of {NAR, LM, EpisodicMemory}.
17. **System prompt from constitution + opts** — grep for hardcoded `You are` returns at most one fallback string.
18. **`safeLog` uses `EpisodeType`** — grep for `safeLog('` shows only valid episode types.
19. **Context includes episodes** — `buildContext()` fetches recent episodes from EpisodicMemory.
20. **Questions check existing beliefs** — `(cat --> ?)` returns existing belief if available, queues otherwise.

---

## 16. Why This Is Worth Building

| Aspect | v4 | NEXT4 (round 3) | v6 (the harness) |
|--------|-----|-----------------|-------------------|
| Dispatch | 4-way Route union | 3 Narsese verbs by punctuation | **Parse gate + LM tools** |
| Intent handling | 10 NL intents | 5 paths in chat() | **2 paths: parse or delegate** |
| Correction | none | regex detection | **LM handles naturally** |
| History | class field + EpisodicMemory | EpisodicMemory | **EpisodicMemory (single source)** |
| Knowledge | none | none | **`know(key, value)` explicit store** |
| Reasoning | synchronous in chat() | synchronous in chat() | **async, agent never calls run()** |
| Agent decides | what intent, what handler | which Narsese verb | **nothing — LM decides** |
| Lines (agent-owned) | 670 | ~440 | **~310** |
| Files | 6 | 3+index | **5 (3 agent-owned)** |

**v6 is the simplest version because it delegates the hardest
decision (what to do) to the component designed for decisions
(the Language Model).** The agent is a harness: parse gate,
tool definitions, context builder, lifecycle manager. Nothing
more. It scales with the LM because the LM chooses which tools
to use and how to compose them.

The agent never calls `nar.run()`. Background reasoning is
the only thing that processes the inference queue, controlled
by the throttle. The agent is always responsive. The LM has
`nar_question` and `nar_reason` tools for immediate results,
but those are the LM's choices, not the agent's.

The NAR changes are: `parseTask()` in the parser, plus `nar_goal`,
`nar_get_goals`, and the `nar_believe` truth-format fix in the
tool adapter. Everything else is agent-side. The agent
doesn't interpret, classify, or route — it provides and listens.

---

## 17. Verification Notes

### Gaps Found During Review

| Gap | Severity | Fix |
|-----|----------|-----|
| Fast path didn't call `run()` | Critical | Removed — agent never calls `run()`. Background loop handles it. |
| `nar_believe` tool didn't call `run()` | Critical | Correct by design — tools that need immediate results (`nar_question`, `nar_reason`) call `run()`. Others queue. |
| Episodes not passed to context builder | High | Fixed — `buildContext()` is now async, fetches recent episodes from EpisodicMemory. |
| No `nar_goal` tool | High | Fixed — added to `createNARSTools()` in section 3.3. |
| No `nar_get_goals` tool | Medium | Fixed — added to tool adapters section 3.3. |
| `nar_believe` truth format invalid | Medium | Fixed — replaced ` :|: truth=f` with standard `%f;c%` suffix. |
| `parseTask` mapped `'@'` to non-existent `'quest'` | High | Fixed — `'@'` is quest-variable syntax, not a task punctuation; removed from `puncToType`. |
| `parseTask` returned raw truthValue, not `Truth` | High | Fixed — wrap with `Truth.create(frequency, confidence)`. |
| `ModelRunner.test.ts` imports from non-existent `src/agent/types.js` | High | Fixed — section 14 migration adds the fix. |
| `tools.ts` used `parameters:` (AI SDK v4) | Critical | Fixed — AI SDK v5 uses `inputSchema:`; section 6 corrected. |
| `handleBelief` called `nar.run(5)` synchronously | High | Documented as a behavior change in migration 14.4. |
| FeedbackLearner/RLFPLearner not wired | Medium | Added as opt-in in section 3.7. |
| `NLAnalyzer`/`classify` become dead code | Low | Added to migration delete list (14.1). |
| Working memory tools imported but unused | Low | Not included in default tool set — can be added by consumers who need structured reasoning slots. |
| `EpisodicMemory.getEpisodes` returns per-day-file results, not strictly global latest | Low | Documented inline in `buildContext()` — call `getEpisodes({limit: 5})` to get up to 5 most recent across the latest date file(s). |

### Cognitive Loop Completeness

| Phase | Coverage | Notes |
|-------|----------|-------|
| **Perceive** | Parse gate → Narsese or NL | Deterministic, no LM cost for Narsese |
| **Remember** | safeLog on every chat() call | EpisodicMemory is single source |
| **Reason** | Background loop via throttle | Agent never calls run() |
| **Act** | LM tools (nar_believe, know, etc.) | LM decides what tools to call |
| **Reflect** | Self-analysis (opt-in) | ReasoningAboutReasoning.start() |
| **Respond** | Immediate via LM or parse gate | Never blocks on inference |

### Key Design Invariant

**The agent never calls `nar.run()`.** This is the fundamental
separation between the agent harness and the reasoning engine.
The agent feeds input and checks state. The background loop
processes the inference queue. The LM has tools for immediate
results, but those are the LM's choices, not the agent's.

This means the agent is always responsive, regardless of
NAR's reasoning state. Even at throttle=0%, the agent can
respond to user input via the LM. The LM just won't get new
derivations until reasoning resumes.

---

**This is the plan. Build it.**
