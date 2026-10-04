/**
 * The monorepo's one logger.
 *
 * It lives in the leaf package because every layer needs it, including the ones
 * `core` is built on: `EventBus` and `Signal` take a `Logger` and would
 * otherwise have to carry a second, console-only implementation of this surface.
 */

import { getOrInsert } from './utils/collections.js';
import type { LogEntry, LoggerConfig, LogLevel, ScopedLogger } from './types/lifecycle.js';

const LOG_LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];

/**
 * O2 (TODO20): pluggable entry enricher — the OTel integration registers one that
 * injects `traceId`/`spanId` from the active span. This package stays OTel-free.
 */
type LogEnricher = () => Record<string, unknown> | undefined;
let logEnricher: LogEnricher | undefined;
export const registerLogEnricher = (enrich?: LogEnricher): void => {
  logEnricher = enrich;
};

export class Logger {
  readonly scope: string;
  private readonly config: Required<LoggerConfig> & { samplingRate: number };
  private readonly parent?: Logger;
  private readonly children = new Map<string, Logger>();
  private readonly warnedOnce = new Set<string>();

  constructor(config: LoggerConfig = {}) {
    this.config = {
      level: config.level ?? 'info',
      format: config.format ?? 'text',
      scope: config.scope ?? 'root',
      samplingRate: config.samplingRate ?? 1.0,
    };
    this.scope = this.config.scope;
  }

  child(scope: string): Logger {
    return getOrInsert(
      this.children,
      scope,
      () =>
        new Logger({
          ...this.config,
          scope: this.config.scope ? `${this.config.scope}:${scope}` : scope,
        })
    );
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  warnOnce(key: string, message: string, context?: Record<string, unknown>): void {
    if (this.warnedOnce.has(key)) return;
    this.warnedOnce.add(key);
    this.warn(message, context);
  }

  deprecated(oldSymbol: string, replacement: string, context?: Record<string, unknown>): void {
    this.warnOnce(
      `deprecated:${oldSymbol}`,
      `deprecated ${oldSymbol}; use ${replacement} instead`,
      context
    );
  }

  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  getLevel(): LogLevel {
    return this.config.level;
  }

  getScope(): string {
    return this.config.scope;
  }

  protected emit(entry: LogEntry): void {
    const output =
      this.config.format === 'json' ? JSON.stringify(serializeEntry(entry)) : formatText(entry);

    if (entry.level === 'error') console.error(output);
    else if (entry.level === 'warn') console.warn(output);
    else console.log(output);

    this.parent?.emit({ ...entry, scope: this.parent.config.scope });
  }

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(this.config.level)) return;
    // `>= 1` never samples, and testing it first keeps the default path from
    // drawing ambient entropy on every log line (TODO28 §7.3).
    const { samplingRate } = this.config;
    if (samplingRate < 1 && Math.random() > samplingRate) return;

    this.emit({
      level,
      message,
      timestamp: Date.now(),
      scope: this.config.scope,
      context,
      error,
      ...logEnricher?.(),
    });
  }
}

const serializeEntry = (entry: LogEntry): Record<string, unknown> => ({
  ...entry,
  timestamp: new Date(entry.timestamp).toISOString(),
});

const formatText = (entry: LogEntry): string => {
  const level = entry.level.toUpperCase().padEnd(5);
  const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
  const stack = entry.error ? `\n${entry.error.stack}` : '';
  return `${new Date(entry.timestamp).toISOString()} ${level} [${entry.scope}] ${entry.message}${context}${stack}`;
};

export const createLogger = (config?: Partial<LoggerConfig>): Logger => new Logger(config);
export const defaultLogger = createLogger({ scope: 'root' });

/**
 * A logger that discards everything. For the composition sites that must hand a
 * logger to a component which will not use it — a transport's deps, an agent's
 * optional WS mount — where three call sites each wrote their own object literal of
 * no-op methods, one of them with a `child` that returned `{}` cast to the interface.
 */
export const silentLogger = (): ScopedLogger => {
  const logger: ScopedLogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => logger,
  };
  return logger;
};
