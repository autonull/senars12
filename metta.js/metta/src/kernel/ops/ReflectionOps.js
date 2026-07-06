/**
 * ReflectionOps.js - Reflection operations for JS interoperability
 */

import {grounded, isGrounded, sym} from '../Term.js';
import {OperationHelpers} from './OperationHelpers.js';
import {Logger} from '@senars/core';

export function registerReflectionOps(registry) {
    const unwrap = (atom) => {
        if (!atom) {
            return atom;
        }
        if (isGrounded(atom)) {
            return atom.value;
        }
        if (atom.type === 'atom') {
            const n = OperationHelpers.atomToNum(atom);
            if (n !== null) {
                return n;
            }
            if (atom.name === 'True') {
                return true;
            }
            if (atom.name === 'False') {
                return false;
            }
            if (atom.name === 'Null') {
                return null;
            }
            if (atom.name === 'undefined') {
                return undefined;
            }

            // Strip quotes if present
            let {name} = atom;
            if (typeof name === 'string' && name.startsWith('"') && name.endsWith('"')) {
                name = name.slice(1, -1);
            }
            return name;
        }
        if (atom.type === 'compound') {
            // Check if it's a list. If so, unwrap to array
            if (OperationHelpers.isList(atom)) {
                const elements = OperationHelpers.flattenExpr(atom);
                return elements.map(unwrap);
            }
        }
        return atom;
    };

    const wrap = (val) => {
        if (val === null) {
            return sym('Null');
        }
        if (val === undefined) {
            return sym('undefined');
        }
        if (typeof val === 'boolean') {
            return sym(val ? 'True' : 'False');
        }
        if (typeof val === 'number') {
            return sym(String(val));
        }
        if (typeof val === 'string') {
            // Optionally add quotes, but returning as symbol is standard MeTTa
            if (val.includes(' ') || val === '') {
                return sym(`"${val}"`);
            }
            return sym(val);
        }
        if (Array.isArray(val)) {
            return OperationHelpers.listify(val.map(wrap));
        }
        // Promise handling
        if (val instanceof Promise) {
            // For promises, we return a grounded promise. The interpreter handles async if requested,
            // but if we want `&js-call` to automatically await, we handle it in the op registration.
            return grounded(val);
        }

        // Returns objects/functions as GroundedAtoms. Primitives were already returned as pure Term atoms above.
        return grounded(val);
    };

    registry.register('&js-import', async (path) => {
        // Warning: this returns a promise if used in sync context?
        // But &js-import should be async.
        // Wait, import() returns a Promise<ModuleNamespace>.
        // We wrap it in grounded().
        // If we want to use it immediately in next step, we might need to await it.
        // The interpreter handles async ops if they are registered as async.
        const mod = await import(unwrap(path));
        return grounded(mod);
    }, {async: true});

    registry.register('&js-new', (cls, ...args) => {
        const Constructor = unwrap(cls);
        const jsArgs = args.map(unwrap);
        if (typeof Constructor !== 'function') {
            throw new Error(`&js-new: Class constructor not found or not a function: ${cls}`);
        }
        return wrap(new Constructor(...jsArgs));
    });

    registry.register('&js-call', async (obj, method, ...args) => {
        // Since arrays map to MeTTa lists automatically, `unwrap` of a MeTTa list `(1 2 3)`
        // produces a JS Array `[1, 2, 3]`. This lets array methods work correctly natively!
        let target = unwrap(obj);
        const methodName = unwrap(method);

        // If target was unwrapped as a MeTTa list structure from earlier wrapping, unwrap it deeply to JS Array
        if (!target && typeof obj === 'object' && 'type' in obj && obj.type === 'compound') {
            const unwrappedTarget = unwrap(obj);
            if (Array.isArray(unwrappedTarget)) {
                target = unwrappedTarget;
            }
        }

        if (target == null) {
            throw new Error(`&js-call: Target object is null/undefined for method '${methodName}'`);
        }

        let fn = target[methodName];
        let ctx = target;

        // Handle nested paths like "foo.bar" if method is a string
        if (!fn && typeof methodName === 'string' && methodName.includes('.')) {
            const parts = methodName.split('.');
            let current = target;
            for (let i = 0; i < parts.length; i++) {
                if (i === parts.length - 1) {
                    ctx = current;
                }
                current = current?.[parts[i]];
            }
            fn = current;
        }

        if (typeof fn !== 'function') {
            throw new Error(`&js-call: Method '${methodName}' not found or not a function on target of type ${typeof target}`);
        }

        const jsArgs = args.map(unwrap);
        let result = fn.apply(ctx, jsArgs);

        // Auto-await Promises
        if (result instanceof Promise) {
            result = await result;
        }

        // If the result is an array of promises
        if (Array.isArray(result) && result.some(r => r instanceof Promise)) {
            result = await Promise.all(result);
        }

        return wrap(result);
    });

    registry.register('&js-get', (obj, prop) => {
        const target = unwrap(obj);
        const p = unwrap(prop);

        if (target == null) {
            throw new Error(`&js-get: Target object is null/undefined when accessing property '${p}'`);
        }
        const val = target[p];
        return wrap(val);
    });

    registry.register('&js-set', (obj, prop, val) => {
        const target = unwrap(obj);
        const p = unwrap(prop);
        if (target == null) {
            throw new Error(`&js-set: Target object is null/undefined`);
        }
        target[p] = unwrap(val);
        return wrap(target);
    });

    registry.register('&js-type', (obj) => {
        const val = unwrap(obj);
        return sym(typeof val);
    });

    registry.register('&js-global', (name) => {
        const n = unwrap(name);
        if (typeof globalThis !== 'undefined' && globalThis[n]) {
            return wrap(globalThis[n]);
        }
        if (typeof global !== 'undefined' && global[n]) {
            return wrap(global[n]);
        }
        if (typeof window !== 'undefined' && window[n]) {
            return wrap(window[n]);
        }
        return wrap(null);
    });

    registry.register('&js-unwrap', (obj) => {
        return wrap(unwrap(obj));
    });

    registry.register('&js-callback', (fnAtom) => {
        // Creates a JS function that executes the given MeTTa expression with arguments
        // Needs access to interpreter context. Since this is in Ground, we can get it.
        const interp = registry.context;
        if (!interp) {
            throw new Error(`&js-callback: Interpreter context not available in registry.`);
        }

        const callback = async (...jsArgs) => {
            try {
                // Wrap incoming JS arguments to MeTTa atoms
                const mettaArgs = jsArgs.map(wrap);

                // Construct application expression: (fnAtom arg1)
                // For JS array map callbacks, they pass (value, index, array).
                // However, MeTTa functions usually just take 1 arg if designed for map.
                // So we'll pass all args, but if it fails to evaluate fully, that's fine.
                // Actually `OperationHelpers.listify` creates a MeTTa list structure, but for function evaluation,
                // we want a MeTTa expression atom `(fnAtom arg1 arg2 ...)`.
                // We can use the native Term.exp import (assuming it's imported at the top, wait, sym and grounded are imported but exp is not)
                // Let's create expression atom via constructor. Oh wait, `Term.exp`? Let's check imports.
                // We'll use interp.parser or import exp directly if available.
                // It's safer to just construct an array of components and wrap them.
                // Wait, the interpreter has an `evaluate` function. We can just pass the atom we want to evaluate.
                // `interp.typeSystem` or `interp.space`?
                // Let's use a raw object that matches ExpressionAtom structure:
                const expr = {
                    type: 'compound',
                    name: '', // Optional for expression
                    operator: fnAtom,
                    components: mettaArgs,
                    _typeTag: 2 // TYPE_EXPRESSION
                };

                // Evaluate using the async reduction system
                const res = await interp.evaluateAsync(expr);

                // Unwrap the result to pass back to JS
                // If it's a single result, return that, otherwise an array
                if (Array.isArray(res)) {
                    if (res.length === 0) {
                        return undefined;
                    }
                    if (res.length === 1) {
                        return unwrap(res[0]);
                    }
                    return res.map(unwrap);
                }
                return unwrap(res);
            } catch (e) {
                Logger.error("Error executing MeTTa callback:", e);
                throw e;
            }
        };

        return grounded(callback);
    });
}
