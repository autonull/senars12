export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  scope: string;
  context?: Record<string, unknown>;
  error?: Error;
}

export interface LoggerConfig {
  level: LogLevel;
  format: 'json' | 'text';
  scope: string;
  samplingRate?: number;
}

export interface LoggerInterface {
  debug(message: string, context?: Record<string, unknown>): void;
  info(message: string, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  child(scope: string): LoggerInterface;
  warnOnce(key: string, message: string, context?: Record<string, unknown>): void;
  deprecated(oldSymbol: string, replacement: string, context?: Record<string, unknown>): void;
}

const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];

export class Logger {
  private readonly config: LoggerConfig;
  private readonly parent?: Logger;
  private readonly children: Map<string, Logger> = new Map();
  private readonly warnedOnce: Set<string> = new Set();

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level ?? 'info',
      format: config.format ?? 'text',
      scope: config.scope ?? 'root',
      samplingRate: config.samplingRate ?? 1.0,
    };
  }

  child(scope: string): Logger {
    const existing = this.children.get(scope);
    if (existing) return existing;

    const childLogger = new Logger({
      ...this.config,
      scope: this.config.scope ? `${this.config.scope}:${scope}` : scope,
    });

    this.children.set(scope, childLogger);
    return childLogger;
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

  private log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    error?: Error
  ): void {
    if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(this.config.level)) return;
    if (this.config.samplingRate && Math.random() > this.config.samplingRate) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      scope: this.config.scope,
      context,
      error,
    };
    this.emit(entry);
  }

  protected emit(entry: LogEntry): void {
    const output =
      this.config.format === 'json'
        ? JSON.stringify(this.serialize(entry))
        : this.formatText(entry);

    if (entry.level === 'error') console.error(output);
    else if (entry.level === 'warn') console.warn(output);
    else console.log(output);

    if (this.parent) {
      const parentEntry = { ...entry, scope: this.parent.config.scope };
      this.parent.emit(parentEntry);
    }
  }

  private serialize(entry: LogEntry): Record<string, unknown> {
    return { ...entry, timestamp: new Date(entry.timestamp).toISOString() };
  }

  private formatText(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const scope = `[${entry.scope}]`;
    let message = `${timestamp} ${level} ${scope} ${entry.message}`;
    if (entry.context) message += ` ${JSON.stringify(entry.context)}`;
    if (entry.error) message += `\n${entry.error.stack}`;
    return message;
  }
}

export const createLogger = (config?: Partial<LoggerConfig>): Logger => new Logger(config);
export const defaultLogger = createLogger({ scope: 'root' });
