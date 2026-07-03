import type { EpisodeType } from '../../../nar/src/memory/EpisodicMemory.js';
import { errMsg } from '../../../nar/src/utils';
import type { ConversationSession } from '../ConversationSession.js';
import { DEFAULT_SESSION_HISTORY_LIMIT } from '../ConversationSession.js';
import type { EventBus } from '../EventBus.js';
import { formatHistoryAsMessages } from '../chat-history.js';
import {
  type InputEvent,
  type InputProcessorDeps,
  appendSessionTurns,
  processInput,
} from '../input-processor.js';
import type { ModelRunner } from '../model/ModelRunner.js';
import type { PromptBuilder } from '../subservices/PromptBuilder.js';
import type { StatsManager } from '../subservices/StatsManager.js';
import type { ChatOptions, ChatStreamEvent } from '../types.js';

type EventPayload = {
  input: string;
  output?: string;
  sessionKey?: string;
  error?: string;
  durationMs?: number;
  tokens?: { input: number; output: number; total: number };
  timestamp: number;
};

export class LMChatService {
  constructor(
    private runner: ModelRunner,
    private promptBuilder: PromptBuilder,
    private eventBus: EventBus,
    private statsManager: StatsManager,
    private buildTools: (session?: ConversationSession) => Record<string, unknown>,
    private safeLog: (
      type: EpisodeType,
      content: string,
      metadata?: Record<string, unknown>
    ) => Promise<void>,
    private processInputDeps: InputProcessorDeps
  ) {}

  async chat(input: string, opts: ChatOptions = {}): Promise<string> {
    const startTime = Date.now();
    this.eventBus.emit('agent:process:start', { input, timestamp: startTime });
    try {
      await this.safeLog('input', input);
      const { text, event } = await this.runProcessInput(input, opts);

      if (event?.kind === 'lm-dispatch') {
        const dispatch = await this.dispatchToLM(input, opts);
        await this.safeLog('response', dispatch.text);
        this.recordSuccess(input, dispatch.text, startTime, dispatch.usage);
        return dispatch.text;
      }

      await this.safeLog('response', text);
      this.recordSuccess(input, text, startTime);
      return text;
    } catch (e) {
      this.recordError(input, startTime, errMsg(e));
      throw e;
    }
  }

  async chatWithHistory(
    input: string,
    session: ConversationSession,
    opts: ChatOptions = {}
  ): Promise<string> {
    const historyLimit = opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT;
    const startTime = Date.now();
    this.eventBus.emit('agent:process:start', {
      input,
      sessionKey: session.key,
      timestamp: startTime,
    });
    try {
      await this.safeLog('input', input, { session: session.key });
      const { text, event } = await this.runProcessInput(input, {
        signal: opts.signal,
        session,
        historyLimit,
      });

      if (event?.kind === 'lm-dispatch') {
        const historyMessages = formatHistoryAsMessages(session.history, historyLimit);
        historyMessages.push({ role: 'user', content: input });
        const composed = await this.buildComposedRequest(input, historyMessages, session);
        const result = await this.runner.runToCompletion(composed, opts.signal);
        const reply = result.text;
        appendSessionTurns(session, input, reply, historyLimit);
        await this.safeLog('response', reply, { session: session.key });
        this.recordSuccess(input, reply, startTime, result.usage, session.key);
        return reply;
      }

      appendSessionTurns(session, input, text, historyLimit);
      await this.safeLog('response', text, { session: session.key });
      this.recordSuccess(input, text, startTime, undefined, session.key);
      return text;
    } catch (e) {
      this.recordError(input, startTime, errMsg(e), session.key);
      throw e;
    }
  }

  async *chatStream(
    input: string,
    session?: ConversationSession,
    opts: ChatOptions = {}
  ): AsyncGenerator<ChatStreamEvent, string> {
    const startTime = Date.now();
    this.eventBus.emit('agent:process:start', {
      input,
      ...(session ? { sessionKey: session.key } : {}),
      timestamp: startTime,
    });
    let final = '';
    let streamUsage: { inputTokens: number; outputTokens: number; totalTokens: number } | undefined;
    let didError = false;
    let errorMessage: string | undefined;
    try {
      const historyLimit = opts.historyLimit ?? DEFAULT_SESSION_HISTORY_LIMIT;
      const gen = processInput(this.processInputDeps, input, {
        signal: opts.signal,
        session,
        historyLimit,
      });
      let next = await gen.next();
      while (!next.done) {
        const ev = next.value;
        if (ev.kind === 'lm-dispatch') {
          let historyMessages:
            | Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
            | undefined;
          if (session) {
            historyMessages = formatHistoryAsMessages(session.history, historyLimit);
            historyMessages.push({ role: 'user', content: input });
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
            if (lmEv.kind === 'text-delta') yield { kind: 'text-delta', text: lmEv.text };
            else if (lmEv.kind === 'tool-call')
              yield {
                kind: 'tool-call',
                toolName: lmEv.call.toolName,
                toolArgs: lmEv.call.args,
              };
            else if (lmEv.kind === 'tool-result')
              yield {
                kind: 'tool-result',
                toolName: lmEv.call.toolName,
                toolArgs: lmEv.call.args,
                toolResult: lmEv.result,
              };
          }
        } else {
          final = ev.text;
          yield { kind: 'text-delta', text: ev.text };
        }
        next = await gen.next();
      }
      if (opts.signal?.aborted) {
        yield { kind: 'aborted' };
        return final;
      }
      yield { kind: 'finish', text: final };
      if (session) {
        appendSessionTurns(session, input, final, historyLimit);
      }
      await this.safeLog('response', final, session ? { session: session.key } : {});
      return final;
    } catch (e) {
      didError = true;
      errorMessage = errMsg(e);
      yield { kind: 'error', error: errorMessage };
      return final;
    } finally {
      if (didError) {
        this.recordError(input, startTime, errorMessage ?? 'unknown', session?.key);
      } else {
        this.recordSuccess(input, final, startTime, streamUsage, session?.key);
      }
    }
  }

  private recordSuccess(
    input: string,
    output: string,
    startTime: number,
    usage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    },
    sessionKey?: string
  ): void {
    const durationMs = Date.now() - startTime;
    this.statsManager.recordStats('success', durationMs, usage);
    const payload: EventPayload = { input, output, durationMs, timestamp: Date.now() };
    if (sessionKey) payload.sessionKey = sessionKey;
    if (usage)
      payload.tokens = {
        input: usage.inputTokens,
        output: usage.outputTokens,
        total: usage.totalTokens,
      };
    this.eventBus.emit('agent:process:complete', payload as any);
  }

  private recordError(input: string, startTime: number, error: string, sessionKey?: string): void {
    this.statsManager.recordStats('failure', Date.now() - startTime);
    this.eventBus.emit('agent:process:error', {
      input,
      error,
      timestamp: Date.now(),
      ...(sessionKey ? { sessionKey } : {}),
    });
  }

  private async buildComposedRequest(
    input: string,
    historyMessages?: Array<{
      role: 'user' | 'assistant' | 'system' | 'tool';
      content: string;
    }>,
    session?: ConversationSession
  ) {
    const system = await this.promptBuilder.buildSystemPrompt(input, session);
    return {
      system,
      messages: historyMessages ?? [{ role: 'user' as const, content: input }],
      tools: this.buildTools(session),
      ctxHash: String(Date.now()),
      snapshot: null,
      budget: { systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0 },
    };
  }

  private async dispatchToLM(
    input: string,
    opts: {
      signal?: AbortSignal;
      session?: ConversationSession;
    } = {}
  ): Promise<{
    text: string;
    usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
  }> {
    if (!this.runner.hasModel()) return { text: 'No LM configured — Narsese input only.' };
    const composed = await this.buildComposedRequest(input, undefined, opts.session);
    const result = await this.runner.runToCompletion(composed, opts.signal);
    return {
      text: result.text,
      ...(result.usage.totalTokens > 0 ? { usage: result.usage } : {}),
    };
  }

  private async runProcessInput(
    input: string,
    opts: {
      signal?: AbortSignal;
      session?: ConversationSession;
      historyLimit?: number;
    } = {}
  ) {
    const gen = processInput(this.processInputDeps, input, opts);
    let next = await gen.next();
    let event: InputEvent | undefined;
    while (!next.done) {
      event = next.value;
      next = await gen.next();
    }
    return { text: next.value, event };
  }
}
