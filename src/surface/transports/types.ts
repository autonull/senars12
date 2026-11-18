/**
 * Surface Transport Types — common transport interfaces.
 */

/** Transport types. */
export type TransportType = 'cli' | 'http' | 'ws' | 'irc' | 'mcp' | 'stdio' | 'sse';

/** Transport configuration. */
export interface TransportConfig {
  /** Transport type. */
  type: TransportType;
  /** Host. */
  host?: string;
  /** Port. */
  port?: number;
  /** Path. */
  path?: string;
  /** TLS. */
  tls?: boolean;
  /** Headers. */
  headers?: Record<string, string>;
}

/** Transport message. */
export interface TransportMessage {
  /** Message type. */
  type: 'request' | 'response' | 'notification' | 'error';
  /** Payload. */
  payload: unknown;
  /** Correlation ID. */
  correlationId?: string;
  /** Timestamp. */
  timestamp: number;
}

/** Transport interface. */
export interface Transport {
  /** Transport type. */
  type: TransportType;
  /** Config. */
  config: TransportConfig;
  /** Send message. */
  send(message: TransportMessage): Promise<TransportMessage>;
  /** Close transport. */
  close(): Promise<void>;
}

/** Transport factory. */
export type TransportFactory = (config: TransportConfig) => Transport;

/** Transport registry. */
export interface TransportRegistry {
  /** Factories by type. */
  factories: Map<TransportType, TransportFactory>;
  /** Active transports. */
  transports: Map<string, Transport>;
}

/** Create transport registry. */
export function createTransportRegistry(): TransportRegistry {
  return {
    factories: new Map(),
    transports: new Map(),
  };
}

/** Register transport factory. */
export function registerTransport(registry: TransportRegistry, type: TransportType, factory: TransportFactory): void {
  registry.factories.set(type, factory);
}

/** Create transport. */
export function createTransport(registry: TransportRegistry, config: TransportConfig): Transport | null {
  const factory = registry.factories.get(config.type);
  if (!factory) return null;

  const transport = factory(config);
  const id = `${config.type}-${Date.now()}`;
  registry.transports.set(id, transport);
  return transport;
}