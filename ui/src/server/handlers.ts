/**
 * Server message handlers — extracted from handler-registry.ts for the protocol registry.
 *
 * Each handler takes the context and message directly (not curried).
 */
import type { ServerHandlerContext } from '../client/framework/protocol.js';
import { WebSocket } from 'ws';
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
  LM_PROVIDER_NAMES,
  spendTerminations,
  mergeSpendSummaries,
} from './server-utils.js';
import type { Agent } from '@senars/core';
import type { UnifiedGraphProjection } from './UnifiedGraphProjection.js';
import type { LensSpec } from '@senars/core';
import { type NarLike } from './server-utils.js';

/** Type guard for WebSocket ready state. */
function isOpen(ws: WebSocket): boolean {
  return ws.readyState === WebSocket.OPEN;
}

function getNar(ctx: ServerHandlerContext): NarLike | undefined {
  return (ctx.nar as () => NarLike | undefined)();
}

function getProjection(ctx: ServerHandlerContext): UnifiedGraphProjection | undefined {
  return ctx.projection as UnifiedGraphProjection | undefined;
}

function getWss(ctx: ServerHandlerContext): { clients: Set<WebSocket> } {
  return ctx.wss as { clients: Set<WebSocket> };
}

function getActiveRun(ctx: ServerHandlerContext): { current: AbortController | undefined } {
  return ctx.activeRun as { current: AbortController | undefined };
}

export async function handleChatUser(
  ctx: ServerHandlerContext,
  msg: { type: 'chat.user'; content: string; mode?: string; contexts?: string[] }
): Promise<void> {
  if (!ctx.agent) return;
  const response = await aggregateChatResponse(ctx.agent as Agent, msg.content, ctx.ws as WebSocket);
  if (isOpen(ctx.ws as WebSocket)) {
    const { makeId } = await import('@senars/util');
    (ctx.ws as WebSocket).send(
      JSON.stringify({ type: 'chat.agent.complete', messageId: makeId(), content: response })
    );
  }
}

export function handleConfigSet(
  ctx: ServerHandlerContext,
  msg: { type: 'config.set'; key: string; value: unknown }
): void {
  const updates = applyConfigField(msg.key, msg.value);
  if (updates) {
    applyConfigUpdates(
      updates,
      () => getNar(ctx),
      ctx.currentNarConfig,
      () => {
        import('./server-utils.js').then(({ broadcastConfigSchema }) =>
          broadcastConfigSchema(getWss(ctx), ctx.currentNarConfig)
        );
      }
    );
  }
}

export function handleSyncRequest(
  ctx: ServerHandlerContext,
  _msg: { type: 'sync.request' }
): void {
  sendStateSnapshot(ctx.ws as WebSocket, getProjection(ctx), () => getNar(ctx), ctx.currentNarConfig);
}

export function handleLensSet(
  ctx: ServerHandlerContext,
  msg: { type: 'lens.set'; lens: string }
): void {
  getProjection(ctx)?.setLens(msg.lens);
}

export function handleFocusSet(
  ctx: ServerHandlerContext,
  msg: { type: 'focus.set'; term: string }
): void {
  getProjection(ctx)?.setFocus(msg.term);
}

export function handleObjectSet(
  ctx: ServerHandlerContext,
  msg: { type: 'object.set'; kind: 'node' | 'edge'; id: string; patch: Record<string, unknown> }
): void {
  getProjection(ctx)?.applyObjectPatch(msg.kind, msg.id, msg.patch);
}

export function handleLensDefine(
  ctx: ServerHandlerContext,
  msg: { type: 'lens.define'; lens: LensSpec }
): void {
  getProjection(ctx)?.defineLens(msg.lens);
}

export function handleNodeHistoryRequest(
  ctx: ServerHandlerContext,
  msg: { type: 'node.history.request'; term: string }
): void {
  sendNodeHistory(ctx.ws as WebSocket, msg.term, () => getNar(ctx));
}

export function handleLMStatusRequest(
  ctx: ServerHandlerContext,
  _msg: { type: 'lm.status.request' }
): void {
  sendLmStatus(ctx.ws as WebSocket, () => getNar(ctx), LM_PROVIDER_NAMES);
}

export function handleLMSwitch(
  ctx: ServerHandlerContext,
  msg: { type: 'lm.switch'; provider: string; model?: string }
): void {
  applyLmSwitch(ctx.ws as WebSocket, msg.provider, msg.model, () => getNar(ctx), LM_PROVIDER_NAMES);
}

export async function handleReasoningSubmit(
  ctx: ServerHandlerContext,
  msg: { type: 'reasoning.submit'; term: string; mode?: string; seqId?: number }
): Promise<void> {
  const engine = getNar(ctx);
  const mode = msg.mode ?? 'belief';
  const handler = mode === 'goal' ? engine?.goal : mode === 'question' ? engine?.question : engine?.believe;
  if (!engine || !handler) {
    respondReasoning(ctx.ws as WebSocket, false, `Engine cannot accept ${mode} statements`, msg.seqId);
    return;
  }
  await Promise.resolve(handler.call(engine, msg.term))
    .then(() => respondReasoning(ctx.ws as WebSocket, true, undefined, msg.seqId))
    .catch((e: unknown) => respondReasoning(ctx.ws as WebSocket, false, (e as Error).message, msg.seqId));
}

export async function handleReasoningAsk(
  ctx: ServerHandlerContext,
  msg: { type: 'reasoning.ask'; term: string; runs?: number; seqId?: number }
): Promise<void> {
  const engine = getNar(ctx);
  if (!engine?.question || !engine.run || !engine.askWithDerivation) {
    respondReasoning(ctx.ws as WebSocket, false, 'Engine cannot answer questions', msg.seqId);
    return;
  }
  const runs = msg.runs ?? ctx.ASK_RUN_CYCLES;
  (async () => {
    try {
      await engine.question?.(msg.term);
      await engine.run?.(runs, getActiveRun(ctx).current?.signal);
      const answer = await engine.askWithDerivation?.(msg.term);
      if (answer?.derivation) {
        const { makeId } = await import('@senars/util');
        broadcastCognitiveEvent(
          {
            type: 'derivation.record',
            timestamp: Date.now(),
            correlationId: makeId(),
            engine: 'nar',
            payload: answer.derivation.record,
          },
          getWss(ctx)
        );
      }
      respondReasoning(ctx.ws as WebSocket, true, undefined, msg.seqId, {
        answer: {
          answer: answer?.answer,
          frequency: answer?.truth?.f,
          confidence: answer?.truth?.c,
          hasDerivation: !!answer?.derivation,
        },
      });
    } catch (e: unknown) {
      respondReasoning(ctx.ws as WebSocket, false, (e as Error).message, msg.seqId);
    }
  })();
}

export function handleReasoningStep(
  ctx: ServerHandlerContext,
  msg: { type: 'reasoning.step'; seqId?: number }
): void {
  runCycles(
    ctx.ws as WebSocket,
    1,
    msg.seqId,
    () => getNar(ctx),
    getActiveRun(ctx),
    respondReasoning,
    spendTerminations,
    mergeSpendSummaries
  );
}

export function handleReasoningRun(
  ctx: ServerHandlerContext,
  msg: { type: 'reasoning.run'; seqId?: number }
): void {
  runCycles(
    ctx.ws as WebSocket,
    ctx.DEFAULT_RUN_CYCLES,
    msg.seqId,
    () => getNar(ctx),
    getActiveRun(ctx),
    respondReasoning,
    spendTerminations,
    mergeSpendSummaries
  );
}

export function handleReasoningAbort(
  ctx: ServerHandlerContext,
  msg: { type: 'reasoning.abort'; seqId?: number }
): void {
  getActiveRun(ctx).current?.abort();
  getActiveRun(ctx).current = undefined;
  respondReasoning(ctx.ws as WebSocket, true, undefined, msg.seqId);
}

export function handleReasoningRetract(
  ctx: ServerHandlerContext,
  msg: { type: 'reasoning.retract'; nodeId: string; seqId?: number }
): void {
  const removed = getNar(ctx)?.retract?.(msg.nodeId);
  respondReasoning(ctx.ws as WebSocket, !!removed, removed ? undefined : 'No such belief to retract', msg.seqId);
}

export async function handleReasoningRevise(
  ctx: ServerHandlerContext,
  msg: { type: 'reasoning.revise'; nodeId: string; frequency: number; confidence: number; seqId?: number }
): Promise<void> {
  const engine = getNar(ctx);
  if (!engine?.believe) {
    respondReasoning(ctx.ws as WebSocket, false, 'Engine cannot revise beliefs', msg.seqId);
    return;
  }
  await Promise.resolve(engine.believe(msg.nodeId, { f: msg.frequency, c: msg.confidence }))
    .then(() => respondReasoning(ctx.ws as WebSocket, true, undefined, msg.seqId))
    .catch((e: unknown) => respondReasoning(ctx.ws as WebSocket, false, (e as Error).message, msg.seqId));
}

export async function handleReasoningAddGoal(
  ctx: ServerHandlerContext,
  msg: { type: 'reasoning.add-goal'; term: string; seqId?: number }
): Promise<void> {
  const engine = getNar(ctx);
  if (!engine?.goal) {
    respondReasoning(ctx.ws as WebSocket, false, 'Engine cannot accept goals', msg.seqId);
    return;
  }
  await Promise.resolve(engine.goal(msg.term))
    .then(() => respondReasoning(ctx.ws as WebSocket, true, undefined, msg.seqId))
    .catch((e: unknown) => respondReasoning(ctx.ws as WebSocket, false, (e as Error).message, msg.seqId));
}

export function handleReasoningAdjustBudget(
  ctx: ServerHandlerContext,
  msg: { type: 'reasoning.adjust-budget'; budget: number; seqId?: number }
): void {
  respondReasoning(ctx.ws as WebSocket, false, `${msg.type} is not yet wired to the engine`, msg.seqId);
}

export function handleReasoningAdjustProvider(
  ctx: ServerHandlerContext,
  msg: { type: 'reasoning.adjust-provider'; provider: string; seqId?: number }
): void {
  respondReasoning(ctx.ws as WebSocket, false, `${msg.type} is not yet wired to the engine`, msg.seqId);
}