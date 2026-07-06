/**
 * ListOps.js - List operations
 */

import {exp, sym} from '../Term.js';
import {OperationHelpers} from './OperationHelpers.js';

export function registerListOps(registry) {
    registry.register('&first', lst => lst?.components?.[0] ?? lst?.[0] ?? null);
    registry.register('&rest', lst => {
        if (Array.isArray(lst)) {
            return lst.slice(1);
        }
        if (lst?.components?.length > 1) {
            return exp(lst.operator, lst.components.slice(1));
        }
        return sym('()');
    });
    registry.register('&empty?', lst => {
        // Only consider the actual empty list symbol () as empty, not expressions with no components
        const empty = lst?.name === '()';
        return OperationHelpers.bool(empty);
    });
}