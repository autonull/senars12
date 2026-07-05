/**
 * Configuration utilities for SeNARS
 */

import { safeGet, setNestedProperty, mergeConfig } from '../util/object.js';
import { ConfigurationError, ValidationError } from '../errors/index.js';
import { validateSchema } from '../util/validate.js';
import { ConfigManager as BaseConfigManager } from './ConfigManager.js';

// Re-export for backward compatibility
export { mergeConfig };

/**
 * Validate config using a schema validator function
 * @param {Object} config - Config to validate
 * @param {Function} schemaValidator - Validator function
 * @returns {Object} Validated config
 */
export function validateConfigWith(config, schemaValidator) {
    if (typeof schemaValidator !== 'function') {
        throw new ConfigurationError('Schema validator must be a function', { key: 'validator' });
    }
    try {
        return schemaValidator(config);
    } catch (error) {
        throw new ConfigurationError(`Configuration validation failed: ${error.message}`, { key: 'config' });
    }
}

export function getConfigValue(config, path, defaultValue = undefined) {
    return safeGet(config, path, defaultValue);
}

export function setConfigValue(config, path, value) {
    if (!config || typeof config !== 'object') {
        throw new ConfigurationError('Configuration must be a valid object', { key: 'config' });
    }
    setNestedProperty(config, path, value);
    return config;
}

export function createTypedConfig(config, types = {}) {
    const typedConfig = {};
    for (const [key, { type, default: defaultValue, validator: valFn, required = false }] of Object.entries(types)) {
        Object.defineProperty(typedConfig, key, {
            get: () => {
                let value = getConfigValue(config, key, defaultValue);
                if (required && (value == null)) {
                    throw new ValidationError(`Required configuration field '${key}' is missing`, { field: key, value });
                }
                if (type && value != null && typeof value !== type) {
                    Logger.warn(`Config type mismatch for ${key}: expected ${type}, got ${typeof value}`);
                    value = defaultValue;
                }
                if (valFn && value != null && !valFn(value)) {
                    Logger.warn(`Config validation failed for ${key}`);
                    value = defaultValue;
                }
                return value;
            },
            enumerable: true,
            configurable: false
        });
    }
    return typedConfig;
}

export function validateAgainstSchema(config, schema) {
    return validateSchema(config, schema, 'Configuration');
}

export { BaseConfigManager as ConfigManager };

/**
 * @deprecated Use Validators from '@senars/core/config/ConfigManager.js' instead.
 */
export const LegacyValidators = {
    positive: (v) => typeof v === 'number' && v > 0,
    nonNegative: (v) => typeof v === 'number' && v >= 0,
    boolean: (v) => typeof v === 'boolean',
    string: (v) => typeof v === 'string' && v.length > 0,
    integer: (v) => Number.isInteger(v),
    range: (min, max) => (v) => typeof v === 'number' && v >= min && v <= max,
    oneOf: (...values) => (v) => values.includes(v),
};

/**
 * @deprecated Use createConfigManager from '@senars/core/config/ConfigManager.js' instead.
 */
export function createLegacyConfigManager(options = {}) {
    return new BaseConfigManager(options);
}
