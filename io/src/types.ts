import type {
  Connection as CoreConnection,
  ConnectionState as CoreConnectionState,
  ConnectionConfig as CoreConnectionConfig,
  ConnectionDeps as CoreConnectionDeps,
  IOMessage as CoreIOMessage,
  Logger,
} from '@senars/core/transport';

import { ConnectionError as CoreConnectionError } from '@senars/core/transport';

// Re-export core types directly
export type ConnectionState = CoreConnectionState;
export type IOMessage = CoreIOMessage;
export type ConnectionConfig = CoreConnectionConfig;
export type ConnectionDeps = CoreConnectionDeps;
export { CoreConnectionError as ConnectionError };
export type { Logger };

// Local Connection interface (matches core but with local runtime)
export interface Connection extends CoreConnection {}

export interface ConnectionFactory {
  readonly type: string;
  create(config: ConnectionConfig, deps: ConnectionDeps): Connection;
}
