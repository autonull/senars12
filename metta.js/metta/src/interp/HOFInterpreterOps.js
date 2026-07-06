/**
 * HOFInterpreterOps.js - Higher-order function operations with interpreter awareness
 */

import {Term} from '../kernel/Term.js';
import {Unify} from '../kernel/Unify.js';
import {reduce} from '../kernel/Reduce.js';

export function registerHofOps(interpreter) {
    const {sym, exp, isExpression} = Term;
    const reg = (n, fn, opts) => interpreter.ground.register(n, fn, opts);

    const getElements = (list) => {
        const {isList, flattenList, isExpression} = Term;
        if (list?.name === '()') return [];
        if (isList(list)) return flattenList(list).elements;
        if (isExpression(list)) return [list.operator, ...(list.components ?? [])];
        return [list];
    };

    const applyFn = (fn, args) => {
        // Apply fn to args: build (fn arg0 arg1 ...) and reduce
        const callExpr = exp(fn, args);
        return reduce(callExpr, interpreter.space, interpreter.ground,
            interpreter.config.maxReductionSteps, interpreter.memoCache, interpreter);
    };

    const substAndReduce = (fn, varName, el) => {
        if (varName?.name) {
            return reduce(
                Unify.subst(fn, {[varName.name]: el}),
                interpreter.space, interpreter.ground,
                interpreter.config.maxReductionSteps, interpreter.memoCache, interpreter
            );
        }
        // fn is a function symbol — call it
        return applyFn(fn, [el]);
    };

    // Override HOF operations with interpreter-aware versions
    reg('map-atom-fast', (list, varName, transformFn) => {
        const elements = getElements(list);
        const mapped = elements.map(el => {
            if (varName?.name) {
                return reduce(Unify.subst(transformFn, {[varName.name]: el}),
                    interpreter.space, interpreter.ground,
                    interpreter.config.maxReductionSteps, interpreter.memoCache, interpreter);
            }
            // 2-arg form: (map-atom list fn) — varName is the fn, transformFn is undefined
            return applyFn(varName, [el]);
        });
        return interpreter._listify(mapped);
    }, {lazy: true});

    // 2-arg map-atom: (map-atom list fn-symbol)
    reg('map-atom', (list, fn) => {
        // Only handle 2-arg form where fn is a symbol/expression (not a template variable)
        const elements = getElements(list);
        const mapped = elements.map(el => applyFn(fn, [el]));
        return interpreter._listify(mapped);
    }, {lazy: true});

    reg('filter-atom-fast', (list, varName, predFn) => {
        const elements = getElements(list);
        const filtered = elements.filter(el => {
            let result;
            if (varName?.name) {
                result = reduce(Unify.subst(predFn, {[varName.name]: el}),
                    interpreter.space, interpreter.ground,
                    interpreter.config.maxReductionSteps, interpreter.memoCache, interpreter);
            } else {
                result = applyFn(varName, [el]);
            }
            return interpreter.ground._truthy(result);
        });
        return interpreter._listify(filtered);
    }, {lazy: true});

    // 2-arg filter-atom: (filter-atom list pred-symbol)
    reg('filter-atom', (list, pred) => {
        const elements = getElements(list);
        const filtered = elements.filter(el => {
            const result = applyFn(pred, [el]);
            return interpreter.ground._truthy(result);
        });
        return interpreter._listify(filtered);
    }, {lazy: true});

    reg('foldl-atom-fast', (list, init, aVar, bVar, opFn) => {
        const elements = getElements(list);
        return elements.reduce((acc, el) => {
            const substituted = Unify.subst(opFn, {[aVar.name]: acc, [bVar.name]: el});
            return reduce(substituted, interpreter.space, interpreter.ground,
                interpreter.config.maxReductionSteps, interpreter.memoCache, interpreter);
        }, init);
    }, {lazy: true});

    // 3-arg foldl-atom: (foldl-atom list init fn-symbol)
    reg('foldl-atom', (list, init, fn) => {
        const elements = getElements(list);
        return elements.reduce((acc, el) => applyFn(fn, [acc, el]), init);
    }, {lazy: true});
}
