/**
 * The monorepo's one logger.
 *
 * It lives in the leaf package because every layer needs it, including the ones
 * `core` is built on: `EventBus` and `Signal` take a `Logger` and would
 * otherwise have to carry a second, console-only implementation of this surface.
 */
import { getOrInsert } from './collections';
const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
let logEnricher;
export const registerLogEnricher = (enrich) => {
    logEnricher = enrich;
};
export class Logger {
    scope;
    config;
    parent;
    children = new Map();
    warnedOnce = new Set();
    constructor(config = {}) {
        this.config = {
            level: config.level ?? 'info',
            format: config.format ?? 'text',
            scope: config.scope ?? 'root',
            samplingRate: config.samplingRate ?? 1.0,
        };
        this.scope = this.config.scope;
    }
    child(scope) {
        return getOrInsert(this.children, scope, () => new Logger({
            ...this.config,
            scope: this.config.scope ? `${this.config.scope}:${scope}` : scope,
        }));
    }
    debug(message, context) {
        this.log('debug', message, context);
    }
    info(message, context) {
        this.log('info', message, context);
    }
    warn(message, context) {
        this.log('warn', message, context);
    }
    error(message, error, context) {
        this.log('error', message, context, error);
    }
    warnOnce(key, message, context) {
        if (this.warnedOnce.has(key))
            return;
        this.warnedOnce.add(key);
        this.warn(message, context);
    }
    deprecated(oldSymbol, replacement, context) {
        this.warnOnce(`deprecated:${oldSymbol}`, `deprecated ${oldSymbol}; use ${replacement} instead`, context);
    }
    setLevel(level) {
        this.config.level = level;
    }
    getLevel() {
        return this.config.level;
    }
    getScope() {
        return this.config.scope;
    }
    emit(entry) {
        const output = this.config.format === 'json' ? JSON.stringify(serializeEntry(entry)) : formatText(entry);
        if (entry.level === 'error')
            console.error(output);
        else if (entry.level === 'warn')
            console.warn(output);
        else
            console.log(output);
        this.parent?.emit({ ...entry, scope: this.parent.config.scope });
    }
    log(level, message, context, error) {
        if (LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(this.config.level))
            return;
        // `>= 1` never samples, and testing it first keeps the default path from
        // drawing ambient entropy on every log line (TODO28 §7.3).
        const { samplingRate } = this.config;
        if (samplingRate < 1 && Math.random() > samplingRate)
            return;
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
const serializeEntry = (entry) => ({
    ...entry,
    timestamp: new Date(entry.timestamp).toISOString(),
});
const formatText = (entry) => {
    const level = entry.level.toUpperCase().padEnd(5);
    const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const stack = entry.error ? `\n${entry.error.stack}` : '';
    return `${new Date(entry.timestamp).toISOString()} ${level} [${entry.scope}] ${entry.message}${context}${stack}`;
};
export const createLogger = (config) => new Logger(config);
export const defaultLogger = createLogger({ scope: 'root' });
/**
 * A logger that discards everything. For the composition sites that must hand a
 * logger to a component which will not use it — a transport's deps, an agent's
 * optional WS mount — where three call sites each wrote their own object literal of
 * no-op methods, one of them with a `child` that returned `{}` cast to the interface.
 */
export const silentLogger = () => {
    const logger = {
        debug: () => { },
        info: () => { },
        warn: () => { },
        error: () => { },
        child: () => logger,
    };
    return logger;
};
