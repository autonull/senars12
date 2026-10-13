/**
 * Protocol definitions — all message types with schemas and handlers.
 *
 * This is the single source of truth for the wire protocol. The server validates
 * inbound frames with the schema; the client routes inbound frames through the
 * same registry. One definition, two dispatchers.
 */
import { z } from 'zod';
import {
  IncomingFromClient,
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
import { defineProtocolCatalog, createProtocolEntry, type ProtocolCatalog, type ServerHandlerContext } from '../framework/protocol.js';
import {
  handleChatUser,
  handleConfigSet,
  handleSyncRequest,
  handleLensSet,
  handleFocusSet,
  handleObjectSet,
  handleLensDefine,
  handleNodeHistoryRequest,
  handleLMStatusRequest,
  handleLMSwitch,
  handleReasoningSubmit,
  handleReasoningAsk,
  handleReasoningStep,
  handleReasoningRun,
  handleReasoningAbort,
  handleReasoningRetract,
  handleReasoningRevise,
  handleReasoningAddGoal,
  handleReasoningAdjustBudget,
  handleReasoningAdjustProvider,
} from '../../server/handlers.js';
import { applyServerMessage } from './store-bindings.js';

// Re-export types for convenience
export type { ServerHandlerContext } from '../framework/protocol.js';
export type { ProtocolCatalog } from '../framework/protocol.js';

/** Create the server-side protocol catalog with handlers. */
export function createServerProtocolCatalog(ctx: ServerHandlerContext): ProtocolCatalog<any> {
  return defineProtocolCatalog({
    'chat.user': createProtocolEntry({
      type: 'chat.user',
      label: 'Chat User',
      direction: 'toServer',
      schema: ChatUserMsg,
      handleServer: handleChatUser as (ctx: ServerHandlerContext, msg: unknown) => Promise<void>,
    }),
    'config.set': createProtocolEntry({
      type: 'config.set',
      label: 'Config Set',
      direction: 'toServer',
      schema: ConfigSetMsg,
      handleServer: handleConfigSet as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'sync.request': createProtocolEntry({
      type: 'sync.request',
      label: 'Sync Request',
      direction: 'toServer',
      schema: SyncRequest,
      handleServer: handleSyncRequest as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'lens.set': createProtocolEntry({
      type: 'lens.set',
      label: 'Lens Set',
      direction: 'toServer',
      schema: LensSet,
      handleServer: handleLensSet as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'focus.set': createProtocolEntry({
      type: 'focus.set',
      label: 'Focus Set',
      direction: 'toServer',
      schema: FocusSet,
      handleServer: handleFocusSet as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'object.set': createProtocolEntry({
      type: 'object.set',
      label: 'Object Set',
      direction: 'toServer',
      schema: ObjectSetMsg,
      handleServer: handleObjectSet as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'lens.define': createProtocolEntry({
      type: 'lens.define',
      label: 'Lens Define',
      direction: 'toServer',
      schema: LensDefineMsg,
      handleServer: handleLensDefine as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'node.history.request': createProtocolEntry({
      type: 'node.history.request',
      label: 'Node History Request',
      direction: 'toServer',
      schema: NodeHistoryRequestMsg,
      handleServer: handleNodeHistoryRequest as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'lm.status.request': createProtocolEntry({
      type: 'lm.status.request',
      label: 'LM Status Request',
      direction: 'toServer',
      schema: LMStatusRequest,
      handleServer: handleLMStatusRequest as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'lm.switch': createProtocolEntry({
      type: 'lm.switch',
      label: 'LM Switch',
      direction: 'toServer',
      schema: LMSwitchMsg,
      handleServer: handleLMSwitch as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'reasoning.submit': createProtocolEntry({
      type: 'reasoning.submit',
      label: 'Reasoning Submit',
      direction: 'toServer',
      schema: ReasoningSubmitMsg,
      handleServer: handleReasoningSubmit as (ctx: ServerHandlerContext, msg: unknown) => Promise<void>,
    }),
    'reasoning.ask': createProtocolEntry({
      type: 'reasoning.ask',
      label: 'Reasoning Ask',
      direction: 'toServer',
      schema: ReasoningAskMsg,
      handleServer: handleReasoningAsk as (ctx: ServerHandlerContext, msg: unknown) => Promise<void>,
    }),
    'reasoning.step': createProtocolEntry({
      type: 'reasoning.step',
      label: 'Reasoning Step',
      direction: 'toServer',
      schema: ReasoningStepMsg,
      handleServer: handleReasoningStep as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'reasoning.run': createProtocolEntry({
      type: 'reasoning.run',
      label: 'Reasoning Run',
      direction: 'toServer',
      schema: ReasoningRunMsg,
      handleServer: handleReasoningRun as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'reasoning.abort': createProtocolEntry({
      type: 'reasoning.abort',
      label: 'Reasoning Abort',
      direction: 'toServer',
      schema: ReasoningAbortMsg,
      handleServer: handleReasoningAbort as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'reasoning.retract': createProtocolEntry({
      type: 'reasoning.retract',
      label: 'Reasoning Retract',
      direction: 'toServer',
      schema: ReasoningRetractMsg,
      handleServer: handleReasoningRetract as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'reasoning.revise': createProtocolEntry({
      type: 'reasoning.revise',
      label: 'Reasoning Revise',
      direction: 'toServer',
      schema: ReasoningReviseMsg,
      handleServer: handleReasoningRevise as (ctx: ServerHandlerContext, msg: unknown) => Promise<void>,
    }),
    'reasoning.add-goal': createProtocolEntry({
      type: 'reasoning.add-goal',
      label: 'Reasoning Add Goal',
      direction: 'toServer',
      schema: ReasoningAddGoalMsg,
      handleServer: handleReasoningAddGoal as (ctx: ServerHandlerContext, msg: unknown) => Promise<void>,
    }),
    'reasoning.adjust-budget': createProtocolEntry({
      type: 'reasoning.adjust-budget',
      label: 'Reasoning Adjust Budget',
      direction: 'toServer',
      schema: ReasoningAdjustBudgetMsg,
      handleServer: handleReasoningAdjustBudget as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'reasoning.adjust-provider': createProtocolEntry({
      type: 'reasoning.adjust-provider',
      label: 'Reasoning Adjust Provider',
      direction: 'toServer',
      schema: ReasoningAdjustProviderMsg,
      handleServer: handleReasoningAdjustProvider as (ctx: ServerHandlerContext, msg: unknown) => void,
    }),
    'chat.agent.stream': createProtocolEntry({
      type: 'chat.agent.stream',
      label: 'Chat Agent Stream',
      direction: 'toClient',
      schema: ChatAgentStream,
    }),
    'chat.agent.complete': createProtocolEntry({
      type: 'chat.agent.complete',
      label: 'Chat Agent Complete',
      direction: 'toClient',
      schema: ChatAgentComplete,
    }),
    'cognitive.delta': createProtocolEntry({
      type: 'cognitive.delta',
      label: 'Cognitive Delta',
      direction: 'toClient',
      schema: CognitiveDelta,
      handleClient: (msg, cy) => {
        applyServerMessage(msg as any, cy as any);
      },
    }),
    'config.schema': createProtocolEntry({
      type: 'config.schema',
      label: 'Config Schema',
      direction: 'toClient',
      schema: ConfigSchemaMsg,
      handleClient: (msg) => {
        applyServerMessage(msg as any);
      },
    }),
    'state.snapshot': createProtocolEntry({
      type: 'state.snapshot',
      label: 'State Snapshot',
      direction: 'toClient',
      schema: StateSnapshot,
      handleClient: (msg, cy) => {
        applyServerMessage(msg as any, cy as any);
      },
    }),
    'telemetry': createProtocolEntry({
      type: 'telemetry',
      label: 'Telemetry',
      direction: 'toClient',
      schema: TelemetryMsg,
      handleClient: (msg) => {
        applyServerMessage(msg as any);
      },
    }),
    'lens.list': createProtocolEntry({
      type: 'lens.list',
      label: 'Lens List',
      direction: 'toClient',
      schema: LensListMsg,
      handleClient: (msg) => {
        applyServerMessage(msg as any);
      },
    }),
    'lens.defined': createProtocolEntry({
      type: 'lens.defined',
      label: 'Lens Defined',
      direction: 'toClient',
      schema: LensDefinedMsg,
      handleClient: (msg) => {
        applyServerMessage(msg as any);
      },
    }),
    'lens.fields': createProtocolEntry({
      type: 'lens.fields',
      label: 'Lens Fields',
      direction: 'toClient',
      schema: LensFieldsMsg,
      handleClient: (msg) => {
        applyServerMessage(msg as any);
      },
    }),
    'node.history': createProtocolEntry({
      type: 'node.history',
      label: 'Node History',
      direction: 'toClient',
      schema: NodeHistoryMsg,
      handleClient: (msg) => {
        applyServerMessage(msg as any);
      },
    }),
    'lm.status': createProtocolEntry({
      type: 'lm.status',
      label: 'LM Status',
      direction: 'toClient',
      schema: LMStatusMsg,
      handleClient: (msg) => {
        applyServerMessage(msg as any);
      },
    }),
    'reasoning.control.response': createProtocolEntry({
      type: 'reasoning.control.response',
      label: 'Reasoning Control Response',
      direction: 'toClient',
      schema: ReasoningControlResponse,
      handleClient: (msg) => {
        applyServerMessage(msg as any);
      },
    }),
    'ui.command': createProtocolEntry({
      type: 'ui.command',
      label: 'UI Command',
      direction: 'toClient',
      schema: UiCommandMsg,
      handleClient: (msg) => {
        applyServerMessage(msg as any);
      },
    }),
    'cognitive.events': createProtocolEntry({
      type: 'cognitive.events',
      label: 'Cognitive Events',
      direction: 'toClient',
      schema: CognitiveEventsMsg,
      handleClient: (msg) => {
        applyServerMessage(msg as any);
      },
    }),
    'server.error': createProtocolEntry({
      type: 'server.error',
      label: 'Server Error',
      direction: 'toClient',
      schema: ServerError,
      handleClient: (msg) => {
        applyServerMessage(msg as any);
      },
    }),
  });
}

/** Create the client-side protocol catalog with handlers. */
export function createClientProtocolCatalog(): ProtocolCatalog<any> {
  // The client catalog uses the same definition but with client handlers
  // Since handlers are embedded in the catalog, we need to recreate it
  // For now, we reuse the same structure but the client handlers are already
  // embedded in the protocol entries above for toClient messages.
  // The server handlers are only used when running on the server.
  return createServerProtocolCatalog({} as ServerHandlerContext);
}

/** The server protocol catalog instance (lazy-initialized). */
let serverProtocolCatalog: ProtocolCatalog<any> | null = null;

/** Get or create the server protocol catalog. */
export function getServerProtocolCatalog(ctx?: ServerHandlerContext): ProtocolCatalog<any> {
  if (!serverProtocolCatalog && ctx) {
    serverProtocolCatalog = createServerProtocolCatalog(ctx);
  }
  return serverProtocolCatalog!;
}

/** Reset the server protocol catalog (for tests). */
export function resetServerProtocolCatalog(): void {
  serverProtocolCatalog = null;
}

/** The client protocol catalog instance (singleton). */
let clientProtocolCatalog: ProtocolCatalog<any> | null = null;

/** Get or create the client protocol catalog. */
export function getClientProtocolCatalog(): ProtocolCatalog<any> {
  if (!clientProtocolCatalog) {
    clientProtocolCatalog = createClientProtocolCatalog();
  }
  return clientProtocolCatalog;
}

/** Reset the client protocol catalog (for tests). */
export function resetClientProtocolCatalog(): void {
  clientProtocolCatalog = null;
}