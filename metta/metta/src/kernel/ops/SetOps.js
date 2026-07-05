/**
 * SetOps.js - Set operations
 */

import {sym} from '../Term.js';
import {OperationHelpers} from './OperationHelpers.js';

export function registerSetOps(registry) {
    const toSet = (expr) => new Set(OperationHelpers.flattenExpr(expr).map(x => x.toString()));
    const toKey = (x) => x.toString();

    registry.register('&unique-atom', (expr) => {
        const seen = new Set();
        const result = OperationHelpers.flattenExpr(expr).filter(el => {
            const key = toKey(el);
            if (seen.has(key)) {
                return false;
            }
            seen.add(key);
            return true;
        });
        return OperationHelpers.listify(result);
    });

    registry.register('&union-atom', (a, b) =>
        OperationHelpers.listify([...OperationHelpers.flattenExpr(a), ...OperationHelpers.flattenExpr(b)])
    );

    registry.register('&intersection-atom', (a, b) => {
        const setB = toSet(b);
        return OperationHelpers.listify(OperationHelpers.flattenExpr(a).filter(x => setB.has(toKey(x))));
    });

    registry.register('&subtraction-atom', (a, b) => {
        const setB = toSet(b);
        return OperationHelpers.listify(OperationHelpers.flattenExpr(a).filter(x => !setB.has(toKey(x))));
    });

    // BEYOND PARITY
    registry.register('&symmetric-diff-atom', (a, b) => {
        const setA = toSet(a);
        const setB = toSet(b);
        const result = [
            ...OperationHelpers.flattenExpr(a).filter(x => !setB.has(toKey(x))),
            ...OperationHelpers.flattenExpr(b).filter(x => !setA.has(toKey(x)))
        ];
        return OperationHelpers.listify(result);
    });

    registry.register('&is-subset', (a, b) => {
        const setB = toSet(b);
        return OperationHelpers.bool(OperationHelpers.flattenExpr(a).every(x => setB.has(toKey(x))));
    });

    registry.register('&set-size', (expr) => sym(String(toSet(expr).size)));
}