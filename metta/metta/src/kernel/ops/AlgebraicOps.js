/**
 * AlgebraicOps.js - MORK-parity Phase P2-A: Algebraic Hypergraph Operations
 * compose, project, join, intersect with heuristic fusion
 */

import {Space} from '../Space.js';
import {Unify} from '../Unify.js';
import {isExpression, isVariable} from '../Term.js';

export const AlgebraicOps = {
    compose(s1, s2) {
        const resultSpace = new Space();
        for (const atom1 of s1.all()) {
            const conclusion = this._extractConclusion(atom1);
            for (const atom2 of s2.all()) {
                const head = this._extractHead(atom2);
                const bindings = Unify.unify(conclusion, head);
                if (bindings) {
                    if (this._isRule(atom1) && this._isRule(atom2)) {
                        const newRule = Unify.subst(atom2.components[1], bindings);
                        const newPattern = Unify.subst(atom1.components[0], bindings);
                        resultSpace.addRule(newPattern, newRule);
                    } else {
                        resultSpace.add(Unify.subst(atom2, bindings));
                    }
                }
            }
        }
        return resultSpace;
    },

    project(space, pred) {
        const resultSpace = new Space();
        for (const atom of space.all()) {
            if (Unify.unify(pred, atom)) {
                resultSpace.add(atom);
            }
        }
        return resultSpace;
    },

    join(s1, s2, key) {
        const resultSpace = new Space();
        if (!isVariable(key)) {
            return resultSpace;
        }
        const map1 = new Map();

        for (const atom of s1.all()) {
            const bindings = Unify.unify(key, atom);
            if (bindings?.[key.name] !== undefined) {
                const keyStr = this._keyToString(bindings[key.name]);
                if (!map1.has(keyStr)) {
                    map1.set(keyStr, []);
                }
                map1.get(keyStr).push(atom);
            }
        }

        for (const atom of s2.all()) {
            const bindings = Unify.unify(key, atom);
            if (bindings?.[key.name] !== undefined) {
                const keyStr = this._keyToString(bindings[key.name]);
                if (map1.has(keyStr)) {
                    for (const s1Atom of map1.get(keyStr)) {
                        resultSpace.add(s1Atom);
                        resultSpace.add(atom);
                    }
                }
            }
        }
        return resultSpace;
    },

    intersect(s1, s2) {
        const resultSpace = new Space();
        const s2Hashes = new Map();
        for (const atom of s2.all()) {
            const hash = this._structuralHash(atom);
            if (!s2Hashes.has(hash)) {
                s2Hashes.set(hash, []);
            }
            s2Hashes.get(hash).push(atom);
        }
        for (const atom of s1.all()) {
            const hash = this._structuralHash(atom);
            if (s2Hashes.has(hash)) {
                for (const s2Atom of s2Hashes.get(hash)) {
                    if (this._structuralEquals(atom, s2Atom)) {
                        resultSpace.add(atom);
                        break;
                    }
                }
            }
        }
        return resultSpace;
    },

    composeMany(...spaces) {
        if (spaces.length === 0) {
            return new Space();
        }
        if (spaces.length === 1) {
            return spaces[0];
        }
        if (spaces.length === 2) {
            return this.compose(spaces[0], spaces[1]);
        }

        const resultSpace = new Space();
        const functorIndex = new Map();

        for (let i = 1; i < spaces.length; i++) {
            for (const atom of spaces[i].all()) {
                const functor = isExpression(atom) ? (atom.operator?.name || atom.operator) : (atom.name || atom);
                if (!functorIndex.has(functor)) {
                    functorIndex.set(functor, []);
                }
                functorIndex.get(functor).push({spaceIndex: i, atom});
            }
        }

        for (const atom1 of spaces[0].all()) {
            const conclusion = this._extractConclusion(atom1);
            let currentMatches = [atom1];
            const currentBindings = new Map();

            for (let i = 1; i < spaces.length && currentMatches.length > 0; i++) {
                const nextMatches = [];
                for (const match of currentMatches) {
                    const matchConclusion = this._extractConclusion(match);
                    const functor = isExpression(matchConclusion) ? (matchConclusion.operator?.name || matchConclusion.operator) : (matchConclusion.name || matchConclusion);
                    const candidates = functorIndex.get(functor) || [];

                    for (const {atom: candidate} of candidates) {
                        if (candidate.spaceIndex !== i) {
                            continue;
                        }
                        const candidateHead = this._extractHead(candidate);
                        const bindings = Unify.unify(matchConclusion, candidateHead);
                        if (bindings) {
                            nextMatches.push(candidate);
                            for (const [k, v] of bindings.entries()) {
                                currentBindings.set(k, v);
                            }
                        }
                    }
                }
                currentMatches = nextMatches;
            }

            for (const match of currentMatches) {
                if (this._isRule(atom1) && this._isRule(match)) {
                    const newRule = Unify.subst(match.components[1], currentBindings);
                    const newPattern = Unify.subst(atom1.components[0], currentBindings);
                    resultSpace.addRule(newPattern, newRule);
                }
            }
        }
        return resultSpace;
    },

    tryFusion(expr) {
        if (!isExpression(expr)) {
            return null;
        }
        const op = expr.operator?.name || expr.operator;
        if (op !== 'compose') {
            return null;
        }
        const comps = expr.components || [];
        if (comps.length < 2) {
            return null;
        }

        for (const comp of comps) {
            if (isExpression(comp) && (comp.operator?.name === 'compose' || comp.operator === 'compose')) {
                return [...(comp.components || []), ...comps.filter(c => c !== comp)];
            }
        }
        return null;
    },

    _isRule(atom) {
        return isExpression(atom) && (atom.operator?.name === '=' || atom.operator === '=') && atom.components?.length === 2;
    },

    _extractConclusion(atom) {
        return this._isRule(atom) ? atom.components[1] : atom;
    },

    _extractHead(atom) {
        return this._isRule(atom) ? atom.components[0] : atom;
    },

    _keyToString(key) {
        return key.name || key.toString();
    },

    _structuralHash(atom) {
        if (!atom) {
            return 'null';
        }
        if (typeof atom === 'string') {
            return `s:${atom}`;
        }
        if (typeof atom === 'number') {
            return `n:${atom}`;
        }
        if (atom.id !== undefined) {
            return `id:${atom.id}`;
        }
        if (atom.name !== undefined && !atom.components) {
            return `sym:${atom.name}`;
        }
        if (isExpression(atom)) {
            return `exp:${this._structuralHash(atom.operator)}[${(atom.components || []).map(c => this._structuralHash(c)).join(',')}]`;
        }
        return `unknown:${atom.toString()}`;
    },

    _structuralEquals(a, b) {
        if (a === b) {
            return true;
        }
        if (!a || !b || typeof a !== typeof b) {
            return false;
        }
        if (typeof a === 'string' || typeof a === 'number') {
            return a === b;
        }
        if (a.name !== undefined && !a.components) {
            return a.name === b.name;
        }
        if (a.id !== undefined) {
            return a.id === b.id;
        }
        if (isExpression(a) && isExpression(b)) {
            if (!this._structuralEquals(a.operator, b.operator)) {
                return false;
            }
            if ((a.components?.length || 0) !== (b.components?.length || 0)) {
                return false;
            }
            return (a.components || []).every((c, i) => this._structuralEquals(c, b.components[i]));
        }
        return false;
    },

    register(ground) {
        ground.register('compose', this.compose);
        ground.register('project', this.project);
        ground.register('join', this.join);
        ground.register('intersect', this.intersect);
        ground.register('compose-many', this.composeMany);
    }
};
