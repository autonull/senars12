export type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'disconnecting'
  | 'disconnected'
  | 'error';

export interface IOMessage {
  readonly id: string;
  readonly source: string;
  readonly origin: string;
  readonly sender: string;
  readonly text: string;
  readonly timestamp: number;
  readonly metadata?: Record<string, unknown>;
}

export type MessageClassification =
  | 'command'
  | 'belief'
  | 'question'
  | 'goal'
  | 'natural-language'
  | 'unknown';

export interface Connection {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly state: ConnectionState;

  connect(): Promise<void>;
  disconnect(reason?: string): Promise<void>;
  reconnect(): Promise<void>;
  send(target: string, text: string): Promise<void>;
  onMessage(handler: (message: IOMessage) => Promise<void>): void;
  removeMessageHandler(handler: (message: IOMessage) => Promise<void>): void;
  onStateChange(handler: (state: ConnectionState, prev: ConnectionState) => void): void;
  onError(handler: (error: Error) => void): void;
  getStatus(): { state: ConnectionState; messageCount: number; errorCount: number };
  reconfigure(config: Record<string, unknown>): Promise<void>;
}

export interface ConnectionConfig {
  readonly id: string;
  readonly enabled: boolean;
  readonly type: string;
  readonly config: Record<string, unknown>;
  readonly authSecret?: string;
}

export interface ConnectionFactory {
  type: string;
  create(config: ConnectionConfig, deps: ConnectionDeps): Connection;
}

export interface ConnectionDeps {
  readonly emit: (event: string, data: unknown) => void;
  readonly logger: { debug(msg: string, ctx?: Record<string, unknown>): void; info(msg: string, ctx?: Record<string, unknown>): void; warn(msg: string, ctx?: Record<string, unknown>): void; error(msg: string, err?: Error, ctx?: Record<string, unknown>): void; child(scope: string): { debug(msg: string, ctx?: Record<string, unknown>): void; info(msg: string, ctx?: Record<string, unknown>): void; warn(msg: string, ctx?: Record<string, unknown>): void; error(msg: string, err?: Error, ctx?: Record<string, unknown>): void } };
  readonly getSessionSpaceId?: (connectionId: string) => string | undefined;
}

export interface TransportDeps extends ConnectionDeps {
  readonly submit: (input: string, correlationId: string) => void;
  readonly submitStream?: (input: string, correlationId: string) => AsyncGenerator<string, string>;
}
