/**
 * Server message handler registry — backed by the server protocol catalog.
 *
 * The catalog provides schema validation for every message type, a single
 * source of truth for the wire protocol, and type-safe dispatch to the
 * `toServer` handler bodies in `handlers.ts`.
 */
import type { IncomingFromClient } from '@senars/core';
import { WebSocket } from 'ws';
import type { Agent } from '@senars/core';
import type { UnifiedGraphProjection } from './UnifiedGraphProjection.js';
import { type NarLike } from './server-utils.js';
import { getServerProtocolCatalog } from './protocol-server.js';
import type { ServerHandlerContext } from '../client/framework/protocol.js';
import { errorFrame } from './server-utils.js';

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

/** Initialize the protocol catalog (idempotent). */
export function initializeHandlers(
  _agent: Agent | undefined,
  _projection: UnifiedGraphProjection | undefined,
  _nar: () => NarLike | undefined,
  _activeRun: { current: AbortController | undefined },
  _wss: { clients: Set<WebSocket> },
  _currentNarConfig: Record<string, unknown>,
  _DEFAULT_RUN_CYCLES: number,
  _ASK_RUN_CYCLES: number
): void {
  getServerProtocolCatalog();
}

/** Handle a client message using the protocol catalog (validates + dispatches). */
export function handleClientMessage(ctx: HandlerContext, msg: IncomingFromClient): void {
  const catalog = getServerProtocolCatalog();
  const ws = ctx.ws;
  const validation = catalog.validate(msg);
  if (!validation.success) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(errorFrame('invalid_message', validation.error ?? 'Invalid message')));
    }
    return;
  }
  const entry = catalog.get(validation.type as keyof typeof catalog.definition);
  if (entry && entry.direction === 'toServer' && entry.handleServer) {
    try {
      void Promise.resolve(entry.handleServer(ctx as unknown as ServerHandlerContext, msg)).catch((error: unknown) => {
        console.error(`[handler-registry] Handler error for ${validation.type}:`, error);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify(errorFrame('internal', (error as Error).message)));
        }
      });
    } catch (error) {
      console.error(`[handler-registry] Handler error for ${validation.type}:`, error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(errorFrame('internal', (error as Error).message)));
      }
    }
  }
}

/** Get the protocol catalog for testing/inspection. */
export function getProtocolCatalog() {
  return getServerProtocolCatalog();
}

/** Registered message types from the protocol catalog. */
export function registeredMessageTypes(): IncomingFromClient['type'][] {
  return getServerProtocolCatalog().ids as IncomingFromClient['type'][];
}

/** Check if a handler exists for a message type. */
export function hasHandler(type: IncomingFromClient['type']): boolean {
  return getServerProtocolCatalog().has(type);
}
