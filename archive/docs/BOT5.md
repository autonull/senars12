# BOT5.md — Unified Bot Architecture

## Vision

A single `Bot` class with a pipeline that supports bidirectional NAR↔LM interaction via bounded loop-back. All entry points (REPL, IRC, WS, HTTP, MCP) share one processing path. Graceful degradation across full / LM-only / SeNARS-only modes.

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
| 4 | `InputClassifier` | Multi-signal intent classification |
| 5 | `ReasoningTrigger` | Heuristic + LM-signal scoring for SeNARS activation |
| 6 | `SeNARSProcessor` | NAL operations, belief diff tracking |
| 7 | `LMResponder` | Generate response with SeNARS context |
| 8 | `DirectiveProcessor` | Extract + execute `[BELIEVE:]`, `[QUESTION:]`, `[TOOL:]`; request loop-back |
| 9 | `ResponseComposer` | Merge reasoning + LM + directives into response |
| 10 | `ResponseFormatter` | Channel-specific formatting (IRC stripping) |
| 11 | `StatePersistor` | Log turn to episodic memory |

---

## Advanced LM↔NAR Communication Patterns

The pipeline enables these bidirectional interaction patterns:

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

### Configuration Extensions

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
        stages?: PipelineStage[];       // Custom stage list (overrides defaults)
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
    tui: {
        typingIndicator: boolean;
        colors: boolean;
        compactMode: boolean;
        statusBar: boolean;
    };
}

interface DirectiveDef {
    pattern: RegExp;                    // Regex with capture group for content
    type: string;                       // Directive type name
    extract: (match: RegExpMatchArray) => { name?: string; content: string };
    execute: (nar: NAR, content: string, name?: string) => Promise<unknown>;
    triggersLoopBack: boolean;          // Whether this directive requests another pass
}
```

### Pipeline Presets

| Preset | Stages | Loop-Back | Use Case |
|---|---|---|---|
| `default` | All 11 stages | Enabled on believe/question | Full LM+NAR interaction |
| `chat` | Normalizer → Auth → Command → Classifier → LMResponder → Composer → Formatter → Persistor | Disabled | LM-only conversation |
| `reasoning` | Normalizer → Auth → Command → Classifier → Trigger → SeNARSProcessor → Composer → Formatter → Persistor | Disabled | NAR-only reasoning REPL |
| `tool` | Normalizer → Auth → Command → Classifier → SeNARSProcessor → LMResponder → DirectiveProcessor → Composer → Formatter → Persistor | Enabled on tool_call | Tool-focused workflows |

Presets are applied before custom `stages` — if both are set, `stages` wins.

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
    tui: { typingIndicator: true, colors: true, compactMode: false, statusBar: true },
};
```

---

## Types

### BotConfig

```typescript
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
        enabled: boolean;           // Default: true
        showReasoningSteps: boolean;
        showToolCalls: boolean;
    };
    conversation: {
        maxHistory: number;
        summaryThreshold: number;
        maxArtifacts: number;
    };
    pipeline: {
        maxLoops: number;           // Default: 2
        stageTimeoutMs: number;     // Default: 30000
    };
    tui: {
        typingIndicator: boolean;
        colors: boolean;
        compactMode: boolean;
        statusBar: boolean;
    };
}
```

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

## MessagePipeline

Loop-back is managed internally by the pipeline. Stages don't manage loop state — they just set `needsLoopBack` when appropriate.

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

            for (const stage of this.stages) {
                if (!stage.enabled(ctx)) continue;
                if (ctx.turn.passCount > 1 && !this.loopStages.has(stage.name)) continue;

                const start = Date.now();
                try {
                    await Promise.race([
                        stage.execute(ctx),
                        new Promise<never>((_, reject) =>
                            setTimeout(() => reject(new Error(`Stage ${stage.name} timed out`)), ctx.config.pipeline.stageTimeoutMs)
                        ),
                    ]);
                } catch (error) {
                    ctx.turn.error = error as Error;
                    ctx.metrics.stages.set(stage.name, { durationMs: Date.now() - start, error: String(error) });
                    ctx.turn.finalResponse = this.errorResponse(error, ctx);
                    break;
                }
                ctx.metrics.stages.set(stage.name, { durationMs: Date.now() - start });

                if (ctx.turn.finalResponse && stage.name === 'CommandProcessor') return this.composeResponse(ctx);
            }

            if (ctx.turn.error) break;
            // Only loop back if enabled and DirectiveProcessor set a matching directive type
        } while (enableLoopBack && ctx.turn.needsLoopBack && loopBackOn.has(ctx.turn.loopBackType!) && ctx.turn.passCount < ctx.config.pipeline.maxLoops);

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
        // IOMessage fields are readonly — create mutable copy
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

        // Periodic cleanup to prevent memory leak
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

**Key**: Commands receive the full `BotContext`, which includes `ctx.connection` (real connection info, not a fake stub).

### 4. InputClassifier

Multi-signal weighted classification. Mode acts as hard override when signals are weak.

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

const KEYWORD_SIGNALS: [RegExp, Intent, number][] = [
    [/\b(why|how|therefore|because|implies|derive|prove|explain|analyze|reason)\b/i, 'reason', 0.5],
    [/\b(if|then|when|given|suppose|assuming)\b.*\b(then|what|would|does)\b/i, 'reason', 0.4],
    [/\b(difference between|compare|similar to|unlike|versus|vs)\b/i, 'reason', 0.2],
    [/\b(tell me|what is|explain|describe|define)\b/i, 'query', 0.3],
    [/\b([A-Z][a-z]+)\s+(is a|are|has|can|does|implies)\s+([A-Z][a-z]+)/i, 'reason', 0.2],
];

function classify(input: string, ctx: ConversationState): InputClassification {
    const scores: Record<Intent, number> = { chat: 0.1, reason: 0, query: 0, goal: 0, command: 0, narsese: 0 };
    const signals: ClassificationSignal[] = [];
    const t = input.trim();

    if (t.startsWith('/') || t.startsWith('.')) { scores.command = 1.0; signals.push({ type: 'structure', source: 'prefix', intent: 'command', weight: 1.0 }); }
    if (NARSESE_RE.test(t)) { scores.narsese = 0.9; signals.push({ type: 'narsese', source: 'syntax', intent: 'narsese', weight: 0.9 }); }
    if (t.startsWith('!')) { scores.goal = 0.8; signals.push({ type: 'structure', source: 'bang', intent: 'goal', weight: 0.8 }); }
    if (t.endsWith('?')) { scores.query += 0.6; signals.push({ type: 'structure', source: 'question-mark', intent: 'query', weight: 0.6 }); }

    for (const [re, intent, w] of KEYWORD_SIGNALS) {
        if (re.test(t)) { scores[intent] += w; signals.push({ type: 'keyword', source: re.source, intent, weight: w }); }
    }

    const last = ctx.messages.at(-1);
    if (last?.role === 'assistant' && last.metadata?.suggestsReasoning) {
        scores.reason += 0.3; signals.push({ type: 'lm-suggestion', source: 'prior-turn', intent: 'reason', weight: 0.3 });
    }

    if (ctx.mode === 'reason') scores.reason += 0.5;
    if (ctx.mode === 'chat') scores.chat += 0.5;

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [primary, pScore] = sorted[0] as [Intent, number];
    const secondary = (sorted[1]?.[1] ?? 0) > pScore - 0.2 ? sorted[1][0] as Intent : undefined;
    return { primary, secondary, confidence: Math.min(pScore, 1.0), signals };
}

class InputClassifier implements PipelineStage {
    name = 'InputClassifier'; priority = 4;
    enabled = () => true;
    async execute(ctx: BotContext): Promise<void> {
        ctx.turn.classification = classify(ctx.turn.input.text, ctx.conversation);
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

Processes input on first pass only. On loop-back, runs derivations on directive-injected beliefs.

```typescript
class SeNARSProcessor implements PipelineStage {
    name = 'SeNARSProcessor'; priority = 6;
    enabled = (ctx) => ctx.capabilities.hasSeNARS &&
        (ctx.turn.reasoningTriggered || ctx.turn.classification.primary === 'narsese');

    async execute(ctx: BotContext): Promise<void> {
        const nar = ctx.seNARS!;
        const text = ctx.turn.input.text.trim();
        const cls = ctx.turn.classification;
        const before = new Set(nar.getBeliefs().map(b => `${b.term.toString()}:${b.truth?.f ?? 0}:${b.truth?.c ?? 0}`));

        // LM-driven reasoning depth override
        const steps = ctx.turn.reasoningDepthOverride ?? ctx.config.reasoning.maxStepsPerTrigger;

        if (ctx.turn.passCount === 1) {
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
                        const nl = this.nlToNarsese(text);
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
    }

    private nlToNarsese(text: string): string | null {
        const t = text.trim();
        const m1 = t.match(/^([A-Za-z_]+)\s+is\s+not\s+([A-Za-z_]+)\b/i);
        if (m1) return `(<${m1[1]} --> [${m1[2]}]>. :0.0:0.9)`;
        const m2 = t.match(/^([A-Za-z_]+)\s+is\s+a\s+([A-Za-z_]+)\b/i);
        if (m2) return `(<${m2[1]} --> ${m2[2]}>.)`;
        const m3 = t.match(/^([A-Za-z_]+)\s+has\s+([A-Za-z_]+)\b/i);
        if (m3) return `(<${m3[1]} --> [has_${m3[2]}]>.)`;
        const m4 = t.match(/^([A-Za-z_]+)\s+is\s+([A-Za-z_]+)\b/i);
        if (m4) return `(<${m4[1]} --> [${m4[2]}]>.)`;
        const m5 = t.match(/^([A-Za-z_]+)\s+(?:implies|means|leads to)\s+([A-Za-z_]+)\b/i);
        if (m5) return `((<${m5[1]}> ==> <${m5[2]}>).)`;
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

        if (ctx.config.streaming.enabled) {
            await this.streamResponse(ctx, lm, prompt);
        } else {
            ctx.turn.lmResponse = await lm.generateText(prompt);
        }

        // Check REASONING_SUGGESTED before stripping
        const raw = ctx.turn.lmResponse || '';
        ctx.turn.lmSuggestsReasoning = /\[REASONING_SUGGESTED:/.test(raw);
        // Strip only REASONING_SUGGESTED — directive markers handled by DirectiveProcessor
        ctx.turn.lmResponse = raw.replace(/\[REASONING_SUGGESTED:[^\]]*\]\s*/g, '').trim();
    }

    private async streamResponse(ctx: BotContext, lm: LMClient, prompt: string): Promise<void> {
        await ctx.connection.respond({ type: 'status', content: 'typing', done: false });

        const adapter = new LMStreamAdapter(lm);
        let full = '';
        try {
            const msgs = [{ role: 'user' as const, content: prompt, timestamp: Date.now() }];
            for await (const chunk of adapter.stream(msgs)) {
                if (chunk.type === 'text' && chunk.content) { full += chunk.content; await ctx.connection.respond(chunk); }
                else if (chunk.type === 'error') {
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

        // Default prompt construction
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
            const result = d._def?.execute
                ? { directive: d, success: true, result: await d._def.execute(nar, d.content, d.name) }
                : await this.execBuiltIn(nar, d, ctx);
            ctx.turn.directiveResults.push(result);
            ctx.turn.actions.push({ type: d.type, content: d.content, result: result.success ? String(result.result) : result.error });

            // Handle REASONING_DEPTH
            if (d.type === 'reasoning_depth' && ctx.config.reasoning.lmDriven) {
                ctx.turn.reasoningDepthOverride = parseInt(d.content, 10);
            }
        }

        // Strip all directive markers
        ctx.turn.lmResponse = this.stripAll(ctx.turn.lmResponse!, ctx);

        // Request loop-back for matching directive types
        const loopBackTypes = directives.filter(d => d._def?.triggersLoopBack !== false && (d.type === 'believe' || d.type === 'question'));
        if (loopBackTypes.length) {
            ctx.turn.needsLoopBack = true;
            ctx.turn.loopBackType = loopBackTypes[0].type;
        }
    }

    private extractAll(response: string, ctx: BotContext): LMDirective[] {
        const results: LMDirective[] = [];

        // Built-in patterns
        if (ctx.config.directives?.builtIn !== false) {
            for (const p of this.BUILT_IN_PATTERNS) {
                for (const m of response.matchAll(p.re)) {
                    const ext = p.extract(m);
                    results.push({ type: p.type, name: (ext as any).name ?? '', content: ext.content, raw: m[0]!, _def: undefined });
                }
            }
        }

        // Custom patterns
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

    private readonly lm?: LMClient;
    private readonly nar?: NAR;
    readonly episodicMemory?: EpisodicMemory;
    readonly commands: CommandRegistry;
    private connectionManager?: ConnectionManager;
    private agenticLoop?: AgenticLoop;
    private logger: Logger;
    private emitter = new EventEmitter();

    constructor(deps: BotDeps) {
        this.profile = deps.profile;
        this.lm = deps.lm;
        this.nar = deps.nar;
        this.logger = createLogger({ scope: 'bot' });
        this.capabilities = detectCapabilities(this.lm, this.nar);
        this.config = { ...DEFAULT_BOT_CONFIG, ...deps.config };
        this.stateManager = new ConversationStateManager(this.config);
        this.episodicMemory = deps.episodicMemory;
        this.commands = deps.commandRegistry ?? this.createCommands();
        this.pipeline = this.createPipeline();
    }

    private createCommands(): CommandRegistry {
        const r = new CommandRegistry();
        for (const cmd of [
            coreCommands, connectionCommands, memoryCommands, narCommands,
            selfCommands, lmCommands, rlfpCommands, authCommands,
            configCommands, scenarioCommands, benchmarkCommands,
            experimentCommands, episodesCommands,
        ].flat()) r.register(cmd);
        return r;
    }

    private createPipeline(): MessagePipeline {
        // Custom stages override everything
        if (this.config.pipeline.stages?.length) return new MessagePipeline(this.config.pipeline.stages);

        // Apply preset or use default
        const preset = this.config.pipeline.preset ?? 'default';
        const stages = PRESETS[preset] ?? PRESETS.default;
        return new MessagePipeline(stages.map(S => new S(this)));
    }

    // Connection management (delegated)
    setConnectionManager(m: ConnectionManager): void { this.connectionManager = m; }

    async addConnection(config: ConnectionConfig): Promise<Connection> {
        if (!this.connectionManager) throw new Error('ConnectionManager not set');
        return this.connectionManager.addConnection(config, {
            nar: this.nar!,
            emit: (e, d) => this.emit(e, d),
            logger: this.logger.child(`conn:${config.id}`),
        });
    }

    // Single message entry point
    async processMessage(msg: IOMessage, respondFn: (text: string | StreamChunk) => Promise<void>): Promise<BotResponse> {
        const connInfo: ConnectionInfo = {
            id: msg.source,
            type: (msg.metadata?.connectionType as ChannelType) ?? 'cli',
            sender: msg.sender,
            respond: respondFn,
            stream: async (stream) => { for await (const c of stream) if (c.type === 'text') await respondFn(c); },
        };

        const conversation = this.stateManager.getOrCreate(msg.sender);
        const ctx = this.createContext(connInfo, conversation);
        const response = await this.pipeline.process(msg, ctx);

        conversation.addMessage({ role: 'user', content: msg.text, timestamp: Date.now() }, this.lm);
        conversation.addMessage({
            role: 'assistant', content: response.text, timestamp: Date.now(),
            metadata: ctx.turn.lmSuggestsReasoning ? { suggestsReasoning: true } : undefined,
        }, this.lm);

        if (ctx.turn.reasoningResult?.newBeliefs?.length) {
            conversation.addArtifact({
                type: 'derivation',
                content: `Derived ${ctx.turn.reasoningResult.newBeliefs.length} belief(s): ${ctx.turn.reasoningResult.newBeliefs.slice(0, 3).map(b => b.term).join(', ')}`,
                timestamp: Date.now(),
            });
        }
        for (const dr of ctx.turn.directiveResults) {
            if (dr.success) conversation.addArtifact({
                type: dr.directive.type === 'believe' ? 'belief_added' : dr.directive.type === 'question' ? 'question_answered' : 'tool_result',
                content: dr.directive.content.slice(0, 80), timestamp: Date.now(),
            });
        }

        return response;
    }

    private createContext(connInfo: ConnectionInfo, conversation: ConversationState): BotContext {
        return {
            profile: this.profile, lm: this.lm, seNARS: this.nar,
            connection: connInfo, conversation,
            turn: {
                input: { id: crypto.randomUUID(), source: connInfo.id, sender: connInfo.sender, text: '', timestamp: Date.now() },
                classification: { primary: 'chat', confidence: 0.1, signals: [] },
                reasoningTriggered: false, lmSuggestsReasoning: false,
                directives: [], directiveResults: [], toolResults: [], actions: [],
                finalResponse: '', passCount: 0, needsLoopBack: false,
            },
            config: this.config, capabilities: this.capabilities,
            metrics: { startTime: Date.now(), stages: new Map() },
        };
    }

    // Agentic loop
    startAgenticLoop(config?: Partial<AgenticLoopConfig>): void {
        if (!this.nar) return;
        this.agenticLoop = new AgenticLoop(this, this.nar, this.episodicMemory, config);
        this.agenticLoop.setMessageHandler(async (msg) => {
            await this.processMessage(msg, async (text) => {
                const content = typeof text === 'string' ? text : text.content;
                const conn = this.connectionManager?.getConnection(msg.source);
                if (conn) await conn.send(msg.sender, content); else console.log(content);
            });
        });
        this.agenticLoop.start();
    }

    stopAgenticLoop(): void { this.agenticLoop?.stop(); }

    // Events
    on(event: string, handler: (...args: unknown[]) => void): void { this.emitter.on(event, handler); }
    off(event: string, handler: (...args: unknown[]) => void): void { this.emitter.off(event, handler); }
    private emit(event: string, ...args: unknown[]): void { this.emitter.emit(event, ...args); }

    // State persistence (symmetric save/load)
    async saveState(path?: string): Promise<void> {
        const fs = await import('fs/promises');
        await fs.writeFile(path ?? 'bot-state.json', JSON.stringify({
            conversationState: this.stateManager.serialize(),
            memory: await this.nar?.getMemoryState?.() ?? {},
            timestamp: Date.now(),
        }, null, 2));
    }

    async loadState(path?: string): Promise<void> {
        const fs = await import('fs/promises');
        const data = JSON.parse(await fs.readFile(path ?? 'bot-state.json', 'utf-8'));
        if (data.conversationState) this.stateManager.deserialize(data.conversationState);
        if (data.memory) await this.nar?.loadMemoryState?.(data.memory);
    }

    // Accessors
    getNAR(): NAR | undefined { return this.nar; }
    getCommands(): CommandRegistry { return this.commands; }
    getCapabilities(): Capabilities { return this.capabilities; }

    getSnapshot(): { turn: number; concepts: number; tasks: number; lmStatus: string; workingMemory: number } {
        const stats = this.nar?.getStatistics();
        return {
            turn: this.stateManager.getAll().size,
            concepts: stats?.totalConcepts ?? 0,
            tasks: stats?.totalTasks ?? 0,
            lmStatus: this.capabilities.hasLM ? 'available' : 'unavailable',
            workingMemory: this.nar?.workingMemory.size() ?? 0,
        };
    }
}
```

---

## AgenticLoop

```typescript
interface AgenticLoopConfig {
    maxInputTurns: number;
    sleepIntervalMs: number;
    wakeupIntervalMs: number;
    reasoningStepsPerWake: number;
    enableLMRules: boolean;
    backgroundReasoning: boolean;
}

const DEFAULT_LOOP: Required<AgenticLoopConfig> = {
    maxInputTurns: 50, sleepIntervalMs: 1000, wakeupIntervalMs: 60000,
    reasoningStepsPerWake: 5, enableLMRules: true, backgroundReasoning: true,
};

class AgenticLoop {
    private readonly config: Required<AgenticLoopConfig>;
    private readonly queue = new MessageQueue();
    private readonly bot: Bot;
    private readonly nar?: NAR;
    private readonly episodicMemory?: EpisodicMemory;
    private running = false;
    private idleCounter = 0;
    private nextWakeAt = 0;
    private currentTurn = 0;
    private onMessage?: (msg: IOMessage) => Promise<void>;

    constructor(bot: Bot, nar: NAR | undefined, episodicMemory?: EpisodicMemory, config?: Partial<AgenticLoopConfig>) {
        this.bot = bot; this.nar = nar; this.episodicMemory = episodicMemory;
        this.config = { ...DEFAULT_LOOP, ...config };
    }

    setMessageHandler(h: (msg: IOMessage) => Promise<void>): void { this.onMessage = h; }
    start(): void { if (this.running) return; this.running = true; this.nextWakeAt = Date.now() + this.config.wakeupIntervalMs; this.runLoop(); }
    stop(): void { this.running = false; }
    pushMessage(m: IOMessage): void { this.queue.push(m); }
    getStats(): { turn: number; idle: number; queue: number } { return { turn: this.currentTurn, idle: this.idleCounter, queue: this.queue.size() }; }

    private async runLoop(): Promise<void> {
        while (this.running) {
            const msgs = this.queue.drain();
            if (msgs.length) {
                this.idleCounter = 0;
                for (const m of msgs) {
                    await this.onMessage?.(m);
                    this.episodicMemory?.log({ type: 'input', input: m.text, source: m.source, sender: m.sender, timestamp: Date.now() });
                }
            } else { this.idleCounter++; }

            const now = Date.now();
            if (this.idleCounter >= this.config.maxInputTurns && now >= this.nextWakeAt) {
                await this.wakeup();
                this.nextWakeAt = now + this.config.wakeupIntervalMs;
                this.idleCounter = 0;
            }
            await new Promise(r => setTimeout(r, this.config.sleepIntervalMs));
            this.currentTurn++;
        }
    }

    private async wakeup(): Promise<void> {
        const nar = this.nar; if (!nar) return;
        if (this.config.backgroundReasoning) {
            try { await nar.run(this.config.reasoningStepsPerWake); } catch {}
            try { for (const q of (nar.getQuestions?.() ?? []).slice(0, 3)) await nar.run(this.config.reasoningStepsPerWake); } catch {}
            try { for (const g of (nar.getGoals?.() ?? []).slice(0, 2)) await nar.run(this.config.reasoningStepsPerWake); } catch {}
        }
        try { if (this.config.enableLMRules && nar.enrichMemoryWithLM) await nar.enrichMemoryWithLM(); } catch {}
        try { nar.memory?.consolidate?.(); } catch {}
        try { nar.getSelfAnalyzer?.()?.analyzeReasoningGaps?.(); } catch {}
        this.episodicMemory?.log({ type: 'wakeup', input: 'wakeup', source: 'loop', sender: 'system', timestamp: Date.now() });
    }
}
```

---

## REPL

```typescript
class REPL {
    private bot: Bot;
    private rl: readline.Interface;

    constructor(bot: Bot) { this.bot = bot; }

    async start(): Promise<void> {
        const c = this.bot.getCapabilities();
        console.log(`\n  ${this.bot.profile.name} — ${this.bot.profile.personality}\n`);
        console.log(`  Mode: ${c.mode}  LM: ${c.hasLM ? '✓' : '✗'}  SeNARS: ${c.hasSeNARS ? '✓' : '✗'}  Stream: ${c.hasStreaming ? '✓' : '✗'}`);
        console.log(`  Type /help for commands.\n`);

        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        this.rl.setPrompt('> ');

        for await (const line of this.rl) await this.processLine(line);
    }

    private async processLine(line: string): Promise<void> {
        const t = line.trim(); if (!t) return;
        process.stdout.write(`> ${t}\n`);

        let streamed = '';
        const respondFn = async (text: string | StreamChunk) => {
            if (typeof text === 'string') streamed = text;
            else if (text.type === 'text') { process.stdout.write(text.content); streamed += text.content; }
            else if (text.type === 'status' && text.content === 'typing') process.stdout.write('  bot: ');
        };

        const showTyping = this.bot.getCapabilities().hasLM && this.bot.config.tui.typingIndicator;
        const spinner = showTyping ? ora('thinking...').start() : null;

        try {
            const response = await this.bot.processMessage(
                { id: crypto.randomUUID(), source: 'cli', sender: 'user', text: t, timestamp: Date.now() },
                respondFn,
            );
            spinner?.stop();
            if (!streamed) process.stdout.write(`bot: ${response.text}\n`);
            else process.stdout.write('\n');
            this.showMetrics(response);
        } catch (e) {
            spinner?.stop();
            process.stdout.write(`\n✗ ${e instanceof Error ? e.message : String(e)}\n`);
        }
    }

    private showMetrics(r: BotResponse): void {
        if (!r.metrics) return;
        const total = Date.now() - r.metrics.startTime;
        const stages = [...r.metrics.stages.entries()].map(([n, t]) => `${n}:${t.durationMs}ms${t.error ? '✗' : ''}`).join(' ');
        process.stdout.write(`  [${total}ms | ${stages}]\n`);
    }
}
```

---

## Entry Point

```typescript
async function main() {
    const nar = new NAR({ lmClient: undefined, enableLMRules: true, enableTools: true });

    const lm = await createLMClient({
        provider: 'anthropic', model: 'claude-sonnet-4-20250514',
        fallback: ['ollama/llama3.1:8b', 'transformersjs/Qwen2.5-1.5B'],
    }).catch(() => undefined);

    if (lm) nar.setLMClient(lm);

    const bot = new Bot({
        profile: { name: 'SeNARS', personality: 'A reasoning-focused AI assistant.' },
        lm, nar, episodicMemory: new EpisodicMemory(),
    });

    const connManager = new ConnectionManager(createLogger({ scope: 'connections' }));
    bot.setConnectionManager(connManager);

    for (const { type, ctor } of [
        { type: 'cli', ctor: CLIConnection }, { type: 'irc', ctor: IRCConnection },
        { type: 'websocket', ctor: WSConnection }, { type: 'http', ctor: HTTPConnection },
        { type: 'mcp', ctor: MCPConnection },
    ]) connManager.registerFactory({ type, create: (cfg, deps) => new ctor(cfg, deps) });

    new REPL(bot).start();
    bot.startAgenticLoop({ backgroundReasoning: true });
}
```

---

## Data Flow

```
Pass 1:
  InputNormalizer → AuthChecker → CommandProcessor → InputClassifier
  → ReasoningTrigger → SeNARSProcessor (processes input, tracks newBeliefs)
  → LMResponder (sees newBeliefs in prompt, generates response)
  → DirectiveProcessor (extracts [BELIEVE:]/[QUESTION:]/[TOOL:], executes, strips markers)
    → If believe/question → needsLoopBack = true

Pass 2 (only if needsLoopBack):
  SeNARSProcessor (passCount=2 → skips input, runs nar.run() on directive-injected beliefs)
  → LMResponder (sees new derivations, generates updated response)
  → DirectiveProcessor (no new directives → needsLoopBack stays false)

Final:
  → ResponseComposer → ResponseFormatter → StatePersistor
```

Properties:
1. SeNARS before LM — LM always sees current derivations
2. Loop-back bounded — `maxLoops` caps passes, `needsLoopBack` is a simple boolean
3. No double-processing — `passCount > 1` skips input injection
4. Single marker stripping — `DirectiveProcessor` owns it
5. DRY context — `LMResponder` uses `getContextForLM()`
6. Tool results feed NAR — tool output with `narsese` field is believed immediately

---

## Interaction Examples

### Full Mode with Loop-Back

```
> If all mammals are warm-blooded and whales are mammals, are whales warm-blooded?

  ⏳ thinking...
  → reasoning triggered: multi-hop pattern detected
  → derived: 2 beliefs
    → (<whale --> warm_blooded>. :0.9:0.7)

  bot: Yes — whales are warm-blooded. This follows from the syllogism.

  [42ms | InputNormalizer:1ms AuthChecker:2ms SeNARSProcessor:18ms LMResponder:12ms DirectiveProcessor:1ms]
```

### LM Controls Reasoning Depth

```
> Explain the causal chain of climate change impacts

  bot: Climate change impacts cascade through ecological systems. [REASONING_DEPTH:10]
       Rising temperatures affect...

  (internally: [REASONING_DEPTH:10] sets maxStepsPerTrigger=10 for next derivation pass)
```

### Custom Directive Extension

```typescript
const bot = new Bot({
    profile: { name: 'SeNARS', personality: 'A reasoning assistant.' },
    nar, lm,
    directives: {
        builtIn: true,
        custom: [{
            pattern: /\[GROUND:\s*([^\]]+)\]/gi,
            type: 'ground',
            extract: (m) => ({ content: m[1]!.trim() }),
            execute: async (nar, content) => {
                const results = await braveSearch(content);
                for (const r of results.slice(0, 3)) await nar.believe(r.toNarsese());
                return `${results.length} facts grounded`;
            },
            triggersLoopBack: true,
        }],
    },
});
```

### Prompt Template Customization

```typescript
const bot = new Bot({
    profile: { name: 'SeNARS', personality: 'A reasoning assistant.' },
    nar, lm,
    prompts: {
        system: `You are {{name}}. {{personality}}\n\n{{context}}\n\n{{directives}}\n\n{{guidelines}}\n\n{{history}}\n\nuser: {{input}}`,
        directiveInstructions: 'Use [BELIEVE:] to add facts, [QUESTION:] to query, [TOOL:] to compute.',
        responseGuidelines: '- Be technical and precise\n- Cite belief truth values',
    },
});
```

### Chat-Only Preset (No SeNARS)

```typescript
const bot = new Bot({
    profile: { name: 'ChatBot', personality: 'A friendly conversational assistant.' },
    lm,
    config: { pipeline: { preset: 'chat' } },
});
```

### Reasoning-Only Preset (No LM)

```typescript
const bot = new Bot({
    profile: { name: 'SeNARS', personality: 'A formal reasoning engine.' },
    nar,
    config: { pipeline: { preset: 'reasoning' } },
});
```

### SeNARS-Only Mode

All 13 modules registered. Commands receive full `BotContext` (real connection, no fake stubs).

| Module | Commands | Requires |
|---|---|---|
| `core.ts` | `/help`, `/status`, `/quit`, `/commands` | — |
| `connection.ts` | `/connect`, `/disconnect`, `/connections` | — |
| `memory.ts` | `/beliefs`, `/concepts`, `/pin`, `/recall`, `/unpin`, `/forget` | SeNARS |
| `nar.ts` | `/run [n]`, `/input <narsese>`, `/goal <narsese>`, `/question <narsese>`, `/trace` | SeNARS |
| `self.ts` | `/self.analyze`, `/self.propose`, `/self.apply`, `/self.status` | Full |
| `lm.ts` | `/lm.status`, `/lm.enrich`, `/lm.model <name>`, `/lm.stream on|off` | LM |
| `rlfp.ts` | RLFP learning commands | SeNARS |
| `auth.ts` | `/auth.bind`, `/auth.unbind`, `/auth.list` | — |
| `config.ts` | `/config.get`, `/config.set`, `/config.reset`, `/config.diff` | — |
| `scenario.ts` | `/scenario.run`, `/scenario.list`, `/scenario.run-batch` | SeNARS |
| `benchmark.ts` | Benchmark commands | SeNARS |
| `experiment.ts` | `/experiment.create`, `/experiment.run`, `/experiment.list`, `/experiment.results` | Full |
| `episodes.ts` | `/episodes`, `/episodes.recent`, `/episodes.search <query>` | — |

---

## File Structure

```
src/
├── bot/
│   ├── Bot.ts                    # Thin orchestrator
│   ├── BotContext.ts             # All types (no duplicates)
│   ├── ConversationState.ts      # Per-sender state + manager
│   ├── AgenticLoop.ts            # Background reasoning
│   ├── pipeline/
│   │   ├── Pipeline.ts           # MessagePipeline with loop-back
│   │   └── stages/
│   │       ├── InputNormalizer.ts
│   │       ├── AuthChecker.ts
│   │       ├── CommandProcessor.ts
│   │       ├── InputClassifier.ts
│   │       ├── ReasoningTrigger.ts
│   │       ├── SeNARSProcessor.ts
│   │       ├── LMResponder.ts
│   │       ├── DirectiveProcessor.ts   # NEW — replaces ToolExecutor
│   │       ├── ResponseComposer.ts
│   │       ├── ResponseFormatter.ts
│   │       └── StatePersistor.ts
│   ├── streaming/                # Reuse existing
│   │   ├── types.ts
│   │   ├── LMStreamAdapter.ts
│   │   └── ChannelStreamer.ts
│   ├── tui/
│   │   └── REPL.ts
│   └── index.ts
├── nar/                          # Unchanged
├── io/                           # Unchanged
│   ├── connection-manager.ts
│   ├── commands/                 # All 13 modules
│   └── connections/
└── cli/
    └── repl.ts
```

### Removed

| File | Reason |
|---|---|
| `src/agent/Agent.ts` | Replaced by `Bot` |
| `src/agent/Bot.ts` (old) | Replaced by unified `Bot` |
| `src/agent/ChatResponder.ts` | Merged into `LMResponder` |
| `src/agent/ResponseInterpreter.ts` | Merged into `DirectiveProcessor` |
| `src/agent/ConversationManager.ts` | Replaced by `ConversationState` |
| `src/agent/DegradationManager.ts` | `enabled()` predicates handle degradation |
| `src/agent/LastResults.ts` | Replaced by episodic memory |
| `src/agent/ResponseFormatter.ts` (agent-level) | Replaced by pipeline stage |
| `src/agent/ChannelBehavior.ts` | Merged into `ResponseFormatter` |
| `src/agent/pipeline/stages/ToolExecutor.ts` | Replaced by `DirectiveProcessor` |

---

## Degradation

No `DegradationManager`. Stages self-check via `enabled()`:

```
LM unavailable:
  LMResponder.enabled → false (skipped)
  DirectiveProcessor.enabled → false (no lmResponse)
  ResponseComposer → fallback without LM text

SeNARS unavailable:
  ReasoningTrigger.enabled → false (skipped)
  SeNARSProcessor.enabled → false (skipped)
  DirectiveProcessor → runs but all directives fail with "SeNARS not available"
  LMResponder → responds normally
```

---

## Type Migration (BotContext.ts changes)

1. **Remove duplicate `IOMessage`** — use `io/types.ts` readonly version
2. **Remove duplicate `Capabilities`** — keep single definition
3. **Add `pipeline` to `BotConfig`**: `{ maxLoops: number; stageTimeoutMs: number }`
4. **Add to `TurnState`**: `passCount: number`, `needsLoopBack: boolean`, `directives: LMDirective[]`, `directiveResults: DirectiveResult[]`
5. **Add `newBeliefs` to `DerivationResult`**
6. **Add types**: `LMDirective`, `DirectiveResult`, `TurnMetrics`
7. **Add `metrics` to `BotContext` and `BotResponse`**
8. **Add `pipeline` to default config** with `maxLoops: 2`, `stageTimeoutMs: 30000`
9. **Set `streaming.enabled = true`** in defaults

---

## Testing

```typescript
describe('DirectiveProcessor', () => {
    it('extracts BELIEVE directives', () => {
        const d = extractDirectives('Hello [BELIEVE: (<X --> Y>.)] world');
        assert.equal(d.length, 1); assert.equal(d[0].type, 'believe');
    });
    it('triggers loop-back on believe', async () => {
        const ctx = fullCtx(); ctx.turn.lmResponse = '[BELIEVE: (<X --> Y>. :1.0:0.9)]';
        await new DirectiveProcessor().execute(ctx);
        assert.isTrue(ctx.turn.needsLoopBack);
    });
    it('does not run on plain response', () => {
        const ctx = fullCtx(); ctx.turn.lmResponse = 'Hello world';
        assert.isFalse(new DirectiveProcessor().enabled(ctx));
    });
});

describe('SeNARSProcessor', () => {
    it('skips input on loop-back', async () => {
        const ctx = fullCtx(); ctx.turn.passCount = 2;
        ctx.turn.input.text = '(<a --> b>.)';
        const before = ctx.seNARS.getBeliefs().length;
        await new SeNARSProcessor().execute(ctx);
        assert.equal(ctx.seNARS.getBeliefs().length, before); // no new belief added
    });
    it('counts only new beliefs as steps', async () => {
        const ctx = fullCtx();
        await new SeNARSProcessor().execute(ctx);
        assert.equal(ctx.turn.reasoningResult.steps, ctx.turn.reasoningResult.newBeliefs.length);
    });
});

describe('LMResponder', () => {
    it('detects REASONING_SUGGESTED before stripping', async () => {
        const ctx = fullCtx();
        ctx.lm!.generateText = async () => 'Hello [REASONING_SUGGESTED: causal] world';
        await new LMResponder().execute(ctx);
        assert.isTrue(ctx.turn.lmSuggestsReasoning);
        assert.equal(ctx.turn.lmResponse, 'Hello world');
    });
    it('does not strip directive markers', async () => {
        const ctx = fullCtx();
        ctx.lm!.generateText = async () => 'Hello [BELIEVE: (<X --> Y>.)] world';
        await new LMResponder().execute(ctx);
        assert.match(ctx.turn.lmResponse, /\[BELIEVE:/); // still present
    });
});

describe('Pipeline loop-back', () => {
    it('exits after maxLoops', async () => {
        const ctx = fullCtx(); ctx.config.pipeline.maxLoops = 2;
        ctx.lm!.generateText = async () => '[BELIEVE: (<X --> Y>.)]';
        await pipeline.process(msg, ctx);
        assert.ok(ctx.turn.passCount <= 2);
    });
    it('does not double-process input', async () => {
        const ctx = fullCtx(); ctx.config.pipeline.maxLoops = 2;
        ctx.lm!.generateText = async () => '[BELIEVE: (<X --> Y>.)]';
        const before = ctx.seNARS.getBeliefs().length;
        await pipeline.process({ text: '(<a --> b>.)', ...msg }, ctx);
        // Input belief added exactly once
        assert.ok(ctx.seNARS.getBeliefs().length <= before + 1);
    });
});
```

---

## Design Decisions

| Decision | Why |
|---|---|
| `needsLoopBack` boolean, not counter | Simpler — pipeline controls max passes via `passCount < maxLoops` |
| `passCount` for input skip | `passCount > 1` is clearer than a separate `inputProcessed` flag |
| DirectiveProcessor owns marker stripping | Single responsibility — LMResponder only checks REASONING_SUGGESTED |
| Reuse LMStreamAdapter + ChannelStreamer | Existing infrastructure handles native/simulated/channel-specific streaming |
| Commands get full BotContext | No fake Connection stubs needed |
| Symmetric save/load | `loadState()` restores what `saveState()` persisted |
| AuthChecker periodic cleanup | Prevents unbounded memory growth |
| NL-to-Narsese word-boundary anchoring | Prevents false matches on longer sentences |
| Streaming default ON | Real-time feedback expected |
| Pipeline, not switch | Composable, testable, independently replaceable stages |
| Pipeline presets | Common configurations without boilerplate |
| Custom directives via config | Extensible without modifying core code |
| Prompt templates | Customize LM behavior without code changes |
| `loopBackOn` array | Fine-grained control over which directives trigger re-processing |
| `[REASONING_DEPTH:n]` directive | LM controls derivation effort per-turn |
| `lmDriven` flag | Opt-in for LM reasoning depth control (default off) |
