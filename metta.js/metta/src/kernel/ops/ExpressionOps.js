/**
 * ExpressionOps.js - Expression operations
 */

import {exp, isExpression, sym} from '../Term.js';

export function registerExpressionOps(registry) {
    // === cons-atom: construct expression from head + tail ===
    registry.register('&cons-atom', (head, tail) => {
        // For list construction compatibility, if tail is an empty list or a list structure, use : (cons) operator
        if (tail?.name === '()' || (tail?.operator?.name === ':' && isExpression(tail))) {
            return exp(sym(':'), [head, tail]);
        }
        // Otherwise, for general expression construction
        if (!isExpression(tail)) {
            return exp(head, [tail]);
        }
        const components = tail.components ? [tail.operator, ...tail.components] : [tail];
        return exp(head, components);
    });

    // === decons-atom: split expression to (head tail) ===
    registry.register('&decons-atom', (expr) => {
        if (!isExpression(expr)) {
            return exp(sym('Error'), [expr, sym('NotExpression')]);
        }
        const head = expr.operator;
        const tail = expr.components?.length
            ? (expr.components.length === 1 ? expr.components[0] : exp(expr.components[0], expr.components.slice(1)))
            : sym('()');
        return exp(sym(':'), [head, tail]);
    });

    // === car-atom: first element ===
    registry.register('&car-atom', (expr) =>
            !isExpression(expr)
                ? exp(sym('Error'), [expr, sym('NotExpression')])
                : expr.operator || exp(sym('Error'), [expr, sym('EmptyExpression')])
        , {lazy: true}); // Prevent reduction of argument

    // === cdr-atom: tail elements ===
    registry.register('&cdr-atom', (expr) => {
        if (!isExpression(expr) || !expr.components?.length) {
            return sym('()');
        }
        return expr.components.length === 1
            ? expr.components[0]
            : exp(expr.components[0], expr.components.slice(1));
    }, {lazy: true}); // Prevent reduction of argument

    // === size-atom: count elements ===
    registry.register('&size-atom', (expr) =>
            isExpression(expr)
                ? sym(String(1 + (expr.components?.length || 0)))
                : sym('1')
        , {lazy: true}); // Prevent reduction of argument

    // === index-atom: get element by index ===
    registry.register('&index-atom', (expr, idx) => {
        const i = parseInt(idx.name);
        if (isNaN(i)) {
            return exp(sym('Error'), [idx, sym('NotANumber')]);
        }
        if (i === 0) {
            return expr.operator || expr;
        }
        const comp = expr.components?.[i - 1];
        return comp || exp(sym('Error'), [idx, sym('OutOfBounds')]);
    });
}