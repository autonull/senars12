export type ComponentState = 'created' | 'initialized' | 'started' | 'stopped' | 'disposed';

export interface Logger {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  child(scope: string): Logger;
}

export interface Metrics {
  increment(name: string, value?: number, tags?: Record<string, unknown>): void;
  gauge(name: string, value: number, tags?: Record<string, unknown>): void;
  histogram(name: string, value: number, tags?: Record<string, unknown>): void;
}

export interface EventBus {
  emit(event: string, data: unknown): void;
  on(event: string, handler: (data: unknown) => void): () => void;
  off(event: string, handler: (data: unknown) => void): void;
}

export interface ComponentContext {
  readonly logger: Logger;
  readonly metrics: Metrics;
  readonly eventBus: EventBus;
}
