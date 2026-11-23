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

/** Transport factory registration. */
export interface TransportFactoryRegistration {
  readonly type: TransportType;
  readonly factory: TransportFactory;
}

/** Transport registry using KeyedRegistry for factories and active transports. */
import { KeyedRegistry } from '../../util/keyed-collection';

export class TransportRegistry {
  /** Factories keyed by transport type. */
  readonly factories: KeyedRegistry<TransportFactoryRegistration>;
  /** Active transports keyed by instance ID. */
  readonly transports: KeyedRegistry<Transport>;

  constructor() {
    this.factories = new KeyedRegistry<TransportFactoryRegistration>({
      keyOf: (r) => r.type,
      onDuplicate: (type, incumbent) => {
        throw new Error(`Transport factory for type '${type}' already registered (incumbent: ${incumbent.type})`);
      },
    });
    this.transports = new KeyedRegistry<Transport>({
      keyOf: (t) => `${t.config.type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    });
  }

  /** Register a transport factory. */
  registerFactory(type: TransportType, factory: TransportFactory): void {
    this.factories.register({ type, factory });
  }

  /** Create a transport instance. */
  createTransport(config: TransportConfig): Transport | null {
    const registration = this.factories.get(config.type);
    if (!registration) return null;

    const transport = registration.factory(config);
    this.transports.register(transport);
    return transport;
  }

  /** Get a transport by instance ID. */
  getTransport(id: string): Transport | undefined {
    return this.transports.get(id);
  }

  /** Get all active transports. */
  getAllTransports(): Transport[] {
    return this.transports.all();
  }

  /** Close and remove a transport. */
  async closeTransport(id: string): Promise<boolean> {
    const transport = this.transports.get(id);
    if (!transport) return false;
    await transport.close();
    return this.transports.delete(id);
  }

  /** Close all transports. */
  async closeAll(): Promise<void> {
    for (const transport of this.transports.all()) {
      await transport.close().catch(() => {});
    }
    this.transports.clear();
  }

  /** Check if a factory is registered. */
  hasFactory(type: TransportType): boolean {
    return this.factories.has(type);
  }

  /** Get all registered factory types. */
  getFactoryTypes(): TransportType[] {
    return this.factories.keys() as TransportType[];
  }
}

/** Create a transport registry instance. */
export function createTransportRegistry(): TransportRegistry {
  return new TransportRegistry();
}