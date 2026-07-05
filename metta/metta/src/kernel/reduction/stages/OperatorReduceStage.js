import {ReductionStage} from './ReductionStage.js';
import {isExpression} from '../../Term.js';

export class OperatorReduceStage extends ReductionStage {
    constructor() {
        super('operator-reduce');
    }

    process(atom, context) {
        if (!isExpression(atom) || !atom.operator || !isExpression(atom.operator)) {
            return null;
        }
        return {reduceOperator: true, atom};
    }
}
