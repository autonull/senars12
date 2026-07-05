// ─── Composition ────────────────────────────────────────────────────────────

export const compose = (...fns) => (x) => fns.reduceRight((acc, fn) => fn(acc), x);
export const pipe = (...fns) => (x) => fns.reduce((acc, fn) => fn(acc), x);

export function curry(fn) {
    return function curried(...args) {
        if (args.length >= fn.length) {
            return fn.apply(this, args);
        }
        return (...args2) => curried.apply(this, args.concat(args2));
    };
}

export const partial = (fn, ...args) => (...rest) => fn(...args, ...rest);
export const partialRight = (fn, ...args) => (...rest) => fn(...rest, ...args);
export const identity = (x) => x;
export const constant = (value) => () => value;
export const tap = (fn) => (x) => {
    fn(x);
    return x;
};

// ─── Predicates ─────────────────────────────────────────────────────────────

export const not = (predicate) => (...args) => !predicate(...args);
export const and = (...predicates) => (x) => predicates.every(p => p(x));
export const or = (...predicates) => (x) => predicates.some(p => p(x));
export const prop = (key) => (obj) => obj?.[key];
export const propEq = (key, value) => (obj) => obj?.[key] === value;
export const propSatisfies = (key, predicate) => (obj) => predicate(obj?.[key]);

// ─── Object ─────────────────────────────────────────────────────────────────

export const pick = (keys, obj) => {
    if (!obj || !keys) {
        return {};
    }
    return keys.reduce((acc, key) => {
        if (key in obj) {
            acc[key] = obj[key];
        }
        return acc;
    }, {});
};

export const omit = (keys, obj) => {
    if (!obj || !keys) {
        return {...obj};
    }
    return Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key)));
};

export const pickObj = (obj, keys) => pick(keys, obj);
export const omitObj = (obj, keys) => omit(keys, obj);

// ─── Collection re-exports ──────────────────────────────────────────────────

export {partition} from './collection.js';

// ─── Wrappers ───────────────────────────────────────────────────────────────

export const once = (fn) => {
    let called = false, result;
    return (...args) => {
        if (!called) {
            called = true;
            result = fn(...args);
        }
        return result;
    };
};

export function memoize(fn, resolver) {
    const cache = new Map();
    const memoized = function (...args) {
        const key = resolver ? resolver(...args) : JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn.apply(this, args);
        cache.set(key, result);
        return result;
    };
    memoized.clearCache = () => cache.clear();
    memoized.getCacheSize = () => cache.size;
    memoized.hasCached = (...args) => cache.has(resolver ? resolver(...args) : JSON.stringify(args));
    return memoized;
}

export function debounce(fn, wait, options = {}) {
    const {immediate = false} = options;
    let timeout = null, result = null;
    const debounced = function (...args) {
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            timeout = null;
            if (!immediate) {
                result = fn.apply(this, args);
            }
        }, wait);
        if (callNow) {
            result = fn.apply(this, args);
        }
        return result;
    };
    debounced.cancel = () => {
        clearTimeout(timeout);
        timeout = null;
    };
    return debounced;
}

export function throttle(fn, limit) {
    let inThrottle = false, lastResult = null;
    return function (...args) {
        if (!inThrottle) {
            inThrottle = true;
            lastResult = fn.apply(this, args);
            setTimeout(() => inThrottle = false, limit);
        }
        return lastResult;
    };
}

// ─── Namespaces ─────────────────────────────────────────────────────────────

export const FunctionPipeline = Object.freeze({
    createPipeline(...fns) {
        return fns.reduceRight((a, b) => (...args) => a(b(...args)), v => v);
    },
    createFilterPipeline(filters) {
        return (item) => filters.every(f => {
            try {
                return f(item);
            } catch {
                return false;
            }
        });
    },
    createTransformPipeline(transformers) {
        return (item) => {
            let r = item;
            for (const t of transformers) {
                if (r == null) {
                    break;
                }
                r = t(r);
            }
            return r;
        };
    }
});

export const PredicateFactory = Object.freeze({
    hasProperties(conditions) {
        return (item) => Object.entries(conditions).every(([k, v]) => typeof v === 'function' ? v(item[k]) : item[k] === v);
    },
    isType(type) {
        return (item) => item?.type === type;
    },
    hasProperty(prop) {
        return (item) => !!item[prop];
    },
    inRange(property, {min, max}) {
        return (item) => {
            const v = item[property];
            return typeof v === 'number' && (min === undefined || v >= min) && (max === undefined || v <= max);
        };
    },
    and(...preds) {
        return (item) => preds.every(p => p(item));
    },
    or(...preds) {
        return (item) => preds.some(p => p(item));
    },
    not(pred) {
        return (item) => !pred(item);
    }
});

export const FunctionDecorator = Object.freeze({
    memoize,
    debounce,
    throttle,
    retryable(fn, options = {}) {
        const {maxRetries = 3, delay = 100, exponential = true, shouldRetry = () => true} = options;
        return async function (...args) {
            let lastError;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    return await fn.apply(this, args);
                } catch (error) {
                    lastError = error;
                    if (!shouldRetry(error) || attempt === maxRetries) {
                        break;
                    }
                    await new Promise(r => setTimeout(r, exponential ? delay * 2 ** attempt : delay));
                }
            }
            throw lastError;
        };
    },
    rateLimit(fn, rate, timeWindow = 1000) {
        const timestamps = [];
        return async function (...args) {
            const now = Date.now();
            while (timestamps.length && timestamps[0] < now - timeWindow) {
                timestamps.shift();
            }
            if (timestamps.length >= rate) {
                await new Promise(r => setTimeout(r, timestamps[0] + timeWindow - now));
                timestamps.shift();
            }
            timestamps.push(Date.now());
            return fn.apply(this, args);
        };
    }
});

import {withTimeout, retry, sleep} from './async.js';

export const AsyncUtils = Object.freeze({
    delay(ms) {
        return sleep(ms);
    },
    withTimeout(promise, ms, message) {
        return withTimeout(promise, ms, message);
    },
    async withConcurrency(tasks, concurrency) {
        const results = [];
        let idx = 0;
        const worker = async () => {
            while (idx < tasks.length) {
                const i = idx++;
                results[i] = await tasks[i]();
            }
        };
        await Promise.all(Array(Math.min(concurrency, tasks.length)).fill(null).map(() => worker()));
        return results;
    },
    retry(fn, options) {
        return retry(fn, {
            maxRetries: options?.maxRetries ?? 3,
            backoff: options?.baseDelay ?? 100,
            exponential: true,
            onError: options?.shouldRetry ? (err) => { if (!options.shouldRetry(err)) { throw err; } } : null
        });
    }
});

// ─── Performance ────────────────────────────────────────────────────────────

import {Logger} from './Logger.js';

export function measureTime(fn, label = 'Function') {
    return async function (...args) {
        const start = performance.now();
        try {
            const result = await fn.apply(this, args);
            Logger.debug(`${label} executed in ${(performance.now() - start).toFixed(2)}ms`);
            return result;
        } catch (error) {
            Logger.error(`${label} failed after ${(performance.now() - start).toFixed(2)}ms: ${error.message}`);
            throw error;
        }
    };
}

export function cacheWithTTL(fn, ttl = 60000) {
    const cache = new Map();
    return async function (...args) {
        const key = JSON.stringify(args);
        const cached = cache.get(key);
        if (cached && Date.now() - cached.timestamp < ttl) {
            return cached.value;
        }
        const value = await fn.apply(this, args);
        cache.set(key, {value, timestamp: Date.now()});
        return value;
    };
}

export function lazy(fn) {
    let evaluated = false, result = null;
    return function (...args) {
        if (!evaluated) {
            result = fn.apply(this, args);
            evaluated = true;
        }
        return result;
    };
}

// ─── Singleton (from singleton.js) ──────────────────────────────────────────

export function createSingleton(factory) {
    let instance = null;
    const getInstance = (...args) => {
        if (!instance) {
            instance = factory(...args);
        }
        return instance;
    };
    getInstance.reset = () => { instance = null; };
    getInstance.getInstance = () => instance;
    return getInstance;
}

// ─── Misc utilities (from miscUtils.js) ──────────────────────────────────────

export const safeExecute = (fn, ...args) => {
    try { return fn(...args); }
    catch { return null; }
};

export const getMemoryUsage = () =>
    typeof process !== 'undefined' && process.memoryUsage ? process.memoryUsage() : null;

export const getHeapUsed = () => getMemoryUsage()?.heapUsed ?? 0;
