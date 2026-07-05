/**
 * ComparisonOps.js - Comparison operations
 */

import {OperationHelpers} from './OperationHelpers.js';

export function registerComparisonOps(registry) {
    // Register numeric comparison operations
    registry.register('&<', createNumericComparisonOp((a, b) => a < b));
    registry.register('&>', createNumericComparisonOp((a, b) => a > b));
    registry.register('&<=', createNumericComparisonOp((a, b) => a <= b));
    registry.register('&>=', createNumericComparisonOp((a, b) => a >= b));

    // Register equality operations
    registry.register('&==', createEqualityOp(true));
    registry.register('&!=', createEqualityOp(false));
}

/**
 * Create a numeric comparison operation
 */
function createNumericComparisonOp(fn) {
    return (...args) => {
        const [a, b] = OperationHelpers.requireNums(args, 2);
        return OperationHelpers.bool(fn(a, b));
    };
}

/**
 * Create an equality operation
 */
function createEqualityOp(isEqual) {
    return (a, b) => {
        const eqCheck = (x, y) => x?.equals ? x.equals(y) : x === y;
        const result = isEqual ? eqCheck(a, b) : !eqCheck(a, b);
        return OperationHelpers.bool(result);
    };
}