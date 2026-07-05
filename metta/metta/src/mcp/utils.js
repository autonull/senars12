/**
 * MCP Utility Helpers
 * Common patterns and utilities for MCP integration
 */

/**
 * Create a tool wrapper that adds retry logic
 * @param {Function} toolFn - Original tool function
 * @param {Object} options - Retry options
 * @returns {Function} Wrapped function
 */
export function withRetry(toolFn, options = {}) {
    const {
        maxRetries = 3,
        baseDelay = 1000,
        maxDelay = 10000,
        onRetry = () => {
        }
    } = options;

    return async function (...args) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await toolFn(...args);
            } catch (error) {
                lastError = error;
                if (attempt < maxRetries) {
                    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
                    onRetry({attempt, error, delay});
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        throw new Error(`Failed after ${maxRetries + 1} attempts: ${lastError.message}`);
    };
}

/**
 * Create a tool wrapper with timeout
 * @param {Function} toolFn - Original tool function
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Function} Wrapped function
 */
export function withTimeout(toolFn, timeoutMs = 30000) {
    return async function (...args) {
        return Promise.race([
            toolFn(...args),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms`)), timeoutMs)
            )
        ]);
    };
}

/**
 * Create a tool wrapper with caching
 * @param {Function} toolFn - Original tool function
 * @param {Object} options - Cache options
 * @returns {Function} Wrapped function
 */
export function withCache(toolFn, options = {}) {
    const {
        ttlMs = 60000,
        keyFn = (args) => JSON.stringify(args),
        cache = new Map()
    } = options;

    return async function (...args) {
        const key = keyFn(args);
        const cached = cache.get(key);

        if (cached && Date.now() - cached.timestamp < ttlMs) {
            return cached.result;
        }

        const result = await toolFn(...args);
        cache.set(key, {result, timestamp: Date.now()});
        return result;
    };
}

/**
 * Create a tool wrapper with circuit breaker
 * @param {Function} toolFn - Original tool function
 * @param {Object} options - Circuit breaker options
 * @returns {Function} Wrapped function
 */
export function withCircuitBreaker(toolFn, options = {}) {
    const {
        failureThreshold = 5,
        successThreshold = 2,
        timeout = 60000
    } = options;

    let failures = 0;
    let successes = 0;
    let state = 'closed'; // closed, open, half-open
    let lastFailureTime = 0;

    return async function (...args) {
        if (state === 'open') {
            if (Date.now() - lastFailureTime > timeout) {
                state = 'half-open';
                successes = 0;
            } else {
                throw new Error('Circuit breaker is open');
            }
        }

        try {
            const result = await toolFn(...args);
            successes++;
            failures = 0;

            if (state === 'half-open' && successes >= successThreshold) {
                state = 'closed';
            }

            return result;
        } catch (error) {
            failures++;
            successes = 0;
            lastFailureTime = Date.now();

            if (failures >= failureThreshold) {
                state = 'open';
            }

            throw error;
        }
    };
}

/**
 * Compose multiple tool calls into a pipeline
 * @param  {...Function} fns - Functions to compose
 * @returns {Function} Composed function
 */
export function pipeline(...fns) {
    return async function (initial) {
        let result = initial;
        for (const fn of fns) {
            result = await fn(result);
        }
        return result;
    };
}

/**
 * Run multiple tool calls in parallel
 * @param {Array<Function>} fns - Functions to run
 * @returns {Promise<Array>} Results
 */
export function parallel(...fns) {
    return async function (context) {
        return Promise.all(fns.map(fn => fn(context)));
    };
}

/**
 * Create a conditional tool executor
 * @param {Function} predicate - Predicate function
 * @param {Function} thenFn - Function to run if true
 * @param {Function} elseFn - Function to run if false
 * @returns {Function} Conditional function
 */
export function conditional(predicate, thenFn, elseFn) {
    return async function (...args) {
        const result = await predicate(...args);
        return result ? thenFn(...args) : (elseFn ? elseFn(...args) : undefined);
    };
}

/**
 * Create a tool wrapper with logging
 * @param {Function} toolFn - Original tool function
 * @param {Object} options - Logging options
 * @returns {Function} Wrapped function
 */
export function withLogging(toolFn, options = {}) {
    const {
        name = toolFn.name || 'anonymous',
        logger = console,
        logInput = false,
        logOutput = false
    } = options;

    return async function (...args) {
        const startTime = Date.now();

        if (logInput) {
            logger.debug(`[${name}] Input:`, args);
        } else {
            logger.debug(`[${name}] Called with ${args.length} arguments`);
        }

        try {
            const result = await toolFn(...args);
            const duration = Date.now() - startTime;

            if (logOutput) {
                logger.debug(`[${name}] Output (${duration}ms):`, result);
            } else {
                logger.debug(`[${name}] Completed in ${duration}ms`);
            }

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`[${name}] Error after ${duration}ms:`, error.message);
            throw error;
        }
    };
}

/**
 * Create a batch tool executor
 * @param {Function} toolFn - Tool function to batch
 * @param {number} batchSize - Batch size
 * @param {number} delayMs - Delay between batches
 * @returns {Function} Batched function
 */
export function batch(toolFn, batchSize = 10, delayMs = 100) {
    return async function (items) {
        const results = [];
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(batch.map(item => toolFn(item)));
            results.push(...batchResults);

            if (i + batchSize < items.length) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
        return results;
    };
}

/**
 * Create a rate-limited tool executor
 * @param {Function} toolFn - Tool function to rate limit
 * @param {number} limit - Max calls per window
 * @param {number} windowMs - Window size in ms
 * @returns {Function} Rate-limited function
 */
export function rateLimit(toolFn, limit = 10, windowMs = 1000) {
    const timestamps = [];

    return async function (...args) {
        const now = Date.now();

        // Remove old timestamps
        while (timestamps.length > 0 && timestamps[0] < now - windowMs) {
            timestamps.shift();
        }

        if (timestamps.length >= limit) {
            const waitTime = timestamps[0] + windowMs - now;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        timestamps.push(Date.now());
        return toolFn(...args);
    };
}

/**
 * Transform tool result
 * @param {Function} toolFn - Original tool function
 * @param {Function} transformer - Transform function
 * @returns {Function} Wrapped function
 */
export function transformResult(toolFn, transformer) {
    return async function (...args) {
        const result = await toolFn(...args);
        return transformer(result);
    };
}

/**
 * Create a fallback chain for tool calls
 * @param  {...Function} fns - Functions to try in order
 * @returns {Function} Fallback chain function
 */
export function fallbackChain(...fns) {
    return async function (...args) {
        let lastError;
        for (const fn of fns) {
            try {
                return await fn(...args);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('All fallbacks failed');
    };
}

/**
 * Validate tool parameters
 * @param {Function} toolFn - Tool function
 * @param {Function} validator - Validation function
 * @returns {Function} Wrapped function
 */
export function withValidation(toolFn, validator) {
    return async function (...args) {
        const valid = validator(...args);
        if (!valid) {
            throw new Error('Invalid parameters');
        }
        return toolFn(...args);
    };
}

/**
 * Create a memoized tool function
 * @param {Function} toolFn - Tool function
 * @param {Function} keyFn - Key generation function
 * @param {Map} cache - Cache storage
 * @returns {Function} Memoized function
 */
export function memoize(toolFn, keyFn = JSON.stringify, cache = new Map()) {
    return async function (...args) {
        const key = keyFn(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = await toolFn(...args);
        cache.set(key, result);
        return result;
    };
}

/**
 * Tool execution context for maintaining state across calls
 */
export class ToolContext {
    constructor(initialState = {}) {
        this.state = initialState;
        this.history = [];
    }

    get(key) {
        return this.state[key];
    }

    set(key, value) {
        this.state[key] = value;
        return this;
    }

    record(toolName, input, output, error = null) {
        this.history.push({
            tool: toolName,
            input,
            output,
            error,
            timestamp: Date.now()
        });
        return this;
    }

    getHistory(limit = 10) {
        return this.history.slice(-limit);
    }

    clear() {
        this.state = {};
        this.history = [];
        return this;
    }
}

export default {
    withRetry,
    withTimeout,
    withCache,
    withCircuitBreaker,
    pipeline,
    parallel,
    conditional,
    withLogging,
    batch,
    rateLimit,
    transformResult,
    fallbackChain,
    withValidation,
    memoize,
    ToolContext
};
