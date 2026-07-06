import {ReductionStage} from './ReductionStage.js';
import {isExpression, isSymbol} from '../../Term.js';

export class ZipperStage extends ReductionStage {
    constructor(threshold = 8) {
        super('zipper');
        this.threshold = threshold;
    }

    process(atom, context) {
        if (!atom || !isExpression(atom)) {
            return null;
        }
        if (atom.operator) {
            const opName = atom.operator.name ?? atom.operator;
            if (opName === 'λ' || opName === 'lambda') {
                return null;
            }
        }
        if (!isSymbol(atom.operator)) {
            return null;
        }
        const depth = atom.depth ?? this._calculateDepth(atom);
        return depth > this.threshold ? {useZipper: true, atom, threshold: this.threshold} : null;
    }

    _calculateDepth(atom, depth = 0) {
        if (!atom || !isExpression(atom) || !atom.components) {
            return depth;
        }
        const maxCompDepth = atom.components.length > 0 ? Math.max(0, ...atom.components.map(c => this._calculateDepth(c, 0))) : 0;
        const maxOpDepth = atom.operator && isExpression(atom.operator) ? this._calculateDepth(atom.operator, 0) : 0;
        return 1 + Math.max(maxCompDepth, maxOpDepth);
    }
}
