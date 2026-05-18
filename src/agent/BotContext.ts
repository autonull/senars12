import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {Connection} from '../io/types.js';
import type {BotProfile} from './BotProfile.js';
import type {ChannelType} from './ChannelBehavior.js';

export type BotMode = 'auto' | 'chat' | 'reason';
export type Intent = 'chat' | 'reason' | 'query' | 'goal' | 'command' | 'narsese';

export interface BotConfig {
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

export interface Capabilities {
    hasLM: boolean;
    hasSeNARS: boolean;
    hasStreaming: boolean;
    hasTools: boolean;
    hasMemory: boolean;
    mode: 'full' | 'lm-only' | 'senars-only';
}

export interface ConnectionInfo {
    id: string;
    type: ChannelType;
    sender: string;
    respond: (text: string | StreamChunk) => Promise<void>;
    stream: (stream: AsyncIterable<StreamChunk>) => Promise<void>;
}

export interface StreamChunk {
    type: 'text' | 'reasoning' | 'tool' | 'error' | 'status';
    content: string;
    done: boolean;
    metadata?: Record<string, unknown>;
}

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface ReasoningArtifact {
    type: 'derivation' | 'tool_result' | 'belief_added' | 'question_answered';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface ConversationState {
    messages: Message[];
    summary?: string;
    workingMemory: Map<string, unknown>;
    reasoningArtifacts: ReasoningArtifact[];
    pinnedBeliefs: Set<string>;
    lastClassification?: InputClassification;
    mode: BotMode;
    addMessage(msg: Message, lm?: LMClient): void;
    getHistory(limit?: number): Message[];
    getContextForLM(maxConcepts: number, nar: NAR): string;
    set(key: string, value: unknown): void;
    get<T>(key: string): T | undefined;
    addArtifact(artifact: ReasoningArtifact): void;
    getRecentArtifacts(limit?: number): ReasoningArtifact[];
    pin(belief: string): void;
    unpin(belief: string): void;
    getPinned(): string[];
}

export interface InputClassification {
    primary: Intent;
    secondary?: Intent;
    confidence: number;
    signals: ClassificationSignal[];
    narseseTerms?: string[];
}

export interface ClassificationSignal {
    type: 'keyword' | 'pattern' | 'structure' | 'lm-suggestion' | 'narsese';
    source: string;
    intent: Intent;
    weight: number;
}

export interface DerivationResult {
    steps: number;
    beliefs: Belief[];
}

export interface Belief {
    term: string;
    truth?: { frequency: number; confidence: number };
}

export interface ToolResult {
    name: string;
    result?: unknown;
    error?: string;
}

export interface TurnAction {
    type: 'believe' | 'question' | 'goal' | 'tool_call';
    content: string;
    result?: string;
}

export interface TurnState {
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

export interface IOMessage {
    id: string;
    source: string;
    sender: string;
    text: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface BotContext {
    profile: BotProfile;
    lm?: LMClient;
    seNARS?: NAR;
    connection: ConnectionInfo;
    conversation: ConversationState;
    turn: TurnState;
    config: BotConfig;
    capabilities: Capabilities;
}

export interface BotResponse {
    text: string;
    reasoning?: DerivationResult;
    actions: TurnAction[];
}

export interface Capabilities {
    hasLM: boolean;
    hasSeNARS: boolean;
    hasStreaming: boolean;
    hasTools: boolean;
    hasMemory: boolean;
    mode: 'full' | 'lm-only' | 'senars-only';
}

export function detectCapabilities(lm?: LMClient, seNARS?: NAR): Capabilities {
    const hasLM = !!lm && lm.available !== false;
    const hasSeNARS = !!seNARS;
    const mode = hasLM && hasSeNARS ? 'full'
        : hasLM ? 'lm-only'
        : hasSeNARS ? 'senars-only'
        : (() => { throw new Error('At least one capability required'); })();

    return {
        hasLM,
        hasSeNARS,
        hasStreaming: hasLM && lm!.provider !== undefined,
        hasTools: hasSeNARS && seNARS!.tools !== undefined && seNARS!.tools.list().length > 0,
        hasMemory: hasSeNARS && !!seNARS!.memory,
        mode,
    };
}