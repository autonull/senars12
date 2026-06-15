import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {EpisodeType, EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {ContextAssembler, type ContextAssemblerOpts} from '../nar/nl/context-assembler.js';
import {NLUnderstandingService} from '../nar/nl/understanding.js';
import {NLGenerationService} from '../nar/nl/generation.js';
import {TranslationCache} from '../nar/nl/cache.js';
import {
    createNARSTools,
    createGeneralTools,
    createWebSearchTools,
    createHTTPFetchTools,
    createCodeExecTools,
    createFileSystemTools,
    createRagQueryTools,
    ApprovalManager,
    createHumanApprovalTool,
} from '../nar/tools/adapters/index.js';
import {ModelRunner} from './model/ModelRunner.js';
import {buildAgentTools} from './tools.js';
import type {ConversationSession} from './ConversationSession.js';
import {DEFAULT_SESSION_HISTORY_LIMIT} from './ConversationSession.js';
import {formatHistoryAsMessages} from './chat-history.js';
import {createLogger, type Logger} from '../nar/logger/index.js';
import {AgentEventBus, type AgentEventKind, type AgentEventPayloads} from './AgentEventBus.js';
import {AutonomyEngine, createAutonomyEngine} from './AutonomyEngine.js';
import {SystemEventBus, type SystemEventMap} from './SystemEventBus.js';
import {validateAgentOptions} from './options-schema.js';
import {processInput, appendSessionTurns, type InputEvent} from './input-processor.js';

const REASONING_INTERVAL_MS = 60_000;
const MAX_REASON_STEPS_PER_TICK = 5;
const MIN_REASON_STEPS_PER_TICK = 1;
const MAX_RECENT_DERIVATIONS = 50;

export interface AgentOptions {
    nar?: NAR;
    lmClient?: LMClient;
    episodicMemory?: EpisodicMemory;
    systemInstructions?: string;
    context?: ContextAssemblerOpts;
    maxLoops?: number;
    logger?: Logger;
    workspaceRoot?: string;
    externalTools?: {
        webSearch?: {apiKey?: string};
        codeExec?: {maxTimeout?: number; maxOutputBytes?: number};
        fs?: {maxReadSize?: number};
    };
    approvalManager?: ApprovalManager;
    autonomyEngine?: AutonomyEngine;
    persistKnowledge?: boolean;
    knowledgePath?: string;
}

export interface ChatOptions {
    historyLimit?: number;
    signal?: AbortSignal;
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

export interface DerivationEntry {
    term: string;
    truth?: {f: number; c: number};
    timestamp: number;
}

export interface Agent {
    chat(input: string, opts?: ChatOptions): Promise<string>;
    chatWithHistory(input: string, session: ConversationSession, opts?: ChatOptions): Promise<string>;
    chatStream(input: string, session?: ConversationSession, opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string>;
    believe(narsese: string): Promise<void>;
    recall(query?: string, limit?: number): Promise<Array<{timestamp: number; type: string; content: string}>>;
    know(key: string, value: string): void;
    knowGet(key: string): string | undefined;
    knowList(): Array<{key: string; value: string}>;
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
    getPendingApprovals(): Array<{id: string; request: string; createdAt: number}>;
    getLmRuleStats(): Array<{id: string; name: string; enabled: boolean; stats: {totalCalls: number; successfulCalls: number; failedCalls: number; totalDuration: number; totalTokens: number; averageDuration: number; successRate: number; totalCost: number; averageCost: number}; circuitState: 'closed' | 'open' | 'half-open'}>;
    getLmRuleExecutionLog(): Array<{ruleName: string; status: 'fired' | 'skipped' | 'timeout' | 'aborted'; durationMs: number; tasksProduced: number; timestamp: number}>;
    enableLmRule(id: string): void;
    disableLmRule(id: string): void;
    setLmRulePriority(id: string, priority: number): void;
    getAutonomyEngine(): AutonomyEngine | undefined;
    getRLFPState(): {enabled: boolean; policy: Record<string, number>; qValues: Record<string, number>; explorationRate: number; totalRewards: number; totalSteps: number} | null;
    resetRLFP(): void;
    getSelfReasoning(): {qualityScore: number; consistency: number; gaps: string[]; suggestions: string[]} | null;
    getReasoningQuality(): {overall: number; coherence: number; relevance: number; completeness: number} | null;
    explainBelief(term: string): Promise<{explanation: string; confidence: number; premises: string[]} | null>;
    explainGoal(term: string): Promise<{explanation: string; confidence: number; premises: string[]} | null>;
    traceRule(ruleId: string, term: string): Promise<{ruleName: string; input: string; output: string; confidence: number} | null>;
    on<K extends AgentEventKind>(event: K, listener: (payload: AgentEventPayloads[K]) => void): () => void;
    off<K extends AgentEventKind>(event: K, listener: (payload: AgentEventPayloads[K]) => void): void;
    on<K extends keyof SystemEventMap>(event: K, listener: (payload: SystemEventMap[K]) => void): () => void;
    off<K extends keyof SystemEventMap>(event: K, listener: (payload: SystemEventMap[K]) => void): void;
}

    const toEventTokens = (u: {inputTokens: number; outputTokens: number; totalTokens: number}) => ({
        input: u.inputTokens,
        output: u.outputTokens,
        total: u.totalTokens,
    });

    export function createAgent(opts: AgentOptions = {}): Agent {
        validateAgentOptions(opts);
        const {
            nar,
            lmClient,
            episodicMemory,
            systemInstructions,
            context: contextOpts = {},
            maxLoops = 5,
            logger = createLogger({scope: 'agent'}),
            workspaceRoot = process.cwd(),
            externalTools: extToolOpts = {},
            approvalManager: externalApprovalManager,
            persistKnowledge = false,
            knowledgePath = '.cache/agent-knowledge.json',
        } = opts;

        const runner = new ModelRunner({lmClient, maxLoops});
        const knowledge = new Map<string, string>();

        if (persistKnowledge) {
            try {
                const fs = require('fs');
                const path = require('path');
                const fullPath = path.resolve(workspaceRoot, knowledgePath);
                if (fs.existsSync(fullPath)) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    const data = JSON.parse(content);
                    if (data && typeof data === 'object') {
                        for (const [key, value] of Object.entries(data)) {
                            knowledge.set(key, String(value));
                        }
                    }
                }
            } catch {
                // Ignore load errors
            }
        }

        const saveKnowledge = (): void => {
            if (!persistKnowledge) return;
            try {
                const fs = require('fs');
                const path = require('path');
                const fullPath = path.resolve(workspaceRoot, knowledgePath);
                const dir = path.dirname(fullPath);
                if (!fs.existsSync(dir)) {
                    fs.mkdirSync(dir, {recursive: true});
                }
                const data = Object.fromEntries(knowledge);
                fs.writeFileSync(fullPath, JSON.stringify(data, null, 2), 'utf-8');
            } catch {
                // Ignore save errors
            }
        };
        const sessionInstructions = new WeakMap<ConversationSession, string>();
        const sessionScratchpad = new WeakMap<ConversationSession, Map<string, string>>();
        const eventBus = new AgentEventBus();
        const approvalManager = externalApprovalManager ?? new ApprovalManager();
        const translationCache = new TranslationCache();
        const narRegistry = nar?.getProviderRegistry?.();
        const systemEventBus = nar?.getSystemEventBus?.();
        const contextAssembler = nar ? new ContextAssembler(translationCache) : undefined;
        const understandingService = nar && narRegistry ? new NLUnderstandingService(
            narRegistry,
            translationCache,
            {structuredOnly: true}
        ) : undefined;
        const generationService = nar && narRegistry ? new NLGenerationService(
            narRegistry
        ) : undefined;
        let throttle = 100;
        let reasoningHandle: ReturnType<typeof setInterval> | undefined;
        let autonomyEngine: AutonomyEngine | undefined;
        const recentDerivations: DerivationEntry[] = [];

    const stats: AgentStats = {
        totalChats: 0,
        successfulChats: 0,
        failedChats: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalDurationMs: 0,
        averageDurationMs: 0,
        startedAt: Date.now(),
    };

    const recordStats = (outcome: 'success' | 'failure', durationMs: number, tokens?: {inputTokens: number; outputTokens: number; totalTokens: number}): void => {
        stats.totalChats++;
        if (outcome === 'success') stats.successfulChats++;
        else stats.failedChats++;
        stats.totalDurationMs += durationMs;
        stats.averageDurationMs = stats.totalDurationMs / stats.totalChats;
        if (tokens) {
            stats.totalInputTokens += tokens.inputTokens;
            stats.totalOutputTokens += tokens.outputTokens;
            stats.totalTokens += tokens.totalTokens;
        }
    };

    const safeLog = (type: EpisodeType, content: string, metadata: Record<string, unknown> = {}): void => {
        if (!episodicMemory) return;
        episodicMemory.log(type, content, metadata).catch(err => {
            logger.warn('episodic memory log failed', {
                type,
                error: err instanceof Error ? err.message : String(err),
            });
        });
    };

    const captureDerivations = async (count: number): Promise<void> => {
        if (!nar || count <= 0) return;
        try {
            const beliefs = nar.getBeliefs();
            const recent = beliefs.slice(-count);
            for (const b of recent) {
                const entry: DerivationEntry = {
                    term: b.term.toString(),
                    truth: b.truth ? {f: b.truth.f, c: b.truth.c} : undefined,
                    timestamp: Date.now(),
                };
                recentDerivations.push(entry);
            }
            if (recentDerivations.length > MAX_RECENT_DERIVATIONS) {
                recentDerivations.splice(0, recentDerivations.length - MAX_RECENT_DERIVATIONS);
            }
        } catch {
            // derivation capture is best-effort
        }
    };

    const getScratchpad = (session?: ConversationSession): Map<string, string> | undefined => {
        if (!session) return undefined;
        let pad = sessionScratchpad.get(session);
        if (!pad) {
            pad = new Map();
            sessionScratchpad.set(session, pad);
        }
        return pad;
    };

    const buildSystemPrompt = async (input: string, session?: ConversationSession): Promise<string> => {
        const instruction = session ? sessionInstructions.get(session) : systemInstructions;
        const parts: string[] = [];

        const constitution = nar?.getConstitution?.() ?? [];
        if (constitution.length > 0) {
            parts.push('## Constitution');
            for (const b of constitution) {
                parts.push((b as {term: {toString(): string}}).term.toString());
            }
        }

        if (instruction) {
            parts.push('## Instructions');
            parts.push(instruction);
        }

        const pad = getScratchpad(session);
        if (pad && pad.size > 0) {
            parts.push('## Session Context');
            for (const [k, v] of pad) {
                parts.push(`${k}: ${v}`);
            }
        }

        if (recentDerivations.length > 0) {
            parts.push('## Recent Derivations');
            for (const d of recentDerivations.slice(-10)) {
                const truth = d.truth ? ` (f=${d.truth.f.toFixed(2)} c=${d.truth.c.toFixed(2)})` : '';
                parts.push(`${d.term}${truth}`);
            }
        }

        if (nar && contextAssembler) {
            const nlContext = contextAssembler.assemble(nar, input, contextOpts);
            const stateParts: string[] = [];
            if (nlContext.beliefs && nlContext.beliefs.length > 0) {
                stateParts.push('Related beliefs:');
                for (const b of nlContext.beliefs) {
                    stateParts.push(`  ${b}`);
                }
            }
            if (nlContext.activeGoals && nlContext.activeGoals.length > 0) {
                stateParts.push('Active goals:');
                for (const g of nlContext.activeGoals) {
                    stateParts.push(`  ${g}`);
                }
            }
            if (nlContext.recentDerivations && nlContext.recentDerivations.length > 0) {
                stateParts.push('Recent derivations:');
                for (const d of nlContext.recentDerivations) {
                    stateParts.push(`  ${d}`);
                }
            }
            if (nlContext.memoryHealth) {
                stateParts.push(`Memory: ${nlContext.memoryHealth.totalConcepts} concepts, pressure ${(nlContext.memoryHealth.pressure * 100).toFixed(0)}%`);
            }
            if (stateParts.length > 0) {
                parts.push('## Cognitive State');
                parts.push(stateParts.join('\n'));
            }
        }

        parts.push('## Tool Use Strategy');
        parts.push('Think step by step. Use tools when needed. Be concise.');

        return parts.join('\n\n');
    };

    const buildTools = (session?: ConversationSession): Record<string, unknown> => {
        const tools: Record<string, unknown> = {};
        if (nar) {
            Object.assign(tools, createNARSTools(nar as Parameters<typeof createNARSTools>[0]));
            Object.assign(tools, createGeneralTools({
                nar: nar as Parameters<typeof createGeneralTools>[0]['nar'],
                episodicMemory: episodicMemory as Parameters<typeof createGeneralTools>[0]['episodicMemory'],
            }));
        }
        Object.assign(tools, buildAgentTools({
            know: (k: string, v: string) => { knowledge.set(k, v); safeLog('input', v, {kind: 'knowledge', key: k}); },
            knowGet: (k: string) => knowledge.get(k),
            knowList: () => [...knowledge.entries()].map(([key, value]) => ({key, value})),
            recall: (q?: string, l?: number) => recallFromMemory(q, l),
            setInstructions: session ? (mode, instructions) => {
                const existing = sessionInstructions.get(session) ?? '';
                sessionInstructions.set(session, mode === 'replace' ? instructions : (existing ? `${existing}\n${instructions}` : instructions));
            } : undefined,
            getSessionInfo: session ? () => ({
                messageCount: session.history.length,
                createdAt: session.createdAt,
                pinnedBeliefs: [...session.pinnedBeliefs],
            }) : undefined,
        }));

        if (session) {
            const pad = getScratchpad(session);
            if (pad) {
                Object.assign(tools, {
                    set_context: {
                        description: 'Store a key-value pair in the session scratchpad for this conversation.',
                        inputSchema: {type: 'object', properties: {key: {type: 'string'}, value: {type: 'string'}}, required: ['key', 'value']},
                        execute: ({key, value}: {key: string; value: string}) => { pad.set(key, value); return {stored: true, key}; },
                    },
                    get_context: {
                        description: 'Retrieve a value from the session scratchpad.',
                        inputSchema: {type: 'object', properties: {key: {type: 'string'}}, required: ['key']},
                        execute: ({key}: {key: string}) => {
                            const value = pad.get(key);
                            return value !== undefined ? {found: true, key, value} : {found: false, key};
                        },
                    },
                    list_context: {
                        description: 'List all entries in the session scratchpad.',
                        inputSchema: {type: 'object', properties: {}},
                        execute: () => ({entries: [...pad.entries()].map(([k, v]) => ({key: k, value: v}))}),
                    },
                });
            }
        }

        Object.assign(tools, createWebSearchTools({apiKey: extToolOpts.webSearch?.apiKey}));
        Object.assign(tools, createHTTPFetchTools());
        Object.assign(tools, createCodeExecTools({
            workspaceRoot,
            maxTimeout: extToolOpts.codeExec?.maxTimeout,
            maxOutputBytes: extToolOpts.codeExec?.maxOutputBytes,
        }));
        Object.assign(tools, createFileSystemTools({
            workspaceRoot,
            maxReadSize: extToolOpts.fs?.maxReadSize,
        }));
        if (episodicMemory) {
            Object.assign(tools, createRagQueryTools({episodicMemory}));
        }
        Object.assign(tools, createHumanApprovalTool(approvalManager));

        return tools;
    };

    const recallFromMemory = async (query?: string, limit = 10): Promise<Array<{timestamp: number; type: string; content: string}>> => {
        if (!episodicMemory) return [];
        const episodes = await episodicMemory.getEpisodes({limit}).catch(() => []);
        const q = query?.toLowerCase();
        return (q ? episodes.filter(e => e.content.toLowerCase().includes(q)) : episodes)
            .map(e => ({timestamp: e.timestamp, type: e.type, content: e.content}));
    };

    const buildComposedRequest = async (input: string, historyMessages?: Array<{role: 'user' | 'assistant' | 'system' | 'tool'; content: string}>, session?: ConversationSession) => {
        const system = await buildSystemPrompt(input, session);
        return {
            system,
            messages: historyMessages ?? [{role: 'user' as const, content: input}],
            tools: buildTools(session),
            ctxHash: String(Date.now()),
            snapshot: null,
            budget: {systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0},
        };
    };

    const dispatchToLM = async (input: string, opts: {signal?: AbortSignal; session?: ConversationSession} = {}): Promise<{text: string; usage?: {inputTokens: number; outputTokens: number; totalTokens: number}}> => {
        if (!runner.hasModel()) return {text: 'No LM configured — Narsese input only.'};
        const composed = await buildComposedRequest(input, undefined, opts.session);
        const iter = runner.run(composed, opts.signal);
        let next = await iter.next();
        while (!next.done) next = await iter.next();
        return {text: next.value?.text ?? '', ...(next.value?.usage ? {usage: next.value.usage} : {})};
    };

    const processInputDeps = {
        nar,
        hasLmModel: runner.hasModel(),
        understandingService,
        generationService,
        contextAssembler: contextAssembler!,
        contextOpts,
        autonomyEngine,
    };

    const runProcessInput = async (input: string, opts: {signal?: AbortSignal; session?: ConversationSession; historyLimit?: number} = {}) => {
        const gen = processInput(processInputDeps, input, opts);
        let next = await gen.next();
        let event: InputEvent | undefined;
        while (!next.done) {
            event = next.value;
            next = await gen.next();
        }
        return {text: next.value, event};
    };

    const chat = async (input: string, opts: ChatOptions = {}): Promise<string> => {
        const startTime = Date.now();
        eventBus.emit('agent:process:start', {input, timestamp: startTime});
        try {
            safeLog('input', input);
            const {text, event} = await runProcessInput(input, opts);

            if (event?.kind === 'lm-dispatch') {
                const dispatch = await dispatchToLM(input, opts);
                const response = dispatch.text;
                safeLog('response', response);
                recordStats('success', Date.now() - startTime, dispatch.usage);
                eventBus.emit('agent:process:complete', {input, output: response, durationMs: Date.now() - startTime, ...(dispatch.usage ? {tokens: toEventTokens(dispatch.usage)} : {}), timestamp: Date.now()});
                return response;
            }

            safeLog('response', text);
            recordStats('success', Date.now() - startTime);
            eventBus.emit('agent:process:complete', {input, output: text, durationMs: Date.now() - startTime, timestamp: Date.now()});
            return text;
        } catch (e) {
            const err = e instanceof Error ? e.message : String(e);
            recordStats('failure', Date.now() - startTime);
            eventBus.emit('agent:process:error', {input, error: err, timestamp: Date.now()});
            throw e;
        }
    };

    const chatWithHistory = async (input: string, session: ConversationSession, opts: ChatOptions = {}): Promise<string> => {
        const historyLimit = opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT;
        const startTime = Date.now();
        eventBus.emit('agent:process:start', {input, sessionKey: session.key, timestamp: startTime});
        try {
            safeLog('input', input, {session: session.key});
            const {text, event} = await runProcessInput(input, {signal: opts.signal, session, historyLimit});

            if (event?.kind === 'lm-dispatch') {
                const historyMessages = formatHistoryAsMessages(session.history, historyLimit);
                historyMessages.push({role: 'user', content: input});
                const composed = await buildComposedRequest(input, historyMessages, session);
                const iter = runner.run(composed, opts.signal);
                let next = await iter.next();
                while (!next.done) next = await iter.next();
                const reply = next.value?.text ?? '';
                const usage = next.value?.usage;
                appendSessionTurns(session, input, reply, historyLimit);
                safeLog('response', reply, {session: session.key});
                recordStats('success', Date.now() - startTime, usage);
                eventBus.emit('agent:process:complete', {input, output: reply, sessionKey: session.key, durationMs: Date.now() - startTime, ...(usage ? {tokens: toEventTokens(usage)} : {}), timestamp: Date.now()});
                return reply;
            }

            appendSessionTurns(session, input, text, historyLimit);
            safeLog('response', text, {session: session.key});
            recordStats('success', Date.now() - startTime);
            eventBus.emit('agent:process:complete', {input, output: text, sessionKey: session.key, durationMs: Date.now() - startTime, timestamp: Date.now()});
            return text;
        } catch (e) {
            const err = e instanceof Error ? e.message : String(e);
            recordStats('failure', Date.now() - startTime);
            eventBus.emit('agent:process:error', {input, sessionKey: session.key, error: err, timestamp: Date.now()});
            throw e;
        }
    };

    const chatStream = async function* (
        input: string,
        session?: ConversationSession,
        opts: ChatOptions = {},
    ): AsyncGenerator<ChatStreamEvent, string> {
        const startTime = Date.now();
        eventBus.emit('agent:process:start', {input, ...(session ? {sessionKey: session.key} : {}), timestamp: startTime});
        let final = '';
        let streamUsage: {inputTokens: number; outputTokens: number; totalTokens: number} | undefined;
        let didError = false;
        let errorMessage: string | undefined;
        try {
            const historyLimit = opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT;
            const gen = processInput(processInputDeps, input, {signal: opts.signal, session, historyLimit});
            let next = await gen.next();
            while (!next.done) {
                const ev = next.value;
                if (ev.kind === 'lm-dispatch') {
                    let historyMessages: Array<{role: 'user' | 'assistant' | 'system'; content: string}> | undefined;
                    if (session) {
                        historyMessages = formatHistoryAsMessages(session.history, historyLimit);
                        historyMessages.push({role: 'user', content: input});
                    }
                    const composed = await buildComposedRequest(input, historyMessages, session);
                    const iter = runner.run(composed, opts.signal);
                    while (true) {
                        const lmNext = await iter.next();
                        if (lmNext.done) {
                            final = lmNext.value?.text ?? '';
                            streamUsage = lmNext.value?.usage;
                            break;
                        }
                        const lmEv = lmNext.value;
                        if (lmEv.kind === 'text-delta') yield {kind: 'text-delta', text: lmEv.text};
                        else if (lmEv.kind === 'tool-call') yield {kind: 'tool-call', toolName: lmEv.call.toolName, toolArgs: lmEv.call.args};
                        else if (lmEv.kind === 'tool-result') yield {kind: 'tool-result', toolName: lmEv.call.toolName, toolArgs: lmEv.call.args, toolResult: lmEv.result};
                    }
                } else {
                    final = ev.text;
                    yield {kind: 'text-delta', text: ev.text};
                }
                next = await gen.next();
            }
            if (opts.signal?.aborted) {
                yield {kind: 'aborted'};
                return final;
            }
            yield {kind: 'finish', text: final};
            if (session) {
                appendSessionTurns(session, input, final, historyLimit);
            }
            safeLog('response', final, session ? {session: session.key} : {});
            return final;
        } catch (e) {
            didError = true;
            errorMessage = e instanceof Error ? e.message : String(e);
            yield {kind: 'error', error: errorMessage};
            return final;
        } finally {
            recordStats(didError ? 'failure' : 'success', Date.now() - startTime, streamUsage);
            if (didError) {
                eventBus.emit('agent:process:error', {input, ...(session ? {sessionKey: session.key} : {}), error: errorMessage ?? 'unknown', timestamp: Date.now()});
            } else {
                eventBus.emit('agent:process:complete', {input, output: final, ...(session ? {sessionKey: session.key} : {}), durationMs: Date.now() - startTime, ...(streamUsage ? {tokens: toEventTokens(streamUsage)} : {}), timestamp: Date.now()});
            }
        }
    };

    const believe = async (narsese: string): Promise<void> => {
        const {event} = await runProcessInput(narsese);
        if (event?.kind === 'narsese-input' || event?.kind === 'question-response') {
            // already processed by processInput
        } else {
            await nar?.believe(narsese);
        }
        safeLog('belief_added', narsese);
    };

    const recall = (query?: string, limit = 10): Promise<Array<{timestamp: number; type: string; content: string}>> =>
        recallFromMemory(query, limit);

    const start = (): (() => void) => {
        if (!nar) return () => {};
        if (nar.state === 'created') {
            nar.initialize().then(() => nar.start()).catch(err => {
                logger.warn('NAR lifecycle failed', {error: err instanceof Error ? err.message : String(err)});
            });
        } else if (nar.state === 'initialized') {
            nar.start().catch(err => {
                logger.warn('NAR start failed', {error: err instanceof Error ? err.message : String(err)});
            });
        }

        // Use AutonomyEngine if provided, otherwise fall back to setInterval
        if (opts.autonomyEngine) {
            autonomyEngine = opts.autonomyEngine;
            autonomyEngine.setNotifyHandler((msg) => logger.debug(msg));
            autonomyEngine.start();
        } else if (!reasoningHandle) {
            reasoningHandle = setInterval(async () => {
                if (throttle === 0 || !nar) return;
                const driveManager = nar.getDriveManager();
                const urgency = driveManager?.getUrgency() ?? 0;
                const urgencySteps = Math.round(MIN_REASON_STEPS_PER_TICK + (MAX_REASON_STEPS_PER_TICK - MIN_REASON_STEPS_PER_TICK) * urgency);
                const steps = Math.max(MIN_REASON_STEPS_PER_TICK, Math.round(urgencySteps * (throttle / 100)));
                try {
                    const derived = await nar.run(steps);
                    if (derived > 0) await captureDerivations(derived);
                } catch {
                    // background reasoning is best-effort
                }
            }, REASONING_INTERVAL_MS);
            reasoningHandle.unref();
        }
        eventBus.emit('agent:resume', {timestamp: Date.now()});
        return stop;
    };

    const stop = (): void => {
        if (autonomyEngine) {
            autonomyEngine.stop();
        } else if (reasoningHandle) {
            clearInterval(reasoningHandle);
            reasoningHandle = undefined;
        }
        if (nar && (nar.state === 'started' || nar.state === 'initialized')) {
            nar.stop().catch(() => {});
        }
        saveKnowledge();
        eventBus.emit('agent:suspend', {timestamp: Date.now()});
    };

    return {
        chat,
        chatWithHistory,
        chatStream,
        believe,
        recall,
        know: (key: string, value: string) => { knowledge.set(key, value); safeLog('input', value, {kind: 'knowledge', key}); saveKnowledge(); },
        knowGet: (key: string) => knowledge.get(key),
        knowList: () => [...knowledge.entries()].map(([key, value]) => ({key, value})),
        start,
        stop,
        pause: () => autonomyEngine?.pause(),
        resume: () => autonomyEngine?.resume(),
        setThrottle: (percent: number) => { throttle = Math.max(0, Math.min(100, percent)); },
        getThrottle: () => throttle,
        getNAR: () => nar,
        getEpisodicMemory: () => episodicMemory,
        getLogger: () => logger,
        getStats: () => ({...stats}),
        getRecentDerivations: () => [...recentDerivations],
        resolveApproval: (id, approved, reason) => approvalManager.resolveApproval(id, approved, reason),
        getPendingApprovals: () => approvalManager.getPending().map(r => ({id: r.id, request: r.request, createdAt: r.createdAt})),
        getLmRuleStats: () => nar?.getProcessor().getLmRuleStats?.() ?? [],
        getLmRuleExecutionLog: () => nar?.getProcessor().getLMRuleExecutionLog?.() ?? [],
        enableLmRule: (id: string) => nar?.getProcessor().getLMRule?.(id)?.enable?.(),
        disableLmRule: (id: string) => nar?.getProcessor().getLMRule?.(id)?.disable?.(),
        setLmRulePriority: (id: string, priority: number) => {
            const rule = nar?.getProcessor().getLMRule?.(id);
            if (rule && 'priority' in rule) (rule as {priority: number}).priority = priority;
        },
        getAutonomyEngine: () => autonomyEngine,
        getRLFPState: () => nar?.getRLFP?.() ? {
            enabled: true,
            policy: {},
            qValues: {},
            explorationRate: 0,
            totalRewards: 0,
            totalSteps: 0,
        } : null,
        resetRLFP: () => {
            const rlfp = nar?.getRLFP?.();
            if (rlfp) {
                // RLFPLearner doesn't have a reset method yet
            }
        },
        getSelfReasoning: () => nar?.getSelfAnalyzer?.() ? {
            qualityScore: 0,
            consistency: 0,
            gaps: [],
            suggestions: [],
        } : null,
        getReasoningQuality: () => nar?.getSelfAnalyzer?.() ? {
            overall: 0,
            coherence: 0,
            relevance: 0,
            completeness: 0,
        } : null,
        explainBelief: async (term: string) => {
            if (!nar) return null;
            const {termParser} = await import('../nar/terms/index.js');
            const parsed = termParser.parse(term);
            if (!parsed) return null;
            const result = nar.query.query(parsed, {truthRange: [0, 1], limit: 1});
            if (!result.beliefs.length) return null;
            const belief = result.beliefs[0]!;
            return {
                explanation: belief.term.toString(),
                confidence: belief.truth?.c ?? 0,
                premises: [belief.term.toString()],
            };
        },
        explainGoal: async (term: string) => {
            if (!nar) return null;
            const {termParser} = await import('../nar/terms/index.js');
            const parsed = termParser.parse(term);
            if (!parsed) return null;
            const result = nar.query.query(parsed, {truthRange: [0, 1], limit: 1});
            if (!result.beliefs.length) return null;
            const goal = result.beliefs[0]!;
            return {
                explanation: goal.term.toString(),
                confidence: goal.truth?.c ?? 0,
                premises: [goal.term.toString()],
            };
        },
        traceRule: async (ruleId: string, term: string) => {
            if (!nar) return null;
            const rule = nar.getProcessor().getLMRule?.(ruleId);
            if (!rule) return null;
            return {
                ruleName: rule.name,
                input: term,
                output: '',
                confidence: 0,
            };
        },
        on: (event: string, listener: (...args: any[]) => void) => {
            const unsubAgent = eventBus.on(event as any, listener);
            const unsubSystem = systemEventBus?.on(event as any, listener);
            return () => { unsubAgent(); unsubSystem?.(); };
        },
        off: (event: string, listener: (...args: any[]) => void) => {
            eventBus.off(event as any, listener);
            systemEventBus?.off(event as any, listener);
        },
    };
}
