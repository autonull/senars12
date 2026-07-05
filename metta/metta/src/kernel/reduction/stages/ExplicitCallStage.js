import {ReductionStage} from './ReductionStage.js';
import {isExpression} from '../../Term.js';

export class ExplicitCallStage extends ReductionStage {
    constructor() {
        super('explicit-call');
    }

    process(atom, context) {
        if (!isExpression(atom) || !atom.operator) {
            return null;
        }
        const opName = atom.operator.name ?? atom.operator;
        if (typeof opName !== 'string' || !opName.startsWith('&')) {
            return null;
        }
        const op = context.ground.lookup(atom.operator);
        if (!op || typeof op !== 'function') {
            return null;
        }
        return {executeExplicit: true, atom, op, args: atom.components ?? []};
    }
}
