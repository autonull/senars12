import type {NAR} from '../nar/nar.js';
import type {Capabilities} from './BotContext.js';

export interface AIAgentConfig {
  nar?: NAR;
  episodicMemory?: import('../nar/memory/EpisodicMemory.js').EpisodicMemory;
  provider: 'anthropic' | 'ollama' | 'transformers' | 'custom';
  model?: string;
  instructions?: string | SystemPromptBuilder;
  languageModel?: import('ai').LanguageModel;
  config: Partial<BotConfig>;
  capabilities: Capabilities;
}

export interface BotConfig {
  reasoning: {
    autoTrigger: boolean;
    triggerThreshold: number;
    triggerCooldown: number;
    maxStepsPerTrigger: number;
    backgroundReasoning: boolean;
    backgroundIntervalMs: number;
    lmDriven: boolean;
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
  prompts: {
    system?: string;
    directiveInstructions?: string;
    responseGuidelines?: string;
  };
}

export type SystemPromptBuilder = (deps: {nar?: NAR; config: Partial<BotConfig>}) => string;

export interface CognitiveSnapshot {
  attention: AttentionReport;
  workingBeliefs: Belief[];
  recentDerivations: string[];
  unansweredQuestions: string[];
  activeGoals: string[];
  memoryState: {
    totalConcepts: number;
    totalTasks: number;
    workingMemorySize: number;
  };
}

export interface AttentionReport {
  concepts: Array<{term: string; priority: number; urgency?: number}>;
  total: number;
}

export interface Belief {
  term: string;
  truth?: {frequency: number; confidence: number};
}

export interface ContextOptions {
  maxConcepts?: number;
  minPriority?: number;
  maxQuestions?: number;
  maxGoals?: number;
  conversation?: import('./ConversationState.js').ConversationState;
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationContext {
  sender: string;
  connectionType: string;
  conversation: import('./ConversationState.js').ConversationState;
}