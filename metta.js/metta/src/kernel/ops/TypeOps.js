/**
 * TypeOps.js - Type operations
 */

import {isExpression, isVariable, sym} from '../Term.js';
import {TYPE_GROUNDED, TYPE_VARIABLE} from '../FastPaths.js';

import {OperationHelpers} from './OperationHelpers.js';

const GROUNDED_OPS = new Set(['+', '-', '*', '/', '%', '<', '>', '<=', '>=', '==', '!=',
    'pow-math', 'sqrt-math', 'abs-math', 'log-math', 'sin-math', 'cos-math', 'tan-math',
    'asin-math', 'acos-math', 'atan-math', 'ceil-math', 'floor-math', 'round-math',
    'trunc-math', 'isnan-math', 'isinf-math', 'min-atom', 'max-atom', 'min', 'max', 'exp']);

const isNumberStr = (s) => s != null && /^-?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s);

export function registerTypeOps(registry) {
    // Get metatype of an atom
    registry.register('&get-metatype', (atom) => {
        if (!atom) {
            return sym('%Undefined%');
        }
        // Check _typeTag first (most reliable)
        if (atom._typeTag === TYPE_VARIABLE || isVariable(atom)) {
            return sym('Variable');
        }
        if (atom._typeTag === TYPE_GROUNDED || typeof atom.execute === 'function') {
            return sym('Grounded');
        }
        if (isExpression(atom)) {
            return sym('Expression');
        }
        // Numbers are Grounded in PeTTa
        if (isNumberStr(atom.name)) {
            return sym('Grounded');
        }
        // Known grounded operators
        if (GROUNDED_OPS.has(atom.name)) {
            return sym('Grounded');
        }
        return sym('Symbol');
    }, {lazy: true}); // Prevent reduction to check actual metatype

    // Check if type is a function type (has -> arrow)
    registry.register('&is-function', (type) => {
        if (!isExpression(type)) {
            return sym('False');
        }
        return OperationHelpers.bool(type.operator?.name === '->');
    });

    // Existing type operations
    registry.register('&type-infer', (t, i) => i?.typeChecker ? sym(i.typeChecker.typeToString(i.typeChecker.infer(t, {}))) : sym('Unknown'));
    registry.register('&type-check', (t, e, i) => OperationHelpers.bool(i?.typeChecker?.check(t, e, {})));
    registry.register('&type-unify', (t1, t2, i) => sym(i?.typeChecker?.unify(t1, t2) ? 'Success' : 'Failure'));
}