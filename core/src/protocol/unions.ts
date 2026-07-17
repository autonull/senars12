/**
 * Incoming message discriminated unions + aggregate type re-exports
 */
import { z } from 'zod';
import { ChatUserMsg, ChatAgentStream, ChatAgentComplete } from './chat.js';
import { ConfigSetMsg, ConfigField } from './config.js';
import { SyncRequest, LensSet, FocusSet, ViewportSet, StateSnapshot, TelemetryMsg } from './sync.js';
import { ConfigSchemaMsg } from './config.js';
import { CognitiveDelta } from './graph-ops.js';
import { ObjectSetMsg, NodeSetMsg } from './object-patch.js';
import {
  LensDefineMsg,
  LensListMsg,
  LensDefinedMsg,
  LensFieldsMsg,
} from './lens-msgs.js';
import { NodeHistoryMsg, NodeHistoryRequestMsg } from './history.js';

export const IncomingFromClient = z.discriminatedUnion('type', [
  ChatUserMsg,
  ConfigSetMsg,
  SyncRequest,
  LensSet,
  FocusSet,
  ViewportSet,
  ObjectSetMsg,
  NodeSetMsg,
  LensDefineMsg,
  NodeHistoryRequestMsg,
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
]);
export type IncomingFromClient = z.infer<typeof IncomingFromClient>;
export type IncomingFromServer = z.infer<typeof IncomingFromServer>;
export type ConfigFieldType = z.infer<typeof ConfigField>;
