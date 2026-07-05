/**
 * BudgetOps.js - Budget operations
 */

import {OperationHelpers} from './OperationHelpers.js';
import {Term} from '../Term.js';

export function registerBudgetOps(registry) {
    // Helper function for binary numeric operations
    const binaryNumOp = fn => (a, b) => {
        const [x, y] = OperationHelpers.requireNums([a, b], 2);
        return Term.sym(String(fn(x, y)));
    };

    // Budget priority operations
    registry.register('&or-priority', binaryNumOp(Math.max));
    registry.register('&and-priority', binaryNumOp((a, b) => (a + b) / 2)); // Average for AND
    registry.register('&max', binaryNumOp(Math.max));
    registry.register('&min', binaryNumOp(Math.min));

    // Conditional for clamping
    registry.register('&if', (cond, thenVal, elseVal) =>
        OperationHelpers.truthy(cond) ? thenVal : elseVal
    );
}