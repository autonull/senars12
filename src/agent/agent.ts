import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {EpisodeType, EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {termParser, type ParseTaskResult} from '../nar/terms/index.js';
import {ContextBuilder, type ContextOpts} from '../nar/nl/context.js';
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
import {appendTurn, DEFAULT_SESSION_HISTORY_LIMIT, trimHistory} from './ConversationSession.js';
import {formatHistoryAsMessages} from './chat-history.js';
import {createLogger, type Logger} from '../nar/logger/index.js';
import {AgentEventBus, type AgentEventKind, type AgentEventPayloads} from './AgentEventBus.js';
import {validateAgentOptions, type ValidatedAgentOptions} from './options-schema.js';
import type {NlBridge} from './nl-bridge.js';
import type {TranslationResult} from '../nar/nl/schemas.js';

const REASONING_INTERVAL_MS = 60_000;
const MAX_REASON_STEPS_PER_TICK = 5;
const MAX_RECENT_DERIVATIONS = 50;

export interface AgentOptions {
    nar?: NAR;
    lmClient?: LMClient;
    episodicMemory?: EpisodicMemory;
    systemInstructions?: string;
    context?: ContextOpts;
    maxLoops?: number;
    logger?: Logger;
    workspaceRoot?: string;
    externalTools?: {
        webSearch?: {apiKey?: string};
        codeExec?: {maxTimeout?: number; maxOutputBytes?: number};
        fs?: {maxReadSize?: number};
    };
    approvalManager?: ApprovalManager;
    nlBridge?: NlBridge;
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
    setThrottle(percent: number): void;
    getThrottle(): number;
    getNAR(): NAR | undefined;
    getEpisodicMemory(): EpisodicMemory | undefined;
    getLogger(): Logger;
    getStats(): AgentStats;
    getRecentDerivations(): DerivationEntry[];
    resolveApproval(id: string, approved: boolean, reason?: string): boolean;
    getPendingApprovals(): Array<{id: string; request: string; createdAt: number}>;
    on<K extends AgentEventKind>(event: K, listener: (payload: AgentEventPayloads[K]) => void): () => void;
    off<K extends AgentEventKind>(event: K, listener: (payload: AgentEventPayloads[K]) => void): void;
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
        nlBridge,
    } = opts;

    const runner = new ModelRunner({lmClient, maxLoops});
    const knowledge = new Map<string, string>();
    const sessionInstructions = new WeakMap<ConversationSession, string>();
    const sessionScratchpad = new WeakMap<ConversationSession, Map<string, string>>();
    const eventBus = new AgentEventBus();
    const approvalManager = externalApprovalManager ?? new ApprovalManager();
    const contextBuilder = new ContextBuilder();
    const defaultContextOpts: ContextOpts = {attention: true, beliefs: true, goals: true, ...contextOpts};
    let throttle = 100;
    let reasoningHandle: ReturnType<typeof setInterval> | undefined;
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

        if (nar) {
            const cognitiveState = contextBuilder.build(nar, input, undefined, defaultContextOpts);
            if (cognitiveState) {
                parts.push('## Cognitive State');
                parts.push(cognitiveState);
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

    const tryParseNarsese = (input: string): ParseTaskResult | null => termParser.parseTask(input);

    const formatTranslationResult = (result: TranslationResult): string => {
        const parts: string[] = [];
        if (result.beliefs.length > 0) {
            parts.push(`Recorded ${result.beliefs.length} belief${result.beliefs.length > 1 ? 's' : ''}:`);
            for (const b of result.beliefs) {
                parts.push(`  + ${b.narsese}`);
            }
        }
        if (result.questions.length > 0) {
            parts.push(`Asked ${result.questions.length} question${result.questions.length > 1 ? 's' : ''}.`);
        }
        if (result.goals.length > 0) {
            parts.push(`Set ${result.goals.length} goal${result.goals.length > 1 ? 's' : ''}.`);
        }
        if (result.summary) parts.push(result.summary);
        return parts.join('\n') || 'Understood.';
    };

    const tryNlTranslation = async (input: string): Promise<string | null> => {
        if (!nlBridge?.isAvailable()) return null;
        try {
            const translation = await nlBridge.nlToNarsese(input);
            if (translation.kind === 'none') return null;
            if (translation.kind === 'clarify') return translation.question;
            const {result} = translation;
            for (const b of result.beliefs) {
                await nar?.believe(b.narsese, b.truth);
            }
            for (const q of result.questions) {
                await nar?.question(q);
            }
            for (const g of result.goals) {
                await nar?.goal(g);
            }
            return formatTranslationResult(result);
        } catch {
            return null;
        }
    };

    const formatBelief = (b: {term: {toString(): string}; truth?: {f: number; c: number}}): string => {
        const truth = b.truth ? ` (f=${b.truth.f.toFixed(2)} c=${b.truth.c.toFixed(2)})` : '';
        return `${b.term.toString()}${truth}`;
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

    const chat = async (input: string, opts: ChatOptions = {}): Promise<string> => {
        const startTime = Date.now();
        eventBus.emit('agent:process:start', {input, timestamp: startTime});
        try {
            safeLog('input', input);
            const task = tryParseNarsese(input);
            if (task) {
                await nar?.input(task.term, task.taskType, task.truth);
                if (task.taskType === 'question') {
                    const needle = task.term.toString();
                    const existing = nar?.getBeliefs().find(b =>
                        b.term.toString().toLowerCase().includes(needle.toLowerCase())
                    );
                    const response = existing
                        ? formatBelief(existing as {term: {toString(): string}; truth?: {f: number; c: number}})
                        : `Question queued: ${input} (reasoning in background)`;
                    safeLog('response', response, {narsese: input, taskType: task.taskType});
                    recordStats('success', Date.now() - startTime);
                    eventBus.emit('agent:process:complete', {input, output: response, durationMs: Date.now() - startTime, timestamp: Date.now()});
                    return response;
                }
                const response = `+ ${input}`;
                safeLog('response', response, {narsese: input, taskType: task.taskType});
                recordStats('success', Date.now() - startTime);
                eventBus.emit('agent:process:complete', {input, output: response, durationMs: Date.now() - startTime, timestamp: Date.now()});
                return response;
            }
            const nlResult = await tryNlTranslation(input);
            if (nlResult !== null) {
                safeLog('response', nlResult);
                recordStats('success', Date.now() - startTime);
                eventBus.emit('agent:process:complete', {input, output: nlResult, durationMs: Date.now() - startTime, timestamp: Date.now()});
                return nlResult;
            }
            const dispatch = await dispatchToLM(input, opts);
            const response = dispatch.text;
            safeLog('response', response);
            recordStats('success', Date.now() - startTime, dispatch.usage);
            eventBus.emit('agent:process:complete', {input, output: response, durationMs: Date.now() - startTime, ...(dispatch.usage ? {tokens: toEventTokens(dispatch.usage)} : {}), timestamp: Date.now()});
            return response;
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
            const task = tryParseNarsese(input);
            if (task) {
                await nar?.input(task.term, task.taskType, task.truth);
                if (task.taskType === 'question') {
                    const needle = task.term.toString();
                    const existing = nar?.getBeliefs().find(b =>
                        b.term.toString().toLowerCase().includes(needle.toLowerCase())
                    );
                    const response = existing
                        ? formatBelief(existing as {term: {toString(): string}; truth?: {f: number; c: number}})
                        : `Question queued: ${input} (reasoning in background)`;
                    appendTurn(session, 'user', input, {narsese: true, taskType: task.taskType});
                    appendTurn(session, 'assistant', response, {narsese: true, taskType: task.taskType});
                    trimHistory(session, historyLimit);
                    safeLog('response', response, {session: session.key, narsese: true});
                    recordStats('success', Date.now() - startTime);
                    eventBus.emit('agent:process:complete', {input, output: response, sessionKey: session.key, durationMs: Date.now() - startTime, timestamp: Date.now()});
                    return response;
                }
                const response = `+ ${input}`;
                appendTurn(session, 'user', input, {narsese: true, taskType: task.taskType});
                appendTurn(session, 'assistant', response, {narsese: true, taskType: task.taskType});
                trimHistory(session, historyLimit);
                safeLog('response', response, {session: session.key, narsese: true});
                recordStats('success', Date.now() - startTime);
                eventBus.emit('agent:process:complete', {input, output: response, sessionKey: session.key, durationMs: Date.now() - startTime, timestamp: Date.now()});
                return response;
            }
            const nlResult = await tryNlTranslation(input);
            if (nlResult !== null) {
                appendTurn(session, 'user', input);
                appendTurn(session, 'assistant', nlResult);
                trimHistory(session, historyLimit);
                safeLog('response', nlResult, {session: session.key});
                recordStats('success', Date.now() - startTime);
                eventBus.emit('agent:process:complete', {input, output: nlResult, sessionKey: session.key, durationMs: Date.now() - startTime, timestamp: Date.now()});
                return nlResult;
            }
            const historyMessages = formatHistoryAsMessages(session.history, historyLimit);
            historyMessages.push({role: 'user', content: input});
            const composed = await buildComposedRequest(input, historyMessages, session);
            const iter = runner.run(composed, opts.signal);
            let next = await iter.next();
            while (!next.done) next = await iter.next();
            const reply = next.value?.text ?? '';
            const usage = next.value?.usage;
            appendTurn(session, 'user', input);
            appendTurn(session, 'assistant', reply);
            trimHistory(session, historyLimit);
            safeLog('response', reply, {session: session.key});
            recordStats('success', Date.now() - startTime, usage);
            eventBus.emit('agent:process:complete', {input, output: reply, sessionKey: session.key, durationMs: Date.now() - startTime, ...(usage ? {tokens: toEventTokens(usage)} : {}), timestamp: Date.now()});
            return reply;
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
            const task = tryParseNarsese(input);
            if (task) {
                await nar?.input(task.term, task.taskType, task.truth);
                const response = `+ ${input}`;
                final = response;
                yield {kind: 'text-delta', text: response};
                yield {kind: 'finish', text: response};
                if (session) {
                    appendTurn(session, 'user', input, {narsese: true, taskType: task.taskType});
                    appendTurn(session, 'assistant', response, {narsese: true, taskType: task.taskType});
                    trimHistory(session, opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT);
                }
                return response;
            }
            const nlResult = await tryNlTranslation(input);
            if (nlResult !== null) {
                final = nlResult;
                yield {kind: 'text-delta', text: nlResult};
                yield {kind: 'finish', text: nlResult};
                if (session) {
                    appendTurn(session, 'user', input);
                    appendTurn(session, 'assistant', nlResult);
                    trimHistory(session, opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT);
                }
                return nlResult;
            }
            if (!runner.hasModel()) {
                const fallback = 'No LM configured — Narsese input only.';
                final = fallback;
                yield {kind: 'text-delta', text: fallback};
                yield {kind: 'finish', text: fallback};
                return fallback;
            }
            let historyMessages: Array<{role: 'user' | 'assistant' | 'system'; content: string}> | undefined;
            if (session) {
                historyMessages = formatHistoryAsMessages(session.history, opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT);
                historyMessages.push({role: 'user', content: input});
            }
            const composed = await buildComposedRequest(input, historyMessages, session);
            const iter = runner.run(composed, opts.signal);
            while (true) {
                const next = await iter.next();
                if (next.done) {
                    final = next.value?.text ?? '';
                    streamUsage = next.value?.usage;
                    break;
                }
                const ev = next.value;
                if (ev.kind === 'text-delta') yield {kind: 'text-delta', text: ev.text};
                else if (ev.kind === 'tool-call') yield {kind: 'tool-call', toolName: ev.call.toolName, toolArgs: ev.call.args};
                else if (ev.kind === 'tool-result') yield {kind: 'tool-result', toolName: ev.call.toolName, toolArgs: ev.call.args, toolResult: ev.result};
            }
            if (opts.signal?.aborted) {
                yield {kind: 'aborted'};
                return final;
            }
            yield {kind: 'finish', text: final};
            if (session) {
                appendTurn(session, 'user', input);
                appendTurn(session, 'assistant', final);
                trimHistory(session, opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT);
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
        const task = tryParseNarsese(narsese);
        if (task) await nar?.input(task.term, task.taskType, task.truth);
        else await nar?.believe(narsese);
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
        if (!reasoningHandle) {
            reasoningHandle = setInterval(async () => {
                if (throttle === 0 || !nar) return;
                const steps = Math.max(1, Math.round(MAX_REASON_STEPS_PER_TICK * (throttle / 100)));
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
        if (reasoningHandle) {
            clearInterval(reasoningHandle);
            reasoningHandle = undefined;
        }
        if (nar && (nar.state === 'started' || nar.state === 'initialized')) {
            nar.stop().catch(() => {});
        }
        eventBus.emit('agent:suspend', {timestamp: Date.now()});
    };

    return {
        chat,
        chatWithHistory,
        chatStream,
        believe,
        recall,
        know: (key: string, value: string) => { knowledge.set(key, value); safeLog('input', value, {kind: 'knowledge', key}); },
        knowGet: (key: string) => knowledge.get(key),
        knowList: () => [...knowledge.entries()].map(([key, value]) => ({key, value})),
        start,
        stop,
        setThrottle: (percent: number) => { throttle = Math.max(0, Math.min(100, percent)); },
        getThrottle: () => throttle,
        getNAR: () => nar,
        getEpisodicMemory: () => episodicMemory,
        getLogger: () => logger,
        getStats: () => ({...stats}),
        getRecentDerivations: () => [...recentDerivations],
        resolveApproval: (id, approved, reason) => approvalManager.resolveApproval(id, approved, reason),
        getPendingApprovals: () => approvalManager.getPending().map(r => ({id: r.id, request: r.request, createdAt: r.createdAt})),
        on: (event, listener) => eventBus.on(event, listener),
        off: (event, listener) => eventBus.off(event, listener),
    };
}
