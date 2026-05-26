import {generateText, tool} from 'ai';
import type {NAR} from '../nar/nar.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {createNARSTools, createGeneralTools} from '../nar/tools/adapters/index.js';
import type {AIAgentConfig, BotConfig, ProcessContext, AgentResult, CognitiveState} from './types.js';
import type {ConversationState} from './ConversationState.js';
import type {Capabilities} from './BotContext.js';
import type {ScenarioRunner} from './scenarios/ScenarioRunner.js';
import type {ExperimentRunner} from './experiments/ExperimentRunner.js';
import type {LMClient} from '../nar/lm/types.js';
import {adapt} from '../nar/lm/adapters/index.js';
import {EventBus} from '../nar/types/events.js';
import {Belief, TurnAction} from './BotContext.js';

export class AIAgent {
private readonly nar?: NAR;
private readonly episodicMemory?: EpisodicMemory;
private readonly config: BotConfig;
private readonly capabilities: Capabilities;
private readonly provider: string;
private readonly languageModel?: ReturnType<typeof adapt>;
private readonly lmClient?: LMClient;
private turnCount = 0;

// Cognition state fields
private isRunning = true;
private cycleCount = 0;
private lastActivity = Date.now();
private errorCount = 0;
private eventBus: EventBus;

constructor(config: AIAgentConfig & {
selfAnalysisConfig?: {
enabled: boolean;
analysisInterval: number;
autoImprove: boolean;
maxImprovements: number;
};
scenarioRunner?: ScenarioRunner;
experimentRunner?: ExperimentRunner;
}) {
this.nar = config.nar;
this.episodicMemory = config.episodicMemory;
this.config = config.config as BotConfig;
this.capabilities = config.capabilities;
this.provider = config.provider ?? 'transformers';
this.lmClient = config.lmClient;
this.languageModel = config.languageModel
? config.languageModel as ReturnType<typeof adapt>
: config.lmClient ? adapt(config.lmClient) : undefined;
this.eventBus = new EventBus();
}

  private createTools() {
    const tools: Record<string, unknown> = {};

    if (this.nar) {
      Object.assign(tools, createNARSTools(this.nar));
    }

    Object.assign(tools, createGeneralTools({
      nar: this.nar,
      episodicMemory: this.episodicMemory as {getEpisodes(options: {limit: number; type?: string}): Promise<unknown[]>} | undefined,
    }));

    return tools;
  }

  private buildInstructions(): string {
    const mode = this.capabilities.mode;

    if (mode === 'full') {
      return `You are an intelligent assistant with access to a formal reasoning engine (SeNARS).

## Capabilities
- You can suggest logical analysis by including: [REASONING_SUGGESTED: brief reason]
- You can add beliefs: [BELIEVE: (<term --> category>. :frequency:confidence)]
- You can ask questions: [QUESTION: (<term --> ?>.)]

## When to Use Reasoning
- Causal questions ("why", "how", "therefore")
- Logical puzzles and syllogisms
- Comparisons and contrasts
- Contradictions or conflicting information
- Multi-hop inference patterns

## Response Guidelines
- Be concise and direct
- Acknowledge uncertainty when present
- Don't fabricate facts
- Use reasoning engine for formal logic, not for conversational chat`;
    }

    if (mode === 'lm-only') {
      return `You are a helpful conversational AI assistant.

## Capabilities
- Natural conversation
- Tool usage when appropriate
- Factual questions within your training

## Guidelines
- Be concise and direct
- Acknowledge uncertainty
- Don't fabricate facts`;
    }

    return `SeNARS Reasoning Engine — Narsese Input Mode

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

  private buildCognitiveContext(conversation?: ConversationState): string {
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

    return parts.join('\n');
  }

  async chat(input: string, context: {sender: string; connectionType: string; conversation: ConversationState}): Promise<string> {
    const startTime = Date.now();
    await this.episodicMemory?.log('input', input, {
      sender: context.sender,
      channel: context.connectionType,
    });

    if (this.nar) {
      this.primeAttention(input);
    }

    const cognitiveContext = this.nar ? this.buildCognitiveContext(context.conversation) : undefined;

    const history = context.conversation.getHistory(20);
    const messages: {role: 'user' | 'assistant' | 'system'; content: string}[] = [
      {role: 'system', content: this.buildInstructions()},
      ...(cognitiveContext ? [{role: 'system' as const, content: `## Current Cognitive State\n${cognitiveContext}`}] : []),
      ...history.map(h => ({role: h.role, content: h.content})),
      {role: 'user', content: input},
    ];

    try {
      const result = await generateText({
        model: this.languageModel as any,
        messages,
        tools: this.createTools() as any,
        maxOutputTokens: 2048,
      });

      await this.episodicMemory?.log('response', result.text, {
        sender: context.sender,
        channel: context.connectionType,
      });

    context.conversation.addMessage({
      role: 'assistant',
      content: result.text,
      timestamp: Date.now(),
    });

    this.turnCount++;

    return result.text;
  } catch (error) {
    throw error;
  }
  }

  getCapabilities(): Capabilities {
    return this.capabilities;
  }

getTurnCount(): number {
return this.turnCount;
}

async process(input: string, context?: ProcessContext): Promise<AgentResult> {
const startTime = Date.now();
this.eventBus.emit('agent:process:start', { input, context });

try {
const classification = this.classify(input);
let result: AgentResult;

if (classification.primary === 'narsese') {
result = await this.handleNarsese(input, context);
} else if (classification.primary === 'reason') {
result = await this.handleReasoning(input, context);
} else {
result = await this.handleChat(input, context);
}

if (context?.reasoningDepth) {
await this.recordTurn(true);
}

this.eventBus.emit('agent:process:complete', {
result,
durationMs: Date.now() - startTime
});

this.lastActivity = Date.now();
this.cycleCount++;

return result;
} catch (error) {
this.errorCount++;
this.eventBus.emit('error', {
error: error instanceof Error ? error : new Error(String(error)),
context: { input, stage: 'process' }
});

return {
success: false,
response: '',
error: error instanceof Error ? error.message : String(error),
metrics: {
durationMs: Date.now() - startTime,
cycleCount: this.cycleCount,
eventCount: 0
}
};
}
}

async reason(input: string, steps?: number): Promise<Belief[]> {
const result = await this.process(input, { reasoningDepth: steps });
return (result.reasoning?.newBeliefs as Belief[]) ?? [];
}

async suspend(): Promise<void> {
this.isRunning = false;
this.eventBus.emit('agent:suspend', {
cycleCount: this.cycleCount,
lastActivity: this.lastActivity
});
}

async resume(): Promise<void> {
this.isRunning = true;
this.eventBus.emit('agent:resume', {
cycleCount: this.cycleCount,
lastActivity: this.lastActivity
});
}

getMetrics(): {
cycleCount: number;
isRunning: boolean;
errorCount: number;
lastActivity: number;
narMetrics?: unknown;
conversationMetrics?: unknown;
} {
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

private classify(input: string): { primary: 'narsese' | 'chat' | 'reason'; confidence: number; signals: string[] } {
const isNarsese = input.includes('-->') || input.includes('?') || input.startsWith('(');
const isReasoning = input.toLowerCase().includes('why') ||
input.toLowerCase().includes('how') ||
input.toLowerCase().includes('therefore');

return {
primary: isNarsese ? 'narsese' : isReasoning ? 'reason' : 'chat',
confidence: 0.8,
signals: [],
};
}

private async handleNarsese(input: string, context?: ProcessContext): Promise<AgentResult> {
if (!this.nar) {
return {
success: false,
response: 'NAR not initialized',
error: 'NAR engine not available'
};
}

try {
const steps = context?.reasoningDepth ?? 5;

return {
success: true,
response: `Processed: ${input}`,
reasoning: {
steps,
newBeliefs: [],
trace: []
},
metrics: {
durationMs: 0,
cycleCount: this.cycleCount,
eventCount: 0
}
};
} catch (error) {
return {
success: false,
response: '',
error: error instanceof Error ? error.message : String(error)
};
}
}

private async handleChat(input: string, context?: ProcessContext): Promise<AgentResult> {
if (this.languageModel) {
return {
success: true,
response: `Chat response to: ${input}`,
metrics: {
durationMs: 0,
cycleCount: this.cycleCount,
eventCount: 0
}
};
}

return this.handleDefault(input, context);
}

private async handleReasoning(input: string, context?: ProcessContext): Promise<AgentResult> {
return this.handleNarsese(input, context);
}

private async handleDefault(input: string, context?: ProcessContext): Promise<AgentResult> {
if (this.nar) {
return this.handleNarsese(input, context);
}

return {
success: true,
response: `Echo: ${input}`,
metrics: {
durationMs: 0,
cycleCount: this.cycleCount,
eventCount: 0
}
};
}

private async recordTurn(success: boolean): Promise<void> {
// Self-analysis integration point
}
}