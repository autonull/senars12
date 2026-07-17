import type { CognitiveEvent } from './CognitiveEvent.js';
import type { ModelRunner } from './ModelRunner.js';

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: object;
  readonly execute: (args: unknown, signal?: AbortSignal) => Promise<unknown>;
}

export interface ChatContext {
  readonly engine: 'nar' | 'metta';
  readonly timestamp: number;
}

export interface ChatServiceDeps<TCtx extends ChatContext> {
  readonly runner: ModelRunner;
  readonly buildSystemPrompt: (ctx: TCtx) => Promise<string>;
  readonly tools: Record<string, unknown>;
  readonly onEvent: (event: CognitiveEvent) => void;
  readonly getContext: () => TCtx;
}

export interface ChatOptions {
  readonly signal?: AbortSignal;
  readonly sessionId?: string;
  readonly stream?: boolean;
}

export interface ChatStreamEvent {
  readonly kind: 'text-delta' | 'tool-call' | 'tool-result' | 'finish' | 'error' | 'aborted';
  readonly text?: string;
  readonly toolName?: string;
  readonly toolArgs?: unknown;
  readonly toolResult?: unknown;
  readonly error?: string;
}

export function createChatService<TCtx extends ChatContext>(deps: ChatServiceDeps<TCtx>) {
  return {
    async *chat(input: string, opts: ChatOptions = {}): AsyncGenerator<ChatStreamEvent, string> {
      const correlationId = crypto.randomUUID();
      const startTime = Date.now();
      const ctx = deps.getContext();

      deps.onEvent({
        engine: ctx.engine,
        type: 'input.user',
        timestamp: startTime,
        correlationId,
        payload: { text: input, source: 'chat' },
      });

      try {
        const system = await deps.buildSystemPrompt(ctx);
        const composed = {
          system,
          messages: [{ role: 'user' as const, content: input }],
          tools: deps.tools,
          ctxHash: String(Date.now()),
          snapshot: null,
          budget: { systemTokens: 0, historyTokens: 0, snapshotTokens: 0, total: 0, maxTokens: 0 },
        };

        let finalText = '';
        for await (const event of deps.runner.run(composed, opts.signal)) {
          if (event.kind === 'text-delta') {
            finalText += event.text;
            yield { kind: 'text-delta', text: event.text };
          } else if (event.kind === 'tool-call') {
            yield { kind: 'tool-call', toolName: event.call.toolName, toolArgs: event.call.args };
          } else if (event.kind === 'tool-result') {
            yield {
              kind: 'tool-result',
              toolName: event.call.toolName,
              toolArgs: event.call.args,
              toolResult: event.result,
            };
          } else if (event.kind === 'finish') {
            break;
          }
        }

        yield { kind: 'finish', text: finalText };

        deps.onEvent({
          engine: ctx.engine,
          type: 'derivation.made',
          timestamp: Date.now(),
          correlationId,
          payload: { rule: '', premises: [], conclusion: finalText },
        });

        return finalText;
      } catch (e) {
        const error = e instanceof Error ? e.message : String(e);
        yield { kind: 'error', error };
        throw e;
      }
    },
  };
}
