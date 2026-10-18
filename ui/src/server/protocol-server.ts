/**
 * Server protocol catalog — the server half of the wire protocol.
 *
 * Derived from `PROTOCOL_SPECS` (the one definition) plus the server handler
 * bodies in `handlers.ts`. Kept out of `client/core/protocol-defs.ts` so the
 * browser never imports a server handler (and, transitively, `@senars/nar`).
 */
import { PROTOCOL_SPECS } from '../client/core/protocol-defs.js';
import {
  defineProtocolCatalog,
  createProtocolEntry,
  type ProtocolCatalog,
  type ServerHandlerContext,
} from '../client/framework/protocol.js';
import * as handlers from './handlers.js';

type ServerHandler = (ctx: ServerHandlerContext, msg: unknown) => void | Promise<void>;

const SERVER_HANDLERS: Readonly<Record<string, ServerHandler>> = {
  'chat.user': handlers.handleChatUser as ServerHandler,
  'config.set': handlers.handleConfigSet as ServerHandler,
  'sync.request': handlers.handleSyncRequest as ServerHandler,
  'lens.set': handlers.handleLensSet as ServerHandler,
  'focus.set': handlers.handleFocusSet as ServerHandler,
  'object.set': handlers.handleObjectSet as ServerHandler,
  'lens.define': handlers.handleLensDefine as ServerHandler,
  'node.history.request': handlers.handleNodeHistoryRequest as ServerHandler,
  'lm.status.request': handlers.handleLMStatusRequest as ServerHandler,
  'lm.switch': handlers.handleLMSwitch as ServerHandler,
  'reasoning.submit': handlers.handleReasoningSubmit as ServerHandler,
  'reasoning.ask': handlers.handleReasoningAsk as ServerHandler,
  'reasoning.step': handlers.handleReasoningStep as ServerHandler,
  'reasoning.run': handlers.handleReasoningRun as ServerHandler,
  'reasoning.abort': handlers.handleReasoningAbort as ServerHandler,
  'reasoning.retract': handlers.handleReasoningRetract as ServerHandler,
  'reasoning.revise': handlers.handleReasoningRevise as ServerHandler,
  'reasoning.add-goal': handlers.handleReasoningAddGoal as ServerHandler,
  'reasoning.adjust-budget': handlers.handleReasoningAdjustBudget as ServerHandler,
  'reasoning.adjust-provider': handlers.handleReasoningAdjustProvider as ServerHandler,
  'cycle.step': handlers.handleCycleStep as ServerHandler,
  'cycle.pause': handlers.handleCyclePause as ServerHandler,
  'cycle.resume': handlers.handleCycleResume as ServerHandler,
  'cycle.rewind': handlers.handleCycleRewind as ServerHandler,
};

/** Build the server protocol catalog from the shared specs + server handlers. */
export function createServerProtocolCatalog(): ProtocolCatalog<any> {
  const defs = Object.fromEntries(
    Object.entries(PROTOCOL_SPECS).map(([id, spec]) => [
      id,
      createProtocolEntry({
        type: spec.type,
        label: spec.label,
        direction: spec.direction,
        schema: spec.schema,
        handleServer: spec.direction === 'toServer' ? SERVER_HANDLERS[id] : undefined,
      }),
    ])
  );
  return defineProtocolCatalog(defs);
}

let serverProtocolCatalog: ProtocolCatalog<any> | null = null;

/** The server protocol catalog instance (singleton). */
export function getServerProtocolCatalog(): ProtocolCatalog<any> {
  if (!serverProtocolCatalog) serverProtocolCatalog = createServerProtocolCatalog();
  return serverProtocolCatalog;
}

/** Reset the server protocol catalog (for tests). */
export function resetServerProtocolCatalog(): void {
  serverProtocolCatalog = null;
}
