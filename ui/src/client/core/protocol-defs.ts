/**
 * Protocol specifications — the single, handler-agnostic source of truth for the
 * wire protocol. Each entry names a message type, its direction, and its zod
 * schema. The client catalog (`createClientProtocolCatalog`) and the server
 * catalog (`server/protocol-server.ts`) are both derived from this table, so a
 * schema cannot drift between the two ends.
 *
 * Deliberately free of handler bodies: the client must never import the server's
 * handlers (that would drag `@senars/nar` and its native deps into the browser).
 */
import type { ZodType } from 'zod';
import {
  IncomingFromServer,
  ChatUserMsg,
  ChatAgentStream,
  ChatAgentComplete,
  ConfigSetMsg,
  ConfigSchemaMsg,
  SyncRequest,
  CognitiveDelta,
  LensSet,
  FocusSet,
  ObjectSetMsg,
  LensDefineMsg,
  LensDefinedMsg,
  LensFieldsMsg,
  LensListMsg,
  NodeHistoryRequestMsg,
  NodeHistoryMsg,
  LMStatusRequest,
  LMStatusMsg,
  LMSwitchMsg,
  ReasoningSubmitMsg,
  ReasoningAskMsg,
  ReasoningStepMsg,
  ReasoningRunMsg,
  ReasoningAbortMsg,
  ReasoningRetractMsg,
  ReasoningReviseMsg,
  ReasoningAddGoalMsg,
  ReasoningAdjustBudgetMsg,
  ReasoningAdjustProviderMsg,
  ReasoningControlResponse,
  UiCommandMsg,
  CognitiveEventsMsg,
  TelemetryMsg,
  StateSnapshot,
  ServerError,
} from '@senars/core/protocol';
import {
  defineProtocolCatalog,
  createProtocolEntry,
  type MessageDirection,
  type ProtocolCatalog,
} from '../framework/protocol.js';
import { applyServerMessage } from './store-bindings.js';

export type { ServerHandlerContext } from '../framework/protocol.js';
export type { ProtocolCatalog } from '../framework/protocol.js';

/** A protocol message stripped of any handler: type, direction, schema, label. */
export interface ProtocolSpec {
  readonly type: string;
  readonly label: string;
  readonly direction: MessageDirection;
  readonly schema: ZodType;
}

const toServer = (type: string, label: string, schema: ZodType): ProtocolSpec => ({
  type,
  label,
  direction: 'toServer',
  schema,
});
const toClient = (type: string, label: string, schema: ZodType): ProtocolSpec => ({
  type,
  label,
  direction: 'toClient',
  schema,
});

/** Every wire message, keyed by its `type`. */
export const PROTOCOL_SPECS: Readonly<Record<string, ProtocolSpec>> = {
  'chat.user': toServer('chat.user', 'Chat User', ChatUserMsg),
  'config.set': toServer('config.set', 'Config Set', ConfigSetMsg),
  'sync.request': toServer('sync.request', 'Sync Request', SyncRequest),
  'lens.set': toServer('lens.set', 'Lens Set', LensSet),
  'focus.set': toServer('focus.set', 'Focus Set', FocusSet),
  'object.set': toServer('object.set', 'Object Set', ObjectSetMsg),
  'lens.define': toServer('lens.define', 'Lens Define', LensDefineMsg),
  'node.history.request': toServer('node.history.request', 'Node History Request', NodeHistoryRequestMsg),
  'lm.status.request': toServer('lm.status.request', 'LM Status Request', LMStatusRequest),
  'lm.switch': toServer('lm.switch', 'LM Switch', LMSwitchMsg),
  'reasoning.submit': toServer('reasoning.submit', 'Reasoning Submit', ReasoningSubmitMsg),
  'reasoning.ask': toServer('reasoning.ask', 'Reasoning Ask', ReasoningAskMsg),
  'reasoning.step': toServer('reasoning.step', 'Reasoning Step', ReasoningStepMsg),
  'reasoning.run': toServer('reasoning.run', 'Reasoning Run', ReasoningRunMsg),
  'reasoning.abort': toServer('reasoning.abort', 'Reasoning Abort', ReasoningAbortMsg),
  'reasoning.retract': toServer('reasoning.retract', 'Reasoning Retract', ReasoningRetractMsg),
  'reasoning.revise': toServer('reasoning.revise', 'Reasoning Revise', ReasoningReviseMsg),
  'reasoning.add-goal': toServer('reasoning.add-goal', 'Reasoning Add Goal', ReasoningAddGoalMsg),
  'reasoning.adjust-budget': toServer('reasoning.adjust-budget', 'Reasoning Adjust Budget', ReasoningAdjustBudgetMsg),
  'reasoning.adjust-provider': toServer(
    'reasoning.adjust-provider',
    'Reasoning Adjust Provider',
    ReasoningAdjustProviderMsg
  ),
  'chat.agent.stream': toClient('chat.agent.stream', 'Chat Agent Stream', ChatAgentStream),
  'chat.agent.complete': toClient('chat.agent.complete', 'Chat Agent Complete', ChatAgentComplete),
  'cognitive.delta': toClient('cognitive.delta', 'Cognitive Delta', CognitiveDelta),
  'config.schema': toClient('config.schema', 'Config Schema', ConfigSchemaMsg),
  'state.snapshot': toClient('state.snapshot', 'State Snapshot', StateSnapshot),
  telemetry: toClient('telemetry', 'Telemetry', TelemetryMsg),
  'lens.list': toClient('lens.list', 'Lens List', LensListMsg),
  'lens.defined': toClient('lens.defined', 'Lens Defined', LensDefinedMsg),
  'lens.fields': toClient('lens.fields', 'Lens Fields', LensFieldsMsg),
  'node.history': toClient('node.history', 'Node History', NodeHistoryMsg),
  'lm.status': toClient('lm.status', 'LM Status', LMStatusMsg),
  'reasoning.control.response': toClient(
    'reasoning.control.response',
    'Reasoning Control Response',
    ReasoningControlResponse
  ),
  'ui.command': toClient('ui.command', 'UI Command', UiCommandMsg),
  'cognitive.events': toClient('cognitive.events', 'Cognitive Events', CognitiveEventsMsg),
  'server.error': toClient('server.error', 'Server Error', ServerError),
};

/** The client protocol catalog — routes inbound frames into the store. */
export function createClientProtocolCatalog(): ProtocolCatalog<any> {
  const defs = Object.fromEntries(
    Object.entries(PROTOCOL_SPECS).map(([id, spec]) => [
      id,
      createProtocolEntry({
        type: spec.type,
        label: spec.label,
        direction: spec.direction,
        schema: spec.schema,
        handleClient:
          spec.direction === 'toClient'
            ? (msg, cy) => applyServerMessage(msg as IncomingFromServer, cy as never)
            : undefined,
      }),
    ])
  );
  return defineProtocolCatalog(defs);
}

let clientProtocolCatalog: ProtocolCatalog<any> | null = null;

/** The client protocol catalog instance (singleton). */
export function getClientProtocolCatalog(): ProtocolCatalog<any> {
  if (!clientProtocolCatalog) clientProtocolCatalog = createClientProtocolCatalog();
  return clientProtocolCatalog;
}

/** Reset the client protocol catalog (for tests). */
export function resetClientProtocolCatalog(): void {
  clientProtocolCatalog = null;
}
