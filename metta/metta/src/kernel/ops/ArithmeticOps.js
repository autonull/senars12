/**
 * ArithmeticOps.js - Arithmetic operations
 */

import {exp, flattenList, isExpression, isList, sym} from '../Term.js';
import {OperationHelpers} from './OperationHelpers.js';

// Format a number for output, preserving float format when needed
const fmtNum = (n) => String(n);
// Format as always-float (e.g. sqrt result): if integer, add .0
const fmtFloat = (n) => Number.isInteger(n) ? n + '.0' : String(n);
// Format as integer-truncated
const fmtInt = (n) => String(Math.trunc(n));

export function registerArithmeticOps(registry) {
    // Register basic arithmetic operations
    registry.register('&+', createReduceOp((a, b) => a + b, 0));
    registry.register('&*', createReduceOp((a, b) => a * b, 1));
    registry.register('&%', createBinaryOp((a, b) => a % b, true)); // Check division by zero

    // Custom logic for - and / to handle unary/binary
    registry.register('&-', createUnaryBinaryOp(x => -x, (a, b) => a - b));
    registry.register('&/', createUnaryBinaryOp(x => 1 / x, (a, b) => a / b, true));

    // Math functions - these always return float format when applicable
    const mathUnary = (fn, floatResult = true) => (...args) => {
        try {
            const [a] = OperationHelpers.requireNums(args, 1);
            const r = fn(a);
            return sym(floatResult ? fmtFloat(r) : fmtNum(r));
        } catch (e) {
            return OperationHelpers.error(exp(sym('^'), [sym('args'), ...args]), e.message);
        }
    };
    const mathBinary = (fn, floatResult = true) => (...args) => {
        try {
            const [a, b] = OperationHelpers.requireNums(args, 2);
            const r = fn(a, b);
            return sym(floatResult ? fmtFloat(r) : fmtNum(r));
        } catch (e) {
            return OperationHelpers.error(exp(sym('^'), [sym('args'), ...args]), e.message);
        }
    };

    registry.register('pow-math', mathBinary((a, b) => Math.pow(a, b), false));
    registry.register('sqrt-math', mathUnary(Math.sqrt));
    registry.register('abs-math', mathUnary(Math.abs, false));
    registry.register('log-math', mathBinary((base, x) => Math.log(x) / Math.log(base)));
    registry.register('sin-math', mathUnary(Math.sin));
    registry.register('cos-math', mathUnary(Math.cos));
    registry.register('tan-math', mathUnary(Math.tan));
    registry.register('asin-math', mathUnary(Math.asin));
    registry.register('acos-math', mathUnary(Math.acos));
    registry.register('atan-math', mathUnary(Math.atan));
    registry.register('trunc-math', mathUnary(n => Math.trunc(n), false));
    registry.register('ceil-math', mathUnary(Math.ceil, false));
    registry.register('floor-math', mathUnary(Math.floor, false));
    registry.register('round-math', mathUnary(Math.round, false));
    registry.register('isnan-math', (...args) => {
        try { const [a] = OperationHelpers.requireNums(args, 1); return sym(isNaN(a) ? 'True' : 'False'); } catch { return sym('False'); }
    });
    registry.register('isinf-math', (...args) => {
        try { const [a] = OperationHelpers.requireNums(args, 1); return sym(!isFinite(a) && !isNaN(a) ? 'True' : 'False'); } catch { return sym('False'); }
    });

    // min-atom / max-atom: operate on a list expression
    const getListElements = (list) => {
        if (isList(list)) return flattenList(list).elements;
        if (isExpression(list)) return [list.operator, ...(list.components ?? [])];
        return null;
    };

    registry.register('min-atom', (list) => {
        const elements = getListElements(list);
        if (!elements) return list;
        const nums = elements.map(e => OperationHelpers.atomToNum(e)).filter(n => n !== null);
        if (!nums.length) return list;
        return sym(fmtNum(Math.min(...nums)));
    }, {lazy: true});

    registry.register('max-atom', (list) => {
        const elements = getListElements(list);
        if (!elements) return list;
        const nums = elements.map(e => OperationHelpers.atomToNum(e)).filter(n => n !== null);
        if (!nums.length) return list;
        return sym(fmtNum(Math.max(...nums)));
    }, {lazy: true});

    registry.register('min', mathBinary(Math.min, false));
    registry.register('max', mathBinary(Math.max, false));
    registry.register('exp', mathUnary(Math.exp));
}

/**
 * Create a reduction operation that applies a function cumulatively
 */
function createReduceOp(fn, init) {
    return (...args) => {
        if (args.length === 0) {
            return sym(String(init));
        }
        try {
            const nums = OperationHelpers.requireNums(args);
            return sym(String(nums.reduce(fn, init === undefined ? nums.shift() : init)));
        } catch (e) {
            return OperationHelpers.error(exp(sym('^'), [sym('args'), ...args]), e.message);
        }
    };
}

/**
 * Create a binary operation that takes exactly two arguments
 */
function createBinaryOp(fn, checkZero = false) {
    return (...args) => {
        try {
            const [a, b] = OperationHelpers.requireNums(args, 2);
            if (checkZero && b === 0) {
                return OperationHelpers.error(exp(sym('^'), [sym('args'), ...args]), "Division by zero");
            }
            return sym(String(fn(a, b)));
        } catch (e) {
            return OperationHelpers.error(exp(sym('^'), [sym('args'), ...args]), e.message);
        }
    };
}

/**
 * Create an operation that can handle both unary and binary cases
 */
function createUnaryBinaryOp(unaryFn, binaryFn, checkZero = false) {
    return (...args) => {
        try {
            const nums = OperationHelpers.requireNums(args);
            if (nums.length === 1) {
                return sym(String(unaryFn(nums[0])));
            }
            if (nums.length === 2) {
                if (checkZero && nums[1] === 0) {
                    return OperationHelpers.error(exp(sym('^'), [sym('args'), ...args]), "Division by zero");
                }
                return sym(String(binaryFn(nums[0], nums[1])));
            }
            return OperationHelpers.error(exp(sym('^'), [sym('args'), ...args]), "Operation requires 1 or 2 args");
        } catch (e) {
            return OperationHelpers.error(exp(sym('^'), [sym('args'), ...args]), e.message);
        }
    };
}