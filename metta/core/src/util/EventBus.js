import mitt from 'mitt';
import {TraceId} from './TraceId.js';
import {Logger} from './Logger.js';

export class EventBus {
    constructor() {
        this._emitter = mitt();
        this._middleware = [];
        this._errorHandlers = new Set();
        this._stats = {eventsEmitted: 0, eventsHandled: 0, errors: 0};
        this._enabled = true;
        this._maxListeners = 10;
        this._concurrency = 0;
        this._maxConcurrency = 50;
        this._maxQueueSize = 1000;
        this._queue = [];
        this._wildcards = new Map();
        this._history = [];
        this._maxHistory = 100;
        this._debugMode = false;
    }

    static _instance = null;

    static get instance() {
        if (!EventBus._instance) {
            EventBus._instance = new EventBus();
        }
        return EventBus._instance;
    }

    on(eventName, callback) {
        const currentCount = this.listenerCount(eventName);
        if (currentCount >= this._maxListeners) {
            Logger.warn(`Possible memory leak detected: ${currentCount} listeners for event "${eventName}"`);
        }
        if (eventName.includes('*')) {
            return this._addWildcardListener(eventName, callback);
        }
        this._emitter.on(eventName, callback);
        return () => this._emitter.off(eventName, callback);
    }

    once(eventName, callback) {
        let unsub;
        const onceWrapper = (...args) => {
            unsub();
            callback(...args);
        };
        unsub = this.on(eventName, onceWrapper);
        return unsub;
    }

    off(eventName, callback) {
        if (eventName.includes('*')) {
            this._removeWildcard(eventName, callback);
            return this;
        }
        this._emitter.off(eventName, callback);
        return this;
    }

    use(middleware) {
        if (typeof middleware !== 'function') {
            throw new Error('Middleware must be a function');
        }
        this._middleware.push(middleware);
        return this;
    }

    removeMiddleware(middleware) {
        const index = this._middleware.indexOf(middleware);
        if (index !== -1) {
            this._middleware.splice(index, 1);
        }
        return this;
    }

    onError(handler) {
        if (typeof handler === 'function') {
            this._errorHandlers.add(handler);
        }
        return this;
    }

    async emit(eventName, data = {}, options = {}) {
        if (!this._enabled) {
            return;
        }
        if (this._concurrency >= this._maxConcurrency) {
            if (this._queue.length >= this._maxQueueSize) {
                Logger.warn(`EventBus queue full (${this._maxQueueSize}), dropping event "${eventName}"`);
                return;
            }
            await new Promise(resolve => this._queue.push(resolve));
        }
        this._concurrency++;
        try {
            this._stats.eventsEmitted++;
            const traceId = options.traceId ?? TraceId.generate();
            let processedData = {...data, eventName, traceId};

            if (this._debugMode) {
                this._addToHistory(eventName, processedData);
            }

            for (const middleware of this._middleware) {
                try {
                    const result = await middleware(processedData);
                    if (result === null) {
                        return;
                    }
                    processedData = result;
                } catch (error) {
                    return this._handleError('middleware', error, {eventName, data, traceId});
                }
            }

            try {
                this._emitter.emit(eventName, processedData);
                this._notifyWildcards(eventName, processedData);
                this._stats.eventsHandled++;
            } catch (error) {
                this._stats.errors++;
                this._handleError('listener', error, {eventName, data, traceId});
            }
        } finally {
            this._concurrency--;
            const next = this._queue.shift();
            if (next) {
                next();
            }
        }
    }

    emitSync(event, payload) {
        if (!this._enabled) {
            return;
        }
        if (this._debugMode) {
            this._addToHistory(event, payload);
        }
        this._runMiddlewareSync(event, payload, () => {
            this._emitter.emit(event, payload);
            this._notifyWildcards(event, payload);
        });
    }

    _runMiddlewareSync(event, payload, finalCallback) {
        let index = 0;
        const next = () => {
            if (index < this._middleware.length) {
                const middleware = this._middleware[index++];
                try {
                    middleware(event, payload, next);
                } catch (error) {
                    console.error('Error in event middleware:', error);
                    next();
                }
            } else {
                finalCallback();
            }
        };
        next();
    }

    _handleError(type, error, context) {
        const errorHandlers = [...this._errorHandlers];
        for (const handler of errorHandlers) {
            try {
                handler(error, type, context);
            } catch (handlerError) {
                Logger.error('EventBus error handler error:', handlerError);
            }
        }
        if (errorHandlers.length === 0) {
            Logger.error(`EventBus error in ${type}:`, error, context);
        }
    }

    hasErrorHandlers() {
        return this._errorHandlers.size > 0;
    }

    getStats() {
        return {...this._stats};
    }

    clear() {
        this._emitter.all.clear();
        this._middleware = [];
        this._errorHandlers.clear();
        this._stats = {eventsEmitted: 0, eventsHandled: 0, errors: 0};
        this._wildcards.clear();
    }

    enable() {
        this._enabled = true;
    }

    disable() {
        this._enabled = false;
    }

    isEnabled() {
        return this._enabled;
    }

    hasListeners(eventName) {
        const handlers = this._emitter.all.get(eventName);
        return !!(handlers?.length || handlers?.size) || this._wildcards.size > 0;
    }

    hasSubscribers(eventName) {
        return this._middleware.length > 0 || this.hasListeners(eventName) || this.hasListeners('*');
    }

    listenerCount(eventName) {
        const handlers = this._emitter.all.get(eventName);
        let count = handlers?.length || handlers?.size || 0;
        for (const [pattern] of this._wildcards) {
            if (this._matchesPattern(eventName, pattern)) {
                count += this._wildcards.get(pattern).length;
            }
        }
        return count;
    }

    setMaxListeners(maxListeners) {
        if (typeof maxListeners === 'number' && maxListeners > 0) {
            this._maxListeners = maxListeners;
        }
        return this;
    }

    getMaxListeners() {
        return this._maxListeners;
    }

    removeAllListeners(eventName) {
        if (eventName) {
            this._emitter.all.delete(eventName);
            this._wildcards.delete(eventName);
        } else {
            this._emitter.all.clear();
            this._wildcards.clear();
        }
        return this;
    }

    debug(enabled = true) {
        this._debugMode = enabled;
    }

    getHistory() {
        return [...this._history];
    }

    clearHistory() {
        this._history = [];
    }

    _addWildcardListener(pattern, callback) {
        if (!this._wildcards.has(pattern)) {
            this._wildcards.set(pattern, []);
        }
        this._wildcards.get(pattern).push(callback);
        return () => this._removeWildcard(pattern, callback);
    }

    _removeWildcard(pattern, callback) {
        const callbacks = this._wildcards.get(pattern);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    _notifyWildcards(event, payload) {
        for (const [pattern, callbacks] of this._wildcards.entries()) {
            if (this._matchesPattern(event, pattern)) {
                for (const cb of callbacks) {
                    try {
                        cb(payload, event);
                    } catch (error) {
                        Logger.error(`Error in wildcard handler for "${pattern}":`, error);
                    }
                }
            }
        }
    }

    _matchesPattern(event, pattern) {
        const regex = new RegExp(`^${pattern.replace(/\*/g, '.*').replace(/:/g, ':')}$`);
        return regex.test(event);
    }

    _addToHistory(event, payload) {
        this._history.push({event, payload, timestamp: Date.now()});
        if (this._history.length > this._maxHistory) {
            this._history.shift();
        }
    }
}
