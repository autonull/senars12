import type {Term} from '../terms';
import type {RuleFn} from './types.js';

export function composeRules(
    r1: RuleFn,
    r2: RuleFn
): RuleFn {
    return (([t1, t2]: [Term, Term]): Term | undefined => {
        const intermediate = r1([t1, t2]);
        if (!intermediate) return undefined;
        const result = r2([intermediate, t2]);
        return result ?? undefined;
    });
}

export function sequenceRules(...rules: RuleFn[]): RuleFn {
    return ([t1, t2]: [Term, Term]): Term | undefined => {
        for (const rule of rules) {
            const result = rule([t1, t2]);
            if (result) return result;
        }
        return undefined;
    };
}