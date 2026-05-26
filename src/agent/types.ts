import type {NAR} from '../nar/nar.js';
import type {Capabilities, BotConfig, Belief, Message} from './BotContext.js';
import type {LMClient} from '../nar/lm/types.js';
import type {TurnAction} from './BotContext.js';

export type {BotConfig, Belief, Message};
export interface AIAgentConfig {
nar?: NAR;
episodicMemory?: import('../nar/memory/EpisodicMemory.js').EpisodicMemory;
provider: 'anthropic' | 'ollama' | 'transformers' | 'custom';
model?: string;
instructions?: string | SystemPromptBuilder;
languageModel?: unknown;
lmClient?: LMClient;
config: Partial<BotConfig>;
capabilities: Capabilities;
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

export interface ContextOptions {
maxConcepts?: number;
minPriority?: number;
maxQuestions?: number;
maxGoals?: number;
conversation?: import('./ConversationState.js').ConversationState;
}

export interface ConversationContext {
sender: string;
connectionType: string;
conversation: import('./ConversationState.js').ConversationState;
}

export interface ProcessContext {
sender?: string;
channel?: string;
connectionType?: string;
reasoningDepth?: number;
enableLM?: boolean;
enableNAR?: boolean;
timeout?: number;
}

export interface AgentResult {
success: boolean;
response: string;
reasoning?: {
steps: number;
newBeliefs: Belief[];
trace?: unknown[];
};
actions?: TurnAction[];
metrics?: {
durationMs: number;
cycleCount: number;
eventCount: number;
};
error?: string;
}

export type CognitiveState = 'normal' | 'confused' | 'bored' | 'overloaded' | 'idle';

export type CognitiveAction = 'continue' | 'resolve-conflicts' | 'explore' | 'consolidate' | 'suspend';

export interface CognitiveObserverReport {
state: CognitiveState;
action: CognitiveAction;
contradictions: number;
totalConcepts: number;
memoryPressure: number;
derivationsPerSecond: number;
suggestion?: string;
}