/**
 * MathOps.js - Mathematical operations
 */

import {exp, sym} from '../Term.js';
import {OperationHelpers} from './OperationHelpers.js';

export function registerMathOps(registry) {
    const toNum = (atom) => parseFloat(atom?.name) || 0;
    const toSym = (n) => sym(String(Number.isInteger(n) ? n : n.toFixed(12).replace(/\.?0+$/, '')));
    const unary = (fn) => (x) => toSym(fn(toNum(x)));
    const binary = (fn) => (a, b) => toSym(fn(toNum(a), toNum(b)));

    // Transcendental functions
    Object.entries({
        '&pow-math': Math.pow,
        '&log-math': (base, x) => Math.log(x) / Math.log(base)
    }).forEach(([name, fn]) => registry.register(name, binary(fn)));

    Object.entries({
        '&sqrt-math': Math.sqrt,
        '&abs-math': Math.abs
    }).forEach(([name, fn]) => registry.register(name, unary(fn)));

    // Rounding functions
    Object.entries({
        '&trunc-math': Math.trunc,
        '&ceil-math': Math.ceil,
        '&floor-math': Math.floor,
        '&round-math': Math.round
    }).forEach(([name, fn]) => registry.register(name, unary(fn)));

    // Trigonometry
    Object.entries({
        '&sin-math': Math.sin,
        '&asin-math': Math.asin,
        '&cos-math': Math.cos,
        '&acos-math': Math.acos,
        '&tan-math': Math.tan,
        '&atan-math': Math.atan
    }).forEach(([name, fn]) => registry.register(name, unary(fn)));

    // Validation
    registry.register('&isnan-math', (x) => {
        const n = parseFloat(x?.name);
        return OperationHelpers.bool(isNaN(n));
    });
    registry.register('&isinf-math', (x) => {
        const n = parseFloat(x?.name);
        return OperationHelpers.bool(!isFinite(n) && !isNaN(n));
    });

    // Aggregate operations
    const aggregateOp = (fn, errLabel) => (expr) => {
        const elements = OperationHelpers.flattenExpr(expr);
        const nums = elements.map(toNum).filter(n => !Number.isNaN(n));
        if (nums.length === 0) {
            return exp(sym('Error'), [expr, sym(errLabel)]);
        }
        return toSym(fn(...nums));
    };

    registry.register('&min-atom', aggregateOp((...nums) => Math.min(...nums), 'EmptyOrNonNumeric'));
    registry.register('&max-atom', aggregateOp((...nums) => Math.max(...nums), 'EmptyOrNonNumeric'));
    registry.register('&sum-atom', (expr) => {
        const elements = OperationHelpers.flattenExpr(expr);
        const sum = elements.reduce((s, e) => s + toNum(e), 0);
        return toSym(sum);
    });
}