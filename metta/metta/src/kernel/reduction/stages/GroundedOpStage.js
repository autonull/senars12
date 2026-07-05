import {ReductionStage} from './ReductionStage.js';
import {isExpression, isList} from '../../Term.js';

function isValueExpression(arg) {
    if (typeof arg === 'string' || typeof arg === 'number') {
        return true;
    }
    if (isList(arg)) {
        return true;
    }
    const op = arg.operator;
    if (op && op._typeTag === 1 && op.name && /^-?\d+$/.test(op.name)) {
        return true;
    }
    if (!arg.components || arg.components.length === 0) {
        return true;
    }
    return false;
}

export class GroundedOpStage extends ReductionStage {
    constructor() {
        super('grounded');
    }

    process(atom, context) {
        if (!isExpression(atom) || !atom.operator) {
            return null;
        }
        const opName = atom.operator.name ?? atom.operator;
        let op, args, opOptions, isGroundedCall = false;
        if (opName === '^') {
            if (!atom.components || atom.components.length < 1) {
                return null;
            }
            const groundedOp = atom.components[0];
            op = context.ground.lookup(groundedOp);
            opOptions = context.ground.getOptions(groundedOp);
            args = atom.components.slice(1);
            isGroundedCall = true;
        } else {
            op = context.ground.lookup(atom.operator);
            opOptions = context.ground.getOptions(atom.operator);
            args = atom.components ?? [];
        }
        if (!op || typeof op !== 'function') {
            return null;
        }
        if (!opOptions.lazy) {
            for (let i = 0; i < args.length; i++) {
                const arg = args[i];
                if (isExpression(arg) && !isValueExpression(arg)) {
                    return {reduceArgument: true, atom, argIndex: i, arg, isGroundedCall};
                }
            }
        }
        return {executeGrounded: true, atom, op, args, async: opOptions?.async === true};
    }
}
