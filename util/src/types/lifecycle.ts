/**
 * The publish surface {@link ComponentContext.eventBus} carries. Structural
 * rather than the `EventBus` class so the leaf type module stays free of a
 * dependency on the event runtime.
 */
export interface EventPublisher {
  emit(event: string, data: unknown): void;

  on(event: string, handler: (data: unknown) => void): () => void;

  off(event: string, handler: (data: unknown) => void): void;
}

/** The observability bundle every long-lived component is constructed with. */
export interface ComponentContext {
  readonly logger: ScopedLogger;
  readonly metrics: Metrics;
  readonly eventBus: EventPublisher;
}

/** The one lifecycle state machine: `BaseComponent` is the only implementation. */
export type ComponentState = 'created' | 'initialized' | 'started' | 'stopped' | 'disposed';

/** The structural contract `BaseComponent` satisfies — checked by its `implements`. */
export interface BaseComponent {
  readonly state: ComponentState;

  initialize(): Promise<void>;

  start(): Promise<void>;

  stop(): Promise<void>;

  dispose(): Promise<void>;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  scope: string;
  context?: Record<string, unknown>;
  error?: Error;
  /** Injected by the registered log enricher (see registerLogEnricher). */
  traceId?: string;
  spanId?: string;
}

export interface LoggerConfig {
  level?: LogLevel;
  format?: 'json' | 'text';
  scope?: string;
  samplingRate?: number;
}

/**
 * Minimal structured-logging surface: level methods plus scope nesting. The
 * shared supertype of every `Logger` in the monorepo, so transports, components
 * and the concrete loggers all accept one structural shape.
 */
export interface ScopedLogger {
  debug(message: string, context?: Record<string, unknown>): void;

  info(message: string, context?: Record<string, unknown>): void;

  warn(message: string, context?: Record<string, unknown>): void;

  error(message: string, error?: Error, context?: Record<string, unknown>): void;

  child(scope: string): ScopedLogger;
}

export interface Metrics {
  increment(name: string, value?: number, tags?: Record<string, unknown>): void;

  decrement(name: string, value?: number, tags?: Record<string, unknown>): void;

  gauge(name: string, value: number, tags?: Record<string, unknown>): void;

  histogram(name: string, value: number, tags?: Record<string, unknown>): void;

  timing(name: string, value: number, tags?: Record<string, unknown>): void;
}
