import {generateText, tool} from 'ai';
import {createAnthropic} from '@ai-sdk/anthropic';
import {ollama} from 'ollama-ai-provider-v2';
import type {NAR} from '../nar/nar.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {narsTools} from './tools/nars-tools.js';
import {generalTools} from './tools/general-tools.js';
import {CognitiveContextBuilder} from './CognitiveContext.js';
import {SelfAnalysisManager} from './SelfAnalysisManager.js';
import type {AIAgentConfig, BotConfig} from './types.js';
import type {ConversationState} from './ConversationState.js';
import type {Capabilities} from './BotContext.js';
import type {ScenarioRunner} from './scenarios/ScenarioRunner.js';
import type {ExperimentRunner} from './experiments/ExperimentRunner.js';

const ollamaProvider = ollama as unknown as (model: string) => ReturnType<typeof ollama>;

export class AIAgent {
  private readonly nar?: NAR;
  private readonly episodicMemory?: EpisodicMemory;
  private readonly config: BotConfig;
  private readonly capabilities: Capabilities;
  private readonly cognitiveContextBuilder?: CognitiveContextBuilder;
  private readonly selfAnalysisManager?: SelfAnalysisManager;
  private turnCount = 0;

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

    if (this.nar) {
      this.cognitiveContextBuilder = new CognitiveContextBuilder(this.nar);
      
      if (config.selfAnalysisConfig?.enabled) {
        this.selfAnalysisManager = new SelfAnalysisManager(
          this.nar,
          this.episodicMemory,
          config.scenarioRunner,
          config.experimentRunner,
          config.selfAnalysisConfig
        );
      }
    }
  }

  private getProvider() {
    if (process.env.ANTHROPIC_API_KEY) {
      return createAnthropic({apiKey: process.env.ANTHROPIC_API_KEY})('claude-sonnet-4-20250514');
    }
    if (process.env.OLLAMA_HOST) {
      return ollamaProvider('llama3.2');
    }
    throw new Error('No LM provider available');
  }

  private createTools() {
    const tools: Record<string, ReturnType<typeof tool>> = {};

    if (this.nar) {
      Object.assign(tools, narsTools(this.nar));
    }

    Object.assign(tools, generalTools({
      nar: this.nar,
      episodicMemory: this.episodicMemory,
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

  async chat(input: string, context: {sender: string; connectionType: string; conversation: ConversationState}): Promise<string> {
    const startTime = Date.now();
    await this.episodicMemory?.log('input', input, {
      sender: context.sender,
      channel: context.connectionType,
    });

    if (this.nar && this.cognitiveContextBuilder) {
      this.cognitiveContextBuilder.primeAttention(input);
    }

    const cognitiveContext = this.cognitiveContextBuilder
      ? await this.cognitiveContextBuilder.buildContext({
          conversation: context.conversation,
          maxConcepts: 15,
          maxQuestions: 5,
          maxGoals: 3,
        })
      : undefined;

    const history = context.conversation.getHistory(20);
    const messages: {role: 'user' | 'assistant' | 'system'; content: string}[] = [
      {role: 'system', content: this.buildInstructions()},
      ...(cognitiveContext ? [{role: 'system' as const, content: `## Current Cognitive State\n${cognitiveContext}`}] : []),
      ...history.map(h => ({role: h.role, content: h.content})),
      {role: 'user', content: input},
    ];

    try {
      const result = await generateText({
        model: this.getProvider() as Parameters<typeof generateText>[0]['model'],
        messages,
        tools: this.createTools(),
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
      await this.selfAnalysisManager?.recordTurn(true);
      
      if (this.selfAnalysisManager && await this.selfAnalysisManager.shouldAnalyze()) {
        await this.selfAnalysisManager.analyze();
      }

      return result.text;
    } catch (error) {
      await this.selfAnalysisManager?.recordTurn(false, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  getCapabilities(): Capabilities {
    return this.capabilities;
  }

  getSelfAnalysisSummary(): Promise<string> {
    return this.selfAnalysisManager?.generateSummary() ?? Promise.resolve('Self-analysis not enabled');
  }

  async getAnalysisReport() {
    return this.selfAnalysisManager?.analyze();
  }

  getTurnCount(): number {
    return this.turnCount;
  }
}