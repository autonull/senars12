export interface ComponentContext {
  readonly id: string;
  readonly startTime: number;
  readonly state: ComponentState;
}

export type ComponentState =
  | 'initializing'
  | 'starting'
  | 'running'
  | 'started'
  | 'stopping'
  | 'stopped'
  | 'error';

export interface BaseComponent {
  readonly id: string;
  readonly state: ComponentState;

  initialize(): Promise<void>;

  start(): Promise<void>;

  stop(): Promise<void>;

  getState(): ComponentState;
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

export interface Logger {
  readonly scope: string;

  debug(message: string, context?: Record<string, unknown>): void;

  info(message: string, context?: Record<string, unknown>): void;

  warn(message: string, context?: Record<string, unknown>): void;

  error(message: string, error?: Error, context?: Record<string, unknown>): void;

  warnOnce(key: string, message: string, context?: Record<string, unknown>): void;

  deprecated(oldSymbol: string, replacement: string, context?: Record<string, unknown>): void;

  setLevel(level: LogLevel): void;

  getLevel(): LogLevel;

  getScope(): string;
}

export interface Metrics {
  increment(name: string, value?: number, tags?: Record<string, unknown>): void;

  decrement(name: string, value?: number, tags?: Record<string, unknown>): void;

  gauge(name: string, value: number, tags?: Record<string, unknown>): void;

  histogram(name: string, value: number, tags?: Record<string, unknown>): void;

  timing(name: string, value: number, tags?: Record<string, unknown>): void;
}
