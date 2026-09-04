/**
 * Object utilities for SeNARS
 */

export const { freeze } = Object;

export const deepFreeze = (obj) => {
  if (obj == null || typeof obj !== 'object') {
    return obj;
  }
  for (const prop of Object.getOwnPropertyNames(obj)) {
    deepFreeze(obj[prop]);
  }
  return freeze(obj);
};

export const isObject = (item) => item && typeof item === 'object' && !Array.isArray(item);

/**
 * Deep clone an object with support for circular references, Date, RegExp, Map, Set
 * @param {*} obj - Object to clone
 * @param {WeakMap} hash - Hash map for circular reference detection
 * @returns {*} Cloned object
 */
export function deepClone(obj, hash = new WeakMap()) {
  if (obj == null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  if (obj instanceof RegExp) {
    return new RegExp(obj.source, obj.flags);
  }

  if (obj instanceof Map) {
    const result = new Map();
    hash.set(obj, result);
    for (const [key, value] of obj.entries()) {
      result.set(deepClone(key, hash), deepClone(value, hash));
    }
    return result;
  }

  if (obj instanceof Set) {
    const result = new Set();
    hash.set(obj, result);
    for (const value of obj) {
      result.add(deepClone(value, hash));
    }
    return result;
  }

  if (obj instanceof Array) {
    const result = new Array(obj.length);
    hash.set(obj, result);
    for (let i = 0; i < obj.length; i++) {
      result[i] = deepClone(obj[i], hash);
    }
    return result;
  }

  if (typeof obj === 'object') {
    if (hash.has(obj)) {
      return hash.get(obj);
    }
    const result = Object.create(Object.getPrototypeOf(obj));
    hash.set(obj, result);
    for (const key of Object.keys(obj)) {
      result[key] = deepClone(obj[key], hash);
    }
    return result;
  }

  return obj;
}

/**
 * Safe clone using structuredClone if available, falls back to deepClone
 * @param {*} obj - Object to clone
 * @returns {*} Cloned object
 */
export function safeClone(obj) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(obj);
    } catch {
      // structuredClone may fail on certain objects (DOM nodes, functions, etc.)
    }
  }
  return deepClone(obj);
}

// pick/omit are canonically defined in func.js.
// For (obj, keys) signature, use pickObj/omitObj from func.js.
// Re-exported here for backward compatibility with callers importing from object.js:
export { omitObj, pickObj } from './func.js';

/**
 * Deep merge two objects recursively with circular reference handling
 * @param {Object} target - Target object
 * @param {Object} source - Source object
 * @param {WeakSet} [_visited] - Internal: visited objects for circular ref detection
 * @returns {Object} Merged object
 */
export const deepMerge = (target, source, _visited = new WeakSet()) => {
  if (!source) {
    return target;
  }
  if (!isObject(target) || !isObject(source)) {
    return source;
  }
  if (_visited.has(target)) {
    return target;
  }
  if (_visited.has(source)) {
    return source;
  }
  _visited.add(target);
  _visited.add(source);

  const output = { ...target };
  for (const key of Object.keys(source)) {
    output[key] =
      isObject(source[key]) && key in target
        ? deepMerge(target[key], source[key], _visited)
        : source[key];
  }
  return output;
};

/**
 * Deep merge configuration with base and overrides
 * @param {Object} base - Base configuration
 * @param {...Object} overrides - Override configurations
 * @returns {Object} Merged configuration
 */
export const deepMergeConfig = (base, ...overrides) =>
  overrides.reduce((acc, curr) => deepMerge(acc, curr), base);

/**
 * Merge configurations with optional options
 * @param {Object} base - Base configuration
 * @param {Object} [overrides] - Override configurations
 * @param {Object} [options] - Merge options
 * @param {boolean} [options.freeze=true] - Whether to freeze result
 * @param {boolean} [options.deep=false] - Whether to deep merge
 * @returns {Object} Merged configuration
 */
export const mergeConfig = (base, overrides, options) => {
  if (base === null || typeof base !== 'object') {
    throw new Error('Defaults must be a valid object');
  }
  const ov = overrides ?? {};
  const shouldFreeze = options?.freeze !== false;
  const shouldDeep = options?.deep !== false;
  const merged = shouldDeep ? deepMerge({ ...base }, ov) : { ...base, ...ov };
  return shouldFreeze ? freeze(merged) : merged;
};

/**
 * Safely get a nested property value
 * @param {Object} obj - Object to get property from
 * @param {string} path - Dot notation path
 * @param {*} defaultValue - Default value if path doesn't exist
 * @returns {*} Property value or default
 */
export const safeGet = (obj, path, defaultValue) => {
  if (!obj || typeof obj !== 'object' || !path) {
    return defaultValue;
  }
  return (
    path.split('.').reduce((current, key) => current?.[key] ?? defaultValue, obj) ?? defaultValue
  );
};

/**
 * Set a nested property value
 * @param {Object} obj - Object to set property on
 * @param {string} path - Dot notation path
 * @param {*} value - Value to set
 */
export const setNestedProperty = (obj, path, value) => {
  if (!obj || typeof path !== 'string') {
    return;
  }

  const keys = path.split('.');
  let current = obj;
  for (const key of keys.slice(0, -1)) {
    current[key] ??= {};
    current = current[key];
  }
  current[keys.at(-1)] = value;
};

/**
 * Deep clone specific properties while shallow cloning the rest
 * @param {Object} obj - Object to clone
 * @param {string[]} deepProps - Properties to deep clone
 * @returns {Object} Cloned object
 */
export function selectiveDeepClone(obj, deepProps = []) {
  const result = { ...obj };
  for (const prop of deepProps) {
    if (obj[prop] !== undefined) {
      result[prop] = deepClone(obj[prop]);
    }
  }
  return result;
}

/**
 * Deep equal comparison
 * @param {*} a - First value
 * @param {*} b - Second value
 * @returns {boolean} True if values are deeply equal
 */
export const deepEqual = (a, b) => {
  if (a === b) {
    return true;
  }
  if (a == null || b == null) {
    return false;
  }
  if (typeof a !== typeof b) {
    return false;
  }
  if (typeof a !== 'object') {
    return false;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  if (Array.isArray(a)) {
    if (a.length !== b.length) {
      return false;
    }
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }
  return true;
};

/**
 * Schema validation used by BaseComponent
 * @param {Object} config - Configuration to validate
 * @param {Object|Function} schema - Validation schema (object or function returning schema)
 * @returns {Object} Validated configuration
 */
export function validateWithSchema(config, schema) {
  if (!schema) {
    return config;
  }

  const resolvedSchema = typeof schema === 'function' ? schema() : schema;
  const result = resolvedSchema.validate(config, {
    stripUnknown: true,
    allowUnknown: false,
    convert: true,
  });

  if (result.error) {
    throw new Error(`Configuration validation failed: ${result.error.message}`);
  }
  return result.value;
}
