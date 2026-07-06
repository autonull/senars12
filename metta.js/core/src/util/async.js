/**
 * Async utilities for SeNARS
 */

/**
 * Sleep for a specified duration
 * @param {number} ms - Duration in milliseconds
 * @returns {Promise<void>}
 */
export const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Create a timeout promise
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Error message
 * @returns {Promise<never>} Promise that rejects after timeout
 */
export const timeout = (ms, message = 'Operation timed out') =>
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));

/**
 * Race a promise against a timeout
 * @param {Promise} promise - Promise to race
 * @param {number} ms - Timeout in milliseconds
 * @param {string} message - Error message
 * @returns {Promise} Promise that rejects on timeout
 */
export const withTimeout = async (promise, ms, message = 'Operation timed out') =>
    Promise.race([promise, timeout(ms, message)]);

/**
 * Async iterator with delay
 * @param {Iterable} items - Items to iterate
 * @param {number} delay - Delay between items in ms
 * @returns {AsyncGenerator}
 */
export async function* asyncIteratorWithDelay(items, delay = 0) {
    for (const item of items) {
        if (delay > 0) {await sleep(delay);}
        yield item;
    }
}

/**
 * Wait for a condition to be true
 * @param {Function} condition - Condition function
 * @param {Object} options - Options
 * @param {number} options.timeout - Timeout in ms
 * @param {number} options.interval - Check interval in ms
 * @returns {Promise<boolean>} True if condition met, false if timeout
 */
export async function waitForCondition(condition, options = {}) {
    const { timeout: timeoutMs = 5000, interval = 100 } = options;
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
        if (condition()) {return true;}
        await sleep(interval);
    }
    return false;
}

/**
 * Retry an async operation
 * @param {Function} operation - Async operation
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum retry attempts
 * @param {number} options.backoff - Initial backoff in ms
 * @param {boolean} options.exponential - Use exponential backoff
 * @param {Function} options.onError - Error callback
 * @returns {Promise} Result of operation
 */
export async function retry(operation, options = {}) {
    const { maxRetries = 3, backoff = 100, exponential = true, onError = null } = options;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            onError?.(error, attempt, maxRetries);
            if (attempt === maxRetries) {break;}
            await sleep(exponential ? backoff * Math.pow(2, attempt) : backoff);
        }
    }
    throw lastError;
}

/**
 * Check if a function is async
 * @param {Function} fn - Function to check
 * @returns {boolean} True if async function
 */
export const isAsync = (fn) => fn instanceof AsyncFunction;
