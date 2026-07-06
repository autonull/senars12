/**
 * Validation utilities for SeNARS
 */

import { Logger } from './Logger.js';
import { ValidationError } from '../errors/index.js';

/**
 * Validate required value
 * @param {*} value - Value to check
 * @param {string} fieldName - Field name for error message
 * @throws {ValidationError} If value is null or undefined
 */
export const validateRequired = (value, fieldName) => {
    if (value == null) {throw new ValidationError(`${fieldName} is required`, fieldName, value);}
};

/**
 * Validate type
 * @param {*} value - Value to check
 * @param {string} expectedType - Expected type
 * @param {string} fieldName - Field name for error message
 * @param {boolean} optional - Whether value is optional
 * @throws {ValidationError} If type doesn't match
 */
export const validateType = (value, expectedType, fieldName, optional = false) => {
    if (optional && value === undefined) {return;}
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    if (actualType !== expectedType) {
        throw new ValidationError(`${fieldName} must be of type ${expectedType}, got ${actualType}`, fieldName, value);
    }
};

/**
 * Validate number range
 * @param {number} value - Value to check
 * @param {Object} options - Range options
 * @param {number} options.min - Minimum value
 * @param {number} options.max - Maximum value
 * @param {string} fieldName - Field name for error message
 * @param {boolean} optional - Whether value is optional
 * @throws {ValidationError} If value is out of range
 */
export const validateRange = (value, { min, max }, fieldName, optional = false) => {
    if (optional && value === undefined) {return;}
    if (typeof value !== 'number' || isNaN(value)) {
        throw new ValidationError(`${fieldName} must be a number`, fieldName, value);
    }
    if (min !== undefined && value < min) {throw new ValidationError(`${fieldName} must be >= ${min}`, fieldName, value);}
    if (max !== undefined && value > max) {throw new ValidationError(`${fieldName} must be <= ${max}`, fieldName, value);}
};

/**
 * Validate string pattern
 * @param {string} value - Value to check
 * @param {RegExp} pattern - Pattern to match
 * @param {string} fieldName - Field name for error message
 * @param {boolean} optional - Whether value is optional
 * @throws {ValidationError} If pattern doesn't match
 */
export const validatePattern = (value, pattern, fieldName, optional = false) => {
    if (optional && value === undefined) {return;}
    if (typeof value !== 'string') {throw new ValidationError(`${fieldName} must be a string`, fieldName, value);}
    if (!pattern.test(value)) {throw new ValidationError(`${fieldName} must match pattern ${pattern}`, fieldName, value);}
};

/**
 * Validate array items
 * @param {Array} value - Array to check
 * @param {Function} validator - Item validator function
 * @param {string} fieldName - Field name for error message
 * @param {boolean} optional - Whether value is optional
 * @throws {ValidationError} If any item is invalid
 */
export const validateArray = (value, validator, fieldName, optional = false) => {
    if (optional && value === undefined) {return;}
    if (!Array.isArray(value)) {throw new ValidationError(`${fieldName} must be an array`, fieldName, value);}

    for (const [i, item] of value.entries()) {
        try {
            validator(item);
        } catch (error) {
            throw new ValidationError(`${fieldName}[${i}] is invalid: ${error.message}`, `${fieldName}[${i}]`, item);
        }
    }
};

/**
 * Validate string length
 * @param {string} value - String to check
 * @param {Object} options - Length options
 * @param {number} options.minLength - Minimum length
 * @param {number} options.maxLength - Maximum length
 * @param {string} fieldName - Field name for error message
 * @param {boolean} optional - Whether value is optional
 * @throws {ValidationError} If length is invalid
 */
export const validateLength = (value, { minLength, maxLength }, fieldName, optional = false) => {
    if (optional && value === undefined) {return;}
    if (typeof value !== 'string') {throw new ValidationError(`${fieldName} must be a string`, fieldName, value);}
    if (minLength !== undefined && value.length < minLength) {
        throw new ValidationError(`${fieldName} must have at least ${minLength} characters`, fieldName, value);
    }
    if (maxLength !== undefined && value.length > maxLength) {
        throw new ValidationError(`${fieldName} must have at most ${maxLength} characters`, fieldName, value);
    }
};

/**
 * Validate enum value
 * @param {*} value - Value to check
 * @param {Array} allowedValues - Allowed values
 * @param {string} fieldName - Field name for error message
 * @param {boolean} optional - Whether value is optional
 * @throws {ValidationError} If value is not in enum
 */
export const validateEnum = (value, allowedValues, fieldName, optional = false) => {
    if (optional && value === undefined) {return;}
    if (!allowedValues.includes(value)) {
        throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}`, fieldName, value);
    }
};

/**
 * Validate object against schema
 * @param {Object} obj - Object to validate
 * @param {Object} schema - Validation schema
 * @param {string} context - Context for error messages
 * @returns {Object} Validated object
 * @throws {ValidationError} If validation fails
 */
export function validateSchema(obj, schema, context = 'validation') {
    if (obj == null) {throw new ValidationError('Options object is required', 'options', obj);}
    if (typeof obj !== 'object' || Array.isArray(obj)) {throw new ValidationError('Options must be an object', 'options', obj);}

    const validated = {};
    for (const [field, rules] of Object.entries(schema)) {
        const value = obj[field];

        if (rules.required && !rules.optional && value == null) {
            throw new ValidationError(`${context}: ${field} is required`, field, value);
        }
        if (value === undefined && rules.optional) {continue;}

        if (value == null) {
            if (rules.default !== undefined) {
                validated[field] = rules.default;
                continue;
            }
        }

        if (value !== undefined && rules.type) {
            try {
                validateType(value, rules.type, field, rules.optional);
            } catch (error) {
                throw new ValidationError(`${context}: ${error.message}`, field, value);
            }
        }

        if (value !== undefined && rules.type === 'number' && (rules.min !== undefined || rules.max !== undefined)) {
            try {
                validateRange(value, { min: rules.min, max: rules.max }, field, rules.optional);
            } catch (error) {
                throw new ValidationError(`${context}: ${error.message}`, field, value);
            }
        }

        if (value !== undefined && (typeof value === 'string' || Array.isArray(value))) {
            if (rules.minLength !== undefined && value.length < rules.minLength) {
                throw new ValidationError(
                    `${context}: ${field} must have at least ${rules.minLength} characters/elements`,
                    field,
                    { minLength: rules.minLength, length: value.length, value }
                );
            }
            if (rules.maxLength !== undefined && value.length > rules.maxLength) {
                throw new ValidationError(
                    `${context}: ${field} must have at most ${rules.maxLength} characters/elements`,
                    field,
                    { maxLength: rules.maxLength, length: value.length, value }
                );
            }
        }

        if (value !== undefined && rules.validator && typeof rules.validator === 'function' && !rules.validator(value)) {
            throw new ValidationError(`${context}: ${field} failed custom validation`, field, value);
        }

        validated[field] = value;
    }
    return validated;
}

/**
 * Validates parameters against JSON Schema format
 * @param {Object} params - Parameters to validate
 * @param {Object} schema - JSON Schema
 * @param {string} context - Context for error messages
 * @returns {Object} Validation result with isValid and errors
 */
export function validateJsonSchema(params, schema, context = 'validation') {
    if (!schema || typeof schema !== 'object') {return { isValid: true, errors: [] };}

    const errors = [];
    const { properties = {}, required = [] } = schema;

    for (const fieldName of required) {
        if (!(fieldName in params) || params[fieldName] == null) {
            errors.push(`${context}: Missing required parameter '${fieldName}'`);
        }
    }

    for (const [fieldName, propSchema] of Object.entries(properties)) {
        const value = params[fieldName];
        if (!(fieldName in params)) {continue;}

        if (propSchema.type) {
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== propSchema.type) {
                errors.push(`${context}: Parameter '${fieldName}' must be of type ${propSchema.type}, got ${actualType}`);
            }
        }

        if (Array.isArray(propSchema.enum) && !propSchema.enum.includes(value)) {
            errors.push(`${context}: Parameter '${fieldName}' must be one of: ${propSchema.enum.join(', ')}`);
        }

        if (typeof value === 'number') {
            if (propSchema.minimum !== undefined && value < propSchema.minimum) {
                errors.push(`${context}: Parameter '${fieldName}' must be >= ${propSchema.minimum}`);
            }
            if (propSchema.maximum !== undefined && value > propSchema.maximum) {
                errors.push(`${context}: Parameter '${fieldName}' must be <= ${propSchema.maximum}`);
            }
        }

        if (typeof value === 'string') {
            if (propSchema.minLength !== undefined && value.length < propSchema.minLength) {
                errors.push(`${context}: Parameter '${fieldName}' must have at least ${propSchema.minLength} characters`);
            }
            if (propSchema.maxLength !== undefined && value.length > propSchema.maxLength) {
                errors.push(`${context}: Parameter '${fieldName}' must have at most ${propSchema.maxLength} characters`);
            }
        }

        if (typeof value === 'string' && propSchema.pattern && !new RegExp(propSchema.pattern).test(value)) {
            errors.push(`${context}: Parameter '${fieldName}' must match pattern ${propSchema.pattern}`);
        }
    }

    return { isValid: errors.length === 0, errors };
}

/**
 * Create a validator with context
 * @param {string} context - Context for error messages
 * @returns {Object} Validator utilities
 */
export function createValidator(context) {
    return {
        required: (value, fieldName) => validateRequired(value, `${context}.${fieldName}`),
        type: (value, expectedType, fieldName, optional = false) =>
            validateType(value, expectedType, `${context}.${fieldName}`, optional),
        range: (value, options, fieldName, optional = false) =>
            validateRange(value, options, `${context}.${fieldName}`, optional),
        pattern: (value, pattern, fieldName, optional = false) =>
            validatePattern(value, pattern, `${context}.${fieldName}`, optional),
        length: (value, options, fieldName, optional = false) =>
            validateLength(value, options, `${context}.${fieldName}`, optional),
        enum: (value, allowedValues, fieldName, optional = false) =>
            validateEnum(value, allowedValues, `${context}.${fieldName}`, optional),
        array: (value, validator, fieldName, optional = false) =>
            validateArray(value, validator, `${context}.${fieldName}`, optional),
        schema: (obj, schemaDef) => validateSchema(obj, schemaDef, context),
        jsonSchema: (params, schemaDef) => validateJsonSchema(params, schemaDef, context)
    };
}

/**
 * Log validation error
 * @param {ValidationError} error - Validation error
 * @param {string} context - Context for logging
 */
export const logValidationError = (error, context = 'validation') => {
    Logger.error(`[${context}] Validation failed: ${error.message}`, {
        field: error.field,
        value: error.value,
        timestamp: error.timestamp
    });
};

/**
 * Compose multiple validators
 * @param  {...Function} validators - Validator functions
 * @returns {Function} Composed validator
 */
export const composeValidators = (...validators) => (value, fieldName) => {
    for (const validator of validators) {validator(value, fieldName);}
};

/**
 * Create optional validator
 * @param {Function} validator - Validator to wrap
 * @returns {Function} Optional validator
 */
export const optional = (validator) => (value, fieldName) => {
    if (value == null) {return;}
    validator(value, fieldName);
};

/**
 * Create nullable validator
 * @param {Function} validator - Validator to wrap
 * @returns {Function} Nullable validator
 */
export const nullable = (validator) => (value, fieldName) => {
    if (value === null) {return;}
    validator(value, fieldName);
};

/**
 * Create array validator with item validator
 * @param {Function} itemValidator - Item validator
 * @returns {Function} Array validator
 */
export const arrayOf = (itemValidator) => (value, fieldName) => validateArray(value, itemValidator, fieldName);

/**
 * Validate without throwing, returns result object
 * @param {Function} validator - Validator function
 * @param {*} value - Value to validate
 * @param {string} fieldName - Field name
 * @returns {Object} Validation result
 */
export function validateSafe(validator, value, fieldName = 'value') {
    try {
        validator(value, fieldName);
        return { isValid: true, errors: [] };
    } catch (error) {
        return { isValid: false, errors: [error.message], error };
    }
}
