/**
 * The monorepo's one logger.
 *
 * It lives in the leaf package because every layer needs it, including the ones
 * `core` is built on: `EventBus` and `Signal` take a `Logger` and would
 * otherwise have to carry a second, console-only implementation of this surface.
 */
import type { LogEntry, LoggerConfig, LogLevel, ScopedLogger } from '@senars/types/lifecycle';
/**
 * O2 (TODO20): pluggable entry enricher — the OTel integration registers one that
 * injects `traceId`/`spanId` from the active span. This package stays OTel-free.
 */
type LogEnricher = () => Record<string, unknown> | undefined;
export declare const registerLogEnricher: (enrich?: LogEnricher) => void;
export declare class Logger {
    readonly scope: string;
    private readonly config;
    private readonly parent?;
    private readonly children;
    private readonly warnedOnce;
    constructor(config?: LoggerConfig);
    child(scope: string): Logger;
    debug(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, error?: Error, context?: Record<string, unknown>): void;
    warnOnce(key: string, message: string, context?: Record<string, unknown>): void;
    deprecated(oldSymbol: string, replacement: string, context?: Record<string, unknown>): void;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
    getScope(): string;
    protected emit(entry: LogEntry): void;
    private log;
}
export declare const createLogger: (config?: Partial<LoggerConfig>) => Logger;
export declare const defaultLogger: Logger;
/**
 * A logger that discards everything. For the composition sites that must hand a
 * logger to a component which will not use it — a transport's deps, an agent's
 * optional WS mount — where three call sites each wrote their own object literal of
 * no-op methods, one of them with a `child` that returned `{}` cast to the interface.
 */
export declare const silentLogger: () => ScopedLogger;
export {};
//# sourceMappingURL=logger.d.ts.map