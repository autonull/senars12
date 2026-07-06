import { envDetector } from './EnvironmentDetector.js';

const LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };

class LoggerClass {
    #adapters = new Set();

    constructor({ silent = null, level = 'INFO' } = {}) {
        this.isTestEnv = envDetector.isTest();
        this.silent = silent ?? this.isTestEnv;
        this.currentLevel = LEVELS[level.toUpperCase()] ?? LEVELS.INFO;
    }

    addAdapter(adapter) { this.#adapters.add(adapter); return this; }
    removeAdapter(adapter) { this.#adapters.delete(adapter); return this; }

    shouldLog(level) {
        if (this.silent) {return false;}
        if (level === 'debug' && !envDetector.isDebug()) {return false;}
        return (LEVELS[level.toUpperCase()] ?? LEVELS.INFO) <= this.currentLevel;
    }

    log(level, msg, data) {
        if (!this.shouldLog(level)) {return;}

        const message = typeof msg === 'function' ? msg() : msg;
        const logData = typeof data === 'function' ? data() : data;

        for (const adapter of this.#adapters) {
            try { adapter.log?.(level, message, logData); } catch { /* skip broken adapters */ }
        }

        if (this.#adapters.size === 0) {
            const consoleMethod = console[level] || console.log;
            logData !== undefined ? consoleMethod(`[${level.toUpperCase()}]`, message, logData)
                : consoleMethod(`[${level.toUpperCase()}]`, message);
        }
    }

    debug(msg, data) { this.log('debug', msg, data); }
    info(msg, data) { this.log('info', msg, data); }
    warn(msg, data) { this.log('warn', msg, data); }
    error(msg, data) { this.log('error', msg, data); }

    setSilent(silent) { this.silent = silent; }
    setLevel(level) { const v = LEVELS[level.toUpperCase()]; if (v !== undefined) {this.currentLevel = v;} }
    getLevel() { return Object.keys(LEVELS).find(k => LEVELS[k] === this.currentLevel); }
}

export class ConsoleLoggerAdapter {
    log(level, message, data) {
        const fn = console[level] || console.log;
        data !== undefined ? fn(`[${level.toUpperCase()}]`, message, data)
            : fn(`[${level.toUpperCase()}]`, message);
    }
}

const logger = new LoggerClass();
export { logger as Logger };
