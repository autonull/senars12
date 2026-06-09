import type {NAR} from '../nar/nar.js';
import type {LMClient} from '../nar/lm/types.js';
import type {EpisodeType, EpisodicMemory} from '../nar/memory/EpisodicMemory.js';
import {termParser, type ParseTaskResult} from '../nar/terms/index.js';
import {ContextBuilder, type ContextOpts} from '../nar/nl/context.js';
import {createNARSTools, createGeneralTools} from '../nar/tools/adapters/index.js';
import {ModelRunner} from './model/ModelRunner.js';
import {buildAgentTools} from './tools.js';
import type {ConversationSession} from './ConversationSession.js';
import {appendTurn, DEFAULT_SESSION_HISTORY_LIMIT, trimHistory} from './ConversationSession.js';
import {formatHistoryAsMessages} from './chat-history.js';

export interface AgentOptions {
    nar?: NAR;
    lmClient?: LMClient;
    episodicMemory?: EpisodicMemory;
    systemInstructions?: string;
    context?: ContextOpts;
    maxLoops?: number;
}

export interface Agent {
    chat(input: string): Promise<string>;
    chatWithHistory(input: string, session: ConversationSession, opts?: {historyLimit?: number}): Promise<string>;
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
}

const DEFAULT_SYSTEM_PROMPT = 'You are SeNARS — a neurosymbolic cognitive kernel.';

const REASONING_INTERVAL_MS = 60_000;
const MAX_REASON_STEPS_PER_TICK = 5;

type KnowledgeEntry = {key: string; value: string};

export function createAgent(opts: AgentOptions = {}): Agent {
    const {
        nar,
        lmClient,
        episodicMemory,
        systemInstructions,
        context: contextOpts = {},
        maxLoops = 5,
    } = opts;

    const contextBuilder = new ContextBuilder();
    const runner = new ModelRunner({lmClient, maxLoops});
    const knowledge = new Map<string, string>();

    let throttle = 100;
    let reasoningHandle: ReturnType<typeof setInterval> | null = null;

    const safeLog = (type: EpisodeType, content: string, metadata: Record<string, unknown> = {}): void => {
        episodicMemory?.log(type, content, metadata).catch(() => {});
    };

    const buildSystemPrompt = (): string => {
        const parts: string[] = [];
        const constitution = nar?.getConstitution?.() ?? [];
        if (constitution.length) {
            parts.push('## Constitution\n' + constitution.map(b => (b as {term: {toString(): string}}).term.toString()).join('\n'));
        }
        if (systemInstructions) parts.push(systemInstructions);
        return parts.join('\n\n') || DEFAULT_SYSTEM_PROMPT;
    };

    const defaultContextOpts: ContextOpts = {attention: true, beliefs: true, goals: true, ...contextOpts};

    const buildContext = async (input: string): Promise<string> => {
        if (!nar) return '';
        const parts: string[] = [];

        const narContext = contextBuilder.build(nar, input, undefined, defaultContextOpts);
        if (narContext) parts.push(narContext);

        if (episodicMemory) {
            const episodes = await episodicMemory.getEpisodes({limit: 5}).catch(() => []);
            if (episodes.length) {
                const lines = episodes.map((e: {type: string; content: string}) => {
                    const preview = e.content.length > 80 ? e.content.slice(0, 79) + '...' : e.content;
                    return `  - [${e.type}] ${preview}`;
                });
                parts.push(`Recent interactions:\n${lines.join('\n')}`);
            }
        }

        return parts.join('\n\n');
    };

    const recallFromMemory = async (query?: string, limit = 10): Promise<Array<{timestamp: number; type: string; content: string}>> => {
        if (!episodicMemory) return [];
        const episodes = await episodicMemory.getEpisodes({limit}).catch(() => []);
        const q = query?.toLowerCase();
        return (q ? episodes.filter((e: {content: string}) => e.content.toLowerCase().includes(q)) : episodes)
            .map((e: {timestamp: number; type: string; content: string}) => ({timestamp: e.timestamp, type: e.type, content: e.content}));
    };

    const buildTools = (): Record<string, unknown> => {
        const tools: Record<string, unknown> = {};
        if (nar) {
            Object.assign(tools, createNARSTools(nar as Parameters<typeof createNARSTools>[0]));
            Object.assign(tools, createGeneralTools({
                nar: nar as Parameters<typeof createGeneralTools>[0]['nar'],
                episodicMemory: episodicMemory as Parameters<typeof createGeneralTools>[0]['episodicMemory'],
            }));
        }
        const agentDeps = {
            know: (k: string, v: string) => { knowledge.set(k, v); safeLog('input', v, {kind: 'knowledge', key: k}); },
            knowGet: (k: string) => knowledge.get(k),
            knowList: () => [...knowledge.entries()].map(([key, value]): KnowledgeEntry => ({key, value})),
            recall: (q?: string, l?: number) => recallFromMemory(q, l),
        };
        Object.assign(tools, buildAgentTools(agentDeps));
        return tools;
    };

    const tryParseNarsese = (input: string): ParseTaskResult | null => termParser.parseTask(input);

    const formatBelief = (b: {term: {toString(): string}; truth?: {f: number; c: number}}): string => {
        const truth = b.truth ? ` (f=${b.truth.f.toFixed(2)} c=${b.truth.c.toFixed(2)})` : '';
        return `${b.term.toString()}${truth}`;
    };

    const dispatchToLM = async (input: string): Promise<string> => {
        if (!runner.hasModel()) {
            return 'No LM configured — Narsese input only.';
        }
        const context = await buildContext(input);
        const system = context ? `${buildSystemPrompt()}\n\n## Cognitive State\n${context}` : buildSystemPrompt();

        const iter = runner.run({
            system,
            messages: [{role: 'user', content: input}],
            tools: buildTools(),
            ctxHash: String(Date.now()),
            snapshot: null,
            budget: {systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0},
        });

        let next = await iter.next();
        while (!next.done) next = await iter.next();
        return next.value?.text ?? '';
    };

    const chat = async (input: string): Promise<string> => {
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
                return response;
            }

            const response = `+ ${input}`;
            safeLog('response', response, {narsese: input, taskType: task.taskType});
            return response;
        }

        const response = await dispatchToLM(input);
        safeLog('response', response);
        return response;
    };

    const chatWithHistory = async (
        input: string,
        session: ConversationSession,
        opts: {historyLimit?: number} = {},
    ): Promise<string> => {
        const historyLimit = opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT;
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
                return response;
            }

            const response = `+ ${input}`;
            appendTurn(session, 'user', input, {narsese: true, taskType: task.taskType});
            appendTurn(session, 'assistant', response, {narsese: true, taskType: task.taskType});
            trimHistory(session, historyLimit);
            safeLog('response', response, {session: session.key, narsese: true});
            return response;
        }

        const historyMessages = formatHistoryAsMessages(session.history, historyLimit);
        historyMessages.push({role: 'user', content: input});

        const context = await buildContext(input);
        const system = context ? `${buildSystemPrompt()}\n\n## Cognitive State\n${context}` : buildSystemPrompt();

        const iter = runner.run({
            system,
            messages: historyMessages,
            tools: buildTools(),
            ctxHash: String(Date.now()),
            snapshot: null,
            budget: {systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0},
        });
        let next = await iter.next();
        while (!next.done) next = await iter.next();
        const reply = next.value?.text ?? '';

        appendTurn(session, 'user', input);
        appendTurn(session, 'assistant', reply);
        trimHistory(session, historyLimit);

        safeLog('response', reply, {session: session.key});
        return reply;
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

    const start = (): () => void => {
        if (!nar) return () => {};
        if (reasoningHandle) stop();

        const self = nar.getSelfAnalyzer?.();
        self?.start?.();

        reasoningHandle = setInterval(async () => {
            if (throttle === 0) return;
            const steps = Math.max(1, Math.round(MAX_REASON_STEPS_PER_TICK * (throttle / 100)));
            await nar.run(steps).catch(() => {});
            if (self?.performSelfCorrection) {
                await self.performSelfCorrection().catch(() => {});
            }
        }, REASONING_INTERVAL_MS);

        if (typeof reasoningHandle.unref === 'function') reasoningHandle.unref();
        return stop;
    };

    const stop = (): void => {
        if (reasoningHandle) {
            clearInterval(reasoningHandle);
            reasoningHandle = null;
        }
        nar?.getSelfAnalyzer?.()?.stop?.();
    };

    const setThrottle = (percent: number): void => {
        throttle = Math.max(0, Math.min(100, percent));
    };

    return {
        chat,
        chatWithHistory,
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
    };
}
