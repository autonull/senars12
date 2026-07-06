/**
 * FastPaths.js - Optimized Type Guards
 * Q2: Monomorphic type checks for V8 inline caching
 *
 * Key optimization: Pre-computed type tags enable fast dispatch
 * V8 can inline these checks and cache the results
 */

import {configManager} from '../config/config.js';

// Type tag constants for fast dispatch
export const TYPE_SYMBOL = 1;
export const TYPE_VARIABLE = 2;
export const TYPE_EXPRESSION = 3;
export const TYPE_GROUNDED = 4;

// Compiled regex for variable name detection (shared across all checks)
const VARIABLE_NAME_REGEX = /^[?$]/;

/**
 * Helper: Check if a name represents a variable
 * Extracted as shared function to avoid regex recompilation
 */
export function isVariableName(name) {
    return VARIABLE_NAME_REGEX.test(name);
}

/**
 * Get type tag from term
 * Uses pre-computed _typeTag if available, otherwise computes from type string
 *
 * @param {object} term - MeTTa term
 * @returns {number} Type tag constant
 */
export function getTypeTag(term) {
    if (!term) {
        return 0;
    }

    // Fast path: pre-computed type tag (Q3: stable shapes)
    if (term._typeTag !== undefined) {
        return term._typeTag;
    }

    // Fallback: compute from type string (backward compatibility)
    if (term.type === 'atom') {
        if (!term.operator) {
            // Symbol or variable - check name
            return isVariableName(term.name) ? TYPE_VARIABLE : TYPE_SYMBOL;
        }
        // Has operator but is atom type - treat as variable
        return TYPE_VARIABLE;
    }

    if (term.type === 'compound') {
        return TYPE_EXPRESSION;
    }

    if (term.type === 'grounded') {
        return TYPE_GROUNDED;
    }

    return 0;
}

/**
 * Type guard: is symbol?
 * Monomorphic fast path for V8 optimization
 */
export function isSymbol(term) {
    if (!configManager.get('fastPaths')) {
        // Optimization disabled - use legacy check
        return term?.type === 'atom' && !term.operator && !isVariableName(term.name);
    }

    // Fast path: type tag comparison (integer comparison, ~1 CPU cycle)
    const tag = getTypeTag(term);
    return tag === TYPE_SYMBOL;
}

/**
 * Type guard: is variable?
 */
export function isVariable(term) {
    if (!configManager.get('fastPaths')) {
        return term?.type === 'atom' && isVariableName(term.name);
    }

    const tag = getTypeTag(term);
    return tag === TYPE_VARIABLE;
}

/**
 * Type guard: is expression?
 */
export function isExpression(term) {
    if (!configManager.get('fastPaths')) {
        return term?.type === 'compound';
    }

    const tag = getTypeTag(term);
    return tag === TYPE_EXPRESSION;
}

/**
 * Type guard: is grounded?
 */
export function isGrounded(term) {
    if (!configManager.get('fastPaths')) {
        return term?.type === 'grounded';
    }

    const tag = getTypeTag(term);
    return tag === TYPE_GROUNDED;
}

/**
 * Branch hint: mark likely condition
 * Helps V8 optimize branch prediction
 * (In practice, V8 does this automatically, but explicit hints can help)
 */
export function LIKELY(cond) {
    return cond;
}

/**
 * Branch hint: mark unlikely condition
 */
export function UNLIKELY(cond) {
    return cond;
}
