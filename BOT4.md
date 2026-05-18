# BOT4.md — Bot Framework Redesign for User Ergonomics

## Vision

A unified bot framework that degrades gracefully across three configurations:

| Configuration | Behavior |
|---|---|
| **Full** (LM + SeNARS) | Intelligent agent with reasoning, memory, and natural conversation |
| **LM-only** | Ordinary LM-powered agent/chatbot with tools and commands |
| **SeNARS-only** | NARS reasoning REPL with formal logic input/output |

No single mode is primary. The framework detects available capabilities at startup and adapts.

---

## Problems with Current Architecture

### 1. Coupled processing path
`Agent.processMessage()` hardcodes a single flow: `classifyInput()` → NAR ops → `ChatResponder.respond()` → `ResponseInterpreter.interpret()` → `executeAndRespond()`. There is no clean separation between LM and SeNARS paths. Removing either breaks the flow. The `chatResponder` field is optional but the switch statement still assumes its presence in the default branch.

### 2. AgenticLoop always reasons
The wakeup sequence unconditionally runs `nar.run(steps)`, `nar.enrichMemoryWithLM()`, `nar.memory.consolidate()`. Even in LM-only mode, it tries NAR operations. The loop holds a direct `Agent` reference and calls `agent.processMessage()` — it cannot operate independently.

### 3. Punctuation-based classification
`classifyInput()` in `Agent.ts:364-371` uses `.` → command, terminal `.` → belief, `?` → question, `!` → goal. This is brittle: "I think it is." becomes a belief, not chat. No mixed intent handling. No natural language reasoning requests.

### 4. No streaming
All responses are full request/response. `ChatResponder.respond()` calls `generateText()` (blocking). No token streaming, no interleaved reasoning visibility, no real-time feedback.

### 5. Dot-command convention
`.` prefix conflicts with sentence-ending punctuation and is non-standard. Modern chat platforms use `/`.

### 6. No auto-reasoning trigger
SeNARS reasoning only happens via explicit commands or the blind wakeup loop. The bot never decides "this conversation would benefit from reasoning." `ResponseInterpreter` extracts `[BELIEVE:...]` directives from LM output but never triggers reasoning proactively.

### 7. Fragmented state
`ConversationManager` (per-user messages), `ChatResponder.conversationHistory` (LM history, max 10 pairs), `LastResults` (turn results, max 20), NAR internal state, `EpisodicMemory` (JSONL traces). Five separate state stores with no unified view. `ConversationState` is not shared between `ChatResponder` and `ConversationManager`.

### 8. No TUI feedback
No typing indicators, no reasoning progress, no structured output rendering. Terminal UX is raw text. The REPL in `repl.ts` reads stdin and prints stdout with no visual structure.

### 9. ResponseInterpreter is LM-specific
`ResponseInterpreter` only works on LM output text. It extracts `[BELIEVE:...]`, `[TOOL:...]`, `[QUESTION:...]` directives. There is no symmetric mechanism for user input to trigger NAR operations.

### 10. Connection context is ad-hoc
`ChannelContext` is constructed inline in `bot.ts:94-105` for each message. No typed abstraction for per-connection state. The `respond` closure captures `connectionType` and `msg.source` manually.

---

## Architecture

### Core Principle: Pipeline + Unified Context

```
Input ──▶ [Middleware Pipeline] ──▶ BotResponse
  │            │                         │
  │            ├── InputNormalizer        ├── text (final response)
  │            ├── CommandProcessor       ├── reasoning (optional derivations)
  │            ├── InputClassifier        ├── actions (tool calls, beliefs added)
  │            ├── ReasoningTrigger       ├── streaming (AsyncIterable)
  │            ├── SeNARSProcessor        └── metadata (confidence, mode)
  │            ├── LMResponder
  │            ├── ToolExecutor
  │            ├── ResponseComposer
  │            ├── ResponseFormatter
  │            └── StatePersistor
  │
  └── IOMessage (source, sender, text, channel)
```

### Unified BotContext

Single context object passed through the pipeline. Replaces fragmented state managers.

```typescript
interface BotContext {
    // Identity
    profile: BotProfile;

    // Capabilities (optional — framework adapts)
    lm?: LMClient;
    seNARS?: NAR;

    // Connection info (replaces ChannelContext)
    connection: ConnectionInfo;

    // Unified conversation state (per-sender)
    conversation: ConversationState;

    // Current turn
    turn: TurnState;

    // Configuration
    config: BotConfig;

    // Runtime capabilities (detected at startup)
    capabilities: Capabilities;
}

interface ConnectionInfo {
    id: string;
    type: ChannelType;
    sender: string;
    respond: (text: string | StreamChunk) => Promise<void>;
    stream: (stream: AsyncIterable<StreamChunk>) => Promise<void>;
}

interface ConversationState {
    messages: Message[];              // Full history (prunable)
    summary?: string;                 // Auto-summarized when history grows
    workingMemory: Map<string, unknown>;  // Cross-turn scratchpad (separate from NAR WorkingMemory)
    reasoningArtifacts: ReasoningArtifact[];  // Visible reasoning steps
    pinnedBeliefs: Set<string>;       // User-pinned context
    lastClassification?: InputClassification;
    mode: BotMode;                    // 'auto' | 'chat' | 'reason'
}

interface TurnState {
    input: IOMessage;
    classification: InputClassification;
    reasoningTriggered: boolean;
    reasoningResult?: DerivationResult;
    lmResponse?: string;
    lmSuggestsReasoning: boolean;
    toolResults: ToolResult[];
    actions: TurnAction[];
    finalResponse: string;
    error?: Error;
}

interface DerivationResult {
    steps: number;        // Number of derivation steps executed
    beliefs: Belief[];    // Current beliefs after derivation
}

interface ToolResult {
    name: string;
    result?: unknown;
    error?: string;
}

interface TurnAction {
    type: 'believe' | 'question' | 'goal' | 'tool_call';
    content: string;
    result?: string;
}

interface BotConfig {
    reasoning: {
        autoTrigger: boolean;
        triggerThreshold: number;
        triggerCooldown: number;
        maxStepsPerTrigger: number;
        backgroundReasoning: boolean;
        backgroundIntervalMs: number;
    };
    streaming: {
        enabled: boolean;
        showReasoningSteps: boolean;
        showToolCalls: boolean;
    };
    conversation: {
        maxHistory: number;
        summaryThreshold: number;
        maxArtifacts: number;
    };
    tui: {
        typingIndicator: boolean;
        colors: boolean;
        compactMode: boolean;
    };
}

type BotMode = 'auto' | 'chat' | 'reason';
```

**Key design**: `lm` and `seNARS` are optional. The pipeline checks availability at each stage and skips gracefully. `ConversationState` is per-sender (keyed by `connection.sender`), replacing `ConversationManager`.

### Capability Detection at Startup

```typescript
interface Capabilities {
    hasLM: boolean;
    hasSeNARS: boolean;
    hasStreaming: boolean;
    hasTools: boolean;
    hasMemory: boolean;
    mode: 'full' | 'lm-only' | 'senars-only';
}

function detectCapabilities(lm?: LMClient, seNARS?: NAR): Capabilities {
    const hasLM = !!lm && lm.isAvailable();
    const hasSeNARS = !!seNARS;
    const mode = hasLM && hasSeNARS ? 'full'
        : hasLM ? 'lm-only'
        : hasSeNARS ? 'senars-only'
        : (() => { throw new Error('At least one capability required'); })();

    return {
        hasLM,
        hasSeNARS,
        hasStreaming: hasLM && lm!.supportsStreaming(),
        hasTools: hasSeNARS && seNARS!.tools.count > 0,
        hasMemory: hasSeNARS && !!seNARS!.memory,
        mode,
    };
}
```

Startup behavior adapts to mode:
- **full**: All stages active, auto-reasoning enabled, streaming on
- **lm-only**: SeNARS stages skipped, auto-reasoning disabled, tool commands hidden
- **senars-only**: LM stages skipped, direct Narsese input, reasoning always shown

---

## Pipeline Architecture

### Message Pipeline

Replaces `Agent.processMessage()` with composable middleware stages.

```typescript
interface PipelineStage {
    name: string;
    priority: number;  // Lower runs first
    enabled: (ctx: BotContext) => boolean;
    execute(ctx: BotContext): Promise<void>;
}

class MessagePipeline {
    private stages: PipelineStage[];

    constructor(stages: PipelineStage[]) {
        this.stages = stages.sort((a, b) => a.priority - b.priority);
    }

    async process(message: IOMessage, ctx: BotContext): Promise<BotResponse> {
        ctx.turn.input = message;
        for (const stage of this.stages) {
            if (!stage.enabled(ctx)) continue;
            await stage.execute(ctx);
            // CommandProcessor sets finalResponse and skips remaining stages
            if (ctx.turn.finalResponse && stage.name === 'CommandProcessor') break;
        }
        return this.composeResponse(ctx);
    }

    private composeResponse(ctx: BotContext): BotResponse {
        return {
            text: ctx.turn.finalResponse,
            reasoning: ctx.turn.reasoningResult,
            actions: ctx.turn.actions,
        };
    }
}

interface BotResponse {
    text: string;
    reasoning?: DerivationResult;
    actions: TurnAction[];
}
```

**Key change from previous design**: Stages execute sequentially without `next()` callbacks. `CommandProcessor` sets `ctx.turn.finalResponse` and the pipeline breaks out of the loop. This is simpler, more predictable, and avoids the callback nesting bug from the previous design.

### Standard Stages (in priority order)

| # | Stage | Responsibility | Enabled when |
|---|---|---|---|
| 1 | `InputNormalizer` | Trim, detect encoding, extract inline commands | Always |
| 2 | `AuthChecker` | Verify sender permissions, rate limiting | Always |
| 3 | `CommandProcessor` | Handle `/` commands, early return if matched | Input starts with `/` |
| 4 | `InputClassifier` | Classify intent: chat, reason, query, goal, narsese | Always |
| 5 | `ReasoningTrigger` | Decide if SeNARS reasoning should activate | SeNARS available AND auto mode |
| 6 | `SeNARSProcessor` | Execute NAL operations (believe, question, goal, derive) | SeNARS available AND (triggered OR narsese intent) |
| 7 | `LMResponder` | Generate LM response with reasoning context | LM available |
| 8 | `ToolExecutor` | Execute tool calls from LM response or explicit commands | SeNARS available AND tools present AND LM response has directives |
| 9 | `ResponseComposer` | Merge SeNARS results + LM response + tool output | Always |
| 10 | `ResponseFormatter` | Channel-specific formatting (IRC chunking, markdown) | Always |
| 11 | `StatePersistor` | Update conversation state, episodic memory | Always |

Each stage is independent. Stages can be added, removed, or reordered. The `enabled()` predicate determines runtime activation.

### Stage Execution Flow

```
InputNormalizer     → normalize text, detect encoding
     │
AuthChecker         → check permissions, rate limits
     │
CommandProcessor    → if /command: execute, set finalResponse, BREAK (skip remaining)
     │               → else: pass through
InputClassifier     → set turn.classification (weighted multi-signal)
     │
ReasoningTrigger    → if should trigger: set turn.reasoningTriggered = true
     │
SeNARSProcessor     → if triggered OR narsese intent: run NAL ops, set turn.reasoningResult
     │
LMResponder         → if LM available: generate response, set turn.lmResponse
     │
ToolExecutor        → if LM response has [TOOL:...]: execute, set turn.toolResults
     │
ResponseComposer    → merge all results into turn.finalResponse
     │
ResponseFormatter   → format for channel type
     │
StatePersistor      → update conversation, log to episodic memory
```

### Stage Specifications

#### InputNormalizer

```typescript
class InputNormalizer implements PipelineStage {
    name = 'InputNormalizer';
    priority = 1;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        const text = ctx.turn.input.text.trim();
        // Strip zero-width characters, normalize Unicode
        ctx.turn.input.text = text.normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, '');
    }
}
```

#### AuthChecker

```typescript
class AuthChecker implements PipelineStage {
    name = 'AuthChecker';
    priority = 2;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        const { connectionId, sender } = ctx.connection;
        // Check rate limiting
        if (this.isRateLimited(connectionId, sender)) {
            ctx.turn.finalResponse = 'Rate limited. Please wait before sending more messages.';
            return;
        }
        // Check permissions (if auth manager configured)
        if (this.authManager && this.authManager.shouldIgnore(connectionId, sender, ctx.turn.input.text)) {
            ctx.turn.finalResponse = '';  // Silent ignore
        }
    }
}
```

#### CommandProcessor

```typescript
class CommandProcessor implements PipelineStage {
    name = 'CommandProcessor';
    priority = 3;
    enabled = (ctx) => ctx.turn.input.text.trim().startsWith('/');

    async execute(ctx: BotContext): Promise<void> {
        const text = ctx.turn.input.text.trim();
        const parts = text.slice(1).split(/\s+/);
        const cmdName = '/' + parts[0];
        const args = parts.slice(1);

        const cmd = this.registry.get(cmdName);
        if (!cmd) {
            ctx.turn.finalResponse = `Unknown command: ${cmdName}. Type /help for available commands.`;
            return;
        }

        // Check requirements
        if (cmd.requiresLM && !ctx.capabilities.hasLM) {
            ctx.turn.finalResponse = `Command ${cmdName} requires LM (not available).`;
            return;
        }
        if (cmd.requiresSeNARS && !ctx.capabilities.hasSeNARS) {
            ctx.turn.finalResponse = `Command ${cmdName} requires SeNARS (not available).`;
            return;
        }
        if (cmd.requiresFull && (!ctx.capabilities.hasLM || !ctx.capabilities.hasSeNARS)) {
            ctx.turn.finalResponse = `Command ${cmdName} requires both LM and SeNARS.`;
            return;
        }

        const result = await cmd.handler(args, ctx);
        ctx.turn.finalResponse = typeof result === 'string' ? result : await streamToString(result);
    }
}
```

#### InputClassifier

```typescript
class InputClassifier implements PipelineStage {
    name = 'InputClassifier';
    priority = 4;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        ctx.turn.classification = classify(ctx.turn.input.text, ctx.conversation);
    }
}
```

#### SeNARSProcessor

```typescript
class SeNARSProcessor implements PipelineStage {
    name = 'SeNARSProcessor';
    priority = 6;
    enabled = (ctx) => ctx.capabilities.hasSeNARS &&
        (ctx.turn.reasoningTriggered || ctx.turn.classification.primary === 'narsese');

    async execute(ctx: BotContext): Promise<void> {
        const nar = ctx.seNARS!;
        const text = ctx.turn.input.text.trim();
        const classification = ctx.turn.classification;

        switch (classification.primary) {
            case 'narsese':
                // Direct Narsese input
                if (text.startsWith('!')) {
                    await nar.goal(text.slice(1));
                } else if (text.includes('?')) {
                    await nar.question(text);
                    const derived = await nar.run(5);
                    ctx.turn.reasoningResult = { steps: derived, beliefs: nar.getBeliefs() };
                } else {
                    await nar.believe(text);
                    const derived = await nar.run(3);
                    ctx.turn.reasoningResult = { steps: derived, beliefs: nar.getBeliefs() };
                }
                break;

            case 'goal':
                await nar.goal(text.slice(1));
                break;

            case 'query':
                await nar.question(text);
                const qDerived = await nar.run(5);
                if (qDerived > 0) {
                    ctx.turn.reasoningResult = { steps: qDerived, beliefs: nar.getBeliefs() };
                }
                break;

            default:
                // Auto-triggered reasoning
                if (ctx.turn.reasoningTriggered) {
                    // Convert natural language to Narsese and reason
                    const narseseInput = this.naturalLanguageToNarsese(text, ctx);
                    if (narseseInput) {
                        await nar.believe(narseseInput);
                    }
                    const derived = await nar.run(ctx.config.reasoning.maxStepsPerTrigger);
                    ctx.turn.reasoningResult = { steps: derived, beliefs: nar.getBeliefs() };
                }
                break;
        }
    }

    private naturalLanguageToNarsese(text: string, ctx: BotContext): string | null {
        // Heuristic: "X is a Y" → (<X --> Y>.)
        const isAMatch = text.match(/^([A-Za-z_]+)\s+is\s+a\s+([A-Za-z_]+)/i);
        if (isAMatch) return `(<${isAMatch[1]} --> ${isAMatch[2]}>.)`;

        // Heuristic: "X has Y" → (<X --> [has_Y]>.)
        const hasMatch = text.match(/^([A-Za-z_]+)\s+has\s+([A-Za-z_]+)/i);
        if (hasMatch) return `(<${hasMatch[1]} --> ${hasMatch[2]}>.)`;

        return null;
    }
}
```

#### LMResponder

```typescript
class LMResponder implements PipelineStage {
    name = 'LMResponder';
    priority = 7;
    enabled = (ctx) => ctx.capabilities.hasLM;

    async execute(ctx: BotContext): Promise<void> {
        if (!ctx.lm) return;

        const messages = this.buildMessages(ctx);

        if (ctx.config.streaming.enabled && ctx.lm.supportsStreaming()) {
            await this.streamResponse(ctx, messages);
        } else {
            ctx.turn.lmResponse = await ctx.lm.generate(messages);
        }
    }

    private async streamResponse(ctx: BotContext, messages: Message[]): Promise<void> {
        let fullResponse = '';

        // Send typing indicator
        await ctx.connection.respond({ type: 'status', content: 'typing', done: false });

        for await (const chunk of ctx.lm.stream(messages)) {
            fullResponse += chunk.content;
            await ctx.connection.respond(chunk);
        }

        // Strip reasoning suggestion marker from visible response
        const cleaned = fullResponse.replace(/\[REASONING_SUGGESTED:[^\]]*\]\s*/g, '');
        ctx.turn.lmResponse = cleaned.trim();

        // Flag for wiring code to set metadata when adding assistant message
        if (/\[REASONING_SUGGESTED:/.test(fullResponse)) {
            ctx.turn.lmSuggestsReasoning = true;
        }
    }

    private buildMessages(ctx: BotContext): Message[] {
        const system = this.buildSystemPrompt(ctx);
        const history = ctx.conversation.getHistory(ctx.config.conversation.maxHistory);

        return [
            { role: 'system', content: system },
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: ctx.turn.input.text },
        ];
    }
}
```

#### ToolExecutor

```typescript
class ToolExecutor implements PipelineStage {
    name = 'ToolExecutor';
    priority = 8;
    enabled = (ctx) => ctx.capabilities.hasTools &&
        !!ctx.turn.lmResponse && /\[TOOL:/.test(ctx.turn.lmResponse);

    async execute(ctx: BotContext): Promise<void> {
        const nar = ctx.seNARS!;
        const directives = extractToolDirectives(ctx.turn.lmResponse!);

        for (const directive of directives) {
            const tool = nar.toolManager.get(directive.name);
            if (!tool) {
                ctx.turn.toolResults.push({ name: directive.name, error: 'Tool not found' });
                continue;
            }
            try {
                const result = await tool.execute(directive.args);
                ctx.turn.toolResults.push({ name: directive.name, result });

                // If tool produces Narsese, feed back to reasoner
                if (result.narsese) {
                    await nar.believe(result.narsese);
                    await nar.run(3);
                }
            } catch (error) {
                ctx.turn.toolResults.push({ name: directive.name, error: String(error) });
            }
        }

        // Strip tool directives from visible response
        ctx.turn.lmResponse = ctx.turn.lmResponse!.replace(/\[TOOL:[^\]]*\]\s*/g, '').trim();
    }
}
```

#### ResponseComposer

```typescript
class ResponseComposer implements PipelineStage {
    name = 'ResponseComposer';
    priority = 9;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        // If CommandProcessor already set response, skip
        if (ctx.turn.finalResponse) return;

        const parts: string[] = [];

        // SeNARS reasoning result
        if (ctx.turn.reasoningResult) {
            const r = ctx.turn.reasoningResult;
            if (r.steps > 0) {
                parts.push(this.formatReasoningResult(r));
            } else if (ctx.turn.classification.primary === 'narsese') {
                parts.push('No derivations found.');
            }
        }

        // LM response
        if (ctx.turn.lmResponse) {
            parts.push(ctx.turn.lmResponse);
        }

        // Tool results
        if (ctx.turn.toolResults.length > 0) {
            parts.push(this.formatToolResults(ctx.turn.toolResults));
        }

        // Fallback if nothing produced output
        if (parts.length === 0) {
            const classification = ctx.turn.classification;
            switch (classification.primary) {
                case 'narsese':
                    parts.push('Processed. No derivations.');
                    break;
                case 'query':
                    parts.push(ctx.capabilities.hasSeNARS
                        ? 'No derivation found. Try adding related beliefs first.'
                        : "I don't have enough information to answer that.");
                    break;
                default:
                    parts.push(ctx.capabilities.hasLM
                        ? "I'm not sure how to respond to that."
                        : 'Processed.');
            }
        }

        ctx.turn.finalResponse = parts.join('\n\n');
    }

    private formatReasoningResult(result: DerivationResult): string {
        return `Derived ${result.steps} belief(s).`;
    }

    private formatToolResults(results: ToolResult[]): string {
        return results.map(r =>
            r.error ? `✗ ${r.name}: ${r.error}` : `✓ ${r.name}: ${r.result}`
        ).join('\n');
    }
}
```

#### ResponseFormatter

```typescript
class ResponseFormatter implements PipelineStage {
    name = 'ResponseFormatter';
    priority = 10;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        const { connectionType } = ctx.connection;
        const text = ctx.turn.finalResponse;

        // IRC: strip markdown, chunk to 400 chars
        if (connectionType === 'irc') {
            ctx.turn.finalResponse = this.formatForIRC(text);
        }
        // WS/HTTP: keep markdown, no chunking needed (streaming handles it)
        // CLI: keep markdown, optional colors
        // Pipe: JSON-formatted if requested
    }

    private formatForIRC(text: string): string {
        return text
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/`(.+?)`/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .slice(0, 400);
    }
}
```

#### StatePersistor

```typescript
class StatePersistor implements PipelineStage {
    name = 'StatePersistor';
    priority = 11;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        // Log to episodic memory
        this.episodicMemory?.log({
            type: 'turn',
            input: ctx.turn.input.text,
            output: ctx.turn.finalResponse,
            classification: ctx.turn.classification.primary,
            reasoningTriggered: ctx.turn.reasoningTriggered,
            sender: ctx.connection.sender,
            source: ctx.connection.id,
            timestamp: Date.now(),
        });
    }
}
```

---

## Utility Functions

### Tool Directive Extraction

```typescript
interface ToolDirective {
    name: string;
    args: string;
}

function extractToolDirectives(response: string): ToolDirective[] {
    const pattern = /\[TOOL:\s*(\w+)\s*\(([^)]*)\)\]/gi;
    const results: ToolDirective[] = [];
    for (const match of response.matchAll(pattern)) {
        results.push({ name: match[1]!, args: match[2]! });
    }
    return results;
}
```

### Stream to String

```typescript
async function streamToString(stream: AsyncIterable<{ content: string }>): Promise<string> {
    let result = '';
    for await (const chunk of stream) result += chunk.content;
    return result;
}
```

---

## StreamChunk Types

```typescript
interface StreamChunk {
    type: 'text' | 'reasoning' | 'tool' | 'error' | 'status';
    content: string;
    done: boolean;
    metadata?: Record<string, unknown>;
}

interface LMClient {
    isAvailable(): boolean;
    supportsStreaming(): boolean;
    generate(messages: Message[], options?: GenerateOptions): Promise<string>;
    stream(messages: Message[], options?: StreamOptions): AsyncIterable<StreamChunk>;
}
```

**Note**: `summarize()` was removed from `LMClient` — auto-summarization uses `generate()` with a summarization prompt instead of a dedicated method. This keeps the interface minimal.

---

## Input Classification

Replaces punctuation-based `classifyInput()` with multi-signal classification.

```typescript
type Intent = 'chat' | 'reason' | 'query' | 'goal' | 'command' | 'narsese';

interface InputClassification {
    primary: Intent;
    secondary?: Intent;       // For mixed intent
    confidence: number;       // 0-1
    signals: ClassificationSignal[];
    narseseTerms?: string[];  // Extracted Narsese terms if detected
}

interface ClassificationSignal {
    type: 'keyword' | 'pattern' | 'structure' | 'lm-suggestion' | 'narsese';
    source: string;           // What triggered this signal
    intent: Intent;
    weight: number;           // 0-1 contribution
}
```

**Classification signals:**

| Signal | Detection | Weight | Intent |
|---|---|---|---|
| `/` prefix | Exact match | 1.0 | command |
| Narsese syntax | `(<A --> B>.)`, `(A ==> B>.)` | 0.9 | narsese |
| Terminal `?` | Punctuation | 0.6 | query |
| Terminal `.` | Punctuation | 0.3 | chat (low — sentences end with `.`) |
| Leading `!` | Punctuation | 0.8 | goal |
| Reasoning keywords | "think about", "analyze", "why", "derive", "prove" | 0.5 | reason |
| Multi-hop patterns | "if X then what", "given A does B" | 0.4 | reason |
| Causal language | "because", "therefore", "implies", "since" | 0.3 | reason |
| LM suggestion | `metadata.suggestsReasoning` from prior turn | 0.3 | reason |
| Narsese-like NL | "X is a Y", "X has property Y" | 0.2 | reason |
| Directive patterns | "tell me", "what is", "explain" | 0.3 | query |

Classification uses weighted scoring per intent. Primary = highest aggregate score. Secondary = second highest if within 0.2 of primary. Confidence = primary score normalized.

```typescript
// Narsese detection regex
const NARSESE_REGEX = /^\s*\(\s*<[^>]+>\s*(-->|<->|==>|<=>|&&|\|\|)\s*/;

// Keyword signals: [regex, intent, weight]
const KEYWORD_SIGNALS: [RegExp, Intent, number][] = [
    [/\b(why|how|therefore|because|implies|derive|prove|explain|analyze|reason)\b/i, 'reason', 0.5],
    [/\b(if|then|when|given|suppose|assuming)\b.*\b(then|what|would|does)\b/i, 'reason', 0.4],
    [/\b(difference between|compare|similar to|unlike|versus|vs)\b/i, 'reason', 0.2],
    [/\b(tell me|what is|explain|describe|define)\b/i, 'query', 0.3],
    [/\b([A-Z][a-z]+)\s+(is a|are|has|can|does|implies)\s+([A-Z][a-z]+)/i, 'reason', 0.2],
];

function classify(input: string, context: ConversationState): InputClassification {
    const scores: Record<Intent, number> = { chat: 0.1, reason: 0, query: 0, goal: 0, command: 0, narsese: 0 };
    const signals: ClassificationSignal[] = [];
    const trimmed = input.trim();

    if (trimmed.startsWith('/')) {
        scores.command = 1.0;
        signals.push({ type: 'structure', source: 'slash-prefix', intent: 'command', weight: 1.0 });
    }

    if (NARSESE_REGEX.test(trimmed)) {
        scores.narsese = 0.9;
        signals.push({ type: 'narsese', source: 'syntax-match', intent: 'narsese', weight: 0.9 });
    }

    if (trimmed.startsWith('!')) {
        scores.goal = 0.8;
        signals.push({ type: 'structure', source: 'bang-prefix', intent: 'goal', weight: 0.8 });
    }

    if (trimmed.endsWith('?')) {
        scores.query += 0.6;
        signals.push({ type: 'structure', source: 'question-mark', intent: 'query', weight: 0.6 });
    }

    for (const [pattern, intent, weight] of KEYWORD_SIGNALS) {
        if (pattern.test(trimmed)) {
            scores[intent] += weight;
            signals.push({ type: 'keyword', source: pattern.source, intent, weight });
        }
    }

    const lastMsg = context.messages.at(-1);
    if (lastMsg?.role === 'assistant' && lastMsg.metadata?.suggestsReasoning) {
        scores.reason += 0.3;
        signals.push({ type: 'lm-suggestion', source: 'prior-turn', intent: 'reason', weight: 0.3 });
    }

    if (context.mode === 'reason') scores.reason += 0.5;
    if (context.mode === 'chat') scores.chat += 0.5;

    const primary = Object.entries(scores).reduce((a, b) => b[1] > a[1] ? b : a) as [Intent, number];
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const secondary = sorted[1][1] > primary[1] - 0.2 ? sorted[1][0] as Intent : undefined;

    return { primary: primary[0], secondary, confidence: Math.min(primary[1], 1.0), signals };
}
```

---

## Command System: `/` Prefix

All commands use `/` prefix. Dot-commands from prior versions are aliased during migration.

### Command Categories

| Category | Commands | Requires | Description |
|---|---|---|---|
| **Core** | `/help`, `/status`, `/quit`, `/commands` | — | Basic operations |
| **Mode** | `/mode chat`, `/mode reason`, `/mode auto` | — | Override auto-detection |
| **Memory** | `/beliefs`, `/concepts`, `/pin`, `/recall`, `/unpin`, `/forget` | SeNARS | SeNARS memory |
| **Reasoning** | `/run [n]`, `/input <narsese>`, `/goal <narsese>`, `/question <narsese>`, `/trace` | SeNARS | SeNARS operations |
| **Tools** | `/tools`, `/tools.list`, `/tools.run <name> [args]` | SeNARS | Tool management |
| **LM** | `/lm.status`, `/lm.enrich`, `/lm.model <name>`, `/lm.stream on\|off` | LM | LM controls |
| **Self** | `/self.analyze`, `/self.propose`, `/self.apply`, `/self.status` | Full | Self-analysis |
| **Config** | `/config.get`, `/config.set`, `/config.reset`, `/config.diff` | — | Configuration |
| **Episodes** | `/episodes`, `/episodes.recent`, `/episodes.search <query>` | — | Episodic memory |
| **Scenarios** | `/scenario.run`, `/scenario.list`, `/scenario.run-batch` | SeNARS | Benchmark scenarios |
| **Experiments** | `/experiment.create`, `/experiment.run`, `/experiment.list`, `/experiment.results` | Full | Experiments |

### Command Definition

```typescript
interface CommandDef {
    name: string;               // e.g., '/run'
    aliases?: string[];         // e.g., ['.run'] for migration
    description: string;
    usage: string;
    category: string;
    requiresLM?: boolean;       // Skip if LM unavailable
    requiresSeNARS?: boolean;   // Skip if SeNARS unavailable
    requiresFull?: boolean;     // Skip unless both available
    handler: (args: string[], ctx: BotContext) => Promise<string | AsyncIterable<StreamChunk>>;
}
```

Commands declare their dependencies. The framework hides or disables commands whose requirements aren't met. `/help` and `/commands` only show available commands for the current mode.

---

## ReasoningTrigger (Hybrid Auto-Triggering)

Decides when to automatically invoke SeNARS reasoning during conversation. Combines heuristic signals with LM suggestions.

```typescript
interface ReasoningTriggerConfig {
    heuristicWeight: number;     // default 0.6
    lmSignalWeight: number;      // default 0.4
    threshold: number;           // default 0.5 — activation threshold
    cooldownTurns: number;       // default 3 — min turns between auto-triggers
    maxStepsPerTrigger: number;  // default 5 — reasoning steps when auto-triggered
    sensitivity: 'low' | 'medium' | 'high';  // adjusts threshold
}

interface TriggerDecision {
    activate: boolean;
    confidence: number;
    reason?: string;
    suggestedSteps?: number;
}

class ReasoningTrigger {
    private cooldown = 0;

    shouldTrigger(ctx: BotContext): TriggerDecision {
        if (this.cooldown > 0) { this.cooldown--; return { activate: false, confidence: 0, reason: 'cooldown' }; }
        if (!ctx.capabilities.hasSeNARS) return { activate: false, confidence: 0, reason: 'unavailable' };
        if (ctx.conversation.mode === 'chat') return { activate: false, confidence: 0, reason: 'chat-mode' };

        const heuristicScore = this.evaluateHeuristics(ctx);
        const lmScore = this.evaluateLMSignal(ctx);
        const combined = (heuristicScore * this.config.heuristicWeight) +
                         (lmScore * this.config.lmSignalWeight);

        if (combined >= this.config.threshold) {
            this.cooldown = this.config.cooldownTurns;
            return { activate: true, confidence: combined, reason: this.explain(heuristicScore, lmScore), suggestedSteps: this.suggestSteps(combined) };
        }

        return { activate: false, confidence: combined };
    }

    private evaluateHeuristics(ctx: BotContext): number {
        const input = ctx.turn.input.text.toLowerCase();
        let score = 0;

        if (this.detectKnowledgeGap(input, ctx)) score += 0.3;
        if (this.detectContradiction(input, ctx)) score += 0.4;
        if (/\b(why|how|therefore|because|implies|derive|prove|explain|analyze|reason)\b/.test(input)) score += 0.2;
        if (/\b(if|then|when|given|suppose|assuming)\b.*\b(then|what|would|does)\b/.test(input)) score += 0.3;
        if (/\b([A-Z][a-z]+)\s+(is a|are|has|can|does|implies)\s+([A-Z][a-z]+)/i.test(input)) score += 0.2;
        if ((input.match(/\bbecause\b|\btherefore\b|\bthus\b|\bso\b/g) || []).length >= 2) score += 0.2;
        if (/\b(difference between|compare|similar to|unlike|versus|vs)\b/.test(input)) score += 0.2;

        return Math.min(score, 1.0);
    }

    private evaluateLMSignal(ctx: BotContext): number {
        const lastMsg = ctx.conversation.messages.at(-1);
        return lastMsg?.role === 'assistant' && lastMsg.metadata?.suggestsReasoning ? 0.7 : 0;
    }

    private detectKnowledgeGap(input: string, ctx: BotContext): boolean {
        if (!ctx.seNARS) return false;
        const concepts = ctx.seNARS.attentionReport(5);
        const terms = input.match(/\b[a-z]+\b/g) ?? [];
        return terms.some(t => t.length > 3 && !concepts.some(c => c.term.toLowerCase().includes(t)));
    }

    private detectContradiction(input: string, ctx: BotContext): boolean {
        if (!ctx.seNARS) return false;
        const beliefs = ctx.seNARS.getBeliefs();
        const negations = ['not', "n't", 'no', 'never', 'false', 'wrong'];
        if (!negations.some(n => input.includes(n))) return false;
        const terms = input.match(/\b[a-z]+\b/g) ?? [];
        return terms.some(t => t.length > 3 && beliefs.some(b => b.term.toLowerCase().includes(t)));
    }

    private explain(heuristic: number, lm: number): string {
        const parts: string[] = [];
        if (heuristic > 0.3) parts.push('heuristic signals');
        if (lm > 0.3) parts.push('LM suggestion');
        return parts.join(' + ') || 'combined score exceeded threshold';
    }

    private suggestSteps(confidence: number): number {
        if (confidence > 0.8) return 10;
        if (confidence > 0.6) return 5;
        return 3;
    }
}

// Pipeline stage wrapper
class ReasoningTriggerStage implements PipelineStage {
    name = 'ReasoningTrigger';
    priority = 5;
    enabled = (ctx) => ctx.capabilities.hasSeNARS && ctx.conversation.mode === 'auto';

    constructor(private trigger: ReasoningTrigger) {}

    async execute(ctx: BotContext): Promise<void> {
        const decision = this.trigger.shouldTrigger(ctx);
        ctx.turn.reasoningTriggered = decision.activate;
    }
}
```

### LM Reasoning Suggestions

When LM is available, the system prompt includes instruction to suggest reasoning:

```
If the user's question would benefit from formal logical reasoning,
knowledge derivation, or memory analysis, include this marker at the end
of your response (on its own line):

[REASONING_SUGGESTED: brief reason why]

Examples:
- User asks "Why do birds migrate?" → [REASONING_SUGGESTED: causal relationship needs derivation]
- User says "If all cats are mammals and Felix is a cat..." → [REASONING_SUGGESTED: syllogism pattern detected]
- User asks "What's the difference between A and B?" → [REASONING_SUGGESTED: comparison requires belief analysis]

Do NOT include this marker for simple factual questions or casual conversation.
```

The `LMResponder` stage extracts this marker and sets `metadata.suggestsReasoning` on the response message. The marker is stripped from visible output.

---

## Streaming Architecture

Full token-by-token streaming with optional interleaved reasoning steps.

### Streaming Pipeline Integration

When streaming is enabled, `LMResponder` streams chunks directly to the connection:

```typescript
class LMResponder implements PipelineStage {
    name = 'LMResponder';
    priority = 7;
    enabled = (ctx) => ctx.capabilities.hasLM;

    async execute(ctx: BotContext): Promise<void> {
        if (!ctx.lm) return;

        const messages = this.buildMessages(ctx);

        if (ctx.config.streaming.enabled && ctx.lm.supportsStreaming()) {
            let fullResponse = '';
            await ctx.connection.respond({ type: 'status', content: 'typing', done: false });

            for await (const chunk of ctx.lm.stream(messages)) {
                fullResponse += chunk.content;
                await ctx.connection.respond(chunk);
            }

            const cleaned = fullResponse.replace(/\[REASONING_SUGGESTED:[^\]]*\]\s*/g, '');
            ctx.turn.lmResponse = cleaned.trim();

            if (/\[REASONING_SUGGESTED:/.test(fullResponse)) {
                ctx.turn.lmSuggestsReasoning = true;
            }
        } else {
            ctx.turn.lmResponse = await ctx.lm.generate(messages);
        }
    }
}
```

### Streaming Output Protocol

For channels that support streaming (WS, HTTP, pipe), responses are sent as NDJSON:

```json
{"type": "status", "content": "typing", "done": false}
{"type": "text", "content": "Let me think", "done": false}
{"type": "text", "content": " about that...", "done": false}
{"type": "text", "content": "Birds are animals.", "done": true}
```

For channels that don't support streaming (IRC), the stream is buffered and sent as a single message:

```typescript
class ChannelStreamer {
    async streamTo(connection: ConnectionInfo, stream: AsyncIterable<StreamChunk>): Promise<void> {
        if (connection.type === 'irc') {
            const buffered: string[] = [];
            for await (const chunk of stream) {
                if (chunk.type === 'text') buffered.push(chunk.content);
            }
            await connection.respond(buffered.join(''));
        } else {
            await connection.stream(stream);
        }
    }
}
```

### Streaming Error Handling

```typescript
try {
    for await (const chunk of ctx.lm.stream(messages)) {
        fullResponse += chunk.content;
        await ctx.connection.respond(chunk);
    }
} catch (error) {
    await ctx.connection.respond({ type: 'error', content: `Stream interrupted: ${error.message}`, done: true });

    if (fullResponse.length > 0) {
        ctx.turn.lmResponse = fullResponse + ' [stream interrupted]';
    } else {
        ctx.turn.error = error as Error;
        ctx.turn.lmResponse = this.generateFallbackResponse(ctx);
    }
}
```

---

## System Prompts

### LM System Prompt (Full Mode)

```
You are {name}. {personality}

## Capabilities
You have access to a formal reasoning engine (SeNARS) that uses Narsese,
a logical language for uncertain knowledge. You can suggest that the
reasoning engine analyze the user's question by including:
  [REASONING_SUGGESTED: brief reason]

You can also instruct the system to add beliefs:
  [BELIEVE: (<term --> category>. :confidence:frequency)]

Or ask the system questions:
  [QUESTION: (<term --> ?>.)]

## Knowledge Context
{attentionReport}

{recentBeliefs}

{reasoningArtifacts}

## Conversation Guidelines
- Be concise and direct
- When uncertain, acknowledge uncertainty
- Suggest reasoning for: causal questions, logical puzzles, comparisons, contradictions
- Don't fabricate facts — if unsure, say so or suggest reasoning
- Use the reasoning context above to ground your responses
- Don't repeat Narsese syntax in normal conversation unless asked

## Response Format
Respond naturally. Only use [DIRECTIVE: ...] markers when you need the
system to take action. Markers are stripped from visible output.
```

### LM System Prompt (LM-only Mode)

```
You are {name}. {personality}

## Capabilities
You are a conversational AI with access to tools and commands.
You do not have a formal reasoning engine.

## Tools Available
{toolDescriptions}

## Conversation Guidelines
- Be concise and direct
- When uncertain, acknowledge uncertainty
- Use tools when appropriate: [TOOL:toolName(args)]
- Don't fabricate facts — if unsure, say so

## Response Format
Respond naturally. Use [TOOL: ...] markers to invoke tools.
```

### SeNARS-only System Prompt (displayed to user)

```
SeNARS Reasoning Engine — Narsese Input Mode

Accepted input:
  (<term --> category>.)          — Add belief
  (<term --> ?>)                  — Ask question
  !(<term --> goal>.)             — Set goal
  /run [n]                        — Run n reasoning steps
  /beliefs                        — Show current beliefs
  /concepts                       — Show active concepts
  /help                           — Show all commands

Examples:
  (<bird --> animal>.)            — Birds are animals
  (<robin --> bird>.)             — Robins are birds
  (<robin --> ?>)                 — What is a robin?
  /run 5                          — Derive 5 steps

Truth values: (:frequency:confidence:) — optional
  (<bird --> animal>. :1.0:0.9)   — High confidence belief
```

---

## SeNARS Prompts for Reasoner Activity

When the bot runs background reasoning (idle wakeup), it generates Narsese input to drive the reasoner:

### Unanswered Questions

```narsese
// For each question in memory with no derivation:
// Re-submit as a question to trigger fresh reasoning
(<{question_term} --> ?>)
```

### Goal Pursuit

```narsese
// For active goals, derive sub-goals:
!((<current_state> ==> <goal_state>).)
```

### Belief Consolidation

```narsese
// For clusters of related beliefs, derive transitive conclusions:
// If (<A --> B>.) and (<B --> C>.) exist, reasoner derives (<A --> C>.)
// No explicit input needed — just run reasoning steps
```

### Pattern Detection

```narsese
// Analyze episodic memory for repeated topics:
(<{topic} --> frequently_discussed>. :{frequency}:{confidence})
```

### Knowledge Gap Filling

```narsese
// For topics the user asked about but bot had no beliefs:
// Search memory for related terms, derive connections
// Run broader reasoning with relaxed thresholds
```

### Background Reasoning Configuration

```typescript
interface BackgroundReasoningConfig {
    enabled: boolean;
    intervalMs: number;
    maxStepsPerCycle: number;
    priority: {
        unansweredQuestions: number;
        activeGoals: number;
        lowConfidenceBeliefs: number;
        userTopics: number;
    };
}
```

---

## TUI / Terminal UX

### Interactive REPL

Replaces current `SeNARSCLI` with a richer terminal interface.

```typescript
interface TUIConfig {
    showReasoningSteps: boolean;
    showConfidence: boolean;
    showToolCalls: boolean;
    typingIndicator: boolean;
    colors: boolean;
    compactMode: boolean;
    statusBar: boolean;
}
```

### Visual Conventions

| Element | Format |
|---|---|
| User input | `> your message` |
| Bot response | `bot: response text` |
| Reasoning step | `  → (<A --> B>. :0.9:0.8)` (dimmed) |
| Tool call | `  ⚙ tool:calculate(2+2) = 4` |
| Command output | `  /status → ...` (formatted block) |
| Error | `  ✗ error: description` (red) |
| Streaming status | `  ⏳ thinking...` (spinner) |
| Mode indicator | `[auto]`, `[chat]`, `[reason]` (prefix) |
| Capability status | `[LM✓]`, `[LM✗]`, `[NAR✓]`, `[NAR✗]` |

### Status Bar

Persistent status bar at bottom of terminal (when TTY detected):

```
[LM: claude-sonnet-4] [NAR: 142 concepts] [turn: 47] [mode: auto]
```

Updates in real-time. Shows:
- LM model name or `LM✗` if unavailable
- NAR concept count or `NAR✗` if unavailable
- Current turn number
- Current mode (auto/chat/reason)

### Rich Output Blocks

For HTTP/WS/pipe channels, responses include structured reasoning:

```markdown
**Response:** Birds migrate south for warmer climates during winter.

<details>
<summary>Reasoning (3 derivations)</summary>

1. `(<bird --> animal>. :1.0:0.9)` — from belief
2. `(<animal --> living_thing>. :0.9:0.8)` — from derivation
3. `(<bird --> living_thing>. :0.9:0.7)` — transitive inference
</details>
```

### TUI REPL Implementation

```typescript
class REPL {
    private rl: readline.Interface;
    private history: string[] = [];
    private ctx: BotContext;
    private pipeline: MessagePipeline;

    async start(): Promise<void> {
        this.printBanner();
        this.printCapabilities();
        this.printPrompt();

        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        this.rl.setPrompt('> ');

        for await (const line of this.rl) {
            await this.processLine(line);
        }
    }

    private printBanner(): void {
        console.log(`\n  ${this.ctx.profile.name} — ${this.ctx.profile.personality}\n`);
    }

    private printCapabilities(): void {
        const caps = this.ctx.capabilities;
        console.log(`  Mode: ${caps.mode}`);
        console.log(`  LM: ${caps.hasLM ? '✓' : '✗'}  SeNARS: ${caps.hasSeNARS ? '✓' : '✗'}  Streaming: ${caps.hasStreaming ? '✓' : '✗'}`);
        console.log(`  Type /help for commands, or just talk.\n`);
    }

    private printPrompt(): void {
        if (this.ctx.capabilities.mode === 'senars-only') {
            console.log('  Narsese mode: use (<term --> rel>.) for beliefs, (<term --> ?>) for questions');
            console.log('  Or use /run, /beliefs, /concepts, /help\n');
        }
    }

    private async processLine(line: string): Promise<void> {
        const trimmed = line.trim();
        if (!trimmed) return;

        this.history.push(trimmed);
        console.log(cyan(`> ${trimmed}`));

        if (this.ctx.capabilities.hasLM && this.ctx.config.tui.typingIndicator) {
            const spinner = ora('thinking...').start();
            try {
                const response = await this.pipeline.process(
                    { text: trimmed, sender: 'user', source: 'cli' },
                    this.ctx,
                );
                spinner.stop();
                this.displayResponse(response);
            } catch (error) {
                spinner.stop();
                console.log(red(`  ✗ ${error.message}`));
            }
        } else {
            try {
                const response = await this.pipeline.process(
                    { text: trimmed, sender: 'user', source: 'cli' },
                    this.ctx,
                );
                this.displayResponse(response);
            } catch (error) {
                console.log(red(`  ✗ ${error.message}`));
            }
        }

        this.updateStatusBar();
    }

    private displayResponse(response: BotResponse): void {
        if (this.ctx.config.tui.showReasoningSteps && response.reasoning?.steps) {
            for (const belief of response.reasoning.beliefs.slice(-3)) {
                console.log(dim(`  → ${belief.term} :${belief.truth?.frequency}:${belief.truth?.confidence}`));
            }
        }

        if (this.ctx.config.tui.showToolCalls && response.actions.length > 0) {
            for (const action of response.actions) {
                if (action.type === 'tool_call') {
                    console.log(cyan(`  ⚙ ${action.content} = ${action.result}`));
                }
            }
        }

        console.log(white(`  bot: ${response.text}\n`));
    }
}
```

---

## Unified Conversation Context

Replaces `ConversationManager` + `ChatResponder.conversationHistory` + `LastResults` with single source of truth.

### Per-Sender Conversation State

```typescript
class ConversationState {
    private messages: Message[] = [];
    private summary?: string;
    private workingMemory = new Map<string, unknown>();
    private reasoningArtifacts: ReasoningArtifact[] = [];
    private pinnedBeliefs = new Set<string>();
    mode: BotMode = 'auto';

    constructor(private readonly config: BotConfig) {}

    addMessage(msg: Message, lm?: LMClient): void {
        this.messages.push(msg);
        if (lm) this.maybeSummarize(lm);
    }

    getHistory(limit?: number): Message[] {
        return limit ? this.messages.slice(-limit) : [...this.messages];
    }

    getContextForLM(maxConcepts: number, nar: NAR): string {
        const parts: string[] = [];
        if (this.summary) parts.push(`Conversation summary: ${this.summary}`);

        const concepts = nar.attentionReport(maxConcepts);
        if (concepts.length > 0) {
            parts.push('Knowledge context:');
            for (const c of concepts) parts.push(`  - ${c.term} (priority: ${c.priority})`);
        }

        const recent = this.getRecentArtifacts(5);
        if (recent.length > 0) {
            parts.push('Recent reasoning:');
            for (const a of recent) parts.push(`  - ${a.content}`);
        }

        if (this.pinnedBeliefs.size > 0) {
            parts.push('Pinned context:');
            for (const b of this.pinnedBeliefs) parts.push(`  - ${b}`);
        }

        return parts.join('\n');
    }

    private async maybeSummarize(lm: LMClient): Promise<void> {
        if (this.messages.length <= this.config.conversation.summaryThreshold) return;
        const toSummarize = this.messages.slice(0, -10);
        const prompt = `Summarize the following conversation in 2-3 sentences:\n\n${
            toSummarize.map(m => `${m.role}: ${m.content}`).join('\n')
        }`;
        this.summary = await lm.generate([{ role: 'user', content: prompt }]);
        this.messages = this.messages.slice(-10);
    }

    set(key: string, value: unknown): void { this.workingMemory.set(key, value); }
    get<T>(key: string): T | undefined { return this.workingMemory.get(key) as T; }

    addArtifact(artifact: ReasoningArtifact): void {
        this.reasoningArtifacts.push(artifact);
        const max = this.config.conversation.maxArtifacts;
        if (this.reasoningArtifacts.length > max) {
            this.reasoningArtifacts = this.reasoningArtifacts.slice(-Math.floor(max / 2));
        }
    }

    getRecentArtifacts(limit = 5): ReasoningArtifact[] {
        return this.reasoningArtifacts.slice(-limit);
    }

    pin(belief: string): void { this.pinnedBeliefs.add(belief); }
    unpin(belief: string): void { this.pinnedBeliefs.delete(belief); }
    getPinned(): string[] { return [...this.pinnedBeliefs]; }
}

interface ReasoningArtifact {
    type: 'derivation' | 'tool_result' | 'belief_added' | 'question_answered';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}
```

**Key fix**: `ConversationState` now stores `config` in its constructor, so `addArtifact` and `maybeSummarize` can access configuration without needing a `ctx` parameter. `maybeSummarize` uses `lm.generate()` with a summarization prompt instead of a non-existent `lm.summarize()`.

### Conversation State Manager

Manages per-sender conversation states:

```typescript
class ConversationStateManager {
    private states = new Map<string, ConversationState>();

    constructor(private readonly config: BotConfig) {}

    getOrCreate(sender: string): ConversationState {
        if (!this.states.has(sender)) {
            this.states.set(sender, new ConversationState(this.config));
        }
        return this.states.get(sender)!;
    }

    get(sender: string): ConversationState | undefined { return this.states.get(sender); }
    remove(sender: string): void { this.states.delete(sender); }
    getAll(): ReadonlyMap<string, ConversationState> { return this.states; }

    serialize(): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [sender, state] of this.states) {
            result[sender] = {
                messages: state.getHistory(),
                summary: (state as any).summary,
                pinnedBeliefs: state.getPinned(),
                mode: state.mode,
            };
        }
        return result;
    }
}
```

---

## AgenticLoop Redesign

Current loop unconditionally runs NAR steps. Redesigned loop adapts to capabilities and uses the pipeline.

```typescript
interface AgenticLoopConfig {
    maxInputTurns: number;
    maxWakeTurns: number;
    sleepIntervalMs: number;
    wakeupIntervalMs: number;
    reasoningStepsPerWake: number;
    backgroundReasoning: boolean;
    backgroundIntervalMs: number;
}

class AgenticLoop {
    private pipeline: MessagePipeline;
    private episodicMemory: EpisodicMemory;
    private config: AgenticLoopConfig;
    private queue: MessageQueue;
    private running = false;
    private handler: (msg: IOMessage) => Promise<void> = async () => {};
    private seNARS?: NAR;  // Direct NAR reference for background reasoning

    constructor(pipeline: MessagePipeline, episodicMemory: EpisodicMemory, seNARS: NAR | undefined, config?: AgenticLoopConfig) {
        this.pipeline = pipeline;
        this.episodicMemory = episodicMemory;
        this.seNARS = seNARS;
        this.config = { ...DEFAULT_LOOP_CONFIG, ...config };
        this.queue = new MessageQueue();
    }

    pushMessage(message: IOMessage): void { this.queue.push(message); }
    setMessageHandler(handler: (msg: IOMessage) => Promise<void>): void { this.handler = handler; }

    async runLoop(): Promise<void> {
        while (this.running) {
            const messages = this.queue.drain();

            if (messages.length > 0) {
                for (const msg of messages) {
                    this.episodicMemory.log({ type: 'input', message: msg });
                    await this.handler(msg);
                }
            } else {
                await this.wakeupSequence();
            }

            await sleep(this.config.sleepIntervalMs);
        }
    }

    async wakeupSequence(): Promise<void> {
        const hasSeNARS = !!this.seNARS;
        const hasMemory = hasSeNARS && !!this.seNARS!.memory;

        if (hasSeNARS && this.config.backgroundReasoning) {
            await this.backgroundReasoning();
        }

        if (hasSeNARS && this.seNARS!.lm) {
            await this.seNARS!.enrichMemoryWithLM();
        }

        if (hasMemory) {
            await this.seNARS!.memory.consolidate();
        }

        await this.episodicCheck();

        this.episodicMemory.log({ type: 'wakeup', capabilities: { hasSeNARS, hasMemory } });
    }

    private async backgroundReasoning(): Promise<void> {
        const nar = this.seNARS!;
        const steps = this.config.reasoningStepsPerWake;

        // Priority 1: Answer unanswered questions
        const unanswered = nar.queryAPI.getUnansweredQuestions();
        for (const q of unanswered.slice(0, 3)) {
            await nar.run(steps);
        }

        // Priority 2: Pursue active goals
        const activeGoals = nar.queryAPI.getGoals({ achieved: false });
        for (const g of activeGoals.slice(0, 2)) {
            await nar.run(steps);
        }

        // Priority 3: Consolidate low-confidence beliefs
        const lowConf = nar.getBeliefs().filter(b => b.truth && b.truth.confidence < 0.5);
        if (lowConf.length > 5) {
            await nar.run(steps * 2);
        }

        // Priority 4: Reason about recent user topics
        const recentTopics = this.extractRecentTopics();
        for (const topic of recentTopics.slice(0, 2)) {
            await nar.question(`(<${topic} --> ?>)`);
            await nar.run(steps);
        }
    }

    private extractRecentTopics(): string[] {
        // Extract topics from recent episodic memory
        // Implementation depends on EpisodicMemory API
        return [];
    }
}
```

**Key fix**: `AgenticLoop` now stores `seNARS` directly as a constructor parameter (instead of referencing non-existent `this.ctx`). `wakeupSequence` checks capabilities locally instead of calling a non-existent `detectCapabilities()` method.

### Background Reasoning Prompts

| Prompt Type | Trigger | Narsese Input | Action |
|---|---|---|---|
| **Unanswered questions** | Questions in memory with no derivation | Re-submit as `(<term --> ?>)` | Run reasoning steps |
| **Goal pursuit** | Active goals not achieved | `!(<subgoal ==> goal>.)` | Run goal-directed reasoning |
| **Belief consolidation** | Many low-confidence beliefs | No input needed | Run broader derivation |
| **Pattern detection** | Episodic memory shows repeated topics | `(<topic --> discussed_frequently>. :f:c)` | Analyze and summarize |
| **Knowledge gaps** | User asked things bot couldn't answer | `(<unknown_term --> ?>)` | Revisit with fresh reasoning |
| **Contradiction resolution** | Conflicting beliefs detected | No input needed | Run higher-order reasoning |

---

## Degradation Behavior

Framework gracefully degrades based on available capabilities.

### Startup Degradation Matrix

| LM | SeNARS | Mode | Behavior |
|---|---|---|---|
| ✓ | ✓ | `full` | Full agent with reasoning + conversation + streaming |
| ✓ | ✗ | `lm-only` | LM chatbot with commands and tools (no NAL reasoning) |
| ✗ | ✓ | `senars-only` | SeNARS REPL — accepts Narsese, shows derivations |
| ✗ | ✗ | — | Error: at least one capability required |

### Runtime Degradation

```typescript
class DegradationManager {
    private lmAvailable = true;
    private listeners: Array<(message: string) => void> = [];

    checkLMHealth(): void {
        const wasAvailable = this.lmAvailable;
        this.lmAvailable = this.testLMConnectivity();

        if (wasAvailable && !this.lmAvailable) {
            this.notify('LM unavailable — switched to reasoning mode. Commands and Narsese input still work.');
        } else if (!wasAvailable && this.lmAvailable) {
            this.notify('LM restored — full mode active.');
        }
    }

    reconfigurePipeline(pipeline: MessagePipeline): void {
        // Pipeline stages self-check via enabled() predicates
        // No explicit reconfiguration needed — next process() call uses current state
    }

    private notify(message: string): void {
        for (const listener of this.listeners) listener(message);
    }
}
```

Degradation notifications are sent to all connected channels:

```
[SYSTEM] LM unavailable — switched to reasoning mode. Commands and Narsese input still work.
[SYSTEM] LM restored — full mode active.
```

**Key fix**: `DegradationManager` no longer tries to reassign `stage.enabled` (which would replace a function with a boolean). Instead, stages check `ctx.capabilities` at runtime, so degradation is automatic on the next `process()` call.

---

## MCP Integration

MCP server shares the same NAR instance and pipeline. In the new architecture:

```typescript
const mcpServer = new SeNARSMCPServer({
    name: 'senars-bot',
    version: '1.0.0',
    transport: process.env.SENARS_MCP_TRANSPORT || 'stdio',
});

const adapter = mcpServer.getAdapter();
registerNARToolsAsMCP(nar, adapter);
registerMCPPrompts(adapter, pipeline);
registerMCPResources(adapter, nar);
registerScenarioAPIs(scenarioRunner);
registerExperimentAPIs(experimentRunner);
registerSelfAnalysisAPIs(selfAnalyzer);
registerRegressionAPIs(regressionTracker);
```

MCP clients send messages through the same `MessagePipeline`, receiving streaming responses when supported.

---

## Connection Management

Replaces ad-hoc `ChannelContext` construction with typed connection abstraction.

```typescript
interface BotConnection {
    id: string;
    type: ChannelType;
    state: 'connected' | 'disconnected' | 'error';
    send(target: string, text: string): Promise<void>;
    stream(target: string, chunks: AsyncIterable<StreamChunk>): Promise<void>;
    onMessage(handler: (msg: IOMessage) => void): void;
    onStateChange(handler: (state: ConnectionState) => void): void;
}

class ConnectionManager {
    private connections = new Map<string, BotConnection>();

    add(config: ConnectionConfig): Promise<BotConnection>;
    remove(id: string): Promise<void>;
    get(id: string): BotConnection | undefined;
    getAll(): ReadonlyMap<string, BotConnection>;
    broadcast(text: string, exclude?: string[]): Promise<void>;
    streamBroadcast(chunks: AsyncIterable<StreamChunk>, exclude?: string[]): Promise<void>;
}
```

Each connection type (IRC, WS, HTTP, CLI, pipe, MCP) implements `BotConnection`. The pipeline receives `ConnectionInfo` derived from the active connection.

---

## Error Handling Strategy

### Pipeline Error Handling

```typescript
class MessagePipeline {
    async process(message: IOMessage, ctx: BotContext): Promise<BotResponse> {
        try {
            for (const stage of this.stages) {
                if (!stage.enabled(ctx)) continue;
                await stage.execute(ctx);
                if (ctx.turn.finalResponse && stage.name === 'CommandProcessor') break;
            }
        } catch (error) {
            ctx.turn.error = error as Error;
            ctx.turn.finalResponse = this.generateErrorResponse(error, ctx);
        }
        return this.composeResponse(ctx);
    }

    private generateErrorResponse(error: unknown, ctx: BotContext): string {
        if (error instanceof LMUnavailableError) {
            return 'LM is currently unavailable. I can still process Narsese input and commands.';
        }
        if (error instanceof SeNARSUnavailableError) {
            return 'Reasoning engine is unavailable. Chat mode is still active.';
        }
        if (error instanceof CommandNotFoundError) {
            return `Unknown command. Type /help for available commands.`;
        }
        return `An error occurred: ${error instanceof Error ? error.message : 'unknown error'}`;
    }
}
```

### Error Types

```typescript
class BotError extends Error {
    constructor(message: string, public readonly recoverable: boolean) {
        super(message);
        this.name = 'BotError';
    }
}

class LMUnavailableError extends BotError {
    constructor() { super('LM unavailable', true); this.name = 'LMUnavailableError'; }
}

class SeNARSUnavailableError extends BotError {
    constructor() { super('SeNARS unavailable', true); this.name = 'SeNARSUnavailableError'; }
}

class CommandNotFoundError extends BotError {
    constructor(cmd: string) { super(`Command not found: ${cmd}`, false); this.name = 'CommandNotFoundError'; }
}

class PipelineError extends BotError {
    constructor(stage: string, cause: Error) {
        super(`Pipeline error in ${stage}: ${cause.message}`, true);
        this.name = 'PipelineError';
        this.cause = cause;
    }
}
```

---

## Configuration System

### Bot Configuration File

```jsonc
// bot.config.jsonc
{
  "profile": {
    "name": "SeNARS",
    "personality": "A reasoning-focused AI assistant."
  },
  "capabilities": {
    "lm": {
      "enabled": true,
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "fallback": ["ollama/llama3.1:8b", "transformersjs/Qwen2.5-1.5B"]
    },
    "senars": {
      "enabled": true,
      "memoryFile": ".cache/nar-memory.json",
      "maxConcepts": 10000
    }
  },
  "reasoning": {
    "autoTrigger": true,
    "triggerThreshold": 0.5,
    "triggerCooldown": 3,
    "maxStepsPerTrigger": 5,
    "backgroundReasoning": true,
    "backgroundIntervalMs": 60000
  },
  "streaming": {
    "enabled": true,
    "showReasoningSteps": true,
    "showToolCalls": true
  },
  "conversation": {
    "maxHistory": 20,
    "summaryThreshold": 30,
    "maxArtifacts": 50
  },
  "tui": {
    "typingIndicator": true,
    "colors": true,
    "compactMode": false,
    "statusBar": true
  },
  "connections": {
    "cli": { "enabled": true },
    "irc": {
      "enabled": false,
      "server": "irc.libera.chat",
      "nick": "senars-bot",
      "channels": ["#senars"]
    },
    "websocket": { "enabled": false, "port": 8080 },
    "http": { "enabled": false, "port": 8081 },
    "mcp": { "enabled": false, "transport": "stdio" }
  }
}
```

### Environment Variable Overrides

All config values can be overridden by environment variables:

```
SENARS_LM_ENABLED=true
SENARS_LM_MODEL=claude-sonnet-4-20250514
SENARS_SENARS_ENABLED=true
SENARS_REASONING_AUTO_TRIGGER=true
SENARS_STREAMING_ENABLED=true
SENARS_TUI_COLORS=true
```

---

## Bot Class

The `Bot` class replaces `Agent` as the top-level orchestrator. It wires the pipeline, connections, and context.

```typescript
interface BotDeps {
    profile: BotProfile;
    lm?: LMClient;
    nar?: NAR;
    pipeline: MessagePipeline;
    stateManager: ConversationStateManager;
    config: BotConfig;
    capabilities: Capabilities;
    connectionManager: ConnectionManager;
    degradationManager?: DegradationManager;
}

class Bot {
    readonly profile: BotProfile;
    readonly pipeline: MessagePipeline;
    readonly stateManager: ConversationStateManager;
    readonly config: BotConfig;
    readonly capabilities: Capabilities;
    private readonly lm?: LMClient;
    private readonly nar?: NAR;
    private readonly connectionManager: ConnectionManager;
    private readonly degradationManager?: DegradationManager;

    constructor(deps: BotDeps) {
        this.profile = deps.profile;
        this.lm = deps.lm;
        this.nar = deps.nar;
        this.pipeline = deps.pipeline;
        this.stateManager = deps.stateManager;
        this.config = deps.config;
        this.capabilities = deps.capabilities;
        this.connectionManager = deps.connectionManager;
        this.degradationManager = deps.degradationManager;
    }

    getConnectionInfo(msg: IOMessage): ConnectionInfo {
        const conn = this.connectionManager.get(msg.source);
        return {
            id: msg.source,
            type: conn?.type ?? 'cli',
            sender: msg.sender,
            respond: async (text) => {
                const content = typeof text === 'string' ? text : text.content;
                await this.connectionManager.get(msg.source)?.send(msg.sender, content);
            },
            stream: async (stream) => {
                const c = this.connectionManager.get(msg.source);
                if (c?.stream) await c.stream(msg.sender, stream);
                else {
                    // Fallback: buffer and send
                    let buf = '';
                    for await (const chunk of stream) buf += chunk.content;
                    await c?.send(msg.sender, buf);
                }
            },
        };
    }

    createContext(connInfo: ConnectionInfo, conversation: ConversationState): BotContext {
        return {
            profile: this.profile,
            lm: this.lm,
            seNARS: this.nar,
            connection: connInfo,
            conversation,
            turn: {
                input: {} as IOMessage,  // Set by pipeline.process()
                classification: { primary: 'chat', confidence: 0.1, signals: [] },
                reasoningTriggered: false,
                lmSuggestsReasoning: false,
                toolResults: [],
                actions: [],
                finalResponse: '',
            },
            config: this.config,
            capabilities: this.capabilities,
        };
    }

    async processMessage(msg: IOMessage, connInfo: ConnectionInfo, conversation: ConversationState): Promise<BotResponse> {
        const ctx = this.createContext(connInfo, conversation);
        const response = await this.pipeline.process(msg, ctx);

        // Add messages to conversation state
        conversation.addMessage({ role: 'user', content: msg.text, timestamp: Date.now() }, this.lm);
        conversation.addMessage({
            role: 'assistant',
            content: response.text,
            timestamp: Date.now(),
            metadata: ctx.turn.lmSuggestsReasoning ? { suggestsReasoning: true } : undefined,
        }, this.lm);

        // Record reasoning artifacts
        if (ctx.turn.reasoningResult) {
            conversation.addArtifact({
                type: 'derivation',
                content: `Derived ${ctx.turn.reasoningResult.steps} belief(s)`,
                timestamp: Date.now(),
            });
        }

        return response;
    }

    async startConnections(connections: Record<string, ConnectionConfig>): Promise<void> {
        for (const [id, config] of Object.entries(connections)) {
            try {
                await this.connectionManager.add(config);
            } catch (error) {
                console.error(`Failed to connect ${id}: ${error}`);
            }
        }
    }
}
```

---

## Bot Entry Point

### Wiring: `bot.ts`

```typescript
async function main() {
    // 1. Load configuration
    const config = await loadConfig();

    // 2. Create capabilities
    const lm = config.capabilities.lm.enabled ? await createLMClient(config.capabilities.lm) : undefined;
    const nar = config.capabilities.senars.enabled ? SeNARSFactory.createDefault(config.capabilities.senars) : undefined;
    const capabilities = detectCapabilities(lm, nar);

    // 3. Create unified context
    const profile = new BotProfile(config.profile);
    const stateManager = new ConversationStateManager(config);
    const connectionManager = new ConnectionManager();
    const pipeline = createPipeline(config, nar, lm);

    // 4. Create Bot (replaces Agent)
    const bot = new Bot({ profile, lm, nar, pipeline, stateManager, config, capabilities, connectionManager });

    // 5. Create AgenticLoop
    const episodicMemory = new EpisodicMemory();
    const loop = new AgenticLoop(pipeline, episodicMemory, nar, config.agenticLoop);

    // 6. Wire message handler
    loop.setMessageHandler(async (msg: IOMessage) => {
        const connInfo = bot.getConnectionInfo(msg);
        const conversation = stateManager.getOrCreate(msg.sender);
        const response = await bot.processMessage(msg, connInfo, conversation);
        if (response.text) await connInfo.respond(response.text);
    });

    // 7. Start loop and connections
    loop.start();
    await bot.startConnections(config.connections);
}

function createPipeline(config: BotConfig, nar?: NAR, lm?: LMClient): MessagePipeline {
    const capabilities = detectCapabilities(lm, nar);
    const trigger = new ReasoningTrigger(defaultTriggerConfig);
    return new MessagePipeline([
        new InputNormalizer(),
        new AuthChecker(),
        new CommandProcessor(new CommandRegistry()),
        new InputClassifier(),
        new ReasoningTriggerStage(trigger),
        new SeNARSProcessor(),
        new LMResponder(),
        new ToolExecutor(),
        new ResponseComposer(),
        new ResponseFormatter(),
        new StatePersistor(),
    ]);
}
```

---

## File Structure (Proposed)

```
src/bot/
├── Bot.ts                   # Main bot class — wires pipeline, connections, loop
├── BotContext.ts            # Unified context, capabilities, config
├── ConversationState.ts     # Per-sender conversation state
├── ConversationManager.ts   # Manages per-sender states
├── DegradationManager.ts    # Runtime capability degradation
├── pipeline/
│   ├── Pipeline.ts          # Message pipeline orchestrator
│   ├── stages/
│   │   ├── InputNormalizer.ts
│   │   ├── AuthChecker.ts
│   │   ├── CommandProcessor.ts
│   │   ├── InputClassifier.ts
│   │   ├── ReasoningTrigger.ts
│   │   ├── SeNARSProcessor.ts
│   │   ├── LMResponder.ts
│   │   ├── ToolExecutor.ts
│   │   ├── ResponseComposer.ts
│   │   ├── ResponseFormatter.ts
│   │   └── StatePersistor.ts
│   └── index.ts
├── commands/
│   ├── registry.ts          # Command registry with / prefix
│   ├── core.ts              # /help, /status, /quit, /commands
│   ├── mode.ts              # /mode chat|reason|auto
│   ├── memory.ts            # Memory commands
│   ├── reasoning.ts         # Reasoning commands
│   ├── tools.ts             # Tool commands
│   ├── lm.ts                # LM commands
│   ├── self.ts              # Self-analysis commands
│   ├── config.ts            # Config commands
│   ├── episodes.ts          # Episodic memory commands
│   ├── scenarios.ts         # Benchmark commands
│   └── experiments.ts       # Experiment commands
├── streaming/
│   ├── types.ts             # StreamChunk, NDJSON types
│   ├── LMStreamAdapter.ts   # LM → AsyncIterable adapter
│   └── ChannelStreamer.ts   # Per-channel streaming logic
├── tui/
│   ├── REPL.ts              # Interactive terminal interface
│   ├── StatusBar.ts         # Persistent status bar
│   ├── OutputRenderer.ts    # Rich output rendering
│   └── indicators.ts        # Typing/reasoning indicators
├── AgenticLoop.ts           # Redesigned autonomous loop
├── errors.ts                # BotError hierarchy
├── config.ts                # Configuration loading/validation
└── index.ts                 # Public API barrel
```

### Backward Compatibility Layer

During migration, old `Agent` class wraps the new pipeline:

```typescript
// src/agent/Agent.ts — compatibility wrapper
class Agent {
    private pipeline: MessagePipeline;

    async processMessage(text: string, ctx: ChannelContext): Promise<ChannelResponse> {
        const botCtx = this.adaptChannelContext(ctx);
        const response = await this.pipeline.process(
            { text, sender: ctx.sender, source: ctx.connectionId },
            botCtx,
        );
        return {
            text: response.text,
            type: this.classifyResponseType(response),
            actions: response.actions.map(a => a.content),
        };
    }
}
```

---

## Testing Strategy

### Unit Tests (per stage)

Each pipeline stage is independently testable:

```typescript
describe('InputClassifier', () => {
    it('classifies slash prefix as command', () => {
        const result = classify('/help', createEmptyContext());
        assert.equal(result.primary, 'command');
    });

    it('classifies Narsese syntax as narsese', () => {
        const result = classify('(<bird --> animal>.)', createEmptyContext());
        assert.equal(result.primary, 'narsese');
    });

    it('classifies terminal ? as query', () => {
        const result = classify('What is a bird?', createEmptyContext());
        assert.equal(result.primary, 'query');
    });

    it('detects reasoning keywords', () => {
        const result = classify('Why do birds migrate?', createEmptyContext());
        assert.equal(result.primary, 'reason');
    });

    it('respects mode override', () => {
        const ctx = createEmptyContext();
        ctx.conversation.mode = 'chat';
        const result = classify('Why do birds migrate?', ctx);
        assert.equal(result.primary, 'chat');
    });
});

describe('ReasoningTrigger', () => {
    it('triggers on multi-hop patterns', () => {
        const ctx = createSeNARSContext('If all cats are mammals and Felix is a cat...');
        const trigger = new ReasoningTrigger(defaultConfig);
        const decision = trigger.shouldTrigger(ctx);
        assert.isTrue(decision.activate);
    });

    it('respects cooldown', () => {
        // ...
    });

    it('skips in chat mode', () => {
        // ...
    });
});

describe('ResponseComposer', () => {
    it('merges LM response with reasoning result', () => {
        // ...
    });

    it('falls back when no stages produce output', () => {
        // ...
    });
});
```

### Integration Tests

```typescript
describe('Pipeline — Full Mode', () => {
    it('processes Narsese input and derives', async () => {
        const pipeline = createFullPipeline();
        const ctx = createFullContext();
        const response = await pipeline.process({ text: '(<bird --> animal>.)', sender: 'user', source: 'cli' }, ctx);
        assert.include(response.text, 'Added');
    });

    it('auto-triggers reasoning on causal question', async () => {
        const pipeline = createFullPipeline();
        const ctx = createFullContext();
        const response = await pipeline.process({ text: 'Why do birds fly south?', sender: 'user', source: 'cli' }, ctx);
        assert.isTrue(ctx.turn.reasoningTriggered);
    });
});

describe('Pipeline — LM-only Mode', () => {
    it('responds with LM when SeNARS unavailable', async () => {
        const pipeline = createLMOnlyPipeline();
        const ctx = createLMOnlyContext();
        const response = await pipeline.process({ text: 'Tell me about birds', sender: 'user', source: 'cli' }, ctx);
        assert.isUndefined(ctx.turn.reasoningResult);
        assert.ok(ctx.turn.lmResponse);
    });
});

describe('Pipeline — SeNARS-only Mode', () => {
    it('processes Narsese without LM', async () => {
        const pipeline = createSeNARSOnlyPipeline();
        const ctx = createSeNARSOnlyContext();
        const response = await pipeline.process({ text: '(<bird --> animal>.)', sender: 'user', source: 'cli' }, ctx);
        assert.isUndefined(ctx.turn.lmResponse);
        assert.ok(ctx.turn.reasoningResult);
    });
});
```

### Degradation Tests

```typescript
describe('Degradation', () => {
    it('switches to SeNARS-only when LM fails', async () => {
        // ...
    });

    it('recovers when LM returns', async () => {
        // ...
    });
});
```

---

## Security Considerations

### Rate Limiting

`AuthChecker` stage enforces per-sender rate limits:

```typescript
class RateLimiter {
    private windows = new Map<string, number[]>();

    isAllowed(sender: string, maxPerMinute = 30): boolean {
        const now = Date.now();
        const window = this.windows.get(sender) ?? [];
        const recent = window.filter(t => now - t < 60_000);
        if (recent.length >= maxPerMinute) return false;
        recent.push(now);
        this.windows.set(sender, recent);
        return true;
    }
}
```

### Input Validation

- Narsese input is parsed by the existing Narsese parser (validates syntax before execution)
- Command arguments are validated by each command's handler
- LM responses are sanitized: `[REASONING_SUGGESTED:...]` and `[TOOL:...]` markers are stripped before display
- Tool execution is sandboxed by NAR's `ToolManager`

### Authentication

- IRC: nick-based auth with secret handshake (`SENARS_IRC_AUTH_SECRET`)
- WS/HTTP: token-based auth via `ConnectionConfig.authSecret`
- MCP: stdio transport (inherently trusted)
- CLI: no auth (local access)

---

## Performance Considerations

### Hot Path Optimization

The pipeline's `process()` method is the hot path. Optimizations:

- `enabled()` predicates are checked before `execute()` — disabled stages cost only a boolean check
- `ConversationState.getHistory()` returns a slice copy only when needed (LM responder)
- Reasoning artifacts are capped at `maxArtifacts` with aggressive trimming (keep last 50% when over limit)
- NAR `attentionReport()` and `getBeliefs()` are called only when building LM context, not every turn

### Streaming Overhead

- NDJSON streaming adds minimal overhead (one JSON parse per chunk)
- IRC buffering collects all text chunks before sending (single message, respects 400-char limit via `ResponseFormatter`)
- WS/HTTP/pipe channels forward chunks directly (no buffering)

### Memory Management

- `ConversationState.messages` is pruned via auto-summarization at `summaryThreshold`
- `reasoningArtifacts` is capped at `maxArtifacts`
- `workingMemory` is unbounded but intended for small cross-turn values
- NAR memory is managed by NAR's own consolidation (decay, forgetting)

---

## Migration Plan

### Phase 1: Foundation
- [ ] Create `BotContext`, `ConversationState`, `Capabilities`, `BotConfig` types
- [ ] Implement `MessagePipeline` with sequential stage execution (no `next()` callbacks)
- [ ] Implement capability detection at startup
- [ ] Implement `ConversationStateManager` for per-sender state
- [ ] Port `InputNormalizer` and `AuthChecker` stages
- [ ] Create new `CommandProcessor` with `/` prefix and `.aliases` for migration

### Phase 2: Core Processing
- [ ] Implement `InputClassifier` with weighted multi-signal classification
- [ ] Implement `ReasoningTrigger` with hybrid heuristics + LM signals
- [ ] Implement `SeNARSProcessor` stage (believe, question, goal, derive, NL-to-Narsese)
- [ ] Implement `LMResponder` stage with system prompt builder and streaming support
- [ ] Implement `ToolExecutor` stage for tool directive extraction and execution
- [ ] Implement `ResponseComposer` stage (merge SeNARS + LM + tool results with fallback)

### Phase 3: Streaming
- [ ] Implement `StreamChunk` types
- [ ] Implement `LMStreamAdapter` — Vercel AI SDK → AsyncIterable
- [ ] Implement `ChannelStreamer` — per-channel streaming logic with IRC buffering
- [ ] Implement NDJSON streaming protocol for WS/HTTP/pipe
- [ ] Implement streaming error handling and fallback
- [ ] Update `LMResponder` to support streaming mode

### Phase 4: TUI
- [ ] Implement new `REPL` with status bar and visual conventions
- [ ] Add typing indicators and streaming display
- [ ] Add reasoning step display (toggleable via config)
- [ ] Add rich output block rendering
- [ ] Implement `StatusBar` component with real-time updates
- [ ] Add `/mode` command support in TUI

### Phase 5: AgenticLoop
- [ ] Redesign `AgenticLoop` to accept `pipeline` and `seNARS` directly (no `Agent` dependency)
- [ ] Implement capability-aware wakeup sequence
- [ ] Implement background reasoning with priority queue
- [ ] Add cooldown and sensitivity configuration
- [ ] Implement episodic pattern detection

### Phase 6: Configuration & Degradation
- [ ] Implement `bot.config.jsonc` loading with validation
- [ ] Implement environment variable overrides
- [ ] Implement `DegradationManager` with runtime health checks
- [ ] Add degradation notifications to all channels
- [ ] Implement graceful LM/SeNARS failure recovery

### Phase 7: MCP Integration
- [ ] Update MCP server to use new pipeline
- [ ] Register MCP prompts that pipeline messages
- [ ] Update MCP resources to use `ConversationState`
- [ ] Test MCP streaming support

### Phase 8: Migration & Cleanup
- [ ] Add `.alias` support on all commands (`.help` → `/help`)
- [ ] Create `Agent` compatibility wrapper
- [ ] Update `bot.ts` entry point to use new `Bot` class
- [ ] Update all tests for new architecture
- [ ] Deprecate old `Agent.processMessage()` path
- [ ] Remove deprecated code after stabilization

---

## Interaction Examples

### Full Mode (LM + SeNARS)

```
> Why do birds fly south?

  ⏳ thinking...
  → analyzing: bird, migration, season
  → derived: 3 beliefs

  bot: Birds migrate south primarily for food availability and temperature.
       During winter, their northern habitats lack sufficient food sources.

  [reasoning: 3 derivations] [/reason to see details]
```

### LM-only Mode

```
> Why do birds fly south?

  bot: Birds migrate south for several reasons:
  1. Food availability decreases in northern regions during winter
  2. Warmer climates reduce energy expenditure for thermoregulation
  3. Daylight hours affect breeding cycles

  Note: I don't have a formal reasoning engine loaded, so this is based
  on my training knowledge rather than derived facts.
```

### SeNARS-only Mode

```
> (<bird --> animal>.)

  → Added: (<bird --> animal>. :1.0:0.9)
  → 0 derivations

> (<robin --> bird>.)

  → Added: (<robin --> bird>. :1.0:0.9)
  → 0 derivations

> /run 3

  → Derived: (<robin --> animal>. :1.0:0.81) — transitive
  → Derived: (<animal --> ?>. :1.0:0.9) — generalization
  → 2 new beliefs derived

> (<robin --> ?>)

  → robin is a: animal (1.0:0.81), bird (1.0:0.9)
```

### Auto-Reasoning Triggered

```
> If all mammals are warm-blooded and whales are mammals, are whales warm-blooded?

  [auto-reasoning triggered: multi-hop pattern detected]
  → analyzing: mammal, warm-blooded, whale
  → derived: (<whale --> warm_blooded>. :0.9:0.72)

  bot: Yes — whales are warm-blooded. This follows from the syllogism:
  all mammals are warm-blooded, whales are mammals, therefore whales
  are warm-blooded.

  [reasoning: 1 derivation] [/reason to see details]
```

### Mode Override

```
> /mode reason

  Mode set to: reason (SeNARS reasoning prioritized)

> Birds are animals

  → Added: (<bird --> animal>. :1.0:0.9)
  → 0 derivations

> /mode chat

  Mode set to: chat (natural language conversation)

> Tell me about birds

  bot: Birds are a class of animals characterized by feathers, beaks,
       and egg-laying. There are about 10,000 known species...
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Sequential pipeline (no `next()` callbacks) | Simpler, avoids callback nesting bugs, easier to reason about |
| `CommandProcessor` breaks loop via `finalResponse` check | Clean early-exit without special control flow |
| Optional capabilities | Framework works with LM-only, SeNARS-only, or both |
| `/` prefix | Standard across chat platforms, no punctuation conflicts |
| Hybrid auto-triggering | Heuristics catch obvious cases, LM catches subtle ones |
| Unified context | Single source of truth, no state fragmentation |
| Streaming first-class | Enables real-time feedback, reasoning visibility |
| Modeless by default | Context-aware, no manual mode switching required |
| `/mode` override | Users can force behavior when auto-detection is wrong |
| Auto-summarization via `generate()` | No dedicated `summarize()` method needed — keeps `LMClient` minimal |
| `ConversationState` stores `config` | Avoids passing `ctx` through every method |
| `AgenticLoop` stores `seNARS` directly | No dependency on `Agent` or non-existent `ctx` |
| Degradation via runtime `enabled()` checks | No need to reassign stage functions — next call uses current capabilities |
| Capability matrix at startup | Clear feedback about what's available |
| Per-sender conversation state | Multi-user support without state leakage |
| Error type hierarchy | Specific errors enable targeted recovery |
| Config file + env overrides | Flexible deployment across environments |
| Compatibility wrapper | Gradual migration without breaking existing code |
