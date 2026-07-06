/**
 * OperationHelpers.js - Shared helper functions
 */

import {constructList, exp, flattenList, isExpression, isList, sym} from '../Term.js';

export class OperationHelpers {
    /**
     * Create an Error atom
     */
    static error(term, message) {
        return exp(sym('Error'), [term, sym(message)]);
    }

    /**
     * Convert an atom to a number
     */
    static atomToNum(atom) {
        if (typeof atom === 'number') {
            return atom;
        }
        if (atom?.name) {
            const num = parseFloat(atom.name);
            return isNaN(num) ? null : num;
        }
        return null;
    }

    /**
     * Require numeric arguments
     */
    static requireNums(args, count = null) {
        if (count !== null && args.length !== count) {
            throw new Error(`Expected ${count} args`);
        }
        const nums = args.map(a => OperationHelpers.atomToNum(a));
        if (nums.some(n => n === null)) {
            throw new Error("Expected numbers");
        }
        return nums;
    }

    /**
     * Convert a boolean value to a symbolic representation
     */
    static bool(val) {
        return sym(val ? 'True' : 'False');
    }

    /**
     * Determine the truthiness of a value
     */
    static truthy(val) {
        if (!val) {
            return false;
        }
        if (!val.name) {
            return Boolean(val);
        }

        const name = val.name.toLowerCase();
        if (['false', 'null', 'nil'].includes(name)) {
            return false;
        }
        if (name === 'true') {
            return true;
        }

        const num = parseFloat(val.name);
        return !isNaN(num) ? num !== 0 : true;
    }

    /**
     * Flatten an expression to an array of its components
     */
    static flattenExpr(expr) {
        // Early return for empty list symbol to prevent it being included in results
        if (!expr || expr.name === '()') {
            return [];
        }
        if (!isExpression(expr)) {
            return [expr];
        }

        // Special handling for list structure (: head tail)
        if (isList(expr)) {
            const {elements, tail} = flattenList(expr);
            // Recursively flatten tail for improper lists
            const tailItems = OperationHelpers.flattenExpr(tail);
            return [...elements, ...tailItems];
        }

        // For other expressions, flatten all parts
        const result = [];
        if (expr.operator) {
            result.push(expr.operator);
        }
        if (expr.components) {
            for (const comp of expr.components) {
                if (comp.name !== '()') {
                    result.push(...OperationHelpers.flattenExpr(comp));
                }
            }
        }
        return result;
    }

    /**
     * Convert an array to a list representation
     */
    static listify(arr) {
        return arr && arr.length ? constructList(arr, sym('()')) : sym('()');
    }

    /**
     * Check if an atom represents a list
     */
    static isList(atom) {
        return isList(atom) || atom?.name === '()';
    }
}