/**
 * IntrospectionOps.js - Introspection operations
 */

import {sym} from '../Term.js';

export function registerIntrospectionOps(registry) {
    const sti = new Map();
    registry.register('&get-sti', a => sym(String(sti.get(a.toString()) || 0)));
    registry.register('&set-sti', (a, v) => {
        const n = parseFloat(v?.name) || 0;
        sti.set(a.toString(), n);
        return v;
    });
    registry.register('&system-stats', () => ({
        type: 'atom', name: 'Stats', toString: () => `(Stats :sti-count ${sti.size})`
    }));
}