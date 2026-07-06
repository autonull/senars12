/**
 * MetaprogrammingOps.js - Metaprogramming operations
 */

import {constructList, exp, isExpression, sym} from '../Term.js';

export function registerMetaprogrammingOps(registry) {
    // These operations require access to the Space, provided via interpreter context
    // They will be overridden by Interpreter to provide actual space access

    registry.register('&add-rule', (pattern, result, interp) => {
        if (!interp?.space) {
            throw new Error('&add-rule requires interpreter context');
        }
        interp.space.add(exp(sym('='), [pattern, result]));
        return sym('ok');
    });

    registry.register('&remove-rule', (pattern, interp) => {
        if (!interp?.space) {
            throw new Error('&remove-rule requires interpreter context');
        }
        // Find and remove matching rules
        const removed = interp.space.remove(pattern);
        return sym(removed ? 'ok' : 'not-found');
    });

    registry.register('&get-rules-for', (pattern, interp) => {
        if (!interp?.space) {
            throw new Error('&get-rules-for requires interpreter context');
        }
        // Query space for rules matching pattern
        const rules = interp.space.query(pattern) || [];
        return constructList(rules.map(r => r), sym('()'));
    });

    registry.register('&list-all-rules', (interp) => {
        if (!interp?.space) {
            throw new Error('&list-all-rules requires interpreter context');
        }
        const allAtoms = Array.from(interp.space.atoms || []);
        const rules = allAtoms.filter(atom =>
            isExpression(atom) && atom.operator?.name === '='
        );
        return constructList(rules, sym('()'));
    });

    registry.register('&rule-count', (interp) => {
        if (!interp?.space) {
            throw new Error('&rule-count requires interpreter context');
        }
        return sym(String(interp.space.size() || 0));
    });
}