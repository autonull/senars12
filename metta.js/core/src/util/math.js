/**
 * Math utilities for SeNARS
 */

/**
 * Clamp a value between min and max
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Normalize a value
 * @param {number} value - Value to normalize
 * @param {number} max - Maximum value
 * @returns {number} Normalized value
 */
export const normalize = (value, max) => Math.min(value / max, 1);

/**
 * Check if value is between min and max
 * @param {number} value - Value to check
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {boolean} True if value is between min and max
 */
export const isBetween = (value, min, max) => value >= min && value <= max;

/**
 * Clamp and freeze an object or number
 * @param {number|Object} obj - Value or object to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number|Object} Clamped and frozen value
 */
export const clampAndFreeze = (obj, min = 0, max = 1) =>
    typeof obj === 'number'
        ? Object.freeze(clamp(obj, min, max))
        : Object.freeze(Object.fromEntries(
            Object.entries(obj).map(([key, value]) => [
                key,
                typeof value === 'number' ? clamp(value, min, max) : value
            ])
        ));

/**
 * Check if value is a valid number
 * @param {*} value - Value to check
 * @returns {boolean} True if value is a valid number
 */
export const isNumber = (value) => typeof value === 'number' && !isNaN(value);

/**
 * Round a number to specified decimals
 * @param {number} value - Value to round
 * @param {number} decimals - Decimal places
 * @returns {number} Rounded value
 */
export const round = (value, decimals = 2) => Number(`${Math.round(`${value}e${decimals}`)}e-${decimals}`);

/**
 * Format a number with decimals
 * @param {number} num - Number to format
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted number
 */
export const formatNumber = (num, decimals = 2) =>
    typeof num === 'number' ? num.toFixed(decimals) : String(num ?? '0');

/**
 * Generate a random float between min and max
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random float
 */
export const random = (min = 0, max = 1) => Math.random() * (max - min) + min;

/**
 * Generate a random integer between min and max (inclusive)
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Random integer
 */
export const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

/**
 * Compute dot product of two vectors
 * @param {number[]|Float32Array} a - First vector
 * @param {number[]|Float32Array} b - Second vector
 * @returns {number} Dot product
 */
export const dotProduct = (a, b) => {
    const len = Math.min(a.length, b.length);
    let sum = 0;
    for (let i = 0; i < len; i++) {
        sum += a[i] * b[i];
    }
    return sum;
};

/**
 * Compute euclidean norm (L2 norm) of a vector
 * @param {number[]|Float32Array} v - Vector
 * @returns {number} Euclidean norm
 */
export const euclideanNorm = (v) => {
    let sum = 0;
    for (let i = 0; i < v.length; i++) {
        sum += v[i] * v[i];
    }
    return Math.sqrt(sum);
};

/**
 * Compute cosine similarity between two vectors
 * @param {number[]|Float32Array} a - First vector
 * @param {number[]|Float32Array} b - Second vector
 * @returns {number} Cosine similarity (-1 to 1)
 */
export const cosineSimilarity = (a, b) => {
    const dot = dotProduct(a, b);
    const normA = euclideanNorm(a);
    const normB = euclideanNorm(b);
    return dot / ((normA * normB) || 1);
};

/**
 * Compute softmax over an array of scores
 * @param {number[]} scores - Input scores
 * @returns {number[]} Probability distribution
 */
export const softmax = (scores) => {
    const maxScore = Math.max(...scores, -Infinity);
    const expScores = scores.map(s => Math.exp(s - maxScore));
    const sumExp = expScores.reduce((a, b) => a + b, 0) || 1;
    return expScores.map(e => e / sumExp);
};
