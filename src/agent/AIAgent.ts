import {generateText} from 'ai';
import type {NAR} from '../nar/nar.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {createNARSTools, createGeneralTools} from '../nar/tools/adapters/index.js';
import type {
    AIAgentConfig,
    ProcessContext,
    AgentResult,
    Belief,
    TurnAction,
    Capabilities,
    AgentMetrics,
} from './types.js';
import type {ConversationState} from './ConversationState.js';
import type {LMClient} from '../nar/lm/types.js';
import {adapt} from '../nar/lm/adapters/index.js';
import {EventBus} from '../nar/types/events.js';
import {termParser} from '../nar/terms/index.js';
import {SelfAnalyzerService} from './services/SelfAnalyzerService.js';
import {MetacognitiveMonitor} from './services/MetacognitiveMonitor.js';
import type {CognitiveState} from './types.js';

export class AIAgent {
    private readonly nar?: NAR;
    private readonly episodicMemory?: EpisodicMemory;
    private readonly config: AIAgentConfig['config'];
    private readonly capabilities: Capabilities;
    private readonly lmClient?: LMClient;
    private readonly model?: ReturnType<typeof adapt>;
    private readonly eventBus = new EventBus();
    private readonly selfAnalyzer?: SelfAnalyzerService;
    private turnCount = 0;
    private cycleCount = 0;
    private errorCount = 0;
    private isRunning = true;
    private lastActivity = Date.now();
    private toolsCache?: Record<string, unknown>;

    constructor(config: AIAgentConfig) {
        this.nar = config.nar;
        this.episodicMemory = config.episodicMemory;
        this.config = config.config;
        this.capabilities = config.capabilities;
        this.lmClient = config.lmClient;
        this.model = config.lmClient ? adapt(config.lmClient) : undefined;
        if (config.nar) {
            const monitor = new MetacognitiveMonitor(null);
            this.selfAnalyzer = new SelfAnalyzerService(config.nar, monitor, null, {});
        }
    }

    private getTools(): Record<string, unknown> {
        if (this.toolsCache) return this.toolsCache;
        const tools: Record<string, unknown> = {};
        if (this.nar) {
            Object.assign(tools, createNARSTools(this.nar));
        }
        Object.assign(tools, createGeneralTools({
            nar: this.nar,
            episodicMemory: this.episodicMemory as {getEpisodes(options: {limit: number; type?: string}): Promise<unknown[]>} | undefined,
        }));
        this.toolsCache = tools;
        return tools;
    }

    private buildInstructions(context?: {sender: string; connectionType: string}): string {
        const mode = this.capabilities.mode;
        const personaContext = context ? `\nYou are interacting via ${context.connectionType.toUpperCase()} with ${context.sender}.` : '';

        if (mode === 'full') {
            return `You are an intelligent assistant with access to a formal reasoning engine (SeNARS).${personaContext}

## Capabilities
- You can suggest logical analysis by including: [REASONING_SUGGESTED: brief reason]
- You can add beliefs: [BELIEVE: (<term --> category>. :frequency:confidence)]
- You can ask questions: [QUESTION: (<term --> ?>.)]
- You have access to your episodic memory and the conversation summary to recall past interactions.

## When to Use Reasoning
- Causal questions ("why", "how", "therefore")
- Logical puzzles and syllogisms
- Comparisons and contrasts
- Contradictions or conflicting information
- Multi-hop inference patterns
- When requested to use NARS or think logically

## Response Guidelines
- Be concise and direct
- Acknowledge uncertainty when present
- Don't fabricate facts
- Use reasoning engine for formal logic, not for conversational chat
- If you call a NARS tool and the output indicates reasoning is required, call the reasoning tools again until you have an answer.`;
        }

        if (mode === 'lm-only') {
            return `You are a helpful conversational AI assistant.${personaContext}

## Capabilities
- Natural conversation
- Tool usage when appropriate
- Factual questions within your training

## Guidelines
- Be concise and direct
- Acknowledge uncertainty
- Don't fabricate facts`;
        }

        return `SeNARS Reasoning Engine — Narsese Input Mode${personaContext}

Accepted input:
- (<term --> category>.) — Add belief
- (<term --> ?>) — Ask question
- !(<term --> goal>.) — Set goal
- /run [n] — Run n reasoning steps
- /beliefs — Show current beliefs
- /concepts — Show active concepts
- /help — Show all commands`;
    }

    private primeAttention(input: string): void {
        if (!this.nar) return;
        const terms = this.extractTerms(input);
        for (const termStr of terms) {
            const concepts = this.nar.listConcepts();
            const concept = concepts.find(c => c.term.toString() === termStr);
            if (concept) {
                concept.priority = Math.min(1.0, concept.priority + 0.1);
            }
        }
    }

    private extractTerms(input: string): string[] {
        const matches = input.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) ?? [];
        return [...new Set(matches)];
    }

    private async buildCognitiveContext(conversation?: ConversationState): Promise<string> {
        if (!this.nar) return '';

        const attention = this.nar.attentionReport();
        const beliefs = this.nar.getBeliefs();
        const stats = this.nar.getStatistics();

        const parts: string[] = [];

        if (attention.concepts.length > 0) {
            parts.push('## Current Attention Focus');
            parts.push(attention.concepts.slice(0, 15).map(c => {
                const belief = beliefs.find(b => b.term.toString() === c.term);
                const truthStr = belief?.truth ? ` (f=${belief.truth.f.toFixed(2)}, c=${belief.truth.c.toFixed(2)})` : '';
                return `- **${c.term}**: priority=${c.priority.toFixed(2)}${truthStr}`;
            }).join('\n'));
        }

        const questions = this.nar.getQuestions().slice(0, 5).map(q => q.term.toString());
        if (questions.length > 0) {
            parts.push('\n## Unanswered Questions');
            questions.forEach(q => parts.push(`- ${q}`));
        }

        const goals = this.nar.getGoals().slice(0, 3).map(g => g.term.toString());
        if (goals.length > 0) {
            parts.push('\n## Active Goals');
            goals.forEach(g => parts.push(`- ${g}`));
        }

        parts.push(`\n## Memory State`);
        parts.push(`- Concepts: ${stats.totalConcepts}`);
        parts.push(`- Tasks: ${stats.totalTasks}`);
        parts.push(`- Working Memory: ${this.nar.workingMemory.size()}`);

        if (this.episodicMemory) {
            try {
                const episodes = await this.episodicMemory.getEpisodes({limit: 5});
                if (episodes && episodes.length > 0) {
                    parts.push(`\n## Recent Episodic Memories`);
                    for (const ep of episodes) {
                        parts.push(`- [${new Date(ep.timestamp).toISOString()}] ${ep.type}: ${(ep.content as string).slice(0, 100)}`);
                    }
                }
            } catch {}
        }

        if (conversation && conversation.summary) {
            parts.push(`\n## Conversation Summary\n${conversation.summary}`);
        }

        return parts.join('\n');
    }

    async chat(input: string, ctx: {sender: string; connectionType: string; conversation: ConversationState}): Promise<string> {
        const result = await this.process(input, ctx as unknown as ProcessContext);
        return result.response;
    }

    async reason(input: string, steps?: number): Promise<Belief[]> {
        const result = await this.process(input, {reasoningDepth: steps});
        return (result.reasoning?.newBeliefs as Belief[]) ?? [];
    }

    async process(input: string, ctx?: ProcessContext): Promise<AgentResult> {
        const startTime = Date.now();
        this.eventBus.emit('agent:process:start', {input, context: ctx});

        try {
            const primary = this.classify(input).primary;
            const result = await (
                primary === 'narsese' ? this.handleNarsese(input, ctx) :
                primary === 'reason' ? this.handleReasoning(input, ctx) :
                this.handleChat(input, ctx)
            );

            if (ctx?.reasoningDepth) await this.recordTurn(true);

            this.eventBus.emit('agent:process:complete', {result, durationMs: Date.now() - startTime});
            this.lastActivity = Date.now();
            this.cycleCount++;
            return result;
        } catch (error) {
            this.errorCount++;
            const err = error instanceof Error ? error : new Error(String(error));
            this.eventBus.emit('error', {error: err, context: {input, stage: 'process'}});

            return {
                success: false,
                response: '',
                error: err.message,
                metrics: {durationMs: Date.now() - startTime, cycleCount: this.cycleCount, eventCount: 0},
            };
        }
    }

    async suspend(): Promise<void> {
        this.isRunning = false;
        this.eventBus.emit('agent:suspend', {
            cycleCount: this.cycleCount,
            lastActivity: this.lastActivity,
        });
    }

    async resume(): Promise<void> {
        this.isRunning = true;
        this.eventBus.emit('agent:resume', {
            cycleCount: this.cycleCount,
            lastActivity: this.lastActivity,
        });
    }

    getMetrics(): AgentMetrics {
        return {
            cycleCount: this.cycleCount,
            isRunning: this.isRunning,
            errorCount: this.errorCount,
            lastActivity: this.lastActivity,
            narMetrics: this.nar?.getStatistics(),
            conversationMetrics: undefined,
        };
    }

    getState(): CognitiveState {
        if (this.errorCount > 10) return 'confused';
        if (!this.isRunning) return 'idle';
        return 'normal';
    }

    getCapabilities(): Capabilities {
        return this.capabilities;
    }

    getTurnCount(): number {
        return this.turnCount;
    }

    private classify(input: string): {primary: 'narsese' | 'chat' | 'reason'; confidence: number; signals: string[]} {
        const hasPunctuation = /[.?!]$/.test(input.trim());
        if (!hasPunctuation) return {primary: 'chat', confidence: 0.8, signals: []};

        try {
            const term = termParser.parse(input);
            return {primary: 'narsese', confidence: 0.9, signals: ['narsese_parseable']};
        } catch {
            return {primary: 'chat', confidence: 0.8, signals: []};
        }
    }

    private async handleNarsese(input: string, context?: ProcessContext): Promise<AgentResult> {
        if (!this.nar) return {success: false, response: 'NAR not initialized', error: 'NAR engine not available'};
        const startTime = Date.now();
        try {
            const steps = context?.reasoningDepth ?? 5;
            let response = '';
            const clean = input.replace(/[?!.]+$/, '');

            if (input.endsWith('!')) {
                await this.nar.input(input, 'goal');
                response = `GOAL: ${input}`;
            } else if (input.endsWith('?')) {
                const match = this.nar.getBeliefs().find((b: any) => b.term.toString().includes(clean.split('-->')[0] ?? clean));
                response = match ? `Answer: ${match.term.toString()} f=${match.truth?.f.toFixed(2)} c=${match.truth?.c.toFixed(2)}` : `No answer for: ${input}`;
            } else {
                await this.nar.input(clean, 'belief');
                this.nar.run(steps).catch(() => {}); // non-blocking
                response = `+ ${clean}`;
            }

            return {
                success: true, response,
                reasoning: {steps, newBeliefs: [], trace: []},
                metrics: {durationMs: Date.now() - startTime, cycleCount: this.cycleCount, eventCount: 0},
            };
        } catch (error) {
            return {success: false, response: '', error: error instanceof Error ? error.message : String(error)};
        }
    }

    private async runLM(
        messages: {role: 'user' | 'assistant' | 'system' | 'tool'; content: string | any[]}[],
        maxLoops = 5,
    ): Promise<{text: string; toolCalls: any[]}> {
        if (!this.model) return {text: '', toolCalls: []};
        const tools = this.getTools();
        const allToolCalls: any[] = [];

        for (let loop = 0; loop < maxLoops; loop++) {
            let result;
            try {
                result = await generateText({
                    model: this.model as any,
                    messages: messages as any,
                    tools: tools as any,
                    maxOutputTokens: 2048,
                });
            } catch (lmError) {
                const err = lmError instanceof Error ? lmError : new Error(String(lmError));
                this.eventBus.emit('error', {error: err, context: {stage: 'runLM'}});
                return {text: err.message, toolCalls: allToolCalls};
            }

            if (!result.toolCalls || result.toolCalls.length === 0) {
                return {text: result.text ?? '', toolCalls: allToolCalls};
            }

            messages.push({
                role: 'assistant',
                content: result.toolCalls.map((tc: any) => ({
                    type: 'tool-call',
                    toolName: tc.toolName,
                    toolCallId: tc.toolCallId,
                    args: (tc as any).input ?? (tc as any).args,
                })) as any,
            });

            const toolResults: any[] = [];
            for (const tc of result.toolCalls) {
                allToolCalls.push(tc);
                const toolInstance = (tools as any)[tc.toolName];
                let tcResult: any;
                const args = (tc as any).input ?? (tc as any).args ?? {};
                if (toolInstance && typeof toolInstance.execute === 'function') {
                    try {
                        tcResult = await toolInstance.execute(args, {} as any);
                    } catch (e: any) {
                        tcResult = {success: false, error: e.message ?? String(e)};
                    }
                } else {
                    tcResult = {success: false, error: `Tool ${tc.toolName} not found or not executable`};
                }
                toolResults.push({
                    type: 'tool-result',
                    toolCallId: tc.toolCallId,
                    toolName: tc.toolName,
                    result: tcResult,
                });
            }

            messages.push({role: 'tool', content: toolResults as any});
        }

        return {text: '', toolCalls: allToolCalls};
    }

    private async handleChat(input: string, context?: ProcessContext): Promise<AgentResult> {
        if (!this.model) return this.handleDefault(input, context);
        const startTime = Date.now();
        try {
            const ctx = context as unknown as {
                sender?: string;
                connectionType?: string;
                conversation?: ConversationState;
            } | undefined;

            const sender = ctx?.sender ?? 'user';
            const connectionType = ctx?.connectionType ?? 'cli';
            const conversation = ctx?.conversation;

            if (this.nar) this.primeAttention(input);
            await this.episodicMemory?.log('input', input, {sender, channel: connectionType});

            const cognitiveContext = this.nar && conversation ? await this.buildCognitiveContext(conversation) : undefined;
            const history = conversation ? conversation.getHistory(20) : [];

            const messages: {role: 'user' | 'assistant' | 'system' | 'tool'; content: string | any[]}[] = [
                {role: 'system', content: this.buildInstructions({sender, connectionType})},
                ...(cognitiveContext ? [{role: 'system' as const, content: `## Current Cognitive State\n${cognitiveContext}`}] : []),
                ...history.map(h => ({role: h.role, content: h.content})),
                {role: 'user', content: input},
            ];

            const {text, toolCalls} = await this.runLM(messages, 5);

            await this.episodicMemory?.log('response', text, {sender, channel: connectionType});

            if (conversation && text) {
                conversation.addMessage({role: 'assistant', content: text, timestamp: Date.now()}, this.lmClient);
            }
            this.turnCount++;

            const actions: TurnAction[] = toolCalls.map(tc => ({
                type: 'tool_call',
                content: tc.toolName,
            }));

            return {
                success: true,
                response: text || 'No response generated.',
                actions,
                metrics: {
                    durationMs: Date.now() - startTime,
                    cycleCount: this.cycleCount,
                    eventCount: toolCalls.length,
                },
            };
        } catch (error) {
            return {
                success: false,
                response: '',
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async handleReasoning(input: string, context?: ProcessContext): Promise<AgentResult> {
        if (!this.nar) return this.handleDefault(input, context);
        const startTime = Date.now();
        try {
            const derived = await this.nar.run(context?.reasoningDepth ?? 5);
            return {
                success: true,
                response: `Ran reasoning cycle, derived ${derived} new concepts.`,
                reasoning: {
                    steps: context?.reasoningDepth ?? 5,
                    newBeliefs: [],
                },
                metrics: {
                    durationMs: Date.now() - startTime,
                    cycleCount: this.cycleCount,
                    eventCount: derived,
                },
            };
        } catch (error) {
            return {
                success: false,
                response: '',
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    private async handleDefault(input: string, context?: ProcessContext): Promise<AgentResult> {
        if (this.nar) return this.handleNarsese(input, context);
        return {
            success: true,
            response: `Echo: ${input}`,
            metrics: {
                durationMs: 0,
                cycleCount: this.cycleCount,
                eventCount: 0,
            },
        };
    }

    private async recordTurn(success: boolean): Promise<void> {
        if (this.selfAnalyzer) {
            await this.selfAnalyzer.performMetaCognitiveReasoning();
        }
    }
}
