/**
 * LogicalOps.js - Logical operations
 */

import {OperationHelpers} from './OperationHelpers.js';

export function registerLogicalOps(registry) {
    registry.register('&and', (...args) => OperationHelpers.bool(args.every(a => OperationHelpers.truthy(a))));
    registry.register('&or', (...args) => OperationHelpers.bool(args.some(a => OperationHelpers.truthy(a))));
    registry.register('&not', a => OperationHelpers.bool(!OperationHelpers.truthy(a)));
}