import type {NAR, Task} from '../../nar/src';
import type {LMService} from '../../nar/src/lm';
import type {Logger} from '../../nar/src/logger';
import type {EpisodicMemory} from '../../nar/src/memory/EpisodicMemory.js';
import type {ContextAssemblerOpts} from '../../nar/src/nl';
import type {ApprovalManager} from '../../nar/src/tools/adapters';
import type {AutonomousLoop} from './AutonomousLoop.js';
import type {AutonomyEngine} from './AutonomyEngine.js';
import type {ConversationSession} from './ConversationSession.js';
import type {EventKey, EventMap} from './EventBus.js';

export type {LMService} from '../../nar/src/lm';

export interface RLFPState {
    enabled: boolean;
    policy: Record<string, number>;
    qValues: Record<string, number>;
    explorationRate: number;
    totalRewards: number;
    totalSteps: number;
}

export interface SelfReasoningState {
    qualityScore: number;
    consistency: number;
    gaps: string[];
    suggestions: string[];
}

export interface QualityMetrics {
    overall: number;
    coherence: number;
    relevance: number;
    completeness: number;
}

export interface GoalProgress {
    goalId: string;
    term: string;
    progress: number;
    status: 'active' | 'completed' | 'failed' | 'paused';
    subgoals: GoalProgress[];
    startedAt: number;
    updatedAt: number;
}

export interface ExplanationChain {
    conclusion: string;
    premises: ExplanationChain[];
    rule: string;
    confidence: number;
}

export interface RuleTrace {
    ruleId: string;
    ruleName: string;
    input: { primary: string; secondary?: string };
    output: { tasks: string[]; durationMs: number };
    timestamp: number;
}

export interface LMRuleStats {
    id: string;
    name: string;
    enabled: boolean;
    stats: {
        totalCalls: number;
        successfulCalls: number;
        failedCalls: number;
        totalDuration: number;
        totalTokens: number;
        averageDuration: number;
        successRate: number;
        totalCost: number;
        averageCost: number;
    };
    circuitState: 'closed' | 'open' | 'half-open';
}

export interface LMRuleExecutionEntry {
    ruleName: string;
    status: 'fired' | 'skipped' | 'timeout' | 'aborted';
    durationMs: number;
    tasksProduced: number;
    timestamp: number;
}

export interface ChatOpts {
    historyLimit?: number;
    signal?: AbortSignal;
}

export type StreamEvent =
    | { kind: 'text-delta'; text: string }
    | { kind: 'tool-call'; toolName: string; toolArgs: Record<string, unknown> }
    | {
    kind: 'tool-result';
    toolName: string;
    toolArgs: Record<string, unknown>;
    toolResult: unknown;
}
    | { kind: 'finish'; text: string }
    | { kind: 'aborted' }
    | { kind: 'error'; error: string }
    | { kind: 'clarify'; text: string }
    | { kind: 'lm-rule-applied'; ruleId: string; ruleName: string; tasksProduced: number };

export interface AgentEventMap {
    'agent:process:start': { input: string; sessionKey?: string; timestamp: number };
    'agent:process:complete': {
        input: string;
        output: string;
        durationMs: number;
        sessionKey?: string;
        tokens?: { input: number; output: number; total: number };
        timestamp: number;
    };
    'agent:process:error': { input: string; error: string; sessionKey?: string; timestamp: number };
    'agent:suspend': { timestamp: number };
    'agent:resume': { timestamp: number };
}

export interface DerivationEntry {
    term: string;
    truth?: { f: number; c: number };
    timestamp: number;
}

export interface NARState {
    beliefs: Task[];
    goals: Task[];
    questions: Task[];
    attention: { totalConcepts: number; pressure: number };
    drives: Record<string, number>;
}

export interface SessionSnapshot {
    key: string;
    history: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>;
    pinnedBeliefs: string[];
    createdAt: number;
    updatedAt: number;
}

export interface AgentOptions {
    nar?: NAR;
    lmService?: LMService;
    lmClient?: LMService;
    episodicMemory?: EpisodicMemory;
    systemInstructions?: string;
    context?: ContextAssemblerOpts;
    maxLoops?: number;
    logger?: Logger;
    workspaceRoot?: string;
    externalTools?: {
        webSearch?: { apiKey?: string };
        codeExec?: { maxTimeout?: number; maxOutputBytes?: number };
        fs?: { maxReadSize?: number };
    };
    approvalManager?: ApprovalManager;
    autonomyEngine?: AutonomyEngine;
    autonomousLoop?: AutonomousLoop;
    persistKnowledge?: boolean;
    knowledgePath?: string;
    reasoningIntervalMs?: number;
    sessionHistoryLimit?: number;
    rateLimitPerMinute?: number;
    enableNlTranslation?: boolean;
    enableNarseseHumanization?: boolean;
}

export interface ChatOptions {
    historyLimit?: number;
    signal?: AbortSignal;
    session?: ConversationSession;
    stream?: boolean;
}

export interface ChatStreamEvent {
    kind: 'text-delta' | 'tool-call' | 'tool-result' | 'finish' | 'aborted' | 'error';
    text?: string;
    error?: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: unknown;
}

export interface AgentStats {
    totalChats: number;
    successfulChats: number;
    failedChats: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalTokens: number;
    totalDurationMs: number;
    averageDurationMs: number;
    startedAt: number;
}

export interface Agent {
    chat(input: string, opts?: ChatOptions & { stream?: false }): Promise<string>;

    chat(
        input: string,
        opts: ChatOptions & { stream: true }
    ): AsyncGenerator<ChatStreamEvent, string>;

    /** @deprecated Use chat(input, { session }) instead */
    chatWithHistory(input: string, session: ConversationSession, opts?: ChatOptions): Promise<string>;

    /** @deprecated Use chat(input, { stream: true, session }) instead */
    chatStream(
        input: string,
        session?: ConversationSession,
        opts?: ChatOptions
    ): AsyncGenerator<ChatStreamEvent, string>;

    believe(narsese: string): Promise<void>;

    recall(
        query?: string,
        limit?: number
    ): Promise<Array<{ timestamp: number; type: string; content: string }>>;

    know(key: string, value: string): void;

    knowGet(key: string): string | undefined;

    knowList(): Array<{ key: string; value: string }>;

    start(): () => void;

    stop(): void;

    pause(): void;

    resume(): void;

    setThrottle(percent: number): void;

    getThrottle(): number;

    getNAR(): NAR | undefined;

    getEpisodicMemory(): EpisodicMemory | undefined;

    getLogger(): Logger;

    getStats(): AgentStats;

    getRecentDerivations(): DerivationEntry[];

    resolveApproval(id: string, approved: boolean, reason?: string): boolean;

    getPendingApprovals(): Array<{ id: string; request: string; createdAt: number }>;

    getLmRuleStats(): Array<{
        id: string;
        name: string;
        enabled: boolean;
        stats: {
            totalCalls: number;
            successfulCalls: number;
            failedCalls: number;
            totalDuration: number;
            totalTokens: number;
            averageDuration: number;
            successRate: number;
            totalCost: number;
            averageCost: number;
        };
        circuitState: 'closed' | 'open' | 'half-open';
    }>;

    getLmRuleExecutionLog(): Array<{
        ruleName: string;
        status: 'fired' | 'skipped' | 'timeout' | 'aborted';
        durationMs: number;
        tasksProduced: number;
        timestamp: number;
    }>;

    enableLmRule(id: string): void;

    disableLmRule(id: string): void;

    setLmRulePriority(id: string, priority: number): void;

    getAutonomyEngine(): AutonomyEngine | undefined;

    getAutonomousLoop(): AutonomousLoop | undefined;

    getRLFPState(): {
        enabled: boolean;
        policy: Record<string, number>;
        qValues: Record<string, number>;
        explorationRate: number;
        totalRewards: number;
        totalSteps: number;
    } | null;

    resetRLFP(): void;

    provideRLFPFeedback(reward: number, context?: string): void;

    getSelfReasoning(): {
        qualityScore: number;
        consistency: number;
        gaps: string[];
        suggestions: string[];
    } | null;

    getReasoningQuality(): {
        overall: number;
        coherence: number;
        relevance: number;
        completeness: number;
    } | null;

    explainBelief(
        term: string
    ): Promise<{ explanation: string; confidence: number; premises: string[] } | null>;

    explainGoal(
        term: string
    ): Promise<{ explanation: string; confidence: number; premises: string[] } | null>;

    traceRule(
        ruleId: string,
        term: string
    ): Promise<{
        ruleName: string;
        input: string;
        output: string;
        confidence: number;
    } | null>;

    getGoalProgress(goalId: string): Promise<{
        goalId: string;
        progress: number;
        status: 'active' | 'completed' | 'failed';
        subgoals: string[];
    } | null>;

    listActiveGoals(): Promise<
        Array<{ goalId: string; term: string; progress: number; status: string }>
    >;

    explainInNaturalLanguage(term: string): Promise<string | null>;

    on<K extends EventKey>(event: K, listener: (payload: EventMap[K]) => void): () => void;

    off<K extends EventKey>(event: K, listener: (payload: EventMap[K]) => void): void;

    on<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): () => void;

    off<K extends keyof EventMap>(event: K, listener: (payload: EventMap[K]) => void): void;
}
