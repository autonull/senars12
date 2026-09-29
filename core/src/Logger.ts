/**
 * Core's logger subpath is a re-export of the one logger in `@senars/util`. It
 * stays so `@senars/core/logger` and `@senars/core/logger` keep resolving, but
 * the implementation and the type vocabulary now live in the leaf package.
 */
export { createLogger, defaultLogger, Logger, registerLogEnricher } from '@senars/util';
export type { LogEntry, LoggerConfig, LogLevel } from '@senars/util';
