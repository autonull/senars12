/**
 * @deprecated No active callers. Canonical interactive path is
 * `Agent.chat()` → `runCycleStream()` → `LLMCortex.synthesizeStream()`.
 * Types (`ChatOptions`, `ChatStreamEvent`) remain canonical and are imported
 * across `Agent`, `phases`, and `LLMCortex`. Do not build new features here.
 */

import { errMsg, makeId } from '@senars/util';
import type { ChatStreamEvent, CognitiveEvent } from '@senars/util/types/cognitive';
import type { ModelRunner, ToolSet } from './ModelRunner.js';

export interface Tool {
  readonly name: string;
  readonly description: string;
  readonly parameters: object;
  readonly execute: (args: unknown, signal?: AbortSignal) => Promise<unknown>;
}

export interface ChatContext {
  readonly engine: 'nar';
  readonly timestamp: number;
}

export interface ChatServiceDeps<TCtx extends ChatContext> {
  readonly runner: ModelRunner;
  readonly buildSystemPrompt: (ctx: TCtx) => Promise<string>;
  readonly tools: Record<string, unknown>;
  readonly onEvent: (event: CognitiveEvent) => void;
  readonly getContext: () => TCtx;
}

export type { ChatStreamEvent };

export interface ChatOptions {
  readonly signal?: AbortSignal;
  readonly sessionId?: string;
  readonly stream?: boolean;
  readonly tier?: 'quality' | 'fast' | 'structured';
}

export function createChatService<TCtx extends ChatContext>(deps: ChatServiceDeps<TCtx>) {
  return {
    async *chat(input: string, opts: ChatOptions = {}): AsyncGenerator<ChatStreamEvent, string> {
      const correlationId = makeId();
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
          tools: deps.tools as ToolSet,
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

        yield { kind: 'finish', text: finalText, correlationId };

        deps.onEvent({
          engine: ctx.engine,
          type: 'derivation.made',
          timestamp: Date.now(),
          correlationId,
          payload: { rule: '', premises: [], conclusion: finalText },
        });

        return finalText;
      } catch (e) {
        const error = errMsg(e);
        yield { kind: 'error', error };
        throw e;
      }
    },
  };
}
