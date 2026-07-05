#!/usr/bin/env node

/**
 * Shared utility functions used across the script modules
 * Following DRY and modularization principles from AGENTS.md
 */

/**
 * Generate a unique ID using timestamp and random components
 * @returns {string} A unique identifier
 */
export const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

/**
 * Debounce function to limit how often a function is called
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};

/**
 * Throttle function to limit frequency of function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Throttle limit in milliseconds
 * @returns {Function} Throttled function
 */
export const throttle = (func, limit) => {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
};

/**
 * Deep clone an object using structured cloning algorithm
 * @param {any} obj - Object to clone
 * @returns {any} Deep cloned object
 */
export const deepClone = (obj) => {
    if (obj === null || typeof obj !== "object") return obj;

    // Handle Date
    if (obj instanceof Date) {
        const copy = new Date();
        copy.setTime(obj.getTime());
        return copy;
    }

    // Handle Array
    if (Array.isArray(obj)) {
        return obj.map(item => deepClone(item));
    }

    // Handle Object
    if (typeof obj === "object") {
        const copy = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                copy[key] = deepClone(obj[key]);
            }
        }
        return copy;
    }

    return obj;
};

/**
 * Check if a value is empty
 * @param {any} value - Value to check
 * @returns {boolean} True if value is empty, false otherwise
 */
export const isEmpty = (value) => (
    value == null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0) ||
    (typeof value === 'object' && Object.keys(value).length === 0)
);

/**
 * Check if an object is equal to another object
 * @param {Object} obj1 - First object
 * @param {Object} obj2 - Second object
 * @returns {boolean} True if objects are deeply equal, false otherwise
 */
export const deepEqual = (obj1, obj2) => {
    if (obj1 === obj2) return true;

    if (obj1 == null || obj2 == null) return false;

    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;

    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);

    if (keys1.length !== keys2.length) return false;

    for (const key of keys1) {
        if (!keys2.includes(key)) return false;
        if (!deepEqual(obj1[key], obj2[key])) return false;
    }

    return true;
};

/**
 * Create a promise that resolves after a specified time
 * @param {number} ms - Time in milliseconds
 * @returns {Promise} Promise that resolves after the specified time
 */
export const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Get a nested property from an object using dot notation
 * @param {Object} obj - Object to get property from
 * @param {string} path - Path to property (e.g. 'user.profile.name')
 * @param {*} defaultValue - Default value if property doesn't exist
 * @returns {*} Value at the specified path or default value
 */
export const getNestedProperty = (obj, path, defaultValue = undefined) => {
    const keys = path.split('.');
    let result = obj;

    for (const key of keys) {
        if (result === null || result === undefined) {
            return defaultValue;
        }
        result = result[key];
    }

    return result !== undefined ? result : defaultValue;
};

/**
 * Set a nested property on an object using dot notation
 * @param {Object} obj - Object to set property on
 * @param {string} path - Path to property (e.g. 'user.profile.name')
 * @param {*} value - Value to set
 * @returns {Object} Modified object
 */
export const setNestedProperty = (obj, path, value) => {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let current = obj;

    for (const key of keys) {
        if (!(key in current) || current[key] === null || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }

    current[lastKey] = value;
    return obj;
};

/**
 * Create a memoized function to cache results based on arguments
 * @param {Function} fn - Function to memoize
 * @returns {Function} Memoized function
 */
export const memoize = (fn) => {
    const cache = new Map();
    return (...args) => {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = fn(...args);
        cache.set(key, result);
        return result;
    };
};

/**
 * Format timestamp to a readable time string
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted time string
 */
export const formatTimestamp = (timestamp) =>
    new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'});

/**
 * Format timestamp to a readable date and time string
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date and time string
 */
export const formatDateTime = (timestamp) =>
    new Date(timestamp).toLocaleString([], {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

// Export all utilities
export default {
    generateId,
    debounce,
    throttle,
    deepClone,
    isEmpty,
    deepEqual,
    delay,
    getNestedProperty,
    setNestedProperty,
    memoize,
    formatTimestamp,
    formatDateTime
};