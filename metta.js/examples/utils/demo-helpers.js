/**
 * Shared utilities for example demos
 * Provides consistent formatting and helper functions
 */

/**
 * Print a section header
 */
export const section = (title) => {
    console.log(`\n${'═'.repeat(60)}\n${title}\n${'═'.repeat(60)}`);
};

/**
 * Print a log message with consistent indentation
 */
export const log = (...args) => {
    console.log('  ', ...args);
};

/**
 * Format and print a metric
 */
export const metric = (label, value, unit = '') => {
    const formattedValue = typeof value === 'number'
        ? value.toFixed(2)
        : value;
    log(`${label}: ${formattedValue}${unit ? ' ' + unit : ''}`);
};

/**
 * Format a truth value for display
 */
export const formatTruth = (truth) => {
    if (!truth) return 'N/A';
    return `%${(truth.frequency * 100).toFixed(0)};${(truth.confidence * 100).toFixed(0)}%`;
};

/**
 * Print a takeaways section
 */
export const takeaways = (...points) => {
    section('✨ Key Takeaways');
    points.forEach(point => log(`• ${point}`));
    console.log();
};

/**
 * Safe async operation with error handling
 */
export const safely = async (fn, errorMsg = 'Operation failed') => {
    try {
        return await fn();
    } catch (error) {
        log(`❌ ${errorMsg}: ${error.message}`);
        return null;
    }
};

/**
 * Measure execution time of an async function
 */
export const measure = async (fn, label = 'Operation') => {
    const start = Date.now();
    const result = await fn();
    const duration = Date.now() - start;
    metric(`${label} duration`, duration, 'ms');
    return result;
};

/**
 * Hard timeout wrapper - rejects if operation exceeds timeout
 * @param {Promise} promise - The promise to wrap
 * @param {number} ms - Timeout in milliseconds
 * @param {string} label - Description for error message
 * @returns {Promise} Resolves with result or rejects with timeout error
 */
export const withTimeout = (promise, ms, label = 'Operation') =>
    Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
        )
    ]);

/**
 * Demo timeout constant (5 seconds per demo)
 */
export const DEMO_TIMEOUT_MS = 5000;
