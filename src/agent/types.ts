import type {NAR} from '../nar/nar.js';
import type {EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import type {LMClient} from '../nar/lm/types.js';
import type {Connection} from '../io/types.js';
import type {NLAnalysis, Ambiguity} from '../nar/nl/analyzer.js';
import type {EventBus} from '../nar/types/events.js';
import type {BotProfile, BotConfig} from '../config/index.js';
import type {ChannelType} from './ChannelBehavior.js';

export type {BotConfig, BotProfile} from '../config/index.js';
export type {CognitiveState, CognitiveAction} from './services/ObserverService.js';

export interface SystemPromptBuilder {
    (deps: {nar?: NAR; config: BotConfig}): string;
}

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

export interface AIAgentConfig {
    nar?: NAR;
    episodicMemory?: EpisodicMemory;
    provider: 'anthropic' | 'ollama' | 'transformers' | 'custom';
    model?: string;
    instructions?: string | SystemPromptBuilder;
    lmClient?: LMClient;
    config: BotConfig;
    capabilities: Capabilities;
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

export type BotMode = 'auto' | 'chat' | 'reason';
export type Intent = 'chat' | 'reason' | 'query' | 'goal' | 'command' | 'narsese';

export interface TurnState {
    input: IOMessage;
    classification: InputClassification;
    reasoningTriggered: boolean;
    reasoningResult?: DerivationResult;
    queryAnswer?: string;
    lmResponse?: string;
    lmSuggestsReasoning: boolean;
    directives: LMDirective[];
    directiveResults: DirectiveResult[];
    toolResults: ToolResult[];
    commandResponses: string[];
    actions: TurnAction[];
    finalResponse: string;
    error?: Error;
    passCount: number;
    needsLoopBack: boolean;
    loopBackType?: string;
    reasoningDepthOverride?: number;
    nlAnalysis?: NLAnalysis;
}

export interface DerivationResult {
    steps: number;
    beliefs: Belief[];
    newBeliefs: Belief[];
    trace?: unknown[];
}

export interface Belief {
    term: string;
    truth?: {frequency: number; confidence: number};
}

export interface LMDirective {
    type: 'believe' | 'question' | 'tool_call' | 'reasoning_depth' | string;
    name: string;
    content: string;
    raw: string;
    _def?: DirectiveDef;
}

export interface DirectiveResult {
    directive: LMDirective;
    success: boolean;
    result?: unknown;
    error?: string;
    derivationSteps?: number;
}

export interface TurnAction {
    type: 'believe' | 'question' | 'goal' | 'tool_call';
    content: string;
    result?: string;
}

export interface ToolResult {
    name: string;
    result?: unknown;
    error?: string;
}

export interface TurnMetrics {
    startTime: number;
    stages: Map<string, {durationMs: number; error?: string}>;
}

export interface IOMessage {
    id: string;
    source: string;
    sender: string;
    text: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface Message {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface ConversationStateData {
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

export interface ReasoningArtifact {
    type: 'derivation' | 'tool_result' | 'belief_added' | 'question_answered';
    content: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
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

export interface BotResponse {
    text: string;
    reasoning?: DerivationResult;
    actions: TurnAction[];
    metrics?: TurnMetrics;
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
    canonicalId?: string;
    authId?: string;
    nick?: string;
    username?: string;
    hostmask?: string;
    respond: (text: string) => Promise<void>;
    stream: (stream: AsyncIterable<StreamChunk>) => Promise<void>;
}

export interface StreamChunk {
    type: 'text' | 'reasoning' | 'tool' | 'error' | 'status';
    content: string;
    done: boolean;
    metadata?: Record<string, unknown>;
}

export interface BotContext {
    profile: BotProfile;
    lm?: LMClient;
    seNARS?: NAR;
    connection: ConnectionInfo;
    conversation: ConversationStateData;
    turn: TurnState;
    config: BotConfig;
    capabilities: Capabilities;
    metrics: TurnMetrics;
    events: EventBus;
}

export interface DirectiveDef {
    pattern: RegExp;
    type: string;
    extract: (match: RegExpMatchArray) => {name?: string; content: string};
    execute: (nar: NAR, content: string, name?: string) => Promise<unknown>;
    triggersLoopBack: boolean;
}

export interface NLParserDef {
    name: string;
    match: (text: string) => boolean;
    translate: (text: string) => string | null;
}

export interface ClassificationSignalDef {
    type: 'keyword' | 'pattern' | 'structure' | 'narsese';
    pattern: RegExp;
    intent: Intent;
    weight: number;
}

export interface LMRuleConfigEntry {
    id: string;
    enabled: boolean;
    priority?: number;
    instruction?: string;
    context?: unknown[];
    maxCallsPerTurn?: number;
    budget?: number;
}

export interface LMRuleDef {
    id: string;
    context: unknown[];
    instruction: string;
    prompt?: string;
}

export type ContextFragment = (nar: NAR, ctx?: unknown) => string;

export interface AgentMetrics {
    cycleCount: number;
    isRunning: boolean;
    errorCount: number;
    lastActivity: number;
    narMetrics?: unknown;
    conversationMetrics?: unknown;
}

export type {Connection, Ambiguity};

// ---------------------------------------------------------------------------
// Phase 1: Route discriminated union. Replaces the legacy trio of
// `Intent` + `BotMode` + `InputClassification` for the new pipeline.
// The legacy types are kept for backward compatibility with existing call
// sites; new code should consume `Route`.
// ---------------------------------------------------------------------------

export type RouteKind = 'narsese-belief' | 'narsese-question' | 'command' | 'nl' | 'reason';

export type Route =
    | {kind: 'narsese-belief'; confidence: number; signals: RouteSignal[]; narsese?: string; concepts: string[]}
    | {kind: 'narsese-question'; confidence: number; signals: RouteSignal[]; narsese?: string; concepts: string[]}
    | {kind: 'command'; confidence: number; signals: RouteSignal[]; command: string; arguments?: string[]}
    | {kind: 'nl'; confidence: number; signals: RouteSignal[]; intent: string; concepts: string[]; ambiguity: number}
    | {kind: 'reason'; confidence: number; signals: RouteSignal[]; depth: number; trigger: string};

export interface RouteSignal {
    source: 'classifier' | 'nl-analyzer' | 'pattern' | 'keyword' | 'narsese-parser' | 'fallback';
    name: string;
    weight: number;
}

export interface ComposedRequest {
    system: string;
    messages: Array<{role: 'user' | 'assistant' | 'system' | 'tool'; content: string | unknown[]; timestamp?: number}>;
    tools: Record<string, unknown>;
    ctxHash: string;
    snapshot: CognitiveSnapshotData | null;
    budget: {systemTokens: number; historyTokens: number; snapshotTokens: number; total: number; maxTokens: number};
}

export interface CognitiveSnapshotData {
    attention: Array<{term: string; priority: number; urgency?: number; truth?: {f: number; c: number}}>;
    questions: string[];
    goals: string[];
    memory: {totalConcepts: number; totalTasks: number; workingMemorySize: number};
    episodes: Array<{timestamp: number; type: string; summary: string}>;
    summary?: string;
    pinnedBeliefs: string[];
    priorInsights?: string[];
    tokens: number;
    capturedAt: number;
}

export interface RequestComposerDeps {
    nar?: import('../nar/nar.js').NAR;
    episodicMemory?: import('../nar/memory/EpisodicMemory.js').EpisodicMemory;
    conversation?: import('./ConversationState.js').ConversationState;
    config: import('../config/index.js').BotConfig;
    instructions?: string;
    snapshot?: CognitiveSnapshotData | null;
    maxContextTokens?: number;
    priorInsights?: string[];
}

export interface ToolError {
    toolCallId: string;
    toolName: string;
    message: string;
}
