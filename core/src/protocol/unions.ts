/**
 * Incoming message discriminated unions + aggregate type re-exports
 */
import { z } from 'zod';
import {
  ChatAgentComplete,
  ChatAgentStream,
  ChatUserMsg,
  LMSwitchMsg,
  LMStatusMsg,
  LMStatusRequest,
} from './chat.js';
import { type ConfigField, ConfigSchemaMsg, ConfigSetMsg } from './config.js';
import { ServerError } from './error.js';
import { CognitiveDelta } from './graph-ops.js';
import { NodeHistoryMsg, NodeHistoryRequestMsg } from './history.js';
import { LensDefinedMsg, LensDefineMsg, LensFieldsMsg, LensListMsg } from './lens-msgs.js';
import { ObjectSetMsg } from './object-patch.js';import { UiCommandMsg } from './ui-command.js';
import {
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
} from './reasoning-control.js';
import {
  CognitiveEventsMsg,
  FocusSet,
  LensSet,
  StateSnapshot,
  SyncRequest,
  TelemetryMsg,
} from './sync.js';

export const IncomingFromClient = z.discriminatedUnion('type', [
  ChatUserMsg,
  ConfigSetMsg,
  SyncRequest,
  LensSet,
  FocusSet,
  ObjectSetMsg,
  LensDefineMsg,
  NodeHistoryRequestMsg,
  LMStatusRequest,
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
]);
export const IncomingFromServer = z.discriminatedUnion('type', [
  ChatAgentStream,
  ChatAgentComplete,
  CognitiveDelta,
  CognitiveEventsMsg,
  ConfigSchemaMsg,
  StateSnapshot,
  TelemetryMsg,
  LensListMsg,
  LensDefinedMsg,
  LensFieldsMsg,
  NodeHistoryMsg,
  LMStatusMsg,
  ServerError,
  UiCommandMsg,
  ReasoningControlResponse,
]);
export type IncomingFromClient = z.infer<typeof IncomingFromClient>;
export type IncomingFromServer = z.infer<typeof IncomingFromServer>;
export type ConfigFieldType = z.infer<typeof ConfigField>;
