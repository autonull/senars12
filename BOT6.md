# BOT6.md — Unified Bot Architecture

## Vision

A single `Bot` class with an event-emitting pipeline supporting bidirectional NAR↔LM interaction via bounded loop-back. All entry points (REPL, IRC, WS, HTTP, MCP) share one processing path. Graceful degradation across full / LM-only / SeNARS-only modes. Open-ended experimentation via pluggable stages, directives, classifiers, and event subscriptions.

No dead code. No duplicate state. No god class. No ceremony over substance.

---

## Architecture Principles

1. **Pipeline, not switch** — Composable stages replace hardcoded branching
2. **SeNARS first, LM second** — LM always sees what SeNARS derived
3. **Loop-back** — LM directives feed back into SeNARS, bounded by `maxLoops`
4. **Unified state** — One `ConversationState` per sender
5. **Streaming default** — Token-by-token for channels that support it
6. **Self-degrading** — `enabled()` predicates skip unavailable stages
7. **DRY context** — `LMResponder` uses `ConversationState.getContextForLM()`
8. **Event-driven observability** — Every stage emits typed events; external listeners enable real-time TUI, metrics, debugging, and experimentation without modifying pipeline code
9. **Pluggable everything** — NL parsers, classifiers, directives, stages are all replaceable via config

---

## Pipeline

```
InputNormalizer → AuthChecker → CommandProcessor* → InputClassifier
  → ReasoningTrigger → SeNARSProcessor → LMResponder
  → DirectiveProcessor ↻ (loop: SeNARSProcessor → LMResponder → DirectiveProcessor)
  → ResponseComposer → ResponseFormatter → StatePersistor

* CommandProcessor: early exit, skips remaining stages
```

| # | Stage | Responsibility |
|---|---|---|
| 1 | `InputNormalizer` | Trim, NFC normalize, strip zero-width chars |
| 2 | `AuthChecker` | Rate limit, auth binding |
| 3 | `CommandProcessor` | Execute `/` or `.` commands, early exit |
| 4 | `InputClassifier` | Multi-signal intent classification (pluggable signals) |
| 5 | `ReasoningTrigger` | Heuristic + LM-signal scoring for SeNARS activation |
| 6 | `SeNARSProcessor` | NAL operations, belief diff tracking |
| 7 | `LMResponder` | Generate response with SeNARS context |
| 8 | `DirectiveProcessor` | Extract + execute `[BELIEVE:]`, `[QUESTION:]`, `[TOOL:]`; request loop-back |
| 9 | `ResponseComposer` | Merge reasoning + LM + directives into response |
| 10 | `ResponseFormatter` | Channel-specific formatting (IRC stripping) |
| 11 | `StatePersistor` | Log turn to episodic memory |

---

## Event Bus

Stages emit events to a typed `PipelineEventEmitter`. External consumers subscribe for observability, TUI updates, metrics collection, or experimentation — without coupling to stage internals.

```
Stage ──emit──▶ Event Bus ──notify──▶ [TUI Listener, Metrics Listener, Experiment Listener, Logger]
```

### Event Types

```typescript
interface PipelineEvents {
    // Lifecycle
    'turn:start': { input: IOMessage; passCount: number };
    'turn:end': { response: BotResponse; durationMs: number };
    'turn:error': { error: Error; stage: string; passCount: number };

    // Stage lifecycle
    'stage:start': { stage: string; passCount: number };
    'stage:end': { stage: string; durationMs: number; passCount: number };
    'stage:error': { stage: string; error: Error; durationMs: number };

    // Classification
    'classify:result': { input: string; classification: InputClassification };

    // Reasoning
    'trigger:score': { heuristicScore: number; lmScore: number; total: number; activated: boolean };
    'reasoning:start': { inputType: string; steps: number };
    'reasoning:end': { steps: number; newBeliefs: Belief[] };

    // LM
    'lm:start': { promptLength: number; streaming: boolean };
    'lm:chunk': { content: string; accumulated: string };
    'lm:end': { response: string; durationMs: number };
    'lm:suggests-reasoning': boolean;

    // Directives
    'directive:found': { directive: LMDirective };
    'directive:execute': { directive: LMDirective; success: boolean; result?: unknown; error?: string };
    'directive:loop-requested': { type: string };

    // Loop
    'loop:pass': { passCount: number; needsLoopBack: boolean };
}
```

### Usage

```typescript
// TUI listener — real-time feedback
bus.on('stage:start', ({ stage }) => tui.showStageIndicator(stage));
bus.on('lm:chunk', ({ content }) => tui.appendStreaming(content));
bus.on('directive:found', ({ directive }) => tui.showDirective(directive));
bus.on('reasoning:end', ({ newBeliefs }) => tui.showDerivations(newBeliefs));

// Metrics listener — performance tracking
bus.on('stage:end', ({ stage, durationMs }) => metrics.record(stage, durationMs));
bus.on('turn:end', ({ durationMs }) => metrics.recordTurn(durationMs));

// Experiment listener — test classifier variants without modifying pipeline
bus.on('classify:result', ({ classification }) => experiment.recordClassification(classification));
bus.on('trigger:score', ({ total, activated }) => experiment.recordTriggerScore(total, activated));
```

---

## Advanced LM↔NAR Communication Patterns

| Pattern | Mechanism | Configurable |
|---|---|---|
| **LM → NAR belief injection** | `[BELIEVE: (<term --> rel>. :f:c)]` | Confidence via truth values |
| **LM → NAR question** | `[QUESTION: (<term --> ?>.)]` | Derivation depth via `nar.run(n)` |
| **LM → tool → NAR** | `[TOOL:name(args)]` → narsese result → `nar.believe()` | Tool-returned narsese auto-believed |
| **LM suggests reasoning** | `[REASONING_SUGGESTED: reason]` | Triggers next-turn reasoning trigger boost |
| **LM controls reasoning depth** | `[REASONING_DEPTH:n]` | Sets `maxStepsPerTrigger` for next pass |
| **Iterative refinement** | Loop-back: SeNARS → LM → SeNARS | `maxLoops`, `loopBackOn` |
| **NAR → LM context** | `getContextForLM()` with attention report, artifacts, pins | `maxConcepts`, artifact count |
| **NAR → LM uncertainty** | `lmSuggestsReasoning` flag + low-confidence beliefs in prompt | Via belief truth values |
| **Graceful degradation** | `enabled()` predicates per stage | Automatic based on capabilities |

### Configuration

```typescript
interface BotConfig {
    reasoning: {
        autoTrigger: boolean;
        triggerThreshold: number;
        triggerCooldown: number;
        maxStepsPerTrigger: number;
        backgroundReasoning: boolean;
        backgroundIntervalMs: number;
        lmDriven: boolean;              // LM can override steps via [REASONING_DEPTH:n]
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
    pipeline: {
        maxLoops: number;               // Default: 2
        stageTimeoutMs: number;         // Default: 30000
        enableLoopBack: boolean;        // Default: true
        loopBackOn: ('believe' | 'question' | 'tool_call')[];  // Default: ['believe', 'question']
        stages?: (PipelineStage | StageFactory)[]; // Custom stage list or factories (overrides defaults)
        preset?: 'default' | 'chat' | 'reasoning' | 'tool';   // Pre-configured stage sets
    };
    directives: {
        builtIn: boolean;               // Default: true (BELIEVE, QUESTION, TOOL, REASONING_DEPTH)
        custom?: DirectiveDef[];        // Custom directive patterns + handlers
    };
    prompts: {
        system?: string;                // Template: {{name}}, {{personality}}, {{context}}, {{directives}}, {{history}}, {{input}}
        directiveInstructions?: string;  // Custom directive instructions in prompt
        responseGuidelines?: string;    // Custom response guidelines
    };
    nlParsers: {
        builtIn: boolean;               // Default: true (regex-based NL→Narsese)
        custom?: NLParserDef[];         // Custom natural language → Narsese translators
    };
    classifier: {
        signals?: ClassificationSignalDef[];  // Override/extend default signals
        modeWeight?: number;            // How much ctx.mode boosts matching intent (default: 0.5)
    };
    tui: {
        typingIndicator: boolean;
        colors: boolean;
        compactMode: boolean;
        statusBar: boolean;
    };
}
```

### Pluggable NL→Narsese

```typescript
interface NLParserDef {
    name: string;
    match: (text: string) => boolean;
    translate: (text: string) => string | null;  // Returns Narsese string or null
}
```

### Custom Directive

```typescript
interface DirectiveDef {
    pattern: RegExp;                    // Regex with capture group for content
    type: string;                       // Directive type name
    extract: (match: RegExpMatchArray) => { name?: string; content: string };
    execute: (nar: NAR, content: string, name?: string) => Promise<unknown>;
    triggersLoopBack: boolean;          // Whether this directive requests another pass
}
```

### Classification Signal

```typescript
interface ClassificationSignalDef {
    type: 'keyword' | 'pattern' | 'structure' | 'narsese';
    pattern: RegExp;
    intent: Intent;
    weight: number;
}
```

---

## Pipeline Presets

| Preset | Stages | Loop-Back | Use Case |
|---|---|---|---|
| `default` | All 11 stages | Enabled on believe/question | Full LM+NAR interaction |
| `chat` | Normalizer → Auth → Command → Classifier → LMResponder → Composer → Formatter → Persistor | Disabled | LM-only conversation |
| `reasoning` | Normalizer → Auth → Command → Classifier → Trigger → SeNARSProcessor → Composer → Formatter → Persistor | Disabled | NAR-only reasoning REPL |
| `tool` | Normalizer → Auth → Command → Classifier → SeNARSProcessor → LMResponder → DirectiveProcessor → Composer → Formatter → Persistor | Enabled on tool_call | Tool-focused workflows |

Presets are applied before custom `stages` — if both are set, `stages` wins.

### Preset Definitions

```typescript
type StageFactory = (bot: Bot) => PipelineStage;

const PRESETS: Record<string, StageFactory[]> = {
    default: [
        () => new InputNormalizer(),
        () => new AuthChecker(),
        (b) => new CommandProcessor(b.commands),
        () => new InputClassifier(),
        () => new ReasoningTriggerStage(),
        () => new SeNARSProcessor(),
        () => new LMResponder(),
        () => new DirectiveProcessor(),
        () => new ResponseComposer(),
        () => new ResponseFormatter(),
        (b) => new StatePersistor(b.episodicMemory),
    ],
    chat: [
        () => new InputNormalizer(),
        () => new AuthChecker(),
        (b) => new CommandProcessor(b.commands),
        () => new InputClassifier(),
        () => new LMResponder(),
        () => new ResponseComposer(),
        () => new ResponseFormatter(),
        (b) => new StatePersistor(b.episodicMemory),
    ],
    reasoning: [
        () => new InputNormalizer(),
        () => new AuthChecker(),
        (b) => new CommandProcessor(b.commands),
        () => new InputClassifier(),
        () => new ReasoningTriggerStage(),
        () => new SeNARSProcessor(),
        () => new ResponseComposer(),
        () => new ResponseFormatter(),
        (b) => new StatePersistor(b.episodicMemory),
    ],
    tool: [
        () => new InputNormalizer(),
        () => new AuthChecker(),
        (b) => new CommandProcessor(b.commands),
        () => new InputClassifier(),
        () => new SeNARSProcessor(),
        () => new LMResponder(),
        () => new DirectiveProcessor(),
        () => new ResponseComposer(),
        () => new ResponseFormatter(),
        (b) => new StatePersistor(b.episodicMemory),
    ],
};
```

### Default Config

```typescript
const DEFAULT_BOT_CONFIG: BotConfig = {
    reasoning: {
        autoTrigger: true, triggerThreshold: 0.5, triggerCooldown: 3,
        maxStepsPerTrigger: 5, backgroundReasoning: true, backgroundIntervalMs: 60000,
        lmDriven: false,
    },
    streaming: { enabled: true, showReasoningSteps: true, showToolCalls: true },
    conversation: { maxHistory: 20, summaryThreshold: 30, maxArtifacts: 50 },
    pipeline: { maxLoops: 2, stageTimeoutMs: 30000, enableLoopBack: true, loopBackOn: ['believe', 'question'] },
    directives: { builtIn: true },
    nlParsers: { builtIn: true },
    classifier: {},
    tui: { typingIndicator: true, colors: true, compactMode: false, statusBar: true },
    prompts: {},
};
```

---

## Types

### TurnState

```typescript
interface TurnState {
    input: IOMessage;               // From io/types.ts (readonly fields)
    classification: InputClassification;
    reasoningTriggered: boolean;
    reasoningResult?: DerivationResult;
    lmResponse?: string;
    lmSuggestsReasoning: boolean;
    directives: LMDirective[];
    directiveResults: DirectiveResult[];
    toolResults: ToolResult[];
    actions: TurnAction[];
    finalResponse: string;
    error?: Error;
    passCount: number;              // 0 = not started, 1 = first pass, 2+ = loop-back
    needsLoopBack: boolean;         // Set by DirectiveProcessor to request another pass
    loopBackType?: string;          // Type of directive that triggered loop-back (for loopBackOn filtering)
    reasoningDepthOverride?: number;// Set by [REASONING_DEPTH:n] directive
}
```

### Supporting Types

```typescript
interface DerivationResult {
    steps: number;                  // NEW beliefs derived this pass
    beliefs: Belief[];              // All beliefs after derivation
    newBeliefs: Belief[];           // Only beliefs added/changed this pass
}

interface Belief {
    term: string;
    truth?: { frequency: number; confidence: number };
}

interface LMDirective {
    type: 'believe' | 'question' | 'tool_call' | 'reasoning_depth' | string;
    name: string;                   // Tool name for tool_call, empty for believe/question
    content: string;                // Narsese string or tool args
    raw: string;                    // Original directive text
    _def?: DirectiveDef;            // Custom directive definition (internal)
}

interface DirectiveResult {
    directive: LMDirective;
    success: boolean;
    result?: unknown;
    error?: string;
    derivationSteps?: number;
}

interface TurnAction {
    type: 'believe' | 'question' | 'goal' | 'tool_call';
    content: string;
    result?: string;
}

interface ToolResult {
    name: string;
    result?: unknown;
    error?: string;
}

interface TurnMetrics {
    startTime: number;
    stages: Map<string, { durationMs: number; error?: string }>;
}
```

### BotContext

```typescript
interface BotContext {
    profile: BotProfile;
    lm?: LMClient;
    seNARS?: NAR;
    connection: ConnectionInfo;
    conversation: ConversationState;
    turn: TurnState;
    config: BotConfig;
    capabilities: Capabilities;
    metrics: TurnMetrics;
    events: PipelineEventEmitter;   // Event bus for observability
}
```

### BotResponse

```typescript
interface BotResponse {
    text: string;
    reasoning?: DerivationResult;
    actions: TurnAction[];
    metrics?: TurnMetrics;
}
```

### Capabilities

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
    const hasLM = !!lm && lm.available !== false;
    const hasSeNARS = !!seNARS;
    const mode = hasLM && hasSeNARS ? 'full'
        : hasLM ? 'lm-only'
        : hasSeNARS ? 'senars-only'
        : (() => { throw new Error('At least one capability required'); })();
    return {
        hasLM, hasSeNARS,
        hasStreaming: hasLM && lm!.provider !== undefined,
        hasTools: hasSeNARS && seNARS!.tools !== undefined && seNARS!.tools.list().length > 0,
        hasMemory: hasSeNARS && !!seNARS!.memory,
        mode,
    };
}
```

### ConnectionInfo

```typescript
interface ConnectionInfo {
    id: string;
    type: ChannelType;
    sender: string;
    respond: (text: string | StreamChunk) => Promise<void>;
    stream: (stream: AsyncIterable<StreamChunk>) => Promise<void>;
}

interface StreamChunk {
    type: 'text' | 'reasoning' | 'tool' | 'error' | 'status';
    content: string;
    done: boolean;
    metadata?: Record<string, unknown>;
}
```

---

### LMStreamAdapter

```typescript
class LMStreamAdapter {
    constructor(private lm: LMClient) {}

    async *stream(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: number }>): AsyncIterable<StreamChunk> {
        if (this.lm.streamText) {
            yield* this.lm.streamText(messages);
        } else {
            const text = await this.lm.generateText(messages.map(m => m.content).join('\n'));
            yield { type: 'text', content: text, done: true };
        }
    }
}
```

### PipelineEventEmitter

```typescript
type EventCallback<T> = (data: T) => void;

class PipelineEventEmitter {
    private listeners = new Map<string, Set<EventCallback<unknown>>>();

    on<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void {
        if (!this.listeners.has(event)) this.listeners.set(event, new Set());
        this.listeners.get(event)!.add(cb as EventCallback<unknown>);
    }

    off<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void {
        this.listeners.get(event)?.delete(cb as EventCallback<unknown>);
    }

    emit<K extends keyof PipelineEvents>(event: K, data: PipelineEvents[K]): void {
        for (const cb of this.listeners.get(event) ?? []) cb(data);
    }

    once<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void {
        const wrapper: EventCallback<unknown> = (data) => { cb(data as PipelineEvents[K]); this.off(event, wrapper); };
        this.on(event, wrapper);
    }
}
```

---

## MessagePipeline

Loop-back is managed internally by the pipeline. Stages don't manage loop state — they just set `needsLoopBack` when appropriate. Every stage execution emits lifecycle events.

```typescript
class MessagePipeline {
    private stages: PipelineStage[];
    private loopStages = new Set(['SeNARSProcessor', 'LMResponder', 'DirectiveProcessor']);

    constructor(stages: PipelineStage[]) {
        this.stages = stages.sort((a, b) => a.priority - b.priority);
    }

    async process(message: IOMessage, ctx: BotContext): Promise<BotResponse> {
        ctx.turn.input = message;
        ctx.turn.passCount = 0;
        ctx.turn.needsLoopBack = false;
        ctx.metrics = { startTime: Date.now(), stages: new Map() };

        const loopBackOn = new Set(ctx.config.pipeline.loopBackOn ?? ['believe', 'question']);
        const enableLoopBack = ctx.config.pipeline.enableLoopBack !== false;

        do {
            ctx.turn.passCount++;
            ctx.turn.needsLoopBack = false;
            ctx.events.emit('turn:start', { input: message, passCount: ctx.turn.passCount });
            if (ctx.turn.passCount > 1) ctx.events.emit('loop:pass', { passCount: ctx.turn.passCount, needsLoopBack: ctx.turn.needsLoopBack });

            for (const stage of this.stages) {
                if (!stage.enabled(ctx)) continue;
                if (ctx.turn.passCount > 1 && !this.loopStages.has(stage.name)) continue;

                ctx.events.emit('stage:start', { stage: stage.name, passCount: ctx.turn.passCount });
                const start = Date.now();
                try {
                    await Promise.race([
                        stage.execute(ctx),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error(`Stage ${stage.name} timed out`)), ctx.config.pipeline.stageTimeoutMs)
                        ),
                    ]);
                    ctx.events.emit('stage:end', { stage: stage.name, durationMs: Date.now() - start, passCount: ctx.turn.passCount });
                } catch (error) {
                    ctx.turn.error = error as Error;
                    ctx.events.emit('stage:error', { stage: stage.name, error: error as Error, durationMs: Date.now() - start });
                    ctx.events.emit('turn:error', { error: error as Error, stage: stage.name, passCount: ctx.turn.passCount });
                    ctx.metrics.stages.set(stage.name, { durationMs: Date.now() - start, error: String(error) });
                    ctx.turn.finalResponse = this.errorResponse(error, ctx);
                    break;
                }
                ctx.metrics.stages.set(stage.name, { durationMs: Date.now() - start });

                if (ctx.turn.finalResponse && stage.name === 'CommandProcessor') return this.composeResponse(ctx);
            }

            if (ctx.turn.error) break;
        } while (enableLoopBack && ctx.turn.needsLoopBack && loopBackOn.has(ctx.turn.loopBackType!) && ctx.turn.passCount < ctx.config.pipeline.maxLoops);

        ctx.events.emit('turn:end', { response: this.composeResponse(ctx), durationMs: Date.now() - ctx.metrics.startTime });
        return this.composeResponse(ctx);
    }

    private composeResponse(ctx: BotContext): BotResponse {
        return { text: ctx.turn.finalResponse, reasoning: ctx.turn.reasoningResult, actions: ctx.turn.actions, metrics: ctx.metrics };
    }

    private errorResponse(error: unknown, ctx: BotContext): string {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes('LM') || (msg.includes('timeout') && ctx.capabilities.hasSeNARS))
            return 'LM is currently unavailable. I can still process Narsese input and commands.';
        if (msg.includes('SeNARS') || msg.includes('NAR'))
            return 'Reasoning engine is unavailable. Chat mode is still active.';
        return `An error occurred: ${msg}`;
    }
}

interface PipelineStage {
    name: string;
    priority: number;
    enabled: (ctx: BotContext) => boolean;
    execute(ctx: BotContext): Promise<void>;
}
```

### Loop Mechanics

```
Pass 1: All stages run. SeNARSProcessor processes input. DirectiveProcessor may set needsLoopBack=true.
Pass 2: Only SeNARSProcessor, LMResponder, DirectiveProcessor run.
        SeNARSProcessor sees passCount=2 → skips input, runs derivations on directive-injected beliefs.
        DirectiveProcessor finds no new directives → needsLoopBack stays false.
        Loop exits.
```

Two state variables manage the entire loop: `passCount` (how many passes executed) and `needsLoopBack` (whether another pass is needed). No `loopCount`, no `inputProcessed`, no counter increment/decrement ceremony.

---

## Stage Specifications

### 1. InputNormalizer

```typescript
class InputNormalizer implements PipelineStage {
    name = 'InputNormalizer'; priority = 1;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        ctx.turn.input = {
            ...ctx.turn.input,
            text: ctx.turn.input.text.trim().normalize('NFC').replace(/[\u200B-\u200D\uFEFF]/g, ''),
        };
    }
}
```

### 2. AuthChecker

```typescript
class AuthChecker implements PipelineStage {
    name = 'AuthChecker'; priority = 2;
    enabled = () => true;
    private rateLimit = new Map<string, number[]>();

    async execute(ctx: BotContext): Promise<void> {
        const key = `${ctx.connection.id}:${ctx.connection.sender}`;
        const now = Date.now();
        const window = (this.rateLimit.get(key) ?? []).filter(t => now - t < 60_000);
        if (window.length >= 30) { ctx.turn.finalResponse = 'Rate limited. Please wait.'; return; }
        window.push(now);
        this.rateLimit.set(key, window);

        if (this.rateLimit.size > 1000) {
            for (const [k, v] of this.rateLimit) {
                if (v.every(t => now - t >= 60_000)) this.rateLimit.delete(k);
            }
        }
    }
}
```

### 3. CommandProcessor

```typescript
class CommandProcessor implements PipelineStage {
    name = 'CommandProcessor'; priority = 3;
    enabled = (ctx) => ctx.turn.input.text.startsWith('/') || ctx.turn.input.text.startsWith('.');

    constructor(private registry: CommandRegistry) {}

    async execute(ctx: BotContext): Promise<void> {
        const text = ctx.turn.input.text.trim();
        const parts = text.slice(1).split(/\s+/);
        const cmdName = text.startsWith('/') ? '/' + parts[0]! : '.' + parts[0]!;
        const args = parts.slice(1);

        const cmd = this.registry.get(cmdName);
        if (!cmd) { ctx.turn.finalResponse = `Unknown command: ${cmdName}. Type /help for available commands.`; return; }
        if (cmd.requiresLM && !ctx.capabilities.hasLM) { ctx.turn.finalResponse = `Command ${cmdName} requires LM (not available).`; return; }
        if (cmd.requiresSeNARS && !ctx.capabilities.hasSeNARS) { ctx.turn.finalResponse = `Command ${cmdName} requires SeNARS (not available).`; return; }

        try {
            const result = await cmd.handler(args, ctx);
            ctx.turn.finalResponse = typeof result === 'string' ? result : await this.streamToString(result);
        } catch (error) {
            ctx.turn.finalResponse = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    private async streamToString(stream: AsyncIterable<{ content: string }>): Promise<string> {
        let r = ''; for await (const c of stream) r += c.content; return r;
    }
}
```

### 4. InputClassifier

Multi-signal weighted classification with pluggable signal definitions. Mode acts as hard override when signals are weak.

```typescript
type Intent = 'chat' | 'reason' | 'query' | 'goal' | 'command' | 'narsese';

interface InputClassification {
    primary: Intent;
    secondary?: Intent;
    confidence: number;
    signals: ClassificationSignal[];
}

interface ClassificationSignal {
    type: 'keyword' | 'pattern' | 'structure' | 'lm-suggestion' | 'narsese';
    source: string;
    intent: Intent;
    weight: number;
}

const NARSESE_RE = /^\s*\(\s*<[^>]+>\s*(-->|<->|==>|<=>|&&|\|\|)\s*/;

const DEFAULT_SIGNALS: [RegExp, Intent, number][] = [
    [/\b(why|how|therefore|because|implies|derive|prove|explain|analyze|reason)\b/i, 'reason', 0.5],
    [/\b(if|then|when|given|suppose|assuming)\b.*\b(then|what|would|does)\b/i, 'reason', 0.4],
    [/\b(difference between|compare|similar to|unlike|versus|vs)\b/i, 'reason', 0.2],
    [/\b(tell me|what is|explain|describe|define)\b/i, 'query', 0.3],
    [/\b([A-Z][a-z]+)\s+(is a|are|has|can|does|implies)\s+([A-Z][a-z]+)/i, 'reason', 0.2],
];

function classify(input: string, ctx: ConversationState, config: BotConfig): InputClassification {
    const signals = config.classifier?.signals
        ? config.classifier.signals.map(s => ({ type: s.type, source: s.pattern.source, intent: s.intent, weight: s.weight }))
        : DEFAULT_SIGNALS.map(([re, intent, w]) => ({ type: 'keyword' as const, source: re.source, intent, weight: w }));

    const scores: Record<Intent, number> = { chat: 0.1, reason: 0, query: 0, goal: 0, command: 0, narsese: 0 };
    const signalList: ClassificationSignal[] = [];
    const t = input.trim();

    if (t.startsWith('/') || t.startsWith('.')) { scores.command = 1.0; signalList.push({ type: 'structure', source: 'prefix', intent: 'command', weight: 1.0 }); }
    if (NARSESE_RE.test(t)) { scores.narsese = 0.9; signalList.push({ type: 'narsese', source: 'syntax', intent: 'narsese', weight: 0.9 }); }
    if (t.startsWith('!')) { scores.goal = 0.8; signalList.push({ type: 'structure', source: 'bang', intent: 'goal', weight: 0.8 }); }
    if (t.endsWith('?')) { scores.query += 0.6; signalList.push({ type: 'structure', source: 'question-mark', intent: 'query', weight: 0.6 }); }

    const reSignals = config.classifier?.signals ?? DEFAULT_SIGNALS;
    for (const [re, intent, w] of reSignals) {
        if (re.test(t)) { scores[intent] += w; signalList.push({ type: 'keyword', source: re.source, intent, weight: w }); }
    }

    const last = ctx.messages.at(-1);
    if (last?.role === 'assistant' && last.metadata?.suggestsReasoning) {
        scores.reason += 0.3; signalList.push({ type: 'lm-suggestion', source: 'prior-turn', intent: 'reason', weight: 0.3 });
    }

    const modeW = config.classifier?.modeWeight ?? 0.5;
    if (ctx.mode === 'reason') scores.reason += modeW;
    if (ctx.mode === 'chat') scores.chat += modeW;

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [primary, pScore] = sorted[0] as [Intent, number];
    const secondary = (sorted[1]?.[1] ?? 0) > pScore - 0.2 ? sorted[1][0] as Intent : undefined;
    return { primary, secondary, confidence: Math.min(pScore, 1.0), signals: signalList };
}

class InputClassifier implements PipelineStage {
    name = 'InputClassifier'; priority = 4;
    enabled = () => true;
    async execute(ctx: BotContext): Promise<void> {
        ctx.turn.classification = classify(ctx.turn.input.text, ctx.conversation, ctx.config);
        ctx.events.emit('classify:result', { input: ctx.turn.input.text, classification: ctx.turn.classification });
    }
}
```

### 5. ReasoningTrigger

```typescript
class ReasoningTriggerCore {
    private cooldown = 0;

    shouldTrigger(ctx: BotContext): { activate: boolean; confidence: number } {
        if (this.cooldown > 0) { this.cooldown--; return { activate: false, confidence: 0 }; }
        if (!ctx.capabilities.hasSeNARS || ctx.conversation.mode === 'chat') return { activate: false, confidence: 0 };

        const h = this.heuristics(ctx);
        const lm = ctx.conversation.messages.at(-1)?.role === 'assistant' &&
            ctx.conversation.messages.at(-1)!.metadata?.suggestsReasoning ? 0.7 : 0;
        const score = h * 0.6 + lm * 0.4;

        ctx.events.emit('trigger:score', { heuristicScore: h, lmScore: lm, total: score, activated: score >= 0.5 });

        if (score >= 0.5) { this.cooldown = 3; return { activate: true, confidence: score }; }
        return { activate: false, confidence: score };
    }

    private heuristics(ctx: BotContext): number {
        const input = ctx.turn.input.text.toLowerCase();
        let s = 0;
        if (this.knowledgeGap(input, ctx)) s += 0.3;
        if (this.contradiction(input, ctx)) s += 0.4;
        if (/\b(why|how|therefore|because|implies|derive|prove|explain|analyze|reason)\b/.test(input)) s += 0.2;
        if (/\b(if|then|when|given|suppose|assuming)\b.*\b(then|what|would|does)\b/.test(input)) s += 0.3;
        if (/\b([A-Z][a-z]+)\s+(is a|are|has|can|does|implies)\s+([A-Z][a-z]+)/i.test(input)) s += 0.2;
        if ((input.match(/\bbecause\b|\btherefore\b|\bthus\b|\bso\b/g) || []).length >= 2) s += 0.2;
        if (/\b(difference between|compare|similar to|unlike|versus|vs)\b/.test(input)) s += 0.2;
        return Math.min(s, 1.0);
    }

    private knowledgeGap(input: string, ctx: BotContext): boolean {
        if (!ctx.seNARS) return false;
        const report = ctx.seNARS.attentionReport();
        const terms = input.match(/\b[a-z]+\b/g) ?? [];
        return terms.some(t => t.length > 3 && !report.concepts.some((c: { term: string }) => c.term.toLowerCase().includes(t)));
    }

    private contradiction(input: string, ctx: BotContext): boolean {
        if (!ctx.seNARS) return false;
        const beliefs = ctx.seNARS.getBeliefs();
        if (!['not', "n't", 'no', 'never', 'false', 'wrong'].some(n => input.includes(n))) return false;
        const terms = input.match(/\b[a-z]+\b/g) ?? [];
        return terms.some((t: string) => t.length > 3 && beliefs.some((b: { term: { toString(): string } }) => b.term.toString().toLowerCase().includes(t)));
    }
}

class ReasoningTriggerStage implements PipelineStage {
    name = 'ReasoningTrigger'; priority = 5;
    enabled = (ctx) => ctx.capabilities.hasSeNARS && ctx.conversation.mode === 'auto';
    constructor(private core = new ReasoningTriggerCore()) {}
    async execute(ctx: BotContext): Promise<void> {
        ctx.turn.reasoningTriggered = this.core.shouldTrigger(ctx).activate;
    }
}
```

### 6. SeNARSProcessor

Processes input on first pass only. On loop-back, runs derivations on directive-injected beliefs. Uses pluggable NL parsers.

```typescript
const DEFAULT_NL_PARSERS: NLParserDef[] = [
    {
        name: 'negation',
        match: (t) => /^([A-Za-z_]+)\s+is\s+not\s+([A-Za-z_]+)\b/i.test(t),
        translate: (t) => { const m = t.match(/^([A-Za-z_]+)\s+is\s+not\s+([A-Za-z_]+)\b/i); return m ? `(<${m[1]} --> [${m[2]}]>. :0.0:0.9)` : null; },
    },
    {
        name: 'is-a',
        match: (t) => /^([A-Za-z_]+)\s+is\s+a\s+([A-Za-z_]+)\b/i.test(t),
        translate: (t) => { const m = t.match(/^([A-Za-z_]+)\s+is\s+a\s+([A-Za-z_]+)\b/i); return m ? `(<${m[1]} --> ${m[2]}>.)` : null; },
    },
    {
        name: 'has',
        match: (t) => /^([A-Za-z_]+)\s+has\s+([A-Za-z_]+)\b/i.test(t),
        translate: (t) => { const m = t.match(/^([A-Za-z_]+)\s+has\s+([A-Za-z_]+)\b/i); return m ? `(<${m[1]} --> [has_${m[2]}]>.)` : null; },
    },
    {
        name: 'is',
        match: (t) => /^([A-Za-z_]+)\s+is\s+([A-Za-z_]+)\b/i.test(t),
        translate: (t) => { const m = t.match(/^([A-Za-z_]+)\s+is\s+([A-Za-z_]+)\b/i); return m ? `(<${m[1]} --> [${m[2]}]>.)` : null; },
    },
    {
        name: 'implies',
        match: (t) => /^([A-Za-z_]+)\s+(?:implies|means|leads to)\s+([A-Za-z_]+)\b/i.test(t),
        translate: (t) => { const m = t.match(/^([A-Za-z_]+)\s+(?:implies|means|leads to)\s+([A-Za-z_]+)\b/i); return m ? `((<${m[1]}> ==> <${m[2]}>).)` : null; },
    },
];

class SeNARSProcessor implements PipelineStage {
    name = 'SeNARSProcessor'; priority = 6;
    enabled = (ctx) => ctx.capabilities.hasSeNARS &&
        (ctx.turn.reasoningTriggered || ctx.turn.classification.primary === 'narsese');

    async execute(ctx: BotContext): Promise<void> {
        const nar = ctx.seNARS!;
        const text = ctx.turn.input.text.trim();
        const cls = ctx.turn.classification;
        const before = new Set(nar.getBeliefs().map(b => `${b.term.toString()}:${b.truth?.f ?? 0}:${b.truth?.c ?? 0}`));

        const steps = ctx.turn.reasoningDepthOverride ?? ctx.config.reasoning.maxStepsPerTrigger;

        if (ctx.turn.passCount === 1) {
            ctx.events.emit('reasoning:start', { inputType: cls.primary, steps });
            switch (cls.primary) {
                case 'narsese':
                    if (text.startsWith('!')) await nar.goal(text.slice(1));
                    else if (text.includes('?')) { await nar.question(text); await nar.run(5); }
                    else { await nar.believe(text); await nar.run(3); }
                    break;
                case 'goal': await nar.goal(text.slice(1)); break;
                case 'query': await nar.question(text); await nar.run(5); break;
                default:
                    if (ctx.turn.reasoningTriggered) {
                        const nl = this.translateNL(text, ctx);
                        if (nl) await nar.believe(nl);
                        await nar.run(steps);
                    }
                    break;
            }
        } else {
            await nar.run(3);
        }

        const all = nar.getBeliefs();
        const newB = all.filter(b => !before.has(`${b.term.toString()}:${b.truth?.f ?? 0}:${b.truth?.c ?? 0}`));
        ctx.turn.reasoningResult = {
            steps: newB.length,
            beliefs: all.map(b => ({ term: b.term.toString(), truth: b.truth ? { frequency: b.truth.f, confidence: b.truth.c } : undefined })),
            newBeliefs: newB.map(b => ({ term: b.term.toString(), truth: b.truth ? { frequency: b.truth.f, confidence: b.truth.c } : undefined })),
        };
        ctx.events.emit('reasoning:end', { steps: newB.length, newBeliefs: ctx.turn.reasoningResult.newBeliefs });
    }

    private translateNL(text: string, ctx: BotContext): string | null {
        const parsers = ctx.config.nlParsers?.builtIn !== false ? [...DEFAULT_NL_PARSERS, ...(ctx.config.nlParsers?.custom ?? [])] : (ctx.config.nlParsers?.custom ?? []);
        for (const p of parsers) { if (p.match(text)) { const r = p.translate(text); if (r) return r; } }
        return null;
    }
}
```

### 7. LMResponder

Uses `getContextForLM()` for NAR context. Checks `[REASONING_SUGGESTED:]` before cleaning. Does NOT strip directive markers — DirectiveProcessor owns that.

```typescript
class LMResponder implements PipelineStage {
    name = 'LMResponder'; priority = 7;
    enabled = (ctx) => ctx.capabilities.hasLM;

    async execute(ctx: BotContext): Promise<void> {
        const lm = ctx.lm;
        if (!lm) return;

        const prompt = this.buildPrompt(ctx);
        ctx.events.emit('lm:start', { promptLength: prompt.length, streaming: ctx.config.streaming.enabled });

        if (ctx.config.streaming.enabled) {
            await this.streamResponse(ctx, lm, prompt);
        } else {
            const start = Date.now();
            ctx.turn.lmResponse = await lm.generateText(prompt);
            ctx.events.emit('lm:end', { response: ctx.turn.lmResponse!, durationMs: Date.now() - start });
        }

        const raw = ctx.turn.lmResponse || '';
        ctx.turn.lmSuggestsReasoning = /\[REASONING_SUGGESTED:/.test(raw);
        if (ctx.turn.lmSuggestsReasoning) ctx.events.emit('lm:suggests-reasoning', true);
        ctx.turn.lmResponse = raw.replace(/\[REASONING_SUGGESTED:[^\]]*\]\s*/g, '').trim();
    }

    private async streamResponse(ctx: BotContext, lm: LMClient, prompt: string): Promise<void> {
        await ctx.connection.respond({ type: 'status', content: 'typing', done: false });

        const adapter = new LMStreamAdapter(lm);
        let full = '';
        const start = Date.now();
        try {
            const msgs = [{ role: 'user' as const, content: prompt, timestamp: Date.now() }];
            for await (const chunk of adapter.stream(msgs)) {
                if (chunk.type === 'text' && chunk.content) {
                    full += chunk.content;
                    ctx.events.emit('lm:chunk', { content: chunk.content, accumulated: full });
                    await ctx.connection.respond(chunk);
                } else if (chunk.type === 'error') {
                    await ctx.connection.respond({ type: 'error', content: chunk.content, done: true });
                    if (!full) { ctx.turn.lmResponse = this.fallback(ctx); return; }
                    break;
                }
            }
        } catch (e) {
            await ctx.connection.respond({ type: 'error', content: `Stream interrupted: ${e instanceof Error ? e.message : String(e)}`, done: true });
            if (!full) { ctx.turn.lmResponse = this.fallback(ctx); return; }
        }
        ctx.turn.lmResponse = full;
        ctx.events.emit('lm:end', { response: full, durationMs: Date.now() - start });
    }

    private buildPrompt(ctx: BotContext): string {
        const t = ctx.config.prompts;
        if (t?.system) {
            return t.system
                .replace('{{name}}', ctx.profile.name)
                .replace('{{personality}}', ctx.profile.personality)
                .replace('{{context}}', this.buildContext(ctx))
                .replace('{{directives}}', this.buildDirectiveInstructions(ctx))
                .replace('{{guidelines}}', t.responseGuidelines ?? this.defaultGuidelines())
                .replace('{{history}}', this.buildHistory(ctx))
                .replace('{{input}}', ctx.turn.input.text);
        }

        const p: string[] = [];
        p.push(`You are ${ctx.profile.name}. ${ctx.profile.personality}`);

        if (ctx.capabilities.hasSeNARS && ctx.seNARS) {
            const narCtx = ctx.conversation.getContextForLM(10, ctx.seNARS);
            if (narCtx) { p.push('\n## Knowledge Context'); p.push(narCtx); }
            if (ctx.turn.reasoningResult?.newBeliefs?.length) {
                p.push('\n## Just Derived This Turn');
                for (const b of ctx.turn.reasoningResult.newBeliefs.slice(0, 5)) {
                    const tv = b.truth ? ` :${b.truth.frequency.toFixed(1)}:${b.truth.confidence.toFixed(1)}` : '';
                    p.push(`(<${b.term}>.${tv})`);
                }
            }
        }

        p.push(this.buildDirectiveInstructions(ctx));
        p.push('\n## Response Guidelines');
        p.push(t?.responseGuidelines ?? this.defaultGuidelines());

        const history = ctx.conversation.getHistory(ctx.config.conversation.maxHistory);
        if (history.length) { p.push('\n## Recent Conversation'); for (const m of history) p.push(`${m.role}: ${m.content}`); }

        p.push(`\nuser: ${ctx.turn.input.text}`);
        return p.join('\n');
    }

    private buildContext(ctx: BotContext): string {
        if (!ctx.capabilities.hasSeNARS || !ctx.seNARS) return '';
        const narCtx = ctx.conversation.getContextForLM(10, ctx.seNARS);
        const derivations = ctx.turn.reasoningResult?.newBeliefs?.slice(0, 5).map(b => {
            const tv = b.truth ? ` :${b.truth.frequency.toFixed(1)}:${b.truth.confidence.toFixed(1)}` : '';
            return `(<${b.term}>.${tv})`;
        }).join('\n') ?? '';
        return [narCtx, derivations ? `Just derived:\n${derivations}` : ''].filter(Boolean).join('\n');
    }

    private buildDirectiveInstructions(ctx: BotContext): string {
        if (!ctx.capabilities.hasSeNARS) return '';
        if (ctx.config.prompts?.directiveInstructions) return ctx.config.prompts.directiveInstructions;
        return '\n## Directives\n' +
            'To add a belief: [BELIEVE: (<term --> category>. :frequency:confidence)]\n' +
            'To ask a question: [QUESTION: (<term --> ?>.)]\n' +
            'To use a tool: [TOOL:toolName(arg1, arg2)]\n' +
            'To control reasoning depth: [REASONING_DEPTH:n]\n' +
            'These markers are stripped from visible output.';
    }

    private buildHistory(ctx: BotContext): string {
        const history = ctx.conversation.getHistory(ctx.config.conversation.maxHistory);
        if (!history.length) return '';
        return '\n## Recent Conversation\n' + history.map(m => `${m.role}: ${m.content}`).join('\n');
    }

    private defaultGuidelines(): string {
        return '- Be concise and direct\n- When uncertain, acknowledge uncertainty\n- Don\'t fabricate facts\n- Ground responses in the reasoning context above when available';
    }

    private fallback(ctx: BotContext): string {
        return ctx.capabilities.hasSeNARS
            ? 'I had trouble generating a response, but the reasoning engine processed your input.'
            : "I'm having trouble generating a response right now.";
    }
}
```

### 8. DirectiveProcessor

Sole owner of directive marker stripping. Sets `needsLoopBack` for believe/question directives.

```typescript
class DirectiveProcessor implements PipelineStage {
    name = 'DirectiveProcessor'; priority = 8;
    enabled = (ctx) => !!ctx.turn.lmResponse;

    private readonly BUILT_IN_PATTERNS = [
        { re: /\[BELIEVE:\s*([^\]]+)\]/gi, type: 'believe' as const, extract: (m: RegExpMatchArray) => ({ content: m[1]!.trim() }) },
        { re: /\[QUESTION:\s*([^\]]+)\]/gi, type: 'question' as const, extract: (m: RegExpMatchArray) => ({ content: m[1]!.trim() }) },
        { re: /\[TOOL:\s*(\w+)\s*\(([^)]*)\)\]/gi, type: 'tool_call' as const, extract: (m: RegExpMatchArray) => ({ name: m[1]!, content: m[2]! }) },
        { re: /\[REASONING_DEPTH:\s*(\d+)\]/gi, type: 'reasoning_depth' as const, extract: (m: RegExpMatchArray) => ({ content: m[1]! }) },
    ];

    async execute(ctx: BotContext): Promise<void> {
        const directives = this.extractAll(ctx.turn.lmResponse!, ctx);
        if (!directives.length) return;
        ctx.turn.directives = directives;

        if (!ctx.seNARS) {
            ctx.turn.directiveResults = directives.map(d => ({ directive: d, success: false, error: 'SeNARS not available' }));
            return;
        }

        const nar = ctx.seNARS;

        for (const d of directives) {
            ctx.events.emit('directive:found', { directive: d });
            const result = d._def?.execute
                ? { directive: d, success: true, result: await d._def.execute(nar, d.content, d.name) }
                : await this.execBuiltIn(nar, d, ctx);
            ctx.turn.directiveResults.push(result);
            ctx.turn.actions.push({ type: d.type, content: d.content, result: result.success ? String(result.result) : result.error });
            ctx.events.emit('directive:execute', { directive: d, success: result.success, result: result.result, error: result.error });

            if (d.type === 'reasoning_depth' && ctx.config.reasoning.lmDriven) {
                ctx.turn.reasoningDepthOverride = parseInt(d.content, 10);
            }
        }

        ctx.turn.lmResponse = this.stripAll(ctx.turn.lmResponse!, ctx);

        const loopBackTypes = directives.filter(d => d._def?.triggersLoopBack !== false && (d.type === 'believe' || d.type === 'question'));
        if (loopBackTypes.length) {
            ctx.turn.needsLoopBack = true;
            ctx.turn.loopBackType = loopBackTypes[0].type;
            ctx.events.emit('directive:loop-requested', { type: loopBackTypes[0].type });
        }
    }

    private extractAll(response: string, ctx: BotContext): LMDirective[] {
        const results: LMDirective[] = [];

        if (ctx.config.directives?.builtIn !== false) {
            for (const p of this.BUILT_IN_PATTERNS) {
                for (const m of response.matchAll(p.re)) {
                    const ext = p.extract(m);
                    results.push({ type: p.type, name: (ext as any).name ?? '', content: ext.content, raw: m[0]!, _def: undefined });
                }
            }
        }

        for (const def of ctx.config.directives?.custom ?? []) {
            for (const m of response.matchAll(def.pattern)) {
                const ext = def.extract(m);
                results.push({ type: def.type, name: ext.name ?? '', content: ext.content, raw: m[0]!, _def: def });
            }
        }

        return results;
    }

    private async execBuiltIn(nar: NAR, d: LMDirective, ctx: BotContext): Promise<DirectiveResult> {
        try {
            switch (d.type) {
                case 'believe': {
                    const derived = await nar.believe(d.content).then(() => nar.run(3));
                    return { directive: d, success: true, result: `${derived} derivations`, derivationSteps: derived };
                }
                case 'question': {
                    const derived = await nar.question(d.content).then(() => nar.run(5));
                    return { directive: d, success: true, result: `${derived} derivations`, derivationSteps: derived };
                }
                case 'tool_call': {
                    const tool = nar.tools.get(d.name);
                    if (!tool) return { directive: d, success: false, error: `Tool not found: ${d.name}` };
                    const result = await nar.executeTool(d.name, this.parseArgs(d.content));
                    return { directive: d, success: true, result: result.content };
                }
                case 'reasoning_depth': return { directive: d, success: true, result: `Depth set to ${d.content}` };
                default: return { directive: d, success: false, error: `Unknown directive: ${d.type}` };
            }
        } catch (e) { return { directive: d, success: false, error: String(e) }; }
    }

    private stripAll(response: string, ctx: BotContext): string {
        let r = response;
        if (ctx.config.directives?.builtIn !== false) {
            r = r.replace(/\[BELIEVE:[^\]]*\]\s*/g, '').replace(/\[QUESTION:[^\]]*\]\s*/g, '')
                 .replace(/\[TOOL:[^\]]*\]\s*/g, '').replace(/\[REASONING_DEPTH:[^\]]*\]\s*/g, '');
        }
        for (const def of ctx.config.directives?.custom ?? []) {
            r = r.replace(def.pattern, '');
        }
        return r.trim();
    }

    private parseArgs(s: string): Record<string, unknown> {
        if (!s.trim()) return {};
        try { return JSON.parse(`{${s}}`); } catch {
            const parts = s.split(',').map(x => x.trim());
            return parts.reduce((a, v, i) => ({ ...a, [`arg${i}`]: v }), {});
        }
    }
}
```

### 9. ResponseComposer

```typescript
class ResponseComposer implements PipelineStage {
    name = 'ResponseComposer'; priority = 9;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        if (ctx.turn.finalResponse) return;

        const parts: string[] = [];

        if (ctx.turn.reasoningResult?.steps) {
            parts.push(this.formatReasoning(ctx.turn.reasoningResult, ctx.config.streaming.showReasoningSteps));
        } else if (ctx.turn.classification.primary === 'narsese') {
            parts.push('No derivations found.');
        }

        if (ctx.turn.lmResponse) parts.push(ctx.turn.lmResponse);
        if (ctx.turn.directiveResults.length) {
            const s = this.formatDirectives(ctx.turn.directiveResults);
            if (s) parts.push(s);
        }
        if (ctx.turn.toolResults.length) parts.push(this.formatTools(ctx.turn.toolResults));
        if (!parts.length) parts.push(this.fallback(ctx));

        ctx.turn.finalResponse = parts.join('\n\n');
    }

    private formatReasoning(r: DerivationResult, showSteps: boolean): string {
        if (!showSteps || !r.newBeliefs.length) return `Derived ${r.steps} belief(s).`;
        const lines = [`Derived ${r.steps} belief(s):`];
        for (const b of r.newBeliefs.slice(0, 5)) {
            const tv = b.truth ? ` :${b.truth.frequency.toFixed(1)}:${b.truth.confidence.toFixed(1)}` : '';
            lines.push(`  → (<${b.term}>.${tv})`);
        }
        if (r.newBeliefs.length > 5) lines.push(`  ... and ${r.newBeliefs.length - 5} more`);
        return lines.join('\n');
    }

    private formatDirectives(results: DirectiveResult[]): string {
        const lines: string[] = [];
        for (const r of results) {
            if (!r.success) { lines.push(`  ✗ ${r.directive.type}: ${r.error}`); continue; }
            if (r.directive.type === 'believe') lines.push(`  ✓ Added: ${r.directive.content.slice(0, 60)}${r.derivationSteps ? ` (${r.derivationSteps} derivations)` : ''}`);
            else if (r.directive.type === 'question') lines.push(`  ✓ Queried: ${r.directive.content.slice(0, 60)}${r.derivationSteps ? ` (${r.derivationSteps} derivations)` : ''}`);
            else if (r.directive.type === 'tool_call') lines.push(`  ✓ Tool ${r.directive.name}: ${String(r.result).slice(0, 80)}`);
        }
        return lines.join('\n');
    }

    private formatTools(results: ToolResult[]): string {
        return results.map(r => r.error ? `✗ ${r.name}: ${r.error}` : `✓ ${r.name}: ${String(r.result)}`).join('\n');
    }

    private fallback(ctx: BotContext): string {
        const c = ctx.turn.classification.primary;
        if (c === 'narsese') return 'Processed. No derivations.';
        if (c === 'query') return ctx.capabilities.hasSeNARS ? 'No derivation found. Try adding related beliefs first.' : "I don't have enough information to answer that.";
        return ctx.capabilities.hasLM ? "I'm not sure how to respond to that." : 'Processed.';
    }
}
```

### 10. ResponseFormatter

```typescript
class ResponseFormatter implements PipelineStage {
    name = 'ResponseFormatter'; priority = 10;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        if (ctx.connection.type === 'irc') {
            ctx.turn.finalResponse = ctx.turn.finalResponse
                .replace(/\*\*(.+?)\*\*/g, '$1')
                .replace(/\*(.+?)\*/g, '$1')
                .replace(/`(.+?)`/g, '$1')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .slice(0, 400);
        }
    }
}
```

### 11. StatePersistor

```typescript
class StatePersistor implements PipelineStage {
    name = 'StatePersistor'; priority = 11;
    enabled = () => true;
    constructor(private episodicMemory?: EpisodicMemory) {}

    async execute(ctx: BotContext): Promise<void> {
        this.episodicMemory?.log({
            type: 'turn',
            input: ctx.turn.input.text,
            output: ctx.turn.finalResponse,
            classification: ctx.turn.classification.primary,
            reasoningTriggered: ctx.turn.reasoningTriggered,
            directives: ctx.turn.directives.length,
            sender: ctx.connection.sender,
            source: ctx.connection.id,
            timestamp: Date.now(),
            durationMs: Date.now() - ctx.metrics.startTime,
        });
    }
}
```

---

## ConversationState

```typescript
interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

interface ReasoningArtifact {
    type: 'derivation' | 'tool_result' | 'belief_added' | 'question_answered';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

type BotMode = 'auto' | 'chat' | 'reason';

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
        lm?.generateText && this.maybeSummarize(lm);
    }

    getHistory(limit?: number): Message[] {
        return limit ? this.messages.slice(-limit) : [...this.messages];
    }

    getContextForLM(maxConcepts: number, nar: NAR): string {
        const p: string[] = [];
        if (this.summary) p.push(`Conversation summary: ${this.summary}`);
        const report = nar.attentionReport(maxConcepts);
        if (report.concepts.length) {
            p.push('Knowledge context:');
            for (const c of report.concepts) p.push(`  - ${c.term} (priority: ${c.priority})`);
        }
        const recent = this.reasoningArtifacts.slice(-5);
        if (recent.length) { p.push('Recent reasoning:'); for (const a of recent) p.push(`  - ${a.content}`); }
        if (this.pinnedBeliefs.size) { p.push('Pinned context:'); for (const b of this.pinnedBeliefs) p.push(`  - ${b}`); }
        return p.join('\n');
    }

    private async maybeSummarize(lm: LMClient): Promise<void> {
        if (this.messages.length <= this.config.conversation.summaryThreshold) return;
        const toSum = this.messages.slice(0, -10);
        try {
            this.summary = await lm.generateText(`Summarize in 2-3 sentences:\n\n${toSum.map(m => `${m.role}: ${m.content}`).join('\n')}`);
            this.messages = this.messages.slice(-10);
        } catch { /* continue without summary */ }
    }

    set(key: string, value: unknown): void { this.workingMemory.set(key, value); }
    get<T>(key: string): T | undefined { return this.workingMemory.get(key) as T; }

    addArtifact(a: ReasoningArtifact): void {
        this.reasoningArtifacts.push(a);
        const max = this.config.conversation.maxArtifacts;
        if (this.reasoningArtifacts.length > max) this.reasoningArtifacts = this.reasoningArtifacts.slice(-Math.floor(max / 2));
    }

    pin(b: string): void { this.pinnedBeliefs.add(b); }
    unpin(b: string): void { this.pinnedBeliefs.delete(b); }
    getPinned(): string[] { return [...this.pinnedBeliefs]; }
}

class ConversationStateManager {
    private states = new Map<string, ConversationState>();
    constructor(private readonly config: BotConfig) {}

    getOrCreate(sender: string): ConversationState {
        if (!this.states.has(sender)) this.states.set(sender, new ConversationState(this.config));
        return this.states.get(sender)!;
    }

    get(sender: string): ConversationState | undefined { return this.states.get(sender); }
    remove(sender: string): void { this.states.delete(sender); }
    getAll(): ReadonlyMap<string, ConversationState> { return this.states; }

    serialize(): Record<string, unknown> {
        const r: Record<string, unknown> = {};
        for (const [s, st] of this.states) {
            r[s] = { messages: st.getHistory(), summary: (st as any).summary, pinnedBeliefs: st.getPinned(), mode: st.mode };
        }
        return r;
    }

    deserialize(data: Record<string, unknown>): void {
        for (const [sender, entry] of Object.entries(data)) {
            const e = entry as Record<string, unknown>;
            const st = new ConversationState(this.config);
            st.messages = (e.messages as Message[]) ?? [];
            (st as any).summary = e.summary as string | undefined;
            st.mode = (e.mode as BotMode) ?? 'auto';
            for (const b of (e.pinnedBeliefs as string[]) ?? []) st.pin(b);
            this.states.set(sender, st);
        }
    }
}
```

---

## Bot Class

Thin orchestrator. Delegates connection management to `ConnectionManager`, agentic loop to `AgenticLoop`.

```typescript
export interface BotDeps {
    profile: BotProfile;
    lm?: LMClient;
    nar?: NAR;
    config?: Partial<BotConfig>;
    episodicMemory?: EpisodicMemory;
    commandRegistry?: CommandRegistry;
}

export class Bot {
    readonly profile: BotProfile;
    readonly pipeline: MessagePipeline;
    readonly stateManager: ConversationStateManager;
    readonly config: BotConfig;
    readonly capabilities: Capabilities;
    readonly events: PipelineEventEmitter;

    private readonly lm?: LMClient;
    private readonly nar?: NAR;
    readonly episodicMemory?: EpisodicMemory;
    readonly commands: CommandRegistry;
    private connectionManager?: ConnectionManager;
    private agenticLoop?: AgenticLoop;
    private logger: Logger;

    constructor(deps: BotDeps) {
        this.profile = deps.profile;
        this.lm = deps.lm;
        this.nar = deps.nar;
        this.episodicMemory = deps.episodicMemory;
        this.commands = deps.commandRegistry ?? new CommandRegistry();
        this.config = this.mergeConfig(deps.config ?? {});
        this.capabilities = detectCapabilities(this.lm, this.nar);
        this.events = new PipelineEventEmitter();
        this.stateManager = new ConversationStateManager(this.config);
        this.logger = createLogger({ scope: 'bot' });

        const stages = this.buildStages();
        this.pipeline = new MessagePipeline(stages);
    }

    private mergeConfig(override: Partial<BotConfig>): BotConfig {
        const d = DEFAULT_BOT_CONFIG;
        return {
            reasoning: { ...d.reasoning, ...override.reasoning },
            streaming: { ...d.streaming, ...override.streaming },
            conversation: { ...d.conversation, ...override.conversation },
            pipeline: { ...d.pipeline, ...override.pipeline, loopBackOn: override.pipeline?.loopBackOn ?? d.pipeline.loopBackOn },
            directives: { ...d.directives, ...override.directives },
            nlParsers: { ...d.nlParsers, ...override.nlParsers },
            classifier: { ...d.classifier, ...override.classifier },
            tui: { ...d.tui, ...override.tui },
            prompts: { ...d.prompts, ...override.prompts },
        };
    }

    private buildStages(): PipelineStage[] {
        const preset = this.config.pipeline.preset ?? 'default';
        const factories = this.config.pipeline.stages
            ? this.config.pipeline.stages.map(s => typeof s === 'function' ? s : (() => s))
            : (PRESETS[preset] ?? PRESETS.default);
        return factories.map(f => f(this));
    }

    async processMessage(msg: IOMessage, connection: ConnectionInfo): Promise<BotResponse> {
        const state = this.stateManager.getOrCreate(connection.sender);
        const ctx: BotContext = {
            profile: this.profile,
            lm: this.lm,
            seNARS: this.nar,
            connection,
            conversation: state,
            turn: {
                input: msg, classification: { primary: 'chat', confidence: 0, signals: [] },
                reasoningTriggered: false, lmSuggestsReasoning: false,
                directives: [], directiveResults: [], toolResults: [], actions: [],
                finalResponse: '', passCount: 0, needsLoopBack: false,
            },
            config: this.config,
            capabilities: this.capabilities,
            metrics: { startTime: Date.now(), stages: new Map() },
            events: this.events,
        };

        return this.pipeline.process(msg, ctx);
    }

    on<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void {
        this.events.on(event, cb);
    }

    off<K extends keyof PipelineEvents>(event: K, cb: EventCallback<PipelineEvents[K]>): void {
        this.events.off(event, cb);
    }

    async start(): Promise<void> {
        this.logger.info(`Bot started: ${this.profile.name} (${this.capabilities.mode})`);
    }

    async stop(): Promise<void> {
        await this.connectionManager?.shutdownAll();
        this.agenticLoop?.stop();
        this.logger.info('Bot stopped');
    }
}
```

---

## File Layout

```
src/bot/
  ├── index.ts              # Re-exports: Bot, BotConfig, BotContext, PipelineStage, etc.
  ├── Bot.ts                # Main Bot class (thin orchestrator)
  ├── pipeline/
  │   ├── MessagePipeline.ts    # Pipeline execution + loop-back
  │   ├── PipelineEventEmitter.ts # Typed event bus
  │   └── types.ts              # PipelineStage, TurnState, BotResponse, etc.
  ├── stages/
  │   ├── InputNormalizer.ts
  │   ├── AuthChecker.ts
  │   ├── CommandProcessor.ts
  │   ├── InputClassifier.ts    # + classify(), DEFAULT_SIGNALS, NARSESE_RE
  │   ├── ReasoningTrigger.ts   # + ReasoningTriggerCore
  │   ├── SeNARSProcessor.ts    # + DEFAULT_NL_PARSERS, NLParserDef
  │   ├── LMResponder.ts        # + LMStreamAdapter
  │   ├── DirectiveProcessor.ts # + DirectiveDef, built-in patterns
  │   ├── ResponseComposer.ts
  │   ├── ResponseFormatter.ts
  │   └── StatePersistor.ts
  ├── conversation/
  │   ├── ConversationState.ts  # + ConversationStateManager, Message, ReasoningArtifact
  │   └── types.ts              # BotMode, BotProfile
  ├── config/
  │   ├── defaults.ts           # DEFAULT_BOT_CONFIG
  │   ├── loader.ts             # JSONC config file + env overrides
  │   └── types.ts              # BotConfig, ClassificationSignalDef
  └── presets/
      └── index.ts              # PRESETS, StageFactory
```

Existing files reused (no changes): `src/io/types.ts` (IOMessage, StreamChunk), `src/nar/nar.ts` (NAR), `src/io/commands/registry.ts` (CommandRegistry), `src/nar/memory/EpisodicMemory.ts`

---

## Migration from Current Architecture

### Current State (Agent.ts)

```
Agent.processMessage()
  ├── classifyInput() — punctuation-based, brittle
  ├── switch(classification) — hardcoded branches
  │   ├── command → CommandRegistry (dummy Connection inline)
  │   ├── belief → nar.believe() + nar.run(3)
  │   ├── question → nar.question() + nar.run(5)
  │   ├── goal → nar.goal()
  │   └── default → ChatResponder.respond() → ResponseInterpreter
  └── No streaming, no loop-back, no events
```

### Target State (Bot)

```
Bot.processMessage()
  └── MessagePipeline.process()
        ├── 11 composable stages (configurable via preset or custom stages)
        ├── Bounded loop-back for LM↔NAR interaction
        ├── Typed event emission at every stage boundary
        ├── Graceful degradation via enabled() predicates
        └── Streaming support for LM responses
```

### Migration Steps

1. **Create `src/bot/` directory** with all files from File Layout above
   - Types go in `types.ts` files, implementations in named files
   - All stages implement `PipelineStage` interface

2. **Port command registry** — commands currently receive `CommandContext` with `{ nar, connection, manager }`
   - New `CommandProcessor` passes `BotContext` to handlers
   - Commands access `ctx.seNARS` instead of `ctx.nar`, `ctx.connection` (real ConnectionInfo) instead of dummy inline object
   - No changes to command handler logic — just field name updates

3. **Wire `bot.ts` entry point** — add `SENARS_PIPELINE=true` env var gate
   ```typescript
   if (process.env.SENARS_PIPELINE === 'true') {
       const bot = new Bot({ profile, lm, nar, episodicMemory, commandRegistry: agent.getCommands() });
       bot.on('stage:start', ({ stage }) => logger.debug(`Stage: ${stage}`));
       // ... wire connections to use bot.processMessage()
   } else {
       // existing Agent path
   }
   ```

4. **Add event listeners** for TUI, metrics, logging in `bot.ts`
   ```typescript
   bot.on('lm:chunk', ({ content }) => tui.append(content));
   bot.on('reasoning:end', ({ newBeliefs }) => logger.info(`${newBeliefs.length} new beliefs`));
   bot.on('turn:end', ({ durationMs }) => metrics.record(durationMs));
   ```

5. **Update REPL** (`src/cli/repl.ts`) to use `Bot` when pipeline enabled
   - Replace `agent.processMessage()` → `bot.processMessage(msg, connectionInfo)`
   - ConnectionInfo built from REPL session (id: 'repl', type: 'cli', sender: 'user')

6. **Deprecate `Agent.processMessage()`** — add `@deprecated` JSDoc, keep for backward compat
   - `ChatResponder`, `ResponseInterpreter`, `AgenticLoop` continue working via old path

7. **Remove `Agent`** after stabilization — once all channels use `Bot`, delete old code

---

## Experimentation Hooks

The event bus and pluggable config enable experimentation without code changes:

```typescript
// Experiment: test alternative trigger threshold
bot.on('trigger:score', ({ total, activated }) => {
    experiment.record('trigger', { threshold: 0.5, score: total, activated });
});

// Experiment: compare classifier variants
bot.on('classify:result', ({ classification }) => {
    experiment.record('classifier', { variant: 'default', result: classification });
});

// Experiment: custom NL parser for syllogisms
bot.config.nlParsers.custom = [{
    name: 'syllogism',
    match: (t) => /^if all (\w+) are (\w+) and (\w+) are (\w+)/i.test(t),
    translate: (t) => {
        const m = t.match(/^if all (\w+) are (\w+) and (\w+) are (\w+)/i);
        return m ? `((<${m[3]}> --> ${m[2]}>.) (<${m[1]}> --> ${m[4]}>.))` : null;
    },
}];

// Experiment: custom directive for hypothesis generation
bot.config.directives.custom = [{
    pattern: /\[HYPOTHESIS:\s*([^\]]+)\]/gi,
    type: 'hypothesis',
    extract: (m) => ({ content: m[1]!.trim() }),
    execute: async (nar, content) => {
        await nar.believe(`(<${content} --> hypothesis>. :0.5:0.3)`);
        return 'Hypothesis registered with low confidence';
    },
    triggersLoopBack: true,
}];
```
