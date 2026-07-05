/**
 * HOFOps.js - Higher-order function operations
 */

export function registerHOFOps(registry) {
    // Placeholder implementations - will be overridden by MeTTaInterpreter with interpreter context
    // These are fallback implementations that throw errors if called without interpreter context

    registry.register('map-atom-fast', (list, varName, transformFn) => {
        throw new Error('map-atom-fast requires interpreter context');
    }, {lazy: true});

    registry.register('filter-atom-fast', (list, varName, predFn) => {
        throw new Error('filter-atom-fast requires interpreter context');
    }, {lazy: true});

    registry.register('foldl-atom-fast', (list, init, aVar, bVar, opFn) => {
        throw new Error('foldl-atom-fast requires interpreter context');
    }, {lazy: true});
}