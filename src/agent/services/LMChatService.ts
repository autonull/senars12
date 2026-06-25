import type {LMClient} from '../../nar/lm/types.js';
import type {ConversationSession} from '../ConversationSession.js';
import {DEFAULT_SESSION_HISTORY_LIMIT} from '../ConversationSession.js';
import {formatHistoryAsMessages} from '../chat-history.js';
import {ModelRunner} from '../model/ModelRunner.js';
import {PromptBuilder} from '../subservices/PromptBuilder.js';
import type {ChatOptions, ChatStreamEvent} from '../types.js';
import {EventBus} from '../EventBus.js';
import {StatsManager} from '../subservices/StatsManager.js';
import {processInput, appendSessionTurns, type InputEvent} from '../input-processor.js';
import type {EpisodeType} from '../../nar/memory/EpisodicMemory.js';

const toEventTokens = (u: {inputTokens: number; outputTokens: number; totalTokens: number}) => ({
    input: u.inputTokens,
    output: u.outputTokens,
    total: u.totalTokens,
});

export class LMChatService {
    constructor(
        private runner: ModelRunner,
        private promptBuilder: PromptBuilder,
        private eventBus: EventBus,
        private statsManager: StatsManager,
        private buildTools: (session?: ConversationSession) => Record<string, unknown>,
        private safeLog: (type: EpisodeType, content: string, metadata?: Record<string, unknown>) => Promise<void>,
        private processInputDeps: any
    ) {}

    private async buildComposedRequest(input: string, historyMessages?: Array<{role: 'user' | 'assistant' | 'system' | 'tool'; content: string}>, session?: ConversationSession) {
        const system = await this.promptBuilder.buildSystemPrompt(input, session);
        return {
            system,
            messages: historyMessages ?? [{role: 'user' as const, content: input}],
            tools: this.buildTools(session),
            ctxHash: String(Date.now()),
            snapshot: null,
            budget: {systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0},
        };
    }

    private async dispatchToLM(input: string, opts: {signal?: AbortSignal; session?: ConversationSession} = {}): Promise<{text: string; usage?: {inputTokens: number; outputTokens: number; totalTokens: number}}> {
        if (!this.runner.hasModel()) return {text: 'No LM configured — Narsese input only.'};
        const composed = await this.buildComposedRequest(input, undefined, opts.session);
        const iter = this.runner.run(composed, opts.signal);
        let next = await iter.next();
        while (!next.done) next = await iter.next();
        return {text: next.value?.text ?? '', ...(next.value?.usage ? {usage: next.value.usage} : {})};
    }

    private async runProcessInput(input: string, opts: {signal?: AbortSignal; session?: ConversationSession; historyLimit?: number} = {}) {
        const gen = processInput(this.processInputDeps, input, opts);
        let next = await gen.next();
        let event: InputEvent | undefined;
        while (!next.done) {
            event = next.value;
            next = await gen.next();
        }
        return {text: next.value, event};
    }

    async chat(input: string, opts: ChatOptions = {}): Promise<string> {
        const startTime = Date.now();
        this.eventBus.emit('agent:process:start', {input, timestamp: startTime});
        try {
            await this.safeLog('input', input);
            const {text, event} = await this.runProcessInput(input, opts);

            if (event?.kind === 'lm-dispatch') {
                const dispatch = await this.dispatchToLM(input, opts);
                const response = dispatch.text;
                await this.safeLog('response', response);
                this.statsManager.recordStats('success', Date.now() - startTime, dispatch.usage);
                this.eventBus.emit('agent:process:complete', {input, output: response, durationMs: Date.now() - startTime, ...(dispatch.usage ? {tokens: toEventTokens(dispatch.usage)} : {}), timestamp: Date.now()});
                return response;
            }

            await this.safeLog('response', text);
            this.statsManager.recordStats('success', Date.now() - startTime);
            this.eventBus.emit('agent:process:complete', {input, output: text, durationMs: Date.now() - startTime, timestamp: Date.now()});
            return text;
        } catch (e) {
            const err = e instanceof Error ? e.message : String(e);
            this.statsManager.recordStats('failure', Date.now() - startTime);
            this.eventBus.emit('agent:process:error', {input, error: err, timestamp: Date.now()});
            throw e;
        }
    }

    async chatWithHistory(input: string, session: ConversationSession, opts: ChatOptions = {}): Promise<string> {
        const historyLimit = opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT;
        const startTime = Date.now();
        this.eventBus.emit('agent:process:start', {input, sessionKey: session.key, timestamp: startTime});
        try {
            await this.safeLog('input', input, {session: session.key});
            const {text, event} = await this.runProcessInput(input, {signal: opts.signal, session, historyLimit});

            if (event?.kind === 'lm-dispatch') {
                const historyMessages = formatHistoryAsMessages(session.history, historyLimit);
                historyMessages.push({role: 'user', content: input});
                const composed = await this.buildComposedRequest(input, historyMessages, session);
                const iter = this.runner.run(composed, opts.signal);
                let next = await iter.next();
                while (!next.done) next = await iter.next();
                const reply = next.value?.text ?? '';
                const usage = next.value?.usage;
                appendSessionTurns(session, input, reply, historyLimit);
                await this.safeLog('response', reply, {session: session.key});
                this.statsManager.recordStats('success', Date.now() - startTime, usage);
                this.eventBus.emit('agent:process:complete', {input, output: reply, sessionKey: session.key, durationMs: Date.now() - startTime, ...(usage ? {tokens: toEventTokens(usage)} : {}), timestamp: Date.now()});
                return reply;
            }

            appendSessionTurns(session, input, text, historyLimit);
            await this.safeLog('response', text, {session: session.key});
            this.statsManager.recordStats('success', Date.now() - startTime);
            this.eventBus.emit('agent:process:complete', {input, output: text, sessionKey: session.key, durationMs: Date.now() - startTime, timestamp: Date.now()});
            return text;
        } catch (e) {
            const err = e instanceof Error ? e.message : String(e);
            this.statsManager.recordStats('failure', Date.now() - startTime);
            this.eventBus.emit('agent:process:error', {input, sessionKey: session.key, error: err, timestamp: Date.now()});
            throw e;
        }
    }

    async *chatStream(
        input: string,
        session?: ConversationSession,
        opts: ChatOptions = {},
    ): AsyncGenerator<ChatStreamEvent, string> {
        const startTime = Date.now();
        this.eventBus.emit('agent:process:start', {input, ...(session ? {sessionKey: session.key} : {}), timestamp: startTime});
        let final = '';
        let streamUsage: {inputTokens: number; outputTokens: number; totalTokens: number} | undefined;
        let didError = false;
        let errorMessage: string | undefined;
        try {
            const historyLimit = opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT;
            const gen = processInput(this.processInputDeps, input, {signal: opts.signal, session, historyLimit});
            let next = await gen.next();
            while (!next.done) {
                const ev = next.value;
                if (ev.kind === 'lm-dispatch') {
                    let historyMessages: Array<{role: 'user' | 'assistant' | 'system'; content: string}> | undefined;
                    if (session) {
                        historyMessages = formatHistoryAsMessages(session.history, historyLimit);
                        historyMessages.push({role: 'user', content: input});
                    }
                    const composed = await this.buildComposedRequest(input, historyMessages, session);
                    const iter = this.runner.run(composed, opts.signal);
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
            await this.safeLog('response', final, session ? {session: session.key} : {});
            return final;
        } catch (e) {
            didError = true;
            errorMessage = e instanceof Error ? e.message : String(e);
            yield {kind: 'error', error: errorMessage};
            return final;
        } finally {
            this.statsManager.recordStats(didError ? 'failure' : 'success', Date.now() - startTime, streamUsage);
            if (didError) {
                this.eventBus.emit('agent:process:error', {input, ...(session ? {sessionKey: session.key} : {}), error: errorMessage ?? 'unknown', timestamp: Date.now()});
            } else {
                this.eventBus.emit('agent:process:complete', {input, output: final, ...(session ? {sessionKey: session.key} : {}), durationMs: Date.now() - startTime, ...(streamUsage ? {tokens: toEventTokens(streamUsage)} : {}), timestamp: Date.now()});
            }
        }
    }
}
