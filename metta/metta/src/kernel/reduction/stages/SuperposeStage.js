import {ReductionStage} from './ReductionStage.js';
import {isExpression} from '../../Term.js';

export class SuperposeStage extends ReductionStage {
    constructor() {
        super('superpose');
    }

    process(atom, context) {
        if (!isExpression(atom)) {
            return null;
        }
        const opName = atom.operator?.name ?? atom.operator;
        if (opName !== 'superpose') {
            const found = this._findSuperpose(atom);
            if (found) {
                const parentOp = typeof opName === 'string' ? opName : (opName?.name ?? '');
                if (['collapse', 'collapse-n', 'superpose', 'superpose-weighted'].includes(parentOp)) {
                    return null;
                }
                return {reduceNestedSuperpose: true, atom, superposeAtom: found.atom, path: found.path};
            }
            return null;
        }
        const alternatives = atom.components ?? [];
        if (alternatives.length === 0) {
            return {superposeEmpty: true};
        }
        let alts = alternatives;
        if (alternatives.length === 1) {
            const first = alternatives[0];
            if (first.name === '()') {
                return {superposeEmpty: true};
            }
            if (isExpression(first)) {
                const firstOp = first.operator?.name ?? first.operator;
                alts = firstOp === ':' ? this._unpackList(first) : [first.operator, ...(first.components ?? [])];
            }
        }
        if (alts.length === 0) {
            return {superposeEmpty: true};
        }
        return {superpose: true, alternatives: alts};
    }

    _unpackList(term) {
        const result = [];
        let current = term;
        while (current && isExpression(current)) {
            const op = current.operator?.name ?? current.operator;
            if (op !== ':') {
                break;
            }
            if (!current.components || current.components.length < 2) {
                break;
            }
            result.push(current.components[0]);
            current = current.components[1];
        }
        return result;
    }

    _findSuperpose(atom) {
        if (!isExpression(atom)) {
            return null;
        }
        const opName = atom.operator?.name ?? atom.operator;
        if (opName === 'superpose') {
            return {atom, path: []};
        }
        for (let i = 0; i < atom.components.length; i++) {
            const found = this._findSuperpose(atom.components[i]);
            if (found) {
                return {atom: found.atom, path: [i, ...found.path]};
            }
        }
        return null;
    }
}
