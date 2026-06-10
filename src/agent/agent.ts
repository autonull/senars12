import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {EpisodeType, EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {termParser, type ParseTaskResult} from '../nar/terms/index.js';
import type {ContextOpts} from '../nar/nl/context.js';
import {createNARSTools, createGeneralTools, createWorkingMemoryTools} from '../nar/tools/adapters/index.js';
import {ModelRunner, type ModelEvent} from './model/ModelRunner.js';
import {buildAgentTools} from './tools.js';
import type {ConversationSession} from './ConversationSession.js';
import {appendTurn, DEFAULT_SESSION_HISTORY_LIMIT, trimHistory} from './ConversationSession.js';
import {formatHistoryAsMessages} from './chat-history.js';
import {createLogger, type Logger} from '../nar/logger/index.js';
import type {EpisodeWorkingMemory} from './EpisodeWorkingMemory.js';
import {AgentEventBus, type AgentEventKind, type AgentEventPayloads} from './AgentEventBus.js';
import {renderSystemPrompt, buildCognitiveState, computeCognitiveFingerprint, type SystemPromptSections} from './SystemPrompt.js';
import {validateAgentOptions, AgentOptionsValidationError, type ValidatedAgentOptions} from './options-schema.js';

const RECENT_DERIVATIONS_LIMIT = 20;
const RECENT_DERIVATIONS_MAX_AGE_MS = 30 * 60_000;

export interface AgentOptions {
    nar?: NAR;
    lmClient?: LMClient;
    episodicMemory?: EpisodicMemory;
    systemInstructions?: string;
    context?: ContextOpts;
    maxLoops?: number;
    logger?: Logger;
}

export interface ChatOptions {
    historyLimit?: number;
    signal?: AbortSignal;
    workingMemory?: EpisodeWorkingMemory;
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
    chat(input: string, opts?: ChatOptions): Promise<string>;
    chatWithHistory(input: string, session: ConversationSession, opts?: ChatOptions): Promise<string>;
    chatStream(input: string, session?: ConversationSession, opts?: ChatOptions): AsyncGenerator<ChatStreamEvent, string>;
    believe(narsese: string): Promise<void>;
    know(key: string, value: string): void;
    knowGet(key: string): string | undefined;
    knowList(): Array<{key: string; value: string}>;
    recall(query?: string, limit?: number): Promise<Array<{timestamp: number; type: string; content: string}>>;
    start(): () => void;
    stop(): void;
    setThrottle(percent: number): void;
    getThrottle(): number;
    getNAR(): NAR | undefined;
    getEpisodicMemory(): EpisodicMemory | undefined;
    getLogger(): Logger;
    getRecentDerivations(): ReadonlyArray<{timestamp: number; term: string}>;
    getLastSelfCorrectionNote(): string | undefined;
    getStats(): AgentStats;
    on<K extends AgentEventKind>(event: K, listener: (payload: AgentEventPayloads[K]) => void): () => void;
    off<K extends AgentEventKind>(event: K, listener: (payload: AgentEventPayloads[K]) => void): void;
}

const DEFAULT_SYSTEM_PROMPT = 'You are SeNARS — a neurosymbolic cognitive kernel.';

const REASONING_INTERVAL_MS = 60_000;
const MAX_REASON_STEPS_PER_TICK = 5;

type KnowledgeEntry = {key: string; value: string};
type Derivation = {timestamp: number; term: string};

export function createAgent(opts: AgentOptions = {}): Agent {
    // Validate with zod schema — catches misconfiguration early and applies
    // defaults (e.g. maxLoops defaults to 5). The typed AgentOptions interface
    // is still used for the destructure since zod's inferred type uses unknown
    // for non-primitive fields.
    validateAgentOptions(opts);
    const {
        nar,
        lmClient,
        episodicMemory,
        systemInstructions,
        context: contextOpts = {},
        maxLoops = 5,
        logger = createLogger({scope: 'agent'}),
    } = opts;

    const runner = new ModelRunner({lmClient, maxLoops});
    const knowledge = new Map<string, string>();
    const sessionInstructions = new WeakMap<ConversationSession, string>();
    const sessionFingerprints = new WeakMap<ConversationSession, string>();

    let throttle = 100;
    let reasoningHandle: ReturnType<typeof setInterval> | null = null;
    const recentDerivations: Derivation[] = [];
    let lastSelfCorrectionNote: string | undefined;
    const eventBus = new AgentEventBus();
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

    const toEventTokens = (u: {inputTokens: number; outputTokens: number; totalTokens: number}): {input: number; output: number; total: number} => ({
        input: u.inputTokens,
        output: u.outputTokens,
        total: u.totalTokens,
    });

    const safeLog = (type: EpisodeType, content: string, metadata: Record<string, unknown> = {}): void => {
        if (!episodicMemory) return;
        episodicMemory.log(type, content, metadata).catch(err => {
            logger.warn('episodic memory log failed', {
                type,
                error: err instanceof Error ? err.message : String(err),
            });
        });
    };

    const recordDerivation = (term: string): void => {
        const now = Date.now();
        recentDerivations.push({timestamp: now, term});
        const cutoff = now - RECENT_DERIVATIONS_MAX_AGE_MS;
        while (recentDerivations.length > 0 && (recentDerivations[0]?.timestamp ?? 0) < cutoff) {
            recentDerivations.shift();
        }
        while (recentDerivations.length > RECENT_DERIVATIONS_LIMIT) {
            recentDerivations.shift();
        }
    };

    const buildSystemPrompt = (workingMemory: EpisodeWorkingMemory | undefined, session: ConversationSession | undefined): string => {
        const instruction = session ? sessionInstructions.get(session) : systemInstructions;
        const sections: SystemPromptSections = {
            constitution: (nar?.getConstitution?.() ?? []).map(b => (b as {term: {toString(): string}}).term.toString()),
            instructions: instruction,
            workingMemory,
            cognitiveState: '',
            recentDerivations,
            selfCorrectionNote: lastSelfCorrectionNote,
            includeReActStrategy: true,
            previousSnapshotFingerprint: undefined,
        };
        return renderSystemPrompt(sections);
    };

    const defaultContextOpts: ContextOpts = {attention: true, beliefs: true, goals: true, ...contextOpts};

    const buildContext = async (input: string, session: ConversationSession | undefined): Promise<{state: string; fingerprint: string; isDelta: boolean}> => {
        const fingerprint = computeCognitiveFingerprint(nar, recentDerivations, lastSelfCorrectionNote);
        const previousFingerprint = session ? sessionFingerprints.get(session) : undefined;

        const episodicEpisodes = episodicMemory
            ? await episodicMemory.getEpisodes({limit: 5}).catch(() => [] as Array<{type: string; content: string}>)
            : [];

        const {state} = await buildCognitiveState(
            nar,
            input,
            {
                attention: Boolean(defaultContextOpts.attention),
                beliefs: Boolean(defaultContextOpts.beliefs),
                goals: Boolean(defaultContextOpts.goals),
            },
            fingerprint,
            previousFingerprint,
            episodicEpisodes,
        );

        if (session) sessionFingerprints.set(session, fingerprint);
        const isDelta = Boolean(previousFingerprint) && fingerprint !== previousFingerprint;
        return {state, fingerprint, isDelta};
    };

    const renderPromptForSession = async (
        workingMemory: EpisodeWorkingMemory | undefined,
        session: ConversationSession | undefined,
        input: string,
    ): Promise<string> => {
        const {state} = await buildContext(input, session);
        const sections: SystemPromptSections = {
            constitution: (nar?.getConstitution?.() ?? []).map(b => (b as {term: {toString(): string}}).term.toString()),
            instructions: session ? sessionInstructions.get(session) : systemInstructions,
            workingMemory,
            cognitiveState: state,
            recentDerivations,
            selfCorrectionNote: lastSelfCorrectionNote,
            includeReActStrategy: true,
            previousSnapshotFingerprint: session ? sessionFingerprints.get(session) : undefined,
        };
        return renderSystemPrompt(sections);
    };

    const recallFromMemory = async (query?: string, limit = 10): Promise<Array<{timestamp: number; type: string; content: string}>> => {
        if (!episodicMemory) return [];
        const episodes = await episodicMemory.getEpisodes({limit}).catch(() => []);
        const q = query?.toLowerCase();
        return (q ? episodes.filter((e: {content: string}) => e.content.toLowerCase().includes(q)) : episodes)
            .map((e: {timestamp: number; type: string; content: string}) => ({timestamp: e.timestamp, type: e.type, content: e.content}));
    };

    const buildTools = (workingMemory?: EpisodeWorkingMemory, session?: ConversationSession): Record<string, unknown> => {
        const tools: Record<string, unknown> = {};
        if (nar) {
            Object.assign(tools, createNARSTools(nar as Parameters<typeof createNARSTools>[0]));
            Object.assign(tools, createGeneralTools({
                nar: nar as Parameters<typeof createGeneralTools>[0]['nar'],
                episodicMemory: episodicMemory as Parameters<typeof createGeneralTools>[0]['episodicMemory'],
            }));
        }
        if (workingMemory) {
            Object.assign(tools, createWorkingMemoryTools(workingMemory));
        }
        const agentDeps: Parameters<typeof buildAgentTools>[0] = {
            know: (k: string, v: string) => { knowledge.set(k, v); safeLog('input', v, {kind: 'knowledge', key: k}); },
            knowGet: (k: string) => knowledge.get(k),
            knowList: () => [...knowledge.entries()].map(([key, value]): KnowledgeEntry => ({key, value})),
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
        };
        Object.assign(tools, buildAgentTools(agentDeps));
        return tools;
    };

    const tryParseNarsese = (input: string): ParseTaskResult | null => termParser.parseTask(input);

    const formatBelief = (b: {term: {toString(): string}; truth?: {f: number; c: number}}): string => {
        const truth = b.truth ? ` (f=${b.truth.f.toFixed(2)} c=${b.truth.c.toFixed(2)})` : '';
        return `${b.term.toString()}${truth}`;
    };

    const buildComposedRequest = async (input: string, historyMessages?: Array<{role: 'user' | 'assistant' | 'system' | 'tool'; content: string}>, workingMemory?: EpisodeWorkingMemory, session?: ConversationSession) => {
        const system = await renderPromptForSession(workingMemory, session, input);

        return {
            system,
            messages: historyMessages ?? [{role: 'user' as const, content: input}],
            tools: buildTools(workingMemory, session),
            ctxHash: String(Date.now()),
            snapshot: null,
            budget: {systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0},
        };
    };

    void buildSystemPrompt;

    const dispatchToLM = async (input: string, opts: {signal?: AbortSignal; workingMemory?: EpisodeWorkingMemory; session?: ConversationSession} = {}): Promise<{text: string; usage?: {inputTokens: number; outputTokens: number; totalTokens: number}}> => {
        if (!runner.hasModel()) {
            return {text: 'No LM configured — Narsese input only.'};
        }
        const composed = await buildComposedRequest(input, undefined, opts.workingMemory, opts.session);
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
                    const existing = nar?.getBeliefs().find((b: {term: {toString(): string}}) =>
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

    const chatWithHistory = async (
        input: string,
        session: ConversationSession,
        opts: ChatOptions = {},
    ): Promise<string> => {
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
                    const existing = nar?.getBeliefs().find((b: {term: {toString(): string}}) =>
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

            const historyMessages = formatHistoryAsMessages(session.history, historyLimit);
            historyMessages.push({role: 'user', content: input});

            const composed = await buildComposedRequest(input, historyMessages, opts.workingMemory, session);
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
            const composed = await buildComposedRequest(input, historyMessages, opts.workingMemory, session);
            const iter = runner.run(composed, opts.signal);

            while (true) {
                const next = await iter.next();
                if (next.done) {
                    final = next.value?.text ?? '';
                    streamUsage = next.value?.usage;
                    break;
                }
                const ev = next.value;
                if (ev.kind === 'text-delta') {
                    yield {kind: 'text-delta', text: ev.text};
                } else if (ev.kind === 'tool-call') {
                    yield {
                        kind: 'tool-call',
                        toolName: ev.call.toolName,
                        toolArgs: ev.call.args,
                    };
                } else if (ev.kind === 'tool-result') {
                    yield {
                        kind: 'tool-result',
                        toolName: ev.call.toolName,
                        toolArgs: ev.call.args,
                        toolResult: ev.result,
                    };
                }
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
        if (task) {
            await nar?.input(task.term, task.taskType, task.truth);
        } else {
            await nar?.believe(narsese);
        }
        safeLog('belief_added', narsese);
    };

    const know = (key: string, value: string): void => {
        knowledge.set(key, value);
        safeLog('input', value, {kind: 'knowledge', key});
    };

    const knowGet = (key: string): string | undefined => knowledge.get(key);

    const knowList = (): KnowledgeEntry[] => [...knowledge.entries()].map(([key, value]) => ({key, value}));

    const recall = (query?: string, limit = 10): Promise<Array<{timestamp: number; type: string; content: string}>> =>
        recallFromMemory(query, limit);

    const captureDerivations = (count: number): void => {
        if (!nar) return;
        try {
            const beliefs = nar.getBeliefs();
            const fresh = beliefs
                .slice(-count)
                .map(b => ({timestamp: Date.now(), term: (b.term as {toString(): string}).toString()}));
            for (const d of fresh) recordDerivation(d.term);
        } catch (err) {
            logger.warn('failed to capture derivations', {
                error: err instanceof Error ? err.message : String(err),
            });
        }
    };

    const formatSelfCorrection = (result: unknown): string | undefined => {
        if (!result || typeof result !== 'object') return undefined;
        const r = result as Record<string, unknown>;
        const lines: string[] = [];
        if (typeof r.toolSelectionBias === 'number') {
            lines.push(`Tool selection bias: ${r.toolSelectionBias.toFixed(2)}`);
        }
        if (typeof r.reasoningInterval === 'number') {
            lines.push(`Reasoning interval: ${r.reasoningInterval}ms`);
        }
        if (Array.isArray(r.adjustments) && r.adjustments.length) {
            lines.push(`Recent adjustments: ${r.adjustments.length}`);
        }
        return lines.length ? lines.join('\n') : undefined;
    };

    const start = (): () => void => {
        if (!nar) return () => {};
        if (reasoningHandle) stop();

        const self = nar.getSelfAnalyzer?.();
        self?.start?.();

        reasoningHandle = setInterval(async () => {
            if (throttle === 0) return;
            const steps = Math.max(1, Math.round(MAX_REASON_STEPS_PER_TICK * (throttle / 100)));
            try {
                const derived = await nar.run(steps);
                if (derived > 0) captureDerivations(derived);
            } catch (err) {
                logger.warn('background reasoning step failed', {
                    error: err instanceof Error ? err.message : String(err),
                });
            }
            if (self?.performSelfCorrection) {
                try {
                    const result = await self.performSelfCorrection();
                    const note = formatSelfCorrection(result);
                    if (note) lastSelfCorrectionNote = note;
                } catch (err) {
                    logger.warn('self-correction failed', {
                        error: err instanceof Error ? err.message : String(err),
                    });
                }
            }
        }, REASONING_INTERVAL_MS);

        if (typeof reasoningHandle.unref === 'function') reasoningHandle.unref();
        eventBus.emit('agent:resume', {timestamp: Date.now()});
        return stop;
    };

    const stop = (): void => {
        if (reasoningHandle) {
            clearInterval(reasoningHandle);
            reasoningHandle = null;
        }
        nar?.getSelfAnalyzer?.()?.stop?.();
        eventBus.emit('agent:suspend', {timestamp: Date.now()});
    };

    const setThrottle = (percent: number): void => {
        throttle = Math.max(0, Math.min(100, percent));
    };

    return {
        chat,
        chatWithHistory,
        chatStream,
        believe,
        know,
        knowGet,
        knowList,
        recall,
        start,
        stop,
        setThrottle,
        getThrottle: () => throttle,
        getNAR: () => nar,
        getEpisodicMemory: () => episodicMemory,
        getLogger: () => logger,
        getRecentDerivations: () => recentDerivations.slice(),
        getLastSelfCorrectionNote: () => lastSelfCorrectionNote,
        getStats: () => ({...stats}),
        on: (event, listener) => eventBus.on(event, listener),
        off: (event, listener) => eventBus.off(event, listener),
    };
}
