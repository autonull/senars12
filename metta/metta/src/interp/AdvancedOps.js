/**
 * AdvancedOps.js - Advanced interpreter operations
 */

// Kernel imports
import {grounded, isExpression, sym, Term} from '../kernel/Term.js';
import {Unify} from '../kernel/Unify.js';
import {bindingsAtomToObj, objToBindingsAtom} from '../kernel/Bindings.js';
import {Formatter} from '../kernel/Formatter.js';
import {match, reduceND, reduceNDAsync} from '../kernel/Reduce.js';

export function registerAdvancedOps(interpreter) {
    const {sym, exp, var: v, isExpression} = Term;
    const register = (ops) => {
        for (const [name, {fn, opts}] of Object.entries(ops)) {
            interpreter.ground.register(name, fn, opts);
        }
    };

    const formatNum = n => sym(String(n));

    register({
        // Substitution operations
        '&subst': {
            fn: (a, b, c) => {
                if (c) {
                    const bindings = a.name ? {[a.name]: b} : (Unify.unify(a, b) || (a?.components?.length === 1 && a.operator?.name !== ":" && a.components[0].name ? {[a.components[0].name]: b} : {}));
                    return Unify.subst(c, bindings, {recursive: false});
                }
                return Unify.subst(a, bindingsAtomToObj(b), {recursive: false});
            },
            opts: {lazy: true}
        },
        // let: reduce value, then substitute into body
        '&let': {
            fn: (vari, val, body) => {
                const reduced = reduceND(val, interpreter.space, interpreter.ground,
                    undefined, undefined, interpreter);
                const resolved = reduced[0] ?? val;
                const bindings = (vari?.type === 'variable' || vari?.name?.startsWith('$')) ? {[vari.name]: resolved} : (Unify.unify(vari, resolved) || (vari?.components?.length === 0 && vari.operator?.name !== ":" && (vari.operator?.type === 'variable' || vari.operator?.name?.startsWith('$')) ? {[vari.operator.name]: resolved} : null) || (vari?.components?.length === 1 && vari.operator?.name !== ":" && (vari.components[0]?.type === 'variable' || vari.components[0]?.name?.startsWith('$')) ? {[vari.components[0].name]: resolved} : null) || {});
                return Unify.subst(body, bindings, {recursive: false});
            },
            opts: {lazy: true}
        },

        // Unification operations
        '&unify': {
            fn: (pat, term) => {
                const b = Unify.unify(pat, term);
                return b ? objToBindingsAtom(b) : sym('False');
            },
            opts: {lazy: true}
        },

        // Matching operations
        '&match': {
            fn: (s, p, t) => interpreter._listify(match(interpreter.space, p, t)),
            opts: {lazy: true}
        },
        '&query': {
            fn: (p, t) => interpreter._listify(match(interpreter.space, p, t)),
            opts: {lazy: true}
        },

        // Type operations
        '&type-of': {
            fn: (atom) => {
                // Query for (: atom $type) patterns in the space
                const res = match(interpreter.space, exp(':', [atom, v('type')]), v('type'));
                if (res.length > 0) {
                    // Return as grounded to prevent further reduction
                    const typeName = res[0].name || res[0].toString();
                    return grounded(typeName);
                }

                // Fallback: try structural type inference
                try {
                    const inferredType = interpreter.typeChecker?.infer(atom, {});
                    if (inferredType) {
                        const typeName = interpreter.typeChecker.typeToString(inferredType);
                        return grounded(typeName);
                    }
                } catch {
                }
                return grounded('Atom');
            },
            opts: {lazy: true}
        },
        '&type-infer': {
            fn: (term) => {
                try {
                    return sym(interpreter.typeChecker?.typeToString(interpreter.typeChecker.infer(term, {})) || 'Unknown');
                } catch {
                    return sym('Error');
                }
            },
            opts: {lazy: true}
        },
        '&type-check': {
            fn: (t, type) => sym(interpreter.typeChecker ? 'True' : 'False'),
            opts: {lazy: true}
        },

        // Context-dependent type operations
        '&get-type': {
            // Get type of an atom from the space
            fn: (atom, space) => {
                const s = space || interpreter.space;
                // First try to find a type annotation rule (pattern: atom, result: type)
                const rules = s.rulesFor(atom);
                for (const rule of rules) {
                    // Check if this is a type annotation rule (pattern matches atom exactly)
                    if (rule.pattern && rule.result) {
                        const patternMatches = rule.pattern.name === atom.name ||
                            (rule.pattern.toString && rule.pattern.toString() === atom.toString());
                        if (patternMatches) {
                            return rule.result;
                        }
                    }
                }
                // Fallback: look for (: atom $type) expression in space (as atom or rule)
                const typePattern = exp(sym(':'), [atom, v('type')]);
                const results = match(s, typePattern, v('type'));
                return results.length ? results[0] : sym('%Undefined%');
            },
            opts: {lazy: true}
        },
        '&match-types': {
            fn: (t1, t2, thenBranch, elseBranch) => {
                const isWildcard = (t) => t.name === '%Undefined%' || t.name === 'Atom';
                if (isWildcard(t1) || isWildcard(t2)) {
                    return thenBranch;
                }
                return Unify.unify(t1, t2) !== null ? thenBranch : elseBranch;
            },
            opts: {lazy: true}
        },
        '&assert-type': {
            fn: (atom, expectedType, space) => {
                const s = space || interpreter.space;
                const actualType = interpreter.ground.execute('&get-type', atom, s);

                if (actualType.name === '%Undefined%') {
                    return atom;
                }

                const bindings = Unify.unify(actualType, expectedType);
                if (bindings !== null) {
                    return atom;
                }

                return exp(sym('Error'), [atom, exp(sym('TypeError'), [expectedType, actualType])]);
            },
            opts: {lazy: true}
        },

        // Space operations
        '&get-atoms': {
            fn: () => interpreter._listify(interpreter.space.all()),
            opts: {lazy: true}
        },
        '&add-atom': {
            fn: (s, a) => {
                // PeTTa style: (&add-atom &self atom) or named space
                const resolveSpace = (name) => name === '&self' ? interpreter.space :
                    (interpreter.spaces?.get(name) || null);
                let space, atom;
                if (s?.name === '&self' || resolveSpace(s?.name)) {
                    space = resolveSpace(s?.name) ?? interpreter.space;
                    atom = a;
                } else if (s?.add) {
                    space = s; atom = a;
                } else {
                    space = interpreter.space; atom = s;
                }
                if (space && atom) {
                    if (atom?.operator?.name === '=' && atom.components?.length === 2) {
                        space.addRule(atom.components[0], atom.components[1]);
                    } else {
                        space.add(atom);
                    }
                }
                return atom ?? sym('()');
            },
            opts: {lazy: true}
        },
        '&rm-atom': {
            fn: (s, a) => {
                const resolveSpace = (name) => name === '&self' ? interpreter.space :
                    (interpreter.spaces?.get(name) || null);
                let space, atom;
                if (s?.name === '&self' || resolveSpace(s?.name)) {
                    space = resolveSpace(s?.name) ?? interpreter.space;
                    atom = a;
                } else if (s?.remove) {
                    space = s; atom = a;
                } else {
                    space = interpreter.space; atom = s;
                }
                if (space && atom) space.remove(atom);
                return sym('()');
            },
            opts: {lazy: true}
        },

        // I/O operations
        '&println': {
            fn: (...args) => {
                console.log(...args.map(a => Formatter.toHyperonString(a)));
                return sym('()');
            },
            opts: {lazy: true}
        },

        // List operations
        '&length': {
            fn: (list) => {
                if (list?.name === '()') {
                    return formatNum(0);
                }
                if (list?.operator?.name === ':' && list?.components) {
                    const flattener = interpreter.ground._flattenExpr ? interpreter.ground : interpreter;
                    const flattened = flattener._flattenExpr ? flattener._flattenExpr(list) : interpreter._flattenToList(list);
                    return formatNum(flattened.length);
                }
                return formatNum(list?.components ? list.components.length + 1 : 1);
            },
            opts: {lazy: true}
        },

        // Control flow operations
        // &if: reduce condition, then evaluate chosen branch (works in both sync and async paths)
        '&if': {
            fn: async (cond, thenB, elseB) => {
                // Try async reduction first (works in async pipeline)
                try {
                    const results = await reduceNDAsync(cond, interpreter.space, interpreter.ground,
                        undefined, undefined, interpreter);
                    const condRes = results[0] ?? cond;
                    if (condRes?.name === 'True') {
                        const branchRes = await reduceNDAsync(thenB, interpreter.space, interpreter.ground,
                            undefined, undefined, interpreter);
                        return branchRes[0] ?? thenB;
                    }
                    if (condRes?.name === 'False') {
                        const branchRes = await reduceNDAsync(elseB, interpreter.space, interpreter.ground,
                            undefined, undefined, interpreter);
                        return branchRes[0] ?? elseB;
                    }
                    return exp(sym('if'), [condRes, thenB, elseB]);
                } catch {
                    // Fallback: sync reduction (if condition is already a concrete value)
                    const results = reduceND(cond, interpreter.space, interpreter.ground,
                        undefined, undefined, interpreter);
                    const condRes = results[0] ?? cond;
                    if (condRes?.name === 'True') {
                        const branchRes = reduceND(thenB, interpreter.space, interpreter.ground,
                            undefined, undefined, interpreter);
                        return branchRes[0] ?? thenB;
                    }
                    if (condRes?.name === 'False') {
                        const branchRes = reduceND(elseB, interpreter.space, interpreter.ground,
                            undefined, undefined, interpreter);
                        return branchRes[0] ?? elseB;
                    }
                    return exp(sym('if'), [condRes, thenB, elseB]);
                }
            },
            opts: {lazy: true, async: true}
        },
        // &when: reduce condition; if True reduce body, else return ()
        '&when': {
            fn: async (cond, body) => {
                try {
                    const results = await reduceNDAsync(cond, interpreter.space, interpreter.ground,
                        undefined, undefined, interpreter);
                    const condRes = results[0] ?? cond;
                    if (condRes?.name === 'True') {
                        const bodyRes = await reduceNDAsync(body, interpreter.space, interpreter.ground,
                            undefined, undefined, interpreter);
                        return bodyRes[0] ?? body;
                    }
                    return sym('()');
                } catch {
                    const results = reduceND(cond, interpreter.space, interpreter.ground,
                        undefined, undefined, interpreter);
                    const condRes = results[0] ?? cond;
                    if (condRes?.name === 'True') {
                        const bodyRes = reduceND(body, interpreter.space, interpreter.ground,
                            undefined, undefined, interpreter);
                        return bodyRes[0] ?? body;
                    }
                    return sym('()');
                }
            },
            opts: {lazy: true, async: true}
        },
        // let*: sequentially reduce each binding value, substitute into remaining bindings and body
        '&let*': {
            fn: (binds, body) => {
                const pairs = interpreter._extractLetStarPairs(binds);
                if (!pairs.length) {
                    const r = reduceND(body, interpreter.space, interpreter.ground,
                        undefined, undefined, interpreter);
                    return r[0] ?? body;
                }
                const mutablePairs = pairs.map(p => ({...p}));
                let result = body;
                for (let i = 0; i < mutablePairs.length; i++) {
                    const [vari, val] = interpreter._extractVarAndValue(mutablePairs[i]);
                    if (!vari || !val) {continue;}
                    let substVal = val;
                    for (let j = 0; j < i; j++) {
                        const [prevVari, prevResolved] = mutablePairs[j].resolved;
                        if (prevVari) {
                            substVal = Unify.subst(substVal, {[prevVari.name]: prevResolved}, {recursive: false});
                        }
                    }
                    const reduced = reduceND(substVal, interpreter.space, interpreter.ground,
                        undefined, undefined, interpreter);
                    const resolved = reduced[0] ?? substVal;
                    mutablePairs[i].resolved = [vari, resolved];
                    result = Unify.subst(result, {[vari.name]: resolved}, {recursive: false});
                }
                const finalReduced = reduceND(result, interpreter.space, interpreter.ground,
                    undefined, undefined, interpreter);
                return finalReduced[0] ?? result;
            },
            opts: {lazy: true}
        },

        // Higher-order function operations
        '&map-fast': {
            fn: (fn, list) => {
                const flattener = interpreter.ground._flattenExpr ? interpreter.ground : interpreter;
                const listToMap = flattener._flattenExpr ? flattener._flattenExpr(list) : interpreter._flattenToList(list);
                return interpreter._listify(listToMap.map(el =>
                    interpreter._reduceDeterministic(exp(fn, [el]))
                ));
            },
            opts: {lazy: true}
        },
        '&filter-fast': {
            fn: (pred, list) => {
                const flattener = interpreter.ground._flattenExpr ? interpreter.ground : interpreter;
                const listToFilter = flattener._flattenExpr ? flattener._flattenExpr(list) : interpreter._flattenToList(list);

                const filtered = listToFilter.filter(el => {
                    if (!el) {
                        return false;
                    }
                    try {
                        const expr = exp(pred, [el]);
                        const result = interpreter._reduceDeterministic(expr);
                        return interpreter._truthy(result);
                    } catch (e) {
                        return false;
                    }
                });
                return interpreter._listify(filtered);
            },
            opts: {lazy: true}
        },
        '&foldl-fast': {
            fn: (fn, init, list) => {
                const flattener = interpreter.ground._flattenExpr ? interpreter.ground : interpreter;
                const listToFold = flattener._flattenExpr ? flattener._flattenExpr(list) : interpreter._flattenToList(list);

                return listToFold.reduce((acc, el) =>
                    interpreter._reduceDeterministic(exp(fn, [acc, el])), init);
            },
            opts: {lazy: true}
        },
        'reduce-atom': {
            fn: (list, accVar, elVar, op) => {
                const flattener = interpreter.ground._flattenExpr ? interpreter.ground : interpreter;
                const elements = flattener._flattenExpr ? flattener._flattenExpr(list) : interpreter._flattenToList(list);

                if (elements.length === 0) {
                    return sym('()');
                }

                return elements.slice(1).reduce((result, el) => {
                    const substOp = Unify.subst(op, {[accVar.name]: result, [elVar.name]: el});
                    return interpreter._reduceDeterministic(substOp);
                }, elements[0]);
            },
            opts: {lazy: true}
        },

        // is-var: check if atom is a variable
        '&is-var': {
            fn: (a) => sym(a.type === 'variable' || a.name?.startsWith('$') ? 'True' : 'False'),  // TYPE_VARIABLE = 3
            opts: {lazy: true}
        },

        // =alpha: check alpha-equivalence (structural equality ignoring variable names)
        '&=alpha': {
            fn: (a, b) => sym(alphaEquiv(a, b) ? 'True' : 'False'),
            opts: {lazy: true}
        },

        // repr: return string representation of an atom
        '&repr': {
            fn: (a) => {
                // Check if this is a partially applied function
                if (isExpression(a)) {
                    const opName = a.operator?.name;
                    if (opName) {
                        const rules = interpreter.space.rulesFor(a.operator);
                        if (rules.length > 0) {
                            const expectedArity = rules[0].pattern?.components?.length ?? 0;
                            const providedArity = a.components?.length ?? 0;
                            if (providedArity < expectedArity) {
                                const argsList = a.components.map(c => c.toString()).join(' ');
                                return sym(`"(partial ${opName} (${argsList}))"`);
                            }
                        }
                    }
                }
                return sym('"' + a.toString() + '"');
            },
            opts: {lazy: true}
        },

        // case: match expression against multiple patterns
        '&case': {
            fn: (expr, branches) => {
                // First reduce expr to get its value
                const exprResults = reduceND(expr, interpreter.space, interpreter.ground,
                    undefined, undefined, interpreter);
                const exprVal = exprResults[0] ?? expr;

                // Collect all (pattern result) pairs from branches
                const pairs = [];
                if (isExpression(branches) && branches.operator?.name === ':') {
                    let cur = branches;
                    while (isExpression(cur) && cur.operator?.name === ':') {
                        pairs.push(cur.components[0]);
                        cur = cur.components[1];
                    }
                } else if (isExpression(branches)) {
                    pairs.push(branches.operator);
                    for (const c of (branches.components ?? [])) pairs.push(c);
                }

                for (const pair of pairs) {
                    if (!isExpression(pair)) continue;
                    let pattern, result;
                    if (pair.operator?.name === ':' && pair.components?.length === 2) {
                        pattern = pair.components[0];
                        result = pair.components[1];
                    } else {
                        pattern = pair.operator;
                        result = pair.components?.[0];
                    }
                    if (pattern === undefined || result === undefined) continue;

                    // Special: Empty pattern matches empty/no result
                    if (pattern?.name === 'Empty') {
                        if (exprVal?.name === 'Empty' || exprVal?.name === '()') {
                            const reduced = reduceND(result,
                                interpreter.space, interpreter.ground, undefined, undefined, interpreter);
                            return reduced[0] ?? result;
                        }
                        continue;
                    }

                    const binds = Unify.unify(exprVal, pattern);
                    if (binds !== null && binds !== undefined) {
                        const reduced = reduceND(Unify.subst(result, binds),
                            interpreter.space, interpreter.ground, undefined, undefined, interpreter);
                        return reduced[0] ?? result;
                    }
                }
                return sym('()');
            },
            opts: {lazy: true}
        },

        // msort: sort a list
        '&msort': {
            fn: (list) => {
                const {isList, flattenList, constructList, isExpression} = Term;
                let elements;
                if (isList(list)) {
                    elements = flattenList(list).elements;
                } else if (isExpression(list)) {
                    elements = [list.operator, ...(list.components ?? [])];
                } else {
                    return list;
                }
                const sorted = [...elements].sort((a, b) => {
                    const aStr = a.toString(), bStr = b.toString();
                    return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
                });
                return interpreter._listify(sorted);
            },
            opts: {lazy: true}
        },

        // hyperpose: non-deterministic choice from a list (like superpose but lazy)
        '&hyperpose': {
            fn: (list) => {
                const {isList, flattenList, isExpression} = Term;
                let elements;
                if (isList(list)) {
                    elements = flattenList(list).elements;
                } else if (isExpression(list)) {
                    elements = [list.operator, ...(list.components ?? [])];
                } else {
                    return list;
                }
                if (elements.length === 0) return sym('()');
                if (elements.length === 1) return elements[0];
                return exp(sym('superpose-internal'), elements);
            },
            opts: {lazy: true}
        },

        // foldall: fold over all results of a non-deterministic reduction
        '&foldall': {
            fn: (opFn, expr, init) => {
                const results = reduceND(expr, interpreter.space, interpreter.ground,
                    undefined, undefined, interpreter);
                let acc = init;
                for (const el of results) {
                    let callExpr;
                    if (isExpression(opFn) || opFn?.type === 'atom') {
                        callExpr = exp(opFn, [acc, el]);
                    } else {
                        callExpr = Unify.subst(opFn, {[v('acc').name]: acc, [v('el').name]: el});
                    }
                    const reduced = reduceND(callExpr, interpreter.space, interpreter.ground,
                        undefined, undefined, interpreter);
                    acc = reduced[0] ?? callExpr;
                }
                return acc;
            },
            opts: {lazy: true}
        }
    });
}

/**
 * Check alpha-equivalence: structural equality ignoring variable names
 * TYPE_VARIABLE = 2, TYPE_EXPRESSION = 3 (do NOT use _typeTag===3 for variable check)
 */
function alphaEquiv(a, b) {
    if (a === b) return true;
    if (!a || !b) return false;
    // Variables are equivalent to any other variable regardless of name
    const aIsVar = a._typeTag === 2 || (a.type === 'atom' && a.name?.startsWith('$'));
    const bIsVar = b._typeTag === 2 || (b.type === 'atom' && b.name?.startsWith('$'));
    if (aIsVar && bIsVar) return true;
    // Expressions: compare operators and components recursively
    if (isExpression(a) && isExpression(b)) {
        if (!alphaEquiv(a.operator, b.operator)) return false;
        const aComps = a.components ?? [];
        const bComps = b.components ?? [];
        if (aComps.length !== bComps.length) return false;
        return aComps.every((c, i) => alphaEquiv(c, bComps[i]));
    }
    // Grounded atoms: compare values
    if (a.type === 'grounded' && b.type === 'grounded') return String(a.value) === String(b.value);
    // Symbols: compare names
    return a.name === b.name;
}
