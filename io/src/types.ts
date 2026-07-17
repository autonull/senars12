import type {
  Connection as CoreConnection,
  ConnectionConfig as CoreConnectionConfig,
  ConnectionDeps as CoreConnectionDeps,
  ConnectionState as CoreConnectionState,
  IOMessage as CoreIOMessage,
  TransportDeps as CoreTransportDeps,
} from '@senars/util';
export { ConnectionError, Logger } from '@senars/core';

export type ConnectionState = CoreConnectionState;
export type IOMessage = CoreIOMessage;
export type ConnectionConfig = CoreConnectionConfig;
export type ConnectionDeps = CoreConnectionDeps;
export type TransportDeps = CoreTransportDeps;

export interface Connection extends CoreConnection {}

export interface ConnectionFactory {
  readonly type: string;
  create(config: ConnectionConfig, deps: ConnectionDeps): Connection;
}
