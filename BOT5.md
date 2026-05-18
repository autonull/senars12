# BOT5.md — Unified Bot Architecture

## Vision

A single, fully-wired bot class that replaces both `Agent` and `Bot`. The pipeline supports bidirectional NAR↔LM interaction within a single turn, with bounded loop-back for LM directives. All entry points (REPL, IRC, WS, HTTP, MCP) use the same processing path.

No dead code. No duplicate state. No unidirectional assumptions.

---

## Architecture Principles

1. **Single orchestrator** — One `Bot` class, pipeline-based, wired to all connections
2. **Bidirectional turn** — SeNARS runs first, LM sees results, LM directives loop back to SeNARS
3. **Unified state** — One `ConversationState` per sender, replaces `ConversationManager` + `ChatResponder.history`
4. **Streaming by default** — Enabled for all channels that support it
5. **Loop-bounded** — Directive loop-back resets counter each iteration; `maxLoops` caps total passes
6. **Observability built-in** — Per-stage timing, derivation tracing, error context
7. **DRY context building** — `LMResponder` uses `ConversationState.getContextForLM()` instead of duplicating logic

---

## Simplified Stage Pipeline

```
InputNormalizer → AuthChecker → CommandProcessor* → InputClassifier
  → ReasoningTrigger → SeNARSProcessor → LMResponder
  → DirectiveProcessor ↻ (loop-back, resets each pass, max 2 total)
  → ResponseComposer → ResponseFormatter → StatePersistor

* CommandProcessor: early exit, skips remaining stages
```

### Stage Order and Rationale

| # | Stage | Why Here |
|---|---|---|
| 1 | `InputNormalizer` | Always first — clean input before anything else |
| 2 | `AuthChecker` | Always second — reject before processing |
| 3 | `CommandProcessor` | Early exit for `/` commands — no reasoning needed |
| 4 | `InputClassifier` | Must run before reasoning decisions |
| 5 | `ReasoningTrigger` | Decides if SeNARS should activate |
| 6 | `SeNARSProcessor` | Runs NAL operations first — produces beliefs LM can reference |
| 7 | `LMResponder` | Generates with SeNARS results in system prompt |
| 8 | `DirectiveProcessor` | Extracts `[BELIEVE:]`, `[QUESTION:]`, `[TOOL:]` from LM output, executes against NAR, optionally requests loop-back |
| 9 | `ResponseComposer` | Merges all results with actual belief content |
| 10 | `ResponseFormatter` | Channel-specific formatting |
| 11 | `StatePersistor` | Logs to episodic memory |

### Key Change from BOT4: DirectiveProcessor Replaces ToolExecutor

BOT4 had `ToolExecutor` as a separate stage that only handled `[TOOL:...]`. BOT5 unifies all LM directives into `DirectiveProcessor`, which:
- Handles `[BELIEVE:...]`, `[QUESTION:...]`, `[TOOL:...]` in one place
- Feeds `[BELIEVE:]` and `[QUESTION:]` back into SeNARS (loop-back)
- Bounded by `maxLoops` (default 2) to prevent infinite cycles
- Each loop iteration re-runs `SeNARSProcessor` → `LMResponder` → `DirectiveProcessor`

---

## Core Types

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
        maxLoops: number;           // Max directive loop-back iterations per turn
        stageTimeoutMs: number;     // Per-stage execution timeout
    };
    tui: {
        typingIndicator: boolean;
        colors: boolean;
        compactMode: boolean;
        statusBar: boolean;
    };
}
```

### Default Config

```typescript
const DEFAULT_BOT_CONFIG: BotConfig = {
    reasoning: {
        autoTrigger: true,
        triggerThreshold: 0.5,
        triggerCooldown: 3,
        maxStepsPerTrigger: 5,
        backgroundReasoning: true,
        backgroundIntervalMs: 60000,
    },
    streaming: {
        enabled: true,              // Default ON
        showReasoningSteps: true,
        showToolCalls: true,
    },
    conversation: {
        maxHistory: 20,
        summaryThreshold: 30,
        maxArtifacts: 50,
    },
    pipeline: {
        maxLoops: 2,
        stageTimeoutMs: 30000,
    },
    tui: {
        typingIndicator: true,
        colors: true,
        compactMode: false,
        statusBar: true,
    },
};
```

### TurnState

```typescript
interface TurnState {
    input: IOMessage;
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
    loopCount: number;              // Current loop-back iteration (reset each pass)
}
```

### DerivationResult

```typescript
interface DerivationResult {
    steps: number;          // Number of derivation steps executed
    beliefs: Belief[];      // All beliefs after derivation
    newBeliefs: Belief[];   // Only beliefs added/changed this pass
}
```

### LMDirective

```typescript
interface LMDirective {
    type: 'believe' | 'question' | 'tool_call';
    name: string;           // Tool name for tool_call, empty for believe/question
    content: string;        // Narsese string or tool args
    raw: string;            // Original directive text
}
```

### DirectiveResult

```typescript
interface DirectiveResult {
    directive: LMDirective;
    success: boolean;
    result?: unknown;
    error?: string;
    derivationSteps?: number;
}
```

### TurnMetrics

```typescript
interface TurnMetrics {
    startTime: number;
    stages: Map<string, StageTiming>;
}

interface StageTiming {
    durationMs: number;
    error?: string;
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

---

## MessagePipeline with Loop-Back

**CRITICAL FIX from BOT4**: The loop counter must be reset at the start of each iteration. `DirectiveProcessor` increments it to request another pass. The `do...while` loop continues only while `loopCount > 0`.

```typescript
class MessagePipeline {
    private stages: PipelineStage[];
    private loopStages: Set<string>;

    constructor(stages: PipelineStage[], loopStageNames: string[] = ['SeNARSProcessor', 'LMResponder', 'DirectiveProcessor']) {
        this.stages = stages.sort((a, b) => a.priority - b.priority);
        this.loopStages = new Set(loopStageNames);
    }

    async process(message: IOMessage, ctx: BotContext): Promise<BotResponse> {
        ctx.turn.input = message;
        ctx.turn.loopCount = 0;
        ctx.metrics = { startTime: Date.now(), stages: new Map() };

        const maxLoops = ctx.config.pipeline.maxLoops;
        let passCount = 0;

        do {
            // FIX: Reset loopCount at start of each pass.
            // DirectiveProcessor will increment if it needs another pass.
            ctx.turn.loopCount = 0;
            passCount++;

            for (const stage of this.stages) {
                if (!stage.enabled(ctx)) continue;
                // On loop-back passes, skip non-loop stages
                if (passCount > 1 && !this.loopStages.has(stage.name)) continue;

                const start = Date.now();
                try {
                    await this.executeWithTimeout(stage, ctx, ctx.config.pipeline.stageTimeoutMs);
                } catch (error) {
                    ctx.turn.error = error as Error;
                    ctx.metrics.stages.set(stage.name, { durationMs: Date.now() - start, error: String(error) });
                    ctx.turn.finalResponse = this.generateErrorResponse(error, ctx);
                    break;
                }
                ctx.metrics.stages.set(stage.name, { durationMs: Date.now() - start });

                if (ctx.turn.finalResponse && stage.name === 'CommandProcessor') {
                    return this.composeResponse(ctx);
                }
            }

            if (ctx.turn.error) break;
            // Continue only if DirectiveProcessor requested another pass
        } while (ctx.turn.loopCount > 0 && passCount <= maxLoops);

        return this.composeResponse(ctx);
    }

    private async executeWithTimeout(stage: PipelineStage, ctx: BotContext, timeoutMs: number): Promise<void> {
        await Promise.race([
            stage.execute(ctx),
            new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`Stage ${stage.name} timed out after ${timeoutMs}ms`)), timeoutMs)
            ),
        ]);
    }

    private composeResponse(ctx: BotContext): BotResponse {
        return {
            text: ctx.turn.finalResponse,
            reasoning: ctx.turn.reasoningResult,
            actions: ctx.turn.actions,
            metrics: ctx.metrics,
        };
    }

    private generateErrorResponse(error: unknown, ctx: BotContext): string {
        if (error instanceof Error) {
            if (error.message.includes('LM') || (error.message.includes('timeout') && ctx.capabilities.hasSeNARS)) {
                return 'LM is currently unavailable. I can still process Narsese input and commands.';
            }
            if (error.message.includes('SeNARS') || error.message.includes('NAR')) {
                return 'Reasoning engine is unavailable. Chat mode is still active.';
            }
            return `An error occurred: ${error.message}`;
        }
        return 'An unknown error occurred';
    }
}
```

### Loop-Back Mechanics

```
Pass 1 (normal):
  ctx.turn.loopCount = 0  (reset)
  All stages run in order
  DirectiveProcessor executes directives
  If believe/question directive found → ctx.turn.loopCount = 1

Pass 2 (loop-back, only if loopCount > 0):
  ctx.turn.loopCount = 0  (reset again)
  Only SeNARSProcessor, LMResponder, DirectiveProcessor run
  DirectiveProcessor finds no more directives → loopCount stays 0
  Loop exits

Pass 3 (would be loop-back 2, only if maxLoops >= 3):
  Only if DirectiveProcessor in pass 2 also set loopCount = 1
```

---

## PipelineStage Interface

```typescript
interface PipelineStage {
    name: string;
    priority: number;
    enabled: (ctx: BotContext) => boolean;
    execute(ctx: BotContext): Promise<void>;
}
```

---

## Stage Specifications

### 1. InputNormalizer

**FIX**: `IOMessage` fields are `readonly` in `io/types.ts`. We work on a mutable copy stored in `ctx.turn.input`.

```typescript
class InputNormalizer implements PipelineStage {
    name = 'InputNormalizer';
    priority = 1;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        // Create mutable copy since IOMessage fields are readonly
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
    name = 'AuthChecker';
    priority = 2;
    enabled = () => true;

    private rateLimit = new Map<string, number[]>();

    async execute(ctx: BotContext): Promise<void> {
        const key = `${ctx.connection.id}:${ctx.connection.sender}`;
        const now = Date.now();
        const window = (this.rateLimit.get(key) ?? []).filter(t => now - t < 60_000);
        if (window.length >= 30) {
            ctx.turn.finalResponse = 'Rate limited. Please wait.';
            return;
        }
        window.push(now);
        this.rateLimit.set(key, window);
    }
}
```

### 3. CommandProcessor

```typescript
class CommandProcessor implements PipelineStage {
    name = 'CommandProcessor';
    priority = 3;
    enabled = (ctx) => ctx.turn.input.text.startsWith('/');

    constructor(private registry: CommandRegistry) {}

    async execute(ctx: BotContext): Promise<void> {
        const text = ctx.turn.input.text.trim();
        const parts = text.slice(1).split(/\s+/);
        const cmdName = '/' + parts[0]!;
        const args = parts.slice(1);

        const cmd = this.registry.get(cmdName);
        if (!cmd) {
            ctx.turn.finalResponse = `Unknown command: ${cmdName}. Type /help for available commands.`;
            return;
        }

        if (cmd.requiresLM && !ctx.capabilities.hasLM) {
            ctx.turn.finalResponse = `Command ${cmdName} requires LM (not available).`;
            return;
        }
        if (cmd.requiresSeNARS && !ctx.capabilities.hasSeNARS) {
            ctx.turn.finalResponse = `Command ${cmdName} requires SeNARS (not available).`;
            return;
        }

        const result = await cmd.handler(args, ctx);
        ctx.turn.finalResponse = typeof result === 'string' ? result : await this.streamToString(result);
    }

    private async streamToString(stream: AsyncIterable<{ content: string }>): Promise<string> {
        let result = '';
        for await (const chunk of stream) result += chunk.content;
        return result;
    }
}
```

### 4. InputClassifier

Multi-signal weighted classification. Replaces punctuation-only approach.

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

const NARSESE_REGEX = /^\s*\(\s*<[^>]+>\s*(-->|<->|==>|<=>|&&|\|\|)\s*/;

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

    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const primary = sorted[0] as [Intent, number];
    const secondary = sorted[1][1] > primary[1] - 0.2 ? sorted[1][0] as Intent : undefined;

    return { primary: primary[0], secondary, confidence: Math.min(primary[1], 1.0), signals };
}

class InputClassifier implements PipelineStage {
    name = 'InputClassifier';
    priority = 4;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        ctx.turn.classification = classify(ctx.turn.input.text, ctx.conversation);
    }
}
```

### 5. ReasoningTrigger

Hybrid heuristic + LM signal scoring with cooldown.

```typescript
class ReasoningTriggerCore {
    private cooldown = 0;
    private readonly config = {
        heuristicWeight: 0.6,
        lmSignalWeight: 0.4,
        threshold: 0.5,
        cooldownTurns: 3,
        maxStepsPerTrigger: 5,
    };

    shouldTrigger(ctx: BotContext): { activate: boolean; confidence: number; reason?: string; suggestedSteps?: number } {
        if (this.cooldown > 0) { this.cooldown--; return { activate: false, confidence: 0, reason: 'cooldown' }; }
        if (!ctx.capabilities.hasSeNARS) return { activate: false, confidence: 0, reason: 'unavailable' };
        if (ctx.conversation.mode === 'chat') return { activate: false, confidence: 0, reason: 'chat-mode' };

        const heuristicScore = this.evaluateHeuristics(ctx);
        const lmScore = ctx.conversation.messages.at(-1)?.role === 'assistant' &&
            ctx.conversation.messages.at(-1)!.metadata?.suggestsReasoning ? 0.7 : 0;
        const combined = (heuristicScore * this.config.heuristicWeight) + (lmScore * this.config.lmSignalWeight);

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

    private detectKnowledgeGap(input: string, ctx: BotContext): boolean {
        if (!ctx.seNARS) return false;
        const report = ctx.seNARS.attentionReport();
        const terms = input.match(/\b[a-z]+\b/g) ?? [];
        return terms.some(t => t.length > 3 && !report.concepts.some((c: { term: string }) => c.term.toLowerCase().includes(t)));
    }

    private detectContradiction(input: string, ctx: BotContext): boolean {
        if (!ctx.seNARS) return false;
        const beliefs = ctx.seNARS.getBeliefs();
        const negations = ['not', "n't", 'no', 'never', 'false', 'wrong'];
        if (!negations.some(n => input.includes(n))) return false;
        const terms = input.match(/\b[a-z]+\b/g) ?? [];
        return terms.some((t: string) => t.length > 3 && beliefs.some((b: { term: { toString(): string } }) => b.term.toString().toLowerCase().includes(t)));
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

class ReasoningTriggerStage implements PipelineStage {
    name = 'ReasoningTrigger';
    priority = 5;
    enabled = (ctx) => ctx.capabilities.hasSeNARS && ctx.conversation.mode === 'auto';

    constructor(private trigger = new ReasoningTriggerCore()) {}

    async execute(ctx: BotContext): Promise<void> {
        const decision = this.trigger.shouldTrigger(ctx);
        ctx.turn.reasoningTriggered = decision.activate;
    }
}
```

### 6. SeNARSProcessor

Runs NAL operations. Produces `DerivationResult` with `newBeliefs` (before/after diff) for LM context.

**FIX**: `steps` counts only *new* beliefs derived, not total beliefs.

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
        const beforeBeliefs = new Set(nar.getBeliefs().map(b => this.beliefKey(b)));

        switch (classification.primary) {
            case 'narsese':
                await this.handleNarseseInput(nar, text);
                break;
            case 'goal':
                await nar.goal(text.slice(1));
                break;
            case 'query':
                await nar.question(text);
                await nar.run(5);
                break;
            default:
                if (ctx.turn.reasoningTriggered) {
                    const narseseInput = this.naturalLanguageToNarsese(text);
                    if (narseseInput) await nar.believe(narseseInput);
                    await nar.run(ctx.config.reasoning.maxStepsPerTrigger);
                }
                break;
        }

        const allBeliefs = nar.getBeliefs();
        const newBeliefs = allBeliefs.filter(b => !beforeBeliefs.has(this.beliefKey(b)));

        ctx.turn.reasoningResult = {
            steps: newBeliefs.length,       // FIX: count new beliefs, not total
            beliefs: this.toBeliefs(allBeliefs),
            newBeliefs: this.toBeliefs(newBeliefs),
        };
    }

    private async handleNarseseInput(nar: NAR, text: string): Promise<void> {
        if (text.startsWith('!')) {
            await nar.goal(text.slice(1));
        } else if (text.includes('?')) {
            await nar.question(text);
            await nar.run(5);
        } else {
            await nar.believe(text);
            await nar.run(3);
        }
    }

    private naturalLanguageToNarsese(text: string): string | null {
        // "X is a Y" → (<X --> Y>.)
        const isAMatch = text.match(/^([A-Za-z_]+)\s+is\s+a\s+([A-Za-z_]+)/i);
        if (isAMatch) return `(<${isAMatch[1]} --> ${isAMatch[2]}>.)`;

        // "X has Y" → (<X --> [has_Y]>.)
        const hasMatch = text.match(/^([A-Za-z_]+)\s+has\s+([A-Za-z_]+)/i);
        if (hasMatch) return `(<${hasMatch[1]} --> [has_${hasMatch[2]}]>.)`;

        // "X is Y" (property) → (<X --> [Y]>.)
        const isMatch = text.match(/^([A-Za-z_]+)\s+is\s+([A-Za-z_]+)/i);
        if (isMatch) return `(<${isMatch[1]} --> [${isMatch[2]}]>.)`;

        // "X implies Y" → ((<X> ==> <Y>).)
        const impliesMatch = text.match(/^([A-Za-z_]+)\s+(?:implies|means|leads to)\s+([A-Za-z_]+)/i);
        if (impliesMatch) return `((<${impliesMatch[1]}> ==> <${impliesMatch[2]}>).)`;

        // "X is not Y" → (<X --> [Y]>. :0.0:0.9)
        const notMatch = text.match(/^([A-Za-z_]+)\s+is\s+not\s+([A-Za-z_]+)/i);
        if (notMatch) return `(<${notMatch[1]} --> [${notMatch[2]}]>. :0.0:0.9)`;

        return null;
    }

    private beliefKey(b: { term: { toString(): string }; truth?: { f: number; c: number } }): string {
        return `${b.term.toString()}:${b.truth?.f ?? 0}:${b.truth?.c ?? 0}`;
    }

    private toBeliefs(tasks: { term: { toString(): string }; truth?: { f: number; c: number } }[]): Belief[] {
        return tasks.map(t => ({
            term: t.term.toString(),
            truth: t.truth ? { frequency: t.truth.f, confidence: t.truth.c } : undefined,
        }));
    }
}
```

### 7. LMResponder

Generates LM response with SeNARS results in system prompt. Supports streaming.

**FIXES**:
1. Check for `[REASONING_SUGGESTED:]` in the **original** response before cleaning
2. Use `ConversationState.getContextForLM()` instead of duplicating context building
3. `LMClient` has no `.stream()` method — use simulated word-by-word streaming as fallback

```typescript
class LMResponder implements PipelineStage {
    name = 'LMResponder';
    priority = 7;
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

        // FIX: Check for reasoning suggestion BEFORE stripping markers
        const original = ctx.turn.lmResponse || '';
        ctx.turn.lmSuggestsReasoning = /\[REASONING_SUGGESTED:/.test(original);

        // Strip all markers from visible response
        ctx.turn.lmResponse = this.stripMarkers(original);
    }

    private async streamResponse(ctx: BotContext, lm: LMClient, prompt: string): Promise<void> {
        await ctx.connection.respond({ type: 'status', content: 'typing', done: false });

        let fullResponse = '';
        try {
            // LMClient has no .stream() — simulate word-by-word
            const text = await lm.generateText(prompt);
            const tokens = text.split(/(\s+)/);
            for (const token of tokens) {
                if (token) {
                    fullResponse += token;
                    await ctx.connection.respond({ type: 'text', content: token, done: false });
                }
            }
        } catch (error) {
            await ctx.connection.respond({ type: 'error', content: `Stream interrupted: ${error instanceof Error ? error.message : String(error)}`, done: true });
            if (fullResponse.length === 0) {
                ctx.turn.lmResponse = this.generateFallback(ctx);
                return;
            }
        }

        ctx.turn.lmResponse = fullResponse;
    }

    private buildPrompt(ctx: BotContext): string {
        const parts: string[] = [];

        parts.push(`You are ${ctx.profile.name}. ${ctx.profile.personality}`);

        // Use ConversationState.getContextForLM() for NAR context (DRY)
        if (ctx.capabilities.hasSeNARS && ctx.seNARS) {
            const narContext = ctx.conversation.getContextForLM(10, ctx.seNARS);
            if (narContext) {
                parts.push('\n## Knowledge Context');
                parts.push(narContext);
            }

            // Current turn derivations (not in getContextForLM)
            if (ctx.turn.reasoningResult?.newBeliefs?.length) {
                parts.push('\n## Just Derived This Turn');
                for (const b of ctx.turn.reasoningResult.newBeliefs.slice(0, 5)) {
                    const tv = b.truth ? ` :${b.truth.frequency.toFixed(1)}:${b.truth.confidence.toFixed(1)}` : '';
                    parts.push(`(<${b.term}>.${tv})`);
                }
            }
        }

        // Directive instructions
        if (ctx.capabilities.hasSeNARS) {
            parts.push('\n## Directives');
            parts.push('If you want the reasoning engine to add a belief, include:');
            parts.push('  [BELIEVE: (<term --> category>. :frequency:confidence)]');
            parts.push('If you want it to answer a question:');
            parts.push('  [QUESTION: (<term --> ?>.)]');
            parts.push('If you want to use a tool:');
            parts.push('  [TOOL:toolName(arg1, arg2)]');
            parts.push('These markers are stripped from visible output.');

            parts.push('\n## Reasoning Suggestions');
            parts.push('If the user\'s question would benefit from formal logical reasoning, include:');
            parts.push('  [REASONING_SUGGESTED: brief reason]');
            parts.push('Examples: causal questions, logical puzzles, comparisons, contradictions.');
            parts.push('Do NOT include this for simple factual questions or casual conversation.');
        }

        parts.push('\n## Response Guidelines');
        parts.push('- Be concise and direct');
        parts.push('- When uncertain, acknowledge uncertainty');
        parts.push('- Don\'t fabricate facts — if unsure, say so');
        parts.push('- Ground responses in the reasoning context above when available');

        // Conversation history
        const history = ctx.conversation.getHistory(ctx.config.conversation.maxHistory);
        if (history.length > 0) {
            parts.push('\n## Recent Conversation');
            for (const m of history) {
                parts.push(`${m.role}: ${m.content}`);
            }
        }

        // Current user input
        parts.push(`\nuser: ${ctx.turn.input.text}`);

        return parts.join('\n');
    }

    private stripMarkers(text: string): string {
        return text
            .replace(/\[REASONING_SUGGESTED:[^\]]*\]\s*/g, '')
            .replace(/\[BELIEVE:[^\]]*\]\s*/g, '')
            .replace(/\[QUESTION:[^\]]*\]\s*/g, '')
            .replace(/\[TOOL:[^\]]*\]\s*/g, '')
            .trim();
    }

    private generateFallback(ctx: BotContext): string {
        return ctx.capabilities.hasSeNARS
            ? 'I had trouble generating a response, but the reasoning engine processed your input.'
            : "I'm having trouble generating a response right now.";
    }
}
```

### 8. DirectiveProcessor (NEW — replaces ToolExecutor)

Extracts all LM directives, executes them, and triggers loop-back for believe/question directives.

```typescript
class DirectiveProcessor implements PipelineStage {
    name = 'DirectiveProcessor';
    priority = 8;
    // FIX: Enable when there's an LM response. SeNARS is needed for execution,
    // but we check that inside execute() for better error messages.
    enabled = (ctx) => !!ctx.turn.lmResponse;

    async execute(ctx: BotContext): Promise<void> {
        const directives = this.extractDirectives(ctx.turn.lmResponse!);
        if (directives.length === 0) return;

        ctx.turn.directives = directives;

        // All directives require SeNARS
        if (!ctx.seNARS) {
            ctx.turn.directiveResults = directives.map(d => ({
                directive: d,
                success: false,
                error: 'SeNARS not available',
            }));
            return;
        }

        const nar = ctx.seNARS;
        let needsLoopBack = false;

        for (const directive of directives) {
            const result = await this.executeDirective(nar, directive);
            ctx.turn.directiveResults.push(result);
            ctx.turn.actions.push({
                type: directive.type,
                content: directive.content,
                result: result.success ? String(result.result) : result.error,
            });

            if (directive.type === 'believe' || directive.type === 'question') {
                needsLoopBack = true;
            }

            if (directive.type === 'tool_call' && result.success && result.result) {
                const res = result.result as Record<string, unknown>;
                if (res.narsese && typeof res.narsese === 'string') {
                    await nar.believe(res.narsese);
                    await nar.run(3);
                }
            }
        }

        // Strip directives from visible response
        ctx.turn.lmResponse = this.stripDirectives(ctx.turn.lmResponse!);

        // FIX: Request loop-back by incrementing loopCount.
        // The pipeline resets loopCount to 0 at the start of each pass,
        // so this increment survives only to trigger one more iteration.
        if (needsLoopBack) {
            ctx.turn.loopCount++;
            // Reset reasoning result so SeNARSProcessor re-runs with new beliefs
            ctx.turn.reasoningResult = undefined;
        }
    }

    private extractDirectives(response: string): LMDirective[] {
        const results: LMDirective[] = [];

        for (const match of response.matchAll(/\[BELIEVE:\s*([^\]]+)\]/gi)) {
            results.push({ type: 'believe', name: '', content: match[1]!.trim(), raw: match[0]! });
        }

        for (const match of response.matchAll(/\[QUESTION:\s*([^\]]+)\]/gi)) {
            results.push({ type: 'question', name: '', content: match[1]!.trim(), raw: match[0]! });
        }

        for (const match of response.matchAll(/\[TOOL:\s*(\w+)\s*\(([^)]*)\)\]/gi)) {
            results.push({ type: 'tool_call', name: match[1]!, content: match[2]!, raw: match[0]! });
        }

        return results;
    }

    private async executeDirective(nar: NAR, directive: LMDirective): Promise<DirectiveResult> {
        try {
            switch (directive.type) {
                case 'believe': {
                    await nar.believe(directive.content);
                    const derived = await nar.run(3);
                    return { directive, success: true, result: `Added belief, ${derived} derivations`, derivationSteps: derived };
                }
                case 'question': {
                    await nar.question(directive.content);
                    const derived = await nar.run(5);
                    return { directive, success: true, result: `Asked question, ${derived} derivations`, derivationSteps: derived };
                }
                case 'tool_call': {
                    const tool = nar.tools.get(directive.name);
                    if (!tool) return { directive, success: false, error: `Tool not found: ${directive.name}` };
                    const args = this.parseToolArgs(directive.content);
                    const result = await nar.executeTool(directive.name, args);
                    return { directive, success: true, result: result.content };
                }
            }
        } catch (error) {
            return { directive, success: false, error: String(error) };
        }
    }

    private parseToolArgs(argsStr: string): Record<string, unknown> {
        if (!argsStr.trim()) return {};
        try {
            return JSON.parse(`{${argsStr}}`);
        } catch {
            const parts = argsStr.split(',').map(s => s.trim());
            return parts.reduce((acc, v, i) => ({ ...acc, [`arg${i}`]: v }), {});
        }
    }

    private stripDirectives(response: string): string {
        return response
            .replace(/\[BELIEVE:[^\]]*\]\s*/g, '')
            .replace(/\[QUESTION:[^\]]*\]\s*/g, '')
            .replace(/\[TOOL:[^\]]*\]\s*/g, '')
            .trim();
    }
}
```

### 9. ResponseComposer

Renders actual belief content, not just counts.

```typescript
class ResponseComposer implements PipelineStage {
    name = 'ResponseComposer';
    priority = 9;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        if (ctx.turn.finalResponse) return;

        const parts: string[] = [];

        // SeNARS reasoning result with actual beliefs
        if (ctx.turn.reasoningResult) {
            const r = ctx.turn.reasoningResult;
            if (r.steps > 0) {
                parts.push(this.formatReasoningResult(r, ctx.config.streaming.showReasoningSteps));
            } else if (ctx.turn.classification.primary === 'narsese') {
                parts.push('No derivations found.');
            }
        }

        // LM response
        if (ctx.turn.lmResponse) {
            parts.push(ctx.turn.lmResponse);
        }

        // Directive execution results
        if (ctx.turn.directiveResults.length > 0) {
            const directiveText = this.formatDirectiveResults(ctx.turn.directiveResults);
            if (directiveText) parts.push(directiveText);
        }

        // Tool results (legacy, kept for backward compat)
        if (ctx.turn.toolResults.length > 0) {
            parts.push(this.formatToolResults(ctx.turn.toolResults));
        }

        // Fallback if nothing produced output
        if (parts.length === 0) {
            parts.push(this.fallbackResponse(ctx));
        }

        ctx.turn.finalResponse = parts.join('\n\n');
    }

    private formatReasoningResult(result: DerivationResult, showSteps: boolean): string {
        if (!showSteps || result.newBeliefs.length === 0) {
            return `Derived ${result.steps} belief(s).`;
        }

        const lines = [`Derived ${result.steps} belief(s):`];
        for (const b of result.newBeliefs.slice(0, 5)) {
            const tv = b.truth ? ` :${b.truth.frequency.toFixed(1)}:${b.truth.confidence.toFixed(1)}` : '';
            lines.push(`  → (<${b.term}>.${tv})`);
        }
        if (result.newBeliefs.length > 5) {
            lines.push(`  ... and ${result.newBeliefs.length - 5} more`);
        }
        return lines.join('\n');
    }

    private formatDirectiveResults(results: DirectiveResult[]): string {
        const lines: string[] = [];
        for (const r of results) {
            if (r.directive.type === 'believe' && r.success) {
                lines.push(`  ✓ Added: ${r.directive.content.slice(0, 60)}${r.derivationSteps ? ` (${r.derivationSteps} derivations)` : ''}`);
            } else if (r.directive.type === 'question' && r.success) {
                lines.push(`  ✓ Queried: ${r.directive.content.slice(0, 60)}${r.derivationSteps ? ` (${r.derivationSteps} derivations)` : ''}`);
            } else if (r.directive.type === 'tool_call' && r.success) {
                lines.push(`  ✓ Tool ${r.directive.name}: ${String(r.result).slice(0, 80)}`);
            } else if (!r.success) {
                lines.push(`  ✗ ${r.directive.type}: ${r.error}`);
            }
        }
        return lines.length > 0 ? lines.join('\n') : '';
    }

    private formatToolResults(results: ToolResult[]): string {
        return results.map(r =>
            r.error ? `✗ ${r.name}: ${r.error}` : `✓ ${r.name}: ${String(r.result)}`
        ).join('\n');
    }

    private fallbackResponse(ctx: BotContext): string {
        const c = ctx.turn.classification.primary;
        if (c === 'narsese') return 'Processed. No derivations.';
        if (c === 'query') return ctx.capabilities.hasSeNARS
            ? 'No derivation found. Try adding related beliefs first.'
            : "I don't have enough information to answer that.";
        return ctx.capabilities.hasLM
            ? "I'm not sure how to respond to that."
            : 'Processed.';
    }
}
```

### 10. ResponseFormatter

```typescript
class ResponseFormatter implements PipelineStage {
    name = 'ResponseFormatter';
    priority = 10;
    enabled = () => true;

    async execute(ctx: BotContext): Promise<void> {
        const type = ctx.connection.type;
        if (type === 'irc') {
            ctx.turn.finalResponse = this.formatForIRC(ctx.turn.finalResponse);
        }
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

### 11. StatePersistor

```typescript
class StatePersistor implements PipelineStage {
    name = 'StatePersistor';
    priority = 11;
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
            loopCount: ctx.turn.loopCount,
            sender: ctx.connection.sender,
            source: ctx.connection.id,
            timestamp: Date.now(),
            durationMs: Date.now() - ctx.metrics.startTime,
        });
    }
}
```

---

## Unified Conversation State

Replaces both `ConversationManager` and `ChatResponder.conversationHistory`.

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
        if (lm) this.maybeSummarize(lm);
    }

    getHistory(limit?: number): Message[] {
        return limit ? this.messages.slice(-limit) : [...this.messages];
    }

    getContextForLM(maxConcepts: number, nar: NAR): string {
        const parts: string[] = [];
        if (this.summary) parts.push(`Conversation summary: ${this.summary}`);

        const concepts = nar.attentionReport(maxConcepts);
        if (concepts.concepts.length > 0) {
            parts.push('Knowledge context:');
            for (const c of concepts.concepts) parts.push(`  - ${c.term} (priority: ${c.priority})`);
        }

        const recent = this.reasoningArtifacts.slice(-5);
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
        const prompt = `Summarize the following conversation in 2-3 sentences:\n\n${toSummarize.map(m => `${m.role}: ${m.content}`).join('\n')}`;
        this.summary = await lm.generateText(prompt);
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

    pin(belief: string): void { this.pinnedBeliefs.add(belief); }
    unpin(belief: string): void { this.pinnedBeliefs.delete(belief); }
    getPinned(): string[] { return [...this.pinnedBeliefs]; }
}

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

    // FIX: Added serialize() method for Bot.saveState()
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

## Unified Bot Class

Replaces both `Agent` and `Bot`. Wires pipeline, connections, and agentic loop.

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
    private readonly episodicMemory?: EpisodicMemory;
    private readonly commands: CommandRegistry;
    private connectionManager?: ConnectionManager;
    private agenticLoop?: AgenticLoop;
    private logger: Logger;

    constructor(deps: BotDeps) {
        this.profile = deps.profile;
        this.lm = deps.lm;
        this.nar = deps.nar;
        this.logger = createLogger({ scope: 'bot' });
        this.capabilities = detectCapabilities(this.lm, this.nar);
        this.config = { ...DEFAULT_BOT_CONFIG, ...deps.config };
        this.stateManager = new ConversationStateManager(this.config);
        this.episodicMemory = deps.episodicMemory;
        this.commands = deps.commandRegistry ?? this.createCommandRegistry();
        this.pipeline = this.createPipeline();
    }

    private createCommandRegistry(): CommandRegistry {
        const registry = new CommandRegistry();
        // ALL command modules — no subset gap
        const allCommands = [
            coreCommands, connectionCommands, memoryCommands, narCommands,
            selfCommands, lmCommands, rlfpCommands, authCommands,
            configCommands, scenarioCommands, benchmarkCommands,
            experimentCommands, episodesCommands,
        ].flat();
        for (const cmd of allCommands) registry.register(cmd);
        return registry;
    }

    private createPipeline(): MessagePipeline {
        const reasoningTrigger = new ReasoningTriggerCore();
        return new MessagePipeline([
            new InputNormalizer(),
            new AuthChecker(),
            new CommandProcessor(this.commands),
            new InputClassifier(),
            new ReasoningTriggerStage(reasoningTrigger),
            new SeNARSProcessor(),
            new LMResponder(),
            new DirectiveProcessor(),
            new ResponseComposer(),
            new ResponseFormatter(),
            new StatePersistor(this.episodicMemory),
        ]);
    }

    // Connection management
    setConnectionManager(manager: ConnectionManager): void {
        this.connectionManager = manager;
    }

    async addConnection(config: ConnectionConfig): Promise<Connection> {
        if (!this.connectionManager) throw new Error('ConnectionManager not set');
        // FIX: Pass logger to ConnectionDeps
        return this.connectionManager.addConnection(config, {
            nar: this.nar!,
            emit: (event, data) => this.emit(event, data),
            logger: this.logger.child(`conn:${config.id}`),
        });
    }

    // Message processing — single entry point for all connections
    async processMessage(msg: IOMessage, respondFn: (text: string | StreamChunk) => Promise<void>): Promise<BotResponse> {
        const connInfo = this.getConnectionInfo(msg, respondFn);
        const conversation = this.stateManager.getOrCreate(msg.sender);
        const ctx = this.createContext(connInfo, conversation);

        const response = await this.pipeline.process(msg, ctx);

        // Record messages in conversation state
        conversation.addMessage({ role: 'user', content: msg.text, timestamp: Date.now() }, this.lm);
        conversation.addMessage({
            role: 'assistant',
            content: response.text,
            timestamp: Date.now(),
            metadata: ctx.turn.lmSuggestsReasoning ? { suggestsReasoning: true } : undefined,
        }, this.lm);

        // Record artifacts
        if (ctx.turn.reasoningResult?.newBeliefs?.length) {
            conversation.addArtifact({
                type: 'derivation',
                content: `Derived ${ctx.turn.reasoningResult.newBeliefs.length} belief(s): ${ctx.turn.reasoningResult.newBeliefs.slice(0, 3).map(b => b.term).join(', ')}`,
                timestamp: Date.now(),
            });
        }
        for (const dr of ctx.turn.directiveResults) {
            if (dr.success) {
                conversation.addArtifact({
                    type: dr.directive.type === 'believe' ? 'belief_added' : dr.directive.type === 'question' ? 'question_answered' : 'tool_result',
                    content: dr.directive.content.slice(0, 80),
                    timestamp: Date.now(),
                });
            }
        }

        return response;
    }

    private getConnectionInfo(msg: IOMessage, respondFn: (text: string | StreamChunk) => Promise<void>): ConnectionInfo {
        return {
            id: msg.source,
            type: (msg.metadata?.connectionType as ChannelType) ?? 'cli',
            sender: msg.sender,
            respond: respondFn,
            stream: async (stream: AsyncIterable<StreamChunk>) => {
                let buf = '';
                for await (const chunk of stream) {
                    if (chunk.type === 'text') buf += chunk.content;
                    await respondFn(chunk);
                }
            },
        };
    }

    private createContext(connInfo: ConnectionInfo, conversation: ConversationState): BotContext {
        return {
            profile: this.profile,
            lm: this.lm,
            seNARS: this.nar,
            connection: connInfo,
            conversation,
            turn: {
                input: { id: crypto.randomUUID(), source: connInfo.id, sender: connInfo.sender, text: '', timestamp: Date.now() },
                classification: { primary: 'chat', confidence: 0.1, signals: [] },
                reasoningTriggered: false,
                lmSuggestsReasoning: false,
                directives: [],
                directiveResults: [],
                toolResults: [],
                actions: [],
                finalResponse: '',
                loopCount: 0,
            },
            config: this.config,
            capabilities: this.capabilities,
            metrics: { startTime: Date.now(), stages: new Map() },
        };
    }

    // Agentic loop integration
    startAgenticLoop(config?: Partial<AgenticLoopConfig>): void {
        if (!this.nar) return;
        this.agenticLoop = new AgenticLoop(this, this.nar, this.episodicMemory, config);
        this.agenticLoop.setMessageHandler(async (msg) => {
            await this.processMessage(msg, async (text) => {
                const content = typeof text === 'string' ? text : text.content;
                if (this.connectionManager) {
                    const conn = this.connectionManager.getConnection(msg.source);
                    if (conn) await conn.send(msg.sender, content);
                } else {
                    console.log(content);
                }
            });
        });
        this.agenticLoop.start();
    }

    stopAgenticLoop(): void {
        this.agenticLoop?.stop();
    }

    // Event emitter for connections
    private emitter = new EventEmitter();
    on(event: string, handler: (...args: unknown[]) => void): void { this.emitter.on(event, handler); }
    off(event: string, handler: (...args: unknown[]) => void): void { this.emitter.off(event, handler); }
    private emit(event: string, ...args: unknown[]): void { this.emitter.emit(event, ...args); }

    // State persistence
    async saveState(path?: string): Promise<void> {
        const fs = await import('fs/promises');
        const statePath = path ?? 'bot-state.json';
        await fs.writeFile(statePath, JSON.stringify({
            conversationState: this.stateManager.serialize(),
            memory: await this.nar?.getMemoryState?.() ?? {},
            timestamp: Date.now(),
        }, null, 2));
    }

    async loadState(path?: string): Promise<void> {
        const fs = await import('fs/promises');
        const statePath = path ?? 'bot-state.json';
        const data = JSON.parse(await fs.readFile(statePath, 'utf-8'));
        if (data.memory) await this.nar?.loadMemoryState?.(data.memory);
    }

    // Accessors
    getNAR(): NAR | undefined { return this.nar; }
    getCommands(): CommandRegistry { return this.commands; }
    getCapabilities(): Capabilities { return this.capabilities; }

    getSnapshot(): {
        turn: number;
        concepts: number;
        tasks: number;
        lmStatus: string;
        workingMemory: number;
    } {
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

## AgenticLoop — Decoupled from Agent

Holds `Bot` reference instead of `Agent`. Uses pipeline directly.

```typescript
interface AgenticLoopConfig {
    maxInputTurns: number;
    maxWakeTurns: number;
    sleepIntervalMs: number;
    wakeupIntervalMs: number;
    reasoningStepsPerWake: number;
    enableLMRules: boolean;
    backgroundReasoning: boolean;
}

const DEFAULT_LOOP_CONFIG: Required<AgenticLoopConfig> = {
    maxInputTurns: 50,
    maxWakeTurns: 3,
    sleepIntervalMs: 1000,
    wakeupIntervalMs: 60000,
    reasoningStepsPerWake: 5,
    enableLMRules: true,
    backgroundReasoning: true,
};

class AgenticLoop {
    private readonly config: Required<AgenticLoopConfig>;
    private readonly queue: MessageQueue;
    private readonly episodicMemory?: EpisodicMemory;
    private readonly bot: Bot;
    private readonly nar?: NAR;
    private running = false;
    private idleCounter = 0;
    private nextWakeAt = 0;
    private currentTurn = 0;
    private onMessage?: (msg: IOMessage) => Promise<void>;

    constructor(bot: Bot, nar: NAR | undefined, episodicMemory?: EpisodicMemory, config?: Partial<AgenticLoopConfig>) {
        this.bot = bot;
        this.nar = nar;
        this.config = { ...DEFAULT_LOOP_CONFIG, ...config };
        this.queue = new MessageQueue();
        this.episodicMemory = episodicMemory;
    }

    setMessageHandler(handler: (msg: IOMessage) => Promise<void>): void { this.onMessage = handler; }

    start(): void {
        if (this.running) return;
        this.running = true;
        this.nextWakeAt = Date.now() + this.config.wakeupIntervalMs;
        this.runLoop();
    }

    stop(): void { this.running = false; }
    pushMessage(message: IOMessage): void { this.queue.push(message); }

    getStats(): { turn: number; idleCounter: number; queueSize: number } {
        return { turn: this.currentTurn, idleCounter: this.idleCounter, queueSize: this.queue.size() };
    }

    private async runLoop(): Promise<void> {
        while (this.running) {
            const messages = this.queue.drain();

            if (messages.length > 0) {
                this.idleCounter = 0;
                for (const msg of messages) {
                    if (this.onMessage) await this.onMessage(msg);
                    this.episodicMemory?.log({ type: 'input', input: msg.text, source: msg.source, sender: msg.sender, timestamp: Date.now() });
                }
            } else {
                this.idleCounter++;
            }

            const now = Date.now();
            if (this.idleCounter >= this.config.maxInputTurns && now >= this.nextWakeAt) {
                await this.wakeupSequence();
                this.nextWakeAt = now + this.config.wakeupIntervalMs;
                this.idleCounter = 0;
            }

            await this.sleep(this.config.sleepIntervalMs);
            this.currentTurn++;
        }
    }

    private async wakeupSequence(): Promise<void> {
        const nar = this.nar;
        if (!nar) return;

        if (this.config.backgroundReasoning) await this.backgroundReasoning(nar);

        try {
            if (this.config.enableLMRules && nar.enrichMemoryWithLM) await nar.enrichMemoryWithLM();
        } catch { /* logged internally */ }

        try {
            nar.memory?.consolidate?.();
        } catch { /* logged internally */ }

        try {
            const selfAnalyzer = nar.getSelfAnalyzer?.();
            if (selfAnalyzer?.analyzeReasoningGaps) await selfAnalyzer.analyzeReasoningGaps();
        } catch { /* logged internally */ }

        this.episodicMemory?.log({
            type: 'wakeup',
            input: 'wakeup',
            source: 'loop',
            sender: 'system',
            timestamp: Date.now(),
            metadata: {
                turn: this.currentTurn,
                idleCounter: this.idleCounter,
                concepts: nar.getStatistics()?.totalConcepts ?? 0,
                tasks: nar.getStatistics()?.totalTasks ?? 0,
            },
        });
    }

    private async backgroundReasoning(nar: NAR): Promise<void> {
        const steps = this.config.reasoningStepsPerWake;

        try { await nar.run(steps); } catch { /* logged internally */ }

        try {
            const questions = nar.getQuestions?.();
            if (questions?.length) {
                for (const q of questions.slice(0, 3)) await nar.run(steps);
            }
        } catch { /* logged internally */ }

        try {
            const goals = nar.getGoals?.();
            if (goals?.length) {
                for (const g of goals.slice(0, 2)) await nar.run(steps);
            }
        } catch { /* logged internally */ }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
```

---

## REPL — Wired to Bot with Streaming Display

Replaces `SeNARSCLI` that used `Agent`. Now uses `Bot`. Streaming content is displayed token-by-token.

```typescript
class REPL {
    private bot: Bot;
    private rl: readline.Interface;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    async start(): Promise<void> {
        const caps = this.bot.getCapabilities();
        console.log(`\n  ${this.bot.profile.name} — ${this.bot.profile.personality}\n`);
        console.log(`  Mode: ${caps.mode}`);
        console.log(`  LM: ${caps.hasLM ? '✓' : '✗'}  SeNARS: ${caps.hasSeNARS ? '✓' : '✗'}  Streaming: ${caps.hasStreaming ? '✓' : '✗'}`);
        console.log(`  Type /help for commands, or just talk.\n`);

        if (caps.mode === 'senars-only') {
            console.log('  Narsese mode: use (<term --> rel>.) for beliefs, (<term --> ?>) for questions');
            console.log('  Or use /run, /beliefs, /concepts, /help\n');
        }

        this.rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        this.rl.setPrompt('> ');

        for await (const line of this.rl) {
            await this.processLine(line);
        }
    }

    private async processLine(line: string): Promise<void> {
        const trimmed = line.trim();
        if (!trimmed) return;

        process.stdout.write(`> ${trimmed}\n`);

        const caps = this.bot.getCapabilities();
        const showTyping = caps.hasLM && this.bot.config.tui.typingIndicator;

        // FIX: Streaming callback actually displays tokens
        let streamedContent = '';
        const respondFn = async (text: string | StreamChunk) => {
            if (typeof text === 'string') {
                streamedContent = text;
            } else if (text.type === 'text') {
                process.stdout.write(text.content);
                streamedContent += text.content;
            } else if (text.type === 'status' && text.content === 'typing') {
                process.stdout.write('  bot: ');
            }
        };

        if (showTyping) {
            const spinner = ora('thinking...').start();
            try {
                const response = await this.bot.processMessage(
                    { id: crypto.randomUUID(), source: 'cli', sender: 'user', text: trimmed, timestamp: Date.now() },
                    respondFn,
                );
                spinner.stop();
                // If streaming produced content, add newline; otherwise use response.text
                if (!streamedContent) {
                    process.stdout.write(`bot: ${response.text}\n`);
                } else {
                    process.stdout.write('\n');
                }
                this.displayMetrics(response);
            } catch (error) {
                spinner.stop();
                process.stdout.write(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
            }
        } else {
            try {
                const response = await this.bot.processMessage(
                    { id: crypto.randomUUID(), source: 'cli', sender: 'user', text: trimmed, timestamp: Date.now() },
                    respondFn,
                );
                if (!streamedContent) {
                    process.stdout.write(`bot: ${response.text}\n`);
                }
                this.displayMetrics(response);
            } catch (error) {
                process.stdout.write(`✗ ${error instanceof Error ? error.message : String(error)}\n`);
            }
        }
    }

    private displayMetrics(response: BotResponse): void {
        if (response.metrics) {
            const total = Date.now() - response.metrics.startTime;
            const stageTimes = [...response.metrics.stages.entries()]
                .map(([name, t]) => `${name}: ${t.durationMs}ms${t.error ? ` ✗` : ''}`)
                .join(', ');
            process.stdout.write(`  [${total}ms | ${stageTimes}]\n`);
        }
    }
}
```

---

## Entry Point

```typescript
async function main() {
    // 1. Create NAR
    const nar = new NAR({
        lmClient: undefined,  // Set below
        enableLMRules: true,
        enableTools: true,
    });

    // 2. Create LM client (optional — graceful degradation)
    const lm = await createLMClient({
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        fallback: ['ollama/llama3.1:8b', 'transformersjs/Qwen2.5-1.5B'],
    }).catch(() => undefined);

    // Set LM on NAR for internal LM integration (LMRule, enrichment)
    if (lm) {
        nar.setLMClient(lm);
    }

    // 3. Create Bot (single orchestrator)
    const bot = new Bot({
        profile: { name: 'SeNARS', personality: 'A reasoning-focused AI assistant.' },
        lm,
        nar,
        episodicMemory: new EpisodicMemory(),
    });

    // 4. Set up connection manager
    const connManager = new ConnectionManager(createLogger({ scope: 'connections' }));
    bot.setConnectionManager(connManager);

    // 5. Register connection factories
    const factories = [
        { type: 'cli', ctor: CLIConnection },
        { type: 'irc', ctor: IRCConnection },
        { type: 'websocket', ctor: WSConnection },
        { type: 'http', ctor: HTTPConnection },
        { type: 'mcp', ctor: MCPConnection },
    ];
    for (const { type, ctor } of factories) {
        connManager.registerFactory({ type, create: (config, deps) => new ctor(config, deps) });
    }

    // 6. Start CLI REPL
    const repl = new REPL(bot);
    repl.start();

    // 7. Start agentic loop (background reasoning)
    bot.startAgenticLoop({ backgroundReasoning: true });
}
```

---

## Data Flow: Bidirectional NAR↔LM

```
Pass 1 (normal):
  InputNormalizer → AuthChecker → CommandProcessor → InputClassifier
    → ReasoningTrigger → SeNARSProcessor
      ↓
      SeNARS runs NAL operations → ctx.turn.reasoningResult = { beliefs, newBeliefs }
    → LMResponder
      ↓
      System prompt includes newBeliefs + getContextForLM() output
      LM generates response with [BELIEVE:], [QUESTION:], [TOOL:] directives
      Markers stripped from visible output; lmSuggestsReasoning set
    → DirectiveProcessor
      ↓
      Extracts directives from LM response
      Executes: nar.believe(), nar.question(), nar.tools.execute()
      If believe/question executed → ctx.turn.loopCount = 1

Pass 2 (loop-back, only if loopCount > 0):
  ctx.turn.loopCount = 0 (reset at pass start)
  Only SeNARSProcessor, LMResponder, DirectiveProcessor run
    → SeNARSProcessor (re-runs with new beliefs from directives)
      ↓
      New derivations from LM-suggested beliefs
    → LMResponder (generates updated response with new derivations)
    → DirectiveProcessor (re-extracts — no more directives → loopCount stays 0)

Final:
  → ResponseComposer (renders actual belief content + directive results)
  → ResponseFormatter → StatePersistor
```

### Key Flow Properties

1. **SeNARS before LM**: LM always sees what SeNARS derived in the current pass
2. **LM directives loop back**: `[BELIEVE:]` and `[QUESTION:]` feed into SeNARS for another derivation pass
3. **Bounded loops**: `maxLoops` (default 2) caps total passes; `loopCount` resets each pass
4. **Tool results feed NAR**: Tool output with `narsese` field is believed immediately
5. **ResponseComposer renders beliefs**: Actual derived beliefs shown to user, not just counts
6. **DRY context building**: `LMResponder` uses `ConversationState.getContextForLM()` instead of duplicating logic

---

## Command System

All commands registered in the single `Bot` class. No subset gap.

### Command Definition

```typescript
interface CommandDef {
    name: string;
    aliases?: string[];
    description: string;
    usage: string;
    category: string;
    requiresLM?: boolean;
    requiresSeNARS?: boolean;
    handler: (args: string[], ctx: BotContext) => Promise<string | AsyncIterable<StreamChunk>>;
}
```

### Command Modules (all 13)

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
│   ├── Bot.ts                    # Single orchestrator (replaces Agent + Bot)
│   ├── BotContext.ts             # Types: BotContext, TurnState, Capabilities, etc.
│   ├── ConversationState.ts      # Per-sender state + ConversationStateManager
│   ├── AgenticLoop.ts            # Decoupled from Bot, uses Bot reference
│   ├── pipeline/
│   │   ├── Pipeline.ts           # MessagePipeline with loop-back support
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
│   ├── streaming/
│   │   ├── types.ts
│   │   ├── LMStreamAdapter.ts
│   │   └── ChannelStreamer.ts
│   ├── tui/
│   │   └── REPL.ts               # Wired to Bot with streaming display
│   └── index.ts
├── nar/                          # Unchanged — NAR reasoner engine
│   ├── nar.ts
│   ├── lm/                       # Internal LM integration (LMRule, enrichment, feedback)
│   ├── memory/
│   ├── reason/
│   └── tools/
├── io/                           # Unchanged — I/O layer
│   ├── connection-manager.ts
│   ├── commands/                 # All 13 command modules
│   └── connections/
└── cli/
    └── repl.ts                   # Entry point — creates Bot, starts REPL
```

### Removed Files

| File | Reason |
|---|---|
| `src/agent/Agent.ts` | Replaced by `Bot` |
| `src/agent/ChatResponder.ts` | Functionality merged into `LMResponder` stage |
| `src/agent/ResponseInterpreter.ts` | Functionality merged into `DirectiveProcessor` stage |
| `src/agent/ConversationManager.ts` | Replaced by `ConversationState` |
| `src/agent/Bot.ts` | Replaced by unified `Bot` |
| `src/agent/DegradationManager.ts` | Pipeline `enabled()` predicates handle degradation automatically |
| `src/agent/LastResults.ts` | Replaced by episodic memory logging |
| `src/agent/ResponseFormatter.ts` (agent-level) | Replaced by pipeline `ResponseFormatter` stage |
| `src/agent/ChannelBehavior.ts` | Merged into `ResponseFormatter` |

---

## Degradation

No separate `DegradationManager`. Degradation is automatic via `enabled()` predicates:

```typescript
// If LM fails, ctx.capabilities.hasLM becomes false
// Next turn:
//   LMResponder.enabled(ctx) → false → skipped
//   DirectiveProcessor.enabled(ctx) → still true (checks SeNARS internally)
//   ResponseComposer.fallbackResponse(ctx) → uses hasLM check

// If SeNARS fails, ctx.capabilities.hasSeNARS becomes false
// Next turn:
//   ReasoningTriggerStage.enabled(ctx) → false → skipped
//   SeNARSProcessor.enabled(ctx) → false → skipped
//   DirectiveProcessor.enabled(ctx) → true, but all directives fail with "SeNARS not available"
//   LMResponder.enabled(ctx) → true → LM responds normally
```

Pipeline stages self-check capabilities at runtime. No reconfiguration needed.

---

## Testing Strategy

### Unit Tests (per stage)

```typescript
describe('InputClassifier', () => {
    it('classifies slash prefix as command', () => {
        assert.equal(classify('/help', emptyContext()).primary, 'command');
    });
    it('classifies Narsese syntax as narsese', () => {
        assert.equal(classify('(<bird --> animal>.)', emptyContext()).primary, 'narsese');
    });
    it('detects reasoning keywords', () => {
        assert.equal(classify('Why do birds migrate?', emptyContext()).primary, 'reason');
    });
    it('respects mode override', () => {
        const ctx = emptyContext(); ctx.conversation.mode = 'chat';
        assert.equal(classify('Why do birds migrate?', ctx).primary, 'chat');
    });
});

describe('DirectiveProcessor', () => {
    it('extracts BELIEVE directives', () => {
        const directives = extractDirectives('Hello [BELIEVE: (<X --> Y>.)] world');
        assert.equal(directives.length, 1);
        assert.equal(directives[0].type, 'believe');
    });
    it('extracts multiple directive types', () => {
        const directives = extractDirectives('[BELIEVE: (<A --> B>.)] [TOOL:calc(1+1)]');
        assert.equal(directives.length, 2);
    });
    it('triggers loop-back on believe directive', async () => {
        const ctx = createFullContext();
        ctx.turn.lmResponse = '[BELIEVE: (<X --> Y>. :1.0:0.9)]';
        ctx.turn.loopCount = 0;
        await new DirectiveProcessor().execute(ctx);
        assert.equal(ctx.turn.loopCount, 1);
    });
    it('respects maxLoops — pipeline resets loopCount each pass', async () => {
        const ctx = createFullContext();
        ctx.config.pipeline.maxLoops = 1;
        ctx.turn.lmResponse = '[BELIEVE: (<X --> Y>.)]';
        // Pipeline resets loopCount to 0 at start of each pass
        // DirectiveProcessor increments to 1 to request another pass
        // After pass 2, loopCount is reset to 0, no more directives → stays 0
        // Pipeline exits because loopCount is 0
        await new DirectiveProcessor().execute(ctx);
        assert.equal(ctx.turn.loopCount, 1);
    });
});

describe('SeNARSProcessor', () => {
    it('converts "X is a Y" to Narsese', () => {
        const processor = new SeNARSProcessor();
        const narsese = (processor as any).naturalLanguageToNarsese('Bird is a animal');
        assert.equal(narsese, '(<Bird --> animal>.)');
    });
    it('converts "X is not Y" to negative Narsese', () => {
        const processor = new SeNARSProcessor();
        const narsese = (processor as any).naturalLanguageToNarsese('Bird is not mammal');
        assert.equal(narsese, '(<Bird --> [mammal]>. :0.0:0.9)');
    });
    it('counts only new beliefs as steps', async () => {
        // Setup: NAR has 10 existing beliefs
        const ctx = createFullContext();
        const beforeCount = ctx.seNARS.getBeliefs().length;
        // After processing, only newly derived beliefs count as steps
        // ...
    });
});

describe('LMResponder', () => {
    it('detects REASONING_SUGGESTED before stripping', async () => {
        const ctx = createFullContext();
        ctx.lm!.generateText = async () => 'Hello [REASONING_SUGGESTED: causal] world';
        await new LMResponder().execute(ctx);
        assert.isTrue(ctx.turn.lmSuggestsReasoning);
        assert.equal(ctx.turn.lmResponse, 'Hello world');  // Marker stripped
    });
    it('uses getContextForLM for NAR context', async () => {
        // Verify LMResponder.buildPrompt() calls conversation.getContextForLM()
        // ...
    });
});

describe('MessagePipeline loop-back', () => {
    it('exits after maxLoops passes', async () => {
        const pipeline = createFullPipeline();
        const ctx = createFullContext();
        ctx.config.pipeline.maxLoops = 2;
        // Mock LM to always return a BELIEVE directive
        ctx.lm!.generateText = async () => '[BELIEVE: (<X --> Y>.)]';
        await pipeline.process({ text: 'test', sender: 'user', source: 'cli' }, ctx);
        // Should execute at most 2 loop-back passes + 1 normal pass = 3 total
        // ...
    });
    it('resets loopCount each pass', async () => {
        // Verify loopCount is 0 at start of each pass
        // ...
    });
});
```

### Integration Tests

```typescript
describe('Pipeline — Full Mode with Loop-Back', () => {
    it('processes Narsese input and derives', async () => {
        const pipeline = createFullPipeline();
        const ctx = createFullContext();
        const response = await pipeline.process(
            { text: '(<bird --> animal>.)', sender: 'user', source: 'cli' },
            ctx,
        );
        assert.ok(response.text);
    });

    it('LM directive loops back to SeNARS', async () => {
        const pipeline = createFullPipeline();
        const ctx = createFullContext();
        ctx.lm!.generateText = async () => '[BELIEVE: (<whale --> mammal>. :1.0:0.9)]';
        const response = await pipeline.process(
            { text: 'Tell me about whales', sender: 'user', source: 'cli' },
            ctx,
        );
        assert.ok(ctx.turn.directiveResults.some(d => d.directive.type === 'believe' && d.success));
    });

    it('auto-triggers reasoning on causal question', async () => {
        const pipeline = createFullPipeline();
        const ctx = createFullContext();
        const response = await pipeline.process(
            { text: 'Why do birds fly south?', sender: 'user', source: 'cli' },
            ctx,
        );
        assert.isTrue(ctx.turn.reasoningTriggered);
    });
});

describe('Pipeline — Degradation', () => {
    it('skips LM stages when LM unavailable', async () => {
        const pipeline = createSeNARSOnlyPipeline();
        const ctx = createSeNARSOnlyContext();
        const response = await pipeline.process(
            { text: '(<bird --> animal>.)', sender: 'user', source: 'cli' },
            ctx,
        );
        assert.isUndefined(ctx.turn.lmResponse);
        assert.ok(ctx.turn.reasoningResult);
    });

    it('skips SeNARS stages when NAR unavailable', async () => {
        const pipeline = createLMOnlyPipeline();
        const ctx = createLMOnlyContext();
        const response = await pipeline.process(
            { text: 'Tell me about birds', sender: 'user', source: 'cli' },
            ctx,
        );
        assert.ok(ctx.turn.lmResponse);
        assert.isUndefined(ctx.turn.reasoningResult);
    });
});
```

---

## Migration Plan

### Phase 1: Consolidate Types
- [ ] Update `BotContext.ts` with new types (`TurnMetrics`, `LMDirective`, `DirectiveResult`, `loopCount`, `pipeline` config)
- [ ] Add `newBeliefs` to `DerivationResult`
- [ ] Set `streaming.enabled = true` in defaults

### Phase 2: Implement DirectiveProcessor
- [ ] Create `DirectiveProcessor.ts` stage (replaces `ToolExecutor.ts`)
- [ ] Implement directive extraction for `[BELIEVE:]`, `[QUESTION:]`, `[TOOL:]`
- [ ] Implement loop-back logic with `maxLoops` bound
- [ ] Add tool arg parsing fallback

### Phase 3: Update Pipeline with Loop-Back
- [ ] Modify `MessagePipeline.process()` — reset `loopCount` at start of each pass
- [ ] Add `loopStages` set for re-executed stages
- [ ] Add per-stage timeout via `executeWithTimeout()`
- [ ] Add `TurnMetrics` tracking

### Phase 4: Update Stages
- [ ] `InputNormalizer`: create mutable copy of `IOMessage` (fields are readonly)
- [ ] `SeNARSProcessor`: track `newBeliefs` (before/after diff), count only new as steps
- [ ] `SeNARSProcessor`: expand NL-to-Narsese (5 patterns)
- [ ] `LMResponder`: check `[REASONING_SUGGESTED:]` before stripping markers
- [ ] `LMResponder`: use `ConversationState.getContextForLM()` for NAR context
- [ ] `LMResponder`: add directive instructions to system prompt
- [ ] `ResponseComposer`: render actual belief content
- [ ] `ResponseComposer`: format directive execution results

### Phase 5: Unify Bot Class
- [ ] Create unified `Bot` class (replaces both `Agent` and old `Bot`)
- [ ] Register ALL 13 command modules
- [ ] Wire `getConnectionInfo()`, `createContext()`, `processMessage()`
- [ ] Add `serialize()` to `ConversationStateManager`
- [ ] Pass logger to `ConnectionDeps` in `addConnection()`

### Phase 6: Decouple AgenticLoop
- [ ] Update `AgenticLoop` to accept `Bot` instead of `Agent`
- [ ] Remove `Agent` dependency
- [ ] Update `wakeupSequence()` to use `Bot` methods

### Phase 7: Wire REPL to Bot
- [ ] Update `repl.ts` to create `Bot` instead of `Agent`
- [ ] Add streaming display (typing indicator, token-by-token)
- [ ] Add metrics display (stage timing)

### Phase 8: Remove Legacy Code
- [ ] Delete `Agent.ts`, `ChatResponder.ts`, `ResponseInterpreter.ts`
- [ ] Delete `ConversationManager.ts`, `LastResults.ts`, `DegradationManager.ts`
- [ ] Delete old `Bot.ts`
- [ ] Update all imports
- [ ] Run tests, fix breakages

### Phase 9: Verify All Entry Points
- [ ] CLI REPL
- [ ] IRC connection
- [ ] WebSocket connection
- [ ] HTTP connection
- [ ] MCP server
- [ ] Agentic loop background reasoning

---

## Interaction Examples

### Full Mode with Loop-Back

```
> If all mammals are warm-blooded and whales are mammals, are whales warm-blooded?

  ⏳ thinking...
  → reasoning triggered: multi-hop pattern detected
  → derived: 2 beliefs
    → (<whale --> warm_blooded>. :0.9:0.7)
    → (<mammal --> warm_blooded>. :1.0:0.9)

  bot: Yes — whales are warm-blooded. This follows from the syllogism:
       all mammals are warm-blooded, whales are mammals, therefore whales
       are warm-blooded.

  [42ms | InputNormalizer: 1ms, AuthChecker: 2ms, InputClassifier: 3ms,
   ReasoningTrigger: 5ms, SeNARSProcessor: 18ms, LMResponder: 12ms,
   DirectiveProcessor: 1ms, ResponseComposer: 0ms, ResponseFormatter: 0ms]
```

### LM Suggests Reasoning, Bot Adds Belief

```
> What's the relationship between birds and animals?

  bot: Birds are a subclass of animals. All birds share the properties of animals.

  (internally: [REASONING_SUGGESTED: inheritance relationship] detected)
  (internally: [BELIEVE: (<bird --> animal>. :1.0:0.9)] executed)

  → Loop-back: SeNARS processed [BELIEVE: (<bird --> animal>. :1.0:0.9)]
  → Added: (<bird --> animal>. :1.0:0.9) (0 derivations)

  [67ms | ... SeNARSProcessor: 15ms, LMResponder: 35ms, DirectiveProcessor: 12ms,
   SeNARSProcessor(loop): 5ms ...]
```

### SeNARS-Only Mode

```
> (<bird --> animal>.)

  → Added: (<bird --> animal>. :1.0:0.9)
  → 0 derivations

> (<robin --> bird>.)

  → Added: (<robin --> bird>. :1.0:0.9)
  → 0 derivations

> /run 3

  → Derived: (<robin --> animal>. :1.0:0.81) — transitive
  → 1 new belief

> (<robin --> ?>)

  → robin is a: animal (1.0:0.81), bird (1.0:0.9)
```

### LM-Only Mode

```
> Why do birds fly south?

  bot: Birds migrate south for several reasons:
  1. Food availability decreases in northern regions during winter
  2. Warmer climates reduce energy expenditure for thermoregulation
  3. Daylight hours affect breeding cycles

  Note: I don't have a formal reasoning engine loaded, so this is based
  on my training knowledge rather than derived facts.
```

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| Single `Bot` class | Eliminates Agent/Bot duality, single entry point |
| Loop-back pipeline with reset | Enables LM→NAR→LM interaction; reset prevents infinite loop |
| `maxLoops` bound | Caps total passes per turn |
| `DirectiveProcessor` replaces `ToolExecutor` | Unifies all LM directive handling |
| `newBeliefs` tracking | LM sees what was just derived, not just concept priorities |
| Streaming default ON | Real-time feedback expected in modern interfaces |
| Degradation via `enabled()` | No separate manager — capabilities checked at runtime |
| Per-stage timeout | Prevents hung stages from blocking entire turn |
| `TurnMetrics` built-in | Observability without external tooling |
| All 13 command modules in Bot | No functionality gap between modes |
| Remove `ChatResponder`, `ResponseInterpreter` | Functionality absorbed into pipeline stages |
| Remove `ConversationManager`, `LastResults` | Replaced by `ConversationState` + episodic memory |
| Remove `DegradationManager` | Pipeline self-degrades via `enabled()` predicates |
| `LMResponder` uses `getContextForLM()` | DRY — no duplicate context building |
| Mutable `IOMessage` copy in `InputNormalizer` | `IOMessage` fields are readonly in `io/types.ts` |
| `LMClient` simulated streaming | `LMClient` has no native `.stream()` — word-by-word fallback |
| `ConversationStateManager.serialize()` | Required by `Bot.saveState()` |
| Logger passed to `ConnectionDeps` | Required by `ConnectionDeps` interface |
