/**
 * Server message handler registry.
 * Replaces the `handleClientMessage` switch with a registered handler map.
 */
import type { IncomingFromClient } from '@senars/core';
import { WebSocket } from 'ws';
import type { Agent } from '@senars/core';
import type { UnifiedGraphProjection } from './UnifiedGraphProjection.js';
import type { LensSpec } from '@senars/core';
import { type NarLike } from './server-utils.js';
import {
  errorFrame,
  respondReasoning,
  sendLmStatus,
  sendNodeHistory,
  sendStateSnapshot,
  applyLmSwitch,
  runCycles,
  aggregateChatResponse,
  broadcastCognitiveEvent,
  applyConfigUpdates,
  applyConfigField,
  providerCatalog,
  LM_PROVIDER_NAMES,
  spendTerminations,
  mergeSpendSummaries,
} from './server-utils.js';

export interface HandlerContext {
  agent: Agent | undefined;
  projection: UnifiedGraphProjection | undefined;
  ws: WebSocket;
  nar: () => NarLike | undefined;
  activeRun: { current: AbortController | undefined };
  wss: { clients: Set<WebSocket> };
  currentNarConfig: Record<string, unknown>;
  DEFAULT_RUN_CYCLES: number;
  ASK_RUN_CYCLES: number;
}

export type MessageHandler = (ctx: HandlerContext, msg: IncomingFromClient) => void;

const handlerMap = new Map<IncomingFromClient['type'], MessageHandler>();

export function registerHandler(type: IncomingFromClient['type'], handler: MessageHandler): void {
  if (handlerMap.has(type)) {
    console.warn(`[handler-registry] Overwriting handler for ${type}`);
  }
  handlerMap.set(type, handler);
}

export function getHandler(type: IncomingFromClient['type']): MessageHandler | undefined {
  return handlerMap.get(type);
}

export function handleClientMessage(ctx: HandlerContext, msg: IncomingFromClient): void {
  const handler = handlerMap.get(msg.type);
  if (handler) {
    handler(ctx, msg);
  } else {
    console.warn(`[handler-registry] No handler for message type: ${msg.type}`);
  }
}

export function registeredMessageTypes(): IncomingFromClient['type'][] {
  return Array.from(handlerMap.keys());
}

export function hasHandler(type: IncomingFromClient['type']): boolean {
  return handlerMap.has(type);
}

// Message types from the IncomingFromClient union
type ClientMsgType = IncomingFromClient['type'];

// Type-safe registration helper
function register<K extends ClientMsgType>(
  type: K,
  handler: (ctx: HandlerContext, msg: Extract<IncomingFromClient, { type: K }>) => void
): void {
  registerHandler(type, handler as MessageHandler);
}

export function initializeHandlers(
  agent: Agent | undefined,
  projection: UnifiedGraphProjection | undefined,
  nar: () => NarLike | undefined,
  activeRun: { current: AbortController | undefined },
  wss: { clients: Set<WebSocket> },
  currentNarConfig: Record<string, unknown>,
  DEFAULT_RUN_CYCLES: number,
  ASK_RUN_CYCLES: number
): void {
  // chat.user
  register('chat.user', async (ctx, msg) => {
    if (!ctx.agent) return;
    const response = await aggregateChatResponse(ctx.agent, msg.content, ctx.ws);
    if (ctx.ws.readyState === WebSocket.OPEN) {
      ctx.ws.send(
        JSON.stringify({ type: 'chat.agent.complete', messageId: (await import('@senars/util')).makeId(), content: response })
      );
    }
  });

  // config.set
  register('config.set', (ctx, msg) => {
    const updates = applyConfigField(msg.key, msg.value);
    if (updates) {
      applyConfigUpdates(updates, ctx.nar, ctx.currentNarConfig, () => {
        import('./server-utils.js').then(({ broadcastConfigSchema }) =>
          broadcastConfigSchema(ctx.wss, ctx.currentNarConfig)
        );
      });
    }
  });

  // sync.request
  register('sync.request', (ctx, _msg) => {
    sendStateSnapshot(ctx.ws, ctx.projection, ctx.nar, ctx.currentNarConfig);
  });

  // lens.set
  register('lens.set', (ctx, msg) => {
    ctx.projection?.setLens(msg.lens);
  });

  // focus.set
  register('focus.set', (ctx, msg) => {
    ctx.projection?.setFocus(msg.term);
  });

  // object.set
  register('object.set', (ctx, msg) => {
    ctx.projection?.applyObjectPatch(msg.kind, msg.id, msg.patch);
  });

  // lens.define
  register('lens.define', (ctx, msg) => {
    ctx.projection?.defineLens(msg.lens as LensSpec);
  });

  // node.history.request
  register('node.history.request', (ctx, msg) => {
    sendNodeHistory(ctx.ws, msg.term, ctx.nar);
  });

  // lm.status.request
  register('lm.status.request', (ctx, _msg) => {
    sendLmStatus(ctx.ws, ctx.nar, LM_PROVIDER_NAMES);
  });

  // lm.switch
  register('lm.switch', (ctx, msg) => {
    applyLmSwitch(ctx.ws, msg.provider, msg.model, ctx.nar, LM_PROVIDER_NAMES);
  });

  // reasoning.submit
  register('reasoning.submit', (ctx, msg) => {
    const engine = ctx.nar();
    const mode = msg.mode ?? 'belief';
    const handler =
      mode === 'goal' ? engine?.goal : mode === 'question' ? engine?.question : engine?.believe;
    if (!engine || !handler) {
      respondReasoning(ctx.ws, false, `Engine cannot accept ${mode} statements`, msg.seqId);
      return;
    }
    void Promise.resolve(handler.call(engine, msg.term))
      .then(() => respondReasoning(ctx.ws, true, undefined, msg.seqId))
      .catch((e: unknown) => respondReasoning(ctx.ws, false, (e as Error).message, msg.seqId));
  });

  // reasoning.ask
  register('reasoning.ask', (ctx, msg) => {
    const engine = ctx.nar();
    if (!engine?.question || !engine.run || !engine.askWithDerivation) {
      respondReasoning(ctx.ws, false, 'Engine cannot answer questions', msg.seqId);
      return;
    }
    const runs = msg.runs ?? ctx.ASK_RUN_CYCLES;
    void (async () => {
      try {
        await engine.question?.(msg.term);
        await engine.run?.(runs, ctx.activeRun.current?.signal);
        const answer = await engine.askWithDerivation?.(msg.term);
        if (answer?.derivation) {
          broadcastCognitiveEvent(
            {
              type: 'derivation.record',
              timestamp: Date.now(),
              correlationId: (await import('@senars/util')).makeId(),
              engine: 'nar',
              payload: answer.derivation.record,
            },
            ctx.wss
          );
        }
        respondReasoning(ctx.ws, true, undefined, msg.seqId, {
          answer: {
            answer: answer?.answer,
            frequency: answer?.truth?.f,
            confidence: answer?.truth?.c,
            hasDerivation: !!answer?.derivation,
          },
        });
      } catch (e: unknown) {
        respondReasoning(ctx.ws, false, (e as Error).message, msg.seqId);
      }
    })();
  });

  // reasoning.add-goal
  register('reasoning.add-goal', (ctx, msg) => {
    const engine = ctx.nar();
    if (!engine?.goal) {
      respondReasoning(ctx.ws, false, 'Engine cannot accept goals', msg.seqId);
      return;
    }
    void Promise.resolve(engine.goal(msg.term))
      .then(() => respondReasoning(ctx.ws, true, undefined, msg.seqId))
      .catch((e: unknown) => respondReasoning(ctx.ws, false, (e as Error).message, msg.seqId));
  });

  // reasoning.step
  register('reasoning.step', (ctx, msg) => {
    runCycles(
      ctx.ws,
      1,
      msg.seqId,
      ctx.nar,
      ctx.activeRun,
      respondReasoning,
      spendTerminations,
      mergeSpendSummaries
    );
  });

  // reasoning.run
  register('reasoning.run', (ctx, msg) => {
    runCycles(
      ctx.ws,
      ctx.DEFAULT_RUN_CYCLES,
      msg.seqId,
      ctx.nar,
      ctx.activeRun,
      respondReasoning,
      spendTerminations,
      mergeSpendSummaries
    );
  });

  // reasoning.abort
  register('reasoning.abort', (ctx, msg) => {
    ctx.activeRun.current?.abort();
    ctx.activeRun.current = undefined;
    respondReasoning(ctx.ws, true, undefined, msg.seqId);
  });

  // reasoning.retract
  register('reasoning.retract', (ctx, msg) => {
    const removed = ctx.nar()?.retract?.(msg.nodeId);
    respondReasoning(ctx.ws, !!removed, removed ? undefined : 'No such belief to retract', msg.seqId);
  });

  // reasoning.revise
  register('reasoning.revise', (ctx, msg) => {
    const engine = ctx.nar();
    if (!engine?.believe) {
      respondReasoning(ctx.ws, false, 'Engine cannot revise beliefs', msg.seqId);
      return;
    }
    void Promise.resolve(engine.believe(msg.nodeId, { f: msg.frequency, c: msg.confidence }))
      .then(() => respondReasoning(ctx.ws, true, undefined, msg.seqId))
      .catch((e: unknown) => respondReasoning(ctx.ws, false, (e as Error).message, msg.seqId));
  });

  // reasoning.adjust-budget
  register('reasoning.adjust-budget', (ctx, msg) => {
    respondReasoning(ctx.ws, false, `${msg.type} is not yet wired to the engine`, msg.seqId);
  });

  // reasoning.adjust-provider
  register('reasoning.adjust-provider', (ctx, msg) => {
    respondReasoning(ctx.ws, false, `${msg.type} is not yet wired to the engine`, msg.seqId);
  });
}