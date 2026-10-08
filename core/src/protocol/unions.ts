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
import { type ConfigField, ConfigResetMsg, ConfigSchemaMsg, ConfigSetMsg } from './config.js';
import { ServerError } from './error.js';
import { CognitiveDelta } from './graph-ops.js';
import { NodeHistoryMsg, NodeHistoryRequestMsg } from './history.js';
import { LensDefinedMsg, LensDefineMsg, LensFieldsMsg, LensListMsg } from './lens-msgs.js';
import { NodeSetMsg, ObjectSetMsg } from './object-patch.js';
import { UiCommandMsg } from './ui-command.js';
import {
  FocusSet,
  LensSet,
  StateSnapshot,
  SyncRequest,
  TelemetryMsg,
  ViewportSet,
} from './sync.js';

export const IncomingFromClient = z.discriminatedUnion('type', [
  ChatUserMsg,
  ConfigSetMsg,
  ConfigResetMsg,
  SyncRequest,
  LensSet,
  FocusSet,
  ViewportSet,
  ObjectSetMsg,
  NodeSetMsg,
  LensDefineMsg,
  NodeHistoryRequestMsg,
  LMStatusRequest,
  LMSwitchMsg,
]);
export const IncomingFromServer = z.discriminatedUnion('type', [
  ChatAgentStream,
  ChatAgentComplete,
  CognitiveDelta,
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
]);
export type IncomingFromClient = z.infer<typeof IncomingFromClient>;
export type IncomingFromServer = z.infer<typeof IncomingFromServer>;
export type ConfigFieldType = z.infer<typeof ConfigField>;
