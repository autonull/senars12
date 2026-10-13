/**
 * Server message handler registry — now backed by the Protocol catalog.
 *
 * The protocol catalog provides:
 * - Schema validation for every message type
 * - Type-safe handler registration
 * - Single source of truth for the wire protocol
 */
import type { IncomingFromClient } from '@senars/core';
import { IncomingFromClient as IncomingFromClientSchema } from '@senars/core';
import { WebSocket } from 'ws';
import type { Agent } from '@senars/core';
import type { UnifiedGraphProjection } from './UnifiedGraphProjection.js';
import { type NarLike } from './server-utils.js';
import { getServerProtocolCatalog, createServerProtocolCatalog, type ServerHandlerContext } from '../client/core/protocol-defs.js';
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

/** Initialize the protocol catalog with the server context. */
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
  const ctx: ServerHandlerContext = {
    agent,
    projection,
    ws: null as unknown as WebSocket, // Set per-message
    nar,
    activeRun,
    wss,
    currentNarConfig,
    DEFAULT_RUN_CYCLES,
    ASK_RUN_CYCLES,
  };
  createServerProtocolCatalog(ctx);
}

/** Handle a client message using the protocol catalog (validates + dispatches). */
export function handleClientMessage(ctx: HandlerContext, msg: IncomingFromClient): void {
  const catalog = getServerProtocolCatalog();
  if (!catalog) {
    console.warn('[handler-registry] Protocol catalog not initialized');
    return;
  }
  // Set the per-message WebSocket
  const ws = ctx.ws;
  // Validate first
  const validation = catalog.validate(msg);
  if (!validation.success) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(errorFrame('invalid_message', validation.error ?? 'Invalid message')));
    }
    return;
  }
  // Dispatch to handler
  const entry = catalog.get(validation.type as keyof typeof catalog.definition);
  if (entry && entry.direction === 'toServer' && entry.handle) {
    try {
      entry.handle(ctx as unknown as ServerHandlerContext, msg);
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
  const catalog = getServerProtocolCatalog();
  return catalog ? catalog.ids as IncomingFromClient['type'][] : [];
}

/** Check if a handler exists for a message type. */
export function hasHandler(type: IncomingFromClient['type']): boolean {
  const catalog = getServerProtocolCatalog();
  return catalog ? catalog.has(type) : false;
}